/**
 * Enhanced Content Script with Hybrid Extraction
 * Integrates universal extraction + AI fallback + site management
 */

// Import our utility modules
// Note: In a real extension, these would be loaded via manifest or dynamic imports

/**
 * Enhanced Product Extractor
 * Uses hybrid approach: Universal → AI → Fallback
 */
class EnhancedProductExtractor {
  constructor() {
    this.config = null;
    this.initialized = false;
  }
  
  /**
   * Initialize the extractor
   */
  async init() {
    try {
      // Load configuration
      this.config = await this.loadConfig();
      this.initialized = true;
      console.log('✅ Enhanced extractor initialized');
    } catch (error) {
      console.error('❌ Failed to initialize extractor:', error);
    }
  }
  
  /**
   * Load configuration from storage
   */
  async loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['geminiApiKey', 'extractionSettings'], (result) => {
        resolve({
          apiKey: result.geminiApiKey || null,
          settings: result.extractionSettings || {
            preferUniversal: true,
            enableAIFallback: true,
            timeout: 10000
          }
        });
      });
    });
  }
  
  /**
   * Main extraction method
   */
  async extractProduct() {
    if (!this.initialized) {
      await this.init();
    }
    
    console.log('🔄 Starting enhanced product extraction...');
    
    try {
      // Step 1: Try Universal Extraction (Fast)
      const universalResult = await this.tryUniversalExtraction();
      
      if (this.isValidExtraction(universalResult)) {
        console.log('✅ Universal extraction successful');
        return this.formatResult(universalResult, 'universal');
      }
      
      console.log('⚠️ Universal extraction incomplete, trying AI fallback...');
      
      // Step 2: Try AI Extraction (if API key available)
      if (this.config.apiKey && this.config.settings.enableAIFallback) {
        const aiResult = await this.tryAIExtraction();
        
        if (this.isValidExtraction(aiResult)) {
          console.log('✅ AI extraction successful');
          return this.formatResult(aiResult, 'ai');
        }
      }
      
      console.log('⚠️ Both methods failed, using fallback...');
      
      // Step 3: Fallback extraction
      return this.createFallbackResult();
      
    } catch (error) {
      console.error('❌ Extraction error:', error);
      return this.createErrorResult(error);
    }
  }
  
  /**
   * Universal extraction (teammate's method enhanced)
   */
  async tryUniversalExtraction() {
    const url = window.location.href;
    const hostname = window.location.hostname.toLowerCase();
    
    console.log('🔍 Trying universal extraction for:', hostname);
    
    const result = {
      title: this.extractTitle(hostname),
      price: this.extractPrice(hostname),
      currency: this.detectCurrency(hostname),
      originalPrice: this.extractOriginalPrice(),
      stock: this.extractStock(),
      rating: this.extractRating(),
      reviews: this.extractReviews(),
      seller: this.extractSeller(hostname),
      image: this.extractImage(),
      url: url,
      source: hostname.replace('www.', ''),
      extractedAt: Date.now()
    };
    
    // Calculate confidence
    result.confidence = this.calculateConfidence(result);
    
    console.log('🔍 Universal extraction result:', result);
    return result;
  }
  
  /**
   * Enhanced title extraction
   */
  extractTitle(hostname) {
    // Site-specific extraction (from teammate's code)
    if (hostname.includes('amazon')) {
      const title = document.querySelector('#productTitle')?.textContent?.trim();
      if (title) return title;
    }
    
    if (hostname.includes('flipkart')) {
      const selectors = ['span.VU-ZEz', '._35KyD6', '.B_NuCI', '._4rR01T'];
      for (const selector of selectors) {
        const title = document.querySelector(selector)?.textContent?.trim();
        if (title) return title;
      }
    }
    
    if (hostname.includes('myntra')) {
      const brand = document.querySelector('.pdp-title, .pdp-brand, h1.pdp-name')?.textContent?.trim();
      const product = document.querySelector('.pdp-name, .product-name')?.textContent?.trim();
      if (brand && product) return `${brand} ${product}`;
    }
    
    // Enhanced generic extraction
    const selectors = [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'h1[class*="product"]',
      'h1[class*="title"]',
      '.product-title',
      '.product-name',
      'h1',
      'title'
    ];
    
    for (const selector of selectors) {
      let title = '';
      
      if (selector === 'title') {
        title = document.title;
      } else if (selector.startsWith('meta')) {
        title = document.querySelector(selector)?.getAttribute('content');
      } else {
        title = document.querySelector(selector)?.textContent?.trim();
      }
      
      if (title && title.length > 10 && !this.isGenericTitle(title)) {
        return this.cleanTitle(title);
      }
    }
    
    return null;
  }
  
  /**
   * Enhanced price extraction
   */
  extractPrice(hostname) {
    // Site-specific selectors
    let selectors = [];
    
    if (hostname.includes('amazon')) {
      selectors = ['.a-price-whole', '.a-offscreen', '#priceblock_dealprice', '.a-price .a-offscreen'];
    } else if (hostname.includes('flipkart')) {
      selectors = ['._30jeq3._16Jk6d', '._1_WHN1', '.CEmiEU', '._16Jk6d'];
    } else if (hostname.includes('myntra')) {
      selectors = ['.pdp-price', '.product-discountedPrice', '.pdp-mrp'];
    }
    
    // Generic selectors for unknown sites
    selectors.push(
      '[class*="price"]:not([class*="original"]):not([class*="strike"])',
      '[id*="price"]',
      '.price',
      '.cost',
      '.amount',
      '[data-testid*="price"]',
      '[data-price]'
    );
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const price = this.parsePrice(element.textContent);
        if (price && price > 0) {
          return price;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Parse price from text with enhanced logic
   */
  parsePrice(text) {
    if (!text) return null;
    
    const cleaned = text.replace(/[₹$€£,\s]/g, '');
    
    // Handle Indian formats (lakh, crore)
    const lakhMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac)/i);
    if (lakhMatch) {
      return parseFloat(lakhMatch[1]) * 100000;
    }
    
    const croreMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*crore/i);
    if (croreMatch) {
      return parseFloat(croreMatch[1]) * 10000000;
    }
    
    // Regular price extraction
    const match = cleaned.match(/(\d+(?:\.\d{1,2})?)/);
    if (match) {
      const price = parseFloat(match[1]);
      return isNaN(price) ? null : price;
    }
    
    return null;
  }
  
  /**
   * Enhanced currency detection
   */
  detectCurrency(hostname) {
    // Domain-based detection
    if (hostname.includes('.in') || hostname.includes('flipkart') || hostname.includes('myntra')) {
      return 'INR';
    }
    if (hostname.includes('.com') && !hostname.includes('.co.')) return 'USD';
    if (hostname.includes('.co.uk')) return 'GBP';
    if (hostname.includes('.de') || hostname.includes('.fr')) return 'EUR';
    
    // Content-based detection
    const bodyText = document.body?.textContent || '';
    if (bodyText.includes('₹')) return 'INR';
    if (bodyText.includes('$') && !bodyText.includes('₹')) return 'USD';
    if (bodyText.includes('£')) return 'GBP';
    if (bodyText.includes('€')) return 'EUR';
    
    return 'INR'; // Default for Indian extension
  }
  
  /**
   * Extract other product details with enhanced logic
   */
  extractOriginalPrice() {
    const selectors = [
      '.a-text-strike', '.original-price', '[class*="original"]',
      '[class*="mrp"]', '[class*="strike"]', '[class*="crossed"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const price = this.parsePrice(element.textContent);
        if (price) return price;
      }
    }
    
    return null;
  }
  
  extractStock() {
    const stockText = document.body?.textContent?.toLowerCase() || '';
    
    if (stockText.includes('in stock') || stockText.includes('available now')) {
      return 'In stock';
    }
    if (stockText.includes('out of stock') || stockText.includes('unavailable') || stockText.includes('sold out')) {
      return 'Out of stock';
    }
    if (stockText.includes('limited stock') || stockText.includes('few left')) {
      return 'Limited stock';
    }
    
    return 'Unknown';
  }
  
  extractRating() {
    const selectors = [
      '[class*="rating"]', '[class*="star"]', '[data-testid*="rating"]',
      '.rating', '.stars', '[aria-label*="star"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim() || element.getAttribute('aria-label') || '';
        const match = text.match(/(\d+(?:\.\d+)?)/);
        if (match) {
          const rating = parseFloat(match[1]);
          if (rating >= 0 && rating <= 5) return rating;
        }
      }
    }
    
    return null;
  }
  
  extractReviews() {
    const selectors = [
      '[class*="review"]', '[class*="rating"]', '[data-testid*="review"]'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent?.trim();
        const match = text?.match(/(\d+(?:,\d+)*)\s*(?:review|rating)/i);
        if (match) {
          return parseInt(match[1].replace(/,/g, ''));
        }
      }
    }
    
    return null;
  }
  
  extractSeller(hostname) {
    const selectors = [
      '[class*="seller"]', '[class*="brand"]', '[class*="store"]',
      '.seller', '.brand', '.store-name'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const seller = element.textContent?.trim();
        if (seller && seller.length > 2 && !this.isGenericSeller(seller)) {
          return seller;
        }
      }
    }
    
    // Fallback to domain name
    return hostname.replace('www.', '').split('.')[0];
  }
  
  extractImage() {
    const selectors = [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      '[class*="product"] img[src*="product"]',
      '[class*="main"] img',
      '.product-image img',
      'img[alt*="product"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const src = element.getAttribute('content') || element.getAttribute('src');
        if (src && this.isValidImageUrl(src)) {
          try {
            return new URL(src, window.location.href).href;
          } catch {
            continue;
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * AI extraction fallback
   */
  async tryAIExtraction() {
    try {
      console.log('🤖 Trying AI extraction...');
      
      // Get page HTML
      const html = document.documentElement.outerHTML;
      
      // Call AI extraction (would need to be implemented)
      // This is a placeholder for the actual AI call
      const aiResult = await this.callAIExtraction(html);
      
      return aiResult;
      
    } catch (error) {
      console.error('AI extraction failed:', error);
      return null;
    }
  }
  
  /**
   * Call AI extraction service
   */
  async callAIExtraction(html) {
    try {
      console.log('🤖 Calling Gemini API for extraction...');
      
      // Check if we have API key
      if (!this.config || !this.config.apiKey) {
        console.log('❌ No API key configured for AI extraction');
        return null;
      }
      
      // Use our existing AI extraction function
      if (typeof extractProductData === 'function') {
        console.log('🤖 Using extractProductData function...');
        const result = await extractProductData(html, window.location.href);
        console.log('🤖 AI extraction result:', result);
        return result;
      } else {
        console.log('❌ extractProductData function not available');
        
        // Fallback: Call Gemini API directly
        return await this.callGeminiDirectly(html);
      }
      
    } catch (error) {
      console.error('🤖 AI extraction failed:', error);
      return null;
    }
  }
  
  /**
   * Call Gemini API directly from content script
   */
  async callGeminiDirectly(html) {
    try {
      console.log('🤖 Calling Gemini API directly...');
      
      // Clean HTML for API call
      const cleanHtml = html.substring(0, 10000); // Limit size
      
      const prompt = `
Extract product details from this e-commerce page HTML.
Return JSON with: title, price, currency, originalPrice, discount, stock, rating, reviews, seller, image, confidence.

HTML: ${cleanHtml}
`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });
      
      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }
      
      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text;
      
      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        console.log('🤖 Gemini API result:', result);
        return result;
      }
      
      throw new Error('No valid JSON in Gemini response');
      
    } catch (error) {
      console.error('🤖 Direct Gemini API call failed:', error);
      return null;
    }
  }
  
  /**
   * Validation and utility methods
   */
  isValidExtraction(result) {
    return result && 
           result.title && 
           result.title.length > 5 && 
           result.price && 
           result.price > 0;
  }
  
  calculateConfidence(result) {
    let confidence = 0.3; // Base confidence
    
    if (result.title && result.title.length > 10) confidence += 0.2;
    if (result.price && result.price > 0) confidence += 0.2;
    if (result.stock && result.stock !== 'Unknown') confidence += 0.1;
    if (result.rating && result.rating > 0) confidence += 0.1;
    if (result.seller && result.seller.length > 2) confidence += 0.1;
    if (result.image) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }
  
  isGenericTitle(title) {
    const generic = ['home', 'shop', 'store', 'buy', 'online', 'ecommerce'];
    return generic.some(word => title.toLowerCase().includes(word));
  }
  
  isGenericSeller(seller) {
    const generic = ['seller', 'store', 'shop', 'online', 'ecommerce'];
    return generic.some(word => seller.toLowerCase().includes(word));
  }
  
  isValidImageUrl(url) {
    return url && 
           url.length > 10 && 
           (url.includes('.jpg') || url.includes('.png') || url.includes('.webp'));
  }
  
  cleanTitle(title) {
    // Remove common suffixes
    return title
      .replace(/\s*-\s*[^-]*$/, '') // Remove " - Site Name"
      .replace(/\s*\|\s*[^|]*$/, '') // Remove " | Site Name"
      .trim();
  }
  
  /**
   * Format final result
   */
  formatResult(result, method) {
    return {
      ...result,
      extractionMethod: method,
      success: true,
      timestamp: Date.now()
    };
  }
  
  /**
   * Create fallback result
   */
  createFallbackResult() {
    const hostname = window.location.hostname.replace('www.', '');
    
    return {
      title: document.title || `Product from ${hostname}`,
      price: null,
      currency: this.detectCurrency(hostname),
      stock: 'Unknown',
      seller: hostname.split('.')[0],
      url: window.location.href,
      source: hostname,
      extractionMethod: 'fallback',
      confidence: 0.2,
      success: false,
      error: 'Could not extract complete product data',
      timestamp: Date.now()
    };
  }
  
  /**
   * Create error result
   */
  createErrorResult(error) {
    const hostname = window.location.hostname.replace('www.', '');
    
    return {
      title: `Error extracting from ${hostname}`,
      price: null,
      currency: 'INR',
      stock: 'Unknown',
      seller: hostname,
      url: window.location.href,
      source: hostname,
      extractionMethod: 'error',
      confidence: 0.1,
      success: false,
      error: error.message,
      timestamp: Date.now()
    };
  }
}

