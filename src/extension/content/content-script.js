// Content script for product detection
class ProductDetector {
    constructor() {
        this.detectors = {
            'amazon.com': this.detectAmazonProduct.bind(this),
            'ebay.com': this.detectEbayProduct.bind(this),
            'walmart.com': this.detectWalmartProduct.bind(this),
            'target.com': this.detectTargetProduct.bind(this),
            'bestbuy.com': this.detectBestBuyProduct.bind(this)
        };
        
        this.setupMessageListener();
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'detectProduct') {
                const product = this.detectProduct();
                sendResponse({ product });
            }
            return true;
        });
    }

    detectProduct() {
        const hostname = window.location.hostname;
        const detector = Object.keys(this.detectors).find(domain => hostname.includes(domain));
        
        if (detector) {
            try {
                return this.detectors[detector]();
            } catch (error) {
                console.error('Product detection failed:', error);
                return null;
            }
        }
        
        return null;
    }

    detectAmazonProduct() {
        // Amazon product detection
        const titleElement = document.querySelector('#productTitle, [data-testid="product-title"]');
        const priceElement = document.querySelector('.a-price-whole, .a-offscreen, [data-testid="price"]');
        const imageElement = document.querySelector('#landingImage, [data-testid="product-image"]');
        
        if (!titleElement) return null;
        
        const title = titleElement.textContent?.trim();
        const priceText = priceElement?.textContent?.trim();
        const price = this.extractPrice(priceText);
        const imageUrl = imageElement?.src || imageElement?.getAttribute('data-src');
        
        // Extract additional info
        const brandElement = document.querySelector('[data-testid="brand-name"], .po-brand .po-break-word');
        const brand = brandElement?.textContent?.trim();
        
        const availability = this.detectAmazonAvailability();
        
        return {
            title,
            price,
            url: window.location.href,
            retailer: 'Amazon',
            imageUrl,
            brand,
            availability,
            category: this.extractAmazonCategory()
        };
    }

    detectEbayProduct() {
        const titleElement = document.querySelector('[data-testid="x-item-title-label"], .x-item-title-label');
        const priceElement = document.querySelector('[data-testid="notmi-price"], .notmi-price');
        const imageElement = document.querySelector('#icImg, [data-testid="ux-image-carousel-item"]');
        
        if (!titleElement) return null;
        
        const title = titleElement.textContent?.trim();
        const priceText = priceElement?.textContent?.trim();
        const price = this.extractPrice(priceText);
        const imageUrl = imageElement?.src;
        
        return {
            title,
            price,
            url: window.location.href,
            retailer: 'eBay',
            imageUrl,
            availability: 'Available'
        };
    }

    detectWalmartProduct() {
        const titleElement = document.querySelector('[data-automation-id="product-title"], h1[data-testid="product-title"]');
        const priceElement = document.querySelector('[data-testid="price-current"], [data-automation-id="product-price"]');
        const imageElement = document.querySelector('[data-testid="hero-image"], [data-automation-id="product-image"]');
        
        if (!titleElement) return null;
        
        const title = titleElement.textContent?.trim();
        const priceText = priceElement?.textContent?.trim();
        const price = this.extractPrice(priceText);
        const imageUrl = imageElement?.src;
        
        return {
            title,
            price,
            url: window.location.href,
            retailer: 'Walmart',
            imageUrl,
            availability: 'In Stock'
        };
    }

    detectTargetProduct() {
        const titleElement = document.querySelector('[data-test="product-title"], h1[data-test="product-title"]');
        const priceElement = document.querySelector('[data-test="product-price"], [data-test="price-current"]');
        const imageElement = document.querySelector('[data-test="product-image"], [data-test="hero-image"]');
        
        if (!titleElement) return null;
        
        const title = titleElement.textContent?.trim();
        const priceText = priceElement?.textContent?.trim();
        const price = this.extractPrice(priceText);
        const imageUrl = imageElement?.src;
        
        return {
            title,
            price,
            url: window.location.href,
            retailer: 'Target',
            imageUrl,
            availability: 'Available'
        };
    }

    detectBestBuyProduct() {
        const titleElement = document.querySelector('.heading-5, [data-testid="product-title"]');
        const priceElement = document.querySelector('.pricing-price__range, [data-testid="pricing-price"]');
        const imageElement = document.querySelector('.primary-image, [data-testid="product-image"]');
        
        if (!titleElement) return null;
        
        const title = titleElement.textContent?.trim();
        const priceText = priceElement?.textContent?.trim();
        const price = this.extractPrice(priceText);
        const imageUrl = imageElement?.src;
        
        return {
            title,
            price,
            url: window.location.href,
            retailer: 'Best Buy',
            imageUrl,
            availability: 'Available'
        };
    }

    extractPrice(priceText) {
        if (!priceText) return null;
        
        // Remove currency symbols and extract numeric value
        const cleanPrice = priceText.replace(/[^\d.,]/g, '');
        const price = parseFloat(cleanPrice.replace(/,/g, ''));
        
        return isNaN(price) ? null : price;
    }

    detectAmazonAvailability() {
        // Check for out of stock indicators
        const outOfStockSelectors = [
            '[data-testid="availability-text"]',
            '#availability span',
            '.a-color-state',
            '.a-color-price'
        ];
        
        for (const selector of outOfStockSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const text = element.textContent?.toLowerCase() || '';
                if (text.includes('out of stock') || text.includes('unavailable') || text.includes('currently unavailable')) {
                    return 'Out of Stock';
                }
            }
        }
        
        return 'In Stock';
    }

    extractAmazonCategory() {
        // Try to extract category from breadcrumbs
        const breadcrumbElement = document.querySelector('#wayfinding-breadcrumbs_feature_div a');
        if (breadcrumbElement) {
            return breadcrumbElement.textContent?.trim();
        }
        
        // Fallback to department info
        const departmentElement = document.querySelector('[data-testid="departments"]');
        if (departmentElement) {
            return departmentElement.textContent?.trim();
        }
        
        return null;
    }
}

// Initialize product detector
const productDetector = new ProductDetector();

// Optimized product detection with caching
let cachedProduct = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds

// Auto-detect product on page load for faster popup response
function initializeProductDetection() {
    // Use requestIdleCallback for non-blocking detection
    if (window.requestIdleCallback) {
        window.requestIdleCallback(() => {
            detectAndCacheProduct();
        }, { timeout: 2000 });
    } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(detectAndCacheProduct, 1000);
    }
}

function detectAndCacheProduct() {
    try {
        const product = productDetector.detectProduct();
        if (product) {
            cachedProduct = product;
            cacheTimestamp = Date.now();
        }
    } catch (error) {
        console.error('Product detection failed:', error);
    }
}

// Initialize detection when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProductDetection);
} else {
    initializeProductDetection();
}

// Re-detect on significant page changes
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        // Invalidate cache on URL change
        cachedProduct = null;
        cacheTimestamp = 0;
        
        // Re-detect after a short delay
        setTimeout(detectAndCacheProduct, 500);
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Enhanced message listener with caching
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'detectProduct') {
        // Use cached product if available and fresh
        const isCacheFresh = cachedProduct && (Date.now() - cacheTimestamp < CACHE_DURATION);
        
        if (isCacheFresh) {
            sendResponse({ product: cachedProduct });
        } else {
            // Detect fresh product
            try {
                const product = productDetector.detectProduct();
                if (product) {
                    cachedProduct = product;
                    cacheTimestamp = Date.now();
                }
                sendResponse({ product: product });
            } catch (error) {
                console.error('Product detection failed:', error);
                sendResponse({ product: null });
            }
        }
    }
    return true;
});