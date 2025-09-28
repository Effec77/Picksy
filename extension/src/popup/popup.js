let currentProduct = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupCurrencyToggle();
  loadSaved();
  loadLastScrape();
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
  chrome.storage.local.get({ saved: [] }, (data) => {
    const savedDiv = document.getElementById("savedItems");
    savedDiv.innerHTML = "";

    data.saved.forEach((p, i) => {
      const stockClass = p.availability === 'InStock' ? 'stock-in' :
        p.availability === 'OutOfStock' ? 'stock-out' : 'stock-unknown';

      const div = document.createElement("div");
      div.className = "product";
      div.innerHTML = `
        <strong>${p.title}</strong><br/>
        💰 ${p.price} | 📦 <span class="stock-indicator ${stockClass}"></span>${p.availability}<br/>
        <a href="${p.url}" target="_blank">Open</a><br/>
        <button class="deleteBtn" data-index="${i}">❌ Delete</button>
      `;
      savedDiv.appendChild(div);
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
