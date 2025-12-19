import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PriceTrackingService } from '../services/priceTracking';
import { PriceAlertService } from '../services/priceAlerts';
import { PriceHistoryService } from '../services/priceHistory';
import { 
  TrackedProduct, 
  UserPreferences, 
  PricePoint, 
  NotificationChannel,
  AvailabilityStatus,
  DataSource,
  PriceTrend,
  AlertType
} from '../../../shared/types';

describe('PriceTrackingService', () => {
  let service: PriceTrackingService;
  let sampleProduct: TrackedProduct;
  let samplePreferences: UserPreferences;

  beforeEach(() => {
    service = new PriceTrackingService();
    
    sampleProduct = {
      id: 'product-1',
      title: 'Test Product',
      url: 'https://example.com/product',
      retailer: 'test-retailer',
      category: 'electronics',
      extractedAt: new Date(),
      userId: 'user-1',
      targetPrice: 99.99,
      isActive: true,
      addedAt: new Date()
    };

    samplePreferences = {
      notificationChannels: [NotificationChannel.BROWSER, NotificationChannel.EMAIL],
      checkFrequency: 60, // 60 minutes
      priceThreshold: 0.1 // 10%
    };
  });

  describe('scheduleMonitoring', () => {
    it('should schedule monitoring with correct interval', async () => {
      await service.scheduleMonitoring(sampleProduct, samplePreferences);
      
      const schedule = service.getSchedule(sampleProduct.id);
      expect(schedule).toBeDefined();
      expect(schedule!.productId).toBe(sampleProduct.id);
      expect(schedule!.userId).toBe(sampleProduct.userId);
      expect(schedule!.intervalMinutes).toBe(60);
      expect(schedule!.consecutiveFailures).toBe(0);
    });

    it('should respect minimum check interval', async () => {
      const fastPreferences = { ...samplePreferences, checkFrequency: 5 }; // Too fast
      
      await service.scheduleMonitoring(sampleProduct, fastPreferences);
      
      const schedule = service.getSchedule(sampleProduct.id);
      expect(schedule!.intervalMinutes).toBeGreaterThanOrEqual(15); // Minimum 15 minutes
    });

    it('should respect maximum check interval', async () => {
      const slowPreferences = { ...samplePreferences, checkFrequency: 2000 }; // Too slow
      
      await service.scheduleMonitoring(sampleProduct, slowPreferences);
      
      const schedule = service.getSchedule(sampleProduct.id);
      expect(schedule!.intervalMinutes).toBeLessThanOrEqual(1440); // Maximum 24 hours
    });
  });

  describe('unscheduleMonitoring', () => {
    it('should remove monitoring schedule', async () => {
      await service.scheduleMonitoring(sampleProduct, samplePreferences);
      expect(service.getSchedule(sampleProduct.id)).toBeDefined();
      
      await service.unscheduleMonitoring(sampleProduct.id);
      expect(service.getSchedule(sampleProduct.id)).toBeUndefined();
    });
  });

  describe('getProductsForChecking', () => {
    it('should return products that need checking', async () => {
      // Schedule a product with past check time
      await service.scheduleMonitoring(sampleProduct, samplePreferences);
      
      // Manually set next check time to past
      const schedule = service.getSchedule(sampleProduct.id);
      schedule!.nextCheckAt = new Date(Date.now() - 60000); // 1 minute ago
      
      const productsToCheck = service.getProductsForChecking();
      expect(productsToCheck.length).toBe(1);
      expect(productsToCheck[0].productId).toBe(sampleProduct.id);
    });

    it('should not return products with too many failures', async () => {
      await service.scheduleMonitoring(sampleProduct, samplePreferences);
      
      const schedule = service.getSchedule(sampleProduct.id);
      schedule!.nextCheckAt = new Date(Date.now() - 60000);
      schedule!.consecutiveFailures = 6; // Above threshold
      
      const productsToCheck = service.getProductsForChecking();
      expect(productsToCheck.length).toBe(0);
    });
  });

  describe('updateScheduleAfterCheck', () => {
    beforeEach(async () => {
      await service.scheduleMonitoring(sampleProduct, samplePreferences);
    });

    it('should reset failures on successful check', async () => {
      const schedule = service.getSchedule(sampleProduct.id);
      schedule!.consecutiveFailures = 3;
      
      await service.updateScheduleAfterCheck(sampleProduct.id, true);
      
      expect(schedule!.consecutiveFailures).toBe(0);
      expect(schedule!.lastCheckedAt).toBeDefined();
    });

    it('should increment failures on failed check', async () => {
      await service.updateScheduleAfterCheck(sampleProduct.id, false);
      
      const schedule = service.getSchedule(sampleProduct.id);
      expect(schedule!.consecutiveFailures).toBe(1);
    });

    it('should implement exponential backoff on failures', async () => {
      const schedule = service.getSchedule(sampleProduct.id);
      const originalInterval = schedule!.intervalMinutes;
      
      // Simulate multiple failures
      await service.updateScheduleAfterCheck(sampleProduct.id, false);
      await service.updateScheduleAfterCheck(sampleProduct.id, false);
      
      expect(schedule!.intervalMinutes).toBeGreaterThan(originalInterval);
    });
  });

  describe('detectPriceChanges', () => {
    const previousPrices: PricePoint[] = [
      {
        id: 'price-1',
        productId: 'product-1',
        price: 100.00,
        currency: 'USD',
        availability: AvailabilityStatus.IN_STOCK,
        checkedAt: new Date(Date.now() - 86400000), // 1 day ago
        source: DataSource.OFFICIAL_API
      },
      {
        id: 'price-2',
        productId: 'product-1',
        price: 95.00,
        currency: 'USD',
        availability: AvailabilityStatus.IN_STOCK,
        checkedAt: new Date(Date.now() - 43200000), // 12 hours ago
        source: DataSource.OFFICIAL_API
      }
    ];

    it('should detect significant price drop', async () => {
      const newPrice = 85.00; // 10.5% drop from 95.00
      
      const detection = await service.detectPriceChanges(sampleProduct.id, newPrice, previousPrices);
      
      expect(detection).toBeDefined();
      expect(detection!.oldPrice).toBe(95.00);
      expect(detection!.newPrice).toBe(85.00);
      expect(detection!.changeAmount).toBe(-10.00);
      expect(detection!.isSignificant).toBe(true);
      expect(detection!.triggeredAlerts).toContain(AlertType.PRICE_DROP);
    });

    it('should detect price increase', async () => {
      const newPrice = 105.00; // 10.5% increase from 95.00
      
      const detection = await service.detectPriceChanges(sampleProduct.id, newPrice, previousPrices);
      
      expect(detection).toBeDefined();
      expect(detection!.changeAmount).toBe(10.00);
      expect(detection!.triggeredAlerts).toContain(AlertType.PRICE_INCREASE);
    });

    it('should return null for no price change', async () => {
      const newPrice = 95.00; // Same as last price
      
      const detection = await service.detectPriceChanges(sampleProduct.id, newPrice, previousPrices);
      
      expect(detection).toBeNull();
    });

    it('should return null for empty price history', async () => {
      const detection = await service.detectPriceChanges(sampleProduct.id, 100.00, []);
      
      expect(detection).toBeNull();
    });

    it('should mark small changes as not significant', async () => {
      const newPrice = 94.00; // Small change from 95.00
      
      const detection = await service.detectPriceChanges(sampleProduct.id, newPrice, previousPrices);
      
      expect(detection).toBeDefined();
      expect(detection!.isSignificant).toBe(false);
    });
  });

  describe('checkTargetPrice', () => {
    it('should return true when target price is reached', async () => {
      const result = await service.checkTargetPrice(sampleProduct.id, 90.00, 99.99);
      expect(result).toBe(true);
    });

    it('should return false when target price is not reached', async () => {
      const result = await service.checkTargetPrice(sampleProduct.id, 110.00, 99.99);
      expect(result).toBe(false);
    });

    it('should return false when no target price is set', async () => {
      const result = await service.checkTargetPrice(sampleProduct.id, 90.00, undefined);
      expect(result).toBe(false);
    });
  });

  describe('calculatePriceStatistics', () => {
    const pricePoints: PricePoint[] = [
      {
        id: 'price-1',
        productId: 'product-1',
        price: 100.00,
        currency: 'USD',
        availability: AvailabilityStatus.IN_STOCK,
        checkedAt: new Date('2024-01-01'),
        source: DataSource.OFFICIAL_API
      },
      {
        id: 'price-2',
        productId: 'product-1',
        price: 95.00,
        currency: 'USD',
        availability: AvailabilityStatus.IN_STOCK,
        checkedAt: new Date('2024-01-02'),
        source: DataSource.OFFICIAL_API
      },
      {
        id: 'price-3',
        productId: 'product-1',
        price: 90.00,
        currency: 'USD',
        availability: AvailabilityStatus.IN_STOCK,
        checkedAt: new Date('2024-01-03'),
        source: DataSource.OFFICIAL_API
      }
    ];

    it('should calculate correct statistics', async () => {
      const stats = await service.calculatePriceStatistics(pricePoints);
      
      expect(stats.average).toBe(95.00);
      expect(stats.minimum).toBe(90.00);
      expect(stats.maximum).toBe(100.00);
      expect(stats.trend).toBe(PriceTrend.DECREASING);
      expect(stats.volatility).toBeGreaterThan(0);
    });

    it('should throw error for empty price data', async () => {
      await expect(service.calculatePriceStatistics([])).rejects.toThrow();
    });

    it('should handle single price point', async () => {
      const singlePoint = [pricePoints[0]];
      const stats = await service.calculatePriceStatistics(singlePoint);
      
      expect(stats.average).toBe(100.00);
      expect(stats.minimum).toBe(100.00);
      expect(stats.maximum).toBe(100.00);
      expect(stats.trend).toBe(PriceTrend.STABLE);
    });
  });

  describe('updateUserPreferences', () => {
    it('should update all user products with new preferences', async () => {
      // Schedule multiple products for the same user
      const product2 = { ...sampleProduct, id: 'product-2' };
      
      await service.scheduleMonitoring(sampleProduct, samplePreferences);
      await service.scheduleMonitoring(product2, samplePreferences);
      
      const newPreferences = { ...samplePreferences, checkFrequency: 120 };
      await service.updateUserPreferences(sampleProduct.userId, newPreferences);
      
      const schedule1 = service.getSchedule(sampleProduct.id);
      const schedule2 = service.getSchedule(product2.id);
      
      expect(schedule1!.intervalMinutes).toBe(120);
      expect(schedule2!.intervalMinutes).toBe(120);
    });
  });
});

