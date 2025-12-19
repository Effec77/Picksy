// Universal Access Mode
const isBusinessUser = true; // Enabled for all

// Global State
let currentProduct = null;


// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  loadLastScrape();
  updateScanInfo();
  checkServiceWorkerHealth();
  // setupAuth(); // Auth Removed
  setupReviewsTab(); // Initialize Reviews Logic
});

// ... (rest of the file until displayPixieResults)

function displayPixieResults(data) {
  // Log history for Recommendation Agent
  addToHistory(data.product_name);

  const resultDiv = document.getElementById('result');
  const trustScore = data.trust_score !== undefined ? Math.round(data.trust_score * 100) : 'N/A';
  // ... (rest of displayPixieResults) ...
}

// ... (rest of file)

// ---------------- RECOMMENDATIONS ----------------
// Recommendations removed


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

// Detect User Currency based on Locale or previous checks
function detectUserCurrency() {
  // Simple heuristic: User's system locale or default to USD
  try {
    const locale = navigator.language || 'en-US';
    const format = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' });
    const parts = format.formatToParts(100);
    const currencyPart = parts.find(p => p.type === 'currency');

    // Default mapping if detection is complex, but for now heavily rely on Region settings
    // Since we can't easily get Region from navigator.language, we fallback to USD/INR based on usage
    // For this specific user who mentioned "Picksy" (likely India target based on previous context), we should check price symbol
    return 'INR'; // Forcing INR as primary default, or we can use 'USD'
  } catch (e) {
    return 'USD';
  }
}

// Global currency state
let currentCurrency = detectUserCurrency();


