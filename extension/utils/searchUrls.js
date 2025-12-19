/**
 * Search URL Generator for Verified E-commerce Sites
 * Generates search URLs for 16 verified, legit shopping sites
 */

/**
 * Verified sites whitelist with trust scores
 */
const VERIFIED_SITES = {
  // Tier 1: Official Brand Stores (Trust: 10/10)
  tier1: [
    {
      name: 'Apple India',
      domain: 'apple.com/in',
      searchUrl: 'https://www.apple.com/in/shop/search',
      searchParam: 'q',
      trustScore: 10,
      category: 'electronics'
    },
    {
      name: 'Samsung India',
      domain: 'samsung.com/in',
      searchUrl: 'https://www.samsung.com/in/search',
      searchParam: 'keyword',
      trustScore: 10,
      category: 'electronics'
    }
  ],
  
  // Tier 2: Major Marketplaces (Trust: 9/10)
  tier2: [
    {
      name: 'Amazon India',
      domain: 'amazon.in',
      searchUrl: 'https://www.amazon.in/s',
      searchParam: 'k',
      trustScore: 9,
      category: 'all'
    },
    {
      name: 'Flipkart',
      domain: 'flipkart.com',
      searchUrl: 'https://www.flipkart.com/search',
      searchParam: 'q',
      trustScore: 9,
      category: 'all'
    },
    {
      name: 'Myntra',
      domain: 'myntra.com',
      searchUrl: 'https://www.myntra.com/search',
      searchParam: 'q',
      trustScore: 9,
      category: 'fashion'
    },
    {
      name: 'Ajio',
      domain: 'ajio.com',
      searchUrl: 'https://www.ajio.com/search',
      searchParam: 'text',
      trustScore: 9,
      category: 'fashion'
    },
    {
      name: 'Tata CLiQ',
      domain: 'tatacliq.com',
      searchUrl: 'https://www.tatacliq.com/search',
      searchParam: 'searchText',
      trustScore: 9,
      category: 'all'
    }
  ],
  
  // Tier 3: Verified Retailers (Trust: 8/10)
  tier3: [
    {
      name: 'Croma',
      domain: 'croma.com',
      searchUrl: 'https://www.croma.com/search',
      searchParam: 'q',
      trustScore: 8,
      category: 'electronics'
    },
    {
      name: 'Reliance Digital',
      domain: 'reliancedigital.in',
      searchUrl: 'https://www.reliancedigital.in/search',
      searchParam: 'q',
      trustScore: 8,
      category: 'electronics'
    },
    {
      name: 'Vijay Sales',
      domain: 'vijaysales.com',
      searchUrl: 'https://www.vijaysales.com/search',
      searchParam: 'q',
      trustScore: 8,
      category: 'electronics'
    },
    {
      name: 'Healthkart',
      domain: 'healthkart.com',
      searchUrl: 'https://www.healthkart.com/search',
      searchParam: 'q',
      trustScore: 8,
      category: 'supplements'
    },
    {
      name: 'Nykaa',
      domain: 'nykaa.com',
      searchUrl: 'https://www.nykaa.com/search/result',
      searchParam: 'q',
      trustScore: 8,
      category: 'beauty'
    },
    {
      name: 'FirstCry',
      domain: 'firstcry.com',
      searchUrl: 'https://www.firstcry.com/search',
      searchParam: 'searchstring',
      trustScore: 8,
      category: 'kids'
    },
    {
      name: 'Decathlon',
      domain: 'decathlon.in',
      searchUrl: 'https://www.decathlon.in/search',
      searchParam: 'q',
      trustScore: 8,
      category: 'sports'
    },
    {
      name: 'Snapdeal',
      domain: 'snapdeal.com',
      searchUrl: 'https://www.snapdeal.com/search',
      searchParam: 'keyword',
      trustScore: 8,
      category: 'all'
    },
    {
      name: 'Shoppers Stop',
      domain: 'shoppersstop.com',
      searchUrl: 'https://www.shoppersstop.com/search',
      searchParam: 'q',
      trustScore: 8,
      category: 'fashion'
    },
    {
      name: 'Pepperfry',
      domain: 'pepperfry.com',
      searchUrl: 'https://www.pepperfry.com/search.html',
      searchParam: 'q',
      trustScore: 8,
      category: 'furniture'
    },
    {
      name: 'Urban Ladder',
      domain: 'urbanladder.com',
      searchUrl: 'https://www.urbanladder.com/search',
      searchParam: 'q',
      trustScore: 8,
      category: 'furniture'
    },
    {
      name: 'Lenskart',
      domain: 'lenskart.com',
      searchUrl: 'https://www.lenskart.com/search',
      searchParam: 'q',
      trustScore: 9,
      category: 'eyewear'
    },
    {
      name: 'Boat Lifestyle',
      domain: 'boat-lifestyle.com',
      searchUrl: 'https://www.boat-lifestyle.com/search',
      searchParam: 'q',
      trustScore: 8,
      category: 'electronics'
    },
    {
      name: 'Noise',
      domain: 'gonoise.com',
      searchUrl: 'https://www.gonoise.com/search',
      searchParam: 'q',
      trustScore: 8,
      category: 'electronics'
    },
    {
      name: 'Bewakoof',
      domain: 'bewakoof.com',
      searchUrl: 'https://www.bewakoof.com/search',
      searchParam: 'q',
      trustScore: 8,
      category: 'fashion'
    },
    {
      name: 'Chumbak',
      domain: 'chumbak.com',
      searchUrl: 'https://www.chumbak.com/search',
      searchParam: 'q',
      trustScore: 7,
      category: 'lifestyle'
    },
    {
      name: 'Purplle',
      domain: 'purplle.com',
      searchUrl: 'https://www.purplle.com/search',
      searchParam: 'q',
      trustScore: 8,
      category: 'beauty'
    },
    {
      name: 'BigBasket',
      domain: 'bigbasket.com',
      searchUrl: 'https://www.bigbasket.com/ps',
      searchParam: 'q',
      trustScore: 9,
      category: 'groceries'
    },
    {
      name: 'Zivame',
      domain: 'zivame.com',
      searchUrl: 'https://www.zivame.com/search',
      searchParam: 'q',
      trustScore: 8,
      category: 'fashion'
    }
  ]
};

