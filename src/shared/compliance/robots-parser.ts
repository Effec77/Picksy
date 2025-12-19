/**
 * Robots.txt parser for legal compliance
 * Ensures scraping operations respect robots.txt directives
 */

export interface RobotsRule {
  userAgent: string;
  disallow: string[];
  allow: string[];
  crawlDelay?: number;
  sitemap?: string[];
}

export interface RobotsDirective {
  canFetch: boolean;
  crawlDelay: number;
  reason?: string;
}

export class RobotsParser {
  private cache = new Map<string, { rules: RobotsRule[]; expiry: number }>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly DEFAULT_CRAWL_DELAY = 1000; // 1 second
  private readonly USER_AGENT = 'Picksy-PriceTracker/1.0';

  /**
   * Check if a URL can be fetched according to robots.txt
   */
  async canFetch(url: string): Promise<RobotsDirective> {
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
      
      const rules = await this.getRobotRules(robotsUrl);
      const applicableRule = this.findApplicableRule(rules, this.USER_AGENT);
      
      if (!applicableRule) {
        return {
          canFetch: true,
          crawlDelay: this.DEFAULT_CRAWL_DELAY,
          reason: 'No applicable robots.txt rules found'
        };
      }

      const path = urlObj.pathname + urlObj.search;
      const isDisallowed = this.isPathDisallowed(path, applicableRule);
      
      return {
        canFetch: !isDisallowed,
        crawlDelay: applicableRule.crawlDelay || this.DEFAULT_CRAWL_DELAY,
        reason: isDisallowed ? 'Path disallowed by robots.txt' : 'Path allowed'
      };
    } catch (error) {
      // If we can't fetch or parse robots.txt, err on the side of caution
      return {
        canFetch: false,
        crawlDelay: this.DEFAULT_CRAWL_DELAY,
        reason: `Error checking robots.txt: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get robots.txt rules for a domain (with caching)
   */
  private async getRobotRules(robotsUrl: string): Promise<RobotsRule[]> {
    const cached = this.cache.get(robotsUrl);
    if (cached && Date.now() < cached.expiry) {
      return cached.rules;
    }

    try {
      const response = await fetch(robotsUrl, {
        headers: {
          'User-Agent': this.USER_AGENT
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        // If robots.txt doesn't exist, assume no restrictions
        return [];
      }

      const robotsText = await response.text();
      const rules = this.parseRobotsText(robotsText);
      
      this.cache.set(robotsUrl, {
        rules,
        expiry: Date.now() + this.CACHE_TTL
      });

      return rules;
    } catch (error) {
      // If we can't fetch robots.txt, return empty rules (no restrictions)
      return [];
    }
  }

  /**
   * Parse robots.txt content into structured rules
   */
  private parseRobotsText(robotsText: string): RobotsRule[] {
    const lines = robotsText.split('\n').map(line => line.trim());
    const rules: RobotsRule[] = [];
    let currentRule: Partial<RobotsRule> | null = null;

    for (const line of lines) {
      if (!line || line.startsWith('#')) continue;

      const [directive, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      
      if (!directive || !value) continue;

      const directiveLower = directive.toLowerCase();

      switch (directiveLower) {
        case 'user-agent':
          // Start a new rule
          if (currentRule) {
            rules.push(this.completeRule(currentRule));
          }
          currentRule = {
            userAgent: value,
            disallow: [],
            allow: [],
            sitemap: []
          };
          break;

        case 'disallow':
          if (currentRule) {
            currentRule.disallow!.push(value);
          }
          break;

        case 'allow':
          if (currentRule) {
            currentRule.allow!.push(value);
          }
          break;

        case 'crawl-delay':
          if (currentRule) {
            const delay = parseInt(value, 10);
            if (!isNaN(delay)) {
              currentRule.crawlDelay = delay * 1000; // Convert to milliseconds
            }
          }
          break;

        case 'sitemap':
          if (currentRule) {
            currentRule.sitemap!.push(value);
          }
          break;
      }
    }

    // Add the last rule
    if (currentRule) {
      rules.push(this.completeRule(currentRule));
    }

    return rules;
  }

  /**
   * Complete a partial rule with defaults
   */
  private completeRule(partialRule: Partial<RobotsRule>): RobotsRule {
    return {
      userAgent: partialRule.userAgent || '*',
      disallow: partialRule.disallow || [],
      allow: partialRule.allow || [],
      crawlDelay: partialRule.crawlDelay,
      sitemap: partialRule.sitemap || []
    };
  }

  /**
   * Find the most specific applicable rule for a user agent
   */
  private findApplicableRule(rules: RobotsRule[], userAgent: string): RobotsRule | null {
    // First, look for exact match
    const exactMatch = rules.find(rule => 
      rule.userAgent.toLowerCase() === userAgent.toLowerCase()
    );
    if (exactMatch) return exactMatch;

    // Then look for partial matches (case insensitive)
    const partialMatch = rules.find(rule => 
      userAgent.toLowerCase().includes(rule.userAgent.toLowerCase()) ||
      rule.userAgent.toLowerCase().includes(userAgent.toLowerCase())
    );
    if (partialMatch) return partialMatch;

    // Finally, look for wildcard rule
    const wildcardMatch = rules.find(rule => rule.userAgent === '*');
    return wildcardMatch || null;
  }

  /**
   * Check if a path is disallowed by the rule
   */
  private isPathDisallowed(path: string, rule: RobotsRule): boolean {
    // Check allow rules first (they take precedence)
    for (const allowPattern of rule.allow) {
      if (this.matchesPattern(path, allowPattern)) {
        return false; // Explicitly allowed
      }
    }

    // Check disallow rules
    for (const disallowPattern of rule.disallow) {
      if (this.matchesPattern(path, disallowPattern)) {
        return true; // Disallowed
      }
    }

    return false; // Not explicitly disallowed
  }

  /**
   * Check if a path matches a robots.txt pattern
   */
  private matchesPattern(path: string, pattern: string): boolean {
    if (pattern === '') return true; // Empty pattern matches everything
    if (pattern === '/') return path === '/';

    // Convert robots.txt pattern to regex
    // * matches any sequence of characters
    // $ at the end means exact match to end of string
    let regexPattern = pattern
      .replace(/[.+?^{}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*'); // Convert * to .*

    if (pattern.endsWith('$')) {
      regexPattern = regexPattern.slice(0, -2) + '$'; // Remove escaped $ and add real $
    } else {
      // If no $ at end, pattern matches if path starts with it
      regexPattern = '^' + regexPattern;
    }

    try {
      const regex = new RegExp(regexPattern);
      return regex.test(path);
    } catch {
      // If regex is invalid, fall back to simple string matching
      return path.startsWith(pattern);
    }
  }

  /**
   * Clear the robots.txt cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}