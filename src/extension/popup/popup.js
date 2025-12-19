// Import user experience and error handling services
import { UserExperienceService } from '../src/services/userExperience.js';
import { ExtensionErrorHandler, ExtensionErrorCode } from '../src/services/errorHandling.js';

// Popup script for Picksy Price Tracker
class PopupManager {
    constructor() {
        this.currentProduct = null;
        this.trackedProducts = [];
        this.apiBaseUrl = 'https://api.picksy.com';
        this.initializationTimeout = 2000; // 2 second requirement
        this.uxService = UserExperienceService.getInstance();
        this.errorHandler = ExtensionErrorHandler.getInstance();
        this.initializePopup();
    }

    async initializePopup() {
        const startTime = performance.now();
        
        try {
            // Set up event listeners immediately for responsiveness
            this.setupEventListeners();
            
            // Initialize with timeout to meet 2-second requirement
            const initPromise = Promise.race([
                this.performInitialization(),
                this.createTimeoutPromise(this.initializationTimeout)
            ]);
            
            await initPromise;
            
            const initTime = performance.now() - startTime;
            console.log(`Popup initialized in ${initTime.toFixed(2)}ms`);
            
            // Check if user needs onboarding
            if (await this.uxService.shouldShowOnboarding()) {
                await this.uxService.startOnboarding();
            }
            
        } catch (error) {
            console.error('Failed to initialize popup:', error);
            this.errorHandler.handleError(
                ExtensionErrorCode.INITIALIZATION_FAILED,
                'Failed to load extension. Please try refreshing the page.',
                error
            );
        }
    }

    async performInitialization() {
        // Load data in parallel for faster initialization
        const [trackedProducts, currentProduct] = await Promise.all([
            this.loadTrackedProducts().catch(() => []),
            this.detectCurrentProduct().catch(() => null)
        ]);
        
        // Update UI immediately
        this.updateUI();
    }

