/**
 * Legal compliance framework for Picksy
 * Exports all compliance-related utilities and classes
 */

// Robots.txt parsing
export {
  RobotsParser,
  type RobotsRule,
  type RobotsDirective
} from './robots-parser.js';

// Rate limiting
export {
  RateLimiter,
  type RateLimitConfig,
  type RateLimitStatus
} from './rate-limiter.js';

// Terms of Service compliance
export {
  ToSChecker,
  type ToSComplianceResult,
  type SitePolicy
} from './tos-checker.js';

// Attribution headers
export {
  AttributionHeaderManager,
  createDefaultAttributionConfig,
  createAttributionManager,
  type AttributionConfig,
  type RequestHeaders
} from './attribution-headers.js';

/**
 * Comprehensive legal compliance checker
 * Combines all compliance checks into a single interface
 */
export class LegalComplianceChecker {
  private robotsParser: RobotsParser;
  private rateLimiter: RateLimiter;
  private tosChecker: ToSChecker;
  private attributionManager: AttributionHeaderManager;

  constructor(attributionConfig?: Partial<AttributionConfig>) {
    this.robotsParser = new RobotsParser();
    this.rateLimiter = new RateLimiter();
    this.tosChecker = new ToSChecker();
    this.attributionManager = createAttributionManager(attributionConfig);
  }

  /**
   * Comprehensive compliance check for a URL
   */
  async checkCompliance(url: string): Promise<{
    canAccess: boolean;
    robotsCompliant: boolean;
    rateLimitOk: boolean;
    tosCompliant: boolean;
    headers: RequestHeaders;
    issues: string[];
    recommendations: string[];
    retryAfterMs?: number;
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let canAccess = true;
    let retryAfterMs: number | undefined;

    // Check robots.txt
    const robotsResult = await this.robotsParser.canFetch(url);
    const robotsCompliant = robotsResult.canFetch;
    
    if (!robotsCompliant) {
      canAccess = false;
      issues.push(`Robots.txt violation: ${robotsResult.reason}`);
    }

    // Check rate limits
    const rateLimitResult = await this.rateLimiter.checkRateLimit(url);
    const rateLimitOk = rateLimitResult.allowed;
    
    if (!rateLimitOk) {
      canAccess = false;
      retryAfterMs = rateLimitResult.retryAfterMs;
      issues.push(`Rate limit exceeded: ${rateLimitResult.reason}`);
    }

    // Check ToS compliance
    const tosResult = await this.tosChecker.checkCompliance(url);
    const tosCompliant = tosResult.compliant;
    
    if (!tosCompliant) {
      canAccess = false;
      issues.push(...tosResult.restrictions);
    }
    
    recommendations.push(...tosResult.recommendations);

    // Generate appropriate headers
    const headers = this.attributionManager.generateHeaders(url, {
      includeContact: true,
      includePurpose: true
    });

    return {
      canAccess,
      robotsCompliant,
      rateLimitOk,
      tosCompliant,
      headers,
      issues,
      recommendations,
      retryAfterMs
    };
  }

  /**
   * Record a successful request for rate limiting
   */
  recordRequest(url: string): void {
    this.rateLimiter.recordRequest(url);
  }

  /**
   * Mark a request as completed for rate limiting
   */
  completeRequest(url: string): void {
    this.rateLimiter.completeRequest(url);
  }

  /**
   * Get compliance status for multiple URLs
   */
  async batchCheckCompliance(urls: string[]): Promise<Array<{
    url: string;
    compliant: boolean;
    issues: string[];
  }>> {
    const results = [];
    
    for (const url of urls) {
      try {
        const result = await this.checkCompliance(url);
        results.push({
          url,
          compliant: result.canAccess,
          issues: result.issues
        });
      } catch (error) {
        results.push({
          url,
          compliant: false,
          issues: [`Error checking compliance: ${error}`]
        });
      }
    }
    
    return results;
  }

  /**
   * Get rate limiter instance for advanced usage
   */
  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  /**
   * Get ToS checker instance for advanced usage
   */
  getToSChecker(): ToSChecker {
    return this.tosChecker;
  }

  /**
   * Get attribution manager instance for advanced usage
   */
  getAttributionManager(): AttributionHeaderManager {
    return this.attributionManager;
  }
}