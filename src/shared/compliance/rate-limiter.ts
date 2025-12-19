/**
 * Rate limiting system for legal compliance
 * Ensures respectful scraping with configurable limits per domain
 */

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  minDelayMs: number;
  maxConcurrent: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  retryAfterMs?: number;
  remainingRequests: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
  reason?: string;
}

interface RequestRecord {
  timestamp: number;
  domain: string;
}

export class RateLimiter {
  private requestHistory = new Map<string, RequestRecord[]>();
  private activeRequests = new Map<string, number>();
  private domainConfigs = new Map<string, RateLimitConfig>();
  
  // Default conservative limits
  private readonly DEFAULT_CONFIG: RateLimitConfig = {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    requestsPerDay: 1000,
    minDelayMs: 1000, // 1 second minimum delay
    maxConcurrent: 2
  };

  // Stricter limits for e-commerce sites
  private readonly ECOMMERCE_CONFIG: RateLimitConfig = {
    requestsPerMinute: 5,
    requestsPerHour: 50,
    requestsPerDay: 500,
    minDelayMs: 2000, // 2 second minimum delay
    maxConcurrent: 1
  };

  constructor() {
    // Set up known e-commerce domains with stricter limits
    const ecommerceDomains = [
      'amazon.com', 'ebay.com', 'walmart.com', 'target.com',
      'bestbuy.com', 'homedepot.com', 'lowes.com', 'costco.com',
      'etsy.com', 'shopify.com', 'alibaba.com', 'aliexpress.com'
    ];

    ecommerceDomains.forEach(domain => {
      this.domainConfigs.set(domain, { ...this.ECOMMERCE_CONFIG });
    });

    // Clean up old records periodically
    setInterval(() => this.cleanupOldRecords(), 60000); // Every minute
  }

  /**
   * Check if a request to the given URL is allowed
   */
  async checkRateLimit(url: string): Promise<RateLimitStatus> {
    const domain = this.extractDomain(url);
    const config = this.getConfigForDomain(domain);
    
    // Check concurrent requests
    const concurrent = this.activeRequests.get(domain) || 0;
    if (concurrent >= config.maxConcurrent) {
      return {
        allowed: false,
        retryAfterMs: config.minDelayMs,
        remainingRequests: this.getRemainingRequests(domain, config),
        reason: `Too many concurrent requests (${concurrent}/${config.maxConcurrent})`
      };
    }

    // Check rate limits
    const history = this.requestHistory.get(domain) || [];
    const now = Date.now();
    
    // Check minute limit
    const minuteRequests = this.countRequestsInWindow(history, now, 60 * 1000);
    if (minuteRequests >= config.requestsPerMinute) {
      const oldestInMinute = this.getOldestRequestInWindow(history, now, 60 * 1000);
      const retryAfter = oldestInMinute ? (oldestInMinute.timestamp + 60 * 1000) - now : config.minDelayMs;
      
      return {
        allowed: false,
        retryAfterMs: Math.max(retryAfter, config.minDelayMs),
        remainingRequests: this.getRemainingRequests(domain, config),
        reason: `Rate limit exceeded: ${minuteRequests}/${config.requestsPerMinute} requests per minute`
      };
    }

    // Check hour limit
    const hourRequests = this.countRequestsInWindow(history, now, 60 * 60 * 1000);
    if (hourRequests >= config.requestsPerHour) {
      const oldestInHour = this.getOldestRequestInWindow(history, now, 60 * 60 * 1000);
      const retryAfter = oldestInHour ? (oldestInHour.timestamp + 60 * 60 * 1000) - now : 60 * 60 * 1000;
      
      return {
        allowed: false,
        retryAfterMs: retryAfter,
        remainingRequests: this.getRemainingRequests(domain, config),
        reason: `Rate limit exceeded: ${hourRequests}/${config.requestsPerHour} requests per hour`
      };
    }

    // Check day limit
    const dayRequests = this.countRequestsInWindow(history, now, 24 * 60 * 60 * 1000);
    if (dayRequests >= config.requestsPerDay) {
      const oldestInDay = this.getOldestRequestInWindow(history, now, 24 * 60 * 60 * 1000);
      const retryAfter = oldestInDay ? (oldestInDay.timestamp + 24 * 60 * 60 * 1000) - now : 24 * 60 * 60 * 1000;
      
      return {
        allowed: false,
        retryAfterMs: retryAfter,
        remainingRequests: this.getRemainingRequests(domain, config),
        reason: `Rate limit exceeded: ${dayRequests}/${config.requestsPerDay} requests per day`
      };
    }

    // Check minimum delay since last request
    const lastRequest = history[history.length - 1];
    if (lastRequest && (now - lastRequest.timestamp) < config.minDelayMs) {
      const retryAfter = config.minDelayMs - (now - lastRequest.timestamp);
      
      return {
        allowed: false,
        retryAfterMs: retryAfter,
        remainingRequests: this.getRemainingRequests(domain, config),
        reason: `Minimum delay not met: ${now - lastRequest.timestamp}ms < ${config.minDelayMs}ms`
      };
    }

    // Request is allowed
    return {
      allowed: true,
      remainingRequests: this.getRemainingRequests(domain, config)
    };
  }

