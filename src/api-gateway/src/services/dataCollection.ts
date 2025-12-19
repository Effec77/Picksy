import { ProductInfo, DataSource, TrackingResult, ErrorCode, ErrorResponse } from '../../../shared/types';
import { retailerApiService } from './retailerApi';
import { legalScraper } from './legalScraper';
import { logger } from '../utils/logger';

interface CollectionAttempt {
  method: DataSource;
  success: boolean;
  error?: string;
  timestamp: Date;
}

interface CollectionResult {
  productInfo?: ProductInfo;
  attempts: CollectionAttempt[];
  finalSource: DataSource;
  success: boolean;
  error?: ErrorResponse;
}

export class DataCollectionService {
  private failureNotifications = new Map<string, Date>();
  private readonly maxRetryAttempts = 3;
  private readonly retryDelay = 5000; // 5 seconds

  /**
   * Collect product data using API-first approach with scraping fallback
   */
  async collectProductData(url: string): Promise<CollectionResult> {
    const attempts: CollectionAttempt[] = [];
    let productInfo: ProductInfo | undefined;
    let finalSource: DataSource = DataSource.OFFICIAL_API;

    try {
      // Step 1: Identify retailer from URL
      const retailer = this.identifyRetailer(url);
      
      // Step 2: Try official API first
      try {
        logger.info(`Attempting API collection for ${retailer} from ${url}`);
        
        const apiResult = await retailerApiService.getProductInfo(url, retailer);
        productInfo = {
          ...apiResult,
          extractedAt: new Date()
        } as ProductInfo;
        
        attempts.push({
          method: DataSource.OFFICIAL_API,
          success: true,
          timestamp: new Date()
        });

        finalSource = DataSource.OFFICIAL_API;
        logger.info(`Successfully collected data via API for ${url}`);
        
      } catch (apiError) {
        logger.warn(`API collection failed for ${url}:`, apiError);
        
        attempts.push({
          method: DataSource.OFFICIAL_API,
          success: false,
          error: apiError instanceof Error ? apiError.message : 'Unknown API error',
          timestamp: new Date()
        });

        // Step 3: Fallback to legal scraping
        try {
          logger.info(`Attempting scraping fallback for ${url}`);
          
          const scrapingResult = await legalScraper.scrapeProduct(url);
          if (scrapingResult) {
            productInfo = scrapingResult as ProductInfo;
            finalSource = DataSource.LEGAL_SCRAPER;
            
            attempts.push({
              method: DataSource.LEGAL_SCRAPER,
              success: true,
              timestamp: new Date()
            });

            logger.info(`Successfully collected data via scraping for ${url}`);
          } else {
            throw new Error('Scraping returned no data');
          }
          
        } catch (scrapingError) {
          logger.error(`Scraping fallback failed for ${url}:`, scrapingError);
          
          attempts.push({
            method: DataSource.LEGAL_SCRAPER,
            success: false,
            error: scrapingError instanceof Error ? scrapingError.message : 'Unknown scraping error',
            timestamp: new Date()
          });

          // Both methods failed
          return {
            attempts,
            finalSource: DataSource.OFFICIAL_API,
            success: false,
            error: {
              code: ErrorCode.EXTERNAL_SERVICE_ERROR,
              message: 'Failed to collect product data from both API and scraping methods',
              details: { attempts }
            }
          };
        }
      }

      return {
        productInfo,
        attempts,
        finalSource,
        success: true
      };

    } catch (error) {
      logger.error(`Data collection failed for ${url}:`, error);
      
      return {
        attempts,
        finalSource: DataSource.OFFICIAL_API,
        success: false,
        error: {
          code: ErrorCode.EXTERNAL_SERVICE_ERROR,
          message: error instanceof Error ? error.message : 'Unknown collection error',
          details: { attempts }
        }
      };
    }
  }

  /**
   * Handle scraping failures with user notification
   */
  async handleScrapingFailure(url: string, error: Error): Promise<void> {
    try {
      const domain = new URL(url).hostname;
      const lastNotification = this.failureNotifications.get(domain);
      const now = new Date();

      // Only notify once per hour per domain to avoid spam
      if (!lastNotification || (now.getTime() - lastNotification.getTime()) > 3600000) {
        await this.notifyScrapingFailure(domain, error.message);
        this.failureNotifications.set(domain, now);
      }

      logger.warn(`Scraping failure handled for ${domain}: ${error.message}`);
    } catch (notificationError) {
      logger.error('Failed to handle scraping failure notification:', notificationError);
    }
  }

