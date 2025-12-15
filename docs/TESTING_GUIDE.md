# 🧪 Testing Guide - How to Check if the Agent is Working

**Purpose:** Step-by-step guide to test all components  
**Time Required:** 10-15 minutes

---

## 🎯 Quick Test (5 minutes)

### **Step 1: Test in Browser (Easiest)**

1. **Open the test page:**
   ```
   File → Open File → Navigate to: extension/utils/test.html
   ```

2. **Enter your API key** (the one you pasted earlier)

3. **Click these buttons in order:**
   - ✅ "Test Config" - Should show API key configured
   - ✅ "Test Extraction" - Should extract keywords from 5 products
   - ✅ "Test URL Generation" - Should generate 10 search URLs
   - ✅ "Show Stats" - Should show 16 verified sites

4. **Test AI Extraction:**
   - Click "Test AI Extraction"
   - Should call Gemini API and extract product data
   - Check console (F12) for detailed logs

**Expected Results:**
- All tests show ✅ green checkmarks
- No ❌ red errors
- Console shows detailed logs

---

## 🔬 Detailed Test (15 minutes)

### **Test 1: Configuration ✅**

**What it tests:** API key storage and configuration

**Steps:**
1. Open `test.html` in browser
2. Enter API key in input field
3. Click "Test Config"

**Expected Output:**
```json
{
  "configured": true,
  "apiKeyPresent": true,
  "settings": {
    "maxConcurrentTabs": 3,
    "tabDelay": 3000,
    "extractionTimeout": 30000,
    "cacheDuration": 21600000
  }
}
```

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 2: Keyword Extraction ✅**

**What it tests:** Smart keyword extraction from product titles

**Steps:**
1. Click "Test Extraction"
2. Check results for 5 products

**Expected Output:**
```json
{
  "original": "iPhone 15 Pro 128GB Natural Titanium",
  "extracted": {
    "brand": "Apple",
    "model": "15 Pro",
    "variant": "128GB",
    "color": "Natural Titanium",
    "searchQuery": "Apple 15 Pro 128GB"
  }
}
```

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 3: Search URL Generation ✅**

**What it tests:** URL generation for verified sites

**Steps:**
1. Click "Test URL Generation"
2. Should generate 10 URLs

**Expected Output:**
```json
[
  {
    "name": "Amazon India",
    "domain": "amazon.in",
    "url": "https://www.amazon.in/s?k=iPhone+15+Pro+128GB",
    "trustScore": 9,
    "category": "all"
  },
  // ... 9 more sites
]
```

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 4: AI Extraction ✅**

**What it tests:** Gemini Pro API integration and data extraction

**Steps:**
1. Click "Test AI Extraction"
2. Wait 5-10 seconds
3. Check result

**Expected Output:**
```json
{
  "title": "iPhone 15 Pro 128GB Natural Titanium",
  "price": 48990,
  "currency": "INR",
  "stock": "in_stock",
  "rating": 4.5,
  "reviews": 2300,
  "confidence": 0.95,
  "extractedAt": 1702123456789
}
```

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 5: Product Matching ✅**

**What it tests:** Product matching algorithm

**Steps:**
1. Open browser console (F12)
2. Paste this code:
```javascript
const original = {
  title: "iPhone 15 Pro 128GB",
  price: 51990
};

const candidate = {
  title: "iPhone 15 Pro 128GB Natural Titanium",
  price: 48990
};

const score = calculateMatchScore(original, candidate);
console.log('Match Score:', score + '%');
```

**Expected Output:**
```
Match Score: 95%
```

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 6: Visual Analytics ✅**

**What it tests:** Chart generation

**Steps:**
1. Open browser console (F12)
2. Paste this code:
```javascript
const history = [
  { price: 51990, stock: true, timestamp: Date.now() - 7*24*60*60*1000 },
  { price: 50990, stock: true, timestamp: Date.now() - 5*24*60*60*1000 },
  { price: 48990, stock: true, timestamp: Date.now() }
];

const chart = generatePriceChart(history);
console.log('Chart generated:', chart.length, 'characters');

const stats = calculatePriceStats(history);
console.log('Stats:', stats);
```

**Expected Output:**
```
Chart generated: 2500+ characters
Stats: {
  current: 48990,
  lowest: 48990,
  highest: 51990,
  average: 50323,
  trend: "decreasing",
  changePercent: -5.8
}
```

**Status:** ✅ PASS / ❌ FAIL

---

## 🚀 Advanced Test (Extension Integration)

