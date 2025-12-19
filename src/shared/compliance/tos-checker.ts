/**
 * Terms of Service compliance checker
 * Helps ensure legal compliance when accessing external sites
 */

export interface ToSComplianceResult {
  compliant: boolean;
  warnings: string[];
  restrictions: string[];
  recommendations: string[];
}

export interface SitePolicy {
  domain: string;
  allowsAutomatedAccess: boolean;
  requiresAttribution: boolean;
  rateLimit?: number; // requests per minute
  restrictedPaths: string[];
  contactInfo?: string;
  lastUpdated: Date;
  notes?: string;
}

export class ToSChecker {
  private sitePolicies = new Map<string, SitePolicy>();
  private readonly KNOWN_RESTRICTIVE_SITES = [
    'amazon.com',
    'ebay.com', 
    'facebook.com',
    'instagram.com',
    'twitter.com',
    'linkedin.com'
  ];

  constructor() {
    this.initializeKnownPolicies();
  }

  /**
   * Check ToS compliance for a given URL
   */
  async checkCompliance(url: string): Promise<ToSComplianceResult> {
    const domain = this.extractDomain(url);
    const policy = this.sitePolicies.get(domain);
    
    const result: ToSComplianceResult = {
      compliant: true,
      warnings: [],
      restrictions: [],
      recommendations: []
    };

    // Check if we have policy information for this domain
    if (!policy) {
      if (this.KNOWN_RESTRICTIVE_SITES.includes(domain)) {
        result.compliant = false;
        result.warnings.push(`${domain} is known to have restrictive ToS regarding automated access`);
        result.recommendations.push(`Use official API for ${domain} instead of scraping`);
      } else {
        result.warnings.push(`No ToS policy information available for ${domain}`);
        result.recommendations.push('Review site\'s Terms of Service manually before scraping');
        result.recommendations.push('Consider reaching out to site owner for permission');
      }
      return result;
    }

    // Check automated access policy
    if (!policy.allowsAutomatedAccess) {
      result.compliant = false;
      result.restrictions.push('Site explicitly prohibits automated access');
      result.recommendations.push('Use official API if available');
      result.recommendations.push('Contact site owner for permission');
    }

    // Check path restrictions
    const urlPath = new URL(url).pathname;
    const restrictedPath = policy.restrictedPaths.find(path => 
      urlPath.startsWith(path) || this.matchesPattern(urlPath, path)
    );
    
    if (restrictedPath) {
      result.compliant = false;
      result.restrictions.push(`Path ${urlPath} is restricted (matches ${restrictedPath})`);
    }

    // Add attribution requirements
    if (policy.requiresAttribution) {
      result.recommendations.push('Include proper attribution in requests');
      result.recommendations.push('Respect any attribution requirements in displayed data');
    }

    // Add rate limiting recommendations
    if (policy.rateLimit) {
      result.recommendations.push(`Respect rate limit: max ${policy.rateLimit} requests per minute`);
    }

    // Add contact information if available
    if (policy.contactInfo) {
      result.recommendations.push(`Contact for permissions: ${policy.contactInfo}`);
    }

    return result;
  }

  /**
   * Add or update site policy information
   */
  setSitePolicy(policy: SitePolicy): void {
    this.sitePolicies.set(policy.domain, policy);
  }

  /**
   * Get policy for a domain
   */
  getSitePolicy(domain: string): SitePolicy | undefined {
    return this.sitePolicies.get(domain);
  }

  /**
   * Check if a site is known to be API-first
   */
  isApiFirst(domain: string): boolean {
    const apiFirstSites = [
      'amazon.com', // Product Advertising API
      'ebay.com',   // eBay API
      'shopify.com', // Shopify API
      'etsy.com',   // Etsy API
      'walmart.com' // Walmart API
    ];
    
    return apiFirstSites.includes(domain);
  }

  /**
   * Get recommended API endpoint for a domain
   */
  getRecommendedApi(domain: string): string | null {
    const apiEndpoints: Record<string, string> = {
      'amazon.com': 'Amazon Product Advertising API',
      'ebay.com': 'eBay Browse API',
      'shopify.com': 'Shopify Admin API',
      'etsy.com': 'Etsy Open API',
      'walmart.com': 'Walmart Open API'
    };
    
    return apiEndpoints[domain] || null;
  }

  /**
   * Generate compliance report for multiple URLs
   */
  async generateComplianceReport(urls: string[]): Promise<{
    compliant: string[];
    nonCompliant: string[];
    warnings: string[];
    summary: {
      totalUrls: number;
      compliantCount: number;
      nonCompliantCount: number;
      warningCount: number;
    };
  }> {
    const compliant: string[] = [];
    const nonCompliant: string[] = [];
    const warnings: string[] = [];

    for (const url of urls) {
      try {
        const result = await this.checkCompliance(url);
        
        if (result.compliant) {
          compliant.push(url);
        } else {
          nonCompliant.push(url);
        }
        
        if (result.warnings.length > 0) {
          warnings.push(`${url}: ${result.warnings.join(', ')}`);
        }
      } catch (error) {
        warnings.push(`${url}: Error checking compliance - ${error}`);
      }
    }

    return {
      compliant,
      nonCompliant,
      warnings,
      summary: {
        totalUrls: urls.length,
        compliantCount: compliant.length,
        nonCompliantCount: nonCompliant.length,
        warningCount: warnings.length
      }
    };
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

  private matchesPattern(path: string, pattern: string): boolean {
    // Simple pattern matching for path restrictions
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\*/g, '.*');
      try {
        return new RegExp(`^${regexPattern}$`).test(path);
      } catch {
        return false;
      }
    }
    return path === pattern;
  }

  private initializeKnownPolicies(): void {
    // Initialize with known site policies
    // These should be regularly updated based on actual ToS reviews
    
    this.setSitePolicy({
      domain: 'amazon.com',
      allowsAutomatedAccess: false, // Requires API usage
      requiresAttribution: true,
      rateLimit: 1, // Very restrictive
      restrictedPaths: ['/gp/product/', '/dp/', '/exec/'],
      contactInfo: 'https://developer.amazon.com/support',
      lastUpdated: new Date('2024-01-01'),
      notes: 'Must use Product Advertising API for product data'
    });

    this.setSitePolicy({
      domain: 'ebay.com',
      allowsAutomatedAccess: false, // Requires API usage
      requiresAttribution: true,
      rateLimit: 2,
      restrictedPaths: ['/itm/', '/p/', '/b/'],
      contactInfo: 'https://developer.ebay.com/support',
      lastUpdated: new Date('2024-01-01'),
      notes: 'Must use eBay Browse API for product data'
    });

    this.setSitePolicy({
      domain: 'walmart.com',
      allowsAutomatedAccess: false,
      requiresAttribution: true,
      rateLimit: 1,
      restrictedPaths: ['/ip/', '/browse/'],
      contactInfo: 'https://developer.walmart.com/support',
      lastUpdated: new Date('2024-01-01'),
      notes: 'Walmart Open API available for approved partners'
    });

    // Example of a more permissive site
    this.setSitePolicy({
      domain: 'example-store.com',
      allowsAutomatedAccess: true,
      requiresAttribution: false,
      rateLimit: 10,
      restrictedPaths: ['/admin/', '/api/'],
      lastUpdated: new Date('2024-01-01'),
      notes: 'Allows reasonable automated access with rate limiting'
    });
  }
}