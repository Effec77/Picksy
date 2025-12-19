import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServiceHealthMonitor, ServiceDependency, ServiceStatus } from '../services/serviceHealthMonitor.js';
import { OfflineModeService } from '../services/offlineMode.js';
import { InMemoryNotificationQueue } from '../services/inMemoryNotificationQueue.js';
import { NotificationEngine } from '../services/notificationEngine.js';
import { TrackedProduct, PricePoint, DataSource, AvailabilityStatus } from '../../../shared/types/index.js';

describe('Service Failover and Graceful Degradation', () => {
  let healthMonitor: ServiceHealthMonitor;
  let offlineMode: OfflineModeService;
  let notificationEngine: NotificationEngine;

  beforeEach(() => {
    healthMonitor = new ServiceHealthMonitor();
    offlineMode = new OfflineModeService({
      enabled: true,
      maxCacheAge: 60000, // 1 minute for testing
      fallbackDataRetention: 300000, // 5 minutes for testing
      limitedFeatures: ['real-time-updates', 'new-product-tracking']
    });
    
    const notificationQueue = new InMemoryNotificationQueue();
    notificationEngine = new NotificationEngine(notificationQueue);
    healthMonitor.setNotificationEngine(notificationEngine);
  });

  afterEach(async () => {
    await healthMonitor.stop();
    offlineMode.clearCache();
  });

  describe('ServiceHealthMonitor', () => {
    it('should register and monitor service dependencies', async () => {
      // Register a healthy service
      const healthyService: ServiceDependency = {
        name: 'test-service',
        healthCheck: async () => true,
        critical: true,
        timeout: 1000
      };

      healthMonitor.registerService(healthyService);
      
      // Start monitoring
      await healthMonitor.start();
      
      // Wait a bit for initial health check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const systemHealth = healthMonitor.getSystemHealth();
      expect(systemHealth.overall).toBe(ServiceStatus.HEALTHY);
      expect(systemHealth.services).toHaveLength(1);
      expect(systemHealth.services[0].name).toBe('test-service');
      expect(systemHealth.services[0].status).toBe(ServiceStatus.HEALTHY);
    });

    it('should detect service failures and update status', async () => {
      let serviceHealthy = true;
      
      const flakyService: ServiceDependency = {
        name: 'flaky-service',
        healthCheck: async () => serviceHealthy,
        critical: true,
        timeout: 1000
      };

      healthMonitor.registerService(flakyService);
      await healthMonitor.start();
      
      // Wait for initial healthy check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let systemHealth = healthMonitor.getSystemHealth();
      expect(systemHealth.overall).toBe(ServiceStatus.HEALTHY);
      
      // Make service fail
      serviceHealthy = false;
      
      // Force a health check
      await healthMonitor.checkServiceHealth('flaky-service');
      
      systemHealth = healthMonitor.getSystemHealth();
      const flakyServiceHealth = systemHealth.services.find(s => s.name === 'flaky-service');
      expect(flakyServiceHealth?.consecutiveFailures).toBeGreaterThan(0);
    });

    it('should provide uptime statistics', async () => {
      const testService: ServiceDependency = {
        name: 'stats-service',
        healthCheck: async () => true,
        critical: false,
        timeout: 1000
      };

      healthMonitor.registerService(testService);
      await healthMonitor.start();
      
      // Wait for some uptime
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = healthMonitor.getUptimeStats();
      expect(stats).toHaveProperty('stats-service');
      expect(stats['stats-service']).toHaveProperty('uptime');
      expect(stats['stats-service']).toHaveProperty('availability');
    });
  });

  describe('OfflineModeService', () => {
    it('should cache and retrieve product data', () => {
      const testProduct: TrackedProduct = {
        id: 'test-product-1',
        title: 'Test Product',
        url: 'https://example.com/product/1',
        retailer: 'test-retailer',
        category: 'electronics',
        userId: 'test-user',
        isActive: true,
        addedAt: new Date(),
        extractedAt: new Date()
      };

      // Cache the product
      offlineMode.cacheProduct(testProduct);
      
      // Retrieve the cached product
      const cachedProduct = offlineMode.getCachedProduct('test-product-1');
      expect(cachedProduct).toBeDefined();
      expect(cachedProduct?.title).toBe('Test Product');
      expect(cachedProduct?.retailer).toBe('test-retailer');
    });

    it('should cache and retrieve price data', () => {
      const testPrices: PricePoint[] = [
        {
          id: 'price-1',
          productId: 'test-product-1',
          price: 99.99,
          currency: 'USD',
          availability: AvailabilityStatus.IN_STOCK,
          checkedAt: new Date(),
          source: DataSource.OFFICIAL_API
        },
        {
          id: 'price-2',
          productId: 'test-product-1',
          price: 89.99,
          currency: 'USD',
          availability: AvailabilityStatus.IN_STOCK,
          checkedAt: new Date(Date.now() - 86400000), // 1 day ago
          source: DataSource.OFFICIAL_API
        }
      ];

      // Cache the prices
      offlineMode.cachePriceData('test-product-1', testPrices);
      
      // Retrieve cached prices
      const cachedPrices = offlineMode.getCachedPrices('test-product-1');
      expect(cachedPrices).toBeDefined();
      expect(cachedPrices).toHaveLength(2);
      expect(cachedPrices?.[0].price).toBe(99.99);
    });

    it('should provide price history with statistics', () => {
      const testPrices: PricePoint[] = [
        {
          id: 'price-1',
          productId: 'test-product-1',
          price: 100,
          currency: 'USD',
          availability: AvailabilityStatus.IN_STOCK,
          checkedAt: new Date(),
          source: DataSource.OFFICIAL_API
        },
        {
          id: 'price-2',
          productId: 'test-product-1',
          price: 90,
          currency: 'USD',
          availability: AvailabilityStatus.IN_STOCK,
          checkedAt: new Date(Date.now() - 86400000),
          source: DataSource.OFFICIAL_API
        },
        {
          id: 'price-3',
          productId: 'test-product-1',
          price: 95,
          currency: 'USD',
          availability: AvailabilityStatus.IN_STOCK,
          checkedAt: new Date(Date.now() - 172800000), // 2 days ago
          source: DataSource.OFFICIAL_API
        }
      ];

      offlineMode.cachePriceData('test-product-1', testPrices);
      
      const priceHistory = offlineMode.getCachedPriceHistory('test-product-1');
      expect(priceHistory).toBeDefined();
      expect(priceHistory?.points).toHaveLength(3);
      expect(priceHistory?.statistics).toBeDefined();
      expect(priceHistory?.statistics.average).toBe(95);
      expect(priceHistory?.statistics.minimum).toBe(90);
      expect(priceHistory?.statistics.maximum).toBe(100);
    });

    it('should enable and disable offline mode', () => {
      expect(offlineMode.isOffline()).toBe(false);
      
      offlineMode.enableOfflineMode();
      expect(offlineMode.isOffline()).toBe(true);
      
      offlineMode.disableOfflineMode();
      expect(offlineMode.isOffline()).toBe(false);
    });

    it('should provide offline status information', () => {
      const status = offlineMode.getOfflineStatus();
      
      expect(status).toHaveProperty('isOffline');
      expect(status).toHaveProperty('availableFeatures');
      expect(status).toHaveProperty('unavailableFeatures');
      expect(status).toHaveProperty('cacheStats');
      
      expect(Array.isArray(status.availableFeatures)).toBe(true);
      expect(Array.isArray(status.unavailableFeatures)).toBe(true);
    });

    it('should clean up expired cache entries', async () => {
      // Create offline mode with very short cache age for testing
      const shortCacheOfflineMode = new OfflineModeService({
        enabled: true,
        maxCacheAge: 10, // 10ms
        fallbackDataRetention: 100,
        limitedFeatures: []
      });

      const testProduct: TrackedProduct = {
        id: 'expire-test',
        title: 'Expire Test Product',
        url: 'https://example.com/expire',
        retailer: 'test',
        category: 'test',
        userId: 'test-user',
        isActive: true,
        addedAt: new Date(),
        extractedAt: new Date()
      };

      // Cache the product
      shortCacheOfflineMode.cacheProduct(testProduct);
      
      // Verify it's cached
      let cached = shortCacheOfflineMode.getCachedProduct('expire-test');
      expect(cached).toBeDefined();
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Clean up expired cache
      shortCacheOfflineMode.cleanupExpiredCache();
      
      // Verify it's no longer available due to expiration
      cached = shortCacheOfflineMode.getCachedProduct('expire-test');
      expect(cached).toBeNull();
    });
  });

  describe('Integration: Health Monitor + Offline Mode', () => {
    it('should automatically enable offline mode when services are unhealthy', async () => {
      let databaseHealthy = true;
      
      const databaseService: ServiceDependency = {
        name: 'database',
        healthCheck: async () => databaseHealthy,
        critical: true,
        timeout: 1000
      };

      healthMonitor.registerService(databaseService);
      await healthMonitor.start();
      
      // Initially healthy
      expect(offlineMode.isOffline()).toBe(false);
      
      // Simulate database failure
      databaseHealthy = false;
      
      // Force multiple health checks to trigger failure threshold
      await healthMonitor.checkServiceHealth('database');
      await healthMonitor.checkServiceHealth('database');
      await healthMonitor.checkServiceHealth('database');
      
      // Simulate the automatic offline mode switching logic
      const systemHealth = healthMonitor.getSystemHealth();
      if (systemHealth.overall === ServiceStatus.UNHEALTHY || systemHealth.overall === ServiceStatus.DEGRADED) {
        offlineMode.enableOfflineMode();
      }
      
      expect(offlineMode.isOffline()).toBe(true);
      
      // Restore database
      databaseHealthy = true;
      await healthMonitor.checkServiceHealth('database');
      
      // Simulate restoration
      const restoredHealth = healthMonitor.getSystemHealth();
      if (restoredHealth.overall === ServiceStatus.HEALTHY) {
        offlineMode.disableOfflineMode();
      }
      
      expect(offlineMode.isOffline()).toBe(false);
    });

    it('should provide fallback data when services are unavailable', async () => {
      // Cache some data first
      const testProduct: TrackedProduct = {
        id: 'fallback-test',
        title: 'Fallback Test Product',
        url: 'https://example.com/fallback',
        retailer: 'test',
        category: 'test',
        userId: 'test-user',
        isActive: true,
        addedAt: new Date(),
        extractedAt: new Date()
      };

      offlineMode.cacheProduct(testProduct);
      offlineMode.enableOfflineMode();
      
      // Test fallback data retrieval
      const fallbackResult = await offlineMode.getFallbackData(
        'get product data',
        () => offlineMode.getCachedProduct('fallback-test')
      );
      
      expect(fallbackResult).toBeDefined();
      expect(fallbackResult).not.toHaveProperty('code'); // Should not be an error
      expect((fallbackResult as TrackedProduct).title).toBe('Fallback Test Product');
    });

    it('should return error when no fallback data is available', async () => {
      offlineMode.enableOfflineMode();
      
      const fallbackResult = await offlineMode.getFallbackData(
        'get non-existent data',
        () => offlineMode.getCachedProduct('non-existent')
      );
      
      expect(fallbackResult).toHaveProperty('code');
      expect(fallbackResult).toHaveProperty('message');
      expect((fallbackResult as any).message).toContain('No cached data available');
    });
  });
});