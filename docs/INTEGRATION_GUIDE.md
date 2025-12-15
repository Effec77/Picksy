# 🔌 Integration Guide - Connecting AI Agent to Extension

**Purpose:** How to integrate the new AI components with the existing extension  
**Status:** Ready to integrate

---

## 📋 Integration Checklist

### **Phase 1: Load New Scripts** ✅

Add to `manifest.json`:
```json
{
  "background": {
    "service_worker": "src/background/background.js",
    "type": "module"
  }
}
```

### **Phase 2: Update Popup HTML**

Add new tab for AI Comparison in `popup.html`:
```html
<div class="tab" data-tab="aiComparison">🤖 AI Compare</div>

<div id="aiComparison" class="tab-content">
  <div id="aiComparisonResults"></div>
</div>
```

### **Phase 3: Add Comparison Button**

In the product display section, add:
```html
<button id="aiCompareBtn" style="flex: 1; background: #6c5ce7;">
  🤖 AI Compare Prices
</button>
```

### **Phase 4: Add Event Listener**

In `popup.js`, add:
```javascript
document.getElementById("aiCompareBtn").addEventListener("click", async () => {
  if (!currentProduct) return;
  
  const btn = document.getElementById("aiCompareBtn");
  btn.disabled = true;
  btn.innerHTML = '⏳ Comparing...';
  
  // Extract keywords
  const keywords = extractKeywords(currentProduct.title);
  const searchQuery = keywords.searchQuery;
  
  // Send to background for scraping
  chrome.runtime.sendMessage({
    type: "PICKSY_AI_COMPARE",
    payload: {
      searchQuery: searchQuery,
      originalProduct: currentProduct
    }
  }, (response) => {
    btn.disabled = false;
    btn.innerHTML = '🤖 AI Compare Prices';
    
    if (response && response.success) {
      displayAIComparison(response.data);
      // Switch to comparison tab
      document.querySelector('[data-tab="aiComparison"]').click();
    } else {
      alert('Comparison failed: ' + (response?.error || 'Unknown error'));
    }
  });
});
```

### **Phase 5: Add Background Message Handler**

In `background.js`, add:
```javascript
// Add at top
importScripts(
  'config/config.js',
  'utils/aiExtraction.js',
  'utils/extraction.js',
  'utils/searchUrls.js',
  'utils/scraper.js',
  'utils/matcher.js',
  'utils/emailNotifications.js'
);

// Add message handler
if (msg?.type === "PICKSY_AI_COMPARE") {
  const { searchQuery, originalProduct } = msg.payload;
  
  console.log('🤖 Starting AI comparison for:', searchQuery);
  
  // Scrape comparison sites
  scrapeComparison(searchQuery, {
    maxSites: 10,
    maxConcurrent: 3
  }).then(scrapeResults => {
    // Match products
    const matches = matchProducts(originalProduct, scrapeResults.results);
    
    // Find best deal
    const bestDeal = findBestDeal(matches.exactMatches);
    
    // Calculate savings
    const savings = calculateSavings(originalProduct, bestDeal);
    
    // Send response
    sendResponse({
      success: true,
      data: {
        matches: matches,
        bestDeal: bestDeal,
        savings: savings,
        scrapeResults: scrapeResults
      }
    });
  }).catch(error => {
    console.error('AI comparison failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  });
  
  return true; // Keep channel open for async response
}
```

### **Phase 6: Display Comparison Results**

