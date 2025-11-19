let currentProduct = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupCurrencyToggle();
  setupSettings();
  loadSaved();
  loadLastScrape();
  updateScanInfo();
});

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
      } else if (targetTab === 'comparison' && currentProduct) {
        loadComparison(currentProduct);
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
  chrome.runtime.sendMessage({ type: "PICKSY_SCRAPE_REQUEST" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending scrape request:", chrome.runtime.lastError);
      document.getElementById("result").innerHTML = '<p style="color: red;">Error: Could not connect to background script. Try reloading the extension.</p>';
    }
  });
});

// Listen for scrape results
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "PICKSY_SCRAPE_RESULT_BROADCAST") {
    currentProduct = msg.payload;
    showResult(msg.payload);
  }
});

// Load last scrape on popup open
function loadLastScrape() {
  chrome.storage.local.get(['picksyLastScrape'], (result) => {
    if (result.picksyLastScrape) {
      currentProduct = result.picksyLastScrape;
      showResult(result.picksyLastScrape);
    }
  });
}

// Display current scrape result
function showResult(product) {
  const resultDiv = document.getElementById("result");
  const stockClass = product.availability === 'InStock' ? 'stock-in' :
    product.availability === 'OutOfStock' ? 'stock-out' : 'stock-unknown';

  resultDiv.innerHTML = `
    <div class="product">
      <strong>${product.title}</strong><br/>
      💰 Price: ${product.price}<br/>
      📦 Status: <span class="stock-indicator ${stockClass}"></span>${product.availability}<br/>
      🌐 Source: ${product.source}<br/>
      🔗 <a href="${product.url}" target="_blank">Open Link</a><br/>
      <button id="saveBtn">💾 Save Item</button>
      <button id="viewHistoryBtn">📊 View History</button>
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
function loadPriceHistory(product) {
  const productId = generateProductId(product.url, product.title);

  chrome.storage.local.get([`history_${productId}`], (result) => {
    const historyData = result[`history_${productId}`];
    
    const historyDetailsElement = document.getElementById('historyDetails');
    if (!historyDetailsElement) {
      console.error('historyDetails element not found');
      return;
    }

    if (!historyData || !historyData.history.length) {
      historyDetailsElement.innerHTML = '<p>No price history available yet. Scan this product a few times to build history!</p>';
      // Also clear the chart area
      const priceChartElement = document.getElementById('priceChart');
      if (priceChartElement) {
        priceChartElement.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No data to display</p>';
      }
      return;
    }

    createPriceChart(historyData.history);
    displayHistoryDetails(historyData.history);
  });
}

// Create simple CSS-based price chart
function createPriceChart(history) {
  const priceChartElement = document.getElementById('priceChart');
  if (!priceChartElement) {
    console.error('priceChart element not found');
    return;
  }
  
  if (!history.length) {
    priceChartElement.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No price history available</p>';
    return;
  }
  
  const prices = history.map(h => h.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;
  
  let chartHTML = '<div style="position: relative; height: 180px; border: 1px solid #ddd; border-radius: 5px; padding: 20px 60px 20px 20px; background: #f9f9f9;">';
  
  // Add price points and lines
  history.forEach((entry, index) => {
    const x = (index / Math.max(history.length - 1, 1)) * 100;
    const y = 100 - ((entry.price - minPrice) / priceRange) * 80;
    const stockColor = entry.stock ? '#28a745' : '#dc3545';
    const date = new Date(entry.timestamp).toLocaleDateString();
    
    // Add point
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
      " title="${date}: ₹${entry.price.toLocaleString()} - ${entry.stock ? 'In Stock' : 'Out of Stock'}"></div>
    `;
    
    // Connect points with lines
    if (index > 0) {
      const prevX = ((index - 1) / Math.max(history.length - 1, 1)) * 100;
      const prevY = 100 - ((history[index - 1].price - minPrice) / priceRange) * 80;
      
      chartHTML += `
        <svg style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;">
          <line x1="${prevX}%" y1="${prevY}%" x2="${x}%" y2="${y}%" stroke="#007cba" stroke-width="2"/>
        </svg>
      `;
    }
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
  const priceChange = latest.price - oldest.price;
  const changePercent = ((priceChange / oldest.price) * 100).toFixed(1);

  detailsDiv.innerHTML = `
    <div class="product">
      <h4>Price Trends</h4>
      <p><strong>Current:</strong> ₹${latest.price.toLocaleString()}</p>
      <p><strong>Change:</strong> ${priceChange >= 0 ? '📈' : '📉'} ₹${Math.abs(priceChange).toLocaleString()} (${changePercent}%)</p>
      <p><strong>Lowest:</strong> ₹${Math.min(...history.map(h => h.price)).toLocaleString()}</p>
      <p><strong>Highest:</strong> ₹${Math.max(...history.map(h => h.price)).toLocaleString()}</p>
      <p><strong>Tracked since:</strong> ${new Date(oldest.timestamp).toLocaleDateString()}</p>
    </div>
  `;
}

