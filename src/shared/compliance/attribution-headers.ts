/**
 * Attribution header system for external requests
 * Ensures proper identification and compliance when accessing external sites
 */

export interface AttributionConfig {
  userAgent: string;
  contact: string;
  purpose: string;
  respectsRobots: boolean;
  website?: string;
  version: string;
}

export interface RequestHeaders {
  'User-Agent': string;
  'From'?: string;
  'X-Purpose'?: string;
  'X-Robots-Respect'?: string;
  'X-Contact'?: string;
  'Accept'?: string;
  'Accept-Language'?: string;
  'Cache-Control'?: string;
  'DNT'?: string; // Do Not Track
}

export class AttributionHeaderManager {
  private config: AttributionConfig;
  private readonly DEFAULT_HEADERS: Partial<RequestHeaders> = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control': 'no-cache',
    'DNT': '1' // Respect Do Not Track
  };

  constructor(config: AttributionConfig) {
    this.config = config;
    this.validateConfig();
  }

  /**
   * Generate appropriate headers for a request to the given URL
   */
  generateHeaders(url: string, options: {
    includeContact?: boolean;
    includePurpose?: boolean;
    customHeaders?: Record<string, string>;
  } = {}): RequestHeaders {
    const domain = this.extractDomain(url);
    const headers: RequestHeaders = {
      ...this.DEFAULT_HEADERS,
      'User-Agent': this.generateUserAgent(domain)
    };

    // Add contact information if requested or required by domain
    if (options.includeContact || this.shouldIncludeContact(domain)) {
      headers['From'] = this.config.contact;
      headers['X-Contact'] = this.config.contact;
    }

    // Add purpose information if requested
    if (options.includePurpose) {
      headers['X-Purpose'] = this.config.purpose;
    }

    // Always indicate robots.txt respect
    if (this.config.respectsRobots) {
      headers['X-Robots-Respect'] = 'true';
    }

    // Add any custom headers
    if (options.customHeaders) {
      Object.assign(headers, options.customHeaders);
    }

    return headers;
  }

  /**
   * Generate a compliant User-Agent string
   */
  generateUserAgent(domain?: string): string {
    const baseUA = `${this.config.userAgent}/${this.config.version}`;
    
    // Add contact info for known restrictive sites
    if (domain && this.isRestrictiveSite(domain)) {
      return `${baseUA} (+${this.config.website || this.config.contact})`;
    }
    
    return baseUA;
  }

  /**
   * Create headers specifically for robots.txt requests
   */
  generateRobotsHeaders(): RequestHeaders {
    return {
      'User-Agent': this.generateUserAgent(),
      'Accept': 'text/plain,*/*',
      'Cache-Control': 'max-age=3600', // Cache robots.txt for 1 hour
      'From': this.config.contact
    };
  }

  /**
   * Create headers for API requests
   */
  generateApiHeaders(apiKey?: string): RequestHeaders {
    const headers: RequestHeaders = {
      'User-Agent': this.generateUserAgent(),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'From': this.config.contact
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
  }

  /**
   * Validate request headers for compliance
   */
  validateHeaders(headers: Record<string, string>): {
    valid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for User-Agent
    if (!headers['User-Agent'] || headers['User-Agent'].trim() === '') {
      issues.push('Missing User-Agent header');
    } else if (headers['User-Agent'].includes('bot') || headers['User-Agent'].includes('crawler')) {
      recommendations.push('Consider using a more descriptive User-Agent that clearly identifies your service');
    }

    // Check for contact information
    if (!headers['From'] && !headers['X-Contact']) {
      recommendations.push('Consider including contact information (From or X-Contact header)');
    }

    // Check for robots respect indication
    if (!headers['X-Robots-Respect']) {
      recommendations.push('Consider adding X-Robots-Respect header to indicate compliance');
    }

    // Check for purpose indication
    if (!headers['X-Purpose']) {
      recommendations.push('Consider adding X-Purpose header to explain request intent');
    }

    // Check for DNT header
    if (!headers['DNT']) {
      recommendations.push('Consider adding DNT (Do Not Track) header for privacy compliance');
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AttributionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.validateConfig();
  }

  /**
   * Get current configuration
   */
  getConfig(): AttributionConfig {
    return { ...this.config };
  }

  /**
   * Generate attribution text for displayed data
   */
  generateAttributionText(source: string, timestamp?: Date): string {
    const timeStr = timestamp ? ` on ${timestamp.toLocaleDateString()}` : '';
    return `Data sourced from ${source}${timeStr} by ${this.config.userAgent}`;
  }

  /**
   * Generate compliance footer for web pages
   */
  generateComplianceFooter(): string {
    return `This service respects robots.txt, implements rate limiting, and provides proper attribution. ` +
           `Contact: ${this.config.contact} | Purpose: ${this.config.purpose}`;
  }

  // Private helper methods
  private validateConfig(): void {
    if (!this.config.userAgent || this.config.userAgent.trim() === '') {
      throw new Error('User-Agent is required in attribution config');
    }
    
    if (!this.config.contact || !this.isValidEmail(this.config.contact)) {
      throw new Error('Valid contact email is required in attribution config');
    }
    
    if (!this.config.purpose || this.config.purpose.trim() === '') {
      throw new Error('Purpose is required in attribution config');
    }
    
    if (!this.config.version || this.config.version.trim() === '') {
      throw new Error('Version is required in attribution config');
    }
  }

  private extractDomain(url: string): string {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  }

  private isRestrictiveSite(domain: string): boolean {
    const restrictiveSites = [
      'amazon.com', 'ebay.com', 'walmart.com', 'target.com',
      'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com',
      'google.com', 'microsoft.com', 'apple.com'
    ];
    
    return restrictiveSites.some(site => domain.includes(site));
  }

  private shouldIncludeContact(domain: string): boolean {
    // Always include contact for restrictive sites
    return this.isRestrictiveSite(domain);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Default configuration factory
export function createDefaultAttributionConfig(): AttributionConfig {
  return {
    userAgent: 'Picksy-PriceTracker',
    contact: 'contact@picksy.app', // This should be updated with actual contact
    purpose: 'Price tracking and comparison service for consumers',
    respectsRobots: true,
    website: 'https://picksy.app', // This should be updated with actual website
    version: '1.0.0'
  };
}

// Utility function to create a configured header manager
export function createAttributionManager(customConfig?: Partial<AttributionConfig>): AttributionHeaderManager {
  const defaultConfig = createDefaultAttributionConfig();
  const config = customConfig ? { ...defaultConfig, ...customConfig } : defaultConfig;
  return new AttributionHeaderManager(config);
}