In `popup.js`, add:
```javascript
function displayAIComparison(data) {
  const resultsDiv = document.getElementById('aiComparisonResults');
  const { matches, bestDeal, savings, scrapeResults } = data;
  
  let html = `
    <div class="ai-comparison-header">
      <h3>🤖 AI Price Comparison</h3>
      <p>Scanned ${scrapeResults.totalCount} sites in real-time</p>
    </div>
  `;
  
  // Best Deal Section
  if (bestDeal && savings.hasSavings) {
    html += `
      <div class="best-deal-card" style="
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: white;
        padding: 20px;
        border-radius: 10px;
        margin: 15px 0;
      ">
        <h4 style="margin: 0 0 10px 0;">🏆 Best Deal Found!</h4>
        <p style="margin: 0; font-size: 24px; font-weight: bold;">
          Save ₹${savings.amount.toLocaleString()} (${savings.percentage}%)
        </p>
        <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">
          ${bestDeal.siteName}: ₹${bestDeal.price.toLocaleString()}
        </p>
        <a href="${bestDeal.sourceUrl}" target="_blank" style="
          display: inline-block;
          background: white;
          color: #28a745;
          padding: 10px 20px;
          border-radius: 5px;
          text-decoration: none;
          margin-top: 15px;
          font-weight: bold;
        ">View Deal →</a>
      </div>
    `;
  }
  
  // Exact Matches
  if (matches.exactMatches.length > 0) {
    html += `<h4>✅ Exact Matches (${matches.exactMatches.length})</h4>`;
    matches.exactMatches.forEach(product => {
      html += `
        <div class="comparison-item" style="
          background: white;
          padding: 15px;
          border-radius: 8px;
          margin: 10px 0;
          border-left: 4px solid #28a745;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>${product.siteName}</strong><br>
              <span style="font-size: 20px; color: #28a745; font-weight: bold;">
                ₹${product.price.toLocaleString()}
              </span><br>
              <small style="color: #666;">Match: ${product.matchScore}%</small>
            </div>
            <a href="${product.sourceUrl}" target="_blank" style="
              background: #28a745;
              color: white;
              padding: 8px 16px;
              border-radius: 5px;
              text-decoration: none;
            ">View</a>
          </div>
        </div>
      `;
    });
  }
  
  // Similar Products
  if (matches.similarProducts.length > 0) {
    html += `<h4>⚠️ Similar Products (${matches.similarProducts.length})</h4>`;
    matches.similarProducts.forEach(product => {
      html += `
        <div class="comparison-item" style="
          background: white;
          padding: 15px;
          border-radius: 8px;
          margin: 10px 0;
          border-left: 4px solid #ffc107;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>${product.siteName}</strong><br>
              <span style="font-size: 18px; color: #333; font-weight: bold;">
                ₹${product.price.toLocaleString()}
              </span><br>
              <small style="color: #666;">Match: ${product.matchScore}%</small>
            </div>
            <a href="${product.sourceUrl}" target="_blank" style="
              background: #ffc107;
              color: #000;
              padding: 8px 16px;
              border-radius: 5px;
              text-decoration: none;
            ">View</a>
          </div>
        </div>
      `;
    });
  }
  
  // Stats
  html += `
    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px;">
      <strong>📊 Scan Statistics:</strong><br>
      <small>
        ✅ ${scrapeResults.successCount} successful | 
        ❌ ${scrapeResults.failureCount} failed | 
        📦 ${scrapeResults.totalCount} total
      </small>
    </div>
  `;
  
  resultsDiv.innerHTML = html;
}
```

---

## 🧪 Testing Steps

### **1. Test AI Extraction**
1. Open `extension/utils/test.html`
2. Enter your API key
3. Click "Test AI Extraction"
4. Should see extracted product data

### **2. Test Invisible Scraping**
1. Load extension in Chrome
2. Open background console (chrome://extensions → Picksy → service worker)
3. Run: `testScrape("https://www.amazon.in/dp/B0CHX1W1XY")`
4. Should see tab open and close automatically (invisible to user)

### **3. Test Full Comparison**
1. Visit any product page (Amazon, Flipkart, etc.)
2. Click extension icon
3. Click "Scan Current Page"
4. Click "🤖 AI Compare Prices"
5. Wait 10-20 seconds
6. Should see comparison results

### **4. Test Email Notifications**
1. Configure webhook URL in settings
2. Set target price for a product
3. Manually trigger price drop
4. Check email inbox

---

## 🐛 Troubleshooting

### **Issue: "API key not configured"**
**Solution:** Add API key in `config.js` or via settings

### **Issue: "Tabs are visible"**
**Solution:** Ensure `active: false` in `chrome.tabs.create()`

### **Issue: "Extraction failed"**
**Solution:** Check Gemini API quota and internet connection

### **Issue: "No matches found"**
**Solution:** Lower match threshold or check keyword extraction

### **Issue: "Email not sent"**
**Solution:** Configure webhook URL in email settings

---

## 📝 Configuration

### **Email Setup (Webhook Method):**

1. **Create Webhook** (using Zapier, Make.com, or n8n):
   - Trigger: Webhook
   - Action: Send Email
   - Get webhook URL

2. **Configure in Extension:**
```javascript
await saveEmailConfig({
  serviceType: 'webhook',
  webhookUrl: 'https://hooks.zapier.com/hooks/catch/...',
  userEmail: 'your@email.com',
  preferences: {
    priceDrops: true,
    targetPriceReached: true,
    stockAlerts: true
  }
});
```

---

## 🚀 Ready to Launch!

Once integrated, users will be able to:
1. ✅ Scan any product page
2. ✅ Click "AI Compare Prices"
3. ✅ See results from 10+ sites in 10-20 seconds
4. ✅ Find best deals automatically
5. ✅ Get email alerts for price drops

**The AI agent is ready to go!** 🎉

---

**Made with 🔌 for seamless integration**

*Created: December 9, 2025*  
*Status: Ready to integrate*
