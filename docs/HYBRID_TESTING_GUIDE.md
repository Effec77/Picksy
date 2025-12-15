# 🧪 Hybrid System Testing Guide

## Overview

Test both **Universal Extraction** (primary) and **Gemini AI Fallback** (secondary) to ensure the hybrid system works correctly.

---

## 🎯 **Testing Strategy**

### **Phase 1: Universal Extraction (Should Work 90% of Time)**
### **Phase 2: AI Fallback (When Universal Fails)**
### **Phase 3: Edge Cases & Error Handling**

---

## 📋 **Phase 1: Test Universal Extraction**

### **Test 1.1: Known Sites (Should Use Universal)**

**Sites to Test:**
- ✅ **Amazon India** - `amazon.in/dp/B0CHWRXH8B` (iPhone)
- ✅ **Flipkart** - `flipkart.com/apple-iphone-15` 
- ✅ **Myntra** - `myntra.com/nike-shoes`
- ✅ **ShopClues** - `shopclues.com/redmi-phone`

**Expected Result:**
```javascript
{
  title: "iPhone 15 Pro 128GB Natural Titanium",
  price: 48990,
  currency: "INR", 
  stock: "In stock",
  extractionMethod: "universal",  // ← Key indicator
  confidence: 0.8-1.0,           // ← High confidence
  extractedAt: 1703123456789
}
```

**How to Test:**
1. **Visit any of these sites**
2. **Open browser console** (F12)
3. **Open Picksy popup**
4. **Click "Scan This Page"**
5. **Check console output** - Should see:
   ```
   🔍 Trying universal extraction for: amazon.in
   ✅ Universal extraction successful
   ```

### **Test 1.2: Generic Sites (Should Still Use Universal)**

**Sites to Test:**
- ✅ **Paytm Mall** - `paytmmall.com`
- ✅ **Snapdeal** - `snapdeal.com`
- ✅ **Any e-commerce site** with standard HTML

**Expected Behavior:**
- Universal extraction tries site-specific selectors first
- Falls back to generic selectors (meta tags, H1, etc.)
- Should still succeed with `extractionMethod: "universal"`

---

## 🤖 **Phase 2: Test AI Fallback**

### **Test 2.1: Force AI Fallback**

**Method 1: Disable Universal Extraction Temporarily**

Create a test version that forces AI:

```javascript
// In enhancedContent.js, temporarily modify:
async tryUniversalExtraction() {
  // Force failure to test AI fallback
  console.log('🧪 TESTING: Forcing universal extraction to fail');
  return null; // This will trigger AI fallback
}
```

**Method 2: Visit Complex Sites**

Sites where universal extraction might struggle:
- ✅ **Complex SPAs** (Single Page Applications)
- ✅ **Sites with dynamic content**
- ✅ **Sites with unusual HTML structure**
- ✅ **Sites with heavy JavaScript rendering**

**Expected Result:**
```javascript
{
  title: "Product Name from AI",
  price: 12999,
  currency: "INR",
  extractionMethod: "ai",        // ← AI was used
  confidence: 0.7-0.95,         // ← AI confidence
  extractedAt: 1703123456789
}
```

**Console Output Should Show:**
```
🔍 Trying universal extraction for: complexsite.com
⚠️ Universal extraction incomplete, trying AI fallback...
🤖 Trying AI extraction...
✅ AI extraction successful
```

### **Test 2.2: API Key Scenarios**

**Scenario A: With Valid API Key**
1. **Configure API key** in popup settings
2. **Visit a complex product page**
3. **AI should work** when universal fails

**Scenario B: Without API Key**
1. **Remove API key** from settings
2. **Visit same complex page**
3. **Should fall back to basic extraction** (not AI)

**Console Output:**
```
⚠️ Universal extraction incomplete, trying AI fallback...
🤖 AI extraction not available (no API key)
⚠️ Both methods failed, using fallback...
```

---

## 🔧 **Phase 3: Edge Cases & Error Handling**

### **Test 3.1: Network Issues**

**Simulate Network Problems:**
1. **Disconnect internet** briefly
2. **Try extraction** - Should handle gracefully
3. **Reconnect** - Should work normally

### **Test 3.2: Invalid Pages**

**Test Non-E-commerce Sites:**
- ✅ **News websites** (should detect not e-commerce)
- ✅ **Social media** (should handle gracefully)
- ✅ **404 pages** (should not crash)

### **Test 3.3: Malformed HTML**

**Test Broken Pages:**
- ✅ **Pages with missing elements**
- ✅ **Pages with unusual structure**
- ✅ **Pages with heavy ads/popups**

---

## 🛠 **Testing Tools & Setup**

### **Tool 1: Enhanced Console Logging**

Add this to your `enhancedContent.js` for better testing:

```javascript
// Enhanced logging for testing
const TestLogger = {
  log(method, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] 🧪 ${method.toUpperCase()}: ${message}`);
    if (data) console.log('📊 Data:', data);
  }
};

