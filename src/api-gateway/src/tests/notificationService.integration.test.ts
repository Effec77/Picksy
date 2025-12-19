import { NotificationService } from '../services/notificationService';
import { ServiceHealthMonitor } from '../services/serviceHealthMonitor';
import { OfflineModeService } from '../services/offlineMode';
import { 
  PriceAlert, 
  NotificationChannel, 
  UserPreferences, 
  AlertType 
} from '../../../shared/types';

describe('NotificationService Integration', () => {
  let notificationService: NotificationService;
  let healthMonitor: ServiceHealthMonitor;
  let offlineMode: OfflineModeService;

  beforeEach(async () => {
    // Initialize services
    healthMonitor = new ServiceHealthMonitor();
    offlineMode = new OfflineModeService({
      enabled: true,
      maxCacheAge: 30 * 60 * 1000, // 30 minutes
      fallbackDataRetention: 24 * 60 * 60 * 1000, // 24 hours
      limitedFeatures: ['real-time updates', 'external notifications']
    });

    notificationService = new NotificationService({
      rateLimitPerUser: 10,
      rateLimitWindow: 60 * 60 * 1000, // 1 hour
      enableOfflineMode: true,
      maxCacheAge: 30 * 60 * 1000
    });

    await notificationService.start();
  });

  afterEach(async () => {
    await notificationService.stop();
    await healthMonitor.stop();
  });

  describe('Multi-channel notification delivery', () => {
    test('should deliver notifications through multiple channels', async () => {
      const alert: PriceAlert = {
        id: 'test-alert-1',
        userId: 'user-1',
        productId: 'product-1',
        alertType: AlertType.PRICE_DROP,
        message: 'Price dropped by 20%!',
        createdAt: new Date(),
        delivered: false
      };

      const userPreferences: UserPreferences = {
        notificationChannels: [
          NotificationChannel.BROWSER,
          NotificationChannel.EMAIL,
          NotificationChannel.PUSH
        ],
        checkFrequency: 60,
        priceThreshold: 0.1
      };

      const result = await notificationService.sendPriceAlert(alert, userPreferences);

      expect(result.success).toBe(true);
      expect(result.deliveries).toHaveLength(3);
      expect(result.deliveries.map(d => d.channel)).toEqual(
        expect.arrayContaining([
          NotificationChannel.BROWSER,
          NotificationChannel.EMAIL,
          NotificationChannel.PUSH
        ])
      );
    });

    test('should handle delivery tracking and retry logic', async () => {
      const alert: PriceAlert = {
        id: 'test-alert-2',
        userId: 'user-2',
        productId: 'product-2',
        alertType: AlertType.TARGET_PRICE_REACHED,
        message: 'Target price reached!',
        createdAt: new Date(),
        delivered: false
      };

      const userPreferences: UserPreferences = {
        notificationChannels: [NotificationChannel.EMAIL],
        checkFrequency: 30,
        priceThreshold: 0.05
      };

      const result = await notificationService.sendPriceAlert(alert, userPreferences);

      expect(result.success).toBe(true);
      expect(result.deliveries[0]).toMatchObject({
        channel: NotificationChannel.EMAIL,
        status: 'pending'
      });
    });
  });

  describe('Rate limiting', () => {
    test('should enforce rate limits per user', async () => {
      const alert: PriceAlert = {
        id: 'test-alert-3',
        userId: 'user-3',
        productId: 'product-3',
        alertType: AlertType.PRICE_DROP,
        message: 'Rate limit test',
        createdAt: new Date(),
        delivered: false
      };

      const userPreferences: UserPreferences = {
        notificationChannels: [NotificationChannel.BROWSER],
        checkFrequency: 60,
        priceThreshold: 0.1
      };

      // Send notifications up to the limit
      for (let i = 0; i < 10; i++) {
        const result = await notificationService.sendPriceAlert(
          { ...alert, id: `test-alert-3-${i}` },
          userPreferences
        );
        expect(result.success).toBe(true);
      }

      // Next notification should be rate limited
      const rateLimitedResult = await notificationService.sendPriceAlert(
        { ...alert, id: 'test-alert-3-rate-limited' },
        userPreferences
      );

      expect(rateLimitedResult.success).toBe(false);
      expect(rateLimitedResult.error).toContain('Rate limit exceeded');
    });

    test('should allow clearing rate limits', async () => {
      const userId = 'user-4';
      
      // Fill up rate limit
      for (let i = 0; i < 10; i++) {
        await notificationService.sendPriceAlert({
          id: `test-alert-4-${i}`,
          userId,
          productId: 'product-4',
          alertType: AlertType.PRICE_DROP,
          message: 'Rate limit test',
          createdAt: new Date(),
          delivered: false
        }, {
          notificationChannels: [NotificationChannel.BROWSER],
          checkFrequency: 60,
          priceThreshold: 0.1
        });
      }

      // Clear rate limits
      notificationService.clearUserRateLimit(userId);

      // Should be able to send again
      const result = await notificationService.sendPriceAlert({
        id: 'test-alert-4-after-clear',
        userId,
        productId: 'product-4',
        alertType: AlertType.PRICE_DROP,
        message: 'After clear test',
        createdAt: new Date(),
        delivered: false
      }, {
        notificationChannels: [NotificationChannel.BROWSER],
        checkFrequency: 60,
        priceThreshold: 0.1
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Graceful service degradation', () => {
    test('should handle offline mode gracefully', async () => {
      // Enable offline mode
      offlineMode.enableOfflineMode();
      
      // Verify offline mode is enabled
      expect(offlineMode.isOffline()).toBe(true);

      const alert: PriceAlert = {
        id: 'test-alert-5',
        userId: 'user-5',
        productId: 'product-5',
        alertType: AlertType.BACK_IN_STOCK,
        message: 'Back in stock!',
        createdAt: new Date(),
        delivered: false
      };

      const userPreferences: UserPreferences = {
        notificationChannels: [
          NotificationChannel.BROWSER,
          NotificationChannel.EMAIL
        ],
        checkFrequency: 60,
        priceThreshold: 0.1
      };

      const result = await notificationService.sendPriceAlert(alert, userPreferences);

      expect(result.success).toBe(true);
      // In offline mode, should only use browser notifications
      expect(result.deliveries.length).toBeGreaterThan(0);
      // All deliveries should be browser notifications with offline flag
      result.deliveries.forEach(delivery => {
        expect(delivery.channel).toBe(NotificationChannel.BROWSER);
        expect(delivery).toHaveProperty('offline', true);
      });
    });

    test('should filter to reliable channels during degradation', async () => {
      // For this test, we'll simulate degradation by making the system unhealthy
      // and verify that it falls back to offline mode which only uses browser notifications
      
      // Force the system into an unhealthy state by making all services fail
      const testHealthMonitor = new ServiceHealthMonitor();
      
      // Register failing services to trigger system degradation
      testHealthMonitor.registerService({
        name: 'email-service',
        healthCheck: async () => false, // Always fails
        critical: true, // Make it critical to trigger system unhealthy state
        timeout: 1000
      });
      
      testHealthMonitor.registerService({
        name: 'push-service', 
        healthCheck: async () => false, // Always fails
        critical: true,
        timeout: 1000
      });

      // Create a new notification service with the test health monitor
      const testNotificationService = new NotificationService({
        rateLimitPerUser: 10,
        rateLimitWindow: 60 * 60 * 1000,
        enableOfflineMode: true,
        maxCacheAge: 30 * 60 * 1000
      });

      // Replace the health monitor
      (testNotificationService as any).healthMonitor = testHealthMonitor;

      await testNotificationService.start();
      await testHealthMonitor.start();
      
      // Wait for health checks to run and detect unhealthy state
      await new Promise(resolve => setTimeout(resolve, 500));

      const alert: PriceAlert = {
        id: 'test-alert-6',
        userId: 'user-6',
        productId: 'product-6',
        alertType: AlertType.PRICE_INCREASE,
        message: 'Price increased',
        createdAt: new Date(),
        delivered: false
      };

      const userPreferences: UserPreferences = {
        notificationChannels: [
          NotificationChannel.BROWSER,
          NotificationChannel.EMAIL
        ],
        checkFrequency: 60,
        priceThreshold: 0.1
      };

      const result = await testNotificationService.sendPriceAlert(alert, userPreferences);

      expect(result.success).toBe(true);
      // When system is unhealthy, should fall back to offline mode with browser only
      expect(result.deliveries.length).toBeGreaterThan(0);
      result.deliveries.forEach(delivery => {
        expect(delivery.channel).toBe(NotificationChannel.BROWSER);
      });

      await testNotificationService.stop();
      await testHealthMonitor.stop();
    });

    test('should provide service status information', async () => {
      const status = await notificationService.getServiceStatus();

      expect(status).toHaveProperty('engine');
      expect(status).toHaveProperty('health');
      expect(status).toHaveProperty('offline');
      expect(status).toHaveProperty('rateLimits');

      expect(status.engine).toHaveProperty('healthy');
      expect(status.engine).toHaveProperty('providers');
      expect(status.engine).toHaveProperty('queueSize');
      expect(status.engine).toHaveProperty('deliveryStats');

      expect(status.rateLimits).toHaveProperty('activeUsers');
    });
  });

  describe('Notification preferences management', () => {
    test('should validate and update user preferences', async () => {
      const userId = 'user-7';
      const preferences: UserPreferences = {
        notificationChannels: [NotificationChannel.BROWSER, NotificationChannel.PUSH],
        checkFrequency: 30,
        priceThreshold: 0.15
      };

      const result = await notificationService.updateUserPreferences(userId, preferences);

      expect(result.success).toBe(true);
      expect(result.validChannels).toEqual(
        expect.arrayContaining([NotificationChannel.BROWSER, NotificationChannel.PUSH])
      );
    });

    test('should handle invalid notification channels', async () => {
      const userId = 'user-8';
      const preferences: UserPreferences = {
        notificationChannels: ['invalid-channel' as NotificationChannel],
        checkFrequency: 60,
        priceThreshold: 0.1
      };

      const result = await notificationService.updateUserPreferences(userId, preferences);

      expect(result.success).toBe(true);
      // Should fallback to browser notifications
      expect(result.validChannels).toContain(NotificationChannel.BROWSER);
    });
  });

  describe('Health monitoring integration', () => {
    test('should trigger health checks manually', async () => {
      // Register a service for testing
      healthMonitor.registerService({
        name: 'test-service',
        healthCheck: async () => true,
        critical: false,
        timeout: 3000
      });

      await healthMonitor.start();
      
      // Trigger manual health check
      await notificationService.triggerHealthCheck();

      const serviceHealth = healthMonitor.getServiceHealth('test-service');
      expect(serviceHealth).not.toBeNull();
      expect(serviceHealth?.status).toBeDefined();
    });

    test('should handle system health monitoring', async () => {
      // Register critical and non-critical services
      healthMonitor.registerService({
        name: 'critical-service',
        healthCheck: async () => true,
        critical: true,
        timeout: 3000
      });

      healthMonitor.registerService({
        name: 'non-critical-service',
        healthCheck: async () => false,
        critical: false,
        timeout: 3000
      });

      await healthMonitor.start();
      
      // Wait for health checks
      await new Promise(resolve => setTimeout(resolve, 100));

      const systemHealth = healthMonitor.getSystemHealth();
      expect(systemHealth.overall).toBeDefined();
      expect(systemHealth.services).toHaveLength(2);
      expect(systemHealth.timestamp).toBeInstanceOf(Date);
    });
  });
});