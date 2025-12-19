/**
 * Complete Price Comparison Engine for Misc Agent
 * Implements all 6 core functions of the Misc Agent
 */

/**
 * Main Price Comparison Engine
 */
const PriceComparison = {

  /**
   * Create mock results for demonstration
   * This simulates what real scraping would return
   */
  /**
   * Create mock results (Deprecated, kept for fallback)
   */
  createMockResults(searchUrls, originalProduct) {
    // ... code truncated, use only if scraping completely fails ...
    return []; // Disabling mock results to force real scraping
  },

  /**
   * Function 1: Automatic Price Comparison
   * Generate comparison URLs and simulate results for now
   */
  async compareProductPrices(currentProduct, options = {}) {
    console.log('🚀 Starting automatic price comparison...');

    const {
      maxSites = 12,
      timeout = 30000,
      enableAI = true,
      minTrustScore = 6
    } = options;

    try {
      // Step 1: Generate search URLs for all available sites
      const searchUrls = await this.generateComparisonUrls(currentProduct, {
        maxSites,
        minTrustScore
      });

      console.log(`🔍 Comparing across ${searchUrls.length} sites...`);
      console.log('🔍 Selected sites:', searchUrls.map(s => s.name));
      console.log('🔍 Product title:', currentProduct.title);

      if (searchUrls.length === 0) {
        console.warn('⚠️ No sites selected for comparison');
        return this.createErrorResult(currentProduct, new Error('No suitable sites found for this product category'));
      }

      // Step 2: Perform Real Scraping with Deep Linking
      console.log('🚀 Initiating Real-Time Deep Scrape...');
      let results = [];

      try {
        if (typeof Scraper !== 'undefined' && Scraper.scrapeComparison) {
          const scrapeResponse = await Scraper.scrapeComparison(currentProduct.title, {
            maxSites: maxSites,
            maxConcurrent: 2, // Use lower concurrency for deep linking to avoid detection
            targetProduct: currentProduct // Pass target for deep linking matching
          });
          results = scrapeResponse.results || [];
        } else {
          console.warn('⚠️ Scraper module not loaded, falling back to empty results (check popup.html includes)');
        }
      } catch (scrapeError) {
        console.error('❌ Scraping error:', scrapeError);
        // Fallback or empty results
      }

      if (results.length === 0) {
        console.warn('⚠️ No real results found.');
      }

      // Step 3: Match and filter products
      const matches = await this.matchProducts(currentProduct, results);

      // Step 4: Analyze and rank results
      const analysis = this.analyzeResults(currentProduct, matches);

      // Step 5: Save to history for tracking
      await this.saveComparisonHistory(currentProduct, analysis);

      console.log(`✅ Comparison complete: Found ${matches.length} matches`);
      return analysis;

    } catch (error) {
      console.error('❌ Price comparison failed:', error);
      return this.createErrorResult(currentProduct, error);
    }
  },

  /**
   * Generate search URLs for comparison
   */
  async generateComparisonUrls(product, options) {
    // Extract search keywords from product title
    const keywords = (typeof extractKeywords !== 'undefined')
      ? extractKeywords(product.title).searchQuery
      : product.title.split(' ').slice(0, 5).join(' '); // Simple fallback
    console.log('🔍 Extracted keywords:', keywords);

    // Get all available sites (hardcoded + AI-discovered)
    const sites = await this.getAllAvailableSites();
    console.log('🔍 Total available sites:', sites.length);

    // Filter by trust score and category with smart exclusions
    const filteredSites = sites.filter(site => {
      // Always include general sites with good trust scores
      if (site.category === 'all') {
        const include = site.trustScore >= options.minTrustScore;
        console.log(`🔍 Site ${site.name} (all): ${include ? 'INCLUDED' : 'EXCLUDED'} (trust: ${site.trustScore})`);
        return include;
      }

      // For specialized sites, be more lenient to get more results
      const productMatches = this.matchesCategory(product, site.category);
      const shouldExclude = this.shouldExcludeSite(product, site);
      const trustOk = site.trustScore >= Math.max(6, options.minTrustScore - 1); // Lower threshold for specialized sites

      const include = trustOk && (productMatches || !shouldExclude); // Include if matches OR not explicitly excluded
      console.log(`🔍 Site ${site.name} (${site.category}): ${include ? 'INCLUDED' : 'EXCLUDED'} (trust: ${trustOk}, matches: ${productMatches}, exclude: ${shouldExclude})`);

      return include;
    });

    console.log('🔍 Filtered sites count:', filteredSites.length);

    // If we have too few sites, be more lenient
    if (filteredSites.length < 4) {
      console.log('⚠️ Too few sites, being more lenient...');
      const moreSites = sites.filter(site => {
        return site.trustScore >= 6 && !this.shouldExcludeSite(product, site);
      });
      filteredSites.push(...moreSites.filter(s => !filteredSites.find(f => f.name === s.name)));
    }

    // Sort by trust score (highest first)
    filteredSites.sort((a, b) => b.trustScore - a.trustScore);

    // Limit to max sites
    const selectedSites = filteredSites.slice(0, options.maxSites);
    console.log('🔍 Final selected sites:', selectedSites.map(s => s.name));

    // Generate search URLs
    return selectedSites.map(site => ({
      name: site.name,
      domain: site.domain,
      url: this.buildSearchUrl(site, keywords),
      trustScore: site.trustScore,
      category: site.category,
      source: site.source || 'hardcoded'
    }));
  },



  /**
   * Get all available sites (hardcoded + AI-discovered)
   */
  async getAllAvailableSites() {
    // Hardcoded verified sites (26 sites)
    const hardcodedSites = [
      { name: 'Amazon India', domain: 'amazon.in', searchUrl: 'https://www.amazon.in/s', searchParam: 'k', trustScore: 9, category: 'all' },
      { name: 'Flipkart', domain: 'flipkart.com', searchUrl: 'https://www.flipkart.com/search', searchParam: 'q', trustScore: 9, category: 'all' },
      { name: 'Myntra', domain: 'myntra.com', searchUrl: 'https://www.myntra.com/search', searchParam: 'q', trustScore: 9, category: 'fashion' },
      { name: 'Ajio', domain: 'ajio.com', searchUrl: 'https://www.ajio.com/search', searchParam: 'text', trustScore: 9, category: 'fashion' },
      { name: 'Croma', domain: 'croma.com', searchUrl: 'https://www.croma.com/search', searchParam: 'q', trustScore: 8, category: 'electronics' },
      { name: 'Lenskart', domain: 'lenskart.com', searchUrl: 'https://www.lenskart.com/search', searchParam: 'q', trustScore: 9, category: 'eyewear' },
      { name: 'Boat Lifestyle', domain: 'boat-lifestyle.com', searchUrl: 'https://www.boat-lifestyle.com/search', searchParam: 'q', trustScore: 8, category: 'electronics' },
      { name: 'Nykaa', domain: 'nykaa.com', searchUrl: 'https://www.nykaa.com/search/result', searchParam: 'q', trustScore: 8, category: 'beauty' },
      { name: 'FirstCry', domain: 'firstcry.com', searchUrl: 'https://www.firstcry.com/search', searchParam: 'searchstring', trustScore: 8, category: 'kids' },
      { name: 'Decathlon', domain: 'decathlon.in', searchUrl: 'https://www.decathlon.in/search', searchParam: 'q', trustScore: 8, category: 'sports' },
      { name: 'Snapdeal', domain: 'snapdeal.com', searchUrl: 'https://www.snapdeal.com/search', searchParam: 'keyword', trustScore: 7, category: 'all' },
      { name: 'Tata CLiQ', domain: 'tatacliq.com', searchUrl: 'https://www.tatacliq.com/search', searchParam: 'searchText', trustScore: 9, category: 'all' }
    ];

    // Get AI-discovered sites from storage
    const { aiDiscoveredSites = [] } = await chrome.storage.sync.get('aiDiscoveredSites');

    return [...hardcodedSites, ...aiDiscoveredSites];
  },

  /**
   * Build search URL for a site
   */
  buildSearchUrl(site, keywords) {
    const encodedKeywords = encodeURIComponent(keywords);
    const separator = site.searchUrl.includes('?') ? '&' : '?';
    return `${site.searchUrl}${separator}${site.searchParam}=${encodedKeywords}`;
  },



  /**
   * Function 2: Product Matching
   * Match products across sites using similarity algorithms
   */
  async matchProducts(originalProduct, scrapedResults) {
    console.log('🔍 Matching products across sites...');

    const matches = [];

    for (const result of scrapedResults) {
      if (result.error) {
        // Include failed results for transparency
        matches.push({
          ...result,
          similarity: 0,
          matchReason: 'Scraping failed',
          matchType: 'error'
        });
      } else {
        const similarity = this.calculateProductSimilarity(originalProduct, result);

        if (similarity.score >= 0.3) { // Lower threshold to show more results
          matches.push({
            ...result,
            similarity: similarity.score,
            matchReason: similarity.reason,
            matchType: similarity.score >= 0.8 ? 'exact' : similarity.score >= 0.6 ? 'similar' : 'possible'
          });
        }
      }
    }

    // Sort by similarity score (highest first)
    matches.sort((a, b) => b.similarity - a.similarity);

    console.log(`✅ Found ${matches.length} matching products`);
    return matches;
  },

  /**
   * Calculate product similarity using multiple factors
   */
  calculateProductSimilarity(original, candidate) {
    let score = 0;
    let reasons = [];

    // Title similarity (most important - 60% weight)
    const titleSimilarity = this.calculateStringSimilarity(
      original.title.toLowerCase(),
      candidate.title.toLowerCase()
    );
    score += titleSimilarity * 0.6;

    if (titleSimilarity > 0.7) {
      reasons.push('Similar title');
    }

    // Price similarity (20% weight)
    if (original.priceValue && candidate.priceValue) {
      const priceDiff = Math.abs(original.priceValue - candidate.priceValue) / original.priceValue;
      const priceSimilarity = Math.max(0, 1 - priceDiff);
      score += priceSimilarity * 0.2;

      if (priceDiff < 0.3) { // Within 30% price range
        reasons.push('Similar price range');
      }
    }

    // Brand matching (20% weight)
    const originalBrand = this.extractBrand(original.title);
    const candidateBrand = this.extractBrand(candidate.title);

    if (originalBrand && candidateBrand && originalBrand === candidateBrand) {
      score += 0.2;
      reasons.push('Same brand');
    }

    return {
      score: Math.min(score, 1.0),
      reason: reasons.join(', ') || 'Basic similarity'
    };
  },

  /**
   * Calculate string similarity using Levenshtein distance
   */
  calculateStringSimilarity(str1, str2) {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // Create matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : (maxLen - matrix[len1][len2]) / maxLen;
  },

  /**
   * Extract brand from product title
   */
  extractBrand(title) {
    const commonBrands = [
      'apple', 'samsung', 'xiaomi', 'oneplus', 'oppo', 'vivo', 'realme',
      'nike', 'adidas', 'puma', 'reebok', 'under armour',
      'sony', 'lg', 'panasonic', 'philips', 'bosch',
      'hp', 'dell', 'lenovo', 'asus', 'acer'
    ];

    const words = title.toLowerCase().split(/\s+/);

    for (const brand of commonBrands) {
      if (words.some(word => word.includes(brand))) {
        return brand;
      }
    }

    // Return first word as potential brand
    return words[0];
  },

  /**
   * Function 3: Results Analysis
   * Analyze and rank comparison results
   */
  analyzeResults(originalProduct, matches) {
    console.log('📊 Analyzing comparison results...');

    if (matches.length === 0) {
      return {
        originalProduct,
        matches: [],
        bestDeal: null,
        savings: 0,
        recommendation: 'No comparable products found',
        analysis: {
          totalSites: 0,
          successfulMatches: 0,
          averagePrice: 0,
          priceRange: { min: 0, max: 0 }
        }
      };
    }

    // Calculate statistics
    const prices = matches.map(m => m.priceValue).filter(p => p > 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;

    // Find best deal (lowest price with good trust score)
    const bestDeal = matches
      .filter(m => m.priceValue > 0)
      .sort((a, b) => {
        // Primary: price (lower is better)
        const priceDiff = a.priceValue - b.priceValue;
        if (Math.abs(priceDiff) > 50) return priceDiff;

        // Secondary: trust score (higher is better)
        return b.trustScore - a.trustScore;
      })[0];

    // Calculate savings
    const currentPrice = originalProduct.priceValue || 0;
    const savings = currentPrice > 0 && bestDeal ? currentPrice - bestDeal.priceValue : 0;
    const savingsPercent = currentPrice > 0 ? (savings / currentPrice) * 100 : 0;

    // Generate recommendation
    let recommendation = 'No recommendation available';
    if (bestDeal) {
      if (savings > 100) {
        recommendation = `💰 Great deal! Save ₹${savings.toLocaleString()} (${savingsPercent.toFixed(1)}%) at ${bestDeal.siteName}`;
      } else if (savings > 0) {
        recommendation = `💡 Save ₹${savings.toLocaleString()} at ${bestDeal.siteName}`;
      } else {
        recommendation = `✅ Current price is competitive. Best alternative: ${bestDeal.siteName}`;
      }
    }

    // Sort matches by Price Ascending for user display
    const sortedMatches = matches.slice(0, 10).sort((a, b) => {
      if (!a.priceValue) return 1;
      if (!b.priceValue) return -1;
      return a.priceValue - b.priceValue;
    });

    return {
      originalProduct,
      matches: sortedMatches, // Return sorted by price
      bestDeal,
      savings,
      savingsPercent,
      recommendation,
      analysis: {
        totalSites: matches.length,
        successfulMatches: matches.filter(m => m.priceValue > 0).length,
        averagePrice: Math.round(avgPrice),
        priceRange: { min: minPrice, max: maxPrice },
        timestamp: Date.now()
      }
    };
  },

  /**
   * Function 4: Save Comparison History
   * Save results for price tracking and analytics
   */
  async saveComparisonHistory(product, analysis) {
    try {
      // In saveComparisonHistory
      const historyKey = `comparison_${Normalize.generateProductId(product.url, product.title)}`;

      const historyEntry = {
        timestamp: Date.now(),
        product: {
          title: product.title,
          url: product.url,
          source: product.source
        },
        results: {
          totalMatches: analysis.matches.length,
          bestPrice: analysis.bestDeal?.priceValue || null,
          bestSite: analysis.bestDeal?.siteName || null,
          savings: analysis.savings,
          averagePrice: analysis.analysis.averagePrice
        }
      };

      // Get existing history
      const { [historyKey]: existingHistory = [] } = await chrome.storage.local.get(historyKey);

      // Add new entry
      existingHistory.push(historyEntry);

      // Keep only last 50 entries
      if (existingHistory.length > 50) {
        existingHistory.splice(0, existingHistory.length - 50);
      }

      // Save updated history
      await chrome.storage.local.set({ [historyKey]: existingHistory });

      console.log('💾 Comparison history saved');

    } catch (error) {
      console.error('Failed to save comparison history:', error);
    }
  },

  /**
   * Utility functions
   */
  shouldExcludeSite(product, site) {
    const title = product.title.toLowerCase();
    const siteName = site.name.toLowerCase();

    // Only exclude very obvious mismatches to get more results
    const exclusions = [
      // Audio-only sites shouldn't get obvious non-audio searches
      { sites: ['boat'], exclude: ['laptop', 'computer', 'tablet', 'tv', 'monitor'] },
      // Beauty sites shouldn't get obvious non-beauty searches  
      { sites: ['nykaa'], exclude: ['laptop', 'computer', 'tablet', 'tv', 'monitor', 'phone'] },
      // Eyewear sites shouldn't get obvious non-eyewear
      { sites: ['lenskart'], exclude: ['laptop', 'computer', 'tablet', 'tv', 'monitor', 'phone'] },
      // Kids sites shouldn't get adult-only electronics
      { sites: ['firstcry'], exclude: ['laptop', 'computer', 'tablet', 'tv', 'monitor'] }
    ];

    for (const rule of exclusions) {
      const matchesSite = rule.sites.some(s => siteName.includes(s));
      if (matchesSite) {
        const shouldExclude = rule.exclude.some(keyword => title.includes(keyword));
        if (shouldExclude) {
          console.log(`❌ Excluding ${site.name} for "${title}" (obvious mismatch)`);
          return true;
        }
      }
    }

    return false;
  },

  matchesCategory(product, category) {
    if (category === 'all') return true;

    const title = product.title.toLowerCase();
    const categoryKeywords = {
      electronics: [
        // Mobile & Tablets
        'phone', 'iphone', 'android', 'smartphone', 'mobile', 'tablet', 'ipad',
        // Computers
        'laptop', 'computer', 'pc', 'macbook', 'chromebook', 'desktop',
        // Audio
        'headphone', 'earphone', 'earbud', 'speaker', 'soundbar', 'bluetooth', 'wireless',
        // Accessories
        'charger', 'cable', 'adapter', 'powerbank', 'case', 'cover',
        // Appliances
        'tv', 'television', 'monitor', 'camera', 'smartwatch', 'fitness', 'tracker'
      ],
      fashion: [
        // Clothing
        'shirt', 'tshirt', 't-shirt', 'dress', 'jeans', 'pants', 'trouser', 'jacket', 'coat', 'sweater', 'hoodie',
        // Footwear
        'shoes', 'sneaker', 'sandal', 'boot', 'slipper', 'heel', 'formal',
        // Accessories
        'bag', 'handbag', 'backpack', 'wallet', 'belt', 'watch', 'jewelry', 'sunglasses'
      ],
      beauty: [
        'makeup', 'cosmetic', 'lipstick', 'foundation', 'mascara', 'eyeliner',
        'skincare', 'cream', 'lotion', 'serum', 'moisturizer', 'cleanser',
        'perfume', 'fragrance', 'deodorant', 'shampoo', 'conditioner', 'hair'
      ],
      sports: [
        'fitness', 'gym', 'exercise', 'workout', 'sports', 'running', 'yoga',
        'cricket', 'football', 'basketball', 'tennis', 'badminton', 'swimming',
        'dumbbell', 'treadmill', 'cycle', 'bicycle'
      ],
      kids: [
        'baby', 'kids', 'children', 'infant', 'toddler', 'toy', 'game',
        'diaper', 'bottle', 'stroller', 'car seat', 'educational'
      ],
      eyewear: [
        'glasses', 'eyeglasses', 'sunglasses', 'lens', 'contact', 'frame', 'spectacle'
      ]
    };

    const keywords = categoryKeywords[category] || [];
    return keywords.some(keyword => title.includes(keyword));
  },

  createErrorResult(product, error) {
    return {
      originalProduct: product,
      matches: [],
      bestDeal: null,
      savings: 0,
      recommendation: `Comparison failed: ${error.message}`,
      analysis: {
        totalSites: 0,
        successfulMatches: 0,
        averagePrice: 0,
        priceRange: { min: 0, max: 0 },
        error: error.message
      }
    };
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PriceComparison;
}

// Attach to window for browser extension usage
if (typeof window !== 'undefined') {
  window.PriceComparison = PriceComparison;
}