# 🧪 Picksy Testing Guide

## Quick Start Testing

### 1. Load the Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. Pin the Picksy extension to toolbar

### 2. Test Basic Functionality

#### ✅ Product Scanning
1. Go to any Amazon/Flipkart/Myntra product page
2. Click Picksy icon
3. Click "🔍 Scan This Page"
4. **Expected:** Product details appear in "Current" tab
5. **Check:** Title, price, stock status are correct

#### ✅ Save Product
1. After scanning, click "💾 Save Item"
2. Scroll down to "Saved Items" section
3. **Expected:** Product appears in saved list
4. **Check:** Can delete saved items

#### ✅ Price History
1. Scan a product multiple times (change price manually if testing)
2. Click "📊 View History" button
3. Switch to "History" tab
4. **Expected:** Chart shows price points
5. **Check:** Price trends and statistics display

#### ✅ Cross-Site Comparison
1. Scan a product
2. Switch to "Compare" tab
3. **Expected:** Links to search on other sites
4. **Check:** Clicking links opens correct searches

### 3. Test Settings Tab

#### ✅ Settings UI
1. Click Picksy icon
2. Switch to "Settings" tab
3. **Expected:** See all settings options
4. **Check:** 
   - Auto Price Checking toggle
   - Price Drop Notifications toggle
   - Stock Alerts toggle
   - Test Background Scan button
   - Scan information displays

#### ✅ Toggle Settings
1. Toggle "Auto Price Checking" off
2. **Expected:** Toast notification appears
3. Toggle back on
4. **Expected:** Another toast notification
5. **Check:** Settings persist after closing popup

### 4. Test Background Scanning

#### ✅ Manual Background Scan
1. Save 2-3 products from different sites
2. Go to Settings tab
3. Click "🧪 Test Background Scan Now"
4. **Expected:** 
   - Button shows "⏳ Scanning..."
   - Toast shows "✅ Scanning X products..."
5. Open background page console:
   - Right-click Picksy in extensions
   - Click "Inspect views: background page"
6. **Check Console Logs:**
   ```
   📡 [1/3] Scraping: Product Name...
   🗑️ Closed tab for: Product Name...
   📡 [2/3] Scraping: Product Name...
   ✅ Background scraping complete. Updated 3 products
   ```

#### ✅ Verify History Updates
1. After background scan completes
2. Open any saved product page
3. Scan it manually
4. Go to History tab
5. **Expected:** Multiple data points in chart
6. **Check:** Timestamps are different

### 5. Test Notifications

#### ✅ Price Drop Alert (Manual Test)
1. Save a product
2. Open background page console
3. Manually trigger with lower price:
   ```javascript
   // In background console
   saveToHistory({
     title: "Test Product",
     priceValue: 1000, // Lower than original
     url: "https://amazon.in/test",
     currency: "INR",
     availability: "InStock",
     source: "amazon.in"
   }, true); // true = fromAuto flag
   ```
4. **Expected:** Notification appears
5. **Check:** 
   - Shows price drop amount
   - Shows percentage
   - "View Product" button works
   - Clicking notification opens product

#### ✅ Stock Alert (Manual Test)
1. Similar to above but change stock status
2. **Expected:** "📦 Product Back in Stock!" notification

### 6. Test Auto-Scan Alarm

#### ✅ Trigger 6-Hour Alarm Early
1. Open background page console
2. Create immediate alarm:
   ```javascript
   chrome.alarms.create("picksyAutoCheck", { 
     when: Date.now() + 60000 // 1 minute from now
   });
   ```
3. Wait 1 minute
4. **Expected:** Background scan starts automatically
5. **Check:** Console shows scraping progress

#### ✅ Verify Alarm Info in Settings
1. After alarm fires
2. Open Settings tab
3. **Check:**
   - "Last scan" shows recent time
   - "Next scan" shows countdown
   - "Saved products" count is correct

### 7. Test Currency Conversion

#### ✅ Currency Toggle
1. Scan a product (shows in INR)
2. Click "$ USD" button
3. **Expected:** Price converts to USD
4. Try other currencies (EUR, GBP)
5. **Check:** Conversion rates are reasonable

### 8. Test Edge Cases

#### ✅ No Products Saved
1. Delete all saved products
2. Click "Test Background Scan"
3. **Expected:** Toast shows "No saved products"

#### ✅ Invalid Product Page
1. Go to non-product page (e.g., homepage)
2. Click "Scan This Page"
3. **Expected:** Handles gracefully (no crash)

#### ✅ Network Error
1. Disconnect internet
2. Try background scan
3. **Expected:** Error logs but doesn't crash

### 9. Performance Testing

#### ✅ Multiple Products
1. Save 10+ products
2. Run background scan
3. **Check:**
   - All tabs open/close properly
   - No memory leaks
   - Completes within reasonable time (~2 minutes)

#### ✅ Storage Limits
1. Save 50+ products
2. **Check:** Extension still responsive

### 10. Browser Compatibility

#### ✅ Chrome
- Test all features
- Check console for errors

#### ✅ Edge
- Load extension
- Test basic functionality

## Common Issues & Solutions

### Issue: Content script not injecting
**Solution:** Reload extension and refresh product page

### Issue: Background scan not working
**Solution:** 
1. Check background console for errors
2. Verify content script is loaded
3. Check permissions in manifest

### Issue: Notifications not appearing
**Solution:**
1. Check Chrome notification settings
2. Verify `priceAlerts` setting is enabled
3. Check background console for errors

### Issue: History chart not showing
**Solution:**
1. Scan product multiple times
2. Check storage for history data
3. Verify priceChart element exists

## Success Criteria

✅ All product scans work correctly
✅ Background scanning completes without errors
✅ Notifications appear and are clickable
✅ Settings persist across sessions
✅ History charts display properly
✅ Cross-site comparison links work
✅ No console errors in normal operation
✅ Extension doesn't slow down browser

## Next Steps After Testing

1. Fix any bugs found
2. Improve error messages
3. Add loading indicators
4. Polish UI/UX
5. Prepare for Chrome Web Store submission

---

**Happy Testing! 🚀**
