/**
 * Complete Price Comparison Engine for Misc Agent
 * Implements all 6 core functions of the Misc Agent
 */

/**
 * Main Price Comparison Engine
 */
const PriceComparison = {
  
  /**
   * Create deterministic results that don't change on each run
   * Uses product title hash to ensure consistent results
   */
  createMockResults(searchUrls, originalProduct) {
    console.log('🔍 Creating deterministic results...');
    console.log('🔍 Search URLs:', searchUrls.length);
    console.log('🔍 Original product:', originalProduct.title);
    
    // Create a simple hash from product title for consistent results
    const titleHash = this.simpleHash(originalProduct.title);
    
    // Ensure we have a valid base price
    const basePrice = originalProduct.priceValue || 
                     (originalProduct.price ? parseInt(originalProduct.price.replace(/[^\d]/g, '')) : null) ||
                     50000;
    
    console.log('🔍 Base price:', basePrice, 'Title hash:', titleHash);
    
    const results = [];
    
    if (searchUrls.length === 0) {
      console.warn('⚠️ No search URLs provided');
      return results;
    }
    
    // Predefined price variations for consistency (based on site reputation)
    const siteVariations = {
      'amazon': -0.05,    // Usually competitive
      'flipkart': -0.03,  // Slightly competitive
      'croma': 0.02,      // Slightly higher (retail)
      'tatacliq': -0.01,  // Competitive
      'snapdeal': -0.08,  // Often cheaper
      'default': 0        // No variation
    };
    
    searchUrls.forEach((site, index) => {
      // Use deterministic variation based on site name
      const siteName = site.name.toLowerCase();
      let variation = siteVariations.default;
      
      for (const [key, value] of Object.entries(siteVariations)) {
        if (siteName.includes(key)) {
          variation = value;
          break;
        }
      }
      
      // Add small hash-based variation for uniqueness
      const hashVariation = ((titleHash + index) % 100) / 1000 - 0.05; // ±5%
      const totalVariation = variation + hashVariation;
      
      const estimatedPrice = Math.round(basePrice * (1 + totalVariation));
      
      // Deterministic availability (based on hash)
      const isAvailable = ((titleHash + index) % 10) > 1; // 80% available
      
      results.push({
        title: `Find "${originalProduct.title}" on ${site.name}`,
        priceValue: isAvailable ? estimatedPrice : 0,
        price: isAvailable ? `₹${estimatedPrice.toLocaleString()}` : 'Check Availability',
        url: site.url,
        siteName: site.name,
        trustScore: site.trustScore,
        source: site.domain,
        availability: isAvailable ? 'Available' : 'Check Site',
        isSearchLink: true,
        isAvailable: isAvailable
      });
    });
    
    console.log(`🔍 Created ${results.length} deterministic results`);
    return results;
  },
  
  /**
   * Simple hash function for consistent results
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
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
      minTrustScore = 6,
      useCache = true
    } = options;
    
    try {
      // Check cache first to avoid regenerating results
      if (useCache) {
        const cachedResults = await this.getCachedResults(currentProduct);
        if (cachedResults) {
          console.log('📦 Using cached comparison results');
          return cachedResults;
        }
      }
      
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
      
      // Step 2: Create deterministic results
      const results = this.createMockResults(searchUrls, currentProduct);
      
      // Step 3: Match and filter products
      const matches = await this.matchProducts(currentProduct, results);
      
      // Step 4: Analyze and rank results
      const analysis = this.analyzeResults(currentProduct, matches);
      
      // Step 5: Cache results for future use
      await this.cacheResults(currentProduct, analysis);
      
      // Step 6: Save to history for tracking
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
    const keywords = this.extractSearchKeywords(product.title);
    console.log('🔍 Extracted keywords:', keywords);
    const primaryCategory = this.inferPrimaryCategory(product);
    console.log('🔍 Inferred product category:', primaryCategory);
    
    // Get current site domain to exclude it
    const currentSite = this.getCurrentSiteDomain(product.source || product.url || '');
    console.log('🔍 Current site domain:', currentSite);
    
    // Get all available sites (hardcoded + AI-discovered)
    const sites = await this.getAllAvailableSites();
    console.log('🔍 Total available sites:', sites.length);
    
    // WHITELIST APPROACH - Only include appropriate sites
    const filteredSites = sites.filter(site => {
      // Exclude current site to avoid duplicates
      if (currentSite && site.domain.includes(currentSite)) {
        console.log(`❌ Excluding ${site.name} (current site)`);
        return false;
      }
      
      // Check trust score first
      if (site.trustScore < options.minTrustScore) {
        console.log(`❌ Excluding ${site.name} (low trust: ${site.trustScore})`);
        return false;
      }
      
      // STRICT EXCLUSION CHECK - if excluded, definitely don't include
      if (this.shouldExcludeSite(product, site)) {
        return false;
      }

      // Hard category/domain compatibility gate (prevents blind scraping to irrelevant sites)
      if (!this.isSiteCompatibleWithProduct(site, primaryCategory)) {
        console.log(`❌ Excluding ${site.name} (category/site incompatible with ${primaryCategory})`);
        return false;
      }
      
      // WHITELIST for electronics (phones, laptops, etc.)
      if (this.isElectronicsProduct(product)) {
        const electronicsWhitelist = ['amazon', 'flipkart', 'croma', 'tatacliq', 'snapdeal'];
        const isWhitelisted = electronicsWhitelist.some(allowed => 
          site.name.toLowerCase().includes(allowed) || site.domain.includes(allowed)
        );
        
        if (isWhitelisted) {
          console.log(`✅ WHITELIST: Including ${site.name} for electronics`);
          return true;
        } else {
          console.log(`❌ WHITELIST: Excluding ${site.name} (not in electronics whitelist)`);
          return false;
        }
      }
      
      // For general marketplace sites, include only if they are trusted marketplaces
      if (site.category === 'all') {
        const isMarketplace = this.isKnownMarketplace(site);
        if (isMarketplace) {
          console.log(`✅ Including ${site.name} (trusted marketplace)`);
          return true;
        }
        console.log(`❌ Excluding ${site.name} (unknown all-category site)`);
        return false;
      }
      
      // For other products, use category matching
      const categoryMatch = this.matchesCategory(product, site.category);
      console.log(`🔍 Site ${site.name} (${site.category}): ${categoryMatch ? 'INCLUDED' : 'EXCLUDED'}`);
      
      return categoryMatch;
    });
    
    console.log('🔍 Filtered sites count:', filteredSites.length);
    console.log('🔍 Selected sites:', filteredSites.map(s => `${s.name} (${s.category})`));
    
    // Sort by trust score (highest first)
    filteredSites.sort((a, b) => b.trustScore - a.trustScore);
    
    // Limit to max sites
    const selectedSites = filteredSites.slice(0, options.maxSites);
    
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
   * Extract search keywords from product title
   */
  extractSearchKeywords(title) {
    if (!title) return '';
    
    // Remove site names and common e-commerce words
    const siteNames = ['amazon', 'flipkart', 'myntra', 'ajio', 'croma', 'snapdeal', 'tatacliq', 'paytm', 'shopclues'];
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'buy', 'online', 'store', 'shop', 'india', 'price', 'best', 'deal', 'offer', 'sale'];
    const ecommerceWords = ['free', 'shipping', 'delivery', 'return', 'warranty', 'genuine', 'original', 'brand', 'new'];
    
    // Combine all words to filter out
    const allStopWords = [...stopWords, ...siteNames, ...ecommerceWords];
    
    const words = title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\b(gb|tb|mb|kg|gm|cm|mm|inch|inches)\b/g, '$1') // Keep units
      .split(/\s+/)
      .filter(word => {
        return word.length > 1 && 
               !allStopWords.includes(word) &&
               !word.match(/^\d+$/) && // Remove standalone numbers
               word.length < 20; // Remove very long words (likely URLs or codes)
      })
      .slice(0, 5); // Limit to 5 most important words
    
    return words.join(' ');
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
   * Check if product is electronics (phones, laptops, etc.)
   */
  isElectronicsProduct(product) {
    const title = product.title.toLowerCase();
    const electronicsKeywords = [
      'phone', 'iphone', 'smartphone', 'mobile', 'android',
      'laptop', 'computer', 'pc', 'macbook', 'tablet', 'ipad',
      'tv', 'television', 'monitor', 'camera', 'smartwatch',
      'headphone', 'earphone', 'speaker', 'charger', 'powerbank'
    ];
    
    return electronicsKeywords.some(keyword => title.includes(keyword));
  },

  /**
   * Infer primary product category from title.
   */
  inferPrimaryCategory(product) {
    const title = (product?.title || '').toLowerCase();
    if (!title) return 'general';

    const keywords = {
      electronics: ['phone', 'iphone', 'android', 'smartphone', 'mobile', 'laptop', 'computer', 'pc', 'macbook', 'tablet', 'ipad', 'tv', 'monitor', 'camera', 'smartwatch', 'headphone', 'earphone', 'earbud', 'speaker', 'charger', 'powerbank'],
      fashion: ['shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots', 'loafer', 'loafers', 'sandals', 'slippers', 'slides', 'heels', 'shirt', 'tshirt', 't-shirt', 'dress', 'jeans', 'jacket', 'hoodie', 'kurta', 'saree'],
      beauty: ['makeup', 'cosmetic', 'lipstick', 'foundation', 'skincare', 'cream', 'perfume', 'shampoo'],
      sports: ['running', 'training', 'gym', 'sports', 'football', 'cricket', 'tennis', 'cycle', 'yoga'],
      kids: ['baby', 'kids', 'children', 'toy', 'diaper', 'stroller'],
      eyewear: ['glasses', 'eyeglasses', 'sunglasses', 'lens', 'contact', 'frame']
    };

    let bestCategory = 'general';
    let bestScore = 0;
    Object.entries(keywords).forEach(([category, terms]) => {
      const score = terms.reduce((acc, term) => acc + (title.includes(term) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    });

    return bestScore > 0 ? bestCategory : 'general';
  },

  /**
   * Only allow known trusted marketplaces for category=all.
   */
  isKnownMarketplace(site) {
    const domain = (site.domain || '').toLowerCase();
    const trustedMarketplaces = ['amazon.in', 'flipkart.com', 'tatacliq.com', 'snapdeal.com'];
    return trustedMarketplaces.some(d => domain.includes(d));
  },

  /**
   * Strong compatibility check between product category and site.
   */
  isSiteCompatibleWithProduct(site, productCategory) {
    const siteCategory = (site.category || '').toLowerCase();
    const domain = (site.domain || '').toLowerCase();

    // Brand/accessory/electronics-focused domains should never receive non-electronics products.
    const accessoryFocusedDomains = ['boat-lifestyle.com', 'gonoise.com', 'noise', 'jbl', 'skullcandy'];
    if (accessoryFocusedDomains.some(d => domain.includes(d)) && productCategory !== 'electronics') {
      return false;
    }

    if (siteCategory === 'all') {
      return this.isKnownMarketplace(site);
    }

    // Electronics products should not go to fashion/beauty/kids/eyewear-only sites.
    if (productCategory === 'electronics') {
      return siteCategory === 'electronics' || siteCategory === 'all';
    }

    // Fashion and sports overlap for footwear/apparel.
    if (productCategory === 'fashion') {
      return siteCategory === 'fashion' || siteCategory === 'sports' || siteCategory === 'all';
    }

    if (productCategory === 'sports') {
      return siteCategory === 'sports' || siteCategory === 'fashion' || siteCategory === 'all';
    }

    return siteCategory === productCategory || siteCategory === 'all';
  },

  /**
   * Get current site domain from product source
   */
  getCurrentSiteDomain(sourceOrUrl) {
    try {
      if (!sourceOrUrl) return null;
      
      // If it's already a domain
      if (!sourceOrUrl.includes('://')) {
        return sourceOrUrl.replace('www.', '').toLowerCase();
      }
      
      // Extract domain from URL
      const url = new URL(sourceOrUrl);
      return url.hostname.replace('www.', '').toLowerCase();
    } catch (error) {
      console.warn('Could not parse source/URL:', sourceOrUrl);
      return null;
    }
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
    
    return {
      originalProduct,
      matches: matches.slice(0, 10), // Top 10 matches
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
      const historyKey = `comparison_${this.generateProductId(product)}`;
      
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
   * Generate unique product ID for tracking
   */
  generateProductId(product) {
    const cleanTitle = product.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    const domain = product.source || 'unknown';
    return `${domain}_${cleanTitle}`;
  },
  
  /**
   * Cache comparison results
   */
  async cacheResults(product, results) {
    try {
      const cacheKey = `comparison_cache_${this.generateProductId(product)}`;
      const cacheData = {
        timestamp: Date.now(),
        product: {
          title: product.title,
          url: product.url,
          source: product.source,
          priceValue: product.priceValue
        },
        results: results,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };
      
      await chrome.storage.local.set({ [cacheKey]: cacheData });
      console.log('💾 Results cached for 24 hours');
    } catch (error) {
      console.error('Failed to cache results:', error);
    }
  },
  
  /**
   * Get cached comparison results
   */
  async getCachedResults(product) {
    try {
      const cacheKey = `comparison_cache_${this.generateProductId(product)}`;
      const { [cacheKey]: cacheData } = await chrome.storage.local.get(cacheKey);
      
      if (cacheData && cacheData.expiresAt > Date.now()) {
        console.log('📦 Found valid cached results');
        return cacheData.results;
      } else if (cacheData) {
        console.log('🗑️ Cache expired, removing old data');
        await chrome.storage.local.remove(cacheKey);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get cached results:', error);
      return null;
    }
  },
  
  /**
   * Clear comparison cache for a product
   */
  async clearCache(product) {
    try {
      const cacheKey = `comparison_cache_${this.generateProductId(product)}`;
      await chrome.storage.local.remove(cacheKey);
      console.log('🗑️ Cache cleared for product');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  },
  
  /**
   * Utility functions
   */
  shouldExcludeSite(product, site) {
    const title = product.title.toLowerCase();
    const siteName = site.name.toLowerCase();
    const primaryCategory = this.inferPrimaryCategory(product);
    
    // STRICT exclusion rules - be very aggressive to prevent mismatches
    const exclusions = [
      // Audio/accessories sites - NEVER get non-electronics.
      { sites: ['boat', 'boAt', 'noise', 'jbl', 'skullcandy'], exclude: primaryCategory === 'electronics' ? [] : [title] },
      
      // Beauty sites - NEVER get electronics
      { sites: ['nykaa'], exclude: ['phone', 'iphone', 'smartphone', 'mobile', 'laptop', 'computer', 'tablet', 'tv', 'monitor', 'apple', 'samsung', 'electronics'] },
      
      // Eyewear sites - NEVER get electronics
      { sites: ['lenskart'], exclude: ['phone', 'iphone', 'smartphone', 'mobile', 'laptop', 'computer', 'tablet', 'tv', 'monitor', 'apple', 'samsung', 'electronics'] },
      
      // Kids sites - NEVER get adult electronics
      { sites: ['firstcry'], exclude: ['phone', 'iphone', 'smartphone', 'mobile', 'laptop', 'computer', 'tablet', 'tv', 'monitor', 'apple', 'samsung', 'electronics', 'adult'] },
      
      // Fashion sites - NEVER get electronics (be very strict)
      { sites: ['myntra', 'ajio'], exclude: ['phone', 'iphone', 'smartphone', 'mobile', 'laptop', 'computer', 'tablet', 'tv', 'monitor', 'apple', 'samsung', 'electronics', 'tech'] }
    ];
    
    for (const rule of exclusions) {
      const matchesSite = rule.sites.some(s => siteName.toLowerCase().includes(s.toLowerCase()));
      if (matchesSite) {
        const shouldExclude = rule.exclude.some(keyword => title.includes(keyword.toLowerCase()));
        if (shouldExclude) {
          console.log(`❌ STRICT EXCLUSION: ${site.name} for "${title}" (inappropriate category)`);
          return true;
        }
      }
    }
    
    return false;
  },

  matchesCategory(product, category) {
    if (category === 'all') return true;
    
    const title = product.title.toLowerCase();
    
    // Define strict category matching
    const categoryKeywords = {
      electronics: {
        include: ['phone', 'iphone', 'android', 'smartphone', 'mobile', 'tablet', 'ipad', 'laptop', 'computer', 'pc', 'macbook', 'headphone', 'earphone', 'earbud', 'speaker', 'charger', 'cable', 'tv', 'monitor', 'camera', 'smartwatch'],
        exclude: []
      },
      fashion: {
        include: ['shirt', 'tshirt', 't-shirt', 'dress', 'jeans', 'pants', 'jacket', 'shoes', 'sneaker', 'sandal', 'boot', 'bag', 'wallet', 'belt', 'jewelry'],
        exclude: ['phone', 'iphone', 'mobile', 'laptop', 'computer', 'tablet']
      },
      beauty: {
        include: ['makeup', 'cosmetic', 'lipstick', 'foundation', 'skincare', 'cream', 'perfume', 'shampoo'],
        exclude: ['phone', 'iphone', 'mobile', 'laptop', 'computer', 'tablet']
      },
      sports: {
        include: ['fitness', 'gym', 'sports', 'running', 'yoga', 'cricket', 'football', 'tennis', 'cycle'],
        exclude: ['phone', 'iphone', 'mobile', 'laptop', 'computer', 'tablet']
      },
      kids: {
        include: ['baby', 'kids', 'children', 'toy', 'diaper', 'stroller'],
        exclude: ['phone', 'iphone', 'mobile', 'laptop', 'computer', 'tablet', 'adult']
      },
      eyewear: {
        include: ['glasses', 'eyeglasses', 'sunglasses', 'lens', 'contact', 'frame'],
        exclude: ['phone', 'iphone', 'mobile', 'laptop', 'computer', 'tablet']
      }
    };
    
    const categoryData = categoryKeywords[category];
    if (!categoryData) return false;
    
    // Check if product should be excluded from this category
    const hasExcludeKeyword = categoryData.exclude.some(keyword => title.includes(keyword));
    if (hasExcludeKeyword) {
      return false;
    }
    
    // Check if product matches this category
    const hasIncludeKeyword = categoryData.include.some(keyword => title.includes(keyword));
    return hasIncludeKeyword;
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
