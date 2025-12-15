let currentProduct = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupCurrencyToggle();
  setupSettings();
  loadSaved();
  loadLastScrape();
  updateScanInfo();
  checkServiceWorkerHealth(); // Check if background script is responsive
  
  // Setup test buttons
  setupTestButtons();
  
  // Initialize comparison tab
  setTimeout(() => {
    const comparisonResults = document.getElementById('comparisonResults');
    if (comparisonResults && !comparisonResults.innerHTML.trim()) {
      comparisonResults.innerHTML = createComparisonInterface();
      setupComparisonTab();
    }
  }, 100);
});

// Setup test buttons with proper event listeners
function setupTestButtons() {
  console.log('🔧 Setting up test buttons...');
  
  const testSystemBtn = document.getElementById('testSystemBtn');
  const testDirectBtn = document.getElementById('testDirectBtn');
  
  if (testSystemBtn) {
    testSystemBtn.addEventListener('click', () => {
      console.log('🧪 Test System button clicked');
      testComparisonSystem();
    });
    console.log('✅ Test System button listener added');
  }
  
  if (testDirectBtn) {
    testDirectBtn.addEventListener('click', () => {
      console.log('🔧 Test Direct button clicked');
      testDirect();
    });
    console.log('✅ Test Direct button listener added');
  }
}

// Note: Tab cleanup removed - using mock results for now

// Tab functionality
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const targetTab = e.target.dataset.tab;

      // Update active tab
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      e.target.classList.add('active');
      document.getElementById(targetTab).classList.add('active');

      // Load tab-specific content
      if (targetTab === 'history' && currentProduct) {
        loadPriceHistory(currentProduct);
      }
      
      // Setup comparison tab when it's activated
      if (targetTab === 'comparison') {
        setupComparisonTab();
      }
    });
  });
}

// Currency toggle functionality
function setupCurrencyToggle() {
  document.querySelectorAll('.currency-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const currency = e.target.id.replace('currency', '');

      // Update active currency button
      document.querySelectorAll('.currency-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      // Send currency change message
      chrome.runtime.sendMessage({
        type: "PICKSY_CURRENCY_CHANGE",
        currency: currency
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error changing currency:", chrome.runtime.lastError);
        }
      });
    });
  });
}

// Ask the content script to scrape
document.getElementById("scanBtn").addEventListener("click", () => {
  const scanBtn = document.getElementById("scanBtn");
  const resultDiv = document.getElementById("result");
  
  // Show loading state
  scanBtn.disabled = true;
  scanBtn.innerHTML = '⏳ Scanning...';
  resultDiv.innerHTML = '<div style="text-align: center; padding: 20px;"><div class="loading-spinner"></div><p>Analyzing product...</p></div>';
  
  chrome.runtime.sendMessage({ type: "PICKSY_SCRAPE_REQUEST" }, (response) => {
    // Reset button after 3 seconds (in case no response comes back)
    setTimeout(() => {
      scanBtn.disabled = false;
      scanBtn.innerHTML = '🔍 Scan Current Page';
    }, 3000);
    
    if (chrome.runtime.lastError) {
      console.error("Error sending scrape request:", chrome.runtime.lastError);
      scanBtn.disabled = false;
      scanBtn.innerHTML = '🔍 Scan Current Page';
      showServiceWorkerError(resultDiv);
    }
  });
});

// Listen for scrape results
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "PICKSY_SCRAPE_RESULT_BROADCAST") {
    // Reset scan button
    const scanBtn = document.getElementById("scanBtn");
    scanBtn.disabled = false;
    scanBtn.innerHTML = '🔍 Scan Current Page';
    
    currentProduct = msg.payload;
    console.log('✅ Product scanned and stored:', currentProduct);
    
    // Check if scraping failed or no product detected
    if (!msg.payload || !msg.payload.title) {
      showNoProductDetected();
    } else {
      showResult(msg.payload);
      // Update comparison tab to show product is ready
      updateComparisonTabForProduct(msg.payload);
    }
  }
});

// Load last scrape on popup open
function loadLastScrape() {
  chrome.storage.local.get(['picksyLastScrape'], (result) => {
    if (result.picksyLastScrape) {
      currentProduct = result.picksyLastScrape;
      showResult(result.picksyLastScrape);
      // Update comparison tab if product exists
      updateComparisonTabForProduct(result.picksyLastScrape);
    }
  });
}

// Display current scrape result
function showResult(product) {
  const resultDiv = document.getElementById("result");
  const stockClass = product.availability === 'InStock' ? 'stock-in' :
    product.availability === 'OutOfStock' ? 'stock-out' : 'stock-unknown';

  // Build trust signals display
  let trustSignalsHTML = '';
  if (product.rating || product.reviewCount || product.seller || (product.badges && product.badges.length)) {
    trustSignalsHTML = '<div style="background: #f0f8ff; padding: 8px; border-radius: 5px; margin: 8px 0; border-left: 3px solid #007cba;">';
    trustSignalsHTML += '<strong style="color: #007cba;">Trust Signals:</strong><br/>';
    
    if (product.rating) {
      const stars = '⭐'.repeat(Math.round(product.rating));
      trustSignalsHTML += `<span style="font-size: 14px;">${stars} ${product.rating}/5</span>`;
      if (product.reviewCount) {
        trustSignalsHTML += ` <span style="color: #666; font-size: 12px;">(${product.reviewCount ? product.reviewCount.toLocaleString() : '0'} reviews)</span>`;
      }
      trustSignalsHTML += '<br/>';
    }
    
    if (product.seller) {
      trustSignalsHTML += `👤 Seller: <strong>${product.seller}</strong><br/>`;
    }
    
    if (product.badges && product.badges.length) {
      trustSignalsHTML += `🏆 ${product.badges.join(', ')}<br/>`;
    }
    
    trustSignalsHTML += '</div>';
  }

  resultDiv.innerHTML = `
    <div class="product" style="background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);">
      <h3 style="margin: 0 0 12px 0; color: #333; font-size: 15px; line-height: 1.4;">${product.title}</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
        <div style="background: white; padding: 8px; border-radius: 5px; border-left: 3px solid #28a745;">
          <strong style="font-size: 11px; color: #666;">PRICE</strong><br/>
          <span style="font-size: 18px; font-weight: bold; color: #28a745;">💰 ${product.price}</span>
        </div>
        <div style="background: white; padding: 8px; border-radius: 5px; border-left: 3px solid ${stockClass === 'stock-in' ? '#28a745' : '#dc3545'};">
          <strong style="font-size: 11px; color: #666;">STATUS</strong><br/>
          <span style="font-size: 14px; font-weight: bold;">
            <span class="stock-indicator ${stockClass}"></span>${product.availability}
          </span>
        </div>
      </div>
      <div style="background: white; padding: 8px; border-radius: 5px; margin-bottom: 12px; border-left: 3px solid #007cba;">
        <strong style="font-size: 11px; color: #666;">SOURCE</strong><br/>
        <span style="font-size: 13px; color: #333;">🌐 ${product.source}</span>
      </div>
      ${trustSignalsHTML}
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button id="saveBtn" style="flex: 1; background: #28a745;">💾 Save</button>
        <button id="viewHistoryBtn" style="flex: 1; background: #007cba;">📊 History</button>
        <a href="${product.url}" target="_blank" class="open-product-link" style="
          flex: 1;
          background: #6c5ce7;
          color: white;
          padding: 5px 10px;
          border-radius: 3px;
          text-decoration: none;
          text-align: center;
          font-size: 14px;
          transition: all 0.2s ease;
        ">🔗 Open</a>
      </div>
    </div>
  `;

  document.getElementById("saveBtn").addEventListener("click", () => {
    saveProduct(product);
  });

  document.getElementById("viewHistoryBtn").addEventListener("click", () => {
    document.querySelector('[data-tab="history"]').click();
  });
}

// Load price history and create chart
function loadPriceHistory(productOrId) {
  // Handle both product object and productId string
  let productId;
  if (typeof productOrId === 'string') {
    productId = productOrId;
  } else if (productOrId && productOrId.url && productOrId.title) {
    productId = generateProductId(productOrId.url, productOrId.title);
  } else {
    console.error('Invalid product or productId provided');
    return;
  }

  chrome.storage.local.get([`history_${productId}`], (result) => {
    const historyData = result[`history_${productId}`];
    
    const historyDetailsElement = document.getElementById('historyDetails');
    const priceChartElement = document.getElementById('priceChart');
    
    if (!historyDetailsElement || !priceChartElement) {
      console.error('History elements not found');
      return;
    }

    if (!historyData || !historyData.history || historyData.history.length === 0) {
      priceChartElement.innerHTML = `
        <div style="
          text-align: center;
          padding: 40px 20px;
          background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
          border-radius: 10px;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
        ">
          <div style="font-size: 48px; margin-bottom: 10px;">📊</div>
          <h3 style="margin: 0 0 8px 0; color: #333;">No Price History Yet</h3>
          <p style="margin: 0; font-size: 13px; color: #666;">
            Scan this product a few times to build price history!
          </p>
        </div>
      `;
      historyDetailsElement.innerHTML = '';
      return;
    }

    createPriceChart(historyData.history);
    displayHistoryDetails(historyData.history);
    
    // Switch to history tab
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelector('[data-tab="history"]').classList.add('active');
    document.getElementById('history').classList.add('active');
  });
}

