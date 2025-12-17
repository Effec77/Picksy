/**
 * Popup Integration for Hybrid AI System
 * Connects popup UI with enhanced extraction and comparison
 */

/**
 * Popup Integration Manager
 */
const PopupIntegration = {
  
  /**
   * Initialize popup with hybrid system
   */
  async init() {
    console.log('🚀 Initializing popup with hybrid AI system...');
    
    try {
      // Load configuration
      await this.loadConfig();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Update UI with current status
      await this.updateStatus();
      
      console.log('✅ Popup integration initialized');
    } catch (error) {
      console.error('❌ Failed to initialize popup integration:', error);
    }
  },
  
  /**
   * Load configuration and settings
   */
  async loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['geminiApiKey', 'hybridSettings'], (result) => {
        this.config = {
          apiKey: result.geminiApiKey || null,
          settings: result.hybridSettings || {
            preferUniversal: true,
            enableAIFallback: true,
            enableSiteDiscovery: true,
            maxComparisonSites: 12
          }
        };
        resolve();
      });
    });
  },
  
  /**
   * Setup event listeners for popup buttons
   */
  setupEventListeners() {
    // Compare prices button
    const compareBtn = document.getElementById('compareBtn');
    if (compareBtn) {
      compareBtn.addEventListener('click', () => this.startComparison());
    }
    
    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.openSettings());
    }
    
    // API key input
    const apiKeyInput = document.getElementById('apiKeyInput');
    if (apiKeyInput) {
      apiKeyInput.addEventListener('change', (e) => this.saveApiKey(e.target.value));
    }
  },
  
  /**
   * Update popup status display
   */
  async updateStatus() {
    try {
      // Get current tab info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Update site info
      this.updateSiteInfo(tab.url);
      
      // Update system status
      await this.updateSystemStatus();
      
      // Update comparison stats
      await this.updateComparisonStats();
      
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  },
  
  /**
   * Update site information
   */
  updateSiteInfo(url) {
    try {
      const hostname = new URL(url).hostname.replace('www.', '');
      const siteElement = document.getElementById('currentSite');
      
      if (siteElement) {
        siteElement.textContent = hostname;
      }
      
      // Check if site is supported
      this.checkSiteSupport(hostname);
      
    } catch (error) {
      console.error('Failed to update site info:', error);
    }
  },
  
  /**
   * Check if current site is supported
   */
  async checkSiteSupport(hostname) {
    try {
      // Check hardcoded sites
      const isHardcoded = await this.isHardcodedSite(hostname);
      
      // Check AI-discovered sites
      const isDiscovered = await this.isDiscoveredSite(hostname);
      
      const statusElement = document.getElementById('siteStatus');
      if (statusElement) {
        if (isHardcoded) {
          statusElement.innerHTML = '✅ Verified Site';
          statusElement.className = 'status verified';
        } else if (isDiscovered) {
          statusElement.innerHTML = '🤖 AI-Discovered Site';
          statusElement.className = 'status discovered';
        } else {
          statusElement.innerHTML = '🔍 Unknown Site (Will Auto-Discover)';
          statusElement.className = 'status unknown';
        }
      }
      
    } catch (error) {
      console.error('Failed to check site support:', error);
    }
  },
  
  /**
   * Check if site is in hardcoded list
   */
  async isHardcodedSite(hostname) {
    // This would check against our hardcoded sites
    const hardcodedSites = [
      'amazon.in', 'flipkart.com', 'myntra.com', 'ajio.com',
      'croma.com', 'lenskart.com', 'boat-lifestyle.com'
      // ... add all 26 sites
    ];
    
    return hardcodedSites.some(site => hostname.includes(site) || site.includes(hostname));
  },
  
  /**
   * Check if site was AI-discovered
   */
  async isDiscoveredSite(hostname) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['aiDiscoveredSites'], (result) => {
        const discoveredSites = result.aiDiscoveredSites || [];
        const isDiscovered = discoveredSites.some(site => 
          hostname.includes(site.domain) || site.domain.includes(hostname)
        );
        resolve(isDiscovered);
      });
    });
  },
  
  /**
   * Update system status
   */
  async updateSystemStatus() {
    const statusElement = document.getElementById('systemStatus');
    if (!statusElement) return;
    
    const status = {
      extraction: this.config.apiKey ? 'AI + Universal' : 'Universal Only',
      sites: await this.getTotalSiteCount(),
      apiStatus: this.config.apiKey ? 'Configured' : 'Not Configured'
    };
    
    statusElement.innerHTML = `
      <div class="status-item">
        <span class="label">Extraction:</span>
        <span class="value">${status.extraction}</span>
      </div>
      <div class="status-item">
        <span class="label">Sites:</span>
        <span class="value">${status.sites}</span>
      </div>
      <div class="status-item">
        <span class="label">AI Status:</span>
        <span class="value ${status.apiStatus === 'Configured' ? 'success' : 'warning'}">${status.apiStatus}</span>
      </div>
    `;
  },
  
  /**
   * Get total site count
   */
  async getTotalSiteCount() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['aiDiscoveredSites'], (result) => {
        const hardcodedCount = 26; // Our hardcoded sites
        const discoveredCount = (result.aiDiscoveredSites || []).length;
        resolve(hardcodedCount + discoveredCount);
      });
    });
  },
  
  /**
   * Update comparison statistics
   */
  async updateComparisonStats() {
    const statsElement = document.getElementById('comparisonStats');
    if (!statsElement) return;
    
    // Get recent comparison data
    const stats = await this.getComparisonStats();
    
    statsElement.innerHTML = `
      <div class="stat-item">
        <span class="number">${stats.totalComparisons}</span>
        <span class="label">Comparisons</span>
      </div>
      <div class="stat-item">
        <span class="number">₹${stats.totalSavings.toLocaleString()}</span>
        <span class="label">Total Saved</span>
      </div>
      <div class="stat-item">
        <span class="number">${stats.averageConfidence}%</span>
        <span class="label">Avg Confidence</span>
      </div>
    `;
  },
  
  /**
   * Get comparison statistics
   */
  async getComparisonStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['comparisonHistory'], (result) => {
        const history = result.comparisonHistory || [];
        
        const stats = {
          totalComparisons: history.length,
          totalSavings: history.reduce((sum, comp) => sum + (comp.savings || 0), 0),
          averageConfidence: history.length > 0 
            ? Math.round(history.reduce((sum, comp) => sum + (comp.confidence || 0), 0) / history.length * 100)
            : 0
        };
        
        resolve(stats);
      });
    });
  },
  
  /**
   * Start price comparison
   */
  async startComparison() {
    console.log('🚀 Starting hybrid price comparison...');
    
    try {
      // Update UI to show loading
      this.showComparisonLoading();
      
      // Get current product data
      const productData = await this.getCurrentProduct();
      
      if (!productData || !productData.success) {
        throw new Error('Could not extract product data from current page');
      }
      
      // Generate search URLs using hybrid site manager
      const searchUrls = await this.generateSearchUrls(productData);
      
      // Start comparison process
      const results = await this.runComparison(searchUrls, productData);
      
      // Display results
      this.displayComparisonResults(results);
      
      // Save to history
      this.saveComparisonHistory(productData, results);
      
    } catch (error) {
      console.error('❌ Comparison failed:', error);
      this.showComparisonError(error.message);
    }
  },
  
  /**
   * Get current product data
   */
  async getCurrentProduct() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        
        chrome.tabs.sendMessage(tab.id, { type: 'PICKSY_SCRAPE' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to get product data:', chrome.runtime.lastError.message);
            resolve(null);
          } else {
            resolve(response);
          }
        });
      });
    });
  },
  
  /**
   * Generate search URLs for comparison
   */
  async generateSearchUrls(productData) {
    // Extract keywords for search
    const keywords = this.extractSearchKeywords(productData);
    
    // Get all available sites (hardcoded + discovered)
    const sites = await this.getAllSites();
    
    // Generate search URLs
    const searchUrls = sites.map(site => ({
      name: site.name,
      domain: site.domain,
      url: this.buildSearchUrl(site, keywords),
      trustScore: site.trustScore,
      source: site.source || 'hardcoded'
    }));
    
    console.log(`📊 Generated ${searchUrls.length} search URLs`);
    return searchUrls.slice(0, this.config.settings.maxComparisonSites);
  },
  
  /**
   * Extract search keywords from product data
   */
  extractSearchKeywords(productData) {
    const title = productData.title || '';
    
    // Simple keyword extraction (could be enhanced)
    const keywords = title
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 5)
      .join(' ');
    
    return keywords;
  },
  
  /**
   * Get all available sites
   */
  async getAllSites() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['aiDiscoveredSites'], (result) => {
        // Hardcoded sites (simplified list)
        const hardcodedSites = [
          { name: 'Amazon India', domain: 'amazon.in', searchUrl: 'https://www.amazon.in/s', searchParam: 'k', trustScore: 9 },
          { name: 'Flipkart', domain: 'flipkart.com', searchUrl: 'https://www.flipkart.com/search', searchParam: 'q', trustScore: 9 },
          { name: 'Myntra', domain: 'myntra.com', searchUrl: 'https://www.myntra.com/search', searchParam: 'q', trustScore: 9 }
          // ... add all 26 sites
        ];
        
        const discoveredSites = result.aiDiscoveredSites || [];
        
        resolve([...hardcodedSites, ...discoveredSites]);
      });
    });
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
   * Run comparison across sites
   */
  async runComparison(searchUrls, originalProduct) {
    console.log(`🔍 Comparing across ${searchUrls.length} sites...`);
    
    const results = [];
    const batchSize = 3; // Process 3 sites at a time
    
    for (let i = 0; i < searchUrls.length; i += batchSize) {
      const batch = searchUrls.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(site => this.scrapeSite(site, originalProduct))
      );
      
      results.push(...batchResults.filter(result => result !== null));
      
      // Update progress
      this.updateComparisonProgress(i + batchSize, searchUrls.length);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return results;
  },
  
  /**
   * Scrape a single site
   */
  async scrapeSite(site, originalProduct) {
    try {
      console.log(`🔍 Scraping ${site.name}...`);
      
      // Create invisible tab
      const tab = await chrome.tabs.create({ url: site.url, active: false });
      
      // Wait for page load
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Extract product data
      const result = await chrome.tabs.sendMessage(tab.id, { type: 'PICKSY_SCRAPE' });
      
      // Close tab
      await chrome.tabs.remove(tab.id);
      
      if (result && result.success) {
        return {
          ...result,
          siteName: site.name,
          trustScore: site.trustScore,
          source: site.source
        };
      }
      
      return null;
      
    } catch (error) {
      console.error(`❌ Failed to scrape ${site.name}:`, error);
      return null;
    }
  },
  
  /**
   * UI Update Methods
   */
  showComparisonLoading() {
    const resultsElement = document.getElementById('comparisonResults');
    if (resultsElement) {
      resultsElement.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <p>Comparing prices across sites...</p>
          <div class="progress-bar">
            <div class="progress" id="comparisonProgress"></div>
          </div>
        </div>
      `;
    }
  },
  
  updateComparisonProgress(current, total) {
    const progressElement = document.getElementById('comparisonProgress');
    if (progressElement) {
      const percentage = (current / total) * 100;
      progressElement.style.width = `${percentage}%`;
    }
  },
  
  displayComparisonResults(results) {
    const resultsElement = document.getElementById('comparisonResults');
    if (!resultsElement) return;
    
    if (results.length === 0) {
      resultsElement.innerHTML = `
        <div class="no-results">
          <p>No comparable products found</p>
        </div>
      `;
      return;
    }
    
    // Sort by price (lowest first)
    results.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
    
    const bestDeal = results[0];
    
    resultsElement.innerHTML = `
      <div class="best-deal">
        <h3>🏆 Best Deal</h3>
        <div class="deal-card">
          <div class="site-name">${bestDeal.siteName}</div>
          <div class="price">₹${bestDeal.price?.toLocaleString()}</div>
          <div class="trust">Trust: ${bestDeal.trustScore}/10</div>
          <button onclick="window.open('${bestDeal.url}', '_blank')">View Deal</button>
        </div>
      </div>
      
      <div class="all-results">
        <h4>All Results (${results.length})</h4>
        ${results.map(result => `
          <div class="result-card">
            <div class="site">${result.siteName}</div>
            <div class="price">₹${result.price?.toLocaleString() || 'N/A'}</div>
            <div class="confidence">${Math.round((result.confidence || 0) * 100)}%</div>
          </div>
        `).join('')}
      </div>
    `;
  },
  
  showComparisonError(message) {
    const resultsElement = document.getElementById('comparisonResults');
    if (resultsElement) {
      resultsElement.innerHTML = `
        <div class="error">
          <p>❌ Comparison failed: ${message}</p>
          <button onclick="PopupIntegration.startComparison()">Try Again</button>
        </div>
      `;
    }
  },
  
  /**
   * Save comparison to history
   */
  saveComparisonHistory(productData, results) {
    chrome.storage.local.get(['comparisonHistory'], (result) => {
      const history = result.comparisonHistory || [];
      
      const comparisonRecord = {
        timestamp: Date.now(),
        product: productData.title,
        url: productData.url,
        results: results.length,
        bestPrice: results.length > 0 ? Math.min(...results.map(r => r.price || Infinity)) : null,
        confidence: productData.confidence,
        extractionMethod: productData.extractionMethod
      };
      
      history.unshift(comparisonRecord);
      
      // Keep only last 50 comparisons
      if (history.length > 50) {
        history.splice(50);
      }
      
      chrome.storage.local.set({ comparisonHistory: history });
    });
  },
  
  /**
   * Save API key
   */
  async saveApiKey(apiKey) {
    if (apiKey && apiKey.startsWith('AIza')) {
      await chrome.storage.sync.set({ geminiApiKey: apiKey });
      this.config.apiKey = apiKey;
      console.log('✅ API key saved');
      await this.updateSystemStatus();
    }
  },
  
  /**
   * Open settings
   */
  openSettings() {
    // This would open a settings page or modal
    console.log('Opening settings...');
  }
};

// Auto-initialize when popup loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => PopupIntegration.init());
} else {
  PopupIntegration.init();
}

// Export for global access
window.PopupIntegration = PopupIntegration;