import { describe, it, expect, beforeEach } from 'vitest';
import { ProductMatchingService } from '../services/productMatching';
import { ProductInfo } from '../../../shared/types';

describe('ProductMatchingService Integration Tests', () => {
  let service: ProductMatchingService;

  beforeEach(() => {
    service = new ProductMatchingService();
  });

  describe('Complete workflow: normalize -> match -> deduplicate -> merge', () => {
    it('should handle a realistic product matching scenario', async () => {
      // Simulate products from different retailers for the same items
      const products: ProductInfo[] = [
        {
          id: 'amz_001',
          title: 'Apple iPhone 15 Pro 128GB Natural Titanium',
          url: 'https://amazon.com/dp/B0CHX1W5Y9',
          retailer: 'amazon',
          category: 'Electronics',
          brand: 'Apple',
          model: 'iPhone 15 Pro',
          imageUrl: 'https://m.media-amazon.com/images/I/81dT7CUY6GL._AC_SX679_.jpg',
          extractedAt: new Date('2024-01-01T10:00:00Z')
        },
        {
          id: 'bb_001',
          title: 'iPhone 15 Pro 128GB - Natural Titanium (Unlocked)',
          url: 'https://bestbuy.com/site/apple-iphone-15-pro/6418599.p',
          retailer: 'bestbuy',
          category: 'cell phones',
          brand: 'Apple',
          model: 'iPhone 15 Pro',
          extractedAt: new Date('2024-01-01T11:30:00Z')
        },
        {
          id: 'tgt_001',
          title: 'Apple iPhone 15 Pro (128GB) Natural Titanium - Unlocked',
          url: 'https://target.com/p/apple-iphone-15-pro/-/A-89740234',
          retailer: 'target',
          category: 'electronics',
          brand: 'Apple',
          extractedAt: new Date('2024-01-01T09:15:00Z')
        },
        {
          id: 'amz_002',
          title: 'Samsung Galaxy S24 Ultra 256GB Titanium Black',
          url: 'https://amazon.com/dp/B0CMDRCZBX',
          retailer: 'amazon',
          category: 'Electronics',
          brand: 'Samsung',
          model: 'Galaxy S24 Ultra',
          imageUrl: 'https://m.media-amazon.com/images/I/71Gt+zyOzjL._AC_SX679_.jpg',
          extractedAt: new Date('2024-01-02T14:20:00Z')
        },
        {
          id: 'bb_002',
          title: 'Galaxy S24 Ultra 256GB Titanium Black (Unlocked)',
          url: 'https://bestbuy.com/site/samsung-galaxy-s24-ultra/6570299.p',
          retailer: 'bestbuy',
          category: 'cell phones',
          brand: 'Samsung',
          model: 'Galaxy S24 Ultra',
          extractedAt: new Date('2024-01-02T16:45:00Z')
        },
        {
          id: 'uniq_001',
          title: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
          url: 'https://amazon.com/dp/B09XS7JWHH',
          retailer: 'amazon',
          category: 'Electronics',
          brand: 'Sony',
          model: 'WH-1000XM5',
          extractedAt: new Date('2024-01-03T12:00:00Z')
        }
      ];

      // Step 1: Normalize all products
      const normalizedProducts = products.map(product => ({
        product,
        normalized: service.normalizeProduct(product)
      }));

      expect(normalizedProducts).toHaveLength(6);
      
      // Verify normalization worked correctly
      const iphoneNormalized = normalizedProducts.find(np => np.product.id === 'amz_001')!;
      expect(iphoneNormalized.normalized.normalizedTitle).toContain('apple');
      expect(iphoneNormalized.normalized.normalizedTitle).toContain('iphone');
      expect(iphoneNormalized.normalized.normalizedTitle).toContain('15');
      expect(iphoneNormalized.normalized.normalizedTitle).toContain('pro');
      expect(iphoneNormalized.normalized.normalizedCategory).toBe('electronics');

      // Step 2: Find matches for iPhone products
      const iphoneProduct = products[0]; // Amazon iPhone
      const matches = await service.findMatches(iphoneProduct, products);

      expect(matches.length).toBeGreaterThan(0);
      
      // Should find Best Buy and Target iPhones as matches
      const bestBuyMatch = matches.find(m => m.product.retailer === 'bestbuy');
      const targetMatch = matches.find(m => m.product.retailer === 'target');
      
      expect(bestBuyMatch).toBeDefined();
      expect(['high', 'medium']).toContain(bestBuyMatch!.score.confidence);
      expect(bestBuyMatch!.score.score).toBeGreaterThan(0.65);
      
      expect(targetMatch).toBeDefined();
      expect(['high', 'medium']).toContain(targetMatch!.score.confidence);
      expect(targetMatch!.score.score).toBeGreaterThan(0.65);

      // Should not match Samsung or Sony products
      const samsungMatch = matches.find(m => m.product.brand === 'Samsung');
      const sonyMatch = matches.find(m => m.product.brand === 'Sony');
      expect(samsungMatch).toBeUndefined();
      expect(sonyMatch).toBeUndefined();

      // Step 3: Detect all duplicate groups
      const duplicateGroups = await service.detectDuplicates(products);

      expect(duplicateGroups.length).toBeGreaterThanOrEqual(1); // At least one group should be found
      
      // Find iPhone duplicate group
      const iphoneGroup = duplicateGroups.find(group => 
        group.products.some(p => p.brand === 'Apple')
      );
      expect(iphoneGroup).toBeDefined();
      expect(iphoneGroup!.products.length).toBeGreaterThanOrEqual(2); // At least Amazon and Best Buy
      expect(iphoneGroup!.confidence).toBeGreaterThan(0.65);

      // Find Samsung duplicate group (if it exists)
      const samsungGroup = duplicateGroups.find(group => 
        group.products.some(p => p.brand === 'Samsung')
      );
      if (samsungGroup) {
        expect(samsungGroup.products.length).toBeGreaterThanOrEqual(2);
        expect(samsungGroup.confidence).toBeGreaterThan(0.65);
      }

      // Step 4: Merge duplicates
      const mergedIphone = service.mergeDuplicates(iphoneGroup!);

      // Verify merged iPhone product
      expect(mergedIphone.brand).toBe('Apple');
      expect(mergedIphone.model).toBe('iPhone 15 Pro');
      expect(mergedIphone.title).toContain('iPhone 15 Pro');
      expect(mergedIphone.category.toLowerCase()).toContain('electronics'); // Category should contain electronics
      
      // Should have image URL from Amazon product (most complete)
      if (iphoneGroup!.canonicalProduct.id === 'amz_001') {
        expect(mergedIphone.imageUrl).toBeTruthy();
      }

      // Merge Samsung if group exists
      if (samsungGroup) {
        const mergedSamsung = service.mergeDuplicates(samsungGroup);
        expect(mergedSamsung.brand).toBe('Samsung');
        expect(mergedSamsung.model).toBe('Galaxy S24 Ultra');
        expect(mergedSamsung.title).toContain('Galaxy S24 Ultra');
        expect(mergedSamsung.category.toLowerCase()).toContain('electronics'); // Category should contain electronics
      }

      // Step 5: Verify unique products remain separate
      const processedProductIds = new Set();
      duplicateGroups.forEach(group => {
        group.products.forEach(p => processedProductIds.add(p.id));
      });
      
      const uniqueProducts = products.filter(p => !processedProductIds.has(p.id));
      expect(uniqueProducts.length).toBeGreaterThanOrEqual(1); // At least Sony headphones should remain unique
    });

    it('should handle edge cases in product matching', async () => {
      const edgeCaseProducts: ProductInfo[] = [
        // Product with minimal information
        {
          id: 'min_001',
          title: 'Phone',
          url: 'https://example.com/phone',
          retailer: 'unknown',
          category: 'unknown',
          extractedAt: new Date()
        },
        // Product with special characters and formatting
        {
          id: 'special_001',
          title: 'Apple® iPhone™ 15 Pro (128GB) - "Natural Titanium" [Unlocked]',
          url: 'https://retailer.com/iphone',
          retailer: 'retailer',
          category: 'Electronics & Technology',
          brand: 'Apple Inc.',
          model: 'iPhone 15 Pro Max', // Slightly different model
          extractedAt: new Date()
        },
        // Product with very long title
        {
          id: 'long_001',
          title: 'Apple iPhone 15 Pro 128GB Natural Titanium Unlocked Smartphone with Advanced Camera System Pro Camera System Action Button USB-C and A17 Pro Chip',
          url: 'https://longretailer.com/iphone',
          retailer: 'longretailer',
          category: 'mobile phones',
          brand: 'Apple',
          model: 'iPhone 15 Pro',
          extractedAt: new Date()
        }
      ];

      // Test normalization of edge cases
      const normalizedMinimal = service.normalizeProduct(edgeCaseProducts[0]);
      expect(normalizedMinimal.normalizedTitle).toBe('phone');
      expect(normalizedMinimal.keywords).toContain('phone');
      expect(normalizedMinimal.normalizedCategory).toBe('unknown');

      const normalizedSpecial = service.normalizeProduct(edgeCaseProducts[1]);
      expect(normalizedSpecial.normalizedTitle).toContain('apple');
      expect(normalizedSpecial.normalizedTitle).toContain('iphone');
      expect(normalizedSpecial.normalizedTitle).not.toContain('®');
      expect(normalizedSpecial.normalizedTitle).not.toContain('™');
      expect(normalizedSpecial.normalizedTitle).not.toContain('"');
      expect(normalizedSpecial.normalizedCategory).toContain('electronics');

      // Test duplicate detection with edge cases
      const duplicateGroups = await service.detectDuplicates(edgeCaseProducts);
      
      // Should handle products with different levels of detail
      // The special and long titles should potentially match despite formatting differences
      const hasMatches = duplicateGroups.length > 0;
      if (hasMatches) {
        const group = duplicateGroups[0];
        expect(group.products.length).toBeGreaterThanOrEqual(2);
        expect(group.confidence).toBeGreaterThan(0.6);
      }
    });

    it('should maintain performance with larger product sets', async () => {
      // Generate a larger set of products for performance testing
      const largeProductSet: ProductInfo[] = [];
      
      const brands = ['Apple', 'Samsung', 'Google', 'OnePlus', 'Sony'];
      const models = ['Phone A', 'Phone B', 'Phone C', 'Tablet X', 'Headphones Y'];
      const retailers = ['amazon', 'bestbuy', 'target', 'walmart', 'newegg'];
      
      let productId = 1;
      
      // Create 50 products with some intentional duplicates
      for (let i = 0; i < 50; i++) {
        const brand = brands[i % brands.length];
        const model = models[i % models.length];
        const retailer = retailers[i % retailers.length];
        
        largeProductSet.push({
          id: `prod_${productId++}`,
          title: `${brand} ${model} 128GB Black`,
          url: `https://${retailer}.com/product-${i}`,
          retailer,
          category: 'electronics',
          brand,
          model,
          extractedAt: new Date()
        });
      }

      const startTime = Date.now();
      
      // Test duplicate detection performance
      const duplicateGroups = await service.detectDuplicates(largeProductSet);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should complete within reasonable time (less than 5 seconds for 50 products)
      expect(processingTime).toBeLessThan(5000);
      
      // Should find duplicate groups
      expect(duplicateGroups.length).toBeGreaterThan(0);
      
      // Each group should have reasonable confidence
      duplicateGroups.forEach(group => {
        expect(group.confidence).toBeGreaterThan(0.6);
        expect(group.products.length).toBeGreaterThanOrEqual(2);
      });
      
      console.log(`Processed ${largeProductSet.length} products in ${processingTime}ms, found ${duplicateGroups.length} duplicate groups`);
    });
  });
});