// Load cross-site comparison
function loadComparison(product) {
  const comparisonDiv = document.getElementById('comparisonResults');

  if (!product.comparisonUrls || !product.comparisonUrls.length) {
    comparisonDiv.innerHTML = '<p>No comparison sites available for this product.</p>';
    return;
  }

  comparisonDiv.innerHTML = `
    <div class="comparison-section">
      <h4>🔍 Find this product on other sites:</h4>
      <p><strong>Search keywords:</strong> ${product.keywords ? product.keywords.join(', ') : 'N/A'}</p>
      ${product.comparisonUrls.map(site => `
        <div class="comparison-item">
          <span>${site.site}</span>
          <a href="${site.url}" target="_blank">Search →</a>
        </div>
      `).join('')}
      <p><small>💡 Tip: Open these links to manually compare prices. Automatic price fetching coming soon!</small></p>
    </div>
  `;
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
    savedDiv.innerHTML = "";

    if (data.saved.length === 0) {
      savedDiv.innerHTML = '<p style="text-align: center; color: #999;">No saved products yet</p>';
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


// ------------- PRICE HISTORY CHART -------------
function drawPriceChart(historyData) {
  const chartContainer = document.getElementById('priceChart');
  const detailsContainer = document.getElementById('historyDetails');
  
  if (!historyData || !historyData.history || historyData.history.length === 0) {
    chartContainer.innerHTML = '<p style="text-align: center; color: #999;">No price history available yet</p>';
    detailsContainer.innerHTML = '';
    return;
  }

  const history = historyData.history;
  const width = 380;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Get price range
  const prices = history.map(h => h.price).filter(p => p !== null);
  if (prices.length === 0) {
    chartContainer.innerHTML = '<p style="text-align: center; color: #999;">No valid price data</p>';
    return;
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  // Create SVG
  let svg = `<svg width="${width}" height="${height}" style="background: #fff; border: 1px solid #ddd; border-radius: 5px;">`;

  // Draw grid lines
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i;
    const price = maxPrice - (priceRange / 4) * i;
    svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#eee" stroke-width="1"/>`;
    svg += `<text x="${padding.left - 5}" y="${y + 4}" text-anchor="end" font-size="10" fill="#666">₹${Math.round(price).toLocaleString()}</text>`;
  }

  // Draw line chart
  let pathData = '';
  const points = [];
  
  history.forEach((entry, index) => {
    if (entry.price === null) return;
    
    const x = padding.left + (chartWidth / (history.length - 1 || 1)) * index;
    const y = padding.top + chartHeight - ((entry.price - minPrice) / priceRange) * chartHeight;
    
    points.push({ x, y, entry, index });
    
    if (pathData === '') {
      pathData = `M ${x} ${y}`;
    } else {
      pathData += ` L ${x} ${y}`;
    }
  });

  // Draw the line
  if (pathData) {
    svg += `<path d="${pathData}" fill="none" stroke="#007cba" stroke-width="2"/>`;
  }

  // Draw points
  points.forEach((point, idx) => {
    const isLowest = point.entry.price === minPrice;
    const isHighest = point.entry.price === maxPrice;
    const color = isLowest ? '#28a745' : isHighest ? '#dc3545' : '#007cba';
    const radius = (isLowest || isHighest) ? 5 : 3;
    
    svg += `<circle cx="${point.x}" cy="${point.y}" r="${radius}" fill="${color}" stroke="white" stroke-width="1"/>`;
    
    // Add tooltip on hover (using title element)
    const date = new Date(point.entry.timestamp).toLocaleDateString();
    svg += `<circle cx="${point.x}" cy="${point.y}" r="8" fill="transparent" style="cursor: pointer;">
      <title>₹${point.entry.price.toLocaleString()} on ${date}</title>
    </circle>`;
  });

  // X-axis labels (dates)
  const labelInterval = Math.ceil(history.length / 5);
  history.forEach((entry, index) => {
    if (index % labelInterval === 0 || index === history.length - 1) {
      const x = padding.left + (chartWidth / (history.length - 1 || 1)) * index;
      const date = new Date(entry.timestamp);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;
      svg += `<text x="${x}" y="${height - 10}" text-anchor="middle" font-size="10" fill="#666">${label}</text>`;
    }
  });

  svg += '</svg>';
  chartContainer.innerHTML = svg;

  // Show price statistics
  const currentPrice = history[history.length - 1].price;
  const firstPrice = history[0].price;
  const priceDiff = currentPrice - firstPrice;
  const percentChange = ((priceDiff / firstPrice) * 100).toFixed(1);
  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

  const trendIcon = priceDiff < 0 ? '📉' : priceDiff > 0 ? '📈' : '➡️';
  const trendColor = priceDiff < 0 ? '#28a745' : priceDiff > 0 ? '#dc3545' : '#666';

  detailsContainer.innerHTML = `
    <div style="background: #f9f9f9; padding: 10px; border-radius: 5px; margin-top: 10px;">
      <h4 style="margin: 0 0 10px 0;">${historyData.title}</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
        <div>
          <strong>Current:</strong> ₹${currentPrice.toLocaleString()}
        </div>
        <div>
          <strong>Average:</strong> ₹${avgPrice.toLocaleString()}
        </div>
        <div>
          <strong>Lowest:</strong> <span style="color: #28a745;">₹${minPrice.toLocaleString()}</span>
        </div>
        <div>
          <strong>Highest:</strong> <span style="color: #dc3545;">₹${maxPrice.toLocaleString()}</span>
        </div>
        <div style="grid-column: 1 / -1;">
          <strong>Trend:</strong> 
          <span style="color: ${trendColor};">
            ${trendIcon} ${priceDiff > 0 ? '+' : ''}₹${Math.abs(priceDiff).toLocaleString()} 
            (${percentChange > 0 ? '+' : ''}${percentChange}%)
          </span>
        </div>
        <div style="grid-column: 1 / -1; font-size: 11px; color: #666;">
          Tracking since ${new Date(history[0].timestamp).toLocaleDateString()} 
          (${history.length} data points)
        </div>
      </div>
      <button id="viewProductBtn" style="width: 100%; margin-top: 10px;">🔗 View Product</button>
    </div>
  `;

  // Add click handler for view product button
  document.getElementById('viewProductBtn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: historyData.url });
  });
}

// Load and display price history for a product
function loadPriceHistory(productId) {
  chrome.storage.local.get([`history_${productId}`], (result) => {
    const historyData = result[`history_${productId}`];
    if (historyData) {
      drawPriceChart(historyData);
      
      // Switch to history tab
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      document.querySelector('[data-tab="history"]').classList.add('active');
      document.getElementById('history').classList.add('active');
    }
  });
}


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