// Use in extraction methods:
TestLogger.log('universal', 'Starting extraction', { url: window.location.href });
TestLogger.log('ai', 'Fallback triggered', { reason: 'Universal failed' });
```

### **Tool 2: Test Configuration Panel**

Create a test panel in your popup:

```html
<!-- Add to popup.html -->
<div id="testPanel" style="display: none;">
  <h3>🧪 Testing Panel</h3>
  <button onclick="testUniversalOnly()">Test Universal Only</button>
  <button onclick="testAIOnly()">Test AI Only</button>
  <button onclick="testBothMethods()">Test Both Methods</button>
  <div id="testResults"></div>
</div>
```

### **Tool 3: Extraction Comparison**

```javascript
// Compare both methods on same page
async function compareExtractionMethods() {
  console.log('🔄 Comparing Universal vs AI extraction...');
  
  // Test universal
  const universalResult = await tryUniversalExtraction();
  console.log('🔍 Universal Result:', universalResult);
  
  // Test AI (if API key available)
  const aiResult = await tryAIExtraction();
  console.log('🤖 AI Result:', aiResult);
  
  // Compare results
  console.log('📊 Comparison:', {
    universal: universalResult,
    ai: aiResult,
    titleMatch: universalResult?.title === aiResult?.title,
    priceMatch: universalResult?.price === aiResult?.price
  });
}
```

---

## 📊 **Expected Test Results**

### **Universal Extraction Success (90% of cases):**
```
✅ Amazon: Universal extraction successful (0.1s)
✅ Flipkart: Universal extraction successful (0.1s)  
✅ Myntra: Universal extraction successful (0.1s)
✅ ShopClues: Universal extraction successful (0.2s)
```

### **AI Fallback Success (Complex cases):**
```
⚠️ ComplexSite: Universal incomplete, trying AI...
✅ ComplexSite: AI extraction successful (3.2s)
```

### **Graceful Fallback (Error cases):**
```
❌ BrokenSite: Universal failed
❌ BrokenSite: AI failed (no API key)
✅ BrokenSite: Fallback extraction (basic info)
```

---

## 🎯 **Step-by-Step Testing Process**

### **Step 1: Reload Extension**
```bash
1. Go to chrome://extensions/
2. Click "Reload" on Picksy extension
3. Verify version shows "0.2.0"
```

### **Step 2: Test Universal Extraction**
```bash
1. Visit amazon.in/dp/B0CHWRXH8B
2. Open console (F12)
3. Open Picksy popup
4. Click "Scan This Page"
5. Check console for "Universal extraction successful"
6. Verify extractionMethod: "universal"
```

### **Step 3: Test AI Fallback**
```bash
1. Configure API key in popup
2. Visit a complex product page
3. Temporarily disable universal (modify code)
4. Scan page again
5. Check console for "AI extraction successful"
6. Verify extractionMethod: "ai"
```

### **Step 4: Test Error Handling**
```bash
1. Remove API key
2. Visit non-e-commerce site
3. Try scanning
4. Should get fallback result, not crash
```

### **Step 5: Test Full Comparison**
```bash
1. Visit any product page
2. Click "Compare Prices"
3. Watch console for extraction methods used
4. Verify mix of universal + AI results
```

---

## 🔍 **Debugging Tips**

### **If Universal Extraction Fails:**
```javascript
// Check these in console:
console.log('Title selectors found:', document.querySelectorAll('h1, [class*="title"]'));
console.log('Price selectors found:', document.querySelectorAll('[class*="price"]'));
console.log('Page HTML structure:', document.body.innerHTML.substring(0, 1000));
```

### **If AI Extraction Fails:**
```javascript
// Check these:
console.log('API Key configured:', !!Config.GEMINI_API_KEY);
console.log('HTML length:', document.body.innerHTML.length);
console.log('Network status:', navigator.onLine);
```

### **If Both Methods Fail:**
```javascript
// Check fallback:
console.log('Page title:', document.title);
console.log('Meta tags:', document.querySelectorAll('meta[property="og:title"]'));
console.log('Basic elements:', {
  h1: document.querySelector('h1')?.textContent,
  title: document.title
});
```

---

## ✅ **Success Criteria**

Your hybrid system is working correctly if:

- ✅ **Universal extraction succeeds** on 90%+ of standard e-commerce sites
- ✅ **AI fallback activates** when universal fails or has low confidence
- ✅ **Never crashes** - always returns some result
- ✅ **Performance is good** - Universal <1s, AI <5s
- ✅ **Confidence scores** are accurate (universal: 0.8+, AI: 0.7+)

---

## 🚀 **Ready to Test?**

1. **Start with Amazon/Flipkart** (should use universal)
2. **Try complex sites** (should trigger AI)
3. **Test error cases** (should handle gracefully)
4. **Monitor console output** for extraction methods
5. **Verify results quality** and performance

**Your hybrid system should intelligently choose the best extraction method for each situation!** 🎯✨