  /**
   * Record a request (call this when making a request)
   */
  recordRequest(url: string): void {
    const domain = this.extractDomain(url);
    const now = Date.now();
    
    // Add to history
    const history = this.requestHistory.get(domain) || [];
    history.push({ timestamp: now, domain });
    this.requestHistory.set(domain, history);
    
    // Increment concurrent counter
    const concurrent = this.activeRequests.get(domain) || 0;
    this.activeRequests.set(domain, concurrent + 1);
  }

  /**
   * Mark a request as completed (call this when request finishes)
   */
  completeRequest(url: string): void {
    const domain = this.extractDomain(url);
    const concurrent = this.activeRequests.get(domain) || 0;
    this.activeRequests.set(domain, Math.max(0, concurrent - 1));
  }

  /**
   * Set custom rate limit configuration for a domain
   */
  setDomainConfig(domain: string, config: Partial<RateLimitConfig>): void {
    const currentConfig = this.getConfigForDomain(domain);
    this.domainConfigs.set(domain, { ...currentConfig, ...config });
  }

  /**
   * Get current rate limit status for a domain
   */
  getDomainStatus(domain: string): {
    config: RateLimitConfig;
    concurrent: number;
    requestCounts: {
      lastMinute: number;
      lastHour: number;
      lastDay: number;
    };
  } {
    const config = this.getConfigForDomain(domain);
    const history = this.requestHistory.get(domain) || [];
    const now = Date.now();
    
    return {
      config,
      concurrent: this.activeRequests.get(domain) || 0,
      requestCounts: {
        lastMinute: this.countRequestsInWindow(history, now, 60 * 1000),
        lastHour: this.countRequestsInWindow(history, now, 60 * 60 * 1000),
        lastDay: this.countRequestsInWindow(history, now, 24 * 60 * 60 * 1000)
      }
    };
  }

  /**
   * Clear rate limit history for a domain
   */
  clearDomainHistory(domain: string): void {
    this.requestHistory.delete(domain);
    this.activeRequests.delete(domain);
  }

  /**
   * Get all domains being tracked
   */
  getTrackedDomains(): string[] {
    return Array.from(new Set([
      ...this.requestHistory.keys(),
      ...this.activeRequests.keys()
    ]));
  }

  // Private helper methods
  private extractDomain(url: string): string {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  }

  private getConfigForDomain(domain: string): RateLimitConfig {
    // Check for exact match first
    if (this.domainConfigs.has(domain)) {
      return this.domainConfigs.get(domain)!;
    }
    
    // Check for parent domain match
    const parts = domain.split('.');
    for (let i = 1; i < parts.length; i++) {
      const parentDomain = parts.slice(i).join('.');
      if (this.domainConfigs.has(parentDomain)) {
        return this.domainConfigs.get(parentDomain)!;
      }
    }
    
    return { ...this.DEFAULT_CONFIG };
  }

  private countRequestsInWindow(history: RequestRecord[], now: number, windowMs: number): number {
    const cutoff = now - windowMs;
    return history.filter(record => record.timestamp > cutoff).length;
  }

  private getOldestRequestInWindow(history: RequestRecord[], now: number, windowMs: number): RequestRecord | null {
    const cutoff = now - windowMs;
    const requestsInWindow = history.filter(record => record.timestamp > cutoff);
    return requestsInWindow.length > 0 ? requestsInWindow[0] : null;
  }

  private getRemainingRequests(domain: string, config: RateLimitConfig) {
    const history = this.requestHistory.get(domain) || [];
    const now = Date.now();
    
    return {
      perMinute: Math.max(0, config.requestsPerMinute - this.countRequestsInWindow(history, now, 60 * 1000)),
      perHour: Math.max(0, config.requestsPerHour - this.countRequestsInWindow(history, now, 60 * 60 * 1000)),
      perDay: Math.max(0, config.requestsPerDay - this.countRequestsInWindow(history, now, 24 * 60 * 60 * 1000))
    };
  }

  private cleanupOldRecords(): void {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    for (const [domain, history] of this.requestHistory.entries()) {
      const recentHistory = history.filter(record => (now - record.timestamp) < dayMs);
      if (recentHistory.length === 0) {
        this.requestHistory.delete(domain);
      } else {
        this.requestHistory.set(domain, recentHistory);
      }
    }
  }
}