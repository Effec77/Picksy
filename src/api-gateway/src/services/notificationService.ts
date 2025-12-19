import { 
  PriceAlert, 
  NotificationChannel, 
  UserPreferences,
  TrackedProduct,
  PricePoint
} from '../../../shared/types';
import { NotificationEngine, NotificationPriority } from './notificationEngine';
import { InMemoryNotificationQueue } from './notificationQueue';
import { NotificationProviderFactory } from './notificationProviders';
import { ServiceHealthMonitor, ServiceStatus } from './serviceHealthMonitor';
import { OfflineModeService } from './offlineMode';
import { logger } from '../utils/logger';

export interface NotificationServiceConfig {
  rateLimitPerUser: number; // notifications per hour
  rateLimitWindow: number; // milliseconds
  enableOfflineMode: boolean;
  maxCacheAge: number;
}

/**
 * Main notification service that orchestrates all notification functionality
 * Implements requirements 4.2 and 6.3 for reliable notifications and graceful degradation
 */
export class NotificationService {
  private engine: NotificationEngine;
  private healthMonitor: ServiceHealthMonitor;
  private offlineMode: OfflineModeService;
  private config: NotificationServiceConfig;
  private userRateLimits = new Map<string, { count: number; windowStart: number }>();

  constructor(config: NotificationServiceConfig) {
    this.config = config;
    
    // Initialize notification queue
    const queue = new InMemoryNotificationQueue();
    
    // Initialize notification engine
    this.engine = new NotificationEngine(queue);
    
    // Register all notification providers
    const providers = NotificationProviderFactory.createAllProviders();
    providers.forEach(provider => this.engine.registerProvider(provider));

    // Initialize health monitoring
    this.healthMonitor = new ServiceHealthMonitor();
    this.setupHealthMonitoring();

    // Initialize offline mode
    this.offlineMode = new OfflineModeService({
      enabled: config.enableOfflineMode,
      maxCacheAge: config.maxCacheAge,
      fallbackDataRetention: 24 * 60 * 60 * 1000, // 24 hours
      limitedFeatures: ['real-time updates', 'external notifications']
    });

    // Connect health monitor to notification engine
    this.healthMonitor.setNotificationEngine(this.engine);
  }

  /**
   * Start the notification service
   */
  async start(): Promise<void> {
    try {
      await this.engine.start();
      await this.healthMonitor.start();
      
      logger.info('Notification service started successfully');
    } catch (error) {
      logger.error('Failed to start notification service:', error);
      throw error;
    }
  }

  /**
   * Stop the notification service
   */
  async stop(): Promise<void> {
    try {
      await this.engine.stop();
      await this.healthMonitor.stop();
      
      logger.info('Notification service stopped');
    } catch (error) {
      logger.error('Error stopping notification service:', error);
      throw error;
    }
  }