/**
 * Get all verified sites as flat array
 * @returns {Array<Object>} All verified sites
 */
function getAllVerifiedSites() {
  return [
    ...VERIFIED_SITES.tier1,
    ...VERIFIED_SITES.tier2,
    ...VERIFIED_SITES.tier3
  ];
}

/**
 * Generate search URLs for all verified sites
 * @param {string} searchQuery - Search query (e.g., "iPhone 15 Pro 128GB")
 * @param {Object} options - Options for filtering sites
 * @returns {Array<Object>} Array of site objects with search URLs
 */
function generateSearchUrls(searchQuery, options = {}) {
  if (!searchQuery || typeof searchQuery !== 'string') {
    throw new Error('Invalid search query');
  }
  
  const {
    category = null,      // Filter by category (electronics, fashion, etc.)
    minTrustScore = 8,    // Minimum trust score (8-10)
    maxSites = 10,        // Maximum number of sites to return
    excludeDomains = []   // Domains to exclude
  } = options;
  
  // Get all sites
  let sites = getAllVerifiedSites();
  
  // Filter by category if specified
  if (category) {
    sites = sites.filter(site => 
      site.category === category || site.category === 'all'
    );
  }
  
  // Filter by trust score
  sites = sites.filter(site => site.trustScore >= minTrustScore);
  
  // Exclude specified domains
  if (excludeDomains.length > 0) {
    sites = sites.filter(site => !excludeDomains.includes(site.domain));
  }
  
  // Sort by trust score (highest first)
  sites.sort((a, b) => b.trustScore - a.trustScore);
  
  // Limit number of sites
  sites = sites.slice(0, maxSites);
  
  // Generate search URLs
  return sites.map(site => ({
    name: site.name,
    domain: site.domain,
    url: buildSearchUrl(site, searchQuery),
    trustScore: site.trustScore,
    category: site.category
  }));
}

/**
 * Build search URL for a specific site
 * @param {Object} site - Site configuration
 * @param {string} query - Search query
 * @returns {string} Complete search URL
 */
function buildSearchUrl(site, query) {
  // URL encode the query
  const encodedQuery = encodeURIComponent(query);
  
  // Build URL with search parameter
  const separator = site.searchUrl.includes('?') ? '&' : '?';
  return `${site.searchUrl}${separator}${site.searchParam}=${encodedQuery}`;
}

/**
 * Get site configuration by domain
 * @param {string} domain - Site domain
 * @returns {Object|null} Site configuration
 */
function getSiteByDomain(domain) {
  const allSites = getAllVerifiedSites();
  return allSites.find(site => 
    domain.includes(site.domain) || site.domain.includes(domain)
  ) || null;
}

/**
 * Check if a domain is verified
 * @param {string} domain - Domain to check
 * @returns {boolean} True if verified
 */
function isVerifiedSite(domain) {
  return getSiteByDomain(domain) !== null;
}

/**
 * Get trust score for a domain
 * @param {string} domain - Domain to check
 * @returns {number} Trust score (0-10)
 */
function getTrustScore(domain) {
  const site = getSiteByDomain(domain);
  return site ? site.trustScore : 0;
}

/**
 * Generate search URLs for specific product category
 * @param {string} searchQuery - Search query
 * @param {string} category - Product category
 * @returns {Array<Object>} Filtered search URLs
 */
function generateCategoryUrls(searchQuery, category) {
  return generateSearchUrls(searchQuery, {
    category: category,
    maxSites: 10
  });
}

/**
 * Generate search URLs for top-tier sites only
 * @param {string} searchQuery - Search query
 * @returns {Array<Object>} Top-tier search URLs
 */
function generateTopTierUrls(searchQuery) {
  return generateSearchUrls(searchQuery, {
    minTrustScore: 9,
    maxSites: 10
  });
}

/**
 * Get site statistics
 * @returns {Object} Statistics about verified sites
 */
function getSiteStats() {
  const allSites = getAllVerifiedSites();
  
  return {
    total: allSites.length,
    tier1: VERIFIED_SITES.tier1.length,
    tier2: VERIFIED_SITES.tier2.length,
    tier3: VERIFIED_SITES.tier3.length,
    categories: {
      all: allSites.filter(s => s.category === 'all').length,
      electronics: allSites.filter(s => s.category === 'electronics').length,
      fashion: allSites.filter(s => s.category === 'fashion').length,
      supplements: allSites.filter(s => s.category === 'supplements').length,
      beauty: allSites.filter(s => s.category === 'beauty').length,
      sports: allSites.filter(s => s.category === 'sports').length,
      kids: allSites.filter(s => s.category === 'kids').length
    },
    averageTrustScore: allSites.reduce((sum, s) => sum + s.trustScore, 0) / allSites.length
  };
}

// Export functions and data
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VERIFIED_SITES,
    getAllVerifiedSites,
    generateSearchUrls,
    generateCategoryUrls,
    generateTopTierUrls,
    getSiteByDomain,
    isVerifiedSite,
    getTrustScore,
    getSiteStats
  };
}
