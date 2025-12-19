import { ProductInfo, DataSource, AvailabilityStatus, ErrorCode } from '../../../shared/types';
import { logger } from '../utils/logger';

interface ApiCredentials {
  apiKey: string;
  secretKey?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

interface RetailerConfig {
  name: string;
  baseUrl: string;
  credentials: ApiCredentials;
  rateLimit: number; // requests per minute
  isActive: boolean;
}

interface ApiKeyRotation {
  retailer: string;
  keys: ApiCredentials[];
  currentIndex: number;
  lastRotation: Date;
}

export class RetailerApiService {
  private retailers = new Map<string, RetailerConfig>();
  private keyRotations = new Map<string, ApiKeyRotation>();
  private requestCounts = new Map<string, { count: number; resetTime: Date }>();

  constructor() {
    this.initializeRetailers();
  }

  /**
   * Get product information using official retailer API
   */
  async getProductInfo(url: string, retailer: string): Promise<ProductInfo> {
    try {
      const config = this.retailers.get(retailer.toLowerCase());
      if (!config || !config.isActive) {
        throw new Error(`Retailer API not available: ${retailer}`);
      }

      // Check rate limits
      await this.checkRateLimit(retailer);

      // Get current API credentials
      const credentials = await this.getCurrentCredentials(retailer);

      // Make API request based on retailer
      const productInfo = await this.makeApiRequest(url, retailer, credentials);
      
      // Update request count
      this.updateRequestCount(retailer);

      return {
        id: productInfo.id || `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: productInfo.title || 'Unknown Product',
        retailer: productInfo.retailer || 'Unknown Retailer',
        category: productInfo.category || 'Unknown Category',
        brand: productInfo.brand,
        model: productInfo.model,
        imageUrl: productInfo.imageUrl,
        extractedAt: new Date(),
        url: url
      };
    } catch (error) {
      logger.error(`Failed to get product info from ${retailer} API:`, error);
      throw error;
    }
  }

  /**
   * Check product availability using retailer API
   */
  async checkAvailability(productId: string): Promise<AvailabilityStatus> {
    try {
      // This would be implemented based on specific retailer APIs
      // For now, return a placeholder
      return AvailabilityStatus.UNKNOWN;
    } catch (error) {
      logger.error(`Failed to check availability for product ${productId}:`, error);
      return AvailabilityStatus.UNKNOWN;
    }
  }

  /**
   * Add or update retailer configuration
   */
  addRetailer(config: RetailerConfig): void {
    this.retailers.set(config.name.toLowerCase(), config);
    logger.info(`Added retailer configuration: ${config.name}`);
  }

  /**
   * Get list of supported retailers
   */
  getSupportedRetailers(): string[] {
    return Array.from(this.retailers.keys()).filter(
      retailer => this.retailers.get(retailer)?.isActive
    );
  }

  /**
   * Rotate API keys for a retailer
   */
  async rotateApiKeys(retailer: string): Promise<void> {
    try {
      const rotation = this.keyRotations.get(retailer.toLowerCase());
      if (!rotation || rotation.keys.length <= 1) {
        logger.warn(`No key rotation available for retailer: ${retailer}`);
        return;
      }

      // Move to next key
      rotation.currentIndex = (rotation.currentIndex + 1) % rotation.keys.length;
      rotation.lastRotation = new Date();

      // Update retailer config with new credentials
      const config = this.retailers.get(retailer.toLowerCase());
      if (config) {
        config.credentials = rotation.keys[rotation.currentIndex];
        logger.info(`Rotated API keys for retailer: ${retailer}`);
      }
    } catch (error) {
      logger.error(`Failed to rotate API keys for ${retailer}:`, error);
      throw error;
    }
  }

  /**
   * Initialize retailer configurations
   */
  private initializeRetailers(): void {
    // Amazon Product Advertising API
    this.addRetailer({
      name: 'amazon',
      baseUrl: 'https://webservices.amazon.com/paapi5',
      credentials: {
        apiKey: process.env.AMAZON_API_KEY || '',
        secretKey: process.env.AMAZON_SECRET_KEY || '',
        accessToken: process.env.AMAZON_ACCESS_TOKEN || ''
      },
      rateLimit: 8640, // 1 request per 10 seconds
      isActive: !!(process.env.AMAZON_API_KEY && process.env.AMAZON_SECRET_KEY)
    });

    // eBay API
    this.addRetailer({
      name: 'ebay',
      baseUrl: 'https://api.ebay.com',
      credentials: {
        apiKey: process.env.EBAY_API_KEY || '',
        accessToken: process.env.EBAY_ACCESS_TOKEN || ''
      },
      rateLimit: 5000, // 5000 requests per day
      isActive: !!(process.env.EBAY_API_KEY)
    });

    // Walmart API
    this.addRetailer({
      name: 'walmart',
      baseUrl: 'https://developer.api.walmart.com',
      credentials: {
        apiKey: process.env.WALMART_API_KEY || ''
      },
      rateLimit: 60, // 60 requests per minute
      isActive: !!(process.env.WALMART_API_KEY)
    });

    // Best Buy API
    this.addRetailer({
      name: 'bestbuy',
      baseUrl: 'https://api.bestbuy.com',
      credentials: {
        apiKey: process.env.BESTBUY_API_KEY || ''
      },
      rateLimit: 60, // 60 requests per minute
      isActive: !!(process.env.BESTBUY_API_KEY)
    });
  }

  /**
   * Check if we can make a request within rate limits
   */
  private async checkRateLimit(retailer: string): Promise<void> {
    const config = this.retailers.get(retailer.toLowerCase());
    if (!config) {
      throw new Error(`Unknown retailer: ${retailer}`);
    }

    const now = new Date();
    const requestData = this.requestCounts.get(retailer.toLowerCase());

    if (!requestData) {
      return; // No previous requests
    }

    const timeDiff = now.getTime() - requestData.resetTime.getTime();
    const minutesPassed = timeDiff / (1000 * 60);

    if (minutesPassed < 1 && requestData.count >= config.rateLimit) {
      const waitTime = (1 - minutesPassed) * 60 * 1000;
      logger.warn(`Rate limit exceeded for ${retailer}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Get current API credentials with rotation support
   */
  private async getCurrentCredentials(retailer: string): Promise<ApiCredentials> {
    const config = this.retailers.get(retailer.toLowerCase());
    if (!config) {
      throw new Error(`Unknown retailer: ${retailer}`);
    }

    // Check if credentials need refresh
    if (config.credentials.expiresAt && config.credentials.expiresAt < new Date()) {
      await this.refreshCredentials(retailer);
    }

    return config.credentials;
  }

  /**
   * Refresh expired credentials
   */
  private async refreshCredentials(retailer: string): Promise<void> {
    const config = this.retailers.get(retailer.toLowerCase());
    if (!config || !config.credentials.refreshToken) {
      throw new Error(`Cannot refresh credentials for ${retailer}`);
    }

    try {
      // Implementation would depend on specific retailer's OAuth flow
      // This is a placeholder for the refresh logic
      logger.info(`Refreshing credentials for ${retailer}`);
      
      // Update expiration time
      config.credentials.expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
    } catch (error) {
      logger.error(`Failed to refresh credentials for ${retailer}:`, error);
      throw error;
    }
  }

  /**
   * Make API request to specific retailer
   */
  private async makeApiRequest(
    url: string, 
    retailer: string, 
    credentials: ApiCredentials
  ): Promise<Partial<ProductInfo>> {
    switch (retailer.toLowerCase()) {
      case 'amazon':
        return this.makeAmazonApiRequest(url, credentials);
      case 'ebay':
        return this.makeEbayApiRequest(url, credentials);
      case 'walmart':
        return this.makeWalmartApiRequest(url, credentials);
      case 'bestbuy':
        return this.makeBestBuyApiRequest(url, credentials);
      default:
        throw new Error(`API implementation not available for ${retailer}`);
    }
  }

  /**
   * Amazon Product Advertising API request
   */
  private async makeAmazonApiRequest(
    url: string, 
    credentials: ApiCredentials
  ): Promise<Partial<ProductInfo>> {
    try {
      // Extract ASIN from URL
      const asinMatch = url.match(/\/([A-Z0-9]{10})\//);
      if (!asinMatch) {
        throw new Error('Could not extract ASIN from Amazon URL');
      }

      const asin = asinMatch[1];
      
      // This would use the actual Amazon PA API
      // For now, return a placeholder structure
      return {
        id: `amazon_${asin}`,
        title: 'Product from Amazon API',
        retailer: 'Amazon',
        category: 'unknown'
      };
    } catch (error) {
      logger.error('Amazon API request failed:', error);
      throw error;
    }
  }

  /**
   * eBay API request
   */
  private async makeEbayApiRequest(
    url: string, 
    credentials: ApiCredentials
  ): Promise<Partial<ProductInfo>> {
    try {
      // Extract item ID from eBay URL
      const itemMatch = url.match(/\/itm\/([^?\/]+)/);
      if (!itemMatch) {
        throw new Error('Could not extract item ID from eBay URL');
      }

      const itemId = itemMatch[1];
      
      // Placeholder for eBay API implementation
      return {
        id: `ebay_${itemId}`,
        title: 'Product from eBay API',
        retailer: 'eBay',
        category: 'unknown'
      };
    } catch (error) {
      logger.error('eBay API request failed:', error);
      throw error;
    }
  }

  /**
   * Walmart API request
   */
  private async makeWalmartApiRequest(
    url: string, 
    credentials: ApiCredentials
  ): Promise<Partial<ProductInfo>> {
    try {
      // Extract product ID from Walmart URL
      const productMatch = url.match(/\/ip\/[^\/]+\/(\d+)/);
      if (!productMatch) {
        throw new Error('Could not extract product ID from Walmart URL');
      }

      const productId = productMatch[1];
      
      // Placeholder for Walmart API implementation
      return {
        id: `walmart_${productId}`,
        title: 'Product from Walmart API',
        retailer: 'Walmart',
        category: 'unknown'
      };
    } catch (error) {
      logger.error('Walmart API request failed:', error);
      throw error;
    }
  }

  /**
   * Best Buy API request
   */
  private async makeBestBuyApiRequest(
    url: string, 
    credentials: ApiCredentials
  ): Promise<Partial<ProductInfo>> {
    try {
      // Extract SKU from Best Buy URL
      const skuMatch = url.match(/\/(\d+)\.p/);
      if (!skuMatch) {
        throw new Error('Could not extract SKU from Best Buy URL');
      }

      const sku = skuMatch[1];
      
      // Placeholder for Best Buy API implementation
      return {
        id: `bestbuy_${sku}`,
        title: 'Product from Best Buy API',
        retailer: 'Best Buy',
        category: 'unknown'
      };
    } catch (error) {
      logger.error('Best Buy API request failed:', error);
      throw error;
    }
  }

  /**
   * Update request count for rate limiting
   */
  private updateRequestCount(retailer: string): void {
    const now = new Date();
    const existing = this.requestCounts.get(retailer.toLowerCase());

    if (!existing) {
      this.requestCounts.set(retailer.toLowerCase(), {
        count: 1,
        resetTime: now
      });
    } else {
      const timeDiff = now.getTime() - existing.resetTime.getTime();
      const minutesPassed = timeDiff / (1000 * 60);

      if (minutesPassed >= 1) {
        existing.count = 1;
        existing.resetTime = now;
      } else {
        existing.count++;
      }
    }
  }
}

export const retailerApiService = new RetailerApiService();