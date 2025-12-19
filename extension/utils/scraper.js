/**
 * Invisible Tab Scraper for Price Comparison
 * Opens tabs in background, extracts data with AI, closes automatically
 */

/**
 * Scrape a single site with Deep Linking support
 * 1. Opens search URL
 * 2. Uses AI to find exact product match URL
 * 3. Navigates to that URL
 * 4. Extracts product data
 * @param {string} searchUrl - Search URL to start with
 * @param {string} siteName - Name of the site
 * @param {Object} targetProduct - Target product details for matching
 * @returns {Promise<Object>} Scraped product data
 */
async function scrapeSingleSite(searchUrl, siteName, targetProduct = null) {
  return new Promise((resolve, reject) => {
    console.log(`🔍 [${siteName}] Starting deep scrape: ${searchUrl}`);

    let tabId = null;
    let timeoutId = null;

    chrome.tabs.create({
      url: searchUrl,
      active: false,
      pinned: false
    }, async (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Failed to create tab: ${chrome.runtime.lastError.message}`));
        return;
      }

      tabId = tab.id;

      // Auto-close timeout
      timeoutId = setTimeout(() => {
        closeTab(tabId);
        reject(new Error(`Scraping timeout for ${siteName}`));
      }, Config.EXTRACTION_TIMEOUT * 2); // Double timeout for deep linking

      try {
        // Step 1: Wait for Page Load (Smart Wait)
        await waitForPageLoad(tabId);

        let productUrl = searchUrl; // Default to search page if no target provided (fallback)

        // Step 2: Find Deep Link (if target provided)
        if (targetProduct) {
          console.log(`🕵️ [${siteName}] Analyzing search results for deep link...`);
          const searchPageHtml = await getPageHtml(tabId);
          const deepLink = await extractBestMatchFromSearchResults(searchPageHtml.html, searchUrl, targetProduct);

          if (deepLink) {
            console.log(`🎯 [${siteName}] Found deep link: ${deepLink}`);
            productUrl = deepLink;

            // Navigate to product page
            await chrome.tabs.update(tabId, { url: productUrl });
            await waitForPageLoad(tabId); // Smart wait again
          } else {
            console.log(`⚠️ [${siteName}] No deep link found, scraping search page as fallback.`);
          }
        }

        // Step 3: Extract Product Data from current page
        const data = await extractFromTab(tabId, productUrl, siteName);

        clearTimeout(timeoutId);
        closeTab(tabId);
        resolve(data);

      } catch (error) {
        clearTimeout(timeoutId);
        closeTab(tabId);
        reject(error);
      }
    });
  });
}

/**
 * Helper to get HTML from tab
 */
function getPageHtml(tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => ({
        html: document.documentElement.outerHTML,
        url: window.location.href
      })
    }, (results) => {
      if (chrome.runtime.lastError || !results?.[0]?.result) {
        reject(new Error('Failed to get HTML'));
      } else {
        resolve(results[0].result);
      }
    });
  });
}

/**
 * Smart wait for page load
 * Polls document.readyState until 'complete'
 */
async function waitForPageLoad(tabId, timeoutMs = 10000) {
  const startTime = Date.now();
  console.log(`⏳ Waiting for tab ${tabId} to load...`);

  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() - startTime > timeoutMs) {
        console.warn(`⚠️ Wait timeout for tab ${tabId} (proceeding anyway)`);
        resolve(); // Resolve anyway to attempt scraping
        return;
      }

      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error("Tab closed during wait"));
          return;
        }

        if (tab.status === 'complete') {
          // Give it a tiny buffer for dynamic content (hydration)
          setTimeout(resolve, 1500);
        } else {
          setTimeout(poll, 500);
        }
      });
    };
    poll();
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
      scrapeSingleSite(site.url, site.name, site.targetProduct)
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

  // Attach target product info to each search URL object for deep linking
  const sitesToScrape = searchUrls.map(s => ({
    ...s,
    targetProduct: options.targetProduct // Info needed for deep linking
  }));

  if (searchUrls.length === 0) {
    throw new Error('No search URLs generated');
  }

  console.log(`📋 Generated ${searchUrls.length} search URLs`);

  // Scrape all sites
  const scrapeResults = await scrapeMultipleSites(sitesToScrape, maxConcurrent);

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

// Define global Scraper object
const Scraper = {
  scrapeSingleSite,
  scrapeMultipleSites,
  scrapeComparison
};

// Expose to window
if (typeof window !== 'undefined') {
  window.Scraper = Scraper;
}

// Export for module systems (optional)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Scraper;
}