// Create simple CSS-based price chart
function createPriceChart(history) {
  const priceChartElement = document.getElementById('priceChart');
  if (!priceChartElement) {
    console.error('priceChart element not found');
    return;
  }
  
  // Clear existing content first
  priceChartElement.innerHTML = '';
  
  console.log('📊 Creating chart with', history.length, 'data points');
  
  if (!history.length) {
    priceChartElement.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No price history available</p>';
    return;
  }
  
  // If only 1 data point, show a message
  if (history.length === 1) {
    const entry = history[0];
    const date = new Date(entry.timestamp).toLocaleDateString();
    console.log('📍 Single data point detected, showing message');
    priceChartElement.innerHTML = `
      <div style="
        text-align: center;
        padding: 40px 20px;
        background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
        border-radius: 10px;
        height: 180px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      ">
        <div style="font-size: 48px; margin-bottom: 10px;">📍</div>
        <h3 style="margin: 0 0 8px 0; color: #333;">First Data Point Recorded</h3>
        <p style="margin: 0; font-size: 13px; color: #666;">
          Price: ₹${entry.price ? entry.price.toLocaleString() : 'N/A'} on ${date}<br/>
          Scan this product again to see price trends!
        </p>
      </div>
    `;
    return;
  }
  
  console.log('📈 Drawing full chart with lines');
  
  const prices = history.map(h => h.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;
  
  let chartHTML = '<div style="position: relative; height: 180px; border: 1px solid #ddd; border-radius: 5px; padding: 20px 60px 20px 20px; background: #f9f9f9;">';
  
  // Create single SVG for all lines
  chartHTML += '<svg style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;">';
  
  // Add connecting lines
  history.forEach((entry, index) => {
    if (index > 0) {
      const x = (index / Math.max(history.length - 1, 1)) * 100;
      const y = 100 - ((entry.price - minPrice) / priceRange) * 80;
      const prevX = ((index - 1) / Math.max(history.length - 1, 1)) * 100;
      const prevY = 100 - ((history[index - 1].price - minPrice) / priceRange) * 80;
      
      chartHTML += `<line x1="${prevX}%" y1="${prevY}%" x2="${x}%" y2="${y}%" stroke="#007cba" stroke-width="2"/>`;
    }
  });
  
  chartHTML += '</svg>';
  
  // Add price points
  history.forEach((entry, index) => {
    const x = (index / Math.max(history.length - 1, 1)) * 100;
    const y = 100 - ((entry.price - minPrice) / priceRange) * 80;
    const stockColor = entry.stock ? '#28a745' : '#dc3545';
    const date = new Date(entry.timestamp).toLocaleDateString();
    
    chartHTML += `
      <div style="
        position: absolute;
        left: ${x}%;
        top: ${y}%;
        width: 8px;
        height: 8px;
        background: ${stockColor};
        border-radius: 50%;
        transform: translate(-50%, -50%);
        cursor: pointer;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        z-index: 2;
      " title="${date}: ₹${entry.price ? entry.price.toLocaleString() : 'N/A'} - ${entry.stock ? 'In Stock' : 'Out of Stock'}"></div>
    `;
  });
  
  // Add Y-axis labels
  chartHTML += `
    <div style="position: absolute; right: 5px; top: 10%; font-size: 12px; color: #666;">₹${maxPrice.toLocaleString()}</div>
    <div style="position: absolute; right: 5px; bottom: 10%; font-size: 12px; color: #666;">₹${minPrice.toLocaleString()}</div>
  `;
  
  chartHTML += '</div>';
  
  priceChartElement.innerHTML = chartHTML;
}

// Display history details
function displayHistoryDetails(history) {
  const detailsDiv = document.getElementById('historyDetails');
  const latest = history[history.length - 1];
  const oldest = history[0];
  
  // Safe price calculations with null checks
  const latestPrice = latest.price || 0;
  const oldestPrice = oldest.price || 0;
  
  let priceChange = 0;
  let changePercent = '0.0';
  
  if (latestPrice > 0 && oldestPrice > 0) {
    priceChange = latestPrice - oldestPrice;
    changePercent = ((priceChange / oldestPrice) * 100).toFixed(1);
  }
  
  const trendColor = priceChange < 0 ? '#28a745' : priceChange > 0 ? '#dc3545' : '#6c757d';
  const trendIcon = priceChange < 0 ? '📉' : priceChange > 0 ? '📈' : '➡️';

  detailsDiv.innerHTML = `
    <div class="product" style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);">
      <h4 style="margin: 0 0 12px 0; color: #333;">📊 Price Trends</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
        <div style="background: white; padding: 8px; border-radius: 5px;">
          <strong style="color: #666; font-size: 11px;">CURRENT</strong><br/>
          <span style="font-size: 16px; font-weight: bold; color: #007cba;">₹${latestPrice > 0 ? latestPrice.toLocaleString() : 'N/A'}</span>
        </div>
        <div style="background: white; padding: 8px; border-radius: 5px;">
          <strong style="color: #666; font-size: 11px;">CHANGE</strong><br/>
          <span style="font-size: 16px; font-weight: bold; color: ${trendColor};">
            ${trendIcon} ${changePercent}%
          </span>
        </div>
        <div style="background: white; padding: 8px; border-radius: 5px;">
          <strong style="color: #666; font-size: 11px;">LOWEST</strong><br/>
          <span style="font-size: 16px; font-weight: bold; color: #28a745;">₹${Math.min(...history.map(h => h.price || 0).filter(p => p > 0)).toLocaleString()}</span>
        </div>
        <div style="background: white; padding: 8px; border-radius: 5px;">
          <strong style="color: #666; font-size: 11px;">HIGHEST</strong><br/>
          <span style="font-size: 16px; font-weight: bold; color: #dc3545;">₹${Math.max(...history.map(h => h.price || 0).filter(p => p > 0)).toLocaleString()}</span>
        </div>
      </div>
      <p style="margin: 12px 0 0 0; font-size: 12px; color: #666; text-align: center;">
        📅 Tracked since ${new Date(oldest.timestamp).toLocaleDateString()} (${history.length} data points)
      </p>
    </div>
  `;
}

// Load cross-site comparison (DISABLED - Using new AI comparison system)
function loadComparison_OLD_DISABLED(product) {
  const comparisonDiv = document.getElementById('comparisonResults');

  // If no comparison URLs, generate them from the title
  if (!product.comparisonUrls || !product.comparisonUrls.length) {
    if (product.title) {
      // Generate comparison URLs from title
      const searchQuery = encodeURIComponent(product.title);
      const currentSite = product.source || '';
      
      const urls = [];
      
      if (!currentSite.includes('amazon')) {
        urls.push({
          site: 'Amazon India',
          icon: '📦',
          url: `https://www.amazon.in/s?k=${searchQuery}`,
          query: product.title
        });
      }
      
      if (!currentSite.includes('flipkart')) {
        urls.push({
          site: 'Flipkart',
          icon: '🛒',
          url: `https://www.flipkart.com/search?q=${searchQuery}`,
          query: product.title
        });
      }
      
      if (!currentSite.includes('myntra')) {
        urls.push({
          site: 'Myntra',
          icon: '👕',
          url: `https://www.myntra.com/search?q=${searchQuery}`,
          query: product.title
        });
      }
      
      product.comparisonUrls = urls;
      product.keywords = product.title.split(' ').slice(0, 4);
    } else {
      comparisonDiv.innerHTML = `
        <div style="text-align: center; padding: 30px 20px; background: #f8f9fa; border-radius: 10px;">
          <div style="font-size: 48px; margin-bottom: 10px;">🔍</div>
          <h3 style="margin: 0 0 8px 0;">No Product to Compare</h3>
          <p style="margin: 0; font-size: 13px; color: #666;">
            Scan a product first to see comparison options
          </p>
        </div>
      `;
      return;
    }
  }

  // Generate smart recommendation
  const recommendation = generateRecommendation(product);

  comparisonDiv.innerHTML = `
    ${recommendation}
    <div class="comparison-section">
      <h4 style="margin: 0 0 12px 0; color: #333;">🔍 Compare Prices Across Sites</h4>
      <div style="background: white; padding: 8px; border-radius: 5px; margin-bottom: 12px; border-left: 3px solid #007cba;">
        <strong style="font-size: 12px; color: #007cba;">SEARCH KEYWORDS</strong><br/>
        <span style="font-size: 13px; color: #333;">${product.keywords ? product.keywords.join(' • ') : 'N/A'}</span>
      </div>
      ${product.comparisonUrls.map((site, index) => `
        <div class="comparison-item-card" style="
          background: white;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 8px;
          border: 1px solid #e0e0e0;
          transition: box-shadow 0.2s ease;
        ">
          <span style="font-size: 14px; font-weight: 500;">
            ${site.icon || '🛍️'} ${site.site}
          </span>
          <a href="${site.url}" target="_blank" class="comparison-link" style="
            background: #007cba;
            color: white;
            padding: 6px 12px;
            border-radius: 5px;
            text-decoration: none;
            font-size: 12px;
            font-weight: 500;
            transition: background 0.2s ease;
          ">
            Search →
          </a>
        </div>
      `).join('')}
      <div style="background: #fff3cd; padding: 10px; border-radius: 5px; margin-top: 12px; border-left: 3px solid #ffc107;">
        <span style="font-size: 12px; color: #856404;">
          💡 <strong>Tip:</strong> Open these links in new tabs to manually compare prices and find the best deal!
        </span>
      </div>
    </div>
  `;
}

// Generate smart buying recommendation
function generateRecommendation(product) {
  let recommendation = '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; border-radius: 8px; margin-bottom: 15px;">';
  recommendation += '<h4 style="margin: 0 0 8px 0; color: white;">🎯 Smart Recommendation</h4>';

  const signals = [];
  let score = 0;
  let maxScore = 0;

  // Check if this is an official brand website first (highest priority)
  const isOfficialSite = product.badges && product.badges.includes('Official Brand Website');
  
  if (isOfficialSite) {
    // Official websites get maximum trust automatically
    maxScore += 40;
    score += 40;
    signals.push(`🏢 Official Brand Website - Maximum authenticity guaranteed!`);
    
    // Stock signal for official sites
    maxScore += 15;
    if (product.availability === 'InStock') {
      signals.push('✅ In stock');
      score += 15;
    } else if (product.availability === 'OutOfStock') {
      signals.push('❌ Out of stock');
      score += 0;
    }
    
    // Seller signal
    if (product.seller) {
      maxScore += 20;
      signals.push(`✅ Direct from: ${product.seller}`);
      score += 20;
    }
    
    // Reviews if available (bonus, not required)
    if (product.rating) {
      maxScore += 15;
      const stars = '⭐'.repeat(Math.round(product.rating));
      signals.push(`${stars} ${product.rating}/5 rating`);
      score += 15;
    }
    
    if (product.reviewCount) {
      maxScore += 10;
      signals.push(`📊 ${product.reviewCount.toLocaleString()} reviews`);
      score += 10;
    }
  } else {
    // For marketplace sites, use detailed scoring
    
    // Rating signal
    if (product.rating) {
      maxScore += 25;
      if (product.rating >= 4.5) {
        signals.push('⭐ Excellent ratings');
        score += 25;
      } else if (product.rating >= 4.0) {
        signals.push('⭐ Good ratings');
        score += 20;
      } else if (product.rating >= 3.5) {
        signals.push('⚠️ Average ratings');
        score += 10;
      } else {
        signals.push('❌ Low ratings - be cautious');
        score += 0;
      }
    }

    // Review count signal
    if (product.reviewCount) {
      maxScore += 20;
      if (product.reviewCount >= 1000) {
        signals.push(`✅ ${product.reviewCount.toLocaleString()}+ reviews (highly trusted)`);
        score += 20;
      } else if (product.reviewCount >= 100) {
        signals.push(`✅ ${product.reviewCount} reviews (trusted)`);
        score += 15;
      } else {
        signals.push(`⚠️ Only ${product.reviewCount} reviews`);
        score += 5;
      }
    }

    // Stock signal
    maxScore += 15;
    if (product.availability === 'InStock') {
      signals.push('✅ In stock');
      score += 15;
    } else if (product.availability === 'OutOfStock') {
      signals.push('❌ Out of stock');
      score += 0;
    }

    // Badges signal
    if (product.badges && product.badges.length) {
      maxScore += 20;
      signals.push(`🏆 ${product.badges.join(', ')}`);
      score += 20;
    }

    // Seller signal
    if (product.seller) {
      maxScore += 20;
      const trustedSellers = ['Amazon', 'Flipkart', 'Myntra', 'Cloudtail', 'Appario'];
      if (trustedSellers.some(s => product.seller.includes(s))) {
        signals.push(`✅ Trusted seller: ${product.seller}`);
        score += 20;
      } else {
        signals.push(`👤 Seller: ${product.seller}`);
        score += 10;
      }
    }
  }

  // Calculate confidence
  const confidence = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  // Generate verdict
  let verdict = '';
  let verdictColor = '';
  if (confidence >= 80) {
    verdict = '🎉 Highly Recommended - Great deal with strong trust signals!';
    verdictColor = '#4caf50';
  } else if (confidence >= 60) {
    verdict = '👍 Recommended - Good product with decent trust signals';
    verdictColor = '#8bc34a';
  } else if (confidence >= 40) {
    verdict = '⚠️ Consider Carefully - Mixed signals, do more research';
    verdictColor = '#ff9800';
  } else {
    verdict = '❌ Not Recommended - Weak trust signals, proceed with caution';
    verdictColor = '#f44336';
  }

  recommendation += `<div style="background: rgba(255,255,255,0.2); padding: 8px; border-radius: 5px; margin-bottom: 8px;">`;
  recommendation += `<strong style="font-size: 14px;">${verdict}</strong><br/>`;
  recommendation += `<div style="background: rgba(0,0,0,0.2); height: 8px; border-radius: 4px; margin-top: 5px; overflow: hidden;">`;
  recommendation += `<div style="background: ${verdictColor}; height: 100%; width: ${confidence}%; transition: width 0.3s;"></div>`;
  recommendation += `</div>`;
  recommendation += `<small>Confidence: ${confidence}%</small>`;
  recommendation += `</div>`;

  if (signals.length) {
    recommendation += '<div style="font-size: 12px; line-height: 1.6;">';
    signals.forEach(signal => {
      recommendation += `• ${signal}<br/>`;
    });
    recommendation += '</div>';
  }

  recommendation += '</div>';
  return recommendation;
}

// Helper function to generate product ID (same as background.js)
function generateProductId(url, title) {
  if (url.includes('amazon')) {
    const match = url.match(/\/dp\/([A-Z0-9]{10})/);
    if (match) return `amazon_${match[1]}`;
  }
  if (url.includes('flipkart')) {
    const match = url.match(/\/p\/([a-zA-Z0-9]+)/);
    if (match) return `flipkart_${match[1]}`;
  }

  const domain = new URL(url).hostname.replace('www.', '');
  const titleHash = title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
  return `${domain}_${titleHash}`;
}

// Save to chrome storage
function saveProduct(product) {
  chrome.storage.local.get({ saved: [] }, (data) => {
    const updated = [...data.saved, product];
    chrome.storage.local.set({ saved: updated }, () => {
      loadSaved();
    });
  });
}

// Delete an item by index
function deleteProduct(index) {
  chrome.storage.local.get({ saved: [] }, (data) => {
    const updated = data.saved.filter((_, i) => i !== index);
    chrome.storage.local.set({ saved: updated }, () => {
      loadSaved();
    });
  });
}

// Load saved items when popup opens
function loadSaved() {
  chrome.storage.local.get({ saved: [], priceTargets: {} }, (data) => {
    const savedDiv = document.getElementById("savedItems");
    const countBadge = document.getElementById("savedItemsCount");
    savedDiv.innerHTML = "";

    // Update count badge
    if (countBadge) {
      countBadge.textContent = data.saved.length;
      countBadge.style.animation = 'pulse 0.3s ease';
    }

    if (data.saved.length === 0) {
      savedDiv.innerHTML = `
        <div style="
          text-align: center;
          padding: 30px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 10px;
          color: white;
          margin-top: 10px;
        ">
          <div style="font-size: 48px; margin-bottom: 10px;">📦</div>
          <h3 style="margin: 0 0 8px 0; color: white;">No Saved Products Yet</h3>
          <p style="margin: 0; font-size: 13px; opacity: 0.9;">
            Scan and save products to track their prices automatically!
          </p>
        </div>
      `;
      return;
    }

    data.saved.forEach((p, i) => {
      const stockClass = p.availability === 'InStock' ? 'stock-in' :
        p.availability === 'OutOfStock' ? 'stock-out' : 'stock-unknown';

      // Generate product ID for history lookup
      const productId = generateProductIdFromUrl(p.url, p.title);
      const targetPrice = data.priceTargets[productId] || null;
      const currentPrice = p.priceValue || 0;

      const div = document.createElement("div");
      div.className = "product";
      
      let targetSection = '';
      if (targetPrice && currentPrice) {
        const diff = currentPrice - targetPrice;
        const percentAway = ((diff / currentPrice) * 100).toFixed(1);
        const progress = Math.max(0, Math.min(100, 100 - percentAway));
        
        if (currentPrice <= targetPrice) {
          targetSection = `
            <div style="background: #d4edda; padding: 5px; border-radius: 3px; margin: 5px 0; font-size: 12px;">
              🎯 <strong>Target reached!</strong> ₹${targetPrice.toLocaleString()}
            </div>
          `;
        } else {
          targetSection = `
            <div style="margin: 5px 0; font-size: 12px;">
              🎯 Target: ₹${targetPrice.toLocaleString()} 
              <span style="color: #dc3545;">(₹${diff.toLocaleString()} away)</span>
              <div style="background: #eee; height: 6px; border-radius: 3px; margin-top: 3px; overflow: hidden;">
                <div style="background: #28a745; height: 100%; width: ${progress}%;"></div>
              </div>
            </div>
          `;
        }
      }

      div.innerHTML = `
        <strong>${p.title}</strong><br/>
        💰 ${p.price} | 📦 <span class="stock-indicator ${stockClass}"></span>${p.availability}<br/>
        ${targetSection}
        <div style="margin: 5px 0;">
          <input type="number" class="targetPriceInput" data-product-id="${productId}" 
                 placeholder="Set target price" value="${targetPrice || ''}" 
                 style="width: 120px; padding: 3px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
          <button class="setTargetBtn" data-product-id="${productId}" 
                  style="padding: 3px 8px; font-size: 12px; background: #ffc107; color: #000;">
            ${targetPrice ? '✏️ Update' : '🎯 Set Target'}
          </button>
          ${targetPrice ? `<button class="clearTargetBtn" data-product-id="${productId}" 
                  style="padding: 3px 8px; font-size: 12px; background: #6c757d;">❌</button>` : ''}
        </div>
        <a href="${p.url}" target="_blank">Open</a><br/>
        <button class="viewHistoryBtn" data-product-id="${productId}">📊 View History</button>
        <button class="deleteBtn" data-index="${i}">❌ Delete</button>
      `;
      savedDiv.appendChild(div);
    });

    // Attach set target button events
    document.querySelectorAll(".setTargetBtn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const productId = e.target.dataset.productId;
        const input = document.querySelector(`.targetPriceInput[data-product-id="${productId}"]`);
        const targetPrice = parseFloat(input.value);
        
        if (targetPrice && targetPrice > 0) {
          setTargetPrice(productId, targetPrice);
        } else {
          alert('Please enter a valid target price');
        }
      });
    });

    // Attach clear target button events
    document.querySelectorAll(".clearTargetBtn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const productId = e.target.dataset.productId;
        clearTargetPrice(productId);
      });
    });

    // Attach view history button events
    document.querySelectorAll(".viewHistoryBtn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const productId = e.target.dataset.productId;
        loadPriceHistory(productId);
      });
    });

    // Attach delete button events
    document.querySelectorAll(".deleteBtn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(e.target.dataset.index);
        deleteProduct(index);
      });
    });
  });
}

