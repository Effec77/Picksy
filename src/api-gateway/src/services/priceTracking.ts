import { 
  TrackedProduct, 
  PricePoint, 
  PriceHistory, 
  PriceStatistics, 
  PriceTrend, 
  PriceAlert, 
  AlertType, 
  PriceUpdate,
  AvailabilityStatus,
  DataSource,
  UserPreferences
} from '../../../shared/types';
import { logger } from '../utils/logger';

interface PriceCheckSchedule {
  productId: string;
  userId: string;
  nextCheckAt: Date;
  intervalMinutes: number;
  lastCheckedAt?: Date;
  consecutiveFailures: number;
}

interface PriceChangeDetection {
  productId: string;
  oldPrice: number;
  newPrice: number;
  changeAmount: number;
  changePercentage: number;
  isSignificant: boolean;
  triggeredAlerts: AlertType[];
}

export class PriceTrackingService {
  private schedules = new Map<string, PriceCheckSchedule>();
  private readonly defaultCheckInterval = 60; // minutes
  private readonly maxCheckInterval = 1440; // 24 hours
  private readonly minCheckInterval = 15; // 15 minutes
  private readonly significantChangeThreshold = 0.05; // 5%
  private readonly maxConsecutiveFailures = 5;

  /**
   * Schedule price monitoring for a tracked product
   */
  async scheduleMonitoring(
    product: TrackedProduct, 
    userPreferences: UserPreferences
  ): Promise<void> {
    try {
      const intervalMinutes = this.calculateCheckInterval(userPreferences.checkFrequency);
      const nextCheckAt = new Date(Date.now() + intervalMinutes * 60 * 1000);

      const schedule: PriceCheckSchedule = {
        productId: product.id,
        userId: product.userId,
        nextCheckAt,
        intervalMinutes,
        consecutiveFailures: 0
      };

      this.schedules.set(product.id, schedule);
      
      logger.info(`Scheduled price monitoring for product ${product.id} with ${intervalMinutes}min interval`);
    } catch (error) {
      logger.error(`Error scheduling monitoring for product ${product.id}:`, error);
      throw error;
    }
  }

