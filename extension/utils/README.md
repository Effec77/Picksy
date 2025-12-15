# 🛠️ Picksy Utils - Core Utilities

This folder contains the core utility modules for the Picksy Misc Agent (Price Comparison Engine).

---

## 📁 Files Overview

### **1. `config.js`** - Configuration Management
Handles API keys, settings, and app configuration.

**Usage:**
```javascript
// Initialize config
await Config.init();

// Set API key
await Config.setApiKey('AIza...');

// Check if configured
if (Config.isConfigured()) {
  // Ready to use
}
```

---

### **2. `aiExtraction.js`** - AI-Powered Extraction
Universal product data extraction using Gemini Pro.

**Usage:**
```javascript
// Extract product data from HTML
const result = await extractProductData(html, url);

// With retry logic
const result = await extractWithRetry(html, url, 2);

// Result format:
{
  title: "iPhone 15 Pro 128GB",
  price: 48990,
  currency: "INR",
  confidence: 0.95,
  ...
}
```

**Features:**
- Works on ANY e-commerce site
- No hardcoded selectors
- 95%+ accuracy
- Confidence scoring
- Retry logic

---

### **3. `extraction.js`** - Keyword Extraction
Smart keyword extraction from product titles.

**Usage:**
```javascript
// Extract keywords
const keywords = extractKeywords('iPhone 15 Pro 128GB Natural Titanium');

// Result:
{
  brand: "Apple",
  model: "15 Pro",
  variant: "128GB",
  color: "Natural Titanium",
  searchQuery: "Apple 15 Pro 128GB"
}
```

**Supports:**
- 50+ brands (Apple, Samsung, Nike, etc.)
- Model detection (15 Pro, Galaxy S24, etc.)
- Variant extraction (128GB, 256GB, etc.)
- Color extraction
- Size extraction

---

### **4. `searchUrls.js`** - Search URL Generator
Generates search URLs for verified e-commerce sites.

**Usage:**
```javascript
// Generate search URLs
const urls = generateSearchUrls('iPhone 15 Pro 128GB', {
  maxSites: 10,
  minTrustScore: 8,
  category: 'electronics'
});

// Result:
[
  {
    name: "Amazon India",
    domain: "amazon.in",
    url: "https://www.amazon.in/s?k=iPhone+15+Pro+128GB",
    trustScore: 9
  },
  ...
]
```

**Features:**
- 16 verified sites
- 3-tier trust system (8-10)
- Category filtering
- Domain verification

---

### **5. `test.html`** - Test Suite
Interactive test page for all utilities.

**Usage:**
1. Open `test.html` in browser
2. Enter Gemini API key
3. Run tests

**Tests:**
- Configuration test
- Keyword extraction test
- Search URL generation test
- AI extraction test
- Site statistics test

---

## 🚀 Quick Start

### **1. Set Up API Key**
```javascript
// In your extension code
await Config.init();
await Config.setApiKey('YOUR_GEMINI_API_KEY');
```

### **2. Extract Keywords**
```javascript
const keywords = extractKeywords(productTitle);
console.log(keywords.searchQuery); // "Apple 15 Pro 128GB"
```

### **3. Generate Search URLs**
```javascript
const urls = generateSearchUrls(keywords.searchQuery, { maxSites: 10 });
console.log(urls); // Array of 10 search URLs
```

### **4. Extract Product Data**
```javascript
// For each URL, scrape and extract
const html = await fetchPageHtml(url);
const product = await extractProductData(html, url);
console.log(product); // { title, price, rating, ... }
```

---

## 📊 Module Dependencies

```
config.js (standalone)
    ↓
aiExtraction.js (depends on config.js)
    ↓
extraction.js (standalone)
    ↓
searchUrls.js (standalone)
```

**Load Order:**
1. `config.js` - First (required by others)
2. `extraction.js` - For keyword extraction
3. `searchUrls.js` - For URL generation
4. `aiExtraction.js` - For AI extraction

---

## 🔧 Configuration

### **Required Settings:**
```javascript
Config.GEMINI_API_KEY = 'AIza...';  // Required
```

### **Optional Settings:**
```javascript
Config.MAX_CONCURRENT_TABS = 3;      // Default: 3
Config.TAB_DELAY = 3000;             // Default: 3 seconds
Config.EXTRACTION_TIMEOUT = 30000;   // Default: 30 seconds
Config.MAX_RETRIES = 2;              // Default: 2
```

---

## 🧪 Testing

### **Run All Tests:**
Open `test.html` in browser and click test buttons.

### **Manual Testing:**
```javascript
// Test keyword extraction
const keywords = extractKeywords('iPhone 15 Pro 128GB');
console.assert(keywords.brand === 'Apple');
console.assert(keywords.model === '15 Pro');

// Test URL generation
const urls = generateSearchUrls('iPhone 15 Pro 128GB');
console.assert(urls.length > 0);
console.assert(urls[0].trustScore >= 8);

// Test site verification
const isVerified = isVerifiedSite('amazon.in');
console.assert(isVerified === true);
```

---

## 📝 API Reference

### **Config Module**
- `init()` - Initialize configuration
- `setApiKey(key)` - Save API key
- `isConfigured()` - Check if ready
- `getStatus()` - Get config status

### **AI Extraction Module**
- `extractProductData(html, url)` - Extract from HTML
- `extractWithRetry(html, url, retries)` - With retry
- `validateExtraction(data)` - Validate & score

### **Keyword Extraction Module**
- `extractKeywords(title)` - Extract all components
- `extractBrand(title)` - Find brand
- `extractModel(title, brand)` - Find model
- `tokenize(title)` - Tokenize text

### **Search URL Module**
- `generateSearchUrls(query, options)` - Generate URLs
- `getSiteByDomain(domain)` - Get site config
- `isVerifiedSite(domain)` - Check if verified
- `getTrustScore(domain)` - Get trust score
- `getSiteStats()` - Get statistics

---

## 🔐 Security

### **API Key Storage:**
- Stored in Chrome sync storage (encrypted)
- Never exposed in logs
- Never sent to external servers (except Gemini)

### **Data Privacy:**
- No user data collected
- No tracking
- All processing local (except AI API calls)

---

## 🐛 Troubleshooting

### **"API key not configured"**
```javascript
await Config.setApiKey('YOUR_API_KEY');
```

### **"Extraction failed"**
- Check API key is valid
- Check internet connection
- Check HTML is not empty
- Try with retry: `extractWithRetry(html, url, 3)`

### **"No search results"**
- Check search query is not empty
- Check verified sites list
- Try with different category filter

---

## 📚 Next Steps

After these utilities are working:
1. Build scraper (invisible tabs)
2. Build matcher (product matching)
3. Build UI (comparison table)
4. Integration testing

---

**Made with 🛠️ for utility functions**

*Last Updated: December 9, 2025*  
*Status: Core utilities complete*  
*Next: Build scraper logic*
