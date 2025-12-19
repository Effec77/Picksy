import { 
  PriceAlert, 
  NotificationChannel, 
  UserPreferences,
  ErrorResponse,
  ErrorCode
} from '../../../shared/types';
import { logger } from '../utils/logger';

export interface NotificationDelivery {
  id: string;
  alertId: string;
  userId: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
  deliveredAt?: Date;
  failureReason?: string;
  priority: NotificationPriority;
}

export enum DeliveryStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETRYING = 'retrying',
  EXPIRED = 'expired'
}

export enum NotificationPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4
}

export interface NotificationQueue {
  add(delivery: NotificationDelivery): Promise<void>;
  getNext(): Promise<NotificationDelivery | null>;
  markDelivered(deliveryId: string): Promise<void>;
  markFailed(deliveryId: string, reason: string): Promise<void>;
  scheduleRetry(deliveryId: string, retryAt: Date): Promise<void>;
  getPendingCount(): Promise<number>;
  cleanup(): Promise<void>;
}

export interface NotificationProvider {
  send(alert: PriceAlert, userPreferences: UserPreferences): Promise<boolean>;
  getChannel(): NotificationChannel;
  isHealthy(): Promise<boolean>;
}

export class NotificationEngine {
  private queue: NotificationQueue;
  private providers = new Map<NotificationChannel, NotificationProvider>();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly maxDeliveryTime = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly maxRetryAttempts = 3;
  private readonly retryDelays = [30000, 120000, 300000]; // 30s, 2m, 5m

  constructor(queue: NotificationQueue) {
    this.queue = queue;
  }

  /**
   * Register a notification provider for a specific channel
   */
  registerProvider(provider: NotificationProvider): void {
    this.providers.set(provider.getChannel(), provider);
    logger.info(`Registered notification provider for channel: ${provider.getChannel()}`);
  }

  /**
   * Start the notification processing engine
   */
  async start(): Promise<void> {
    if (this.isProcessing) {
      logger.warn('Notification engine is already running');
      return;
    }

    this.isProcessing = true;
    this.processingInterval = setInterval(async () => {
      await this.processQueue();
    }, 10000); // Process every 10 seconds

    logger.info('Notification engine started');
  }

  /**
   * Stop the notification processing engine
   */
  async stop(): Promise<void> {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    logger.info('Notification engine stopped');
  }

  /**
   * Queue a price alert for delivery with 5-minute guarantee
   */
  async queueAlert(
    alert: PriceAlert, 
    userPreferences: UserPreferences
  ): Promise<NotificationDelivery[]> {
    try {
      const deliveries: NotificationDelivery[] = [];
      const priority = this.determinePriority(alert);
      const scheduledAt = new Date();

      // Create delivery for each enabled notification channel
      for (const channel of userPreferences.notificationChannels) {
        const provider = this.providers.get(channel);
        if (!provider) {
          logger.warn(`No provider registered for channel: ${channel}`);
          continue;
        }

        // Check if provider is healthy before queuing
        const isHealthy = await provider.isHealthy();
        if (!isHealthy) {
          logger.warn(`Provider for channel ${channel} is not healthy, skipping`);
          continue;
        }

        const delivery: NotificationDelivery = {
          id: this.generateDeliveryId(alert.id, channel),
          alertId: alert.id,
          userId: alert.userId,
          channel,
          status: DeliveryStatus.PENDING,
          attempts: 0,
          maxAttempts: this.maxRetryAttempts,
          scheduledAt,
          priority
        };

        await this.queue.add(delivery);
        deliveries.push(delivery);
      }

      logger.info(`Queued ${deliveries.length} deliveries for alert ${alert.id}`);
      return deliveries;
    } catch (error) {
      logger.error(`Error queuing alert ${alert.id}:`, error);
      throw error;
    }
  }

  /**
   * Process the notification queue
   */
  private async processQueue(): Promise<void> {
    try {
      const delivery = await this.queue.getNext();
      if (!delivery) {
        return; // No pending deliveries
      }

      // Check if delivery has expired (beyond 5-minute guarantee)
      const now = new Date();
      const timeSinceScheduled = now.getTime() - delivery.scheduledAt.getTime();
      
      if (timeSinceScheduled > this.maxDeliveryTime && delivery.attempts === 0) {
        logger.error(`Delivery ${delivery.id} expired before first attempt`);
        await this.queue.markFailed(delivery.id, 'Delivery expired before processing');
        return;
      }

      await this.processDelivery(delivery);
    } catch (error) {
      logger.error('Error processing notification queue:', error);
    }
  }