### **Test 7: Load Extension ✅**

**Steps:**
1. Open Chrome
2. Go to `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select your `extension` folder
6. Extension should load without errors

**Expected:** No errors in extension page

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 8: Background Script ✅**

**Steps:**
1. In `chrome://extensions`, find Picksy
2. Click "service worker" link
3. Background console opens
4. Paste this code:
```javascript
console.log('Config status:', Config.getStatus());
console.log('Sites:', getAllVerifiedSites().length);
```

**Expected Output:**
```
Config status: { configured: true, apiKeyPresent: true, ... }
Sites: 16
```

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 9: Test Scraping (Real Test!) 🎯**

**Steps:**
1. Open background console (from Test 8)
2. Paste this code:
```javascript
// Test scraping Amazon
testScrape('https://www.amazon.in/dp/B0CHX1W1XY')
  .then(result => {
    console.log('✅ Scrape successful!');
    console.log('Title:', result.title);
    console.log('Price:', result.price);
    console.log('Confidence:', result.confidence);
  })
  .catch(error => {
    console.error('❌ Scrape failed:', error);
  });
```

**Expected:**
- Tab opens in background (you might see it briefly)
- Tab closes automatically
- Console shows extracted data
- Confidence > 0.75

**Status:** ✅ PASS / ❌ FAIL

---

## 🎯 Full Integration Test

### **Test 10: Complete Comparison Flow 🚀**

**Steps:**
1. Open background console
2. Paste this code:
```javascript
// Full comparison test
scrapeComparison('iPhone 15 Pro 128GB', {
  maxSites: 3,  // Test with 3 sites first
  maxConcurrent: 2
}).then(results => {
  console.log('✅ Comparison complete!');
  console.log('Success:', results.successCount);
  console.log('Failed:', results.failureCount);
  console.log('Results:', results.results);
}).catch(error => {
  console.error('❌ Comparison failed:', error);
});
```

**Expected:**
- 3 tabs open and close automatically
- Takes 15-30 seconds
- Shows 2-3 successful extractions
- Console shows product data from each site

**Status:** ✅ PASS / ❌ FAIL

---

## 📊 Test Results Summary

| Test | Component | Status | Notes |
|------|-----------|--------|-------|
| 1 | Configuration | ⬜ | |
| 2 | Keyword Extraction | ⬜ | |
| 3 | URL Generation | ⬜ | |
| 4 | AI Extraction | ⬜ | |
| 5 | Product Matching | ⬜ | |
| 6 | Visual Analytics | ⬜ | |
| 7 | Extension Load | ⬜ | |
| 8 | Background Script | ⬜ | |
| 9 | Single Scrape | ⬜ | |
| 10 | Full Comparison | ⬜ | |

**Legend:** ✅ Pass | ❌ Fail | ⬜ Not Tested

---

## 🐛 Common Issues & Solutions

### **Issue 1: "API key not configured"**
**Solution:** 
- Check if API key is in `config.js`
- Make sure it starts with "AIza"
- Reload extension

### **Issue 2: "Gemini API error"**
**Solution:**
- Check API key is valid
- Check internet connection
- Check Gemini API quota (1,500 requests/day)

### **Issue 3: "Tabs are visible"**
**Solution:**
- Check `active: false` in `chrome.tabs.create()`
- Tabs might flash briefly (normal)

### **Issue 4: "Extraction timeout"**
**Solution:**
- Increase timeout in config.js
- Check if site is loading slowly
- Try different product URL

### **Issue 5: "No matches found"**
**Solution:**
- Check keyword extraction
- Lower match threshold (try 70% instead of 90%)
- Check if product exists on other sites

---

## ✅ Success Criteria

**All tests pass if:**
- ✅ Configuration loads correctly
- ✅ Keywords extracted from titles
- ✅ URLs generated for 10+ sites
- ✅ AI extracts data with >75% confidence
- ✅ Products match with >70% score
- ✅ Charts generate correctly
- ✅ Extension loads without errors
- ✅ Background script runs
- ✅ Single scrape works
- ✅ Full comparison completes

**If all tests pass:** 🎉 **Agent is working perfectly!**

---

## 🚀 Next Steps After Testing

Once all tests pass:
1. ✅ Integrate with popup UI
2. ✅ Add comparison button
3. ✅ Display results
4. ✅ Configure email notifications
5. ✅ Test with real users

---

**Made with 🧪 for thorough testing**

*Last Updated: December 9, 2025*  
*Status: Ready to test*
