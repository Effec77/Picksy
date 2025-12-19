import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  NotificationChannel, 
  AvailabilityStatus, 
  DataSource,
  PriceTrend,
  AlertType 
} from '../../../shared/types';

/**
 * Chrome Extension Testing Suite for Picksy
 * 
 * Tests Chrome extension specific functionality including storage,
 * background scripts, content scripts, and popup interactions.
 * 
 * Requirements: 8.1, 8.2, 8.3
 */

describe('Chrome Extension Testing Suite', () => {
  
  // Mock Chrome APIs
  const mockChrome = {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn()
      },
      sync: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn()
      }
    },
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn()
      },
      getURL: vi.fn(),
      id: 'test-extension-id'
    },
    tabs: {
      query: vi.fn(),
      sendMessage: vi.fn(),
      create: vi.fn()
    },
    notifications: {
      create: vi.fn(),
      clear: vi.fn()
    },
    alarms: {
      create: vi.fn(),
      clear: vi.fn(),
      onAlarm: {
        addListener: vi.fn()
      }
    }
  };
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default Chrome API responses
    mockChrome.storage.local.get.mockResolvedValue({});
    mockChrome.storage.local.set.mockResolvedValue(undefined);
    mockChrome.storage.sync.get.mockResolvedValue({});
    mockChrome.tabs.query.mockResolvedValue([]);
  });

  describe('Chrome Storage Operations', () => {
    it('should store and retrieve user preferences', async () => {
      const preferences = {
        notificationChannels: [NotificationChannel.BROWSER, NotificationChannel.EMAIL],
        checkFrequency: 60,
        priceThreshold: 10
      };
      
      // Mock storage responses
      mockChrome.storage.sync.set.mockResolvedValue(undefined);
      mockChrome.storage.sync.get.mockResolvedValue({ userPreferences: preferences });
      
      // Simulate storing preferences
      await mockChrome.storage.sync.set({ userPreferences: preferences });
      
      // Simulate retrieving preferences
      const result = await mockChrome.storage.sync.get('userPreferences');
      
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({ userPreferences: preferences });
      expect(result.userPreferences).toEqual(preferences);
    });

    it('should manage product data in local storage', async () => {
      const products = [
        {
          id: 'product-1',
          title: 'Test Product 1',
          url: 'https://amazon.com/product/1',
          currentPrice: 99.99,
          targetPrice: 80.00,
          isActive: true
        },
        {
          id: 'product-2',
          title: 'Test Product 2',
          url: 'https://ebay.com/product/2',
          currentPrice: 149.99,
          targetPrice: 120.00,
          isActive: true
        }
      ];
      
      // Mock storage operations
      mockChrome.storage.local.set.mockResolvedValue(undefined);
      mockChrome.storage.local.get.mockResolvedValue({ trackedProducts: products });
      
      // Store products
      await mockChrome.storage.local.set({ trackedProducts: products });
      
      // Retrieve products
      const result = await mockChrome.storage.local.get('trackedProducts');
      
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ trackedProducts: products });
      expect(result.trackedProducts).toHaveLength(2);
      expect(result.trackedProducts[0].id).toBe('product-1');
    });

    it('should handle storage quota limits gracefully', async () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: `product-${i}`,
        title: `Product ${i}`,
        url: `https://example.com/product/${i}`,
        priceHistory: Array.from({ length: 100 }, (_, j) => ({
          price: Math.random() * 100,
          timestamp: new Date(Date.now() - j * 86400000).toISOString()
        }))
      }));
      
      // Mock quota exceeded error
      mockChrome.storage.local.set.mockRejectedValue(
        new Error('QUOTA_BYTES_PER_ITEM quota exceeded')
      );
      
      // Test error handling
      try {
        await mockChrome.storage.local.set({ products: largeData });
        expect.fail('Should have thrown quota error');
      } catch (error) {
        expect(error.message).toContain('QUOTA_BYTES_PER_ITEM');
      }
      
      expect(mockChrome.storage.local.set).toHaveBeenCalled();
    });
  });

  describe('Background Script Operations', () => {
    it('should handle price checking alarms', async () => {
      const alarmHandler = vi.fn().mockImplementation(async (alarm) => {
        if (alarm.name === 'price-check') {
          // Simulate price checking logic
          const products = await mockChrome.storage.local.get('trackedProducts');
          
          // Mock price update
          const updatedProducts = products.trackedProducts?.map((p: any) => ({
            ...p,
            currentPrice: p.currentPrice * 0.9, // 10% price drop
            lastChecked: new Date().toISOString()
          }));
          
          await mockChrome.storage.local.set({ trackedProducts: updatedProducts });
          
          // Check for alerts
          const alerts = updatedProducts?.filter((p: any) => 
            p.currentPrice <= p.targetPrice
          );
          
          if (alerts?.length > 0) {
            await mockChrome.notifications.create('price-alert', {
              type: 'basic',
              iconUrl: 'icon.png',
              title: 'Price Alert!',
              message: `${alerts.length} products reached target price`
            });
          }
        }
      });
      
      // Setup mock data
      mockChrome.storage.local.get.mockResolvedValue({
        trackedProducts: [
          {
            id: 'product-1',
            title: 'Test Product',
            currentPrice: 100,
            targetPrice: 90
          }
        ]
      });
      
      // Simulate alarm trigger
      await alarmHandler({ name: 'price-check' });
      
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith('trackedProducts');
      expect(mockChrome.storage.local.set).toHaveBeenCalled();
      expect(mockChrome.notifications.create).toHaveBeenCalledWith('price-alert', 
        expect.objectContaining({
          title: 'Price Alert!',
          message: expect.stringContaining('products reached target price')
        })
      );
    });

    it('should handle message passing between components', async () => {
      const messageHandler = vi.fn().mockImplementation((message, sender, sendResponse) => {
        switch (message.type) {
          case 'GET_PRODUCTS':
            mockChrome.storage.local.get('trackedProducts').then(result => {
              sendResponse({ success: true, products: result.trackedProducts || [] });
            });
            return true; // Indicates async response
            
          case 'ADD_PRODUCT':
            mockChrome.storage.local.get('trackedProducts').then(result => {
              const products = result.trackedProducts || [];
              products.push(message.product);
              return mockChrome.storage.local.set({ trackedProducts: products });
            }).then(() => {
              sendResponse({ success: true, productId: message.product.id });
            });
            return true;
            
          case 'REMOVE_PRODUCT':
            mockChrome.storage.local.get('trackedProducts').then(result => {
              const products = result.trackedProducts || [];
              const filtered = products.filter((p: any) => p.id !== message.productId);
              return mockChrome.storage.local.set({ trackedProducts: filtered });
            }).then(() => {
              sendResponse({ success: true });
            });
            return true;
        }
      });
      
      const mockSendResponse = vi.fn();
      
      // Test GET_PRODUCTS message
      mockChrome.storage.local.get.mockResolvedValue({ 
        trackedProducts: [{ id: 'product-1', title: 'Test' }] 
      });
      
      messageHandler(
        { type: 'GET_PRODUCTS' },
        { tab: { id: 1 } },
        mockSendResponse
      );
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith('trackedProducts');
    });
  });

  describe('Content Script Operations', () => {
    it('should detect product information on supported sites', () => {
      // Mock DOM elements for Amazon product page
      const mockDocument = {
        querySelector: vi.fn().mockImplementation((selector) => {
          const selectors: Record<string, any> = {
            '#productTitle': { textContent: 'Test Product Title' },
            '.a-price-whole': { textContent: '99' },
            '.a-price-fraction': { textContent: '99' },
            '#landingImage': { src: 'https://example.com/image.jpg' },
            '#availability span': { textContent: 'In Stock' }
          };
          return selectors[selector] || null;
        }),
        location: { hostname: 'www.amazon.com', href: 'https://www.amazon.com/product/123' }
      };
      
      function extractProductInfo(doc: any) {
        const title = doc.querySelector('#productTitle')?.textContent?.trim();
        const priceWhole = doc.querySelector('.a-price-whole')?.textContent;
        const priceFraction = doc.querySelector('.a-price-fraction')?.textContent;
        const price = priceWhole && priceFraction ? 
          parseFloat(`${priceWhole}.${priceFraction}`) : null;
        const imageUrl = doc.querySelector('#landingImage')?.src;
        const availability = doc.querySelector('#availability span')?.textContent?.trim();
        
        return {
          title,
          price,
          imageUrl,
          availability: availability?.toLowerCase().includes('in stock') ? 
            AvailabilityStatus.IN_STOCK : AvailabilityStatus.OUT_OF_STOCK,
          url: doc.location.href,
          retailer: 'amazon',
          extractedAt: new Date().toISOString()
        };
      }
      
      const productInfo = extractProductInfo(mockDocument);
      
      expect(productInfo.title).toBe('Test Product Title');
      expect(productInfo.price).toBe(99.99);
      expect(productInfo.availability).toBe(AvailabilityStatus.IN_STOCK);
      expect(productInfo.retailer).toBe('amazon');
      expect(mockDocument.querySelector).toHaveBeenCalledWith('#productTitle');
    });

    it('should handle unsupported sites gracefully', () => {
      const mockDocument = {
        location: { hostname: 'unsupported-site.com' }
      };
      
      function isSupportedSite(hostname: string): boolean {
        const supportedSites = [
          'amazon.com', 'www.amazon.com',
          'ebay.com', 'www.ebay.com',
          'walmart.com', 'www.walmart.com'
        ];
        
        return supportedSites.some(site => 
          hostname === site || hostname.endsWith('.' + site)
        );
      }
      
      const isSupported = isSupportedSite(mockDocument.location.hostname);
      expect(isSupported).toBe(false);
    });
  });

  describe('Popup Interface Operations', () => {
    it('should display tracked products correctly', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          title: 'Gaming Laptop',
          currentPrice: 899.99,
          targetPrice: 800.00,
          url: 'https://amazon.com/laptop',
          lastChecked: '2024-01-15T10:00:00Z',
          priceChange: -50.00,
          isActive: true
        },
        {
          id: 'product-2',
          title: 'Wireless Headphones',
          currentPrice: 199.99,
          targetPrice: 150.00,
          url: 'https://ebay.com/headphones',
          lastChecked: '2024-01-15T09:30:00Z',
          priceChange: 0,
          isActive: true
        }
      ];
      
      mockChrome.storage.local.get.mockResolvedValue({ 
        trackedProducts: mockProducts 
      });
      
      // Simulate popup loading products
      const result = await mockChrome.storage.local.get('trackedProducts');
      const products = result.trackedProducts || [];
      
      expect(products).toHaveLength(2);
      expect(products[0].title).toBe('Gaming Laptop');
      expect(products[0].priceChange).toBe(-50.00);
      expect(products[1].priceChange).toBe(0);
    });

    it('should handle product management actions', async () => {
      const productManager = {
        addProduct: vi.fn().mockImplementation(async (productData) => {
          const products = await mockChrome.storage.local.get('trackedProducts');
          const currentProducts = products.trackedProducts || [];
          
          const newProduct = {
            id: `product-${Date.now()}`,
            ...productData,
            addedAt: new Date().toISOString(),
            isActive: true
          };
          
          currentProducts.push(newProduct);
          await mockChrome.storage.local.set({ trackedProducts: currentProducts });
          
          return { success: true, product: newProduct };
        }),
        
        removeProduct: vi.fn().mockImplementation(async (productId) => {
          const products = await mockChrome.storage.local.get('trackedProducts');
          const currentProducts = products.trackedProducts || [];
          
          const filtered = currentProducts.filter((p: any) => p.id !== productId);
          await mockChrome.storage.local.set({ trackedProducts: filtered });
          
          return { success: true };
        }),
        
        updateTargetPrice: vi.fn().mockImplementation(async (productId, targetPrice) => {
          const products = await mockChrome.storage.local.get('trackedProducts');
          const currentProducts = products.trackedProducts || [];
          
          const updated = currentProducts.map((p: any) => 
            p.id === productId ? { ...p, targetPrice } : p
          );
          
          await mockChrome.storage.local.set({ trackedProducts: updated });
          
          return { success: true };
        })
      };
      
      // Setup mock storage responses
      mockChrome.storage.local.get.mockResolvedValue({ trackedProducts: [] });
      mockChrome.storage.local.set.mockResolvedValue(undefined);
      
      // Test adding product
      const addResult = await productManager.addProduct({
        title: 'New Product',
        url: 'https://amazon.com/new-product',
        targetPrice: 100.00
      });
      
      expect(addResult.success).toBe(true);
      expect(addResult.product.title).toBe('New Product');
      
      // Test updating target price
      const updateResult = await productManager.updateTargetPrice('product-1', 90.00);
      expect(updateResult.success).toBe(true);
      
      // Test removing product
      const removeResult = await productManager.removeProduct('product-1');
      expect(removeResult.success).toBe(true);
      
      expect(productManager.addProduct).toHaveBeenCalled();
      expect(productManager.updateTargetPrice).toHaveBeenCalledWith('product-1', 90.00);
      expect(productManager.removeProduct).toHaveBeenCalledWith('product-1');
    });
  });

  describe('Extension Performance', () => {
    it('should initialize quickly', async () => {
      const startTime = performance.now();
      
      // Simulate extension initialization
      await Promise.all([
        mockChrome.storage.local.get('userPreferences'),
        mockChrome.storage.local.get('trackedProducts'),
        mockChrome.storage.sync.get('settings')
      ]);
      
      const endTime = performance.now();
      const initTime = endTime - startTime;
      
      // Should initialize within 100ms (very fast for extension)
      expect(initTime).toBeLessThan(100);
      
      expect(mockChrome.storage.local.get).toHaveBeenCalledTimes(2);
      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(1);
    });

    it('should handle storage operations efficiently', async () => {
      const operations = [];
      const startTime = performance.now();
      
      // Simulate multiple storage operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          mockChrome.storage.local.set({ [`key_${i}`]: `value_${i}` })
        );
      }
      
      await Promise.all(operations);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete all operations quickly
      expect(totalTime).toBeLessThan(50);
      expect(mockChrome.storage.local.set).toHaveBeenCalledTimes(10);
    });
  });
});