// Helper function to generate product ID from URL and title
function generateProductIdFromUrl(url, title) {
  if (url.includes("amazon")) {
    const match = url.match(/\/dp\/([A-Z0-9]{10})/);
    if (match) return `amazon_${match[1]}`;
  }
  if (url.includes("flipkart")) {
    const match = url.match(/\/p\/([a-zA-Z0-9]+)/);
    if (match) return `flipkart_${match[1]}`;
  }

  const domain = new URL(url).hostname.replace("www.", "");
  const titleHash = title.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 20);
  return `${domain}_${titleHash}`;
}

// ==================== SETTINGS FUNCTIONALITY ====================

function setupSettings() {
  // Load current settings
  chrome.storage.local.get(['picksySettings'], (result) => {
    const settings = result.picksySettings || {
      autoScanEnabled: true,
      priceAlerts: true,
      stockAlerts: true
    };

    // Set checkbox states
    document.getElementById('autoScanToggle').checked = settings.autoScanEnabled !== false;
    document.getElementById('priceAlertsToggle').checked = settings.priceAlerts !== false;
    document.getElementById('stockAlertsToggle').checked = settings.stockAlerts !== false;
  });

  // Auto-scan toggle
  document.getElementById('autoScanToggle').addEventListener('change', (e) => {
    chrome.storage.local.get(['picksySettings'], (result) => {
      const settings = result.picksySettings || {};
      settings.autoScanEnabled = e.target.checked;
      chrome.storage.local.set({ picksySettings: settings }, () => {
        console.log('Auto-scan:', e.target.checked ? 'enabled' : 'disabled');
        showToast(e.target.checked ? '✅ Auto-scan enabled' : '⏸️ Auto-scan paused');
      });
    });
  });

  // Price alerts toggle
  document.getElementById('priceAlertsToggle').addEventListener('change', (e) => {
    chrome.storage.local.get(['picksySettings'], (result) => {
      const settings = result.picksySettings || {};
      settings.priceAlerts = e.target.checked;
      chrome.storage.local.set({ picksySettings: settings }, () => {
        console.log('Price alerts:', e.target.checked ? 'enabled' : 'disabled');
        showToast(e.target.checked ? '🔔 Price alerts enabled' : '🔕 Price alerts disabled');
      });
    });
  });

  // Stock alerts toggle
  document.getElementById('stockAlertsToggle').addEventListener('change', (e) => {
    chrome.storage.local.get(['picksySettings'], (result) => {
      const settings = result.picksySettings || {};
      settings.stockAlerts = e.target.checked;
      chrome.storage.local.set({ picksySettings: settings }, () => {
        console.log('Stock alerts:', e.target.checked ? 'enabled' : 'disabled');
        showToast(e.target.checked ? '📦 Stock alerts enabled' : '📭 Stock alerts disabled');
      });
    });
  });

  // Test background scan button
  document.getElementById('testBackgroundBtn').addEventListener('click', testBackgroundScan);
}

