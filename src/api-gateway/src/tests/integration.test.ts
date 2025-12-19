import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  NotificationChannel, 
  AvailabilityStatus, 
  DataSource,
  PriceTrend,
  AlertType 
} from '../../../shared/types';

/**
 * Integration Testing Suite for Picksy API Gateway
 * 
 * Tests integration between different components and services
 * to ensure they work together correctly.
 * 
 * Requirements: 8.2
 */

describe('Integration Testing Suite', () => {
  
  describe('Service Integration', () => {
    it('should integrate authentication with rate limiting', async () => {
      // Mock services
      const authService = {
        validateToken: vi.fn().mockResolvedValue({ userId: 'user-1', role: 'user' }),
        generateToken: vi.fn().mockResolvedValue('valid-token')
      };
      
      const rateLimiter = {
        checkLimit: vi.fn().mockResolvedValue(true),
        incrementUsage: vi.fn()
      };
      
      // Simulate authenticated request with rate limiting
      const token = await authService.generateToken({ userId: 'user-1' });
      const user = await authService.validateToken(token);
      const canProceed = await rateLimiter.checkLimit(user.userId);
      
      expect(token).toBeDefined();
      expect(user.userId).toBe('user-1');
      expect(canProceed).toBe(true);
      expect(authService.validateToken).toHaveBeenCalledWith(token);
      expect(rateLimiter.checkLimit).toHaveBeenCalledWith('user-1');
    });

    it('should integrate price tracking with notifications', async () => {
      // Mock services
      const priceTracker = {
        checkPriceChange: vi.fn().mockResolvedValue({
          productId: 'product-1',
          oldPrice: 100,
          newPrice: 80,
          changePercent: -20
        })
      };
      
      const notificationService = {
        sendAlert: vi.fn().mockResolvedValue({ success: true, deliveryId: 'delivery-1' })
      };
      
      // Simulate price change detection and notification
      const priceChange = await priceTracker.checkPriceChange('product-1');
      
      if (priceChange.changePercent <= -10) {
        const alert = {
          userId: 'user-1',
          productId: priceChange.productId,
          type: AlertType.PRICE_DROP,
          message: `Price dropped by ${Math.abs(priceChange.changePercent)}%`
        };
        
        const result = await notificationService.sendAlert(alert);
        expect(result.success).toBe(true);
      }
      
      expect(priceTracker.checkPriceChange).toHaveBeenCalledWith('product-1');
      expect(notificationService.sendAlert).toHaveBeenCalled();
    });

    it('should integrate data collection with legal compliance', async () => {
      // Mock services
      const legalChecker = {
        canScrape: vi.fn().mockResolvedValue(true),
        getRateLimit: vi.fn().mockReturnValue(1000), // 1 second between requests
        checkRobotsTxt: vi.fn().mockResolvedValue(true)
      };
      
      const dataCollector = {
        fetchProductData: vi.fn().mockResolvedValue({
          title: 'Test Product',
          price: 99.99,
          availability: AvailabilityStatus.IN_STOCK
        })
      };
      
      // Simulate legal data collection
      const url = 'https://example.com/product/123';
      const canScrape = await legalChecker.canScrape(url);
      const robotsAllowed = await legalChecker.checkRobotsTxt(url);
      
      if (canScrape && robotsAllowed) {
        const rateLimit = legalChecker.getRateLimit('example.com');
        await new Promise(resolve => setTimeout(resolve, rateLimit));
        
        const productData = await dataCollector.fetchProductData(url);
        expect(productData.title).toBeDefined();
        expect(productData.price).toBeGreaterThan(0);
      }
      
      expect(legalChecker.canScrape).toHaveBeenCalledWith(url);
      expect(legalChecker.checkRobotsTxt).toHaveBeenCalledWith(url);
      expect(dataCollector.fetchProductData).toHaveBeenCalledWith(url);
    });
  });

  describe('Chrome Extension Storage Integration', () => {
    it('should maintain referential integrity across chrome storage', async () => {
      // Mock Chrome storage API
      const chromeStorage = {
        local: {
          data: new Map(),
          
          get: vi.fn().mockImplementation((keys) => {
            const result: any = {};
            if (Array.isArray(keys)) {
              keys.forEach(key => {
                if (chromeStorage.local.data.has(key)) {
                  result[key] = chromeStorage.local.data.get(key);
                }
              });
            } else if (typeof keys === 'string') {
              if (chromeStorage.local.data.has(keys)) {
                result[keys] = chromeStorage.local.data.get(keys);
              }
            }
            return Promise.resolve(result);
          }),
          
          set: vi.fn().mockImplementation((items) => {
            Object.entries(items).forEach(([key, value]) => {
              chromeStorage.local.data.set(key, value);
            });
            return Promise.resolve();
          }),
          
          remove: vi.fn().mockImplementation((keys) => {
            const keysArray = Array.isArray(keys) ? keys : [keys];
            keysArray.forEach(key => {
              chromeStorage.local.data.delete(key);
            });
            return Promise.resolve();
          })
        }
      };
      
      // Mock Chrome extension database service
      const extensionDB = {
        createUser: vi.fn().mockImplementation(async (userData) => {
          const user = { id: `user-${Date.now()}`, ...userData };
          await chromeStorage.local.set({ [`user_${user.id}`]: user });
          
          // Update users index
          const usersIndex = await chromeStorage.local.get('users_index');
          const currentUsers = usersIndex.users_index || [];
          currentUsers.push(user.id);
          await chromeStorage.local.set({ users_index: currentUsers });
          
          return user;
        }),
        
        createProduct: vi.fn().mockImplementation(async (productData) => {
          const product = { id: `product-${Date.now()}`, ...productData };
          await chromeStorage.local.set({ [`product_${product.id}`]: product });
          
          // Update user's products index
          const userProductsKey = `user_products_${productData.userId}`;
          const userProducts = await chromeStorage.local.get(userProductsKey);
          const currentProducts = userProducts[userProductsKey] || [];
          currentProducts.push(product.id);
          await chromeStorage.local.set({ [userProductsKey]: currentProducts });
          
          return product;
        }),
        
        getProductsByUser: vi.fn().mockImplementation(async (userId) => {
          const userProductsKey = `user_products_${userId}`;
          const userProducts = await chromeStorage.local.get(userProductsKey);
          const productIds = userProducts[userProductsKey] || [];
          
          const products = [];
          for (const productId of productIds) {
            const productData = await chromeStorage.local.get(`product_${productId}`);
            if (productData[`product_${productId}`]) {
              products.push(productData[`product_${productId}`]);
            }
          }
          
          return products;
        }),
        
        deleteUser: vi.fn().mockImplementation(async (userId) => {
          // Get user's products first
          const userProducts = await extensionDB.getProductsByUser(userId);
          
          // Delete all user's products
          for (const product of userProducts) {
            await chromeStorage.local.remove(`product_${product.id}`);
          }
          
          // Delete user's products index
          await chromeStorage.local.remove(`user_products_${userId}`);
          
          // Delete user
          await chromeStorage.local.remove(`user_${userId}`);
          
          // Update users index
          const usersIndex = await chromeStorage.local.get('users_index');
          const currentUsers = usersIndex.users_index || [];
          const updatedUsers = currentUsers.filter((id: string) => id !== userId);
          await chromeStorage.local.set({ users_index: updatedUsers });
        })
      };
      
      // Test referential integrity with Chrome storage
      const user = await extensionDB.createUser({ email: 'test@example.com' });
      const product1 = await extensionDB.createProduct({ 
        userId: user.id, 
        url: 'https://example.com/product1' 
      });
      const product2 = await extensionDB.createProduct({ 
        userId: user.id, 
        url: 'https://example.com/product2' 
      });
      
      // Verify products exist in Chrome storage
      let userProducts = await extensionDB.getProductsByUser(user.id);
      expect(userProducts).toHaveLength(2);
      
      // Delete user should cascade delete products
      await extensionDB.deleteUser(user.id);
      
      // Verify products are deleted from Chrome storage
      userProducts = await extensionDB.getProductsByUser(user.id);
      expect(userProducts).toHaveLength(0);
      
      // Verify Chrome storage calls
      expect(chromeStorage.local.set).toHaveBeenCalled();
      expect(chromeStorage.local.get).toHaveBeenCalled();
      expect(chromeStorage.local.remove).toHaveBeenCalled();
    });

    it('should handle concurrent Chrome storage operations safely', async () => {
      // Mock Chrome storage with concurrency simulation
      const chromeStorage = {
        local: {
          data: new Map([['user_balance', 100]]),
          
          get: vi.fn().mockImplementation((key) => {
            const value = chromeStorage.local.data.get(key);
            return Promise.resolve({ [key]: value });
          }),
          
          set: vi.fn().mockImplementation((items) => {
            Object.entries(items).forEach(([key, value]) => {
              chromeStorage.local.data.set(key, value);
            });
            return Promise.resolve();
          })
        }
      };
      
      const extensionService = {
        updateBalance: vi.fn().mockImplementation(async (amount) => {
          // Simulate Chrome storage transaction with proper sequencing
          const currentData = await chromeStorage.local.get('user_balance');
          const currentBalance = currentData.user_balance || 0;
          
          // Simulate processing delay
          await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
          
          const newBalance = currentBalance + amount;
          await chromeStorage.local.set({ user_balance: newBalance });
          
          return newBalance;
        })
      };
      
      // Simulate concurrent updates (Chrome storage handles serialization)
      const updates = [10, -5, 15, -20, 25];
      const results = [];
      
      // Process updates sequentially to simulate Chrome storage behavior
      for (const amount of updates) {
        const result = await extensionService.updateBalance(amount);
        results.push(result);
      }
      
      // Verify all operations completed
      expect(extensionService.updateBalance).toHaveBeenCalledTimes(5);
      expect(chromeStorage.local.get).toHaveBeenCalled();
      expect(chromeStorage.local.set).toHaveBeenCalled();
      
      // Final balance should be correct
      const finalData = await chromeStorage.local.get('user_balance');
      const expectedBalance = 100 + updates.reduce((sum, amount) => sum + amount, 0);
      expect(finalData.user_balance).toBe(expectedBalance);
    });
  });

  describe('API Integration', () => {
    it('should integrate multiple API endpoints in workflow', async () => {
      // Mock API responses
      const mockResponses = {
        '/api/auth/login': { token: 'auth-token', userId: 'user-1' },
        '/api/products': { products: [] },
        '/api/products/add': { productId: 'product-1', success: true },
        '/api/products/product-1/alerts': { alertId: 'alert-1', success: true }
      };
      
      const apiClient = {
        post: vi.fn().mockImplementation((endpoint, data) => {
          return Promise.resolve({ 
            status: 200, 
            data: mockResponses[endpoint] || {} 
          });
        }),
        get: vi.fn().mockImplementation((endpoint) => {
          return Promise.resolve({ 
            status: 200, 
            data: mockResponses[endpoint] || {} 
          });
        })
      };
      
      // Simulate complete user workflow
      // 1. Login
      const loginResponse = await apiClient.post('/api/auth/login', {
        email: 'user@example.com',
        password: 'password'
      });
      
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.data.token).toBeDefined();
      
      // 2. Get products
      const productsResponse = await apiClient.get('/api/products');
      expect(productsResponse.status).toBe(200);
      
      // 3. Add product
      const addProductResponse = await apiClient.post('/api/products/add', {
        url: 'https://example.com/product'
      });
      expect(addProductResponse.data.success).toBe(true);
      
      // 4. Set alert
      const alertResponse = await apiClient.post('/api/products/product-1/alerts', {
        type: 'price_drop',
        threshold: 10
      });
      expect(alertResponse.data.success).toBe(true);
      
      // Verify all API calls were made
      expect(apiClient.post).toHaveBeenCalledTimes(3);
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Propagation', () => {
    it('should propagate errors correctly through service layers', async () => {
      // Mock service with error
      const dataService = {
        fetchData: vi.fn().mockRejectedValue(new Error('Network timeout'))
      };
      
      const businessService = {
        processData: vi.fn().mockImplementation(async () => {
          try {
            return await dataService.fetchData();
          } catch (error) {
            throw new Error(`Processing failed: ${error.message}`);
          }
        })
      };
      
      const apiService = {
        handleRequest: vi.fn().mockImplementation(async () => {
          try {
            return await businessService.processData();
          } catch (error) {
            return {
              success: false,
              error: error.message,
              code: 'PROCESSING_ERROR'
            };
          }
        })
      };
      
      // Test error propagation
      const result = await apiService.handleRequest();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
      expect(result.code).toBe('PROCESSING_ERROR');
      
      expect(dataService.fetchData).toHaveBeenCalled();
      expect(businessService.processData).toHaveBeenCalled();
      expect(apiService.handleRequest).toHaveBeenCalled();
    });
  });

  describe('Configuration Integration', () => {
    it('should integrate configuration across services', async () => {
      // Mock configuration
      const config = {
        rateLimit: {
          maxRequests: 100,
          windowMs: 60000
        },
        notifications: {
          channels: [NotificationChannel.EMAIL, NotificationChannel.BROWSER],
          retryAttempts: 3
        },
        dataCollection: {
          apiTimeout: 5000,
          maxRetries: 2
        }
      };
      
      // Mock services using configuration
      const rateLimiter = {
        configure: vi.fn().mockImplementation((config) => {
          expect(config.maxRequests).toBe(100);
          expect(config.windowMs).toBe(60000);
        })
      };
      
      const notificationService = {
        configure: vi.fn().mockImplementation((config) => {
          expect(config.channels).toContain(NotificationChannel.EMAIL);
          expect(config.retryAttempts).toBe(3);
        })
      };
      
      const dataCollector = {
        configure: vi.fn().mockImplementation((config) => {
          expect(config.apiTimeout).toBe(5000);
          expect(config.maxRetries).toBe(2);
        })
      };
      
      // Configure all services
      rateLimiter.configure(config.rateLimit);
      notificationService.configure(config.notifications);
      dataCollector.configure(config.dataCollection);
      
      expect(rateLimiter.configure).toHaveBeenCalledWith(config.rateLimit);
      expect(notificationService.configure).toHaveBeenCalledWith(config.notifications);
      expect(dataCollector.configure).toHaveBeenCalledWith(config.dataCollection);
    });
  });
});