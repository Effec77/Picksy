/**
 * Hybrid Site Management System
 * Combines hardcoded sites (fast) with AI discovery (scalable)
 */

/**
 * Site Manager - Handles both hardcoded and AI-discovered sites
 */
const SiteManager = {
  
  /**
   * Get all available sites for comparison
   * Priority: Hardcoded > User-added > AI-discovered
   */
  async getAllSites() {
    try {
      // 1. Get hardcoded sites (16 verified sites)
      const hardcodedSites = getAllVerifiedSites();
      
      // 2. Get user-added sites from storage
      const { customSites = [] } = await chrome.storage.sync.get('customSites');
      
      // 3. Get AI-discovered sites from storage
      const { aiDiscoveredSites = [] } = await chrome.storage.sync.get('aiDiscoveredSites');
      
      // Combine all sites
      const allSites = [
        ...hardcodedSites.map(site => ({ ...site, source: 'hardcoded' })),
        ...customSites.map(site => ({ ...site, source: 'user-added' })),
        ...aiDiscoveredSites.map(site => ({ ...site, source: 'ai-discovered' }))
      ];
      
      // Remove duplicates by domain
      const uniqueSites = this.removeDuplicateSites(allSites);
      
      console.log(`📊 Total sites available: ${uniqueSites.length} (${hardcodedSites.length} hardcoded + ${customSites.length} user + ${aiDiscoveredSites.length} AI)`);
      
      return uniqueSites;
    } catch (error) {
      console.error('Failed to get all sites:', error);
      return getAllVerifiedSites(); // Fallback to hardcoded only
    }
  },
  
  /**
   * Check if we can compare on the current site
   */
  async canCompareOnCurrentSite() {
    const currentDomain = this.getCurrentDomain();
    const allSites = await this.getAllSites();
    
    return allSites.some(site => 
      currentDomain.includes(site.domain) || site.domain.includes(currentDomain)
    );
  },
  
  /**
   * Handle unknown site - offer AI discovery
   */
  async handleUnknownSite(productQuery) {
    const currentDomain = this.getCurrentDomain();
    
    // Check if already discovered
    const { aiDiscoveredSites = [] } = await chrome.storage.sync.get('aiDiscoveredSites');
    const existing = aiDiscoveredSites.find(site => 
      currentDomain.includes(site.domain) || site.domain.includes(currentDomain)
    );
    
    if (existing) {
      console.log(`✅ Site ${currentDomain} already discovered`);
      return existing;
    }
    
    // Discover new site with AI
    console.log(`🔍 Discovering new site: ${currentDomain}`);
    
    try {
      const discoveredSite = await this.discoverSiteWithAI(currentDomain, productQuery);
      
      if (discoveredSite) {
        // Save to storage
        aiDiscoveredSites.push(discoveredSite);
        await chrome.storage.sync.set({ aiDiscoveredSites });
        
        console.log(`✅ Successfully discovered and added: ${currentDomain}`);
        return discoveredSite;
      }
    } catch (error) {
      console.error(`❌ Failed to discover site ${currentDomain}:`, error);
    }
    
    return null;
  },
  
  /**
   * AI-powered site discovery using Gemini
   */
  async discoverSiteWithAI(domain, productQuery) {
    try {
      // Step 1: Get the homepage HTML
      const homepageUrl = `https://${domain}`;
      const homepageHtml = await this.fetchPageHTML(homepageUrl);
      
      if (!homepageHtml) {
        throw new Error('Could not fetch homepage');
      }
      
      // Step 2: Ask Gemini to analyze the site
      const analysisPrompt = `
Analyze this e-commerce website homepage and extract search functionality:

TASK: Find how to search for products on this site
RETURN: JSON object with search configuration

HTML (first 5000 chars): ${homepageHtml.substring(0, 5000)}

Required JSON format:
{
  "isEcommerce": true/false,
  "searchUrl": "https://example.com/search",
  "searchParam": "q",
  "siteName": "Site Name",
  "category": "electronics/fashion/all/beauty/sports",
  "trustScore": 7,
  "confidence": 0.9
}

Rules:
1. Only return JSON, no other text
2. searchUrl should be the complete search page URL
3. searchParam is the query parameter name (q, keyword, search, etc.)
4. trustScore: 8-9 for known brands, 6-7 for unknown sites
5. Set isEcommerce to false if not a shopping site
`;

      const analysisResult = await this.callGeminiAPI(analysisPrompt);
      
      if (!analysisResult || !analysisResult.isEcommerce) {
        console.log(`❌ ${domain} is not an e-commerce site`);
        return null;
      }
      
      // Step 3: Test the search functionality
      const testQuery = productQuery || 'test product';
      const testUrl = this.buildSearchUrl(analysisResult, testQuery);
      const testHtml = await this.fetchPageHTML(testUrl);
      
      if (!testHtml) {
        throw new Error('Search URL test failed');
      }
      
      // Step 4: Verify search results with Gemini
      const verificationPrompt = `
Does this page show product search results for "${testQuery}"?

HTML (first 3000 chars): ${testHtml.substring(0, 3000)}

Return JSON: { "hasResults": true/false, "confidence": 0.9 }
`;

      const verification = await this.callGeminiAPI(verificationPrompt);
      
      if (!verification || !verification.hasResults) {
        console.log(`❌ Search test failed for ${domain}`);
        return null;
      }
      
      // Step 5: Create site configuration
      const discoveredSite = {
        name: analysisResult.siteName || domain,
        domain: domain,
        searchUrl: analysisResult.searchUrl,
        searchParam: analysisResult.searchParam,
        trustScore: Math.max(6, analysisResult.trustScore || 7), // Minimum 6 for AI-discovered
        category: analysisResult.category || 'all',
        source: 'ai-discovered',
        discoveredAt: Date.now(),
        confidence: analysisResult.confidence || 0.8,
        verified: verification.hasResults
      };
      
      console.log(`✅ Successfully discovered site:`, discoveredSite);
      return discoveredSite;
      
    } catch (error) {
      console.error(`Failed to discover site ${domain}:`, error);
      return null;
    }
  },
  
  /**
   * Generate search URLs for all available sites
   */
  async generateSearchUrls(searchQuery, options = {}) {
    const allSites = await this.getAllSites();
    
    const {
      category = null,
      minTrustScore = 6, // Lower for AI-discovered sites
      maxSites = 15,
      excludeDomains = []
    } = options;
    
    // Filter sites
    let filteredSites = allSites.filter(site => {
      // Category filter
      if (category && site.category !== category && site.category !== 'all') {
        return false;
      }
      
      // Trust score filter
      if (site.trustScore < minTrustScore) {
        return false;
      }
      
      // Exclude domains
      if (excludeDomains.includes(site.domain)) {
        return false;
      }
      
      return true;
    });
    
    // Sort by trust score and source priority
    filteredSites.sort((a, b) => {
      // Prioritize hardcoded sites
      if (a.source === 'hardcoded' && b.source !== 'hardcoded') return -1;
      if (b.source === 'hardcoded' && a.source !== 'hardcoded') return 1;
      
      // Then by trust score
      return b.trustScore - a.trustScore;
    });
    
    // Limit results
    filteredSites = filteredSites.slice(0, maxSites);
    
    // Generate URLs
    return filteredSites.map(site => ({
      name: site.name,
      domain: site.domain,
      url: this.buildSearchUrl(site, searchQuery),
      trustScore: site.trustScore,
      category: site.category,
      source: site.source
    }));
  },
  
  /**
   * Smart comparison - handles unknown sites automatically
   */
  async smartComparison(productQuery) {
    console.log(`🚀 Starting smart comparison for: ${productQuery}`);
    
    // Step 1: Check if current site is known
    const currentDomain = this.getCurrentDomain();
    const canCompare = await this.canCompareOnCurrentSite();
    
    if (!canCompare) {
      console.log(`🔍 Unknown site detected: ${currentDomain}`);
      
      // Try to discover it
      const discovered = await this.handleUnknownSite(productQuery);
      
      if (!discovered) {
        console.log(`❌ Could not discover ${currentDomain} - proceeding with known sites only`);
      }
    }
    
    // Step 2: Generate search URLs for all available sites
    const searchUrls = await this.generateSearchUrls(productQuery, {
      maxSites: 12, // Reasonable limit
      minTrustScore: 6 // Include AI-discovered sites
    });
    
    console.log(`📊 Generated ${searchUrls.length} search URLs`);
    console.log(`Sources: ${this.getSourceBreakdown(searchUrls)}`);
    
    return searchUrls;
  },
  
  /**
   * Utility functions
   */
  getCurrentDomain() {
    try {
      return new URL(window.location.href).hostname.replace('www.', '');
    } catch {
      return '';
    }
  },
  
  buildSearchUrl(site, query) {
    const encodedQuery = encodeURIComponent(query);
    const separator = site.searchUrl.includes('?') ? '&' : '?';
    return `${site.searchUrl}${separator}${site.searchParam}=${encodedQuery}`;
  },
  
  removeDuplicateSites(sites) {
    const seen = new Set();
    return sites.filter(site => {
      const key = site.domain.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  },
  
  getSourceBreakdown(sites) {
    const breakdown = sites.reduce((acc, site) => {
      acc[site.source] = (acc[site.source] || 0) + 1;
      return acc;
    }, {});
    
    return Object.entries(breakdown)
      .map(([source, count]) => `${count} ${source}`)
      .join(', ');
  },
  
  /**
   * Fetch page HTML (with error handling)
   */
  async fetchPageHTML(url) {
    try {
      // Create invisible tab
      const tab = await chrome.tabs.create({ url, active: false });
      
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Get HTML content
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => document.documentElement.outerHTML
      });
      
      // Close tab
      await chrome.tabs.remove(tab.id);
      
      return result.result;
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      return null;
    }
  },
  
  /**
   * Call Gemini API for site analysis
   */
  async callGeminiAPI(prompt) {
    try {
      const response = await fetch(Config.GEMINI_API_URL, {
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
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('No valid JSON in Gemini response');
    } catch (error) {
      console.error('Gemini API call failed:', error);
      return null;
    }
  },
  
  /**
   * Get statistics about all sites
   */
  async getSiteStatistics() {
    const allSites = await this.getAllSites();
    
    const stats = {
      total: allSites.length,
      sources: {
        hardcoded: allSites.filter(s => s.source === 'hardcoded').length,
        userAdded: allSites.filter(s => s.source === 'user-added').length,
        aiDiscovered: allSites.filter(s => s.source === 'ai-discovered').length
      },
      categories: {},
      averageTrustScore: 0
    };
    
    // Calculate category breakdown
    allSites.forEach(site => {
      stats.categories[site.category] = (stats.categories[site.category] || 0) + 1;
    });
    
    // Calculate average trust score
    stats.averageTrustScore = allSites.reduce((sum, site) => sum + site.trustScore, 0) / allSites.length;
    
    return stats;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SiteManager;
}