// Initialize enhanced extractor
const enhancedExtractor = new EnhancedProductExtractor();

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PICKSY_SCRAPE') {
    console.log('📨 Enhanced content script received scrape request');
    
    enhancedExtractor.extractProduct()
      .then(result => {
        console.log('✅ Enhanced extraction complete:', result);
        
        // Send result back to background
        chrome.runtime.sendMessage({
          type: 'PICKSY_SCRAPE_RESULT',
          payload: result
        });
        
        sendResponse(result);
      })
      .catch(error => {
        console.error('❌ Enhanced extraction failed:', error);
        const errorResult = enhancedExtractor.createErrorResult(error);
        sendResponse(errorResult);
      });
    
    return true; // Keep message channel open for async response
  }
  
  // Handle test commands
  if (message.type === 'PICKSY_TEST') {
    console.log('🧪 Test command received:', message.testType);
    
    handleTestCommand(message.testType, message.options)
      .then(result => {
        console.log('🧪 Test result:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('🧪 Test failed:', error);
        sendResponse({ error: error.message });
      });
    
    return true; // Keep message channel open for async response
  }
});

/**
 * Handle test commands for hybrid system testing
 */
async function handleTestCommand(testType, options = {}) {
  const startTime = Date.now();
  
  try {
    let result = null;
    
    switch (testType) {
      case 'TEST_UNIVERSAL_ONLY':
        console.log('🧪 Testing universal extraction only...');
        result = await enhancedExtractor.tryUniversalExtraction();
        if (result) {
          result.extractionMethod = 'universal';
          result.extractionTime = Date.now() - startTime;
        }
        break;
        
      case 'TEST_AI_ONLY':
        console.log('🧪 Testing AI extraction only...');
        result = await enhancedExtractor.tryAIExtraction();
        if (result) {
          result.extractionMethod = 'ai';
          result.extractionTime = Date.now() - startTime;
        }
        break;
        
      case 'TEST_FALLBACK_ONLY':
        console.log('🧪 Testing fallback extraction only...');
        result = enhancedExtractor.createFallbackResult();
        result.extractionTime = Date.now() - startTime;
        break;
        
      case 'TEST_HYBRID_FLOW':
        console.log('🧪 Testing full hybrid flow...');
        // Force AI fallback if requested
        if (options.forceAI) {
          const originalMethod = enhancedExtractor.tryUniversalExtraction;
          enhancedExtractor.tryUniversalExtraction = async () => null;
          result = await enhancedExtractor.extractProduct();
          enhancedExtractor.tryUniversalExtraction = originalMethod;
        } else {
          result = await enhancedExtractor.extractProduct();
        }
        result.extractionTime = Date.now() - startTime;
        break;
        
      default:
        throw new Error(`Unknown test type: ${testType}`);
    }
    
    // Add test metadata
    if (result) {
      result.testMetadata = {
        testType: testType,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent.substring(0, 100),
        options: options
      };
    }
    
    return result;
    
  } catch (error) {
    console.error(`🧪 Test ${testType} failed:`, error);
    return {
      error: error.message,
      testType: testType,
      extractionTime: Date.now() - startTime
    };
  }
}

// Listen for direct test messages from page console
window.addEventListener('message', (event) => {
  if (event.data.type === 'PICKSY_TEST_DIRECT') {
    console.log('🧪 Direct test command received:', event.data.testType);
    
    handleTestCommand(event.data.testType, event.data.options || {})
      .then(result => {
        console.log('🧪 Direct test result:', result);
        // Post result back to page
        window.postMessage({
          type: 'PICKSY_TEST_RESULT',
          result: result
        }, '*');
      })
      .catch(error => {
        console.error('🧪 Direct test failed:', error);
        window.postMessage({
          type: 'PICKSY_TEST_RESULT',
          result: { error: error.message }
        }, '*');
      });
  }
});

console.log('🚀 Enhanced content script loaded with hybrid extraction');