// Manual trigger for background scan (for testing)
function testBackgroundScan() {
  const btn = document.getElementById('testBackgroundBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Scanning...';

  chrome.runtime.sendMessage({ type: "PICKSY_MANUAL_BACKGROUND_SCAN" }, (response) => {
    btn.disabled = false;
    btn.textContent = '🧪 Test Background Scan Now';

    if (response && response.ok) {
      console.log(`🧪 Background scan started for ${response.count} products`);
      showToast(`✅ Scanning ${response.count} products...`);
      
      // Update last scan time
      setTimeout(() => {
        updateScanInfo();
      }, 2000);
    } else {
      console.log("🧪 No saved products to scan");
      showToast('⚠️ No saved products to scan');
    }
  });
}

// Update scan information
function updateScanInfo() {
  // Update saved products count
  chrome.storage.local.get(['saved'], (result) => {
    const savedCount = (result.saved || []).length;
    const countElement = document.getElementById('savedCount');
    if (countElement) {
      countElement.textContent = savedCount;
    }
  });

  // Get last scan time from storage
  chrome.storage.local.get(['lastBackgroundScan'], (result) => {
    const lastScanElement = document.getElementById('lastScanTime');
    if (lastScanElement) {
      if (result.lastBackgroundScan) {
        const lastScan = new Date(result.lastBackgroundScan);
        lastScanElement.textContent = formatTimeAgo(lastScan);
      } else {
        lastScanElement.textContent = 'Never';
      }
    }
  });

  // Calculate next scan time (6 hours from last scan)
  chrome.alarms.get('picksyAutoCheck', (alarm) => {
    const nextScanElement = document.getElementById('nextScanTime');
    if (nextScanElement && alarm) {
      const nextScan = new Date(alarm.scheduledTime);
      const now = new Date();
      const diff = nextScan - now;
      
      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        nextScanElement.textContent = `${hours}h ${minutes}m`;
      } else {
        nextScanElement.textContent = 'Soon';
      }
    }
  });
}

