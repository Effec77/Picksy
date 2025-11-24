# 🔔 How Picksy Notifications Work

## Overview

Picksy automatically monitors your saved products and notifies you when prices drop or items come back in stock.

## 📊 The Complete Flow

### **1. Initial Setup (You Save a Product)**

```
User Action:
├─ Visit Amazon product page (iPhone 15 Pro - ₹50,000)
├─ Click Picksy icon
├─ Click "Scan This Page"
└─ Click "Save Item"

What Happens:
├─ Product saved to Chrome storage
├─ Initial price recorded: ₹50,000
├─ History entry created with timestamp
└─ Background monitoring begins
```

### **2. Background Monitoring (Every 6 Hours)**

```
⏰ Alarm Fires (Every 6 hours)
│
├─ Check if auto-scan is enabled ✓
├─ Get all saved products (e.g., 3 products)
│
└─ Start Sequential Scraping:
    │
    ├─ Product 1: iPhone 15 Pro
    │   ├─ Open invisible tab → amazon.in/iphone-15-pro
    │   ├─ Wait 6 seconds for page load
    │   ├─ Inject content script
    │   ├─ Extract current price: ₹48,000 ← PRICE DROPPED!
    │   ├─ Close tab
    │   └─ Compare with history
    │
    ├─ Product 2: Samsung Galaxy S24
    │   ├─ Open invisible tab → flipkart.com/samsung-s24
    │   ├─ Extract price: ₹75,000 (no change)
    │   └─ Close tab
    │
    └─ Product 3: MacBook Pro
        ├─ Open invisible tab → amazon.in/macbook-pro
        ├─ Extract price: ₹1,20,000 (no change)
        └─ Close tab
```

### **3. Price Comparison Logic**

```javascript
// In background.js - saveToHistory function

// Get last recorded price
const lastEntry = existingProduct.history[history.length - 1];
// lastEntry.price = ₹50,000 (from yesterday)

// Get current price
const historyEntry = {
  price: payload.priceValue, // ₹48,000 (today)
  stock: true,
  timestamp: Date.now()
};

// Compare prices
if (historyEntry.price < lastEntry.price) {
  // ₹48,000 < ₹50,000 → TRUE!
  
  // Calculate drop
  const priceDrop = 50000 - 48000 = ₹2,000
  const percentDrop = (2000 / 50000) * 100 = 4.0%
  
  // TRIGGER NOTIFICATION! 🔔
}
```

### **4. Notification Conditions**

The notification will ONLY appear if **ALL** these conditions are met:

```javascript
✅ fromAuto === true           // Must be from background scan (not manual)
✅ settings.priceAlerts === true  // User has notifications enabled
✅ lastEntry exists             // Product has previous price history
✅ historyEntry.price !== null  // Current price was successfully extracted
✅ lastEntry.price !== null     // Previous price exists
✅ historyEntry.price < lastEntry.price  // Current price is LOWER
```

**Why these conditions?**
- `fromAuto`: Prevents spam when you manually scan
- `priceAlerts`: Respects user's notification preferences
- `null` checks: Ensures valid price data
- Price comparison: Only notifies on actual drops

### **5. Notification Creation**

```javascript
chrome.notifications.create({
  type: "basic",
  iconUrl: "assets/logo.png",
  title: "🎉 Picksy Price Drop Alert!",
  message: "iPhone 15 Pro dropped by ₹2,000 (4.0%)",
  buttons: [
    { title: "View Product" },
    { title: "Dismiss" }
  ],
  requireInteraction: true  // Stays visible until clicked
}, (notificationId) => {
  // Store product URL for click handling
  chrome.storage.local.set({ 
    [`notification_${notificationId}`]: "https://amazon.in/iphone-15-pro" 
  });
});
```

### **6. User Interaction**

```
Notification Appears:
┌─────────────────────────────────────┐
│ 🎉 Picksy Price Drop Alert!        │
│                                     │
│ iPhone 15 Pro dropped by ₹2,000    │
│ (4.0%)                              │
│                                     │
│ [View Product]  [Dismiss]           │
└─────────────────────────────────────┘

User Actions:
├─ Click "View Product" → Opens Amazon page in new tab
├─ Click "Dismiss" → Closes notification
└─ Click notification body → Opens Amazon page in new tab
```

## 🎯 Real-World Example

### **Scenario: Tracking iPhone 15 Pro**

**Day 1 (Monday 9 AM):**
```
You save iPhone 15 Pro
Price: ₹50,000
Status: In Stock
```

**Day 1 (Monday 3 PM) - First Auto-Scan:**
```
Background scan runs
Current price: ₹50,000
Result: No change → No notification
```

**Day 1 (Monday 9 PM) - Second Auto-Scan:**
```
Background scan runs
Current price: ₹50,000
Result: No change → No notification
```