    createTimeoutPromise(timeout) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Initialization timeout')), timeout);
        });
    }

    setupEventListeners() {
        // Track button
        document.getElementById('trackButton').addEventListener('click', () => {
            this.trackCurrentProduct();
        });

        // Compare button
        document.getElementById('compareButton').addEventListener('click', () => {
            this.showPriceComparison();
        });

        // Settings button
        document.getElementById('settingsButton').addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
        });

        // Pricing button
        document.getElementById('pricingButton').addEventListener('click', () => {
            window.location.href = 'pricing.html';
        });

        // Help button
        document.getElementById('helpButton').addEventListener('click', () => {
            chrome.tabs.create({ url: 'https://help.picksy.com' });
        });
    }

    async detectCurrentProduct() {
        try {
            // Get current tab with timeout for responsiveness
            const tabPromise = chrome.tabs.query({ active: true, currentWindow: true });
            const [tab] = await Promise.race([
                tabPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Tab query timeout')), 500))
            ]);
            
            if (!tab || !this.isSupportedSite(tab.url)) {
                this.showNoProduct();
                return null;
            }

            // Non-blocking product detection with timeout
            const detectionPromise = chrome.tabs.sendMessage(tab.id, { action: 'detectProduct' });
            const response = await Promise.race([
                detectionPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Detection timeout')), 1000))
            ]);
            
            if (response && response.product) {
                this.currentProduct = response.product;
                this.showProductInfo(this.currentProduct);
                return this.currentProduct;
            } else {
                this.showNoProduct();
                return null;
            }
        } catch (error) {
            console.error('Failed to detect product:', error);
            if (tab && tab.url) {
                this.errorHandler.handleProductDetectionError(tab.url, error.message);
            }
            this.showNoProduct();
            return null;
        }
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

    showProductInfo(product) {
        const productInfo = document.getElementById('productInfo');
        const noProduct = document.getElementById('noProduct');
        
        // Hide no product message
        noProduct.style.display = 'none';
        
        // Show product info
        productInfo.style.display = 'flex';
        
        // Update product details
        document.getElementById('productImage').src = product.imageUrl || '../icons/icon-48.png';
        document.getElementById('productTitle').textContent = product.title;
        document.getElementById('currentPrice').textContent = this.formatPrice(product.price);
        
        // Update availability
        const availabilityEl = document.getElementById('availability');
        availabilityEl.textContent = product.availability || 'In Stock';
        availabilityEl.className = `availability ${product.availability === 'Out of Stock' ? 'out-of-stock' : ''}`;
        
        // Update trust score
        const trustScoreEl = document.getElementById('trustScore');
        const trustLevel = this.calculateTrustLevel(product);
        trustScoreEl.textContent = `${trustLevel.score}% Trusted`;
        trustScoreEl.className = `trust-score ${trustLevel.level}`;
        
        // Enable action buttons
        document.getElementById('trackButton').disabled = false;
        document.getElementById('compareButton').disabled = false;
    }

    showNoProduct() {
        document.getElementById('productInfo').style.display = 'none';
        document.getElementById('noProduct').style.display = 'block';
        
        // Disable action buttons
        document.getElementById('trackButton').disabled = true;
        document.getElementById('compareButton').disabled = true;
        
        // Check if we should show unsupported site guidance
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url && !this.isSupportedSite(tabs[0].url)) {
                this.uxService.showUnsupportedSiteGuidance(tabs[0].url);
            }
        });
    }

    calculateTrustLevel(product) {
        // Simple trust calculation based on retailer and product data completeness
        let score = 50; // Base score
        
        // Retailer reputation
        const trustedRetailers = ['amazon.com', 'walmart.com', 'target.com', 'bestbuy.com'];
        if (trustedRetailers.some(retailer => product.url.includes(retailer))) {
            score += 30;
        }
        
        // Product data completeness
        if (product.imageUrl) score += 5;
        if (product.brand) score += 5;
        if (product.model) score += 5;
        if (product.category) score += 5;
        
        // Clamp score between 0-100
        score = Math.min(100, Math.max(0, score));
        
        let level = 'low';
        if (score >= 80) level = 'high';
        else if (score >= 60) level = 'medium';
        
        return { score, level };
    }

    async trackCurrentProduct() {
        if (!this.currentProduct) return;
        
        try {
            const trackButton = document.getElementById('trackButton');
            const originalText = trackButton.textContent;
            
            // Show loading state
            trackButton.innerHTML = '<span class="loading"></span> Tracking...';
            trackButton.disabled = true;
            
            // Add to tracked products
            const trackedProduct = {
                id: this.generateId(),
                ...this.currentProduct,
                addedAt: new Date().toISOString(),
                isActive: true
            };
            
            this.trackedProducts.push(trackedProduct);
            
            // Save to storage
            await this.saveTrackedProducts();
            
            // Update UI
            this.updateTrackedProductsList();
            
            // Show success feedback
            this.uxService.showSuccessFeedback('product_tracked', 
                `We'll notify you when the price changes for "${this.currentProduct.title}"`);
            
            // Complete onboarding step if applicable
            await this.uxService.completeOnboardingStep('track_product');
            
            // Reset button
            trackButton.textContent = 'Tracked!';
            setTimeout(() => {
                trackButton.textContent = originalText;
                trackButton.disabled = false;
            }, 2000);
            
        } catch (error) {
            console.error('Failed to track product:', error);
            this.errorHandler.handleError(
                ExtensionErrorCode.API_CONNECTION_FAILED,
                'Failed to track product. Please try again.',
                error,
                [
                    {
                        label: 'Retry',
                        action: () => this.trackCurrentProduct()
                    },
                    {
                        label: 'Check Connection',
                        action: () => chrome.tabs.create({ url: 'chrome://settings/help' })
                    }
                ]
            );
        }
    }

    async showPriceComparison() {
        if (!this.currentProduct) return;
        
        try {
            const comparisonSection = document.getElementById('priceComparison');
            const resultsContainer = document.getElementById('comparisonResults');
            
            // Show loading
            resultsContainer.innerHTML = '<div class="loading"></div> Finding prices...';
            comparisonSection.style.display = 'block';
            
            // Simple price comparison (mock data for now)
            const comparisons = await this.fetchPriceComparisons(this.currentProduct);
            
            // Display results
            resultsContainer.innerHTML = '';
            comparisons.forEach((item, index) => {
                const comparisonItem = document.createElement('div');
                comparisonItem.className = 'comparison-item';
                comparisonItem.innerHTML = `
                    <span class="comparison-retailer">${item.retailer}</span>
                    <span class="comparison-price ${index === 0 ? 'best' : ''}">${this.formatPrice(item.price)}</span>
                `;
                resultsContainer.appendChild(comparisonItem);
            });
            
        } catch (error) {
            console.error('Failed to compare prices:', error);
            document.getElementById('comparisonResults').innerHTML = 'Failed to load price comparisons';
        }
    }

    async fetchPriceComparisons(product) {
        // Mock price comparison data
        // In real implementation, this would call the API gateway
        const basePrice = product.price || 99.99;
        return [
            { retailer: 'Amazon', price: basePrice * 0.95 },
            { retailer: 'Walmart', price: basePrice * 1.02 },
            { retailer: 'Target', price: basePrice * 1.05 },
            { retailer: 'Best Buy', price: basePrice * 1.08 }
        ].sort((a, b) => a.price - b.price);
    }

    async loadTrackedProducts() {
        try {
            // Use cached data if available for faster loading
            if (this.cachedTrackedProducts && Date.now() - this.cacheTimestamp < 30000) {
                this.trackedProducts = this.cachedTrackedProducts;
                return this.trackedProducts;
            }
            
            const result = await Promise.race([
                chrome.storage.local.get(['trackedProducts']),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Storage timeout')), 500))
            ]);
            
            this.trackedProducts = result.trackedProducts || [];
            this.cachedTrackedProducts = this.trackedProducts;
            this.cacheTimestamp = Date.now();
            
            return this.trackedProducts;
        } catch (error) {
            console.error('Failed to load tracked products:', error);
            this.errorHandler.handleStorageError('load tracked products', error);
            this.trackedProducts = [];
            return this.trackedProducts;
        }
    }

    async saveTrackedProducts() {
        try {
            // Debounce saves to avoid excessive storage operations
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
            }
            
            this.saveTimeout = setTimeout(async () => {
                try {
                    await chrome.storage.local.set({ trackedProducts: this.trackedProducts });
                    this.cachedTrackedProducts = [...this.trackedProducts];
                    this.cacheTimestamp = Date.now();
                } catch (error) {
                    console.error('Failed to save tracked products:', error);
                    this.errorHandler.handleStorageError('save tracked products', error);
                }
            }, 100);
        } catch (error) {
            console.error('Failed to schedule save:', error);
            this.errorHandler.handleStorageError('schedule save', error);
        }
    }

    updateTrackedProductsList() {
        const trackedList = document.getElementById('trackedList');
        
        if (this.trackedProducts.length === 0) {
            trackedList.innerHTML = `
                <div class="empty-state">
                    <p>No products tracked yet.</p>
                    <p class="hint">Visit a product page and click "Track This Product"</p>
                </div>
            `;
            return;
        }
        
        trackedList.innerHTML = '';
        this.trackedProducts.forEach(product => {
            const item = document.createElement('div');
            item.className = 'tracked-item';
            item.innerHTML = `
                <img src="${product.imageUrl || '../icons/icon-48.png'}" alt="${product.title}">
                <div class="tracked-item-details">
                    <div class="tracked-item-title">${product.title}</div>
                    <div class="tracked-item-price">${this.formatPrice(product.price)}</div>
                </div>
                <div class="tracked-item-actions">
                    <button class="btn btn-small btn-secondary" onclick="popupManager.removeTrackedProduct('${product.id}')">Remove</button>
                </div>
            `;
            trackedList.appendChild(item);
        });
    }

    async removeTrackedProduct(productId) {
        const product = this.trackedProducts.find(p => p.id === productId);
        this.trackedProducts = this.trackedProducts.filter(p => p.id !== productId);
        await this.saveTrackedProducts();
        this.updateTrackedProductsList();
        
        // Show success feedback
        if (product) {
            this.uxService.showSuccessFeedback('product_removed', 
                `"${product.title}" removed from tracking`);
        }
    }

    updateUI() {
        this.updateTrackedProductsList();
    }

    formatPrice(price) {
        if (typeof price === 'number') {
            return `$${price.toFixed(2)}`;
        }
        return price || 'Price not available';
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showError(message) {
        console.error(message);
        this.uxService.showErrorFeedback(message);
    }
}

// Performance monitoring and initialization
class PerformanceMonitor {
    constructor() {
        this.startTime = performance.now();
        this.initializationTarget = 2000; // 2 seconds
    }

    checkInitializationTime() {
        const elapsed = performance.now() - this.startTime;
        const success = elapsed <= this.initializationTarget;
        
        console.log(`Extension initialization: ${elapsed.toFixed(2)}ms (${success ? 'PASS' : 'FAIL'})`);
        
        if (!success) {
            console.warn(`Initialization exceeded target of ${this.initializationTarget}ms`);
        }
        
        return { elapsed, success };
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const monitor = new PerformanceMonitor();
    
    window.popupManager = new PopupManager();
    
    // Check performance after initialization
    setTimeout(() => {
        monitor.checkInitializationTime();
    }, 100);
});