// Format time ago helper
function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// Toast notification helper
function showToast(message) {
  // Create toast element
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    font-size: 14px;
    z-index: 10000;
    animation: slideUp 0.3s ease;
  `;

  document.body.appendChild(toast);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideDown 0.3s ease';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// ------------- TEST NOTIFICATION FUNCTIONS -------------
// Run these in the console to test notifications:
// testPriceDropNotification()
// testStockNotification()
// testRealPriceDrop() - Uses your actual saved products

window.testPriceDropNotification = function() {
  console.log("🧪 Testing price drop notification...");
  
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("assets/logo.png"),
    title: "🎉 Picksy Price Drop Alert!",
    message: "Test iPhone 15 Pro dropped by ₹10,000 (8.2%)",
    buttons: [
      { title: "View Product" },
      { title: "Dismiss" }
    ],
    requireInteraction: true
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error("❌ Notification error:", chrome.runtime.lastError.message);
    } else {
      console.log("✅ Notification created successfully:", notificationId);
    }
  });
};

window.testStockNotification = function() {
  console.log("🧪 Testing stock notification...");
  
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("assets/logo.png"),
    title: "📦 Product Back in Stock!",
    message: "Test iPhone 15 Pro is now available",
    buttons: [
      { title: "View Product" },
      { title: "Dismiss" }
    ],
    requireInteraction: true
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error("❌ Notification error:", chrome.runtime.lastError.message);
    } else {
      console.log("✅ Notification created successfully:", notificationId);
    }
  });
};

window.testRealPriceDrop = function() {
  console.log("🧪 Testing with real product data...");
  
  chrome.storage.local.get(null, (items) => {
    const historyKeys = Object.keys(items).filter(k => k.startsWith('history_'));
    
    if (historyKeys.length === 0) {
      console.error("❌ No products with history found. Save a product first!");
      return;
    }
    
    const firstProduct = items[historyKeys[0]];
    console.log("Testing with:", firstProduct.title);
    
    // Get the last price
    const lastPrice = firstProduct.history[firstProduct.history.length - 1].price;
    console.log("Last price:", lastPrice);
    
    // Create a lower price to trigger notification
    const lowerPrice = Math.round(lastPrice * 0.9); // 10% discount
    console.log("New lower price:", lowerPrice);
    
    // Send message to background script to trigger the notification
    chrome.runtime.sendMessage({
      type: "PICKSY_TEST_NOTIFICATION",
      payload: {
        title: firstProduct.title,
        priceValue: lowerPrice,
        url: firstProduct.url,
        currency: "INR",
        availability: "InStock",
        source: firstProduct.source
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Error:", chrome.runtime.lastError.message);
      } else {
        console.log("✅ Test notification triggered!");
      }
    });
  });
};


// ------------- PRICE TARGET MANAGEMENT -------------
function setTargetPrice(productId, targetPrice) {
  chrome.storage.local.get(['priceTargets'], (result) => {
    const priceTargets = result.priceTargets || {};
    priceTargets[productId] = targetPrice;
    
    chrome.storage.local.set({ priceTargets }, () => {
      console.log(`🎯 Target price set: ${productId} -> ₹${targetPrice}`);
      showToast(`✅ Target price set to ₹${targetPrice.toLocaleString()}`);
      loadSaved(); // Refresh the display
    });
  });
}

function clearTargetPrice(productId) {
  chrome.storage.local.get(['priceTargets'], (result) => {
    const priceTargets = result.priceTargets || {};
    delete priceTargets[productId];
    
    chrome.storage.local.set({ priceTargets }, () => {
      console.log(`🎯 Target price cleared: ${productId}`);
      showToast('✅ Target price cleared');
      loadSaved(); // Refresh the display
    });
  });
}


// ==================== ERROR HANDLING & USER FEEDBACK ====================

// Check if service worker is responsive
function checkServiceWorkerHealth() {
  chrome.runtime.sendMessage({ type: "PICKSY_HEALTH_CHECK" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("⚠️ Service worker not responsive:", chrome.runtime.lastError.message);
      showServiceWorkerWarning();
    } else {
      console.log("✅ Service worker is healthy");
    }
  });
}

// Show service worker warning banner
function showServiceWorkerWarning() {
  const warningBanner = document.createElement('div');
  warningBanner.id = 'serviceWorkerWarning';
  warningBanner.style.cssText = `
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    color: white;
    padding: 12px;
    text-align: center;
    font-size: 13px;
    border-radius: 5px;
    margin-bottom: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  `;
  warningBanner.innerHTML = `
    <strong>⚠️ Extension Service Inactive</strong><br/>
    <small>Background features may not work properly</small><br/>
    <button id="reloadExtensionBtn" style="
      margin-top: 8px;
      padding: 6px 12px;
      background: white;
      color: #ff6b6b;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      font-size: 12px;
    ">🔄 Reload Extension</button>
  `;
  
  // Insert at the top of the popup
  const container = document.querySelector('.container');
  container.insertBefore(warningBanner, container.firstChild);
  
  // Add reload button handler
  document.getElementById('reloadExtensionBtn').addEventListener('click', () => {
    chrome.runtime.reload();
  });
}

// Show service worker error in result div
function showServiceWorkerError(resultDiv) {
  resultDiv.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    ">
      <h3 style="margin: 0 0 10px 0; color: white;">⚠️ Connection Error</h3>
      <p style="margin: 0 0 15px 0; font-size: 14px;">
        Could not connect to the extension's background service.<br/>
        This usually happens when the service worker becomes inactive.
      </p>
      <button id="reloadExtensionBtn2" style="
        padding: 10px 20px;
        background: white;
        color: #ff6b6b;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
      ">🔄 Reload Extension</button>
      <p style="margin: 15px 0 0 0; font-size: 12px; opacity: 0.9;">
        Or manually reload at: <code style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 3px;">chrome://extensions</code>
      </p>
    </div>
  `;
  
  document.getElementById('reloadExtensionBtn2')?.addEventListener('click', () => {
    chrome.runtime.reload();
  });
}

