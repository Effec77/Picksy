import { 
  PriceAlert, 
  AlertType, 
  TrackedProduct, 
  PricePoint, 
  UserPreferences,
  NotificationChannel
} from '../../../shared/types';
import { logger } from '../utils/logger';

interface AlertThreshold {
  id: string;
  userId: string;
  productId: string;
  alertType: AlertType;
  threshold?: number; // For percentage-based alerts
  targetPrice?: number; // For target price alerts
  isActive: boolean;
  createdAt: Date;
}

interface AlertRule {
  type: AlertType;
  condition: (currentPrice: number, previousPrice: number, threshold?: number, targetPrice?: number) => boolean;
  message: (productTitle: string, currentPrice: number, previousPrice?: number, threshold?: number) => string;
}

export class PriceAlertService {
  private thresholds = new Map<string, AlertThreshold[]>();
  private readonly defaultPriceDropThreshold = 0.1; // 10%
  private readonly defaultPriceIncreaseThreshold = 0.2; // 20%

  private readonly alertRules: Map<AlertType, AlertRule> = new Map([
    [AlertType.PRICE_DROP, {
      type: AlertType.PRICE_DROP,
      condition: (current, previous, threshold = this.defaultPriceDropThreshold) => {
        const change = (previous - current) / previous;
        return change >= threshold;
      },
      message: (title, current, previous, threshold) => {
        const savings = previous! - current;
        const percentage = ((previous! - current) / previous!) * 100;
        return `Price drop alert! ${title} is now $${current.toFixed(2)} (was $${previous!.toFixed(2)}). You save $${savings.toFixed(2)} (${percentage.toFixed(1)}%)`;
      }
    }],
    [AlertType.PRICE_INCREASE, {
      type: AlertType.PRICE_INCREASE,
      condition: (current, previous, threshold = this.defaultPriceIncreaseThreshold) => {
        const change = (current - previous) / previous;
        return change >= threshold;
      },
      message: (title, current, previous, threshold) => {
        const increase = current - previous!;
        const percentage = ((current - previous!) / previous!) * 100;
        return `Price increase alert! ${title} is now $${current.toFixed(2)} (was $${previous!.toFixed(2)}). Price increased by $${increase.toFixed(2)} (${percentage.toFixed(1)}%)`;
      }
    }],
    [AlertType.TARGET_PRICE_REACHED, {
      type: AlertType.TARGET_PRICE_REACHED,
      condition: (current, previous, threshold, targetPrice) => {
        return targetPrice !== undefined && current <= targetPrice;
      },
      message: (title, current, previous, threshold) => {
        return `Target price reached! ${title} is now $${current.toFixed(2)}. Time to buy!`;
      }
    }],
    [AlertType.BACK_IN_STOCK, {
      type: AlertType.BACK_IN_STOCK,
      condition: () => true, // This is handled separately based on availability status
      message: (title, current) => {
        return `Back in stock! ${title} is available again at $${current.toFixed(2)}`;
      }
    }]
  ]);

