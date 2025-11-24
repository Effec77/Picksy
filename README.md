# 🛍️ Picksy - Smart Shopping Assistant

> Your personal price tracking and comparison tool for smarter online shopping

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/yourusername/picksy)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/chrome-extension-orange.svg)](https://chrome.google.com/webstore)

**🎉 v0.1.0 - Hardcoded Version Released!**

---

## 🆕 What's New in v0.1.0

### ✨ Core Features
- ✅ Product detection across 6 major e-commerce sites
- ✅ Price history tracking with beautiful SVG charts
- ✅ Background monitoring every 6 hours
- ✅ Smart notifications (price drops, stock alerts, target prices)
- ✅ Trust signals and AI-powered recommendations
- ✅ Multi-currency support (INR, USD, EUR, GBP, CAD)

### 🎨 UI/UX Improvements
- ✅ Modern gradient design with smooth animations
- ✅ Beautiful empty states with helpful guidance
- ✅ Service worker health monitoring
- ✅ Loading states and error handling
- ✅ Hover effects and visual feedback
- ✅ Responsive and performant

### 🐛 Bug Fixes
- ✅ Fixed history tab loading from saved items
- ✅ Resolved CSP violations
- ✅ Optimized performance (removed heavy animations)
- ✅ Fixed single data point display
- ✅ Improved chart rendering

---

## ✨ Features

### 🔍 **Universal Product Detection**
- Works across **Amazon**, **Flipkart**, **Myntra**, **Nike**, **Adidas**, **Puma**
- Smart extraction of product details, prices, and stock status
- Multi-currency support (INR, USD, EUR, GBP, CAD)
- Official brand website detection with trust badges

### 📊 **Price History Tracking**
- Automatic price monitoring every 6 hours
- Beautiful visual SVG charts showing price trends
- Track up to 50 historical data points per product
- Single data point handling with helpful guidance

### 🔔 **Smart Notifications**
- Price drop alerts with percentage change
- Stock availability notifications
- Target price alerts with progress tracking
- Clickable notifications to view products instantly

### 🎯 **Target Price Management**
- Set custom target prices for any product
- Visual progress bars showing how close you are
- Automatic notifications when target is reached
- Easy update or clear target prices

### 🔄 **Cross-Site Comparison**
- Intelligent keyword extraction
- One-click search on competitor sites
- Site-specific icons for easy identification
- Find the best deals across platforms

### 🏆 **Trust Signals & Recommendations**
- Product ratings and review counts
- Seller information and badges
- AI-powered buying recommendations
- Confidence scoring (0-100%)
- Official brand website detection

### ⚙️ **Customizable Settings**
- Toggle auto-scanning on/off
- Control notification preferences
- Manual background scan for testing
- Service worker health monitoring

## 🚀 Installation

### For Development/Testing:
1. **Download or clone** this repository:
   ```bash
   git clone https://github.com/yourusername/picksy.git
   cd picksy
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. **Enable "Developer mode"** (toggle in top-right corner)
4. Click **"Load unpacked"** button
5. Navigate to and select the `extension` folder from this project
6. **Pin Picksy** to your toolbar for easy access (click puzzle icon → pin)
7. **Grant permissions** when prompted (required for notifications and storage)

### For Users:
*Coming soon to Chrome Web Store!*

### First Time Setup:
1. Visit any product page on **Amazon**, **Flipkart**, **Myntra**, **Nike**, **Adidas**, or **Puma**
2. Click the Picksy icon in your toolbar
3. Click **"🔍 Scan This Page"** to extract product details
4. Click **"💾 Save"** to start tracking price history
5. Set a **target price** (optional) to get notified when reached
6. Enable notifications in **Settings** tab for automatic alerts
7. Check back regularly or let background scans do the work!

## 📖 How to Use

### Basic Usage:
1. **Visit any product page** on Amazon, Flipkart, or Myntra
2. **Click the Picksy icon** in your toolbar
3. **Click "Scan This Page"** to extract product details
4. **Save products** you want to track
5. **Get notified** automatically when prices drop!

### Advanced Features:
- **View History**: Click "View History" to see price trends over time
- **Compare Prices**: Use the "Compare" tab to search on other sites
- **Adjust Settings**: Configure auto-scan and notifications in Settings tab
- **Test Scan**: Manually trigger background price checks

## 🏗️ Architecture

```
Picksy/
├── extension/
│   ├── manifest.json          # Extension configuration
│   ├── assets/                # Icons and images
│   ├── src/
│   │   ├── background/
│   │   │   └── background.js  # Background service worker
│   │   ├── content/
│   │   │   └── content.js     # Content script for scraping
│   │   └── popup/
│   │       ├── popup.html     # Extension popup UI
│   │       └── popup.js       # Popup logic
│   └── utils/
│       └── normalize.js       # Data normalization utilities
├── TESTING_GUIDE.md          # Comprehensive testing guide
└── README.md                 # This file
```

## 🛠️ Technology Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Browser API**: Chrome Extensions Manifest V3
- **Storage**: Chrome Local Storage
- **Notifications**: Chrome Notifications API
- **Background Tasks**: Chrome Alarms API

## 📚 Documentation

- **[Testing Guide](docs/TESTING_GUIDE.md)** - Comprehensive testing instructions
- **[Changelog](docs/CHANGELOG.md)** - Version history and updates
- **[How Notifications Work](docs/HOW_NOTIFICATIONS_WORK.md)** - Notification system details
- **[Automatic Price Comparison Plan](docs/AUTOMATIC_PRICE_COMPARISON_PLAN.md)** - Future feature roadmap

## 🧪 Testing

See [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) for comprehensive testing instructions.

Quick test:
1. Save 2-3 products
2. Go to Settings tab
3. Click "Test Background Scan Now"
4. Check background console for logs

## 🔮 Roadmap

### Phase 1: Hardcoded Version ✅ (Current - v0.1.0)
- [x] Product detection and extraction (6 major sites)
- [x] Price history tracking with visual charts
- [x] Background monitoring (every 6 hours)
- [x] Smart notifications (price drops, stock alerts, target prices)
- [x] Trust signals (ratings, reviews, badges)
- [x] Settings UI with manual controls
- [x] Error handling and user feedback
- [x] Multi-currency support

### Phase 2: Automatic Price Comparison 🚧 (Next - 5 days)
- [ ] Tab-based parallel scraping across 3-5 sites
- [ ] Product matching algorithm with confidence scoring
- [ ] Side-by-side comparison table UI
- [ ] "Best Deal" recommendations
- [ ] 6-hour cache system
- [ ] Whitelist of trusted comparison sites

### Phase 3: AI-Based Extraction 🤖 (2-3 weeks)
- [ ] AI-powered price extraction (works on ANY site)
- [ ] GPT-4 Vision or similar for universal scraping
- [ ] Automatic adaptation to site changes
- [ ] 95%+ accuracy across all e-commerce sites
- [ ] Fallback to hardcoded logic if AI fails
- [ ] Cost optimization (~$5-20/month)

### Phase 4: AI Recommendations & Coupons 🎯 (Future)
- [ ] AI-powered product recommendations
- [ ] Automatic coupon code finding
- [ ] Deal scoring and predictions
- [ ] Review summarization (NLP)
- [ ] Fake product detection
- [ ] Price prediction ML model

### Phase 5: Expansion 🌍 (Future)
- [ ] Backend API (Node.js + MongoDB)
- [ ] User accounts and cloud sync
- [ ] Firefox support
- [ ] Mobile app (React Native)
- [ ] International markets
- [ ] Email notifications

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT License - feel free to use this project for learning or commercial purposes.

## 🐛 Known Issues & Limitations

### Service Worker Behavior (Manifest V3)
- **Background service worker goes inactive** after ~30 seconds of inactivity (Chrome limitation)
- If you see "Extension Service Inactive" warning, click the **"Reload Extension"** button
- This is normal Chrome behavior and doesn't affect scheduled scans
- Manual reload: Go to `chrome://extensions` and click the refresh icon

### Site-Specific Issues
- **Puma**: Price extraction may occasionally pick incorrect prices (working on fix)
- Some sites with heavy JavaScript may need page refresh before scanning
- Dynamic pricing sites may show different prices on different scans

### General Limitations
- Background scanning takes 1-2 minutes for multiple products (intentional delay to avoid rate limiting)
- Only works on supported e-commerce sites (Amazon, Flipkart, Myntra, Nike, Adidas, Puma)
- Requires Chrome notification permissions for price alerts
- Price history limited to last 50 data points per product

## 💡 Tips & Best Practices

- **Save products regularly** to build comprehensive price history
- **Enable notifications** to never miss a deal
- **Set target prices** for products you're waiting to buy
- **Check Settings tab** to see when next scan will run
- **Use Test Scan** to immediately check all saved products
- **Reload extension** if you see "Service Inactive" warning (chrome://extensions)
- **Scan products multiple times** to see price trends in History tab
- **Use Comparison tab** to quickly search other sites for better deals

## 🎯 Supported Websites

| Site | Product Detection | Price Tracking | Stock Detection | Trust Signals |
|------|------------------|----------------|-----------------|---------------|
| Amazon India | ✅ | ✅ | ✅ | ✅ |
| Flipkart | ✅ | ✅ | ✅ | ✅ |
| Myntra | ✅ | ✅ | ✅ | ✅ |
| Nike (Official) | ✅ | ✅ | ✅ | ✅ |
| Adidas (Official) | ✅ | ✅ | ✅ | ✅ |
| Puma (Official) | ⚠️ | ✅ | ⚠️ | ✅ |

**Legend**: ✅ Fully Working | ⚠️ Partial Support | ❌ Not Supported

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

**Made with ❤️ for smart shoppers everywhere**

*Happy Shopping! 🛒*