// Show "no product detected" message with helpful tips
function showNoProductDetected() {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    ">
      <h3 style="margin: 0 0 10px 0;">🔍 No Product Detected</h3>
      <p style="margin: 0 0 15px 0; font-size: 14px;">
        We couldn't find a product on this page.
      </p>
      <div style="
        background: rgba(255,255,255,0.5);
        padding: 12px;
        border-radius: 5px;
        text-align: left;
        font-size: 13px;
      ">
        <strong>💡 Tips:</strong><br/>
        • Make sure you're on a product page (not search results)<br/>
        • Supported sites: Amazon, Flipkart, Myntra, Nike, Adidas, Puma<br/>
        • Try refreshing the page and scanning again<br/>
        • Some sites may not be fully supported yet
      </div>
      <button id="tryScanAgain" style="
        margin-top: 15px;
        padding: 10px 20px;
        background: #6c5ce7;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
      ">🔄 Try Again</button>
    </div>
  `;
  
  document.getElementById('tryScanAgain')?.addEventListener('click', () => {
    document.getElementById('scanBtn').click();
  });
}

// Enhanced toast with different types
function showToast(message, type = 'info') {
  const colors = {
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#333'
  };
  
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${colors[type] || colors.info};
    color: ${type === 'warning' ? '#000' : 'white'};
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideUp 0.3s ease;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideDown 0.3s ease';
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// ==================== PRICE COMPARISON FUNCTIONALITY ====================

// Price Comparison Functionality
// Note: currentProduct is already declared at the top of the file

// SIMPLIFIED start price comparison
async function startPriceComparison() {
  console.log('🚀 SIMPLE: Starting price comparison...');
  
  try {
    // Show progress
    const progressElement = document.getElementById('comparisonProgress');
    if (progressElement) {
      progressElement.style.display = 'block';
    }
    
    // Create mock product if none exists
    if (!currentProduct) {
      currentProduct = {
        title: 'Sample Product for Testing',
        price: '₹10,000',
        priceValue: 10000,
        source: 'test.com'
      };
    }
    
    console.log('🚀 SIMPLE: Using product:', currentProduct.title);
    
    // Load price comparison engine
    await loadPriceComparisonEngine();
    
    // Get comparison results
    console.log('🚀 SIMPLE: Getting comparison results...');
    const results = await PriceComparison.compareProductPrices(currentProduct, {
      maxSites: 8,
      minTrustScore: 5
    });
    
    console.log('🚀 SIMPLE: Got results:', results);
    
    // Display results after a short delay
    setTimeout(() => {
      displayComparisonResults(results);
      showToast(`Found ${results.matches?.length || 0} matches`, 'success');
    }, 500);
    
  } catch (error) {
    console.error('❌ SIMPLE: Comparison failed:', error);
    showToast('Comparison failed: ' + error.message, 'error');
  }
}

// Get current product data
async function getCurrentProductData() {
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
}

// Load price comparison engine
async function loadPriceComparisonEngine() {
  if (typeof PriceComparison === 'undefined') {
    console.error('❌ PriceComparison script not loaded');
    console.log('Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('price')));
    
    // Try to load the script dynamically
    try {
      console.log('🔄 Attempting to load PriceComparison script...');
      const script = document.createElement('script');
      script.src = '../../utils/priceComparison.js';
      document.head.appendChild(script);
      
      // Wait for script to load
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        setTimeout(reject, 5000); // 5 second timeout
      });
      
      if (typeof PriceComparison === 'undefined') {
        throw new Error('PriceComparison still not available after loading script');
      }
      
      console.log('✅ PriceComparison script loaded dynamically');
    } catch (error) {
      console.error('❌ Failed to load PriceComparison script:', error);
      throw new Error('PriceComparison script not available - please reload the extension');
    }
  } else {
    console.log('✅ PriceComparison script already loaded');
    console.log('Available methods:', Object.keys(PriceComparison));
  }
}

// Show comparison progress
function showComparisonProgress() {
  document.getElementById('comparisonResults').style.display = 'none';
  document.getElementById('comparisonProgress').style.display = 'block';
  document.getElementById('comparisonResultsContainer').style.display = 'none';
  
  // Animate progress bar
  let progress = 0;
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  
  const progressSteps = [
    'Extracting product details...',
    'Generating search URLs...',
    'Creating mock results...',
    'Matching products...',
    'Analyzing prices...',
    'Calculating savings...',
    'Ranking results...',
    'Finalizing comparison...',
    'Complete!'
  ];
  
  let stepIndex = 0;
  const interval = setInterval(() => {
    progress += 10;
    progressBar.style.width = `${Math.min(progress, 100)}%`;
    
    if (stepIndex < progressSteps.length) {
      progressText.textContent = progressSteps[stepIndex];
      stepIndex++;
    }
    
    if (progress >= 100) {
      clearInterval(interval);
    }
  }, 1000);
}

// Display comparison results - SIMPLIFIED VERSION
function displayComparisonResults(results) {
  console.log('📊 SIMPLE: Displaying comparison results:', results);
  
  // Validate results
  if (!results || !results.matches || !Array.isArray(results.matches)) {
    console.error('❌ SIMPLE: Invalid results structure');
    return;
  }
  
  console.log('📊 SIMPLE: Found', results.matches.length, 'matches');
  
  // Get DOM elements (they should exist in HTML)
  const progressElement = document.getElementById('comparisonProgress');
  const resultsContainer = document.getElementById('comparisonResultsContainer');
  const allResults = document.getElementById('allResults');
  
  console.log('📊 SIMPLE: DOM check:', {
    progress: !!progressElement,
    container: !!resultsContainer,
    allResults: !!allResults
  });
  
  if (!progressElement || !resultsContainer || !allResults) {
    console.error('❌ SIMPLE: Missing DOM elements');
    return;
  }
  
  // Hide progress, show results
  progressElement.style.display = 'none';
  resultsContainer.style.display = 'block';
  
  // Create results table with search links
  console.log('📊 SIMPLE: Creating results table...');
  
  const tableHTML = `
    <div style="background: white; border: 2px solid #007cba; border-radius: 8px; margin: 10px 0;">
      <div style="background: #007cba; color: white; padding: 10px; text-align: center;">
        <h3 style="margin: 0;">🛍️ Compare Prices on ${results.matches.length} Sites</h3>
        <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">Click "Search & Buy" to find the best deals</p>
      </div>
      <div style="padding: 15px;">
        ${results.matches.map((match, index) => {
          const isSearchLink = match.isSearchLink || false;
          const priceDisplay = match.priceValue > 0 ? `₹${match.priceValue.toLocaleString()}` : 'Check Price';
          const statusText = isSearchLink ? 'Search Required' : (match.availability || 'Unknown');
          
          return `
            <div style="
              border: 1px solid #ddd; 
              border-radius: 8px; 
              padding: 15px; 
              margin: 10px 0;
              background: ${index % 2 === 0 ? '#f9f9f9' : 'white'};
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <div style="flex: 1;">
                  <div style="font-weight: bold; color: #333; margin-bottom: 5px; font-size: 16px;">
                    ${match.siteName || 'Unknown Site'}
                  </div>
                  <div style="color: #666; font-size: 12px; margin-bottom: 8px;">
                    ${statusText} • Trust Score: ${match.trustScore || 0}/10
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 18px; font-weight: bold; color: #007cba; margin-bottom: 5px;">
                    ${priceDisplay}
                  </div>
                  <div style="
                    background: ${match.trustScore >= 8 ? '#28a745' : match.trustScore >= 6 ? '#ffc107' : '#dc3545'}; 
                    color: white; 
                    padding: 3px 8px; 
                    border-radius: 12px; 
                    font-size: 10px;
                    font-weight: bold;
                  ">
                    Trust: ${match.trustScore || 0}/10
                  </div>
                </div>
              </div>
              <button class="search-buy-btn" data-url="${match.url}" data-site="${match.siteName}" style="
                background: linear-gradient(135deg, #007cba, #0056b3);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 25px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                width: 100%;
                transition: all 0.3s ease;
              ">
                🛒 Search & Buy on ${match.siteName}
              </button>
            </div>
          `;
        }).join('')}
      </div>
      <div style="background: #f8f9fa; padding: 15px; border-top: 1px solid #ddd;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <p style="margin: 0; font-size: 12px; color: #666;">
            💡 <strong>Tip:</strong> Results are cached for 24 hours to save API credits
          </p>
          <button class="refresh-comparison-btn" style="
            background: #6c757d;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 15px;
            cursor: pointer;
            font-size: 11px;
          ">
            🔄 Refresh
          </button>
        </div>
        <p style="margin: 0; font-size: 11px; color: #999; text-align: center;">
          Click "Search & Buy" to go directly to product search on each site
        </p>
      </div>
    </div>
  `;
  
  allResults.innerHTML = tableHTML;
  console.log('✅ SIMPLE: Results table created!');
  
  // Add event listeners for search & buy buttons and refresh
  setTimeout(() => {
    const searchBuyButtons = document.querySelectorAll('.search-buy-btn');
    const refreshButtons = document.querySelectorAll('.refresh-comparison-btn');
    
    console.log('📊 Adding event listeners for', searchBuyButtons.length, 'search buttons and', refreshButtons.length, 'refresh buttons');
    
    searchBuyButtons.forEach(button => {
      button.addEventListener('click', () => {
        const url = button.dataset.url;
        const site = button.dataset.site;
        console.log(`🛒 Opening search on ${site}:`, url);
        window.open(url, '_blank');
      });
    });
    
    refreshButtons.forEach(button => {
      button.addEventListener('click', async () => {
        console.log('🔄 Refreshing comparison results...');
        button.textContent = '⏳ Refreshing...';
        button.disabled = true;
        
        try {
          // Clear cache and get fresh results
          if (typeof PriceComparison !== 'undefined' && currentProduct) {
            await PriceComparison.clearCache(currentProduct);
            const freshResults = await PriceComparison.compareProductPrices(currentProduct, {
              useCache: false
            });
            displayComparisonResults(freshResults);
            showToast('✅ Results refreshed', 'success');
          }
        } catch (error) {
          console.error('Failed to refresh:', error);
          showToast('❌ Refresh failed', 'error');
        } finally {
          button.textContent = '🔄 Refresh';
          button.disabled = false;
        }
      });
    });
  }, 100);
  
  // Update count
  const resultsCount = document.getElementById('resultsCount');
  if (resultsCount) {
    resultsCount.textContent = results.matches.length;
  }
}

// Display best deal card
function displayBestDeal(bestDeal, savings, savingsPercent) {
  console.log('🏆 Displaying best deal:', bestDeal);
  
  const bestDealContent = document.getElementById('bestDealContent');
  if (!bestDealContent) {
    console.error('❌ bestDealContent element not found');
    return;
  }
  
  if (!bestDeal) {
    console.warn('⚠️ No best deal data provided');
    bestDealContent.innerHTML = '<p style="color: rgba(255,255,255,0.8);">No best deal available</p>';
    return;
  }
  
  // Ensure bestDeal has required properties with defaults
  const priceValue = bestDeal.priceValue || 0;
  const siteName = bestDeal.siteName || 'Unknown Site';
  const trustScore = bestDeal.trustScore || 0;
  const url = bestDeal.url || '#';
  const savingsAmount = savings || 0;
  const savingsPercentage = savingsPercent || 0;
  
  bestDealContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div>
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">
          ₹${priceValue.toLocaleString()}
        </div>
        <div style="font-size: 14px; opacity: 0.9;">
          ${siteName} • Trust: ${trustScore}/10
        </div>
      </div>
      <div style="text-align: right;">
        ${savingsAmount > 0 ? `
          <div style="font-size: 16px; font-weight: bold; color: #ffeb3b;">
            Save ₹${savingsAmount.toLocaleString()}
          </div>
          <div style="font-size: 12px; opacity: 0.8;">
            ${savingsPercentage.toFixed(1)}% off
          </div>
        ` : `
          <div style="font-size: 14px; opacity: 0.9;">
            Best available price
          </div>
        `}
      </div>
    </div>
    <button class="deal-button" data-url="${url}" style="
      background: rgba(255,255,255,0.2);
      border: 2px solid rgba(255,255,255,0.3);
      color: white;
      padding: 10px 20px;
      border-radius: 20px;
      width: 100%;
      cursor: pointer;
      font-weight: bold;
    ">
      🛒 View Deal
    </button>
  `;
  
  console.log('✅ Best deal displayed');
}