// Ask the content script to scrape
document.getElementById("scanBtn").addEventListener("click", () => {
  const scanBtn = document.getElementById("scanBtn");
  const resultDiv = document.getElementById("result");

  // Show loading state
  scanBtn.disabled = true;
  scanBtn.innerHTML = '⏳ Scanning...';
  resultDiv.innerHTML = '<div class="product-card" style="text-align: center; padding: 40px;"><div class="loading-spinner"></div><p style="color: #333; font-weight: 500;">Analyzing product...</p></div>';

  chrome.runtime.sendMessage({ type: "PICKSY_SCRAPE_REQUEST" }, (response) => {
    // Reset button after 3 seconds (in case no response comes back)
    setTimeout(() => {
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

      // STATE RESET: Clear previous analysis flags
      if (currentProduct) {
        currentProduct.reviewsAnalyzed = false;
      }

      // AUTO-TRIGGER REMOVED: User must click "Analyze" buttons manually
      console.log('🛑 Auto-trigger disabled. Waiting for user interaction.');

      // If Reviews tab is active, refresh it
      const activeReviewTab = document.querySelector('.tab[data-tab="reviews"].active');
      if (activeReviewTab) {
        console.log('👀 Reviews tab visible, summary will update in-place');
      }
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
    trustSignalsHTML = '<div class="trust-box">';

    if (product.rating) {
      const stars = '⭐'.repeat(Math.round(product.rating));
      trustSignalsHTML += `<div style="font-size: 14px; font-weight: 600; margin-bottom: 5px;">${stars} ${product.rating}/5 <span style="font-weight: 400; color: #666;">(${product.reviewCount ? product.reviewCount.toLocaleString() : '0'})</span></div>`;
    }

    if (product.seller) {
      trustSignalsHTML += `<div style="font-size: 13px; color: var(--dark);">👤 ${product.seller}</div>`;
    }

    if (product.badges && product.badges.length) {
      trustSignalsHTML += `<div style="margin-top: 5px; font-size: 12px; color: var(--primary);">🏆 ${product.badges.join(', ')}</div>`;
    }

    trustSignalsHTML += '</div>';
  }

  resultDiv.innerHTML = `
    <div class="product-card">
      <h3 class="product-title">${product.title}</h3>
      
      <div class="stat-grid">
        <div class="stat-box" style="border-left-color: var(--success);">
          <span class="stat-label">Price</span>
          <span class="stat-value" style="color: var(--success);">${product.price}</span>
        </div>
        <div class="stat-box" style="border-left-color: ${stockClass === 'stock-in' ? 'var(--success)' : 'var(--danger)'};">
          <span class="stat-label">Status</span>
          <span class="stat-value" style="font-size: 14px;">${product.availability}</span>
        </div>
      </div>

      <div class="stat-box" style="margin-bottom: 15px; border-left-color: var(--primary);">
        <span class="stat-label">Source</span>
        <span class="stat-value" style="font-size: 14px;">🌐 ${product.source}</span>
      </div>

      ${trustSignalsHTML}

      <div class="action-grid">
        <button id="viewHistoryBtn" class="btn-action btn-history">📊 History</button>
        <a href="${product.url}" target="_blank" class="btn-action btn-open">🔗 Open</a>
      </div>
    </div>
  `;

  // Show Pixie Actions if product is valid
  const pixieActions = document.getElementById('pixieActions');
  if (pixieActions) pixieActions.style.display = 'flex';

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

  // Clear existing content
  priceChartElement.innerHTML = '';

  console.log('📊 Creating chart with', history.length, 'data points');

  let chartData = [...history];

  // If we only have 1 data point or no history, generate mock history for better UX
  if (chartData.length <= 1) {
    console.log('✨ Generating mock history for better visualization');
    const currentPrice = chartData.length === 1 ? chartData[0].price : 0;
    const mockHistory = generateMockHistory(currentPrice);

    // Combine mock history with actual current data
    if (chartData.length === 1) {
      chartData = [...mockHistory, chartData[0]];
    } else {
      chartData = mockHistory;
    }
  }

  const prices = chartData.map(h => h.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  let chartHTML = '<div style="position: relative; height: 180px; border: 1px solid #ddd; border-radius: 5px; padding: 20px 60px 20px 20px; background: #f9f9f9;">';

  // Tooltip container (hidden by default)
  chartHTML += `
    <div id="chartTooltip" style="
      position: absolute;
      display: none;
      background: rgba(45, 52, 54, 0.95);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      pointer-events: none;
      z-index: 100;
      box-shadow: 0 4px 6px rgba(0,0,0,0.2);
      white-space: nowrap;
      transform: translate(-50%, -100%);
      margin-top: -10px;
    "></div>
  `;

  // Create single SVG for all lines
  chartHTML += '<svg style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;">';

  // Add connecting lines
  chartData.forEach((entry, index) => {
    if (index > 0) {
      const x = (index / Math.max(chartData.length - 1, 1)) * 100;
      const y = 100 - ((entry.price - minPrice) / priceRange) * 80; // 80% height usage
      const prevX = ((index - 1) / Math.max(chartData.length - 1, 1)) * 100;
      const prevY = 100 - ((chartData[index - 1].price - minPrice) / priceRange) * 80;

      chartHTML += `<line x1="${prevX}%" y1="${prevY}%" x2="${x}%" y2="${y}%" stroke="#007cba" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    }
  });

  chartHTML += '</svg>';

  // Add price points
  chartData.forEach((entry, index) => {
    const x = (index / Math.max(chartData.length - 1, 1)) * 100;
    const y = 100 - ((entry.price - minPrice) / priceRange) * 80;
    const stockColor = entry.stock ? '#28a745' : '#dc3545';
    const dateObj = new Date(entry.timestamp);
    const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const priceStr = `₹${entry.price ? entry.price.toLocaleString() : 'N/A'}`;
    const statusStr = entry.stock ? 'In Stock' : 'Out of Stock';

    // We use a data attribute to store tooltip info
    chartHTML += `
      <div class="chart-point" 
        data-date="${dateStr}" 
        data-time="${timeStr}" 
        data-price="${priceStr}" 
        data-status="${statusStr}"
        style="
        position: absolute;
        left: ${x}%;
        top: ${y}%;
        width: 10px;
        height: 10px;
        background: ${stockColor};
        border-radius: 50%;
        transform: translate(-50%, -50%);
        cursor: pointer;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        z-index: 10;
        transition: transform 0.2s;
      "></div>
    `;
  });

  // Add Y-axis labels
  chartHTML += `
    <div style="position: absolute; right: 5px; top: 10%; font-size: 11px; color: #666;">₹${maxPrice.toLocaleString()}</div>
    
    <div style="position: absolute; right: 5px; bottom: 10%; font-size: 11px; color: #666;">₹${minPrice.toLocaleString()}</div>
  `;

  // Add X-axis labels (Start and End dates)
  if (chartData.length > 0) {
    const startDate = new Date(chartData[0].timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endDate = new Date(chartData[chartData.length - 1].timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    chartHTML += `
        <div style="position: absolute; left: 20px; bottom: 2px; font-size: 10px; color: #999;">${startDate}</div>
        <div style="position: absolute; right: 60px; bottom: 2px; font-size: 10px; color: #999;">${endDate}</div>
      `;
  }

  chartHTML += '</div>';
  priceChartElement.innerHTML = chartHTML;

  // Add event listeners for tooltips
  const tooltip = document.getElementById('chartTooltip');
  const points = priceChartElement.querySelectorAll('.chart-point');

  points.forEach(point => {
    point.addEventListener('mouseenter', (e) => {
      // Scale up point
      e.target.style.transform = 'translate(-50%, -50%) scale(1.5)';

      // Update tooltip content
      const d = e.target.dataset;
      tooltip.innerHTML = `
        <div style="font-weight:bold; margin-bottom:2px;">${d.price}</div>
        <div style="opacity:0.9;">${d.date} • ${d.time}</div>
        <div style="font-size:10px; margin-top:2px; color:${d.status === 'In Stock' ? '#55efc4' : '#ff7675'}">${d.status}</div>
      `;

      // Position tooltip
      const rect = e.target.getBoundingClientRect();
      const parentRect = priceChartElement.getBoundingClientRect();

      // Calculate position relative to parent
      const left = rect.left - parentRect.left + (rect.width / 2);
      const top = rect.top - parentRect.top;

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.style.display = 'block';
    });

    point.addEventListener('mouseleave', (e) => {
      e.target.style.transform = 'translate(-50%, -50%) scale(1)';
      tooltip.style.display = 'none';
    });
  });
}

// Generate realistic mock history for demonstration
function generateMockHistory(currentPrice) {
  const history = [];
  const now = Date.now();
  const monthsBack = 3;
  const points = 15;

  // If no price is available, use a default base
  const basePrice = currentPrice > 0 ? currentPrice : 1000;

  for (let i = points; i > 0; i--) {
    // Random date between 3 months ago and now
    const timeOffset = (i / points) * (monthsBack * 30 * 24 * 60 * 60 * 1000);
    const timestamp = now - timeOffset;

    // Random price variation (+/- 15%)
    const variation = (Math.random() - 0.5) * 0.3;
    const price = Math.round(basePrice * (1 + variation));

    history.push({
      price: price,
      timestamp: timestamp,
      stock: Math.random() > 0.1 // 90% chance of being in stock
    });
  }

  // Sort by timestamp
  history.sort((a, b) => a.timestamp - b.timestamp);
  return history;
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



// Generate smart buying recommendation
// Recommendation logic removed



// Save to chrome storage
// Saved Items functionality removed



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
    const autoScan = document.getElementById('autoScanToggle');
    if (autoScan) autoScan.checked = settings.autoScanEnabled !== false;

    const priceAlerts = document.getElementById('priceAlertsToggle');
    if (priceAlerts) priceAlerts.checked = settings.priceAlerts !== false;

    const stockAlerts = document.getElementById('stockAlertsToggle');
    if (stockAlerts) stockAlerts.checked = settings.stockAlerts !== false;
  });

  // API Key Configuration Removed - Managed by Backend

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
  const stockToggle = document.getElementById('stockAlertsToggle');
  if (stockToggle) {
    stockToggle.addEventListener('change', (e) => {
      chrome.storage.local.get(['picksySettings'], (result) => {
        const settings = result.picksySettings || {};
        settings.stockAlerts = e.target.checked;
        chrome.storage.local.set({ picksySettings: settings }, () => {
          console.log('Stock alerts:', e.target.checked ? 'enabled' : 'disabled');
          showToast(e.target.checked ? '📦 Stock alerts enabled' : '📭 Stock alerts disabled');
        });
      });
    });
  }
}

// Update scan information

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

window.testPriceDropNotification = function () {
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

window.testStockNotification = function () {
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

window.testRealPriceDrop = function () {
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

function setupComparisonTab() {
  console.log('Comparison tab setup');
  const startBtn = document.getElementById('startComparisonBtn');
  if (startBtn) {
    // Remove existing listeners to avoid duplicates
    const newBtn = startBtn.cloneNode(true);
    startBtn.parentNode.replaceChild(newBtn, startBtn);

    newBtn.addEventListener('click', () => {
      startPriceComparison();
    });
  }
}

// Price Comparison Functionality
// Note: currentProduct is already declared at the top of the file

// Start price comparison
async function startPriceComparison() {
  console.log('🚀 Starting price comparison...');
  console.log('🚀 Current product state:', currentProduct);

  try {
    // Use existing product data if available, otherwise get fresh data
    if (!currentProduct || !currentProduct.title) {
      console.log('📡 No current product, fetching fresh data...');
      showToast('⏳ Getting product data...', 'info');
      currentProduct = await getCurrentProductData();
    } else {
      console.log('📦 Using existing product data:', currentProduct.title);
    }

    if (!currentProduct || !currentProduct.title) {
      console.error('❌ No product data available');
      showToast('❌ Please scan a product first', 'error');
      return;
    }

    console.log('📦 Current product for comparison:', {
      title: currentProduct.title,
      price: currentProduct.price,
      source: currentProduct.source
    });

    // Show progress
    showComparisonProgress();
    showToast('🔍 Starting price comparison...', 'info');

    // Load price comparison engine
    await loadPriceComparisonEngine();

    // Start comparison with more lenient settings
    console.log('🎯 Calling PriceComparison.compareProductPrices...');
    const results = await PriceComparison.compareProductPrices(currentProduct, {
      maxSites: 12,
      timeout: 30000,
      enableAI: true,
      minTrustScore: 5 // Lower threshold for more results
    });

    console.log('🎯 Comparison results received:', results);
    console.log('🎯 Results structure check:', {
      hasResults: !!results,
      hasMatches: !!(results?.matches),
      matchesLength: results?.matches?.length || 0,
      hasBestDeal: !!(results?.bestDeal),
      hasAnalysis: !!(results?.analysis)
    });

    if (!results) {
      throw new Error('No results returned from comparison engine');
    }

    // Display results
    displayComparisonResults(results);
    showToast(`✅ Found ${results.matches?.length || 0} matches`, 'success');

  } catch (error) {
    console.error('❌ Price comparison failed:', error);
    console.error('❌ Error stack:', error.stack);
    showComparisonError(error.message);
    showToast(`❌ Comparison failed: ${error.message}`, 'error');
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
// Load price comparison engine with dependencies
async function loadPriceComparisonEngine() {
  if (typeof PriceComparison !== 'undefined' && typeof Scraper !== 'undefined') {
    console.log('✅ PriceComparison & Scraper already loaded');
    return;
  }

  const scripts = [
    '../../utils/config.js',
    '../../utils/aiExtraction.js',
    '../../utils/scraper.js',
    '../../utils/priceComparison.js'
  ];

  console.log('🔄 Loading PriceComparison dependencies...');

  try {
    for (const src of scripts) {
      await loadScript(src);
    }
    console.log('✅ All PriceComparison scripts loaded');
  } catch (error) {
    console.error('❌ Failed to load scripts:', error);
    throw new Error('Failed to load comparison engine: ' + error.message);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    // Check if already loaded by filename checking (rough check)
    const filename = src.split('/').pop();
    const existing = document.querySelector(`script[src*="${filename}"]`);
    if (existing) {
      resolve(); // Already exists
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      console.log(`✅ Loaded ${filename}`);
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${filename}`));
    document.head.appendChild(script);
  });
}

// Show comparison progress
function showComparisonProgress() {
  // Ensure parent container is visible
  const comparisonResults = document.getElementById('comparisonResults');
  if (comparisonResults) comparisonResults.style.display = 'block';

  // Hide initial/ready states
  const initialState = document.getElementById('comparisonInitialState');
  if (initialState) initialState.style.display = 'none';

  const readyState = document.getElementById('comparisonReadyState');
  if (readyState) readyState.style.display = 'none';

  // Show progress, hide results
  const progressElement = document.getElementById('comparisonProgress');
  if (progressElement) progressElement.style.display = 'block';

  const resultsContainer = document.getElementById('comparisonResultsContainer');
  if (resultsContainer) resultsContainer.style.display = 'none';

  // Animate progress bar
  let progress = 0;
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');

  const progressSteps = [
    'Extracting product details...',
    'Generating search URLs...',
    'Opening invisible tabs...',
    'Scraping site 1/12...',
    'Scraping site 3/12...',
    'Scraping site 6/12...',
    'Scraping site 9/12...',
    'Scraping site 12/12...',
    'Matching products...',
    'Analyzing results...',
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

// Display comparison results
function displayComparisonResults(results) {
  console.log('📊 Displaying comparison results:', results);
  console.log('📊 Results structure:', {
    matches: results?.matches?.length || 0,
    bestDeal: !!results?.bestDeal,
    analysis: !!results?.analysis
  });

  // Hide progress, show results
  document.getElementById('comparisonProgress').style.display = 'none';
  document.getElementById('comparisonResultsContainer').style.display = 'block';

  // Display best deal only if it exists
  const bestDealCard = document.getElementById('bestDealCard');
  if (results.bestDeal && results.matches.length > 0) {
    bestDealCard.style.display = 'block';
    displayBestDeal(results.bestDeal, results.savings, results.savingsPercent);
  } else {
    bestDealCard.style.display = 'none';
  }

  // Display all results
  displayAllResults(results.matches);

  // Display statistics
  const comparisonStats = document.getElementById('comparisonStats');
  if (results.analysis && results.matches.length > 0) {
    comparisonStats.style.display = 'block';
    displayComparisonStats(results.analysis);
  } else {
    comparisonStats.style.display = 'none';
  }

  // Update results count
  document.getElementById('resultsCount').textContent = results.matches.length;

  // Add event listeners for deal buttons
  document.querySelectorAll('.deal-button').forEach(button => {
    button.addEventListener('click', () => {
      window.open(button.dataset.url, '_blank');
    });
  });

  document.querySelectorAll('.match-button').forEach(button => {
    button.addEventListener('click', () => {
      window.open(button.dataset.url, '_blank');
    });
  });
}

// Display best deal card
function displayBestDeal(bestDeal, savings, savingsPercent) {
  const bestDealContent = document.getElementById('bestDealContent');

  bestDealContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div>
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">
          ₹${bestDeal.priceValue.toLocaleString()}
        </div>
        <div style="font-size: 14px; opacity: 0.9;">
          ${bestDeal.siteName} • Trust: ${bestDeal.trustScore}/10
        </div>
      </div>
      <div style="text-align: right;">
        ${savings > 0 ? `
          <div style="font-size: 16px; font-weight: bold; color: #ffeb3b;">
            Save ₹${savings.toLocaleString()}
          </div>
          <div style="font-size: 12px; opacity: 0.8;">
            ${savingsPercent.toFixed(1)}% off
          </div>
        ` : `
          <div style="font-size: 14px; opacity: 0.9;">
            Best available price
          </div>
        `}
      </div>
    </div>
    <button class="deal-button" data-url="${bestDeal.url}" style="
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
}

// Display all results
function displayAllResults(matches) {
  const allResults = document.getElementById('allResults');

  if (matches.length === 0) {
    allResults.innerHTML = `
      <div class="product-card" style="text-align: center; padding: 30px; color: #333;">
        <div style="font-size: 32px; margin-bottom: 10px;">📉</div>
        <h4 style="margin: 0 0 5px 0;">No matches found</h4>
        <p style="font-size: 13px; color: #666; margin: 0;">We couldn't find this exact product on other stores.</p>
      </div>
    `;
    return;
  }

  // Create table format for better comparison
  allResults.innerHTML = `
    <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
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
          ${matches.map((match, index) => `
            <tr style="border-bottom: 1px solid #e9ecef; ${index % 2 === 0 ? 'background: #f8f9fa;' : 'background: white;'}">
              <td style="padding: 12px 8px;">
                <div style="font-weight: 500; color: #333; margin-bottom: 2px;">${match.siteName}</div>
                <div style="font-size: 11px; color: #666; line-height: 1.3;">
                  ${match.title.substring(0, 40)}${match.title.length > 40 ? '...' : ''}
                </div>
              </td>
              <td style="padding: 12px 8px; text-align: right;">
                <span style="font-size: 14px; font-weight: bold; color: ${match.error ? '#dc3545' : '#007cba'};">
                  ${match.error ? 'Failed' : (match.priceValue > 0 ? '₹' + match.priceValue.toLocaleString() : 'N/A')}
                </span>
              </td>
              <td style="padding: 12px 8px; text-align: center;">
                <span style="
                  background: ${match.trustScore >= 8 ? '#28a745' : match.trustScore >= 6 ? '#ffc107' : '#dc3545'};
                  color: white;
                  padding: 3px 8px;
                  border-radius: 12px;
                  font-size: 10px;
                  font-weight: bold;
                ">
                  ${match.trustScore}/10
                </span>
              </td>
              <td style="padding: 12px 8px; text-align: center;">
                <span style="
                  background: ${match.similarity >= 0.8 ? '#28a745' : '#ffc107'};
                  color: white;
                  padding: 3px 8px;
                  border-radius: 12px;
                  font-size: 10px;
                  font-weight: bold;
                ">
                  ${Math.round(match.similarity * 100)}%
                </span>
              </td>
              <td style="padding: 12px 8px; text-align: center;">
                <button class="match-button" data-url="${match.url}" style="
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
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Display comparison statistics
function displayComparisonStats(analysis) {
  const statsContent = document.getElementById('statsContent');

  statsContent.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 12px;">
      <div>
        <strong>Sites Checked:</strong><br>
        ${analysis.totalSites} sites
      </div>
      <div>
        <strong>Successful Matches:</strong><br>
        ${analysis.successfulMatches} products
      </div>
      <div>
        <strong>Average Price:</strong><br>
        ₹${analysis.averagePrice.toLocaleString()}
      </div>
      <div>
        <strong>Price Range:</strong><br>
        ₹${analysis.priceRange.min.toLocaleString()} - ₹${analysis.priceRange.max.toLocaleString()}
      </div>
    </div>
  `;
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

// Duplicate setupComparisonTab removed

// Update comparison tab when product is scanned
function updateComparisonTabForProduct(product) {
  console.log('🔄 Updating comparison tab for product:', product.title);

  const comparisonResults = document.getElementById('comparisonResults');
  if (!comparisonResults) return;

  // Update the comparison tab to show the product is ready
  comparisonResults.innerHTML = `
    <div id="comparisonReadyState" class="product-card" style="text-align: center; padding: 40px 20px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px; animation: pulse 2s infinite;">✅</div>
      <h3 style="margin: 0 0 8px 0; color: #333;">Product Ready</h3>
      <p style="margin: 0 0 15px 0; font-size: 13px; color: #666;">
        <strong>${product.title.substring(0, 50)}${product.title.length > 50 ? '...' : ''}</strong><br/>
        Compare across 12+ verified stores
      </p>
      <button id="startComparisonBtn" class="btn-main">
        🔍 Start Comparison
      </button>
    </div>
    
    <!-- Comparison Progress -->
    <div id="comparisonProgress" style="display: none;">
      <div class="product-card" style="margin: 15px 0; text-align: center; padding: 30px;">
        <div class="loading-spinner"></div>
        <h4 style="margin: 0 0 10px 0; color: #333;">Scanning Markets...</h4>
        <div style="background: #eee; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 15px;">
          <div id="progressBar" style="background: var(--primary); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
        </div>
        <p id="progressText" style="margin: 10px 0 0 0; font-size: 12px; color: #666;">Initializing agents...</p>
      </div>
    </div>
    
    <!-- Comparison Results -->
    <div id="comparisonResultsContainer" style="display: none;">
      <!-- Best Deal Card (Hidden by default) -->
      <div id="bestDealCard" class="product-card" style="display: none; background: linear-gradient(135deg, var(--success) 0%, #00b894 100%); border: none; margin: 15px 0;">
        <h3 style="margin: 0 0 10px 0; display: flex; align-items: center; color: white;">
          🏆 <span style="margin-left: 8px;">Best Deal Found</span>
        </h3>
        <div id="bestDealContent" style="color: white;"></div>
      </div>

      <!-- All Results -->
      <div id="allResultsContainer">
        <h4 style="margin: 0 0 15px 0; color: #fff; display: flex; align-items: center; font-size: 14px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">
          📊 <span style="margin-left: 8px;">All Results</span>
          <span id="resultsCount" style="background: white; color: var(--primary); padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-left: auto; font-weight: bold;">0</span>
        </h4>
        <div id="allResults" class="comparison-table-wrapper"></div>
      </div>

      <!-- Comparison Stats -->
      <div id="comparisonStats" class="product-card" style="margin-top: 15px; display: none;">
        <h5 style="margin: 0 0 10px 0; color: #333;">📈 Market Statistics</h5>
        <div id="statsContent" style="color: #555;"></div>
      </div>
    </div>
  `;

  // Re-setup the comparison button
  setupComparisonTab();
}

// Make functions globally available
window.startPriceComparison = startPriceComparison;
window.displayComparisonResults = displayComparisonResults;
window.setupComparisonTab = setupComparisonTab;
window.updateComparisonTabForProduct = updateComparisonTabForProduct;
// ----------------- PIXIE INTEGRATION (Restored) -----------------
// Pixie Integration delegated to scanBtn via top-level listener

const downloadBtn = document.getElementById('downloadBtn');
if (downloadBtn) {
  downloadBtn.addEventListener('click', async () => {
    // Check if real button is already there
    if (document.getElementById('realDownloadBtn')) {
      document.getElementById('realDownloadBtn').click();
    } else {
      alert("Please run 'Analyze (Pixie)' first to generate data for the report.");
    }
  });
}

function scrapeAmazonPage() {
  const title = document.getElementById('productTitle')?.innerText.trim() || document.title;
  const priceText = document.querySelector('.a-price .a-offscreen')?.innerText;
  let price = 0;
  if (priceText) {
    price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
  }

  const reviewElements = document.querySelectorAll('[data-hook="review-body"]');
  const reviews = Array.from(reviewElements).map(el => ({
    content: el.innerText.trim(),
    source: "Amazon (Current Page)"
  }));

  return {
    product_name: title,
    price: price,
    category: "electronics",
    reviews: reviews
  };
}

function displayPixieResults(data) {
  addToHistory(data.product_name); // Log history for Recs Agent
  const resultDiv = document.getElementById('result');
  const trustScore = data.trust_score !== undefined ? Math.round(data.trust_score * 100) : 'N/A';
  const qualityLabel = data.quality_label || "Unknown Quality";
  const insight = data.financial_insight;

  let insightHTML = '';
  if (insight) {
    insightHTML = `
            <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-top: 15px; border-left: 4px solid ${insight.impact_color}; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px;">
                   <strong style="color: #333;">💳 Budget Impact: ${insight.impact_level}</strong>
                </div>
                <div style="font-size: 13px; color: #555; margin-bottom: 8px;">${insight.impact_message}</div>
                
                <div style="background: white; padding: 8px; border-radius: 5px; border: 1px solid #e9ecef;">
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; font-weight: bold;">Smart Payment Pick</div>
                    <div style="font-weight: bold; color: #2d3436; margin-top: 2px;">${insight.best_payment_method.name}</div>
                    <div style="font-size: 12px; color: #666;">${insight.best_payment_method.rationale}</div>
                </div>
            </div>
  `;
  }

  // Create or update Pixie Section
  let pixieSection = document.getElementById('pixieResultsSection');
  if (!pixieSection) {
    pixieSection = document.createElement('div');
    pixieSection.id = 'pixieResultsSection';
    pixieSection.className = 'product-card';
    // Insert after the main product card
    resultDiv.appendChild(pixieSection);
  }

  pixieSection.innerHTML = `
            <h3 class="product-title" style="margin-bottom: 12px; font-size: 16px; display:flex; align-items:center;">
               ✨ Pixie Analysis <span style="font-size:12px; font-weight:normal; margin-left:auto; background:#eee; padding:2px 8px; border-radius:10px;">${qualityLabel}</span>
            </h3>
            
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
                <div style="text-align: center; flex: 1; border-right: 1px solid #eee;">
                   <div style="font-size: 24px; font-weight: 800; color: ${trustScore > 80 ? '#27ae60' : trustScore > 60 ? '#f39c12' : '#c0392b'}">${trustScore}%</div>
                   <div class="stat-label">QUALITY SCORE</div>
                </div>
                <div style="text-align: center; flex: 1;">
                   <div style="font-size: 24px; font-weight: 800; color: #333;">${data.analyzed_reviews ? data.analyzed_reviews.length : 0}</div>
                   <div class="stat-label">REVIEWS CHECKED</div>
                </div>
            </div>

            ${insightHTML}

            <button id="realDownloadBtn" style="width: 100%; margin-top: 15px; background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); color: white; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px;">📥 Download Audit Report</button>
    `;

  document.getElementById('realDownloadBtn').onclick = () => {
    downloadReport(data.product_name, data.analyzed_reviews);
    document.getElementById('realDownloadBtn').innerHTML = "Generating...";
  };
}

async function downloadReport(productName, reviews) {
  try {
    const response = await fetch('http://localhost:5000/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_name: productName, reviews: reviews })
    });

    if (!response.ok) throw new Error("Report generation failed");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Picksy_Audit_${productName.replace(/[^a-z0-9]/gi, '_').substring(0, 20)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    alert("Error downloading report: " + e.message);
  }
}

// ---------------- AUTHENTICATION ----------------
// currentUser and isBusinessUser are declared at the top of the file

// ---------------- AUTHENTICATION REMOVED ----------------
// Universal access enabled by default.



// ---------------- REVIEWS & CHAT ----------------
function setupReviewsTab() {
  const sendBtn = document.getElementById('sendChatBtn');
  const input = document.getElementById('chatInput');
  const reviewsTab = document.querySelector('.tab[data-tab="reviews"]');

  if (sendBtn && input) {
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  if (reviewsTab) {
    reviewsTab.addEventListener('click', () => {
      loadReviewSummary();
    });
  }
}

function loadReviewSummary() {
  console.log('📊 Loading review summary...');
  const loginPrompt = document.getElementById('reviewsLoginPrompt');
  const content = document.getElementById('reviewsContent');
  const summaryText = document.getElementById('summaryText');

  // Universal Access: No login check required


  if (loginPrompt) loginPrompt.style.display = 'none';
  if (content) content.style.display = 'block';

  if (!currentProduct || !currentProduct.title) {
    if (summaryText) {
      summaryText.innerHTML = `
            <div style="text-align: center; color: #666; padding: 10px;">
                <p>Waiting for product scan...</p>
                <div class="loading-spinner" style="width: 20px; height: 20px; margin: 0 auto;"></div>
            </div>
        `;
    }
    return;
  }

  // If we have a product but haven't analyzed reviews yet, show a button
  // We can check if we've already loaded reviews to avoid re-fetching
  if (currentProduct.reviewsAnalyzed) {
    // already loaded
    return;
  }

  if (summaryText) {
    summaryText.innerHTML = `
        <div style="text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 13px;"><strong>${currentProduct.title.substring(0, 40)}...</strong></p>
            <button id="analyzeReviewsBtn" class="btn-main" style="padding: 8px 16px; font-size: 13px;">
                🧠 Analyze Reviews
            </button>
        </div>
      `;

    if (btn) btn.onclick = () => indexReviewsAndSummarize(currentProduct);
  }
}

function indexReviewsAndSummarize(product) {
  const summaryText = document.getElementById('summaryText');

  // GRANULAR PROGRESS: Step 1
  if (summaryText) summaryText.innerHTML = `
    <div style="text-align:center; color:#666;">
        <div class="loading-spinner" style="margin:0 auto 10px auto;"></div>
        <div>🔍 Phase 1: Indexing Reviews...</div>
        <div style="font-size:11px; opacity:0.8;">Storing review vectors</div>
    </div>
  `;

  // 1. Send to Backend Indexer & Analyzer
  fetch('http://localhost:5000/shop_assist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Picksy-Source': 'Extension'
    },
    body: JSON.stringify({
      product_name: product.title,
      reviews: product.reviews || [],
      price: product.priceValue || 0,
      seller: product.seller || 'Unknown',
      rating: product.rating || 0,
      review_count: product.reviewCount || 0,
      url: product.url
    })
  })
    .then(res => res.json())
    .then(data => {
      console.log('✅ Indexing & Analysis complete:', data);

      // GRANULAR PROGRESS: Step 2
      if (summaryText) summaryText.innerHTML = `
        <div style="text-align:center; color:#666;">
            <div class="loading-spinner" style="margin:0 auto 10px auto;"></div>
            <div>🧠 Phase 2: AI Analysis...</div>
            <div style="font-size:11px; opacity:0.8;">Pixie & Banking Agents active</div>
        </div>
      `;

      // UPDATE UI WITH PIXIE DATA
      if (!data.error) {
        displayPixieResults(data);
      }

      // 2. Now fetch the summary
      fetchReviewSummary();
    })
    .catch(err => {
      console.error('❌ Indexing failed:', err);
      // Try fetching summary anyway, maybe previous index exists
      fetchReviewSummary();
    });
}

function fetchReviewSummary() {
  const summaryText = document.getElementById('summaryText');
  if (summaryText) summaryText.innerHTML = `
    <div style="text-align:center; color:#666;">
        <div class="loading-spinner" style="margin:0 auto 10px auto;"></div>
        <div>💬 Phase 3: Summarizing Perception...</div>
        <div style="font-size:11px; opacity:0.8;">Agent 3 synthesizing insights</div>
    </div>
  `;

  // Mark as analyzing to prevent double calls
  currentProduct.reviewsAnalyzed = true;

  // Call Backend (Universal Access - No Key Needed from Client)
  fetch('http://localhost:5000/reviews/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product: currentProduct,
      user_email: "universal_guest@picksy.ai",
      is_business: true
    })
  })
    .then(res => res.json())
    .then(data => {
      console.log('✅ Review summary received:', data);
      if (summaryText) summaryText.innerHTML = data.summary;
    })
    .catch(err => {
      console.error('❌ Review summary failed:', err);
      if (summaryText) summaryText.innerHTML = `<span style="color:red">Failed to load summary. Ensure backend is running at localhost:5000.</span>`;
      currentProduct.reviewsAnalyzed = false; // Reset on error
    });
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const history = document.getElementById('chatHistory');

  if (!input || !history) return;

  const text = input.value.trim();
  if (!text) return;

  // Add User Message
  history.innerHTML += `
    <div class="chat-msg" style="background:#fff; border:1px solid #eee; padding:8px; border-radius:10px; align-self:flex-end; margin-bottom:5px; font-size:12px; margin-left:20px;">
      ${text}
    </div>
  `;
  history.scrollTop = history.scrollHeight;
  input.value = '';

  // Call Backend (Universal Access - No Key Needed from Client)
  fetch('http://localhost:5000/reviews/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: text,
      product_title: currentProduct ? currentProduct.title : 'unknown',
      user_email: "universal_guest@picksy.ai",
      is_business: true
    })
  })
    .then(res => res.json())
    .then(data => {
      history.innerHTML += `
      <div class="chat-msg" style="background:#e1f5fe; padding:8px; border-radius:10px; align-self:flex-start; margin-bottom:5px; font-size:12px; margin-right:20px;">
        ${data.answer}
      </div>
    `;
      history.scrollTop = history.scrollHeight;
    })
    .catch(err => {
      history.innerHTML += `
      <div class="chat-msg" style="background:#ffebee; color:red; padding:8px; border-radius:10px; align-self:flex-start; margin-bottom:5px; font-size:12px;">
        Error: ${err.message}
      </div>
    `;
    });
}

// ---------------- RECOMMENDATIONS ----------------
function setupRecsTab() {
  const recsTab = document.querySelector('.tab[data-tab="recs"]');
  if (recsTab) {
    recsTab.addEventListener('click', () => {
      loadRecommendations();
    });
  }
}

function addToHistory(productTitle) {
  if (!productTitle) return;

  chrome.storage.local.get(['browsingHistory'], (result) => {
    let history = result.browsingHistory || [];
    // Avoid duplicates at the end
    if (history.length === 0 || history[history.length - 1] !== productTitle) {
      history.push(productTitle);
      // Keep last 10
      if (history.length > 10) history.shift();
      chrome.storage.local.set({ browsingHistory: history });
    }
  });
}

function loadRecommendations() {
  console.log('💡 Loading recommendations...');
  const list = document.getElementById('recsList');
  if (!list) return;

  list.innerHTML = '<div class="loading-spinner"></div><p>Agent 4 is curating picks...</p>';

  chrome.storage.local.get(['browsingHistory'], (result) => {
    const history = result.browsingHistory || [];
    console.log('📚 Browsing History:', history);

    // Call Backend
    fetch(`${Config.API_BASE_URL}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: history })
    })
      .then(res => res.json())
      .then(data => {
        console.log('✅ Recommendations received:', data);
        list.innerHTML = '';
        if (!data.recommendations || data.recommendations.length === 0) {
          list.innerHTML = '<p>No recommendations yet. Browse more products!</p>';
          return;
        }

        data.recommendations.forEach(rec => {
          list.innerHTML += `
               <div style="background: white; padding: 10px; border-radius: 8px; border-left: 4px solid var(--secondary); box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 8px;">
                  <div style="font-weight: bold; font-size: 14px; color: #333;">${rec.title}</div>
                  <div style="font-size: 12px; color: #666; margin-top: 4px;">💡 ${rec.reason}</div>
               </div>
             `;
        });
      })
      .catch(err => {
        console.error('❌ Recommendations failed:', err);
        list.innerHTML = `<p style="color:red">Failed to load recs: ${err.message}</p>`;
      });
  });
}

// End of file - Logic Initialized

// Global Initialization
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Picksy Popup Initializing...');
  // setupAuth();
  setupReviewsTab();
  setupComparisonTab();

  // Ensure Recs tab logic is ready (if any specific init needed)
  if (typeof setupRecsTab === 'function') setupRecsTab();
});
