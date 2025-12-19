import { ProductInfo, DataSource, AvailabilityStatus, ErrorCode } from '../../../shared/types';
import { logger } from '../utils/logger';

interface RobotsRule {
  userAgent: string;
  disallowed: string[];
  crawlDelay?: number;
}

interface DomainRateLimit {
  domain: string;
  requestsPerMinute: number;
  lastRequest: Date;
  requestCount: number;
}

export class LegalScraper {
  private robotsCache = new Map<string, RobotsRule[]>();
  private rateLimits = new Map<string, DomainRateLimit>();
  private readonly defaultCrawlDelay = 1000; // 1 second
  private readonly maxRequestsPerMinute = 30;

  /**
   * Check if we can legally scrape the given URL
   */
  async canScrape(url: string): Promise<boolean> {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      
      // Check robots.txt compliance
      const robotsRules = await this.getRobotsRules(domain);
      const isAllowed = this.checkRobotsCompliance(url, robotsRules);
      
      if (!isAllowed) {
        logger.warn(`Scraping not allowed by robots.txt for ${url}`);
        return false;
      }

      // Check rate limits
      const canMakeRequest = this.checkRateLimit(domain);
      if (!canMakeRequest) {
        logger.warn(`Rate limit exceeded for domain ${domain}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking scraping permissions:', error);
      return false;
    }
  }

  /**
   * Scrape product information from URL with legal compliance
   */
  async scrapeProduct(url: string): Promise<ProductInfo | null> {
    try {
      // Check if scraping is allowed
      const canScrapeUrl = await this.canScrape(url);
      if (!canScrapeUrl) {
        throw new Error(`Scraping not permitted for ${url}`);
      }

      // Apply rate limiting delay
      await this.applyRateLimit(url);

      // Perform the actual scraping
      const productInfo = await this.performScraping(url);
      
      if (productInfo) {
        // Update rate limit tracking
        this.updateRateLimit(new URL(url).hostname);
        
        logger.info(`Successfully scraped product from ${url}`);
        return {
          id: productInfo.id || this.generateProductId(url),
          title: productInfo.title || 'Unknown Product',
          retailer: productInfo.retailer || 'Unknown Retailer',
          category: productInfo.category || 'Unknown Category',
          brand: productInfo.brand,
          model: productInfo.model,
          imageUrl: productInfo.imageUrl,
          extractedAt: new Date(),
          url: url
        };
      }

      return null;
    } catch (error) {
      logger.error(`Failed to scrape product from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Get rate limit for a specific domain
   */
  getRateLimit(domain: string): number {
    const rateLimit = this.rateLimits.get(domain);
    return rateLimit?.requestsPerMinute || this.maxRequestsPerMinute;
  }

  /**
   * Fetch and parse robots.txt for a domain
   */
  private async getRobotsRules(domain: string): Promise<RobotsRule[]> {
    if (this.robotsCache.has(domain)) {
      return this.robotsCache.get(domain)!;
    }

    try {
      const robotsUrl = `https://${domain}/robots.txt`;
      const response = await fetch(robotsUrl, {
        headers: {
          'User-Agent': 'Picksy-Bot/1.0 (Price Tracking Service; +https://picksy.com/bot)'
        }
      });

      if (!response.ok) {
        // If robots.txt doesn't exist, assume scraping is allowed with default limits
        const defaultRules: RobotsRule[] = [{
          userAgent: '*',
          disallowed: [],
          crawlDelay: this.defaultCrawlDelay / 1000
        }];
        this.robotsCache.set(domain, defaultRules);
        return defaultRules;
      }

      const robotsText = await response.text();
      const rules = this.parseRobotsText(robotsText);
      
      this.robotsCache.set(domain, rules);
      return rules;
    } catch (error) {
      logger.error(`Failed to fetch robots.txt for ${domain}:`, error);
      // Return permissive default rules on error
      const defaultRules: RobotsRule[] = [{
        userAgent: '*',
        disallowed: [],
        crawlDelay: this.defaultCrawlDelay / 1000
      }];
      this.robotsCache.set(domain, defaultRules);
      return defaultRules;
    }
  }

  /**
   * Parse robots.txt content into structured rules
   */
  private parseRobotsText(robotsText: string): RobotsRule[] {
    const rules: RobotsRule[] = [];
    const lines = robotsText.split('\n').map(line => line.trim());
    
    let currentRule: Partial<RobotsRule> | null = null;

    for (const line of lines) {
      if (line.startsWith('#') || line === '') {
        continue; // Skip comments and empty lines
      }

      const [directive, value] = line.split(':').map(part => part.trim());

      switch (directive.toLowerCase()) {
        case 'user-agent':
          if (currentRule) {
            rules.push(currentRule as RobotsRule);
          }
          currentRule = {
            userAgent: value,
            disallowed: []
          };
          break;
        
        case 'disallow':
          if (currentRule && value) {
            currentRule.disallowed!.push(value);
          }
          break;
        
        case 'crawl-delay':
          if (currentRule) {
            currentRule.crawlDelay = parseInt(value) || this.defaultCrawlDelay / 1000;
          }
          break;
      }
    }

    if (currentRule) {
      rules.push(currentRule as RobotsRule);
    }

    return rules;
  }

  /**
   * Check if URL is allowed by robots.txt rules
   */
  private checkRobotsCompliance(url: string, rules: RobotsRule[]): boolean {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Find applicable rules (check for our user agent first, then *)
    const applicableRules = rules.filter(rule => 
      rule.userAgent === 'Picksy-Bot' || 
      rule.userAgent === '*'
    );

    if (applicableRules.length === 0) {
      return true; // No rules means allowed
    }

    // Check if path is disallowed
    for (const rule of applicableRules) {
      for (const disallowedPath of rule.disallowed) {
        if (path.startsWith(disallowedPath)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if we can make a request to domain based on rate limits
   */
  private checkRateLimit(domain: string): boolean {
    const now = new Date();
    const rateLimit = this.rateLimits.get(domain);

    if (!rateLimit) {
      return true; // No previous requests
    }

    const timeDiff = now.getTime() - rateLimit.lastRequest.getTime();
    const minutesPassed = timeDiff / (1000 * 60);

    if (minutesPassed >= 1) {
      // Reset counter if a minute has passed
      rateLimit.requestCount = 0;
      return true;
    }

    return rateLimit.requestCount < rateLimit.requestsPerMinute;
  }

  /**
   * Apply rate limiting delay before making request
   */
  private async applyRateLimit(url: string): Promise<void> {
    const domain = new URL(url).hostname;
    const robotsRules = await this.getRobotsRules(domain);
    
    // Find crawl delay from robots.txt
    let crawlDelay = this.defaultCrawlDelay;
    for (const rule of robotsRules) {
      if ((rule.userAgent === 'Picksy-Bot' || rule.userAgent === '*') && rule.crawlDelay) {
        crawlDelay = rule.crawlDelay * 1000; // Convert to milliseconds
        break;
      }
    }

    // Wait for the crawl delay
    await new Promise(resolve => setTimeout(resolve, crawlDelay));
  }

  /**
   * Update rate limit tracking after successful request
   */
  private updateRateLimit(domain: string): void {
    const now = new Date();
    const existing = this.rateLimits.get(domain);

    if (!existing) {
      this.rateLimits.set(domain, {
        domain,
        requestsPerMinute: this.maxRequestsPerMinute,
        lastRequest: now,
        requestCount: 1
      });
    } else {
      const timeDiff = now.getTime() - existing.lastRequest.getTime();
      const minutesPassed = timeDiff / (1000 * 60);

      if (minutesPassed >= 1) {
        existing.requestCount = 1;
      } else {
        existing.requestCount++;
      }
      existing.lastRequest = now;
    }
  }

  /**
   * Perform actual scraping of product information
   */
  private async performScraping(url: string): Promise<Partial<ProductInfo> | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Picksy-Bot/1.0 (Price Tracking Service; +https://picksy.com/bot)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return this.extractProductInfo(html, url);
    } catch (error) {
      logger.error(`Scraping failed for ${url}:`, error);
      return null;
    }
  }

  /**
   * Extract product information from HTML content
   */
  private extractProductInfo(html: string, url: string): Partial<ProductInfo> | null {
    try {
      const urlObj = new URL(url);
      const retailer = this.identifyRetailer(urlObj.hostname);
      
      // Basic extraction using common meta tags and structured data
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // Try to extract price using common patterns
      const pricePatterns = [
        /\$[\d,]+\.?\d*/g,
        /price[^>]*>[\s]*\$?([\d,]+\.?\d*)/gi,
        /cost[^>]*>[\s]*\$?([\d,]+\.?\d*)/gi
      ];

      // Try to extract image
      const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
      const imageUrl = imageMatch ? imageMatch[1] : undefined;

      if (!title) {
        return null; // Must have at least a title
      }

      return {
        id: this.generateProductId(url),
        title: this.cleanTitle(title),
        retailer,
        category: 'unknown', // Would need more sophisticated extraction
        imageUrl,
        url
      };
    } catch (error) {
      logger.error('Failed to extract product info:', error);
      return null;
    }
  }

  /**
   * Identify retailer from hostname
   */
  private identifyRetailer(hostname: string): string {
    const retailerMap: Record<string, string> = {
      'amazon.com': 'Amazon',
      'amazon.co.uk': 'Amazon UK',
      'ebay.com': 'eBay',
      'walmart.com': 'Walmart',
      'target.com': 'Target',
      'bestbuy.com': 'Best Buy',
      'newegg.com': 'Newegg'
    };

    for (const [domain, retailer] of Object.entries(retailerMap)) {
      if (hostname.includes(domain)) {
        return retailer;
      }
    }

    return hostname; // Use hostname as fallback
  }

  /**
   * Generate unique product ID from URL
   */
  private generateProductId(url: string): string {
    // Simple hash-based ID generation
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `product_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Clean and normalize product title
   */
  private cleanTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .substring(0, 200); // Limit length
  }
}

export const legalScraper = new LegalScraper();