// Display all results
function displayAllResults(matches) {
  console.log('📊 displayAllResults called with:', matches?.length || 0, 'matches');
  console.log('📊 Sample match data:', matches?.[0]);
  
  const allResults = document.getElementById('allResults');
  if (!allResults) {
    console.error('❌ allResults element not found');
    console.log('📊 Available elements:', Object.keys(document.querySelectorAll('[id]')).map(i => document.querySelectorAll('[id]')[i].id));
    return;
  }
  
  console.log('✅ allResults element found');
  
  if (!matches || matches.length === 0) {
    console.log('⚠️ No matches to display');
    allResults.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #666; background: white; border-radius: 8px;">
        <h4>No matching products found</h4>
        <p>Try scanning a different product or check back later.</p>
      </div>
    `;
    return;
  }
  
  console.log('📊 Creating results table with', matches.length, 'matches');
  
  try {
    // Create table format for better comparison
    const tableHTML = `
      <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 10px 0;">
        <div style="background: #007cba; color: white; padding: 15px; text-align: center;">
          <h4 style="margin: 0; font-size: 16px;">🛍️ Price Comparison Results</h4>
          <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">Found ${matches.length} matches across different sites</p>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
              <th style="padding: 12px 8px; text-align: left; font-size: 12px; font-weight: bold; color: #495057;">Site</th>
              <th style="padding: 12px 8px; text-align: right; font-size: 12px; font-weight: bold; color: #495057;">Price</th>
              <th style="padding: 12px 8px; text-align: center; font-size: 12px; font-weight: bold; color: #495057;">Trust</th>
              <th style="padding: 12px 8px; text-align: center; font-size: 12px; font-weight: bold; color: #495057;">Match</th>
              <th style="padding: 12px 8px; text-align: center; font-size: 12px; font-weight: bold; color: #495057;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${matches.map((match, index) => {
              // Ensure match has required properties
              const siteName = match.siteName || 'Unknown Site';
              const title = match.title || 'No title';
              const priceValue = match.priceValue || 0;
              const trustScore = match.trustScore || 0;
              const similarity = match.similarity || 0;
              const url = match.url || '#';
              const isError = match.error || false;
              
              console.log(`📊 Processing match ${index + 1}:`, { siteName, priceValue, trustScore });
              
              return `
                <tr style="border-bottom: 1px solid #e9ecef; ${index % 2 === 0 ? 'background: #f8f9fa;' : 'background: white;'}">
                  <td style="padding: 12px 8px;">
                    <div style="font-weight: 500; color: #333; margin-bottom: 2px;">${siteName}</div>
                    <div style="font-size: 11px; color: #666; line-height: 1.3;">
                      ${title.substring(0, 40)}${title.length > 40 ? '...' : ''}
                    </div>
                  </td>
                  <td style="padding: 12px 8px; text-align: right;">
                    <span style="font-size: 14px; font-weight: bold; color: ${isError ? '#dc3545' : '#007cba'};">
                      ${isError ? 'Failed' : (priceValue > 0 ? '₹' + priceValue.toLocaleString() : 'N/A')}
                    </span>
                  </td>
                  <td style="padding: 12px 8px; text-align: center;">
                    <span style="
                      background: ${trustScore >= 8 ? '#28a745' : trustScore >= 6 ? '#ffc107' : '#dc3545'};
                      color: white;
                      padding: 3px 8px;
                      border-radius: 12px;
                      font-size: 10px;
                      font-weight: bold;
                    ">
                      ${trustScore}/10
                    </span>
                  </td>
                  <td style="padding: 12px 8px; text-align: center;">
                    <span style="
                      background: ${similarity >= 0.8 ? '#28a745' : '#ffc107'};
                      color: white;
                      padding: 3px 8px;
                      border-radius: 12px;
                      font-size: 10px;
                      font-weight: bold;
                    ">
                      ${Math.round(similarity * 100)}%
                    </span>
                  </td>
                  <td style="padding: 12px 8px; text-align: center;">
                    <button class="match-button" data-url="${url}" style="
                      background: #007cba;
                      color: white;
                      border: none;
                      padding: 6px 12px;
                      border-radius: 12px;
                      cursor: pointer;
                      font-size: 11px;
                      font-weight: 500;
                    ">
                      View
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    console.log('📊 Setting innerHTML for allResults...');
    allResults.innerHTML = tableHTML;
    console.log('✅ Results table HTML set successfully');
    
    // Verify the table was created
    const table = allResults.querySelector('table');
    if (table) {
      console.log('✅ Table element created successfully');
      console.log('📊 Table rows:', table.querySelectorAll('tbody tr').length);
    } else {
      console.error('❌ Table element not found after setting innerHTML');
    }
    
  } catch (error) {
    console.error('❌ Error creating results table:', error);
    allResults.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #dc3545; background: #f8d7da; border-radius: 8px;">
        <h4>Error displaying results</h4>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Display comparison statistics
function displayComparisonStats(analysis) {
  console.log('📊 Displaying comparison stats:', analysis);
  
  const statsContent = document.getElementById('statsContent');
  if (!statsContent) {
    console.error('❌ statsContent element not found');
    return;
  }
  
  if (!analysis) {
    console.warn('⚠️ No analysis data provided');
    statsContent.innerHTML = '<p style="color: #666;">No statistics available</p>';
    return;
  }
  
  // Ensure analysis has required properties with defaults
  const totalSites = analysis.totalSites || 0;
  const successfulMatches = analysis.successfulMatches || 0;
  const averagePrice = analysis.averagePrice || 0;
  const priceRange = analysis.priceRange || { min: 0, max: 0 };
  
  statsContent.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 12px;">
      <div>
        <strong>Sites Checked:</strong><br>
        ${totalSites} sites
      </div>
      <div>
        <strong>Successful Matches:</strong><br>
        ${successfulMatches} products
      </div>
      <div>
        <strong>Average Price:</strong><br>
        ₹${averagePrice.toLocaleString()}
      </div>
      <div>
        <strong>Price Range:</strong><br>
        ₹${priceRange.min.toLocaleString()} - ₹${priceRange.max.toLocaleString()}
      </div>
    </div>
  `;
  
  console.log('✅ Comparison stats displayed');
}

// Show comparison error
function showComparisonError(message) {
  document.getElementById('comparisonProgress').style.display = 'none';
  document.getElementById('comparisonResultsContainer').innerHTML = `
    <div style="
      background: #f8d7da;
      color: #721c24;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      margin: 15px 0;
    ">
      <div style="font-size: 24px; margin-bottom: 10px;">❌</div>
      <h4 style="margin: 0 0 10px 0;">Comparison Failed</h4>
      <p style="margin: 0; font-size: 14px;">${message}</p>
      <button id="retryComparisonBtn" style="
        background: #721c24;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 15px;
        margin-top: 15px;
        cursor: pointer;
      ">
        Try Again
      </button>
    </div>
  `;
  document.getElementById('comparisonResultsContainer').style.display = 'block';
  
  // Add event listener for retry button
  const retryBtn = document.getElementById('retryComparisonBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', startPriceComparison);
  }
}

