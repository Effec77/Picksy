import { 
  TrackedProduct, 
  PricePoint, 
  PriceHistory, 
  AvailabilityStatus,
  DataSource,
  ErrorResponse,
  ErrorCode
} from '../../../shared/types';
import { logger } from '../utils/logger';

export interface OfflineModeConfig {
  enabled: boolean;
  maxCacheAge: number; // milliseconds
  fallbackDataRetention: number; // milliseconds
  limitedFeatures: string[];
}

export interface CachedData {
  products: Map<string, TrackedProduct>;
  prices: Map<string, PricePoint[]>;
  lastUpdated: Map<string, Date>;
}

/**
 * Offline mode service that provides limited functionality when external services are unavailable
 */
export class OfflineModeService {
  private config: OfflineModeConfig;
  private cachedData: CachedData;
  private isOfflineMode = false;

  constructor(config: OfflineModeConfig) {
    this.config = config;
    this.cachedData = {
      products: new Map(),
      prices: new Map(),
      lastUpdated: new Map()
    };
  }

  /**
   * Enable offline mode
   */
  enableOfflineMode(): void {
    if (!this.isOfflineMode) {
      this.isOfflineMode = true;
      logger.warn('Offline mode enabled - limited functionality available');
    }
  }

  /**
   * Disable offline mode
   */
  disableOfflineMode(): void {
    if (this.isOfflineMode) {
      this.isOfflineMode = false;
      logger.info('Offline mode disabled - full functionality restored');
    }
  }

  /**
   * Check if currently in offline mode
   */
  isOffline(): boolean {
    return this.isOfflineMode;
  }

  /**
   * Cache product data for offline access
   */
  cacheProduct(product: TrackedProduct): void {
    try {
      this.cachedData.products.set(product.id, { ...product });
      this.cachedData.lastUpdated.set(`product_${product.id}`, new Date());
      
      logger.debug(`Cached product data for ${product.id}`);
    } catch (error) {
      logger.error(`Error caching product ${product.id}:`, error);
    }
  }

  /**
   * Cache price data for offline access
   */
  cachePriceData(productId: string, prices: PricePoint[]): void {
    try {
      this.cachedData.prices.set(productId, [...prices]);
      this.cachedData.lastUpdated.set(`prices_${productId}`, new Date());
      
      logger.debug(`Cached price data for product ${productId}`);
    } catch (error) {
      logger.error(`Error caching prices for product ${productId}:`, error);
    }
  }

  /**
   * Get cached product data
   */
  getCachedProduct(productId: string): TrackedProduct | null {
    try {
      const product = this.cachedData.products.get(productId);
      if (!product) {
        return null;
      }

      const lastUpdated = this.cachedData.lastUpdated.get(`product_${productId}`);
      if (!lastUpdated || this.isCacheExpired(lastUpdated)) {
        logger.warn(`Cached product data for ${productId} is expired`);
        return null;
      }

      return product;
    } catch (error) {
      logger.error(`Error retrieving cached product ${productId}:`, error);
      return null;
    }
  }

  /**
   * Get cached price data
   */
  getCachedPrices(productId: string): PricePoint[] | null {
    try {
      const prices = this.cachedData.prices.get(productId);
      if (!prices) {
        return null;
      }

      const lastUpdated = this.cachedData.lastUpdated.get(`prices_${productId}`);
      if (!lastUpdated || this.isCacheExpired(lastUpdated)) {
        logger.warn(`Cached price data for ${productId} is expired`);
        return null;
      }

      return prices;
    } catch (error) {
      logger.error(`Error retrieving cached prices for product ${productId}:`, error);
      return null;
    }
  }

  /**
   * Get cached price history with staleness indicator
   */
  getCachedPriceHistory(productId: string): PriceHistory | null {
    try {
      const prices = this.getCachedPrices(productId);
      if (!prices || prices.length === 0) {
        return null;
      }

      // Calculate basic statistics from cached data
      const priceValues = prices.map(p => p.price);
      const statistics = {
        average: priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length,
        minimum: Math.min(...priceValues),
        maximum: Math.max(...priceValues),
        trend: this.calculateTrend(prices) as any,
        volatility: this.calculateVolatility(priceValues)
      };

      return {
        productId,
        points: prices,
        statistics
      };
    } catch (error) {
      logger.error(`Error creating cached price history for product ${productId}:`, error);
      return null;
    }
  }