  /**
   * Set alert threshold for a product
   */
  async setAlertThreshold(
    userId: string,
    productId: string,
    alertType: AlertType,
    threshold?: number,
    targetPrice?: number
  ): Promise<AlertThreshold> {
    try {
      const alertThreshold: AlertThreshold = {
        id: this.generateThresholdId(userId, productId, alertType),
        userId,
        productId,
        alertType,
        threshold,
        targetPrice,
        isActive: true,
        createdAt: new Date()
      };

      // Get existing thresholds for product
      const productThresholds = this.thresholds.get(productId) || [];
      
      // Remove existing threshold of same type
      const filteredThresholds = productThresholds.filter(t => 
        t.alertType !== alertType || t.userId !== userId
      );
      
      // Add new threshold
      filteredThresholds.push(alertThreshold);
      this.thresholds.set(productId, filteredThresholds);

      logger.info(`Set ${alertType} alert threshold for product ${productId}, user ${userId}`);
      return alertThreshold;
    } catch (error) {
      logger.error(`Error setting alert threshold for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Remove alert threshold
   */
  async removeAlertThreshold(
    userId: string,
    productId: string,
    alertType: AlertType
  ): Promise<void> {
    try {
      const productThresholds = this.thresholds.get(productId) || [];
      const filteredThresholds = productThresholds.filter(t => 
        !(t.alertType === alertType && t.userId === userId)
      );

      if (filteredThresholds.length === 0) {
        this.thresholds.delete(productId);
      } else {
        this.thresholds.set(productId, filteredThresholds);
      }

      logger.info(`Removed ${alertType} alert threshold for product ${productId}, user ${userId}`);
    } catch (error) {
      logger.error(`Error removing alert threshold for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Get alert thresholds for a product
   */
  getAlertThresholds(productId: string, userId?: string): AlertThreshold[] {
    const productThresholds = this.thresholds.get(productId) || [];
    
    if (userId) {
      return productThresholds.filter(t => t.userId === userId);
    }
    
    return productThresholds;
  }

  /**
   * Get all alert thresholds for a user
   */
  getUserAlertThresholds(userId: string): AlertThreshold[] {
    const allThresholds: AlertThreshold[] = [];
    
    for (const productThresholds of this.thresholds.values()) {
      const userThresholds = productThresholds.filter(t => t.userId === userId);
      allThresholds.push(...userThresholds);
    }
    
    return allThresholds;
  }

  /**
   * Check if price change triggers any alerts
   */
  async checkAlerts(
    product: TrackedProduct,
    currentPrice: number,
    previousPrice?: number,
    availabilityChanged?: boolean
  ): Promise<PriceAlert[]> {
    try {
      const triggeredAlerts: PriceAlert[] = [];
      const productThresholds = this.getAlertThresholds(product.id, product.userId);

      for (const threshold of productThresholds.filter(t => t.isActive)) {
        const alertRule = this.alertRules.get(threshold.alertType);
        if (!alertRule) continue;

        let shouldTrigger = false;

        // Special handling for back in stock alerts
        if (threshold.alertType === AlertType.BACK_IN_STOCK) {
          shouldTrigger = availabilityChanged === true;
        } else if (previousPrice !== undefined) {
          shouldTrigger = alertRule.condition(
            currentPrice, 
            previousPrice, 
            threshold.threshold, 
            threshold.targetPrice
          );
        }

        if (shouldTrigger) {
          const alert: PriceAlert = {
            id: this.generateAlertId(product.id, threshold.alertType),
            userId: product.userId,
            productId: product.id,
            alertType: threshold.alertType,
            threshold: threshold.threshold,
            message: alertRule.message(
              product.title, 
              currentPrice, 
              previousPrice, 
              threshold.threshold
            ),
            createdAt: new Date(),
            delivered: false
          };

          triggeredAlerts.push(alert);
        }
      }

      if (triggeredAlerts.length > 0) {
        logger.info(`Generated ${triggeredAlerts.length} alerts for product ${product.id}`);
      }

      return triggeredAlerts;
    } catch (error) {
      logger.error(`Error checking alerts for product ${product.id}:`, error);
      return [];
    }
  }

  /**
   * Set default alert thresholds based on user preferences
   */
  async setDefaultThresholds(
    userId: string,
    productId: string,
    userPreferences: UserPreferences,
    targetPrice?: number
  ): Promise<AlertThreshold[]> {
    try {
      const thresholds: AlertThreshold[] = [];

      // Set price drop threshold based on user preferences
      const priceDropThreshold = await this.setAlertThreshold(
        userId,
        productId,
        AlertType.PRICE_DROP,
        userPreferences.priceThreshold
      );
      thresholds.push(priceDropThreshold);

      // Set target price threshold if provided
      if (targetPrice) {
        const targetPriceThreshold = await this.setAlertThreshold(
          userId,
          productId,
          AlertType.TARGET_PRICE_REACHED,
          undefined,
          targetPrice
        );
        thresholds.push(targetPriceThreshold);
      }

      // Set back in stock threshold
      const backInStockThreshold = await this.setAlertThreshold(
        userId,
        productId,
        AlertType.BACK_IN_STOCK
      );
      thresholds.push(backInStockThreshold);

      logger.info(`Set default thresholds for product ${productId}, user ${userId}`);
      return thresholds;
    } catch (error) {
      logger.error(`Error setting default thresholds for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Update alert threshold
   */
  async updateAlertThreshold(
    userId: string,
    productId: string,
    alertType: AlertType,
    threshold?: number,
    targetPrice?: number,
    isActive?: boolean
  ): Promise<AlertThreshold | null> {
    try {
      const productThresholds = this.thresholds.get(productId) || [];
      const existingThreshold = productThresholds.find(t => 
        t.alertType === alertType && t.userId === userId
      );

      if (!existingThreshold) {
        logger.warn(`No existing threshold found for ${alertType} on product ${productId}`);
        return null;
      }

      // Update threshold values
      if (threshold !== undefined) {
        existingThreshold.threshold = threshold;
      }
      if (targetPrice !== undefined) {
        existingThreshold.targetPrice = targetPrice;
      }
      if (isActive !== undefined) {
        existingThreshold.isActive = isActive;
      }

      logger.info(`Updated ${alertType} threshold for product ${productId}, user ${userId}`);
      return existingThreshold;
    } catch (error) {
      logger.error(`Error updating alert threshold for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Validate alert threshold values
   */
  validateThreshold(alertType: AlertType, threshold?: number, targetPrice?: number): boolean {
    try {
      switch (alertType) {
        case AlertType.PRICE_DROP:
        case AlertType.PRICE_INCREASE:
          return threshold !== undefined && threshold > 0 && threshold <= 1; // 0-100%
        
        case AlertType.TARGET_PRICE_REACHED:
          return targetPrice !== undefined && targetPrice > 0;
        
        case AlertType.BACK_IN_STOCK:
          return true; // No specific validation needed
        
        default:
          return false;
      }
    } catch (error) {
      logger.error(`Error validating threshold for ${alertType}:`, error);
      return false;
    }
  }

  /**
   * Get alert statistics for a user
   */
  getAlertStatistics(userId: string): {
    totalThresholds: number;
    activeThresholds: number;
    thresholdsByType: Record<AlertType, number>;
  } {
    try {
      const userThresholds = this.getUserAlertThresholds(userId);
      const activeThresholds = userThresholds.filter(t => t.isActive);
      
      const thresholdsByType = userThresholds.reduce((acc, threshold) => {
        acc[threshold.alertType] = (acc[threshold.alertType] || 0) + 1;
        return acc;
      }, {} as Record<AlertType, number>);

      return {
        totalThresholds: userThresholds.length,
        activeThresholds: activeThresholds.length,
        thresholdsByType
      };
    } catch (error) {
      logger.error(`Error getting alert statistics for user ${userId}:`, error);
      return {
        totalThresholds: 0,
        activeThresholds: 0,
        thresholdsByType: {} as Record<AlertType, number>
      };
    }
  }

  /**
   * Generate unique threshold ID
   */
  private generateThresholdId(userId: string, productId: string, alertType: AlertType): string {
    return `threshold_${userId}_${productId}_${alertType}_${Date.now()}`;
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(productId: string, alertType: AlertType): string {
    return `alert_${productId}_${alertType}_${Date.now()}`;
  }

  /**
   * Clean up old thresholds for inactive products
   */
  async cleanupInactiveThresholds(activeProductIds: string[]): Promise<void> {
    try {
      const activeSet = new Set(activeProductIds);
      const keysToDelete: string[] = [];

      for (const [productId] of this.thresholds) {
        if (!activeSet.has(productId)) {
          keysToDelete.push(productId);
        }
      }

      keysToDelete.forEach(key => this.thresholds.delete(key));
      
      if (keysToDelete.length > 0) {
        logger.info(`Cleaned up thresholds for ${keysToDelete.length} inactive products`);
      }
    } catch (error) {
      logger.error('Error cleaning up inactive thresholds:', error);
      throw error;
    }
  }
}

export const priceAlertService = new PriceAlertService();