  /**
   * Process a single delivery
   */
  private async processDelivery(delivery: NotificationDelivery): Promise<void> {
    try {
      const provider = this.providers.get(delivery.channel);
      if (!provider) {
        await this.queue.markFailed(delivery.id, `No provider for channel: ${delivery.channel}`);
        return;
      }

      // Check provider health before attempting delivery
      const isHealthy = await provider.isHealthy();
      if (!isHealthy) {
        await this.scheduleRetryOrFail(delivery, 'Provider is not healthy');
        return;
      }

      // Reconstruct alert for delivery (in real implementation, this would come from storage)
      const alert = await this.getAlertById(delivery.alertId);
      if (!alert) {
        await this.queue.markFailed(delivery.id, 'Alert not found');
        return;
      }

      // Get user preferences for delivery
      const userPreferences = await this.getUserPreferences(delivery.userId);
      if (!userPreferences) {
        await this.queue.markFailed(delivery.id, 'User preferences not found');
        return;
      }

      // Attempt delivery
      delivery.attempts++;
      const success = await provider.send(alert, userPreferences);

      if (success) {
        delivery.deliveredAt = new Date();
        await this.queue.markDelivered(delivery.id);
        
        const deliveryTime = delivery.deliveredAt.getTime() - delivery.scheduledAt.getTime();
        logger.info(`Delivered notification ${delivery.id} via ${delivery.channel} in ${deliveryTime}ms`);
      } else {
        await this.scheduleRetryOrFail(delivery, 'Provider send failed');
      }
    } catch (error) {
      logger.error(`Error processing delivery ${delivery.id}:`, error);
      await this.scheduleRetryOrFail(delivery, `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Schedule retry or mark as failed if max attempts reached
   */
  private async scheduleRetryOrFail(delivery: NotificationDelivery, reason: string): Promise<void> {
    if (delivery.attempts >= delivery.maxAttempts) {
      await this.queue.markFailed(delivery.id, `Max attempts reached: ${reason}`);
      logger.error(`Delivery ${delivery.id} failed permanently: ${reason}`);
      return;
    }

    // Calculate retry delay based on attempt number
    const retryDelay = this.retryDelays[delivery.attempts - 1] || this.retryDelays[this.retryDelays.length - 1];
    const retryAt = new Date(Date.now() + retryDelay);

    await this.queue.scheduleRetry(delivery.id, retryAt);
    logger.warn(`Scheduled retry for delivery ${delivery.id} at ${retryAt.toISOString()}: ${reason}`);
  }

  /**
   * Determine notification priority based on alert type
   */
  private determinePriority(alert: PriceAlert): NotificationPriority {
    switch (alert.alertType) {
      case 'target_price_reached':
        return NotificationPriority.URGENT;
      case 'price_drop':
        return NotificationPriority.HIGH;
      case 'back_in_stock':
        return NotificationPriority.HIGH;
      case 'price_increase':
        return NotificationPriority.NORMAL;
      default:
        return NotificationPriority.NORMAL;
    }
  }

  /**
   * Generate unique delivery ID
   */
  private generateDeliveryId(alertId: string, channel: NotificationChannel): string {
    return `delivery_${alertId}_${channel}_${Date.now()}`;
  }

  /**
   * Get alert by ID (placeholder - would be implemented with actual storage)
   */
  private async getAlertById(alertId: string): Promise<PriceAlert | null> {
    // TODO: Implement with actual alert storage
    logger.warn(`getAlertById not implemented for alert ${alertId}`);
    return null;
  }

  /**
   * Get user preferences by user ID (placeholder - would be implemented with actual storage)
   */
  private async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    // TODO: Implement with actual user storage
    logger.warn(`getUserPreferences not implemented for user ${userId}`);
    return null;
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(): Promise<{
    pending: number;
    delivered: number;
    failed: number;
    averageDeliveryTime: number;
  }> {
    try {
      const pendingCount = await this.queue.getPendingCount();
      
      // TODO: Implement actual statistics from storage
      return {
        pending: pendingCount,
        delivered: 0,
        failed: 0,
        averageDeliveryTime: 0
      };
    } catch (error) {
      logger.error('Error getting delivery stats:', error);
      throw error;
    }
  }

  /**
   * Health check for the notification engine
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    providers: Record<string, boolean>;
    queueSize: number;
  }> {
    try {
      const providerHealth: Record<string, boolean> = {};
      
      for (const [channel, provider] of this.providers) {
        providerHealth[channel] = await provider.isHealthy();
      }

      const queueSize = await this.queue.getPendingCount();
      const healthy = Object.values(providerHealth).some(h => h) && this.isProcessing;

      return {
        healthy,
        providers: providerHealth,
        queueSize
      };
    } catch (error) {
      logger.error('Error during health check:', error);
      return {
        healthy: false,
        providers: {},
        queueSize: -1
      };
    }
  }
}