  /**
   * Get offline mode status and available features
   */
  getOfflineStatus(): {
    isOffline: boolean;
    availableFeatures: string[];
    unavailableFeatures: string[];
    cacheStats: {
      products: number;
      priceHistories: number;
      oldestCache: Date | null;
    };
  } {
    const availableFeatures = [
      'View cached products',
      'View cached price history',
      'Basic product management',
      'Offline notifications'
    ];

    const unavailableFeatures = this.isOfflineMode ? [
      'Real-time price updates',
      'New product tracking',
      'External price comparisons',
      'Live notifications',
      'Account synchronization'
    ] : [];

    // Calculate cache statistics
    let oldestCache: Date | null = null;
    for (const date of this.cachedData.lastUpdated.values()) {
      if (!oldestCache || date < oldestCache) {
        oldestCache = date;
      }
    }

    return {
      isOffline: this.isOfflineMode,
      availableFeatures,
      unavailableFeatures,
      cacheStats: {
        products: this.cachedData.products.size,
        priceHistories: this.cachedData.prices.size,
        oldestCache
      }
    };
  }

  /**
   * Create offline error response
   */
  createOfflineError(feature: string): ErrorResponse {
    return {
      code: ErrorCode.EXTERNAL_SERVICE_ERROR,
      message: `${feature} is not available in offline mode`,
      details: {
        offlineMode: true,
        availableFeatures: this.getOfflineStatus().availableFeatures
      },
      supportContact: 'Please check your internet connection and try again'
    };
  }

  /**
   * Attempt to provide fallback data when service is unavailable
   */
  async getFallbackData<T>(
    operation: string,
    fallbackProvider: () => T | null
  ): Promise<T | ErrorResponse> {
    try {
      if (!this.isOfflineMode) {
        return this.createOfflineError(operation);
      }

      const fallbackData = fallbackProvider();
      if (fallbackData === null) {
        return {
          code: ErrorCode.EXTERNAL_SERVICE_ERROR,
          message: `No cached data available for ${operation}`,
          details: { offlineMode: true },
          supportContact: 'Data will be available once connection is restored'
        };
      }

      return fallbackData;
    } catch (error) {
      logger.error(`Error providing fallback data for ${operation}:`, error);
      return {
        code: ErrorCode.EXTERNAL_SERVICE_ERROR,
        message: `Failed to provide fallback data for ${operation}`,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Clean up expired cache data
   */
  cleanupExpiredCache(): void {
    try {
      let cleanedCount = 0;
      const now = new Date();

      // Clean up expired products
      for (const [productId] of this.cachedData.products) {
        const lastUpdated = this.cachedData.lastUpdated.get(`product_${productId}`);
        if (lastUpdated && this.isCacheExpired(lastUpdated)) {
          this.cachedData.products.delete(productId);
          this.cachedData.lastUpdated.delete(`product_${productId}`);
          cleanedCount++;
        }
      }

      // Clean up expired prices
      for (const [productId] of this.cachedData.prices) {
        const lastUpdated = this.cachedData.lastUpdated.get(`prices_${productId}`);
        if (lastUpdated && this.isCacheExpired(lastUpdated)) {
          this.cachedData.prices.delete(productId);
          this.cachedData.lastUpdated.delete(`prices_${productId}`);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} expired cache entries`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired cache:', error);
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isCacheExpired(lastUpdated: Date): boolean {
    const age = Date.now() - lastUpdated.getTime();
    return age > this.config.maxCacheAge;
  }

  /**
   * Calculate price trend from historical data
   */
  private calculateTrend(prices: PricePoint[]): 'increasing' | 'decreasing' | 'stable' | 'volatile' {
    if (prices.length < 2) return 'stable';

    const sortedPrices = [...prices].sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime());
    const first = sortedPrices[0].price;
    const last = sortedPrices[sortedPrices.length - 1].price;
    const change = (last - first) / first;

    if (Math.abs(change) < 0.05) return 'stable'; // Less than 5% change
    if (change > 0.05) return 'increasing';
    if (change < -0.05) return 'decreasing';
    
    return 'volatile';
  }

  /**
   * Calculate price volatility
   */
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  /**
   * Get cache age for a specific item
   */
  getCacheAge(key: string): number | null {
    const lastUpdated = this.cachedData.lastUpdated.get(key);
    if (!lastUpdated) return null;
    
    return Date.now() - lastUpdated.getTime();
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cachedData.products.clear();
    this.cachedData.prices.clear();
    this.cachedData.lastUpdated.clear();
    
    logger.info('Cleared all cached data');
  }
}