**Day 2 (Tuesday 3 AM) - Third Auto-Scan:**
```
Background scan runs
Current price: ₹48,500
Result: Price dropped by ₹1,500 (3.0%)
Action: 🔔 NOTIFICATION SENT!
```

**Day 2 (Tuesday 9 AM) - Fourth Auto-Scan:**
```
Background scan runs
Current price: ₹48,500
Result: No change from last scan → No notification
```

**Day 2 (Tuesday 3 PM) - Fifth Auto-Scan:**
```
Background scan runs
Current price: ₹47,000
Result: Price dropped by ₹1,500 (3.1%)
Action: 🔔 NOTIFICATION SENT AGAIN!
```

## 📱 Notification Types

### **1. Price Drop Alert**
```
Trigger: Current price < Previous price
Title: "🎉 Picksy Price Drop Alert!"
Message: "Product Name dropped by ₹X (Y%)"
Buttons: [View Product] [Dismiss]
```

### **2. Stock Alert**
```
Trigger: Previous stock = false, Current stock = true
Title: "📦 Product Back in Stock!"
Message: "Product Name is now available"
Buttons: [View Product] [Dismiss]
```

## ⚙️ User Controls

### **Enable/Disable Notifications:**

1. Open Picksy popup
2. Go to Settings tab
3. Toggle "🔔 Price Drop Notifications"
4. Toggle "📦 Stock Alerts"

### **Disable Auto-Scanning:**

1. Go to Settings tab
2. Toggle "🔄 Auto Price Checking" OFF
3. No more background scans = No notifications

## 🧪 Testing Notifications

### **Method 1: Wait for Real Price Drop**
- Save products
- Wait 6 hours
- Hope prices drop naturally

### **Method 2: Manual Testing (Recommended)**

1. **Open Background Console:**
   - Go to `chrome://extensions/`
   - Find Picksy
   - Click "Inspect views: background page"

2. **Manually Trigger Notification:**
   ```javascript
   // In background console, paste this:
   saveToHistory({
     title: "Test iPhone 15 Pro",
     priceValue: 45000,  // Lower than original
     url: "https://amazon.in/test",
     currency: "INR",
     availability: "InStock",
     source: "amazon.in"
   }, true);  // true = fromAuto flag
   ```

3. **Notification Should Appear!**

### **Method 3: Trigger Early Alarm**

```javascript
// In background console:
chrome.alarms.create("picksyAutoCheck", { 
  when: Date.now() + 60000  // 1 minute from now
});

// Wait 1 minute, background scan will run
// If prices dropped, you'll get notified
```

## 🔍 Debugging Notifications

### **Check if Notifications are Enabled:**

```javascript
// In background console:
chrome.storage.local.get(['picksySettings'], (result) => {
  console.log('Settings:', result.picksySettings);
  // Should show: { priceAlerts: true, autoScanEnabled: true }
});
```

### **Check Price History:**

```javascript
// In background console:
chrome.storage.local.get(null, (items) => {
  Object.keys(items).forEach(key => {
    if (key.startsWith('history_')) {
      console.log(key, items[key]);
    }
  });
});
```

### **Check Last Scan Time:**

```javascript
// In background console:
chrome.storage.local.get(['lastBackgroundScan'], (result) => {
  const lastScan = new Date(result.lastBackgroundScan);
  console.log('Last scan:', lastScan.toLocaleString());
});
```

## ❓ Common Questions

### **Q: How often do notifications appear?**
A: Only when prices actually drop. If price stays same, no notification.

### **Q: Will I get spammed with notifications?**
A: No! Notifications only appear when:
- Background scan runs (every 6 hours)
- Price is lower than last recorded price
- You have notifications enabled

### **Q: Can I get notifications more frequently?**
A: Currently set to 6 hours. You can change this in background.js:
```javascript
chrome.alarms.create("picksyAutoCheck", { 
  periodInMinutes: 360  // Change to 60 for hourly
});
```

### **Q: What if I miss a notification?**
A: Check the History tab in Picksy popup to see all price changes.

### **Q: Do notifications work when browser is closed?**
A: Yes! Chrome keeps extensions running in background. Notifications will appear when you next open Chrome.

### **Q: Can I get email notifications?**
A: Not yet! This is planned for Phase 2 (Backend API).

## 🎯 Summary

**Notifications appear when:**
1. ✅ Background scan runs (every 6 hours)
2. ✅ Product price is lower than last scan
3. ✅ Notifications are enabled in Settings
4. ✅ Valid price data exists

**Notifications DON'T appear when:**
1. ❌ You manually scan (prevents spam)
2. ❌ Price stays the same
3. ❌ Price increases
4. ❌ Notifications disabled in Settings
5. ❌ Auto-scan is disabled

---

**The system is designed to be smart and non-intrusive - you only get notified when there's actually a good deal!** 🎉
