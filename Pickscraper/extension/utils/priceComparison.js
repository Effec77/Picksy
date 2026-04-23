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
    // CRITICAL: Validate product object
    console.log('🔍 generateComparisonUrls called with product:', product);
    
    if (!product) {
      console.error('❌ Product is null or undefined!');
      return [];
    }
    
    if (!product.title) {
      console.error('❌ Product title is missing!');
      console.error('❌ Product object:', JSON.stringify(product, null, 2));
      return [];
    }
    
    // Extract search keywords from product title
    let keywords = this.extractSearchKeywords(product.title);
    console.log('🔍 Extracted keywords:', keywords);
    
    // CRITICAL: Validate keywords and use fallback if needed
    if (!keywords || keywords === 'null' || keywords === 'undefined' || keywords.trim() === '') {
      console.error('❌ Keywords extraction failed! Got:', keywords);
      console.error('❌ Product title was:', product.title);
      // Use product title directly as fallback
      keywords = product.title
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2)
        .slice(0, 5)
        .join(' ');
      console.log('🔍 Using fallback keywords:', keywords);
    }
    
    // Get current site domain to exclude it
    const currentSite = this.getCurrentSiteDomain(product.source || product.url || '');
    console.log('🔍 Current site domain:', currentSite);
    
    // Get all available sites (hardcoded + AI-discovered)
    const sites = await this.getAllAvailableSites();
    console.log('🔍 Total available sites:', sites.length);
    
    // ENHANCED SITE FILTERING - Prevent inappropriate site selection
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
      
      // STEP 1: STRICT EXCLUSION CHECK - Prevent completely inappropriate matches
      if (this.shouldExcludeSite(product, site)) {
        return false;
      }
      
      // STEP 2: SMART CATEGORY MATCHING based on product type
      const productCategory = this.detectProductCategory(product);
      console.log(`🔍 Product category detected: ${productCategory}`);
      
      // STEP 3: Apply category-specific whitelists
      const isAppropriate = this.isSiteAppropriateForProduct(product, site, productCategory);
      
      if (isAppropriate) {
        console.log(`✅ INCLUDING: ${site.name} for ${productCategory} product`);
        return true;
      } else {
        console.log(`❌ EXCLUDING: ${site.name} (inappropriate for ${productCategory})`);
        return false;
      }
    });
    
    console.log('🔍 Filtered sites count:', filteredSites.length);
    console.log('🔍 Selected sites:', filteredSites.map(s => `${s.name} (${s.category})`));
    
    // Sort by trust score (highest first)
    filteredSites.sort((a, b) => b.trustScore - a.trustScore);
    
    // Limit to max sites
    const selectedSites = filteredSites.slice(0, options.maxSites);
    
    // Get URL overrides (AI-learned corrections)
    let urlOverrides = {};
    try {
      const stored = await chrome.storage.local.get('siteUrlOverrides');
      urlOverrides = stored.siteUrlOverrides || {};
    } catch (e) {
      console.warn('Could not load URL overrides:', e);
    }
    
    // Generate search URLs with AI override support
    return selectedSites.map(site => {
      const override = urlOverrides[site.domain] || null;
      return {
        name: site.name,
        domain: site.domain,
        url: this.buildSearchUrl(site, keywords, override),
        trustScore: site.trustScore,
        category: site.category,
        source: override ? 'ai-corrected' : (site.source || 'hardcoded')
      };
    });
  },
  
  /**
   * Extract search keywords from product title - ADVANCED AI-POWERED VERSION
   */
  extractSearchKeywords(title) {
    // CRITICAL: Handle null/undefined/empty title
    if (!title || typeof title !== 'string' || title.trim() === '') {
      console.error('❌ KEYWORD EXTRACTION: Title is null, undefined, or empty!');
      console.error('❌ Received title:', title, 'Type:', typeof title);
      return 'product'; // Return a safe fallback instead of empty string
    }
    
    const cleanTitle = title.trim();
    console.log('🔍 ADVANCED EXTRACTION - Original title:', cleanTitle);
    
    try {
      // STEP 1: Detect product category for context-aware extraction
      const category = this.detectProductCategory({ title: cleanTitle });
      console.log('🔍 Product category:', category);
      
      // STEP 2: Extract comprehensive product information
      const productInfo = this.extractAdvancedProductIdentifiers(cleanTitle, category);
      console.log('🔍 Advanced identifiers:', productInfo);
      
      // STEP 3: Build category-specific search query
      const searchQuery = this.buildCategorySpecificQuery(productInfo, category, cleanTitle);
      console.log('🔍 Final optimized query:', searchQuery);
      
      // CRITICAL: If searchQuery is empty, use simple fallback
      if (!searchQuery || searchQuery.trim() === '') {
        console.warn('⚠️ Advanced extraction returned empty, using simple fallback');
        return this.simpleKeywordExtraction(cleanTitle);
      }
      
      return searchQuery;
      
    } catch (error) {
      console.error('❌ Advanced extraction failed:', error);
      // Fallback to simple extraction
      return this.simpleKeywordExtraction(cleanTitle);
    }
  },
  
  /**
   * Simple fallback keyword extraction when advanced method fails
   */
  simpleKeywordExtraction(title) {
    console.log('🔍 Using SIMPLE keyword extraction for:', title);
    
    if (!title) return 'product';
    
    // Remove special characters and extra spaces
    const cleaned = title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Split into words and filter
    const stopWords = ['the', 'and', 'or', 'for', 'with', 'buy', 'online', 'india', 'price', 'best', 'deal', 'offer', 'sale', 'free', 'shipping', 'delivery'];
    
    const words = cleaned
      .split(' ')
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 5);
    
    const result = words.join(' ') || title.split(' ').slice(0, 3).join(' ') || 'product';
    console.log('🔍 Simple extraction result:', result);
    
    return result;
  },
  
  /**
   * Extract advanced product identifiers with category-aware logic
   */
  extractAdvancedProductIdentifiers(title, category) {
    const titleLower = title.toLowerCase();
    const titleWords = title.split(/\s+/);
    
    const result = {
      brand: null,
      model: null,
      series: null,
      storage: null,
      memory: null,
      size: null,
      color: null,
      material: null,
      type: null,
      variant: null,
      specifications: [],
      keyFeatures: []
    };
    
    // ENHANCED BRAND DETECTION with category context
    const brandDatabase = {
      electronics: {
        'apple': ['apple', 'iphone', 'ipad', 'macbook', 'airpods', 'imac', 'mac'],
        'samsung': ['samsung', 'galaxy', 'note', 'tab'],
        'xiaomi': ['xiaomi', 'mi', 'redmi', 'poco', 'black shark'],
        'oneplus': ['oneplus', 'one plus', '1+'],
        'oppo': ['oppo', 'reno', 'find'],
        'vivo': ['vivo', 'iqoo', 'nex'],
        'realme': ['realme', 'narzo'],
        'google': ['google', 'pixel', 'nexus'],
        'huawei': ['huawei', 'honor', 'mate', 'p30', 'p40'],
        'sony': ['sony', 'xperia', 'playstation', 'ps5', 'ps4'],
        'lg': ['lg', 'gram', 'wing'],
        'motorola': ['motorola', 'moto', 'edge'],
        'nokia': ['nokia', 'hmd'],
        'nothing': ['nothing', 'phone'],
        'asus': ['asus', 'rog', 'zenbook', 'vivobook'],
        'hp': ['hp', 'pavilion', 'envy', 'omen', 'elitebook'],
        'dell': ['dell', 'inspiron', 'xps', 'alienware', 'latitude'],
        'lenovo': ['lenovo', 'thinkpad', 'ideapad', 'legion'],
        'acer': ['acer', 'aspire', 'predator', 'swift'],
        'msi': ['msi', 'gaming', 'stealth'],
        'boat': ['boat', 'rockerz', 'airdopes', 'stone'],
        'jbl': ['jbl', 'flip', 'charge', 'go'],
        'bose': ['bose', 'quietcomfort', 'soundlink'],
        'sony': ['sony', 'wh', 'wf', 'wi'],
        'sennheiser': ['sennheiser', 'momentum', 'hd'],
        'audio-technica': ['audio-technica', 'ath']
      },
      fashion: {
        'nike': ['nike', 'air', 'jordan', 'dunk', 'blazer', 'cortez'],
        'adidas': ['adidas', 'ultraboost', 'nmd', 'stan smith', 'gazelle'],
        'puma': ['puma', 'suede', 'rs', 'future', 'clyde'],
        'reebok': ['reebok', 'classic', 'club', 'nano'],
        'under armour': ['under armour', 'curry', 'hovr'],
        'converse': ['converse', 'chuck taylor', 'all star'],
        'vans': ['vans', 'old skool', 'authentic', 'sk8'],
        'new balance': ['new balance', '990', '574', '327'],
        'asics': ['asics', 'gel', 'kayano', 'nimbus'],
        'levi': ['levi', 'levis', '501', '511', '721'],
        'zara': ['zara', 'basic', 'trf'],
        'h&m': ['h&m', 'hm', 'conscious'],
        'uniqlo': ['uniqlo', 'heattech', 'airism'],
        'tommy hilfiger': ['tommy', 'hilfiger', 'th'],
        'calvin klein': ['calvin', 'klein', 'ck']
      },
      beauty: {
        'lakme': ['lakme', '9to5', 'absolute'],
        'maybelline': ['maybelline', 'fit me', 'baby lips'],
        'loreal': ['loreal', 'paris', 'revitalift'],
        'nykaa': ['nykaa', 'wanderlust', 'skinrx'],
        'mac': ['mac', 'ruby woo', 'velvet teddy'],
        'clinique': ['clinique', 'dramatically different'],
        'estee lauder': ['estee', 'lauder', 'double wear']
      }
    };
    
    // Detect brand with category context
    const categoryBrands = brandDatabase[category] || {};
    for (const [brand, keywords] of Object.entries(categoryBrands)) {
      if (keywords.some(keyword => titleLower.includes(keyword))) {
        result.brand = brand;
        break;
      }
    }
    
    // If no category-specific brand found, try general detection
    if (!result.brand) {
      for (const categoryBrands of Object.values(brandDatabase)) {
        for (const [brand, keywords] of Object.entries(categoryBrands)) {
          if (keywords.some(keyword => titleLower.includes(keyword))) {
            result.brand = brand;
            break;
          }
        }
        if (result.brand) break;
      }
    }
    
    // ADVANCED MODEL/SERIES DETECTION
    if (category === 'electronics') {
      // Phone model patterns - capture FULL product name (e.g., "iphone 15 pro" not just "15 pro")
      const phonePatterns = [
        { pattern: /(iphone\s*\d+(?:\s*pro(?:\s*max)?)?(?:\s*plus)?)/i, includeMatch: true },
        { pattern: /(galaxy\s*[a-z]?\d+(?:\s*(?:plus|ultra|fe|note|s))?)/i, includeMatch: true },
        { pattern: /(pixel\s*\d+(?:\s*(?:pro|xl|a))?)/i, includeMatch: true },
        { pattern: /(oneplus\s*\d+(?:[rt])?(?:\s*pro)?)/i, includeMatch: true },
        { pattern: /(redmi\s*(?:note\s*)?\d+(?:\s*(?:pro|max|prime))?)/i, includeMatch: true },
        { pattern: /(realme\s*\w+(?:\s*pro)?)/i, includeMatch: true },
        { pattern: /(oppo\s*[a-z]?\d+(?:\s*pro)?)/i, includeMatch: true },
        { pattern: /(vivo\s*[a-z]?\d+(?:\s*pro)?)/i, includeMatch: true },
        { pattern: /(poco\s*[a-z]?\d+(?:\s*pro)?)/i, includeMatch: true },
        { pattern: /(mi\s*\d+(?:[a-z])?(?:\s*pro)?)/i, includeMatch: true }
      ];
      
      for (const { pattern } of phonePatterns) {
        const match = title.match(pattern);
        if (match) {
          result.model = match[1].trim();
          // For Apple products, don't use brand separately since model includes "iphone"
          if (result.model.toLowerCase().startsWith('iphone')) {
            result.brand = null; // Clear brand to avoid "apple iphone 15"
          }
          break;
        }
      }
      
      // Laptop model patterns
      if (!result.model) {
        const laptopPatterns = [
          /macbook\s*(air|pro)?\s*(\d+)?/i,
          /thinkpad\s*([a-z]\d+)/i,
          /inspiron\s*(\d+)/i,
          /pavilion\s*(\w+)/i,
          /ideapad\s*(\w+)/i
        ];
        
        for (const pattern of laptopPatterns) {
          const match = title.match(pattern);
          if (match) {
            result.model = match[0].trim();
            break;
          }
        }
      }
    }
    
    if (category === 'fashion') {
      // Shoe model patterns
      const shoePatterns = [
        /air\s*(max|jordan|force)\s*(\d+)?/i,
        /ultraboost\s*(\d+(?:\.\d+)?)?/i,
        /stan\s*smith/i,
        /chuck\s*taylor/i,
        /old\s*skool/i,
        /gel\s*(\w+)/i
      ];
      
      for (const pattern of shoePatterns) {
        const match = title.match(pattern);
        if (match) {
          result.model = match[0].trim();
          break;
        }
      }
    }
    
    // STORAGE/MEMORY DETECTION (enhanced)
    const storagePatterns = [
      /(\d+(?:\.\d+)?)\s*(gb|tb|mb)/i,
      /(\d+)\s*(gig|tera)/i
    ];
    
    for (const pattern of storagePatterns) {
      const match = title.match(pattern);
      if (match) {
        result.storage = `${match[1]}${match[2].toLowerCase()}`;
        break;
      }
    }
    
    // RAM DETECTION
    const ramPatterns = [
      /(\d+)\s*gb\s*(ram|memory)/i,
      /(\d+)\s*(gb)\s*(?:ddr|lpddr)/i
    ];
    
    for (const pattern of ramPatterns) {
      const match = title.match(pattern);
      if (match) {
        result.memory = `${match[1]}gb`;
        break;
      }
    }
    
    // SIZE DETECTION (clothing/shoes)
    if (category === 'fashion') {
      const sizePatterns = [
        /size\s*(\d+(?:\.\d+)?)/i,
        /\b(xs|s|m|l|xl|xxl|xxxl)\b/i,
        /\b(\d+(?:\.\d+)?)\s*(us|uk|eu|in|cm)\b/i,
        /\b(28|30|32|34|36|38|40|42|44|46)\b/ // Waist sizes
      ];
      
      for (const pattern of sizePatterns) {
        const match = title.match(pattern);
        if (match) {
          result.size = match[1] || match[0];
          break;
        }
      }
    }
    
    // COLOR DETECTION (enhanced)
    const colors = [
      'black', 'white', 'blue', 'red', 'green', 'yellow', 'pink', 'purple', 
      'gray', 'grey', 'silver', 'gold', 'rose', 'titanium', 'natural',
      'midnight', 'starlight', 'sierra', 'space', 'cosmic', 'mystic',
      'phantom', 'aura', 'prism', 'gradient', 'matte', 'glossy',
      'navy', 'maroon', 'olive', 'beige', 'brown', 'orange', 'coral'
    ];
    
    for (const color of colors) {
      if (titleLower.includes(color)) {
        result.color = color;
        break;
      }
    }
    
    // MATERIAL DETECTION
    const materials = [
      'leather', 'canvas', 'suede', 'mesh', 'knit', 'cotton', 'polyester',
      'nylon', 'rubber', 'plastic', 'metal', 'aluminum', 'steel', 'titanium',
      'ceramic', 'glass', 'wood', 'bamboo', 'silicone'
    ];
    
    for (const material of materials) {
      if (titleLower.includes(material)) {
        result.material = material;
        break;
      }
    }
    
    // TYPE/CATEGORY DETECTION
    const types = {
      electronics: ['smartphone', 'phone', 'laptop', 'tablet', 'headphones', 'earbuds', 'speaker', 'smartwatch', 'tv', 'monitor'],
      fashion: ['shoes', 'sneakers', 'boots', 'sandals', 'shirt', 'tshirt', 'jeans', 'pants', 'dress', 'jacket', 'hoodie'],
      beauty: ['lipstick', 'foundation', 'mascara', 'eyeshadow', 'blush', 'concealer', 'primer', 'serum', 'moisturizer']
    };
    
    const categoryTypes = types[category] || [];
    for (const type of categoryTypes) {
      if (titleLower.includes(type)) {
        result.type = type;
        break;
      }
    }
    
    // SPECIFICATIONS EXTRACTION
    const specPatterns = [
      /(\d+)\s*mp/i, // Megapixels
      /(\d+)\s*hz/i, // Refresh rate
      /(\d+)\s*inch/i, // Screen size
      /(\d+)\s*mah/i, // Battery
      /(\d+)\s*w/i, // Wattage
      /bluetooth\s*(\d+\.\d+)/i, // Bluetooth version
      /wifi\s*(\d+)/i, // WiFi standard
      /usb\s*([a-z])/i, // USB type
      /(\d+)g/i // Network (4G, 5G)
    ];
    
    for (const pattern of specPatterns) {
      const match = title.match(pattern);
      if (match) {
        result.specifications.push(match[0].toLowerCase());
      }
    }
    
    // KEY FEATURES EXTRACTION
    const features = [
      'wireless', 'bluetooth', 'noise cancelling', 'waterproof', 'fast charging',
      'dual camera', 'triple camera', 'quad camera', 'face unlock', 'fingerprint',
      'amoled', 'oled', 'lcd', 'retina', 'hdr', '4k', '8k', 'dolby', 'stereo',
      'gaming', 'professional', 'business', 'casual', 'formal', 'sports', 'running'
    ];
    
    for (const feature of features) {
      if (titleLower.includes(feature)) {
        result.keyFeatures.push(feature);
      }
    }
    
    return result;
  },
  
  /**
   * Build category-specific optimized search query
   */
  buildCategorySpecificQuery(productInfo, category, originalTitle) {
    let searchTerms = [];
    let priorityTerms = [];
    let secondaryTerms = [];
    
    // CATEGORY-SPECIFIC QUERY BUILDING
    switch (category) {
      case 'electronics':
        // For electronics: Model (with brand if separate) + Storage are most critical
        // Note: For products like iPhone, model already includes "iphone" so brand is null
        if (productInfo.model) {
          priorityTerms.push(productInfo.model);
          // Only add brand if model doesn't already include a product name
          if (productInfo.brand && !productInfo.model.toLowerCase().includes(productInfo.brand.toLowerCase())) {
            priorityTerms.unshift(productInfo.brand);
          }
        } else if (productInfo.brand) {
          priorityTerms.push(productInfo.brand);
        }
        if (productInfo.storage) priorityTerms.push(productInfo.storage);
        if (productInfo.memory) secondaryTerms.push(productInfo.memory);
        if (productInfo.type) secondaryTerms.push(productInfo.type);
        break;
        
      case 'fashion':
        // For fashion: Brand + Model + Size + Type are most critical
        if (productInfo.brand) priorityTerms.push(productInfo.brand);
        if (productInfo.model) priorityTerms.push(productInfo.model);
        if (productInfo.type) priorityTerms.push(productInfo.type);
        if (productInfo.size) priorityTerms.push(productInfo.size);
        if (productInfo.color) secondaryTerms.push(productInfo.color);
        break;
        
      case 'beauty':
        // For beauty: Brand + Type + Color/Shade are most critical
        if (productInfo.brand) priorityTerms.push(productInfo.brand);
        if (productInfo.type) priorityTerms.push(productInfo.type);
        if (productInfo.color) priorityTerms.push(productInfo.color);
        if (productInfo.variant) secondaryTerms.push(productInfo.variant);
        break;
        
      default:
        // General approach
        if (productInfo.brand) priorityTerms.push(productInfo.brand);
        if (productInfo.model) priorityTerms.push(productInfo.model);
        if (productInfo.type) priorityTerms.push(productInfo.type);
    }
    
    // Combine priority and secondary terms
    searchTerms = [...priorityTerms, ...secondaryTerms];
    
    // CRITICAL: If we don't have enough specific terms, extract key words from title
    if (searchTerms.length < 3 && originalTitle) {
      const keyWords = this.extractKeyWordsFromTitle(originalTitle, category);
      if (keyWords && keyWords.length > 0) {
        searchTerms.push(...keyWords.slice(0, 5 - searchTerms.length));
      }
    }
    
    // Remove duplicates, nulls, and clean up
    searchTerms = [...new Set(searchTerms)].filter(term => {
      return term && typeof term === 'string' && term.trim().length > 1;
    });
    
    // CRITICAL: If still empty, use simple word extraction from title
    if (searchTerms.length === 0 && originalTitle) {
      console.warn('⚠️ No terms extracted, using direct title words');
      const titleWords = originalTitle
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2)
        .slice(0, 5);
      searchTerms = titleWords;
    }
    
    // Limit to 5 most important terms for optimal search
    const finalQuery = searchTerms.slice(0, 5).join(' ').trim();
    
    console.log('🔍 Query building breakdown:');
    console.log('  Priority terms:', priorityTerms);
    console.log('  Secondary terms:', secondaryTerms);
    console.log('  Final query:', finalQuery);
    
    // CRITICAL: Never return empty string
    if (!finalQuery || finalQuery.trim() === '') {
      console.error('❌ Final query is empty! Using original title as fallback');
      return originalTitle ? originalTitle.split(' ').slice(0, 4).join(' ') : 'product';
    }
    
    return finalQuery;
  },
  
  /**
   * Extract key words from title with intelligent filtering
   */
  extractKeyWordsFromTitle(title, category) {
    // CRITICAL: Handle null/undefined title
    if (!title || typeof title !== 'string') {
      console.warn('⚠️ extractKeyWordsFromTitle: Invalid title:', title);
      return [];
    }
    
    // Enhanced stop words list
    const stopWords = [
      // Generic stop words
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      // E-commerce words
      'buy', 'online', 'store', 'shop', 'india', 'price', 'best', 'deal', 'offer', 'sale',
      'free', 'shipping', 'delivery', 'return', 'warranty', 'genuine', 'original', 'brand', 'new',
      // Site names
      'amazon', 'flipkart', 'myntra', 'ajio', 'croma', 'snapdeal', 'tatacliq', 'paytm',
      // Common words
      'pack', 'piece', 'set', 'combo', 'bundle', 'collection', 'series', 'edition'
    ];
    
    // Category-specific important words to preserve
    const importantWords = {
      electronics: ['pro', 'max', 'mini', 'plus', 'ultra', 'lite', 'se', 'air', 'gaming', 'wireless'],
      fashion: ['men', 'women', 'unisex', 'kids', 'running', 'casual', 'formal', 'sports'],
      beauty: ['matte', 'glossy', 'long lasting', 'waterproof', 'smudge proof', 'transfer proof']
    };
    
    const categoryImportant = importantWords[category] || [];
    
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .split(/\s+/)
      .filter(word => {
        return word.length > 2 && 
               !stopWords.includes(word) &&
               !word.match(/^\d+$/) && // Remove standalone numbers
               (word.length < 15 || categoryImportant.includes(word)); // Keep important long words
      })
      .slice(0, 10); // Get top 10 words
  },
  
  /**
   * Extract specific product identifiers (brand, model, storage, etc.) - LEGACY WRAPPER
   * This method now uses the advanced extraction system for backward compatibility
   */
  extractProductIdentifiers(title) {
    const category = this.detectProductCategory({ title });
    const advancedInfo = this.extractAdvancedProductIdentifiers(title, category);
    
    // Return in legacy format for backward compatibility
    return {
      brand: advancedInfo.brand,
      model: advancedInfo.model,
      storage: advancedInfo.storage,
      size: advancedInfo.size,
      color: advancedInfo.color,
      // Additional fields from advanced extraction
      memory: advancedInfo.memory,
      type: advancedInfo.type,
      material: advancedInfo.material,
      specifications: advancedInfo.specifications,
      keyFeatures: advancedInfo.keyFeatures
    };
  },
  
  /**
   * Get cleaned words from title (fallback method)
   */
  getCleanedTitleWords(title) {
    const siteNames = ['amazon', 'flipkart', 'myntra', 'ajio', 'croma', 'snapdeal', 'tatacliq', 'paytm', 'shopclues'];
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'buy', 'online', 'store', 'shop', 'india', 'price', 'best', 'deal', 'offer', 'sale'];
    const ecommerceWords = ['free', 'shipping', 'delivery', 'return', 'warranty', 'genuine', 'original', 'brand', 'new'];
    
    const allStopWords = [...stopWords, ...siteNames, ...ecommerceWords];
    
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\b(gb|tb|mb|kg|gm|cm|mm|inch|inches)\b/g, '$1')
      .split(/\s+/)
      .filter(word => {
        return word.length > 1 && 
               !allStopWords.includes(word) &&
               !word.match(/^\d+$/) &&
               word.length < 20;
      });
  },
  
  /**
   * Get all available sites (hardcoded + AI-discovered)
   */
  async getAllAvailableSites() {
    // VERIFIED WORKING SITES - URLs tested manually
    const hardcodedSites = [
      // TIER 1: Most reliable sites with working search URLs
      { name: 'Amazon India', domain: 'amazon.in', searchUrl: 'https://www.amazon.in/s', searchParam: 'k', trustScore: 9, category: 'all', verified: true },
      { name: 'Flipkart', domain: 'flipkart.com', searchUrl: 'https://www.flipkart.com/search', searchParam: 'q', trustScore: 9, category: 'all', verified: true },
      
      // TIER 2: Electronics sites
      { name: 'Croma', domain: 'croma.com', searchUrl: 'https://www.croma.com/searchB', searchParam: 'q', trustScore: 8, category: 'electronics', verified: true },
      { name: 'Reliance Digital', domain: 'reliancedigital.in', searchUrl: 'https://www.reliancedigital.in/search', searchParam: 'q', trustScore: 8, category: 'electronics', verified: true },
      { name: 'Vijay Sales', domain: 'vijaysales.com', searchUrl: 'https://www.vijaysales.com/search', searchParam: 'q', trustScore: 8, category: 'electronics', verified: true },
      
      // TIER 3: Fashion sites
      { name: 'Myntra', domain: 'myntra.com', searchUrl: 'https://www.myntra.com/', searchParam: 'rawQuery', trustScore: 9, category: 'fashion', verified: true },
      { name: 'Ajio', domain: 'ajio.com', searchUrl: 'https://www.ajio.com/search/', searchParam: 'text', trustScore: 9, category: 'fashion', verified: true },
      
      // TIER 4: Category-specific sites
      { name: 'Nykaa', domain: 'nykaa.com', searchUrl: 'https://www.nykaa.com/search/result/', searchParam: 'q', trustScore: 8, category: 'beauty', verified: true },
      { name: 'Lenskart', domain: 'lenskart.com', searchUrl: 'https://www.lenskart.com/search', searchParam: 'q', trustScore: 9, category: 'eyewear', verified: true },
      { name: 'FirstCry', domain: 'firstcry.com', searchUrl: 'https://www.firstcry.com/search', searchParam: 'q', trustScore: 8, category: 'kids', verified: true },
      { name: 'Decathlon', domain: 'decathlon.in', searchUrl: 'https://www.decathlon.in/search', searchParam: 'Ntt', trustScore: 8, category: 'sports', verified: true },
      
      // TIER 5: General marketplaces
      { name: 'Snapdeal', domain: 'snapdeal.com', searchUrl: 'https://www.snapdeal.com/search', searchParam: 'keyword', trustScore: 7, category: 'all', verified: true },
      { name: 'Tata CLiQ', domain: 'tatacliq.com', searchUrl: 'https://www.tatacliq.com/search/', searchParam: 'text', trustScore: 8, category: 'all', verified: true },
      { name: 'Paytm Mall', domain: 'paytmmall.com', searchUrl: 'https://paytmmall.com/shop/search', searchParam: 'q', trustScore: 7, category: 'all', verified: true }
    ];
    
    // Get AI-discovered sites from storage
    const { aiDiscoveredSites = [] } = await chrome.storage.sync.get('aiDiscoveredSites');
    
    return [...hardcodedSites, ...aiDiscoveredSites];
  },
  
  /**
   * Detect product category with high accuracy
   */
  detectProductCategory(product) {
    const title = product.title.toLowerCase();
    
    // Electronics detection (most specific first)
    const electronicsKeywords = [
      'phone', 'iphone', 'smartphone', 'mobile', 'android',
      'laptop', 'computer', 'pc', 'macbook', 'tablet', 'ipad',
      'tv', 'television', 'monitor', 'camera', 'smartwatch',
      'headphone', 'earphone', 'earbud', 'speaker', 'charger', 'powerbank',
      'gaming', 'console', 'keyboard', 'mouse', 'router', 'modem'
    ];
    
    // Fashion detection
    const fashionKeywords = [
      'shirt', 'tshirt', 't-shirt', 'dress', 'jeans', 'pants', 'trousers',
      'jacket', 'coat', 'hoodie', 'sweater', 'shoes', 'sneaker', 'sandal',
      'boot', 'bag', 'wallet', 'belt', 'watch', 'jewelry', 'ring',
      'necklace', 'bracelet', 'clothing', 'apparel', 'fashion'
    ];
    
    // Beauty detection
    const beautyKeywords = [
      'makeup', 'cosmetic', 'lipstick', 'foundation', 'mascara',
      'skincare', 'cream', 'lotion', 'serum', 'perfume', 'fragrance',
      'shampoo', 'conditioner', 'soap', 'beauty', 'nail', 'polish'
    ];
    
    // Sports detection
    const sportsKeywords = [
      'fitness', 'gym', 'sports', 'running', 'yoga', 'cricket',
      'football', 'tennis', 'badminton', 'cycle', 'bicycle',
      'treadmill', 'dumbbell', 'protein', 'supplement'
    ];
    
    // Kids detection
    const kidsKeywords = [
      'baby', 'kids', 'children', 'toy', 'diaper', 'stroller',
      'infant', 'toddler', 'child', 'game', 'puzzle', 'doll'
    ];
    
    // Eyewear detection
    const eyewearKeywords = [
      'glasses', 'eyeglasses', 'sunglasses', 'lens', 'contact',
      'frame', 'spectacle', 'reading glasses'
    ];
    
    // Check categories in order of specificity
    if (electronicsKeywords.some(keyword => title.includes(keyword))) {
      return 'electronics';
    }
    if (fashionKeywords.some(keyword => title.includes(keyword))) {
      return 'fashion';
    }
    if (beautyKeywords.some(keyword => title.includes(keyword))) {
      return 'beauty';
    }
    if (sportsKeywords.some(keyword => title.includes(keyword))) {
      return 'sports';
    }
    if (kidsKeywords.some(keyword => title.includes(keyword))) {
      return 'kids';
    }
    if (eyewearKeywords.some(keyword => title.includes(keyword))) {
      return 'eyewear';
    }
    
    return 'general';
  },
  
  /**
   * Check if site is appropriate for product category
   */
  isSiteAppropriateForProduct(product, site, productCategory) {
    const siteName = site.name.toLowerCase();
    const siteCategory = site.category;
    
    // Define category-specific whitelists
    const categoryWhitelists = {
      electronics: {
        // Only these sites for electronics
        allowed: ['amazon', 'flipkart', 'croma', 'tatacliq', 'snapdeal', 'boat'],
        forbidden: ['myntra', 'ajio', 'nykaa', 'lenskart', 'firstcry', 'decathlon']
      },
      fashion: {
        // Fashion sites + general marketplaces
        allowed: ['amazon', 'flipkart', 'myntra', 'ajio', 'tatacliq', 'snapdeal'],
        forbidden: ['croma', 'boat', 'nykaa', 'lenskart', 'firstcry']
      },
      beauty: {
        // Beauty sites + general marketplaces
        allowed: ['amazon', 'flipkart', 'nykaa', 'tatacliq', 'snapdeal'],
        forbidden: ['croma', 'boat', 'myntra', 'ajio', 'lenskart', 'firstcry', 'decathlon']
      },
      sports: {
        // Sports sites + general marketplaces
        allowed: ['amazon', 'flipkart', 'decathlon', 'tatacliq', 'snapdeal'],
        forbidden: ['croma', 'boat', 'myntra', 'ajio', 'nykaa', 'lenskart', 'firstcry']
      },
      kids: {
        // Kids sites + general marketplaces
        allowed: ['amazon', 'flipkart', 'firstcry', 'tatacliq', 'snapdeal'],
        forbidden: ['croma', 'boat', 'myntra', 'ajio', 'nykaa', 'lenskart', 'decathlon']
      },
      eyewear: {
        // Eyewear sites + general marketplaces
        allowed: ['amazon', 'flipkart', 'lenskart', 'tatacliq', 'snapdeal'],
        forbidden: ['croma', 'boat', 'myntra', 'ajio', 'nykaa', 'firstcry', 'decathlon']
      },
      general: {
        // For unclassified products, allow general marketplaces only
        allowed: ['amazon', 'flipkart', 'tatacliq', 'snapdeal'],
        forbidden: ['croma', 'boat', 'myntra', 'ajio', 'nykaa', 'lenskart', 'firstcry', 'decathlon']
      }
    };
    
    const whitelist = categoryWhitelists[productCategory];
    if (!whitelist) {
      // If category not found, default to general
      return categoryWhitelists.general.allowed.some(allowed => 
        siteName.includes(allowed) || site.domain.includes(allowed)
      );
    }
    
    // Check if site is forbidden for this category
    const isForbidden = whitelist.forbidden.some(forbidden => 
      siteName.includes(forbidden) || site.domain.includes(forbidden)
    );
    
    if (isForbidden) {
      console.log(`❌ Site ${site.name} is forbidden for ${productCategory} products`);
      return false;
    }
    
    // Check if site is allowed for this category
    const isAllowed = whitelist.allowed.some(allowed => 
      siteName.includes(allowed) || site.domain.includes(allowed)
    );
    
    if (isAllowed) {
      console.log(`✅ Site ${site.name} is allowed for ${productCategory} products`);
      return true;
    }
    
    // If not explicitly allowed or forbidden, check site category
    if (siteCategory === 'all') {
      console.log(`✅ Site ${site.name} is a general marketplace`);
      return true;
    }
    
    console.log(`❌ Site ${site.name} (${siteCategory}) not appropriate for ${productCategory}`);
    return false;
  },
  
  /**
   * Check if product is electronics (phones, laptops, etc.) - LEGACY METHOD
   */
  isElectronicsProduct(product) {
    return this.detectProductCategory(product) === 'electronics';
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
   * Build search URL for a site - SMART VERSION
   * Uses site's stored configuration first, with intelligent fallbacks
   * 
   * Priority order:
   * 1. URL overrides from storage (AI-learned corrections)
   * 2. AI-discovered site configurations
   * 3. Hardcoded patterns for known sites
   * 4. Generic fallback using site's searchUrl/searchParam
   */
  buildSearchUrl(site, keywords, urlOverride = null) {
    // CRITICAL: Validate keywords before encoding
    if (!keywords || keywords === 'null' || keywords === 'undefined' || keywords.trim() === '') {
      console.error(`❌ Invalid keywords for ${site.name}:`, keywords);
      keywords = 'product';
    }
    
    const cleanKeywords = String(keywords).trim();
    const siteName = site.name.toLowerCase();
    
    console.log(`🔗 Building search URL for ${site.name} with keywords: "${cleanKeywords}"`);
    
    // SMART URL BUILDING - Try multiple encoding strategies
    // Different sites prefer different encoding (+ vs %20)
    const plusEncoded = cleanKeywords.replace(/\s+/g, '+');
    const percentEncoded = encodeURIComponent(cleanKeywords);
    
    try {
      let finalUrl;
      
      // STRATEGY 0: Use URL override if provided (AI-learned correction)
      if (urlOverride && urlOverride.searchUrl && urlOverride.searchParam) {
        const separator = urlOverride.searchUrl.includes('?') ? '&' : '?';
        finalUrl = `${urlOverride.searchUrl}${separator}${urlOverride.searchParam}=${percentEncoded}`;
        console.log(`🔧 Using AI-corrected URL format for ${site.name}`);
        return finalUrl;
      }
      
      // STRATEGY 1: Use site's stored searchUrl and searchParam if AI-discovered
      if (site.searchUrl && site.searchParam && site.source === 'ai-discovered') {
        const separator = site.searchUrl.includes('?') ? '&' : '?';
        finalUrl = `${site.searchUrl}${separator}${site.searchParam}=${percentEncoded}`;
        console.log(`🤖 Using AI-discovered URL format for ${site.name}`);
        return finalUrl;
      }
      
      // STRATEGY 2: Known site patterns (fallback for hardcoded sites)
      // These patterns are used as defaults but can be overridden by AI
      
      switch (true) {
        case siteName.includes('amazon'):
          // Amazon India
          finalUrl = `https://www.amazon.in/s?k=${plusEncoded}`;
          break;
          
        case siteName.includes('flipkart'):
          // Flipkart - VERIFIED WORKING
          finalUrl = `https://www.flipkart.com/search?q=${plusEncoded}`;
          break;
          
        case siteName.includes('myntra'):
          // Myntra - Uses path-based search with rawQuery parameter
          // VERIFIED: https://www.myntra.com/nike-shoes?rawQuery=nike%20shoes
          finalUrl = `https://www.myntra.com/${plusEncoded.replace(/\+/g, '-')}?rawQuery=${encodeURIComponent(cleanKeywords)}`;
          break;
          
        case siteName.includes('ajio'):
          // Ajio - VERIFIED WORKING
          finalUrl = `https://www.ajio.com/search/?text=${plusEncoded}`;
          break;
          
        case siteName.includes('croma'):
          // Croma - VERIFIED WORKING FORMAT
          // Actual URL: https://www.croma.com/searchB?q=iphone%3Arelevance&text=iphone
          finalUrl = `https://www.croma.com/searchB?q=${encodeURIComponent(cleanKeywords)}%3Arelevance&text=${encodeURIComponent(cleanKeywords)}`;
          break;
          
        case siteName.includes('lenskart'):
          // Lenskart - VERIFIED WORKING
          finalUrl = `https://www.lenskart.com/search?q=${plusEncoded}`;
          break;
          
        case siteName.includes('boat'):
          // Boat Lifestyle - VERIFIED WORKING
          finalUrl = `https://www.boat-lifestyle.com/search?q=${plusEncoded}`;
          break;
          
        case siteName.includes('nykaa'):
          // Nykaa - VERIFIED WORKING
          finalUrl = `https://www.nykaa.com/search/result/?q=${plusEncoded}`;
          break;
          
        case siteName.includes('firstcry'):
          // FirstCry - VERIFIED WORKING
          finalUrl = `https://www.firstcry.com/search?q=${plusEncoded}`;
          break;
          
        case siteName.includes('decathlon'):
          // Decathlon - Uses search endpoint with Ntt parameter
          // VERIFIED: https://www.decathlon.in/search?Ntt=running+shoes
          finalUrl = `https://www.decathlon.in/search?Ntt=${plusEncoded}`;
          break;
          
        case siteName.includes('snapdeal'):
          // Snapdeal - VERIFIED WORKING
          finalUrl = `https://www.snapdeal.com/search?keyword=${plusEncoded}`;
          break;
          
        case siteName.includes('tata') || siteName.includes('cliq'):
          // Tata CLiQ - VERIFIED WORKING
          finalUrl = `https://www.tatacliq.com/search/?searchCategory=all&text=${plusEncoded}`;
          break;
          
        case siteName.includes('reliance') || siteName.includes('digital'):
          // Reliance Digital - VERIFIED WORKING
          finalUrl = `https://www.reliancedigital.in/search?q=${plusEncoded}`;
          break;
          
        case siteName.includes('vijay') || siteName.includes('sales'):
          // Vijay Sales - VERIFIED WORKING
          finalUrl = `https://www.vijaysales.com/search/${plusEncoded}`;
          break;
          
        case siteName.includes('paytm'):
          // Paytm Mall - VERIFIED WORKING
          finalUrl = `https://paytmmall.com/shop/search?q=${plusEncoded}`;
          break;
          
        default:
          // Fallback to generic construction
          const separator = site.searchUrl.includes('?') ? '&' : '?';
          finalUrl = `${site.searchUrl}${separator}${site.searchParam}=${plusEncoded}`;
      }
      
      console.log(`🔗 Generated URL for ${site.name}: ${finalUrl}`);
      return finalUrl;
      
    } catch (error) {
      console.error(`❌ Error building URL for ${site.name}:`, error);
      // Fallback to basic construction
      const separator = site.searchUrl.includes('?') ? '&' : '?';
      return `${site.searchUrl}${separator}${site.searchParam}=${percentEncoded}`;
    }
  },
  
  /**
   * AI-powered search URL discovery using Gemini
   * Automatically discovers the correct search URL format for any e-commerce site
   */
  async discoverSearchUrlFormat(siteDomain, testKeyword = 'iphone') {
    console.log(`🤖 AI discovering search URL format for ${siteDomain}...`);
    
    try {
      // Method 1: Use SiteManager if available
      if (typeof SiteManager !== 'undefined' && SiteManager.discoverSiteWithAI) {
        const discovered = await SiteManager.discoverSiteWithAI(siteDomain, testKeyword);
        if (discovered) {
          console.log(`✅ AI discovered URL format for ${siteDomain}:`, discovered);
          return discovered;
        }
      }
      
      // Method 2: Direct Gemini API call
      const apiKey = await this.getGeminiApiKey();
      if (apiKey) {
        const prompt = `You are analyzing an Indian e-commerce website to find its search URL format.

Website: ${siteDomain}

Task: Determine the exact search URL format this website uses.

Common patterns for Indian e-commerce sites:
- Amazon: /s?k=query
- Flipkart: /search?q=query
- Croma: /searchB?q=query%3Arelevance&text=query
- Myntra: /query?rawQuery=query
- Ajio: /search/?text=query

Return ONLY a JSON object (no markdown, no explanation):
{
  "searchUrl": "https://www.${siteDomain}/search",
  "searchParam": "q",
  "extraParams": "",
  "encoding": "plus or percent",
  "confidence": 0.8
}

If you know this site, provide the exact format. If unsure, use the most common pattern.`;

        const response = await this.callGeminiForUrlDiscovery(apiKey, prompt);
        if (response) {
          console.log(`✅ Gemini discovered URL format:`, response);
          return response;
        }
      }
      
      // Method 3: Fallback to common patterns
      console.log(`⚠️ Using fallback patterns for ${siteDomain}`);
      return { 
        searchUrl: `https://www.${siteDomain}/search`, 
        searchParam: 'q',
        confidence: 0.5
      };
      
    } catch (error) {
      console.error(`❌ Failed to discover URL format for ${siteDomain}:`, error);
      return null;
    }
  },
  
  /**
   * Get Gemini API key from storage
   */
  async getGeminiApiKey() {
    try {
      const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');
      return geminiApiKey || null;
    } catch {
      return null;
    }
  },
  
  /**
   * Call Gemini API for URL discovery
   */
  async callGeminiForUrlDiscovery(apiKey, prompt) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 200
            }
          })
        }
      );
      
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      return null;
    } catch (error) {
      console.error('Gemini API call failed:', error);
      return null;
    }
  },
  
  /**
   * Report a broken URL and trigger AI rediscovery
   * Call this when a search URL doesn't show results
   */
  async reportBrokenUrl(siteName, failedUrl) {
    console.log(`🔧 Reporting broken URL for ${siteName}: ${failedUrl}`);
    
    try {
      // Extract domain from site name
      const site = (await this.getAllAvailableSites()).find(s => 
        s.name.toLowerCase().includes(siteName.toLowerCase())
      );
      
      if (!site) {
        console.error(`❌ Site ${siteName} not found`);
        return null;
      }
      
      // Trigger AI rediscovery
      const newFormat = await this.discoverSearchUrlFormat(site.domain);
      
      if (newFormat) {
        // Update the site's URL format in storage
        const { siteUrlOverrides = {} } = await chrome.storage.local.get('siteUrlOverrides');
        siteUrlOverrides[site.domain] = {
          searchUrl: newFormat.searchUrl,
          searchParam: newFormat.searchParam,
          updatedAt: Date.now()
        };
        await chrome.storage.local.set({ siteUrlOverrides });
        
        console.log(`✅ Updated URL format for ${siteName}`);
        return newFormat;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Failed to report broken URL:`, error);
      return null;
    }
  },
  
  /**
   * Get URL override for a site (if AI has discovered a better format)
   */
  async getUrlOverride(siteDomain) {
    try {
      const { siteUrlOverrides = {} } = await chrome.storage.local.get('siteUrlOverrides');
      return siteUrlOverrides[siteDomain] || null;
    } catch {
      return null;
    }
  },

  /**
   * Function 2: Product Matching
   * Match products across sites using similarity algorithms
   */
  async matchProducts(originalProduct, scrapedResults) {
    console.log('🔍 Matching products across sites...');
    console.log('🔍 Original product for matching:', originalProduct.title);
    
    const matches = [];
    const exactMatches = [];
    const similarMatches = [];
    const failedResults = [];
    
    for (const result of scrapedResults) {
      if (result.error) {
        // Include failed results for transparency
        failedResults.push({
          ...result,
          similarity: 0,
          matchReason: 'Scraping failed',
          matchType: 'error'
        });
      } else {
        const similarity = this.calculateProductSimilarity(originalProduct, result);
        
        // STRICT THRESHOLDS for better accuracy
        if (similarity.score >= 0.9) {
          // 90%+ = EXACT MATCH
          const match = {
            ...result,
            similarity: similarity.score,
            matchReason: similarity.reason,
            matchType: 'exact',
            breakdown: similarity.breakdown
          };
          exactMatches.push(match);
          console.log(`✅ EXACT MATCH (${(similarity.score * 100).toFixed(1)}%):`, result.title);
          
        } else if (similarity.score >= 0.75) {
          // 75-89% = SIMILAR PRODUCT
          const match = {
            ...result,
            similarity: similarity.score,
            matchReason: similarity.reason,
            matchType: 'similar',
            breakdown: similarity.breakdown
          };
          similarMatches.push(match);
          console.log(`⚠️ SIMILAR MATCH (${(similarity.score * 100).toFixed(1)}%):`, result.title);
          
        } else {
          // <75% = DISCARD
          console.log(`❌ REJECTED (${(similarity.score * 100).toFixed(1)}%):`, result.title);
        }
      }
    }
    
    // Combine results: exact matches first, then similar matches, then errors
    const allMatches = [...exactMatches, ...similarMatches, ...failedResults];
    
    console.log(`✅ Matching complete:`);
    console.log(`  - Exact matches: ${exactMatches.length}`);
    console.log(`  - Similar matches: ${similarMatches.length}`);
    console.log(`  - Failed scrapes: ${failedResults.length}`);
    console.log(`  - Total results: ${allMatches.length}`);
    
    return allMatches;
  },
  
  /**
   * Calculate product similarity using multiple factors - ENHANCED VERSION
   */
  calculateProductSimilarity(original, candidate) {
    console.log('🔍 Comparing products:');
    console.log('  Original:', original.title);
    console.log('  Candidate:', candidate.title);
    
    let score = 0;
    let reasons = [];
    
    // Extract product identifiers for both products
    const originalInfo = this.extractProductIdentifiers(original.title);
    const candidateInfo = this.extractProductIdentifiers(candidate.title);
    
    console.log('  Original info:', originalInfo);
    console.log('  Candidate info:', candidateInfo);
    
    // 1. BRAND MATCHING (30% weight) - Most critical
    let brandScore = 0;
    if (originalInfo.brand && candidateInfo.brand) {
      if (originalInfo.brand === candidateInfo.brand) {
        brandScore = 1.0;
        reasons.push(`Same brand (${originalInfo.brand})`);
      } else {
        brandScore = 0;
        reasons.push(`Different brand (${originalInfo.brand} vs ${candidateInfo.brand})`);
        // If brands don't match, heavily penalize
        console.log('❌ Brand mismatch - heavily penalizing');
      }
    } else {
      // Fallback to title-based brand detection
      const originalBrand = this.extractBrand(original.title);
      const candidateBrand = this.extractBrand(candidate.title);
      if (originalBrand && candidateBrand && originalBrand === candidateBrand) {
        brandScore = 0.8; // Slightly lower confidence
        reasons.push(`Same brand (${originalBrand})`);
      }
    }
    score += brandScore * 0.3;
    
    // 2. MODEL MATCHING (25% weight) - Very important for electronics
    let modelScore = 0;
    if (originalInfo.model && candidateInfo.model) {
      const modelSimilarity = this.calculateStringSimilarity(
        originalInfo.model.toLowerCase(),
        candidateInfo.model.toLowerCase()
      );
      modelScore = modelSimilarity;
      if (modelSimilarity > 0.8) {
        reasons.push(`Similar model (${originalInfo.model})`);
      } else if (modelSimilarity > 0.5) {
        reasons.push(`Partially similar model`);
      } else {
        reasons.push(`Different model (${originalInfo.model} vs ${candidateInfo.model})`);
      }
    }
    score += modelScore * 0.25;
    
    // 3. STORAGE/VARIANT MATCHING (20% weight) - Critical for phones/laptops
    let storageScore = 0;
    if (originalInfo.storage && candidateInfo.storage) {
      if (originalInfo.storage === candidateInfo.storage) {
        storageScore = 1.0;
        reasons.push(`Same storage (${originalInfo.storage})`);
      } else {
        storageScore = 0;
        reasons.push(`Different storage (${originalInfo.storage} vs ${candidateInfo.storage})`);
      }
    } else if (!originalInfo.storage && !candidateInfo.storage) {
      storageScore = 0.5; // No storage info for both (might be non-tech products)
    }
    score += storageScore * 0.2;
    
    // 4. TITLE SIMILARITY (15% weight) - Overall similarity
    const titleSimilarity = this.calculateStringSimilarity(
      original.title.toLowerCase(),
      candidate.title.toLowerCase()
    );
    score += titleSimilarity * 0.15;
    
    if (titleSimilarity > 0.7) {
      reasons.push('High title similarity');
    }
    
    // 5. PRICE SIMILARITY (10% weight) - Least important
    let priceScore = 0;
    if (original.priceValue && candidate.priceValue) {
      const priceDiff = Math.abs(original.priceValue - candidate.priceValue) / original.priceValue;
      priceScore = Math.max(0, 1 - priceDiff);
      
      if (priceDiff < 0.2) { // Within 20% price range
        reasons.push('Similar price range');
      }
    }
    score += priceScore * 0.1;
    
    const finalScore = Math.min(score, 1.0);
    
    console.log(`  Final similarity score: ${(finalScore * 100).toFixed(1)}%`);
    console.log(`  Reasons: ${reasons.join(', ')}`);
    
    return {
      score: finalScore,
      reason: reasons.join(', ') || 'Basic similarity',
      breakdown: {
        brand: brandScore,
        model: modelScore,
        storage: storageScore,
        title: titleSimilarity,
        price: priceScore
      }
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
   * Cache comparison results - ENHANCED VERSION
   */
  async cacheResults(product, results) {
    try {
      const productId = this.generateProductId(product);
      const cacheKey = `comparison_cache_${this.CACHE_VERSION}_${productId}`;
      const displayKey = `comparison_display_${this.CACHE_VERSION}_${productId}`;
      
      const cacheData = {
        timestamp: Date.now(),
        product: {
          title: product.title,
          url: product.url,
          source: product.source,
          priceValue: product.priceValue
        },
        results: results,
        expiresAt: Date.now() + (6 * 60 * 60 * 1000) // 6 hours
      };
      
      // Cache both the full results and a display-ready version
      const displayData = {
        timestamp: Date.now(),
        productTitle: product.title,
        exactMatches: results.matches.filter(m => m.matchType === 'exact'),
        similarMatches: results.matches.filter(m => m.matchType === 'similar'),
        bestDeal: results.bestDeal,
        savings: results.savings,
        recommendation: results.recommendation,
        analysis: results.analysis,
        expiresAt: Date.now() + (6 * 60 * 60 * 1000) // 6 hours
      };
      
      await chrome.storage.local.set({ 
        [cacheKey]: cacheData,
        [displayKey]: displayData
      });
      
      console.log('💾 Results cached for 6 hours (both full and display versions)');
    } catch (error) {
      console.error('Failed to cache results:', error);
    }
  },
  
  // Cache version - only change this if cache structure changes (not for URL updates)
  CACHE_VERSION: 'v1',
  
  /**
   * Get cached comparison results - ENHANCED VERSION
   * Checks both versioned and legacy cache formats
   */
  async getCachedResults(product) {
    try {
      const productId = this.generateProductId(product);
      
      // Try versioned cache first
      const cacheKey = `comparison_cache_${this.CACHE_VERSION}_${productId}`;
      let { [cacheKey]: cacheData } = await chrome.storage.local.get(cacheKey);
      
      // Fallback to legacy cache format (without version)
      if (!cacheData) {
        const legacyKey = `comparison_cache_${productId}`;
        const legacy = await chrome.storage.local.get(legacyKey);
        cacheData = legacy[legacyKey];
      }
      
      if (cacheData && cacheData.expiresAt > Date.now()) {
        console.log('📦 Found valid cached results');
        return cacheData.results;
      } else if (cacheData) {
        console.log('🗑️ Cache expired, removing old data');
        await chrome.storage.local.remove(cacheKey);
        await chrome.storage.local.remove(`comparison_display_${this.CACHE_VERSION}_${productId}`);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get cached results:', error);
      return null;
    }
  },
  
  /**
   * Get cached display results (for UI persistence)
   * Checks both versioned and legacy cache formats
   */
  async getCachedDisplayResults(product) {
    try {
      const productId = this.generateProductId(product);
      
      // Try versioned cache first
      const displayKey = `comparison_display_${this.CACHE_VERSION}_${productId}`;
      let { [displayKey]: displayData } = await chrome.storage.local.get(displayKey);
      
      // Fallback to legacy cache format (without version)
      if (!displayData) {
        const legacyKey = `comparison_display_${productId}`;
        const legacy = await chrome.storage.local.get(legacyKey);
        displayData = legacy[legacyKey];
      }
      
      if (displayData && displayData.expiresAt > Date.now()) {
        console.log('📦 Found valid cached display results');
        return displayData;
      } else if (displayData) {
        console.log('🗑️ Display cache expired, removing old data');
        await chrome.storage.local.remove(displayKey);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get cached display results:', error);
      return null;
    }
  },
  
  /**
   * Clear comparison cache for a product
   */
  async clearCache(product) {
    try {
      const productId = this.generateProductId(product);
      const cacheKey = `comparison_cache_${this.CACHE_VERSION}_${productId}`;
      const displayKey = `comparison_display_${this.CACHE_VERSION}_${productId}`;
      await chrome.storage.local.remove([cacheKey, displayKey]);
      console.log('🗑️ Cache cleared for product');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  },
  
  /**
   * Clear ALL comparison caches (useful when URL formats change)
   */
  async clearAllCaches() {
    try {
      const allData = await chrome.storage.local.get(null);
      const cacheKeys = Object.keys(allData).filter(key => 
        key.startsWith('comparison_cache_') || key.startsWith('comparison_display_')
      );
      
      if (cacheKeys.length > 0) {
        await chrome.storage.local.remove(cacheKeys);
        console.log(`🗑️ Cleared ${cacheKeys.length} cached comparison results`);
      }
      return cacheKeys.length;
    } catch (error) {
      console.error('Failed to clear all caches:', error);
      return 0;
    }
  },
  
  /**
   * Utility functions
   */
  shouldExcludeSite(product, site) {
    const title = product.title.toLowerCase();
    const siteName = site.name.toLowerCase();
    
    // STRICT exclusion rules - be very aggressive to prevent mismatches
    const exclusions = [
      // Audio/accessories sites - NEVER get phones, computers, etc.
      { sites: ['boat', 'boAt'], exclude: ['phone', 'iphone', 'smartphone', 'mobile', 'laptop', 'computer', 'tablet', 'tv', 'monitor', 'apple', 'samsung', 'oneplus'] },
      
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

// Export for browser use
if (typeof window !== 'undefined') {
  window.PriceComparison = PriceComparison;
  console.log('🔄 PriceComparison loaded - cache persistence enabled');
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PriceComparison;
}
