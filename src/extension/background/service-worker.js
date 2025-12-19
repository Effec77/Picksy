// Background service worker for Picksy Price Tracker
class BackgroundService {
    constructor() {
        this.apiBaseUrl = 'https://api.picksy.com';
        this.priceCheckInterval = 30 * 60 * 1000; // 30 minutes
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        
        this.initialize();
    }

    initialize() {
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize price monitoring
        this.initializePriceMonitoring();
        
        // Set up periodic tasks
        this.setupPeriodicTasks();
    }

    setupEventListeners() {
        // Extension installation/startup
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstallation(details);
        });

        // Extension startup
        chrome.runtime.onStartup.addListener(() => {
            this.handleStartup();
        });

        // Message handling
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Alarm handling for periodic tasks
        chrome.alarms.onAlarm.addListener((alarm) => {
            this.handleAlarm(alarm);
        });

        // Tab updates for product detection
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });
    }

    async handleInstallation(details) {
        console.log('Extension installed:', details.reason);
        
        if (details.reason === 'install') {
            // First-time installation
            await this.initializeStorage();
            this.showWelcomeNotification();
        } else if (details.reason === 'update') {
            // Extension update
            await this.migrateData(details.previousVersion);
        }
    }

    async handleStartup() {
        console.log('Extension started');
        this.reconnectAttempts = 0;
        await this.resumePriceMonitoring();
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'trackProduct':
                    const result = await this.trackProduct(request.product);
                    sendResponse({ success: true, result });
                    break;
                    
                case 'untrackProduct':
                    await this.untrackProduct(request.productId);
                    sendResponse({ success: true });
                    break;
                    
                case 'getPriceHistory':
                    const history = await this.getPriceHistory(request.productId);
                    sendResponse({ success: true, history });
                    break;
                    
                case 'checkPrices':
                    await this.checkAllPrices();
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Message handling error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async handleAlarm(alarm) {
        switch (alarm.name) {
            case 'priceCheck':
                await this.checkAllPrices();
                break;
                
            case 'reconnect':
                await this.attemptReconnection();
                break;
                
            case 'cleanup':
                await this.performCleanup();
                break;
                
            case 'inactivityCheck':
                await this.checkInactivity();
                break;
        }
    }

    async checkInactivity() {
        const inactivityThreshold = 5 * 60 * 1000; // 5 minutes
        const timeSinceLastActivity = Date.now() - (this.lastActivity || 0);
        
        if (timeSinceLastActivity > inactivityThreshold) {
            await this.handleServiceWorkerInactivity();
        }
    }

    async handleTabUpdate(tabId, changeInfo, tab) {
        // Only process completed page loads
        if (changeInfo.status !== 'complete' || !tab.url) return;
        
        // Check if it's a supported shopping site
        if (this.isSupportedSite(tab.url)) {
            // Inject content script if needed
            try {
                await chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['content/content-script.js']
                });
            } catch (error) {
                // Content script might already be injected
                console.log('Content script injection skipped:', error.message);
            }
        }
    }

    async initializeStorage() {
        const defaultData = {
            trackedProducts: [],
            priceHistory: {},
            settings: {
                checkInterval: 30, // minutes
                notifications: true,
                priceThreshold: 5 // percentage
            },
            lastPriceCheck: null
        };
        
        await chrome.storage.local.set(defaultData);
    }

    async initializePriceMonitoring() {
        // Set up recurring price checks
        chrome.alarms.create('priceCheck', {
            delayInMinutes: 1,
            periodInMinutes: 30
        });
        
        // Set up daily cleanup
        chrome.alarms.create('cleanup', {
            delayInMinutes: 60,
            periodInMinutes: 24 * 60 // 24 hours
        });
    }

    async setupPeriodicTasks() {
        // Check if we need to resume monitoring after service worker restart
        const { lastPriceCheck } = await chrome.storage.local.get(['lastPriceCheck']);
        
        if (!lastPriceCheck || Date.now() - new Date(lastPriceCheck).getTime() > this.priceCheckInterval) {
            // Trigger immediate price check if it's been too long
            setTimeout(() => this.checkAllPrices(), 5000);
        }
    }

    async trackProduct(product) {
        try {
            const { trackedProducts = [] } = await chrome.storage.local.get(['trackedProducts']);
            
            // Check if product is already tracked
            const existingIndex = trackedProducts.findIndex(p => p.url === product.url);
            
            if (existingIndex >= 0) {
                // Update existing product
                trackedProducts[existingIndex] = {
                    ...trackedProducts[existingIndex],
                    ...product,
                    updatedAt: new Date().toISOString()
                };
            } else {
                // Add new product
                const trackedProduct = {
                    id: this.generateId(),
                    ...product,
                    addedAt: new Date().toISOString(),
                    isActive: true
                };
                trackedProducts.push(trackedProduct);
            }
            
            await chrome.storage.local.set({ trackedProducts });
            
            // Show notification
            this.showNotification('Product Tracked', `Now tracking: ${product.title}`);
            
            return { id: trackedProducts[trackedProducts.length - 1].id };
        } catch (error) {
            console.error('Failed to track product:', error);
            throw error;
        }
    }

    async untrackProduct(productId) {
        try {
            const { trackedProducts = [] } = await chrome.storage.local.get(['trackedProducts']);
            const updatedProducts = trackedProducts.filter(p => p.id !== productId);
            
            await chrome.storage.local.set({ trackedProducts: updatedProducts });
        } catch (error) {
            console.error('Failed to untrack product:', error);
            throw error;
        }
    }

    async checkAllPrices() {
        try {
            console.log('Checking prices for all tracked products...');
            
            const { trackedProducts = [] } = await chrome.storage.local.get(['trackedProducts']);
            const activeProducts = trackedProducts.filter(p => p.isActive);
            
            if (activeProducts.length === 0) {
                console.log('No active products to check');
                return;
            }
            
            // Process products in batches to avoid overwhelming sites
            const batchSize = 3;
            for (let i = 0; i < activeProducts.length; i += batchSize) {
                const batch = activeProducts.slice(i, i + batchSize);
                await Promise.all(batch.map(product => this.checkProductPrice(product)));
                
                // Wait between batches to be respectful
                if (i + batchSize < activeProducts.length) {
                    await this.delay(2000);
                }
            }
            
            // Update last check time
            await chrome.storage.local.set({ lastPriceCheck: new Date().toISOString() });
            
        } catch (error) {
            console.error('Price check failed:', error);
        }
    }

    async checkProductPrice(product) {
        try {
            // In a real implementation, this would call the API gateway
            // For now, we'll simulate price checking
            const newPrice = await this.simulatePriceCheck(product);
            
            if (newPrice && newPrice !== product.price) {
                await this.handlePriceChange(product, newPrice);
            }
        } catch (error) {
            console.error(`Failed to check price for ${product.title}:`, error);
        }
    }

    async simulatePriceCheck(product) {
        // Simulate API call delay
        await this.delay(1000);
        
        // Simulate price fluctuation (±10%)
        const basePrice = product.price || 99.99;
        const variation = (Math.random() - 0.5) * 0.2; // ±10%
        const newPrice = basePrice * (1 + variation);
        
        return Math.round(newPrice * 100) / 100;
    }

    async handlePriceChange(product, newPrice) {
        const oldPrice = product.price;
        const priceChange = ((newPrice - oldPrice) / oldPrice) * 100;
        
        // Update product price
        const { trackedProducts = [] } = await chrome.storage.local.get(['trackedProducts']);
        const productIndex = trackedProducts.findIndex(p => p.id === product.id);
        
        if (productIndex >= 0) {
            trackedProducts[productIndex].price = newPrice;
            trackedProducts[productIndex].lastChecked = new Date().toISOString();
            await chrome.storage.local.set({ trackedProducts });
        }
        
        // Store price history
        await this.storePriceHistory(product.id, newPrice);
        
        // Check if notification should be sent
        const { settings } = await chrome.storage.local.get(['settings']);
        const threshold = settings?.priceThreshold || 5;
        
        if (Math.abs(priceChange) >= threshold) {
            const direction = priceChange < 0 ? 'dropped' : 'increased';
            const message = `Price ${direction} by ${Math.abs(priceChange).toFixed(1)}%: $${newPrice}`;
            
            this.showNotification(product.title, message);
        }
    }

    async storePriceHistory(productId, price) {
        try {
            const { priceHistory = {} } = await chrome.storage.local.get(['priceHistory']);
            
            if (!priceHistory[productId]) {
                priceHistory[productId] = [];
            }
            
            priceHistory[productId].push({
                price,
                timestamp: new Date().toISOString()
            });
            
            // Keep only last 100 price points
            if (priceHistory[productId].length > 100) {
                priceHistory[productId] = priceHistory[productId].slice(-100);
            }
            
            await chrome.storage.local.set({ priceHistory });
        } catch (error) {
            console.error('Failed to store price history:', error);
        }
    }

    async getPriceHistory(productId) {
        try {
            const { priceHistory = {} } = await chrome.storage.local.get(['priceHistory']);
            return priceHistory[productId] || [];
        } catch (error) {
            console.error('Failed to get price history:', error);
            return [];
        }
    }

    async resumePriceMonitoring() {
        // Resume monitoring after service worker restart
        console.log('Resuming price monitoring...');
        
        try {
            // Check if alarms are still active with timeout
            const alarmsPromise = chrome.alarms.getAll();
            const alarms = await Promise.race([
                alarmsPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Alarms timeout')), 1000))
            ]);
            
            const hasPriceCheckAlarm = alarms.some(alarm => alarm.name === 'priceCheck');
            
            if (!hasPriceCheckAlarm) {
                await this.initializePriceMonitoring();
            }
            
            // Set up automatic reconnection monitoring
            this.setupReconnectionMonitoring();
            
        } catch (error) {
            console.error('Failed to resume monitoring:', error);
            // Fallback: reinitialize everything
            await this.initializePriceMonitoring();
        }
    }

    setupReconnectionMonitoring() {
        // Monitor for service worker inactivity and auto-reconnect
        this.lastActivity = Date.now();
        
        // Set up periodic heartbeat
        setInterval(() => {
            this.heartbeat();
        }, 30000); // Every 30 seconds
        
        // Set up inactivity detection
        chrome.alarms.create('inactivityCheck', {
            delayInMinutes: 5,
            periodInMinutes: 5
        });
    }

    heartbeat() {
        this.lastActivity = Date.now();
        
        // Perform lightweight operation to keep service worker active
        chrome.storage.local.get(['heartbeat']).then(() => {
            chrome.storage.local.set({ heartbeat: Date.now() });
        }).catch(error => {
            console.error('Heartbeat failed:', error);
            this.handleServiceWorkerInactivity();
        });
    }

    async handleServiceWorkerInactivity() {
        console.log('Service worker inactivity detected, attempting reconnection...');
        
        try {
            // Clear existing alarms
            await chrome.alarms.clearAll();
            
            // Reinitialize monitoring
            await this.initializePriceMonitoring();
            
            // Reset reconnection attempts
            this.reconnectAttempts = 0;
            
            console.log('Service worker reconnected successfully');
            
        } catch (error) {
            console.error('Reconnection failed:', error);
            await this.attemptReconnection();
        }
    }

    async attemptReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            return;
        }
        
        this.reconnectAttempts++;
        console.log(`Reconnection attempt ${this.reconnectAttempts}`);
        
        try {
            // Test connection to API
            // In real implementation, ping the API gateway
            await this.delay(1000);
            
            // If successful, resume normal operations
            this.reconnectAttempts = 0;
            await this.resumePriceMonitoring();
            
        } catch (error) {
            console.error('Reconnection failed:', error);
            
            // Schedule next attempt
            chrome.alarms.create('reconnect', {
                delayInMinutes: Math.pow(2, this.reconnectAttempts) // Exponential backoff
            });
        }
    }

    async performCleanup() {
        try {
            console.log('Performing cleanup...');
            
            // Clean old price history (keep last 30 days)
            const { priceHistory = {} } = await chrome.storage.local.get(['priceHistory']);
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            Object.keys(priceHistory).forEach(productId => {
                priceHistory[productId] = priceHistory[productId].filter(
                    entry => new Date(entry.timestamp) > thirtyDaysAgo
                );
            });
            
            await chrome.storage.local.set({ priceHistory });
            
        } catch (error) {
            console.error('Cleanup failed:', error);
        }
    }

    showNotification(title, message) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '../icons/icon-48.png',
            title,
            message
        });
    }

    showWelcomeNotification() {
        this.showNotification(
            'Welcome to Picksy!',
            'Start tracking prices by visiting a product page and clicking the extension icon.'
        );
    }

    isSupportedSite(url) {
        const supportedDomains = [
            'amazon.com',
            'ebay.com',
            'walmart.com',
            'target.com',
            'bestbuy.com'
        ];
        
        return supportedDomains.some(domain => url.includes(domain));
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async migrateData(previousVersion) {
        // Handle data migration for extension updates
        console.log(`Migrating from version ${previousVersion}`);
        // Implementation would depend on what needs to be migrated
    }
}

// Initialize background service
const backgroundService = new BackgroundService();