describe('PriceAlertService', () => {
  let service: PriceAlertService;
  let sampleProduct: TrackedProduct;
  let samplePreferences: UserPreferences;

  beforeEach(() => {
    service = new PriceAlertService();
    
    sampleProduct = {
      id: 'product-1',
      title: 'Test Product',
      url: 'https://example.com/product',
      retailer: 'test-retailer',
      category: 'electronics',
      extractedAt: new Date(),
      userId: 'user-1',
      targetPrice: 99.99,
      isActive: true,
      addedAt: new Date()
    };

    samplePreferences = {
      notificationChannels: [NotificationChannel.BROWSER],
      checkFrequency: 60,
      priceThreshold: 0.1
    };
  });

  describe('setAlertThreshold', () => {
    it('should set price drop threshold', async () => {
      const threshold = await service.setAlertThreshold(
        'user-1',
        'product-1',
        AlertType.PRICE_DROP,
        0.15
      );
      
      expect(threshold.alertType).toBe(AlertType.PRICE_DROP);
      expect(threshold.threshold).toBe(0.15);
      expect(threshold.isActive).toBe(true);
    });

    it('should set target price threshold', async () => {
      const threshold = await service.setAlertThreshold(
        'user-1',
        'product-1',
        AlertType.TARGET_PRICE_REACHED,
        undefined,
        89.99
      );
      
      expect(threshold.alertType).toBe(AlertType.TARGET_PRICE_REACHED);
      expect(threshold.targetPrice).toBe(89.99);
    });

    it('should replace existing threshold of same type', async () => {
      await service.setAlertThreshold('user-1', 'product-1', AlertType.PRICE_DROP, 0.1);
      await service.setAlertThreshold('user-1', 'product-1', AlertType.PRICE_DROP, 0.2);
      
      const thresholds = service.getAlertThresholds('product-1', 'user-1');
      const priceDropThresholds = thresholds.filter(t => t.alertType === AlertType.PRICE_DROP);
      
      expect(priceDropThresholds.length).toBe(1);
      expect(priceDropThresholds[0].threshold).toBe(0.2);
    });
  });

  describe('checkAlerts', () => {
    beforeEach(async () => {
      await service.setAlertThreshold('user-1', 'product-1', AlertType.PRICE_DROP, 0.1);
      await service.setAlertThreshold('user-1', 'product-1', AlertType.TARGET_PRICE_REACHED, undefined, 89.99);
    });

    it('should trigger price drop alert', async () => {
      const alerts = await service.checkAlerts(sampleProduct, 85.00, 100.00);
      
      expect(alerts.length).toBeGreaterThan(0);
      const priceDropAlert = alerts.find(a => a.alertType === AlertType.PRICE_DROP);
      expect(priceDropAlert).toBeDefined();
      expect(priceDropAlert!.message).toContain('Price drop alert');
    });

    it('should trigger target price alert', async () => {
      const alerts = await service.checkAlerts(sampleProduct, 85.00, 100.00);
      
      const targetAlert = alerts.find(a => a.alertType === AlertType.TARGET_PRICE_REACHED);
      expect(targetAlert).toBeDefined();
      expect(targetAlert!.message).toContain('Target price reached');
    });

    it('should not trigger alerts for small changes', async () => {
      const alerts = await service.checkAlerts(sampleProduct, 98.00, 100.00); // 2% drop
      
      const priceDropAlert = alerts.find(a => a.alertType === AlertType.PRICE_DROP);
      expect(priceDropAlert).toBeUndefined();
    });

    it('should trigger back in stock alert', async () => {
      await service.setAlertThreshold('user-1', 'product-1', AlertType.BACK_IN_STOCK);
      
      const alerts = await service.checkAlerts(sampleProduct, 100.00, undefined, true);
      
      const stockAlert = alerts.find(a => a.alertType === AlertType.BACK_IN_STOCK);
      expect(stockAlert).toBeDefined();
    });
  });

  describe('validateThreshold', () => {
    it('should validate price drop threshold', () => {
      expect(service.validateThreshold(AlertType.PRICE_DROP, 0.1)).toBe(true);
      expect(service.validateThreshold(AlertType.PRICE_DROP, -0.1)).toBe(false);
      expect(service.validateThreshold(AlertType.PRICE_DROP, 1.5)).toBe(false);
    });

    it('should validate target price threshold', () => {
      expect(service.validateThreshold(AlertType.TARGET_PRICE_REACHED, undefined, 99.99)).toBe(true);
      expect(service.validateThreshold(AlertType.TARGET_PRICE_REACHED, undefined, -10)).toBe(false);
      expect(service.validateThreshold(AlertType.TARGET_PRICE_REACHED, undefined, undefined)).toBe(false);
    });

    it('should validate back in stock threshold', () => {
      expect(service.validateThreshold(AlertType.BACK_IN_STOCK)).toBe(true);
    });
  });
});