  /**
   * Remove price monitoring schedule
   */
  async unscheduleMonitoring(productId: string): Promise<void> {
    try {
      this.schedules.delete(productId);
      logger.info(`Unscheduled price monitoring for product ${productId}`);
    } catch (error) {
      logger.error(`Error unscheduling monitoring for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Get products that need price checking
   */
  getProductsForChecking(): PriceCheckSchedule[] {
    const now = new Date();
    return Array.from(this.schedules.values())
      .filter(schedule => schedule.nextCheckAt <= now)
      .filter(schedule => schedule.consecutiveFailures < this.maxConsecutiveFailures);
  }

  /**
   * Update schedule after price check
   */
  async updateScheduleAfterCheck(
    productId: string, 
    success: boolean, 
    userPreferences?: UserPreferences
  ): Promise<void> {
    try {
      const schedule = this.schedules.get(productId);
      if (!schedule) {
        logger.warn(`No schedule found for product ${productId}`);
        return;
      }

      schedule.lastCheckedAt = new Date();

      if (success) {
        schedule.consecutiveFailures = 0;
        // Use user preferences if provided, otherwise keep current interval
        if (userPreferences) {
          schedule.intervalMinutes = this.calculateCheckInterval(userPreferences.checkFrequency);
        }
      } else {
        schedule.consecutiveFailures++;
        // Exponential backoff on failures
        schedule.intervalMinutes = Math.min(
          schedule.intervalMinutes * Math.pow(2, schedule.consecutiveFailures),
          this.maxCheckInterval
        );
      }

      schedule.nextCheckAt = new Date(Date.now() + schedule.intervalMinutes * 60 * 1000);
      
      logger.info(`Updated schedule for product ${productId}: next check at ${schedule.nextCheckAt}`);
    } catch (error) {
      logger.error(`Error updating schedule for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Detect price changes and determine significance
   */
  async detectPriceChanges(
    productId: string,
    newPrice: number,
    previousPrices: PricePoint[]
  ): Promise<PriceChangeDetection | null> {
    try {
      if (previousPrices.length === 0) {
        logger.info(`No previous prices for product ${productId}, skipping change detection`);
        return null;
      }

      // Get most recent price
      const sortedPrices = previousPrices.sort((a, b) => 
        new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
      );
      const lastPrice = sortedPrices[0];

      if (lastPrice.price === newPrice) {
        return null; // No change
      }

      const changeAmount = newPrice - lastPrice.price;
      const changePercentage = Math.abs(changeAmount) / lastPrice.price;
      const isSignificant = changePercentage >= this.significantChangeThreshold;

      const triggeredAlerts: AlertType[] = [];
      
      // Determine alert types
      if (changeAmount < 0) {
        triggeredAlerts.push(AlertType.PRICE_DROP);
      } else {
        triggeredAlerts.push(AlertType.PRICE_INCREASE);
      }

      const detection: PriceChangeDetection = {
        productId,
        oldPrice: lastPrice.price,
        newPrice,
        changeAmount,
        changePercentage,
        isSignificant,
        triggeredAlerts
      };

      logger.info(`Price change detected for product ${productId}: ${lastPrice.price} -> ${newPrice} (${(changePercentage * 100).toFixed(2)}%)`);
      return detection;
    } catch (error) {
      logger.error(`Error detecting price changes for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Check if target price is reached
   */
  async checkTargetPrice(
    productId: string,
    currentPrice: number,
    targetPrice?: number
  ): Promise<boolean> {
    try {
      if (!targetPrice) {
        return false;
      }

      const targetReached = currentPrice <= targetPrice;
      
      if (targetReached) {
        logger.info(`Target price reached for product ${productId}: ${currentPrice} <= ${targetPrice}`);
      }

      return targetReached;
    } catch (error) {
      logger.error(`Error checking target price for product ${productId}:`, error);
      return false;
    }
  }

  /**
   * Calculate price statistics from historical data
   */
  async calculatePriceStatistics(pricePoints: PricePoint[]): Promise<PriceStatistics> {
    try {
      if (pricePoints.length === 0) {
        throw new Error('Cannot calculate statistics from empty price data');
      }

      const prices = pricePoints.map(point => point.price);
      const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const minimum = Math.min(...prices);
      const maximum = Math.max(...prices);

      // Calculate trend
      const trend = this.calculatePriceTrend(pricePoints);

      // Calculate volatility (standard deviation)
      const variance = prices.reduce((sum, price) => sum + Math.pow(price - average, 2), 0) / prices.length;
      const volatility = Math.sqrt(variance);

      const statistics: PriceStatistics = {
        average: Math.round(average * 100) / 100,
        minimum: Math.round(minimum * 100) / 100,
        maximum: Math.round(maximum * 100) / 100,
        trend,
        volatility: Math.round(volatility * 100) / 100
      };

      logger.debug(`Calculated statistics for ${pricePoints.length} price points:`, statistics);
      return statistics;
    } catch (error) {
      logger.error('Error calculating price statistics:', error);
      throw error;
    }
  }

  /**
   * Calculate price trend using linear regression
   */
  private calculatePriceTrend(pricePoints: PricePoint[]): PriceTrend {
    try {
      if (pricePoints.length < 2) {
        return PriceTrend.STABLE;
      }

      // Sort by date
      const sortedPoints = pricePoints.sort((a, b) => 
        new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime()
      );

      // Simple linear regression to determine trend
      const n = sortedPoints.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

      sortedPoints.forEach((point, index) => {
        const x = index; // Time index
        const y = point.price;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
      });

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      
      // Calculate coefficient of determination (R²) for trend strength
      const meanY = sumY / n;
      let ssRes = 0, ssTot = 0;
      
      sortedPoints.forEach((point, index) => {
        const predicted = (sumY - slope * sumX) / n + slope * index;
        ssRes += Math.pow(point.price - predicted, 2);
        ssTot += Math.pow(point.price - meanY, 2);
      });

      const rSquared = 1 - (ssRes / ssTot);
      
      // Determine trend based on slope and strength
      const slopeThreshold = 0.01; // Minimum slope to consider significant
      const strengthThreshold = 0.3; // Minimum R² to consider trend reliable

      if (rSquared < strengthThreshold) {
        return PriceTrend.VOLATILE;
      }

      if (Math.abs(slope) < slopeThreshold) {
        return PriceTrend.STABLE;
      }

      return slope > 0 ? PriceTrend.INCREASING : PriceTrend.DECREASING;
    } catch (error) {
      logger.error('Error calculating price trend:', error);
      return PriceTrend.STABLE;
    }
  }

  /**
   * Calculate appropriate check interval based on user preferences
   */
  private calculateCheckInterval(userFrequency: number): number {
    // Ensure interval is within bounds
    const interval = Math.max(
      this.minCheckInterval,
      Math.min(userFrequency, this.maxCheckInterval)
    );

    return interval;
  }

  /**
   * Generate price update object
   */
  async generatePriceUpdate(
    detection: PriceChangeDetection,
    productId: string
  ): Promise<PriceUpdate> {
    try {
      const update: PriceUpdate = {
        productId,
        oldPrice: detection.oldPrice,
        newPrice: detection.newPrice,
        priceChange: detection.changeAmount,
        percentageChange: detection.changePercentage,
        updatedAt: new Date()
      };

      return update;
    } catch (error) {
      logger.error(`Error generating price update for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Get current monitoring schedules
   */
  getMonitoringSchedules(): Map<string, PriceCheckSchedule> {
    return new Map(this.schedules);
  }

  /**
   * Get schedule for specific product
   */
  getSchedule(productId: string): PriceCheckSchedule | undefined {
    return this.schedules.get(productId);
  }

  /**
   * Update user preferences for all products
   */
  async updateUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    try {
      const userSchedules = Array.from(this.schedules.values())
        .filter(schedule => schedule.userId === userId);

      for (const schedule of userSchedules) {
        schedule.intervalMinutes = this.calculateCheckInterval(preferences.checkFrequency);
        schedule.nextCheckAt = new Date(Date.now() + schedule.intervalMinutes * 60 * 1000);
      }

      logger.info(`Updated preferences for ${userSchedules.length} products for user ${userId}`);
    } catch (error) {
      logger.error(`Error updating user preferences for user ${userId}:`, error);
      throw error;
    }
  }
}

export const priceTrackingService = new PriceTrackingService();