# Picksy Price Tracker Extension

A lightweight, legal, and ethical browser extension for tracking product prices across major retailers.

## Features

- **Legal Compliance**: Uses official retailer APIs where available, respectful scraping as fallback
- **Fast Performance**: 2-second initialization, non-blocking operations
- **Privacy-First**: Minimal permissions, secure data handling
- **Simple UI**: Clean interface focused on essential price tracking features
- **Automatic Reconnection**: Robust service worker with automatic recovery

## Supported Retailers

- Amazon
- eBay
- Walmart
- Target
- Best Buy

## Installation

1. Build the extension:
   ```bash
   npm install
   npm run build
   ```

2. Load in Chrome:
   - Open Chrome Extensions (chrome://extensions/)
   - Enable Developer mode
   - Click "Load unpacked" and select the `dist` folder

## Architecture

### Components

- **Popup Interface**: Clean, responsive UI for product management
- **Content Scripts**: Fast product detection on supported sites
- **Background Service Worker**: Price monitoring and notifications
- **Storage Management**: Efficient local storage with caching

### Performance Optimizations

- **Fast Initialization**: Meets 2-second startup requirement
- **Non-blocking Operations**: Parallel processing for multiple products
- **Automatic Reconnection**: Service worker recovery from inactivity
- **Efficient Caching**: Smart storage management with debounced saves

## Development

```bash
# Install dependencies
npm install

# Build for development
npm run build

# Watch mode for development
npm run build:watch

# Run tests
npm test

# Lint code
npm run lint

# Package for distribution
npm run package
```

## Legal Compliance

This extension is designed with legal compliance as a priority:

- Uses official retailer APIs where available
- Implements respectful rate limiting for web scraping
- Respects robots.txt and Terms of Service
- Provides proper attribution for external data
- Minimizes data collection and storage

## Privacy

- Requests only essential browser permissions
- Stores data locally on user's device
- No tracking or analytics
- Clear data deletion capabilities
- Transparent about data usage

## Requirements Validation

This extension validates the following requirements:

- **3.2**: Minimal browser permissions (storage, notifications, activeTab)
- **5.1**: Simple onboarding focused on core features
- **5.2**: Essential information only for product tracking
- **5.3**: Clean product display with price, availability, trust indicators
- **5.4**: Simple price comparison without AI complexity
- **5.5**: Intuitive product management controls
- **6.1**: 2-second initialization requirement
- **6.2**: Non-blocking multi-product operations
- **6.4**: Automatic service worker reconnection