// Setup comparison tab functionality
function setupComparisonTab() {
  console.log('🔧 Setting up comparison tab...');
  
  const startComparisonBtn = document.getElementById('startComparisonBtn');
  if (startComparisonBtn) {
    // Remove any existing listeners to prevent duplicates
    startComparisonBtn.replaceWith(startComparisonBtn.cloneNode(true));
    const newBtn = document.getElementById('startComparisonBtn');
    
    newBtn.addEventListener('click', () => {
      console.log('🚀 Comparison button clicked!');
      startPriceComparison();
    });
    
    console.log('✅ Comparison button event listener attached');
  } else {
    console.warn('⚠️ Start comparison button not found');
  }
}

// Update comparison tab when product is scanned
function updateComparisonTabForProduct(product) {
  console.log('🔄 Updating comparison tab for product:', product.title);
  
  const comparisonResults = document.getElementById('comparisonResults');
  if (!comparisonResults) {
    console.warn('⚠️ comparisonResults element not found');
    return;
  }
  
  // Update the comparison tab to show the product is ready
  comparisonResults.innerHTML = createComparisonInterface(product);
  
  // Re-setup the comparison button
  setupComparisonTab();
}

// Create the complete comparison interface HTML
function createComparisonInterface(product = null) {
  const productSection = product ? `
    <div style="
      text-align: center;
      padding: 40px 20px;
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
      color: white;
      border-radius: 10px;
      margin-top: 10px;
    ">
      <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
      <h3 style="margin: 0 0 8px 0; color: white;">Product Ready for Comparison</h3>
      <p style="margin: 0 0 15px 0; font-size: 13px; color: rgba(255,255,255,0.9);">
        <strong>${product.title.substring(0, 60)}${product.title.length > 60 ? '...' : ''}</strong><br/>
        Compare prices across 12+ verified sites
      </p>
      <button id="startComparisonBtn" style="
        background: rgba(255,255,255,0.2);
        border: 2px solid rgba(255,255,255,0.3);
        color: white;
        padding: 12px 24px;
        border-radius: 25px;
        margin-top: 15px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
      ">
        🔍 Start Comparison
      </button>
    </div>
  ` : `
    <div style="
      text-align: center;
      padding: 40px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 10px;
      margin-top: 10px;
    ">
      <div style="font-size: 48px; margin-bottom: 10px;">🚀</div>
      <h3 style="margin: 0 0 8px 0; color: white;">AI-Powered Price Comparison</h3>
      <p style="margin: 0 0 15px 0; font-size: 13px; color: rgba(255,255,255,0.9);">
        Compare prices across 12+ verified sites<br/>
        Find the best deals with AI-powered matching
      </p>
      <button id="startComparisonBtn" style="
        background: rgba(255,255,255,0.2);
        border: 2px solid rgba(255,255,255,0.3);
        color: white;
        padding: 12px 24px;
        border-radius: 25px;
        margin-top: 15px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
      ">
        🔍 Start Comparison
      </button>
    </div>
  `;

  return `
    ${productSection}
    
    <!-- Comparison Progress -->
    <div id="comparisonProgress" style="display: none;">
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <h4 style="margin: 0 0 10px 0; color: #333;">🔍 Comparing Prices...</h4>
        <div style="background: #e9ecef; height: 8px; border-radius: 4px; overflow: hidden;">
          <div id="progressBar" style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
        </div>
        <p id="progressText" style="margin: 10px 0 0 0; font-size: 12px; color: #666;">Initializing...</p>
      </div>
    </div>
    
    <!-- Comparison Results -->
    <div id="comparisonResultsContainer" style="display: none;">
      <!-- Best Deal Card -->
      <div id="bestDealCard" style="
        background: linear-gradient(135deg, #28a745, #20c997);
        color: white;
        padding: 20px;
        border-radius: 10px;
        margin: 15px 0;
        box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
      ">
        <h3 style="margin: 0 0 10px 0; display: flex; align-items: center;">
          🏆 <span style="margin-left: 8px;">Best Deal Found</span>
        </h3>
        <div id="bestDealContent"></div>
      </div>
      
      <!-- All Results -->
      <div id="allResultsContainer">
        <h4 style="margin: 0 0 15px 0; color: #333; display: flex; align-items: center;">
          📊 <span style="margin-left: 8px;">All Results</span>
          <span id="resultsCount" style="
            background: #667eea;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            margin-left: 10px;
          "></span>
        </h4>
        <div id="allResults"></div>
      </div>
      
      <!-- Comparison Stats -->
      <div id="comparisonStats" style="
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        margin-top: 15px;
        border-left: 4px solid #667eea;
      ">
        <h5 style="margin: 0 0 10px 0; color: #333;">📈 Comparison Statistics</h5>
        <div id="statsContent"></div>
      </div>
    </div>
  `;
}

// Recreate comparison interface when DOM elements are missing
function recreateComparisonInterface() {
  console.log('🔧 Recreating comparison interface...');
  
  const comparisonResults = document.getElementById('comparisonResults');
  if (!comparisonResults) {
    console.error('❌ Cannot recreate interface - comparisonResults element not found');
    return;
  }
  
  // Recreate the interface with current product if available
  comparisonResults.innerHTML = createComparisonInterface(currentProduct);
  
  // Re-setup the comparison button
  setupComparisonTab();
  
  console.log('✅ Comparison interface recreated');
}

// SIMPLE test function
window.testComparisonSystem = function() {
  console.log('🧪 SIMPLE: Testing comparison system...');
  
  // Switch to comparison tab first
  document.querySelector('[data-tab="comparison"]').click();
  
  // Wait a moment for tab to switch
  setTimeout(() => {
    // Create simple mock results
    const mockResults = {
      matches: [
        {
          siteName: 'Amazon India',
          title: 'Test iPhone 15 Pro 128GB Space Black',
          priceValue: 134900,
          trustScore: 9
        },
        {
          siteName: 'Flipkart',
          title: 'iPhone 15 Pro 128GB Space Black',
          priceValue: 132900,
          trustScore: 9
        },
        {
          siteName: 'Croma',
          title: 'Apple iPhone 15 Pro 128GB',
          priceValue: 136900,
          trustScore: 8
        }
      ]
    };
    
    console.log('🧪 SIMPLE: Calling displayComparisonResults...');
    displayComparisonResults(mockResults);
  }, 100);
};

// Even simpler direct test
window.testDirect = function() {
  console.log('🧪 DIRECT: Testing direct DOM manipulation...');
  
  const allResults = document.getElementById('allResults');
  if (!allResults) {
    console.error('❌ DIRECT: allResults not found');
    return;
  }
  
  allResults.innerHTML = `
    <div style="background: red; color: white; padding: 20px; text-align: center; border-radius: 8px;">
      <h2>🧪 DIRECT TEST SUCCESSFUL!</h2>
      <p>If you can see this, the DOM manipulation works!</p>
    </div>
  `;
  
  // Show the results container
  const container = document.getElementById('comparisonResultsContainer');
  if (container) {
    container.style.display = 'block';
  }
  
  console.log('✅ DIRECT: Test complete');
};

// Console debug function
window.debugComparison = function() {
  console.log('🔍 DEBUG: Checking comparison system...');
  
  // Check DOM elements
  const elements = {
    comparisonResults: document.getElementById('comparisonResults'),
    comparisonProgress: document.getElementById('comparisonProgress'),
    comparisonResultsContainer: document.getElementById('comparisonResultsContainer'),
    allResults: document.getElementById('allResults'),
    startComparisonBtn: document.getElementById('startComparisonBtn'),
    testSystemBtn: document.getElementById('testSystemBtn'),
    testDirectBtn: document.getElementById('testDirectBtn')
  };
  
  console.log('🔍 DOM Elements:', elements);
  
  // Check if PriceComparison is loaded
  console.log('🔍 PriceComparison loaded:', typeof PriceComparison !== 'undefined');
  
  // Check current product
  console.log('🔍 Current product:', currentProduct);
  
  // Test direct DOM manipulation
  const allResults = document.getElementById('allResults');
  if (allResults) {
    allResults.innerHTML = '<div style="background: green; color: white; padding: 10px; text-align: center;">✅ DEBUG TEST SUCCESSFUL</div>';
    
    const container = document.getElementById('comparisonResultsContainer');
    if (container) {
      container.style.display = 'block';
    }
    
    console.log('✅ DEBUG: Direct DOM manipulation successful');
  } else {
    console.error('❌ DEBUG: allResults element not found');
  }
};

// Make functions globally available
window.startPriceComparison = startPriceComparison;
window.displayComparisonResults = displayComparisonResults;
window.setupComparisonTab = setupComparisonTab;
window.updateComparisonTabForProduct = updateComparisonTabForProduct;
window.recreateComparisonInterface = recreateComparisonInterface;
window.createComparisonInterface = createComparisonInterface;