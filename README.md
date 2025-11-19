# 🛍️ Picksy - Smart Shopping Assistant

> Your personal price tracking and comparison tool for smarter online shopping

## ✨ Features

### 🔍 **Universal Product Detection**
- Works across **Amazon**, **Flipkart**, **Myntra**, and more
- Smart extraction of product details, prices, and stock status
- Multi-currency support (INR, USD, EUR, GBP)

### 📊 **Price History Tracking**
- Automatic price monitoring every 6 hours
- Beautiful visual charts showing price trends
- Track up to 50 historical data points per product

### 🔔 **Smart Notifications**
- Get alerted when prices drop
- Stock availability notifications
- Clickable notifications to view products instantly

### 🔄 **Cross-Site Comparison**
- Intelligent keyword extraction
- One-click search on competitor sites
- Find the best deals across platforms

### ⚙️ **Customizable Settings**
- Toggle auto-scanning on/off
- Control notification preferences
- Manual background scan for testing

## 🚀 Installation

### For Development:
1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `extension` folder
6. Pin Picksy to your toolbar

### For Users:
*Coming soon to Chrome Web Store!*

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

## 🧪 Testing

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for comprehensive testing instructions.

Quick test:
1. Save 2-3 products
2. Go to Settings tab
3. Click "Test Background Scan Now"
4. Check background console for logs

## 🔮 Roadmap

### Phase 1: Core Features ✅
- [x] Product detection and extraction
- [x] Price history tracking
- [x] Background monitoring
- [x] Notifications
- [x] Settings UI

### Phase 2: Enhanced Features 🚧
- [ ] Backend API (Node.js + MongoDB)
- [ ] User accounts and cloud sync
- [ ] Advanced price predictions
- [ ] Email notifications
- [ ] Export/import data

### Phase 3: AI Features 🔮
- [ ] Review summarization (NLP)
- [ ] Fake product detection
- [ ] Smart recommendations
- [ ] Price prediction ML model

### Phase 4: Expansion 🌍
- [ ] Firefox support
- [ ] Mobile app (React Native)
- [ ] More e-commerce sites
- [ ] International markets

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT License - feel free to use this project for learning or commercial purposes.

## 🐛 Known Issues

- Background scanning may take 1-2 minutes for multiple products (by design)
- Some dynamic pricing sites may require page refresh
- Notifications require Chrome notification permissions

## 💡 Tips

- **Save products regularly** to build comprehensive price history
- **Enable notifications** to never miss a deal
- **Check Settings tab** to see when next scan will run
- **Use Test Scan** to immediately check all saved products

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

**Made with ❤️ for smart shoppers everywhere**

*Happy Shopping! 🛒*
