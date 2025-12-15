# ⚡ Quick Test - 5 Minutes

**Fastest way to check if everything works**

---

## 🎯 Option 1: Browser Test (Easiest)

### **Steps:**
1. Open `extension/utils/test.html` in Chrome
2. Enter your API key (starts with AIza...)
3. Click all 5 test buttons
4. All should show ✅ green

**Time:** 2 minutes

---

## 🎯 Option 2: Extension Test (Real Test)

### **Steps:**

1. **Load Extension:**
   ```
   Chrome → chrome://extensions
   → Enable "Developer mode"
   → "Load unpacked"
   → Select your extension folder
   ```

2. **Open Background Console:**
   ```
   Find Picksy extension
   → Click "service worker"
   → Console opens
   ```

3. **Test Single Scrape:**
   ```javascript
   testScrape('https://www.amazon.in/dp/B0CHX1W1XY')
     .then(r => console.log('✅ Works!', r))
     .catch(e => console.error('❌ Failed:', e));
   ```

4. **Watch for:**
   - Tab opens in background (might flash briefly)
   - Tab closes automatically
   - Console shows product data
   - Confidence > 0.75

**Time:** 3 minutes

---

## ✅ Success Indicators

**It's working if you see:**
- ✅ "✅ Works!" in console
- ✅ Product title extracted
- ✅ Price extracted
- ✅ Confidence score > 0.75
- ✅ No errors

**Example output:**
```javascript
{
  title: "iPhone 15 Pro 128GB",
  price: 48990,
  currency: "INR",
  stock: "in_stock",
  confidence: 0.95,
  siteName: "Test Site"
}
```

---

## 🎯 Option 3: Full Comparison Test

### **In background console, run:**
```javascript
scrapeComparison('iPhone 15 Pro 128GB', {
  maxSites: 3,
  maxConcurrent: 2
}).then(r => {
  console.log('✅ Success:', r.successCount, 'sites');
  console.log('Results:', r.results);
});
```

**Expected:**
- 3 tabs open/close automatically
- Takes 15-30 seconds
- Shows 2-3 successful results

---

## 🐛 Quick Troubleshooting

**Error: "API key not configured"**
→ Check `extension/config/config.js` line 8

**Error: "Gemini API error"**
→ Check API key is valid at https://makersuite.google.com/app/apikey

**Error: "Tab creation failed"**
→ Reload extension at chrome://extensions

**Error: "Extraction timeout"**
→ Normal for slow sites, try different URL

---

## 📊 Quick Checklist

- [ ] API key added to config.js
- [ ] Extension loaded in Chrome
- [ ] No errors in chrome://extensions
- [ ] Background console opens
- [ ] testScrape() works
- [ ] Confidence > 0.75
- [ ] Tabs close automatically

**All checked?** 🎉 **You're ready to go!**

---

**Made with ⚡ for quick testing**

*Time: 5 minutes*
