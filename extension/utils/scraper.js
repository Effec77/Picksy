/**
 * Invisible Tab Scraper for Price Comparison
 * Opens tabs in background, extracts data with AI, closes automatically
 */

/**
 * Scrape a single URL using invisible tab + AI extraction
 * @param {string} url - URL to scrape
 * @param {string} siteName - Name of the site (for logging)
 * @returns {Promise<Object>} Scraped product data
 */
async function scrapeSingleSite(url, siteName) {
  return new Promise((resolve, reject) => {
    console.log(`🔍 [${siteName}] Starting scrape: ${url}`);
    
    let tabId = null;
    let scraped = false;
    let timeoutId = null;
    
    // Create invisible tab (active: false means it won't show)
    chrome.tabs.create({
      url: url,
      active: false,  // CRITICAL: Don't show the tab
      pinned: false
    }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error(`❌ [${siteName}] Failed to create tab:`, chrome.runtime.lastError.message);
        reject(new Error(`Failed to create tab: ${chrome.runtime.lastError.message}`));
        return;
      }
      
      tabId = tab.id;
      console.log(`📂 [${siteName}] Tab created: ${tabId}`);
      
      // Set timeout for scraping (30 seconds)
      timeoutId = setTimeout(() => {
        if (!scraped) {
          console.warn(`⏱️ [${siteName}] Timeout - closing tab ${tabId}`);
          closeTab(tabId);
          reject(new Error(`Scraping timeout for ${siteName}`));
        }
      }, Config.EXTRACTION_TIMEOUT);
      
      // Wait for page to load, then extract
      setTimeout(() => {
        extractFromTab(tabId, url, siteName)
          .then((data) => {
            scraped = true;
            clearTimeout(timeoutId);
            console.log(`✅ [${siteName}] Scrape successful`);
            closeTab(tabId);
            resolve(data);
          })
          .catch((error) => {
            scraped = true;
            clearTimeout(timeoutId);
            console.error(`❌ [${siteName}] Extraction failed:`, error.message);
            closeTab(tabId);
            reject(error);
          });
      }, 6000); // Wait 6 seconds for page load
    });
  });
}

/**
 * Extract data from an open tab using AI
 * @param {number} tabId - Chrome tab ID
 * @param {string} url - Page URL
 * @param {string} siteName - Site name
 * @returns {Promise<Object>} Extracted product data
 */
async function extractFromTab(tabId, url, siteName) {
  return new Promise((resolve, reject) => {
    // Execute script to get page HTML
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        return {
          html: document.documentElement.outerHTML,
          title: document.title,
          url: window.location.href
        };
      }
    }, async (results) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Script execution failed: ${chrome.runtime.lastError.message}`));
        return;
      }
      
      if (!results || !results[0] || !results[0].result) {
        reject(new Error('No results from script execution'));
        return;
      }
      
      const pageData = results[0].result;
      console.log(`📄 [${siteName}] Got HTML (${pageData.html.length} chars)`);
      
      try {
        // Use AI to extract product data
        const productData = await extractProductData(pageData.html, pageData.url);
        
        // Add site name
        productData.siteName = siteName;
        productData.sourceUrl = url;
        
        resolve(productData);
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Close a tab safely
 * @param {number} tabId - Tab ID to close
 */
function closeTab(tabId) {
  if (!tabId) return;
  
  try {
    chrome.tabs.remove(tabId, () => {
      if (chrome.runtime.lastError) {
        console.debug(`Tab ${tabId} already closed`);
      } else {
        console.log(`🗑️ Closed tab ${tabId}`);
      }
    });
  } catch (error) {
    console.debug(`Error closing tab ${tabId}:`, error.message);
  }
}

/**
 * Scrape multiple sites in parallel (with concurrency limit)
 * @param {Array<Object>} sites - Array of {url, name} objects
 * @param {number} maxConcurrent - Max concurrent tabs (default: 3)
 * @returns {Promise<Array<Object>>} Array of scraped results
 */
async function scrapeMultipleSites(sites, maxConcurrent = 3) {
  console.log(`🚀 Starting parallel scrape of ${sites.length} sites (max ${maxConcurrent} concurrent)`);
  
  const results = [];
  const errors = [];
  
  // Process sites in batches
  for (let i = 0; i < sites.length; i += maxConcurrent) {
    const batch = sites.slice(i, i + maxConcurrent);
    console.log(`📦 Processing batch ${Math.floor(i / maxConcurrent) + 1}: ${batch.map(s => s.name).join(', ')}`);
    
    // Scrape batch in parallel
    const batchPromises = batch.map(site => 
      scrapeSingleSite(site.url, site.name)
        .then(data => ({ success: true, site: site.name, data }))
        .catch(error => ({ success: false, site: site.name, error: error.message }))
    );
    
    const batchResults = await Promise.all(batchPromises);
    
    // Separate successes and failures
    batchResults.forEach(result => {
      if (result.success) {
        results.push(result.data);
        console.log(`✅ [${result.site}] Success`);
      } else {
        errors.push(result);
        console.warn(`❌ [${result.site}] Failed: ${result.error}`);
      }
    });
    
    // Wait between batches to avoid overwhelming the browser
    if (i + maxConcurrent < sites.length) {
      console.log(`⏳ Waiting ${Config.TAB_DELAY}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, Config.TAB_DELAY));
    }
  }
  
  console.log(`✅ Scraping complete: ${results.length} successful, ${errors.length} failed`);
  
  return {
    results: results,
    errors: errors,
    successCount: results.length,
    failureCount: errors.length,
    totalCount: sites.length
  };
}

/**
 * Scrape product comparison across multiple sites
 * @param {string} searchQuery - Search query (e.g., "iPhone 15 Pro 128GB")
 * @param {Object} options - Scraping options
 * @returns {Promise<Object>} Comparison results
 */
async function scrapeComparison(searchQuery, options = {}) {
  const {
    maxSites = 10,
    category = null,
    excludeDomains = [],
    maxConcurrent = 3
  } = options;
  
  console.log(`🔍 Starting comparison scrape for: "${searchQuery}"`);
  
  // Generate search URLs
  const searchUrls = generateSearchUrls(searchQuery, {
    maxSites: maxSites,
    category: category,
    excludeDomains: excludeDomains
  });
  
  if (searchUrls.length === 0) {
    throw new Error('No search URLs generated');
  }
  
  console.log(`📋 Generated ${searchUrls.length} search URLs`);
  
  // Scrape all sites
  const scrapeResults = await scrapeMultipleSites(searchUrls, maxConcurrent);
  
  return {
    query: searchQuery,
    scrapedAt: Date.now(),
    ...scrapeResults
  };
}

/**
 * Quick test function to scrape a single site
 * @param {string} url - URL to test
 * @returns {Promise<Object>} Scraped data
 */
async function testScrape(url) {
  console.log('🧪 Test scrape starting...');
  const result = await scrapeSingleSite(url, 'Test Site');
  console.log('🧪 Test scrape result:', result);
  return result;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    scrapeSingleSite,
    scrapeMultipleSites,
    scrapeComparison,
    testScrape
  };
}
