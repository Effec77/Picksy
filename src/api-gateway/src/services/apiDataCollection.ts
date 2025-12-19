import { ProductInfo, TrackingResult, DataSource, ErrorCode, ErrorResponse } from '../../../shared/types';
import { dataCollectionService } from './dataCollection';
import { productMatchingService } from './productMatching';
import { retailerApiService } from './retailerApi';
import { legalScraper } from './legalScraper';
import { logger } from '../utils/logger';

interface CollectionOptions {
  enableDeduplication?: boolean;
  enableRetry?: boolean;
  maxRetryAttempts?: number;
  preferredSource?: DataSource;
}

interface CollectionMetrics {
  totalRequests: number;
  apiSuccessRate: number;
  scrapingSuccessRate: number;
  averageResponseTime: number;
  lastUpdated: Date;
}

export class ApiDataCollectionService {
  private metrics: CollectionMetrics = {
    totalRequests: 0,
    apiSuccessRate: 0,
    scrapingSuccessRate: 0,
    averageResponseTime: 0,
    lastUpdated: new Date()
  };

  private requestTimes: number[] = [];
  private readonly maxMetricsHistory = 1000;

  /**
   * Main entry point for API-first data collection
   */
  async collectProductData(
    url: string, 
    options: CollectionOptions = {}
  ): Promise<TrackingResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting API-first data collection for ${url}`);
      
      // Validate URL
      if (!this.isValidUrl(url)) {
        return {
          success: false,
          error: 'Invalid URL provided'
        };
      }

      // Check if URL is supported
      if (!dataCollectionService.isSupportedUrl(url)) {
        return {
          success: false,
          error: 'Unsupported retailer or URL format'
        };
      }

      // Collect data using API-first approach
      const collectionResult = await dataCollectionService.collectProductData(url);
      
      if (!collectionResult.success || !collectionResult.productInfo) {
        // Handle retry if enabled
        if (options.enableRetry) {
          logger.info(`Retrying data collection for ${url}`);
          const retryResult = await dataCollectionService.retryCollection(
            url, 
            options.maxRetryAttempts || 3
          );
          
          if (retryResult.success && retryResult.productInfo) {
            return await this.processSuccessfulCollection(
              retryResult.productInfo, 
              retryResult.finalSource,
              options,
              startTime
            );
          }
        }

        return {
          success: false,
          error: collectionResult.error?.message || 'Data collection failed'
        };
      }

      return await this.processSuccessfulCollection(
        collectionResult.productInfo,
        collectionResult.finalSource,
        options,
        startTime
      );

    } catch (error) {
      logger.error(`API data collection failed for ${url}:`, error);
      this.updateMetrics(startTime, false);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Batch collect multiple products
   */
  async batchCollectProducts(
    urls: string[], 
    options: CollectionOptions = {}
  ): Promise<TrackingResult[]> {
    try {
      logger.info(`Starting batch collection for ${urls.length} URLs`);
      
      const results: TrackingResult[] = [];
      const batchSize = 5; // Process in batches to avoid overwhelming APIs
      
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const batchPromises = batch.map(url => 
          this.collectProductData(url, options)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              error: result.reason?.message || 'Batch processing failed'
            });
          }
        }

        // Add delay between batches to respect rate limits
        if (i + batchSize < urls.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      logger.info(`Batch collection completed: ${results.filter(r => r.success).length}/${urls.length} successful`);
      return results;
    } catch (error) {
      logger.error('Batch collection failed:', error);
      throw error;
    }
  }

  /**
   * Get collection health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: CollectionMetrics;
    supportedRetailers: string[];
    issues: string[];
  } {
    const stats = dataCollectionService.getCollectionStats();
    const issues: string[] = [];
    
    // Check API availability
    const unavailableApis = Object.entries(stats.apiStatus)
      .filter(([_, available]) => !available)
      .map(([retailer]) => retailer);
    
    if (unavailableApis.length > 0) {
      issues.push(`APIs unavailable: ${unavailableApis.join(', ')}`);
    }

    // Check scraping status
    if (!stats.scrapingStatus) {
      issues.push('Legal scraping service unavailable');
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (issues.length === 0) {
      status = 'healthy';
    } else if (stats.supportedRetailers.length > 0 || stats.scrapingStatus) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      metrics: this.metrics,
      supportedRetailers: stats.supportedRetailers,
      issues
    };
  }

  /**
   * Get supported retailers and their capabilities
   */
  getSupportedRetailers(): Array<{
    name: string;
    hasApi: boolean;
    canScrape: boolean;
    rateLimit: number;
  }> {
    const apiRetailers = retailerApiService.getSupportedRetailers();
    const allRetailers = [
      'amazon', 'ebay', 'walmart', 'target', 'bestbuy', 'newegg'
    ];

    return allRetailers.map(retailer => ({
      name: retailer,
      hasApi: apiRetailers.includes(retailer),
      canScrape: true, // Legal scraper supports all major retailers
      rateLimit: legalScraper.getRateLimit(retailer)
    }));
  }

  /**
   * Process successful data collection
   */
  private async processSuccessfulCollection(
    productInfo: ProductInfo,
    source: DataSource,
    options: CollectionOptions,
    startTime: number
  ): Promise<TrackingResult> {
    try {
      let finalProductInfo = productInfo;

      // Apply deduplication if enabled
      if (options.enableDeduplication) {
        // This would integrate with existing product database
        // For now, just normalize the product
        const normalized = productMatchingService.normalizeProduct(productInfo);
        finalProductInfo = normalized.originalProduct;
      }

      this.updateMetrics(startTime, true, source);

      logger.info(`Successfully collected product data: ${finalProductInfo.id} from ${source}`);

      return {
        success: true,
        productId: finalProductInfo.id,
        estimatedNextCheck: this.calculateNextCheckTime(source)
      };
    } catch (error) {
      logger.error('Error processing successful collection:', error);
      throw error;
    }
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate next check time based on data source
   */
  private calculateNextCheckTime(source: DataSource): Date {
    const now = new Date();
    let intervalMinutes: number;

    switch (source) {
      case DataSource.OFFICIAL_API:
        intervalMinutes = 60; // Check every hour for API sources
        break;
      case DataSource.LEGAL_SCRAPER:
        intervalMinutes = 240; // Check every 4 hours for scraped sources
        break;
      default:
        intervalMinutes = 120; // Default 2 hours
    }

    return new Date(now.getTime() + intervalMinutes * 60 * 1000);
  }

  /**
   * Update collection metrics
   */
  private updateMetrics(startTime: number, success: boolean, source?: DataSource): void {
    const responseTime = Date.now() - startTime;
    
    this.requestTimes.push(responseTime);
    if (this.requestTimes.length > this.maxMetricsHistory) {
      this.requestTimes.shift();
    }

    this.metrics.totalRequests++;
    this.metrics.averageResponseTime = 
      this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length;
    
    // Update success rates (simplified calculation)
    if (source === DataSource.OFFICIAL_API) {
      // Update API success rate
      this.metrics.apiSuccessRate = success ? 
        Math.min(this.metrics.apiSuccessRate + 0.01, 1.0) :
        Math.max(this.metrics.apiSuccessRate - 0.01, 0.0);
    } else if (source === DataSource.LEGAL_SCRAPER) {
      // Update scraping success rate
      this.metrics.scrapingSuccessRate = success ?
        Math.min(this.metrics.scrapingSuccessRate + 0.01, 1.0) :
        Math.max(this.metrics.scrapingSuccessRate - 0.01, 0.0);
    }

    this.metrics.lastUpdated = new Date();
  }
}

export const apiDataCollectionService = new ApiDataCollectionService();