describe('PriceHistoryService', () => {
  let service: PriceHistoryService;
  let samplePricePoints: PricePoint[];

  beforeEach(() => {
    service = new PriceHistoryService();
    
    samplePricePoints = [
      {
        id: 'price-1',
        productId: 'product-1',
        price: 100.00,
        currency: 'USD',
        availability: AvailabilityStatus.IN_STOCK,
        checkedAt: new Date('2024-01-01'),
        source: DataSource.OFFICIAL_API
      },
      {
        id: 'price-2',
        productId: 'product-1',
        price: 95.00,
        currency: 'USD',
        availability: AvailabilityStatus.IN_STOCK,
        checkedAt: new Date('2024-01-02'),
        source: DataSource.OFFICIAL_API
      },
      {
        id: 'price-3',
        productId: 'product-1',
        price: 90.00,
        currency: 'USD',
        availability: AvailabilityStatus.IN_STOCK,
        checkedAt: new Date('2024-01-03'),
        source: DataSource.OFFICIAL_API
      }
    ];
  });

  describe('storePricePoint', () => {
    it('should store valid price point', async () => {
      const pricePoint = await service.storePricePoint(
        'product-1',
        99.99,
        'USD',
        AvailabilityStatus.IN_STOCK,
        DataSource.OFFICIAL_API
      );
      
      expect(pricePoint.productId).toBe('product-1');
      expect(pricePoint.price).toBe(99.99);
      expect(pricePoint.currency).toBe('USD');
      expect(pricePoint.source).toBe(DataSource.OFFICIAL_API);
    });

    it('should reject invalid price values', async () => {
      await expect(service.storePricePoint(
        'product-1',
        -10,
        'USD',
        AvailabilityStatus.IN_STOCK,
        DataSource.OFFICIAL_API
      )).rejects.toThrow('Invalid price value');
    });

    it('should round price to 2 decimal places', async () => {
      const pricePoint = await service.storePricePoint(
        'product-1',
        99.999,
        'USD',
        AvailabilityStatus.IN_STOCK,
        DataSource.OFFICIAL_API
      );
      
      expect(pricePoint.price).toBe(100.00);
    });
  });

  describe('getPriceHistory', () => {
    it('should return price history with statistics', async () => {
      const history = await service.getPriceHistory('product-1', samplePricePoints, true);
      
      expect(history.productId).toBe('product-1');
      expect(history.points.length).toBe(3);
      expect(history.statistics).toBeDefined();
      expect(history.statistics.average).toBe(95.00);
    });

    it('should sort price points by date', async () => {
      const shuffledPoints = [...samplePricePoints].reverse();
      const history = await service.getPriceHistory('product-1', shuffledPoints, true);
      
      expect(history.points[0].checkedAt).toEqual(new Date('2024-01-01'));
      expect(history.points[2].checkedAt).toEqual(new Date('2024-01-03'));
    });

    it('should handle insufficient data gracefully', async () => {
      const singlePoint = [samplePricePoints[0]];
      const history = await service.getPriceHistory('product-1', singlePoint, true);
      
      expect(history.statistics.average).toBe(100.00);
      expect(history.statistics.trend).toBe(PriceTrend.STABLE);
    });
  });

  describe('validateRealData', () => {
    it('should validate real price data', () => {
      const validation = service.validateRealData(samplePricePoints);
      
      expect(validation.isValid).toBe(true);
      expect(validation.issues.length).toBe(0);
      expect(validation.validPoints.length).toBe(3);
    });

    it('should detect mock data patterns', () => {
      const mockPoints: PricePoint[] = [
        {
          id: 'test-price-1',
          productId: 'product-1',
          price: 9.99, // Common test value
          currency: 'USD',
          availability: AvailabilityStatus.IN_STOCK,
          checkedAt: new Date(),
          source: DataSource.OFFICIAL_API
        }
      ];
      
      const validation = service.validateRealData(mockPoints);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should reject invalid prices', () => {
      const invalidPoints: PricePoint[] = [
        {
          id: 'price-1',
          productId: 'product-1',
          price: -10, // Invalid negative price
          currency: 'USD',
          availability: AvailabilityStatus.IN_STOCK,
          checkedAt: new Date(),
          source: DataSource.OFFICIAL_API
        }
      ];
      
      const validation = service.validateRealData(invalidPoints);
      
      expect(validation.isValid).toBe(false);
      expect(validation.validPoints.length).toBe(0);
    });
  });

  describe('assessDataQuality', () => {
    it('should assess data quality correctly', async () => {
      const metrics = await service.assessDataQuality(samplePricePoints);
      
      expect(metrics.totalPoints).toBe(3);
      expect(metrics.validPoints).toBe(3);
      expect(metrics.invalidPoints).toBe(0);
      expect(metrics.dataQualityScore).toBeGreaterThan(0);
      expect(metrics.oldestDataPoint).toEqual(new Date('2024-01-01'));
      expect(metrics.newestDataPoint).toEqual(new Date('2024-01-03'));
    });

    it('should handle empty data', async () => {
      const metrics = await service.assessDataQuality([]);
      
      expect(metrics.totalPoints).toBe(0);
      expect(metrics.validPoints).toBe(0);
      expect(metrics.dataQualityScore).toBe(0);
    });
  });

  describe('checkInsufficientData', () => {
    it('should detect insufficient data for statistics', async () => {
      const twoPoints = samplePricePoints.slice(0, 2);
      const indicator = await service.checkInsufficientData(twoPoints, 'statistics');
      
      expect(indicator.hasInsufficientData).toBe(true);
      expect(indicator.minimumPointsNeeded).toBe(3);
      expect(indicator.currentPoints).toBe(2);
    });

    it('should detect sufficient data', async () => {
      const indicator = await service.checkInsufficientData(samplePricePoints, 'statistics');
      
      expect(indicator.hasInsufficientData).toBe(false);
      expect(indicator.currentPoints).toBe(3);
    });

    it('should handle different operation types', async () => {
      const trendIndicator = await service.checkInsufficientData(samplePricePoints, 'trend');
      expect(trendIndicator.minimumPointsNeeded).toBe(5);
      
      const comparisonIndicator = await service.checkInsufficientData(samplePricePoints, 'comparison');
      expect(comparisonIndicator.minimumPointsNeeded).toBe(2);
    });
  });
});