  /**
   * Retry data collection with exponential backoff
   */
  async retryCollection(url: string, attempt: number = 1): Promise<CollectionResult> {
    if (attempt > this.maxRetryAttempts) {
      return {
        attempts: [],
        finalSource: DataSource.OFFICIAL_API,
        success: false,
        error: {
          code: ErrorCode.EXTERNAL_SERVICE_ERROR,
          message: 'Maximum retry attempts exceeded',
          retryAfter: 300 // 5 minutes
        }
      };
    }

    // Exponential backoff delay
    const delay = this.retryDelay * Math.pow(2, attempt - 1);
    await new Promise(resolve => setTimeout(resolve, delay));

    logger.info(`Retrying data collection for ${url}, attempt ${attempt}`);
    
    try {
      const result = await this.collectProductData(url);
      if (result.success) {
        return result;
      }
      
      // If still failing, try again
      return this.retryCollection(url, attempt + 1);
    } catch (error) {
      logger.error(`Retry attempt ${attempt} failed for ${url}:`, error);
      return this.retryCollection(url, attempt + 1);
    }
  }

  /**
   * Check if a URL is supported for data collection
   */
  isSupportedUrl(url: string): boolean {
    try {
      const retailer = this.identifyRetailer(url);
      const supportedRetailers = retailerApiService.getSupportedRetailers();
      
      // Supported if we have API access OR if scraping is allowed
      return supportedRetailers.includes(retailer.toLowerCase()) || 
             this.isSupportedForScraping(url);
    } catch (error) {
      logger.error(`Error checking URL support for ${url}:`, error);
      return false;
    }
  }

  /**
   * Get collection statistics and health status
   */
  getCollectionStats(): {
    supportedRetailers: string[];
    apiStatus: Record<string, boolean>;
    scrapingStatus: boolean;
  } {
    const supportedRetailers = retailerApiService.getSupportedRetailers();
    const apiStatus: Record<string, boolean> = {};
    
    for (const retailer of supportedRetailers) {
      // This would check actual API health in a real implementation
      apiStatus[retailer] = true;
    }

    return {
      supportedRetailers,
      apiStatus,
      scrapingStatus: true // Legal scraper is always available
    };
  }

  /**
   * Identify retailer from URL
   */
  private identifyRetailer(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      const retailerMap: Record<string, string> = {
        'amazon.com': 'amazon',
        'amazon.co.uk': 'amazon',
        'amazon.ca': 'amazon',
        'amazon.de': 'amazon',
        'ebay.com': 'ebay',
        'ebay.co.uk': 'ebay',
        'walmart.com': 'walmart',
        'target.com': 'target',
        'bestbuy.com': 'bestbuy',
        'newegg.com': 'newegg'
      };

      for (const [domain, retailer] of Object.entries(retailerMap)) {
        if (hostname.includes(domain)) {
          return retailer;
        }
      }

      // Return hostname as fallback
      return hostname.replace('www.', '');
    } catch (error) {
      logger.error(`Failed to identify retailer from URL ${url}:`, error);
      return 'unknown';
    }
  }

  /**
   * Check if URL is supported for scraping
   */
  private isSupportedForScraping(url: string): boolean {
    try {
      // Basic check for common e-commerce patterns
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // List of known e-commerce domains that we can scrape
      const scrapableRetailers = [
        'amazon.com', 'ebay.com', 'walmart.com', 'target.com',
        'bestbuy.com', 'newegg.com', 'etsy.com', 'shopify.com'
      ];

      return scrapableRetailers.some(domain => hostname.includes(domain));
    } catch (error) {
      return false;
    }
  }

  /**
   * Notify users about scraping failures
   */
  private async notifyScrapingFailure(domain: string, errorMessage: string): Promise<void> {
    try {
      // This would integrate with the notification system
      // For now, just log the notification
      logger.info(`Scraping failure notification for ${domain}: ${errorMessage}`);
      
      // In a real implementation, this would:
      // 1. Find all users tracking products from this domain
      // 2. Send them a notification about the tracking issue
      // 3. Provide guidance on alternative tracking methods
    } catch (error) {
      logger.error('Failed to send scraping failure notification:', error);
    }
  }
}

export const dataCollectionService = new DataCollectionService();