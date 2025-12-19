import { 
  TrackedProduct, 
  PricePoint, 
  PriceHistory, 
  PriceUpdate, 
  PriceAlert,
  UserPreferences,
  TrackingResult,
  AvailabilityStatus,
  DataSource
} from '../../../shared/types';
import { priceTrackingService } from './priceTracking';
import { priceAlertService } from './priceAlerts';
import { priceHistoryService } from './priceHistory';
import { logger } from '../utils/logger';

export class PriceService {
  /**
   * Start tracking a product with user preferences
   */
  async trackProduct(
    userId: string, 
    product: TrackedProduct, 
    userPreferences: UserPreferences
  ): Promise<TrackingResult> {
    try {
      // Schedule price monitoring
      await priceTrackingService.scheduleMonitoring(product, userPreferences);

      // Set up default alert thresholds
      await priceAlertService.setDefaultThresholds(
        userId,
        product.id,
        userPreferences,
        product.targetPrice
      );

      const result: TrackingResult = {
        success: true,
        productId: product.id,
        estimatedNextCheck: new Date(Date.now() + userPreferences.checkFrequency * 60 * 1000)
      };

      logger.info(`Started tracking product ${product.id} for user ${userId}`);
      return result;
    } catch (error) {
      logger.error(`Error tracking product ${product.id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Stop tracking a product
   */
  async stopTracking(userId: string, productId: string): Promise<void> {
    try {
      await priceTrackingService.unscheduleMonitoring(productId);
      
      // Remove all alert thresholds for this product and user
      const userThresholds = priceAlertService.getAlertThresholds(productId, userId);
      for (const threshold of userThresholds) {
        await priceAlertService.removeAlertThreshold(userId, productId, threshold.alertType);
      }

      logger.info(`Stopped tracking product ${productId} for user ${userId}`);
    } catch (error) {
      logger.error(`Error stopping tracking for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Check prices for products that need updating
   */
  async checkPrices(productIds?: string[]): Promise<PriceUpdate[]> {
    try {
      const updates: PriceUpdate[] = [];
      let productsToCheck: string[];

      if (productIds) {
        productsToCheck = productIds;
      } else {
        // Get products that need checking based on schedule
        const schedules = priceTrackingService.getProductsForChecking();
        productsToCheck = schedules.map(s => s.productId);
      }

      logger.info(`Checking prices for ${productsToCheck.length} products`);

      for (const productId of productsToCheck) {
        try {
          const update = await this.checkSingleProductPrice(productId);
          if (update) {
            updates.push(update);
          }
        } catch (error) {
          logger.error(`Error checking price for product ${productId}:`, error);
          // Update schedule to reflect failure
          await priceTrackingService.updateScheduleAfterCheck(productId, false);
        }
      }

      logger.info(`Completed price check: ${updates.length} updates generated`);
      return updates;
    } catch (error) {
      logger.error('Error in batch price checking:', error);
      throw error;
    }
  }

  /**
   * Get price history for a product with real data only
   */
  async getPriceHistory(
    productId: string, 
    pricePoints: PricePoint[],
    timeRange?: { start: Date; end: Date }
  ): Promise<PriceHistory> {
    try {
      const history = await priceHistoryService.getPriceHistory(productId, pricePoints, true);
      
      // Filter by time range if provided
      if (timeRange) {
        history.points = history.points.filter(point => 
          point.checkedAt >= timeRange.start && point.checkedAt <= timeRange.end
        );
        
        // Recalculate statistics for filtered data
        if (history.points.length >= 3) {
          history.statistics = await priceHistoryService['calculateRealDataStatistics'](history.points);
        }
      }

      return history;
    } catch (error) {
      logger.error(`Error getting price history for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Update user preferences for all tracked products
   */
  async updateUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    try {
      await priceTrackingService.updateUserPreferences(userId, preferences);
      logger.info(`Updated preferences for user ${userId}`);
    } catch (error) {
      logger.error(`Error updating preferences for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get tracking status for user's products
   */
  async getTrackingStatus(userId: string): Promise<{
    totalProducts: number;
    activeProducts: number;
    nextCheckTimes: Array<{ productId: string; nextCheck: Date }>;
    alertStatistics: any;
  }> {
    try {
      const schedules = priceTrackingService.getMonitoringSchedules();
      const userSchedules = Array.from(schedules.values()).filter(s => s.userId === userId);
      
      const nextCheckTimes = userSchedules.map(schedule => ({
        productId: schedule.productId,
        nextCheck: schedule.nextCheckAt
      }));

      const alertStatistics = priceAlertService.getAlertStatistics(userId);

      return {
        totalProducts: userSchedules.length,
        activeProducts: userSchedules.filter(s => s.consecutiveFailures < 5).length,
        nextCheckTimes,
        alertStatistics
      };
    } catch (error) {
      logger.error(`Error getting tracking status for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check price for a single product (internal method)
   */
  private async checkSingleProductPrice(productId: string): Promise<PriceUpdate | null> {
    try {
      // This would integrate with the actual data collection services
      // For now, we'll simulate the process
      
      // 1. Get current price from retailer (via API or legal scraper)
      // 2. Get previous prices from database
      // 3. Detect changes and generate alerts
      // 4. Update schedule
      
      // Placeholder implementation - in real system this would call:
      // - retailerService.getProductInfo()
      // - database to get previous prices
      // - priceTrackingService.detectPriceChanges()
      
      logger.info(`Price check for product ${productId} would be performed here`);
      
      // Update schedule to reflect successful check
      await priceTrackingService.updateScheduleAfterCheck(productId, true);
      
      return null; // No update in this placeholder
    } catch (error) {
      logger.error(`Error checking price for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Process price update and generate alerts
   */
  async processPriceUpdate(
    product: TrackedProduct,
    newPrice: number,
    previousPrices: PricePoint[],
    availability: AvailabilityStatus,
    source: DataSource
  ): Promise<{
    pricePoint: PricePoint;
    alerts: PriceAlert[];
    update?: PriceUpdate;
  }> {
    try {
      // Store the new price point
      const pricePoint = await priceHistoryService.storePricePoint(
        product.id,
        newPrice,
        'USD', // Default currency - should be configurable
        availability,
        source
      );

      // Detect price changes
      const detection = await priceTrackingService.detectPriceChanges(
        product.id,
        newPrice,
        previousPrices
      );

      let update: PriceUpdate | undefined;
      if (detection) {
        update = await priceTrackingService.generatePriceUpdate(detection, product.id);
      }

      // Check for alerts
      const previousPrice = previousPrices.length > 0 ? 
        previousPrices.sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())[0].price :
        undefined;

      const alerts = await priceAlertService.checkAlerts(
        product,
        newPrice,
        previousPrice,
        availability === AvailabilityStatus.IN_STOCK
      );

      // Check target price
      const targetReached = await priceTrackingService.checkTargetPrice(
        product.id,
        newPrice,
        product.targetPrice
      );

      if (targetReached) {
        // Add target price alert if not already included
        const hasTargetAlert = alerts.some(alert => alert.alertType === 'target_price_reached');
        if (!hasTargetAlert) {
          const targetAlert: PriceAlert = {
            id: `alert_${product.id}_target_${Date.now()}`,
            userId: product.userId,
            productId: product.id,
            alertType: 'target_price_reached' as any,
            message: `Target price reached! ${product.title} is now $${newPrice.toFixed(2)}`,
            createdAt: new Date(),
            delivered: false
          };
          alerts.push(targetAlert);
        }
      }

      logger.info(`Processed price update for ${product.id}: ${alerts.length} alerts generated`);

      return {
        pricePoint,
        alerts,
        update
      };
    } catch (error) {
      logger.error(`Error processing price update for product ${product.id}:`, error);
      throw error;
    }
  }

  /**
   * Validate price data quality
   */
  async validatePriceData(pricePoints: PricePoint[]): Promise<{
    isValid: boolean;
    issues: string[];
    dataQuality: any;
  }> {
    try {
      const validation = priceHistoryService.validateRealData(pricePoints);
      const dataQuality = await priceHistoryService.assessDataQuality(pricePoints);

      return {
        isValid: validation.isValid,
        issues: validation.issues,
        dataQuality
      };
    } catch (error) {
      logger.error('Error validating price data:', error);
      throw error;
    }
  }

  /**
   * Clean up inactive tracking data
   */
  async cleanupInactiveTracking(activeProductIds: string[]): Promise<void> {
    try {
      await priceAlertService.cleanupInactiveThresholds(activeProductIds);
      logger.info('Completed cleanup of inactive tracking data');
    } catch (error) {
      logger.error('Error cleaning up inactive tracking data:', error);
      throw error;
    }
  }
}

export const priceService = new PriceService();