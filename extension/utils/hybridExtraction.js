/**
 * Hybrid Extraction System
 * Priority: Universal Extraction (fast) → AI Extraction (fallback)
 */

/**
 * Hybrid Product Extractor
 * Combines universal extraction with AI fallback
 */
const HybridExtractor = {
  
  /**
   * Extract product data using hybrid approach
   * @param {string} html - Page HTML
   * @param {string} url - Page URL
   * @returns {Object} Product data with confidence score
   */
  async extractProductData(html, url) {
    console.log('🔄 Starting hybrid extraction for:', url);
    
    try {
      // Step 1: Try Universal Extraction (Fast)
      const universalResult = await this.tryUniversalExtraction(html, url);
      
      if (this.isExtractionValid(universalResult)) {
        console.log('✅ Universal extraction successful');
        return {
          ...universalResult,
          extractionMethod: 'universal',
          confidence: this.calculateUniversalConfidence(universalResult),
          extractedAt: Date.now()
        };
      }
      
      console.log('⚠️ Universal extraction failed or incomplete, trying AI...');
      
      // Step 2: Fallback to AI Extraction (Smart)
      const aiResult = await this.tryAIExtraction(html, url);
      
      if (this.isExtractionValid(aiResult)) {
        console.log('✅ AI extraction successful');
        return {
          ...aiResult,
          extractionMethod: 'ai',
          extractedAt: Date.now()
        };
      }
      
      console.log('❌ Both extraction methods failed');
      
      // Step 3: Return partial data if available
      return this.createFallbackResult(universalResult, aiResult, url);
      
    } catch (error) {
      console.error('❌ Hybrid extraction error:', error);
      return this.createErrorResult(url, error);
    }
  },
  
  /**
   * Try universal extraction (teammate's method)
   */
  async tryUniversalExtraction(html, url) {
    try {
      // Create a temporary DOM to simulate the page
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Simulate the universal extraction logic from content.js
      const result = {
        title: this.extractUniversalTitle(doc, url),
        price: this.extractUniversalPrice(doc, url),
        currency: this.detectCurrency(doc, url),
        originalPrice: this.extractOriginalPrice(doc),
        stock: this.extractStock(doc),
        rating: this.extractRating(doc),
        reviews: this.extractReviews(doc),
        seller: this.extractSeller(doc, url),
        image: this.extractImage(doc, url)
      };
      
      console.log('🔍 Universal extraction result:', result);
      return result;
      
    } catch (error) {
      console.error('Universal extraction failed:', error);
      return null;
    }
  },
  
  /**
   * Extract title using universal method
   */
  extractUniversalTitle(doc, url) {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // Site-specific selectors (from teammate's code)
    if (hostname.includes('amazon')) {
      const title = doc.querySelector('#productTitle')?.textContent?.trim();
      if (title) return title;
    }
    
    if (hostname.includes('flipkart')) {
      const selectors = ['span.VU-ZEz', '._35KyD6', '.B_NuCI'];
      for (const selector of selectors) {
        const title = doc.querySelector(selector)?.textContent?.trim();
        if (title) return title;
      }
    }
    
    if (hostname.includes('myntra')) {
      const brand = doc.querySelector('.pdp-title, .pdp-brand, h1.pdp-name')?.textContent?.trim();
      const product = doc.querySelector('.pdp-name, .product-name')?.textContent?.trim();
      if (brand && product) return `${brand} ${product}`;
    }
    
    // Generic fallback (works on any site)
    const genericSelectors = [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'h1',
      'title'
    ];
    
    for (const selector of genericSelectors) {
      let title = '';
      if (selector === 'title') {
        title = doc.title;
      } else if (selector.startsWith('meta')) {
        title = doc.querySelector(selector)?.getAttribute('content');
      } else {
        title = doc.querySelector(selector)?.textContent?.trim();
      }
      
      if (title && title.length > 10) {
        return title;
      }
    }
    
    return null;
  },
  
  /**
   * Extract price using universal method
   */
  extractUniversalPrice(doc, url) {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // Site-specific price selectors
    const priceSelectors = [];
    
    if (hostname.includes('amazon')) {
      priceSelectors.push('.a-price-whole', '.a-offscreen', '#priceblock_dealprice');
    } else if (hostname.includes('flipkart')) {
      priceSelectors.push('._30jeq3._16Jk6d', '._1_WHN1', '.CEmiEU');
    } else if (hostname.includes('myntra')) {
      priceSelectors.push('.pdp-price', '.product-discountedPrice');
    }
    
    // Generic price selectors (work on most sites)
    priceSelectors.push(
      '[class*="price"]',
      '[id*="price"]',
      '.price',
      '.cost',
      '.amount',
      '[data-testid*="price"]'
    );
    
    for (const selector of priceSelectors) {
      const elements = doc.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent?.trim();
        const price = this.parsePrice(text);
        if (price && price > 0) {
          return price;
        }
      }
    }
    
    return null;
  },
  
  /**
   * Parse price from text
   */
  parsePrice(text) {
    if (!text) return null;
    
    // Remove common currency symbols and clean text
    const cleaned = text.replace(/[₹$€£,\s]/g, '');
    
    // Extract number
    const match = cleaned.match(/(\d+(?:\.\d{1,2})?)/);
    if (match) {
      const price = parseFloat(match[1]);
      return isNaN(price) ? null : price;
    }
    
    return null;
  },
  
  /**
   * Detect currency from page
   */
  detectCurrency(doc, url) {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // Domain-based detection
    if (hostname.includes('.in') || hostname.includes('flipkart') || hostname.includes('myntra')) {
      return 'INR';
    }
    if (hostname.includes('.com') && !hostname.includes('.co.')) return 'USD';
    if (hostname.includes('.co.uk')) return 'GBP';
    if (hostname.includes('.de') || hostname.includes('.fr')) return 'EUR';
    
    // Content-based detection
    const bodyText = doc.body?.textContent || '';
    if (bodyText.includes('₹')) return 'INR';
    if (bodyText.includes('$') && !bodyText.includes('₹')) return 'USD';
    if (bodyText.includes('£')) return 'GBP';
    if (bodyText.includes('€')) return 'EUR';
    
    return 'USD'; // Default
  },
  
  /**
   * Extract other product details
   */
  extractOriginalPrice(doc) {
    const selectors = [
      '.a-text-strike', '.original-price', '[class*="original"]',
      '[class*="mrp"]', '[class*="strike"]'
    ];
    
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const price = this.parsePrice(element.textContent);
        if (price) return price;
      }
    }
    
    return null;
  },
  
  extractStock(doc) {
    const stockTexts = doc.body?.textContent?.toLowerCase() || '';
    
    if (stockTexts.includes('in stock') || stockTexts.includes('available')) {
      return 'In stock';
    }
    if (stockTexts.includes('out of stock') || stockTexts.includes('unavailable')) {
      return 'Out of stock';
    }
    
    return 'Unknown';
  },
  
  extractRating(doc) {
    const selectors = [
      '[class*="rating"]', '[class*="star"]', '[data-testid*="rating"]'
    ];
    
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim();
        const match = text?.match(/(\d+(?:\.\d+)?)/);
        if (match) {
          const rating = parseFloat(match[1]);
          if (rating >= 0 && rating <= 5) return rating;
        }
      }
    }
    
    return null;
  },
  
  extractReviews(doc) {
    const selectors = [
      '[class*="review"]', '[class*="rating"]'
    ];
    
    for (const selector of selectors) {
      const elements = doc.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent?.trim();
        const match = text?.match(/(\d+(?:,\d+)*)\s*(?:review|rating)/i);
        if (match) {
          return parseInt(match[1].replace(/,/g, ''));
        }
      }
    }
    
    return null;
  },
  
  extractSeller(doc, url) {
    const hostname = new URL(url).hostname.replace('www.', '');
    
    // Try to find seller info
    const selectors = [
      '[class*="seller"]', '[class*="brand"]', '[class*="store"]'
    ];
    
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const seller = element.textContent?.trim();
        if (seller && seller.length > 2) return seller;
      }
    }
    
    // Fallback to domain name
    return hostname.split('.')[0];
  },
  
  extractImage(doc, url) {
    const selectors = [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      '[class*="product"] img',
      '[class*="main"] img'
    ];
    
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const src = element.getAttribute('content') || element.getAttribute('src');
        if (src) {
          // Convert relative URLs to absolute
          try {
            return new URL(src, url).href;
          } catch {
            continue;
          }
        }
      }
    }
    
    return null;
  },
  
  /**
   * Try AI extraction as fallback
   */
  async tryAIExtraction(html, url) {
    try {
      // Use our existing AI extraction
      if (typeof extractProductData === 'function') {
        return await extractProductData(html, url);
      }
      
      console.warn('AI extraction not available');
      return null;
      
    } catch (error) {
      console.error('AI extraction failed:', error);
      return null;
    }
  },
  
  /**
   * Check if extraction result is valid
   */
  isExtractionValid(result) {
    if (!result) return false;
    
    // Must have at least title and price
    return result.title && 
           result.title.length > 5 && 
           result.price && 
           result.price > 0;
  },
  
  /**
   * Calculate confidence for universal extraction
   */
  calculateUniversalConfidence(result) {
    let confidence = 0.5; // Base confidence
    
    if (result.title && result.title.length > 10) confidence += 0.2;
    if (result.price && result.price > 0) confidence += 0.2;
    if (result.stock && result.stock !== 'Unknown') confidence += 0.1;
    if (result.rating && result.rating > 0) confidence += 0.1;
    if (result.seller && result.seller.length > 2) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  },
  
  /**
   * Create fallback result when both methods fail
   */
  createFallbackResult(universalResult, aiResult, url) {
    const hostname = new URL(url).hostname.replace('www.', '');
    
    return {
      title: universalResult?.title || aiResult?.title || `Product from ${hostname}`,
      price: universalResult?.price || aiResult?.price || null,
      currency: universalResult?.currency || aiResult?.currency || 'USD',
      stock: universalResult?.stock || aiResult?.stock || 'Unknown',
      seller: universalResult?.seller || aiResult?.seller || hostname,
      extractionMethod: 'fallback',
      confidence: 0.3,
      extractedAt: Date.now(),
      error: 'Partial extraction - some data may be missing'
    };
  },
  
  /**
   * Create error result
   */
  createErrorResult(url, error) {
    const hostname = new URL(url).hostname.replace('www.', '');
    
    return {
      title: `Product from ${hostname}`,
      price: null,
      currency: 'USD',
      stock: 'Unknown',
      seller: hostname,
      extractionMethod: 'error',
      confidence: 0.1,
      extractedAt: Date.now(),
      error: error.message
    };
  },
  
  /**
   * Get extraction statistics
   */
  getStats() {
    // This would be enhanced with actual usage tracking
    return {
      totalExtractions: 0,
      universalSuccess: 0,
      aiSuccess: 0,
      failures: 0,
      averageConfidence: 0
    };
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HybridExtractor;
}