  /**
   * Send price alert with rate limiting and degradation handling
   */
  async sendPriceAlert(
    alert: PriceAlert,
    userPreferences: UserPreferences
  ): Promise<{ success: boolean; deliveries: any[]; error?: string }> {
    try {
      // Check rate limiting
      if (!this.checkRateLimit(alert.userId)) {
        logger.warn(`Rate limit exceeded for user ${alert.userId}`);
        return {
          success: false,
          deliveries: [],
          error: 'Rate limit exceeded. Please wait before sending more notifications.'
        };
      }

      // Check system health
      const systemHealth = this.healthMonitor.getSystemHealth();
      
      if (systemHealth.overall === ServiceStatus.UNHEALTHY || this.offlineMode.isOffline()) {
        // System is unhealthy or in offline mode, try offline mode
        return await this.handleOfflineNotification(alert, userPreferences);
      }

      if (systemHealth.overall === ServiceStatus.DEGRADED) {
        // System is degraded, filter to most reliable channels
        userPreferences = this.filterToReliableChannels(userPreferences, systemHealth);
      }

      // Queue alert for delivery
      const deliveries = await this.engine.queueAlert(alert, userPreferences);
      
      // Track rate limit
      this.trackNotificationSent(alert.userId);

      logger.info(`Successfully queued alert ${alert.id} for ${deliveries.length} channels`);
      
      return {
        success: true,
        deliveries: deliveries.map(d => ({
          id: d.id,
          channel: d.channel,
          status: d.status,
          priority: d.priority
        }))
      };
    } catch (error) {
      logger.error(`Error sending price alert ${alert.id}:`, error);
      return {
        success: false,
        deliveries: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle notifications when system is offline or unhealthy
   */
  private async handleOfflineNotification(
    alert: PriceAlert,
    userPreferences: UserPreferences
  ): Promise<{ success: boolean; deliveries: any[]; error?: string }> {
    try {
      // Enable offline mode if not already enabled
      if (!this.offlineMode.isOffline()) {
        this.offlineMode.enableOfflineMode();
      }

      // In offline mode, we can only provide browser notifications
      const offlineChannels = userPreferences.notificationChannels.filter(
        channel => channel === NotificationChannel.BROWSER
      );

      if (offlineChannels.length === 0) {
        // Force browser notifications as fallback
        offlineChannels.push(NotificationChannel.BROWSER);
      }

      // Create modified preferences for offline mode
      const offlinePreferences: UserPreferences = {
        ...userPreferences,
        notificationChannels: offlineChannels
      };

      // Try to queue with limited functionality
      const deliveries = await this.engine.queueAlert(alert, offlinePreferences);
      
      logger.info(`Queued offline notification for alert ${alert.id}`);
      
      return {
        success: true,
        deliveries: deliveries.map(d => ({
          id: d.id,
          channel: d.channel,
          status: d.status,
          priority: d.priority,
          offline: true
        }))
      };
    } catch (error) {
      logger.error(`Error handling offline notification for alert ${alert.id}:`, error);
      return {
        success: false,
        deliveries: [],
        error: `Offline notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Filter notification channels to only reliable ones during degradation
   */
  private filterToReliableChannels(
    userPreferences: UserPreferences,
    systemHealth: any
  ): UserPreferences {
    const healthyChannels = userPreferences.notificationChannels.filter(channel => {
      const channelHealth = systemHealth.services.find((s: any) => 
        s.name.includes(channel) || s.name.includes(`${channel}-service`)
      );
      return !channelHealth || channelHealth.status === ServiceStatus.HEALTHY;
    });

    // Always keep browser notifications as fallback
    if (healthyChannels.length === 0) {
      healthyChannels.push(NotificationChannel.BROWSER);
    }

    return {
      ...userPreferences,
      notificationChannels: healthyChannels
    };
  }

  /**
   * Check if user is within rate limits
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = this.userRateLimits.get(userId);

    if (!userLimit) {
      return true; // No previous notifications
    }

    // Check if we're in a new window
    if (now - userLimit.windowStart > this.config.rateLimitWindow) {
      // Reset the window
      this.userRateLimits.set(userId, { count: 0, windowStart: now });
      return true;
    }

    // Check if under limit
    return userLimit.count < this.config.rateLimitPerUser;
  }

  /**
   * Track that a notification was sent for rate limiting
   */
  private trackNotificationSent(userId: string): void {
    const now = Date.now();
    const userLimit = this.userRateLimits.get(userId);

    if (!userLimit || now - userLimit.windowStart > this.config.rateLimitWindow) {
      // New window
      this.userRateLimits.set(userId, { count: 1, windowStart: now });
    } else {
      // Increment count in current window
      userLimit.count++;
    }
  }

  /**
   * Setup health monitoring for notification dependencies
   */
  private setupHealthMonitoring(): void {
    // Monitor notification providers
    this.healthMonitor.registerService({
      name: 'browser-notifications',
      healthCheck: async () => {
        // Check if browser notification provider is healthy
        return true; // Simplified for demo
      },
      critical: false,
      timeout: 5000
    });

    this.healthMonitor.registerService({
      name: 'email-service',
      healthCheck: async () => {
        // Check email service health
        return Math.random() > 0.1; // 90% uptime simulation
      },
      critical: false,
      timeout: 10000
    });

    this.healthMonitor.registerService({
      name: 'push-service',
      healthCheck: async () => {
        // Check push notification service health
        return Math.random() > 0.05; // 95% uptime simulation
      },
      critical: false,
      timeout: 8000
    });

    // Monitor core dependencies
    this.healthMonitor.registerService({
      name: 'notification-queue',
      healthCheck: async () => {
        const stats = await this.engine.getDeliveryStats();
        return stats.pending < 1000; // Queue not overwhelmed
      },
      critical: true,
      timeout: 3000
    });
  }

  /**
   * Get notification service status
   */
  async getServiceStatus(): Promise<{
    engine: any;
    health: any;
    offline: any;
    rateLimits: { activeUsers: number };
  }> {
    try {
      const [engineHealth, systemHealth, offlineStatus, deliveryStats] = await Promise.all([
        this.engine.healthCheck(),
        Promise.resolve(this.healthMonitor.getSystemHealth()),
        Promise.resolve(this.offlineMode.getOfflineStatus()),
        this.engine.getDeliveryStats()
      ]);

      return {
        engine: {
          healthy: engineHealth.healthy,
          providers: engineHealth.providers,
          queueSize: engineHealth.queueSize,
          deliveryStats
        },
        health: systemHealth,
        offline: offlineStatus,
        rateLimits: {
          activeUsers: this.userRateLimits.size
        }
      };
    } catch (error) {
      logger.error('Error getting service status:', error);
      throw error;
    }
  }

  /**
   * Manually trigger health check
   */
  async triggerHealthCheck(): Promise<void> {
    // Force health check of all services
    const services = ['browser-notifications', 'email-service', 'push-service', 'notification-queue'];
    
    for (const service of services) {
      await this.healthMonitor.checkServiceHealth(service);
    }
  }

  /**
   * Clear rate limits for a user (admin function)
   */
  clearUserRateLimit(userId: string): void {
    this.userRateLimits.delete(userId);
    logger.info(`Cleared rate limits for user ${userId}`);
  }

  /**
   * Update notification preferences and validate channels
   */
  async updateUserPreferences(
    userId: string,
    preferences: UserPreferences
  ): Promise<{ success: boolean; validChannels: NotificationChannel[]; error?: string }> {
    try {
      const systemHealth = this.healthMonitor.getSystemHealth();
      const validChannels: NotificationChannel[] = [];
      const allValidChannels = Object.values(NotificationChannel);

      // Validate each requested channel
      for (const channel of preferences.notificationChannels) {
        // First check if it's a valid channel type
        if (allValidChannels.includes(channel)) {
          const channelHealth = systemHealth.services.find((s: any) => s.name.includes(channel));
          
          if (!channelHealth || channelHealth.status !== ServiceStatus.UNHEALTHY) {
            validChannels.push(channel);
          }
        }
      }

      // Always ensure at least browser notifications are available
      if (validChannels.length === 0) {
        validChannels.push(NotificationChannel.BROWSER);
      }

      logger.info(`Updated preferences for user ${userId}: ${validChannels.join(', ')}`);

      return {
        success: true,
        validChannels
      };
    } catch (error) {
      logger.error(`Error updating preferences for user ${userId}:`, error);
      return {
        success: false,
        validChannels: [NotificationChannel.BROWSER],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}