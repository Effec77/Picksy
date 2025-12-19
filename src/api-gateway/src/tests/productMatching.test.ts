import { describe, it, expect, beforeEach } from 'vitest';
import { ProductMatchingService } from '../services/productMatching';
import { ProductInfo } from '../../../shared/types';

describe('ProductMatchingService', () => {
  let service: ProductMatchingService;
  let sampleProducts: ProductInfo[];

  beforeEach(() => {
    service = new ProductMatchingService();
    sampleProducts = [
      {
        id: '1',
        title: 'Apple iPhone 15 Pro 128GB Space Black',
        url: 'https://amazon.com/iphone-15-pro',
        retailer: 'amazon',
        category: 'electronics',
        brand: 'Apple',
        model: 'iPhone 15 Pro',
        imageUrl: 'https://example.com/iphone.jpg',
        extractedAt: new Date('2024-01-01')
      },
      {
        id: '2',
        title: 'iPhone 15 Pro 128GB - Space Black (Apple)',
        url: 'https://bestbuy.com/iphone-15-pro',
        retailer: 'bestbuy',
        category: 'electronics',
        brand: 'Apple',
        model: 'iPhone 15 Pro',
        extractedAt: new Date('2024-01-02')
      },
      {
        id: '3',
        title: 'Samsung Galaxy S24 Ultra 256GB',
        url: 'https://amazon.com/galaxy-s24',
        retailer: 'amazon',
        category: 'electronics',
        brand: 'Samsung',
        model: 'Galaxy S24 Ultra',
        extractedAt: new Date('2024-01-03')
      },
      {
        id: '4',
        title: 'Apple MacBook Pro 14-inch M3',
        url: 'https://apple.com/macbook-pro',
        retailer: 'apple',
        category: 'electronics',
        brand: 'Apple',
        model: 'MacBook Pro',
        extractedAt: new Date('2024-01-04')
      }
    ];
  });

  describe('normalizeProduct', () => {
    it('should normalize product data correctly', () => {
      const product = sampleProducts[0];
      const normalized = service.normalizeProduct(product);

      expect(normalized.normalizedTitle).toBe('apple iphone 15 pro 128gb space black');
      expect(normalized.normalizedBrand).toBe('apple');
      expect(normalized.normalizedModel).toBe('iphone 15 pro');
      expect(normalized.normalizedCategory).toBe('electronics');
      expect(normalized.keywords).toContain('apple');
      expect(normalized.keywords).toContain('iphone');
      expect(normalized.keywords).toContain('128gb');
    });

    it('should handle products without optional fields', () => {
      const product: ProductInfo = {
        id: '5',
        title: 'Generic Smartphone',
        url: 'https://example.com/phone',
        retailer: 'generic',
        category: 'unknown',
        extractedAt: new Date()
      };

      const normalized = service.normalizeProduct(product);

      expect(normalized.normalizedTitle).toBe('generic smartphone');
      expect(normalized.normalizedBrand).toBeUndefined();
      expect(normalized.normalizedModel).toBeUndefined();
      expect(normalized.normalizedCategory).toBe('unknown');
      expect(normalized.keywords).toContain('generic');
      expect(normalized.keywords).toContain('smartphone');
    });

    it('should normalize category names consistently', () => {
      const products = [
        { ...sampleProducts[0], category: 'Electronics' },
        { ...sampleProducts[0], category: 'electronic' },
        { ...sampleProducts[0], category: 'tech' }
      ];

      products.forEach(product => {
        const normalized = service.normalizeProduct(product);
        expect(normalized.normalizedCategory).toBe('electronics');
      });
    });
  });

  describe('findMatches', () => {
    it('should find high-confidence matches for similar products', async () => {
      const targetProduct = sampleProducts[0]; // iPhone 15 Pro from Amazon
      const candidates = sampleProducts.slice(1); // Other products

      const matches = await service.findMatches(targetProduct, candidates);

      expect(matches.length).toBeGreaterThan(0);
      
      // Should find the iPhone from Best Buy as a match
      const iphoneMatch = matches.find(m => m.product.id === '2');
      expect(iphoneMatch).toBeDefined();
      expect(iphoneMatch!.score.confidence).toBe('high');
      expect(iphoneMatch!.score.score).toBeGreaterThan(0.8);
    });

    it('should not match completely different products', async () => {
      const targetProduct = sampleProducts[0]; // iPhone 15 Pro
      const candidates = [sampleProducts[2]]; // Samsung Galaxy S24

      const matches = await service.findMatches(targetProduct, candidates);

      // Should not find any high-confidence matches
      const highConfidenceMatches = matches.filter(m => m.score.confidence === 'high');
      expect(highConfidenceMatches.length).toBe(0);
    });

    it('should exclude self from matches', async () => {
      const targetProduct = sampleProducts[0];
      const candidates = sampleProducts; // Including the target product

      const matches = await service.findMatches(targetProduct, candidates);

      // Should not include the target product itself
      const selfMatch = matches.find(m => m.product.id === targetProduct.id);
      expect(selfMatch).toBeUndefined();
    });

    it('should sort matches by score in descending order', async () => {
      const targetProduct = sampleProducts[0];
      const candidates = sampleProducts.slice(1);

      const matches = await service.findMatches(targetProduct, candidates);

      if (matches.length > 1) {
        for (let i = 0; i < matches.length - 1; i++) {
          expect(matches[i].score.score).toBeGreaterThanOrEqual(matches[i + 1].score.score);
        }
      }
    });
  });

  describe('detectDuplicates', () => {
    it('should detect duplicate products correctly', async () => {
      const duplicateGroups = await service.detectDuplicates(sampleProducts);

      expect(duplicateGroups.length).toBeGreaterThan(0);
      
      // Should find iPhone duplicates
      const iphoneGroup = duplicateGroups.find(group => 
        group.products.some(p => p.id === '1') && 
        group.products.some(p => p.id === '2')
      );
      expect(iphoneGroup).toBeDefined();
      expect(iphoneGroup!.products.length).toBe(2);
      expect(iphoneGroup!.confidence).toBeGreaterThan(0.8);
    });

    it('should select appropriate canonical product', async () => {
      const duplicateGroups = await service.detectDuplicates(sampleProducts);
      
      const iphoneGroup = duplicateGroups.find(group => 
        group.products.some(p => p.id === '1') && 
        group.products.some(p => p.id === '2')
      );

      if (iphoneGroup) {
        // Should prefer the product with more complete information
        expect(iphoneGroup.canonicalProduct).toBeDefined();
        expect(['1', '2']).toContain(iphoneGroup.canonicalProduct.id);
      }
    });

    it('should handle empty product list', async () => {
      const duplicateGroups = await service.detectDuplicates([]);
      expect(duplicateGroups).toEqual([]);
    });

    it('should handle single product', async () => {
      const duplicateGroups = await service.detectDuplicates([sampleProducts[0]]);
      expect(duplicateGroups).toEqual([]);
    });
  });

  describe('mergeDuplicates', () => {
    it('should merge duplicate products correctly', async () => {
      const duplicateGroups = await service.detectDuplicates(sampleProducts);
      
      const iphoneGroup = duplicateGroups.find(group => 
        group.products.some(p => p.id === '1') && 
        group.products.some(p => p.id === '2')
      );

      if (iphoneGroup) {
        const mergedProduct = service.mergeDuplicates(iphoneGroup);

        expect(mergedProduct.id).toBe(iphoneGroup.canonicalProduct.id);
        expect(mergedProduct.title).toBe(iphoneGroup.canonicalProduct.title);
        expect(mergedProduct.brand).toBe('Apple');
        expect(mergedProduct.model).toBe('iPhone 15 Pro');
        
        // Should preserve the most complete information
        if (!iphoneGroup.canonicalProduct.imageUrl) {
          const productWithImage = iphoneGroup.products.find(p => p.imageUrl);
          if (productWithImage) {
            expect(mergedProduct.imageUrl).toBe(productWithImage.imageUrl);
          }
        }
      }
    });

    it('should handle merging with missing optional fields', () => {
      const products: ProductInfo[] = [
        {
          id: '1',
          title: 'Test Product',
          url: 'https://example.com/1',
          retailer: 'retailer1',
          category: 'unknown',
          extractedAt: new Date()
        },
        {
          id: '2',
          title: 'Test Product',
          url: 'https://example.com/2',
          retailer: 'retailer2',
          category: 'electronics',
          brand: 'TestBrand',
          model: 'TestModel',
          imageUrl: 'https://example.com/image.jpg',
          extractedAt: new Date()
        }
      ];

      const duplicateGroup = {
        id: 'test-group',
        products,
        canonicalProduct: products[0],
        confidence: 0.9,
        mergedAt: new Date()
      };

      const mergedProduct = service.mergeDuplicates(duplicateGroup);

      expect(mergedProduct.id).toBe('1');
      expect(mergedProduct.brand).toBe('TestBrand');
      expect(mergedProduct.model).toBe('TestModel');
      expect(mergedProduct.imageUrl).toBe('https://example.com/image.jpg');
      expect(mergedProduct.category).toBe('electronics'); // Should use more specific category
    });
  });

  describe('string similarity calculation', () => {
    it('should calculate identical strings as 1.0 similarity', () => {
      const product1 = service.normalizeProduct({
        id: '1',
        title: 'Test Product',
        url: 'https://example.com',
        retailer: 'test',
        category: 'test',
        extractedAt: new Date()
      });

      const product2 = service.normalizeProduct({
        id: '2',
        title: 'Test Product',
        url: 'https://example.com',
        retailer: 'test',
        category: 'test',
        extractedAt: new Date()
      });

      // Access private method through any casting for testing
      const similarity = (service as any).calculateStringSimilarity(
        product1.normalizedTitle,
        product2.normalizedTitle
      );

      expect(similarity).toBe(1.0);
    });

    it('should calculate completely different strings as low similarity', () => {
      const similarity = (service as any).calculateStringSimilarity(
        'apple iphone',
        'samsung galaxy'
      );

      expect(similarity).toBeLessThan(0.5);
    });

    it('should handle empty strings', () => {
      const similarity1 = (service as any).calculateStringSimilarity('', 'test');
      const similarity2 = (service as any).calculateStringSimilarity('test', '');
      const similarity3 = (service as any).calculateStringSimilarity('', '');

      expect(similarity1).toBe(0);
      expect(similarity2).toBe(0);
      expect(similarity3).toBe(1); // Both empty should be identical
    });
  });

  describe('keyword overlap calculation', () => {
    it('should calculate keyword overlap correctly', () => {
      const keywords1 = ['apple', 'iphone', '15', 'pro'];
      const keywords2 = ['apple', 'iphone', '15', 'max'];

      const overlap = (service as any).calculateKeywordOverlap(keywords1, keywords2);

      // Intersection: ['apple', 'iphone', '15'] = 3
      // Union: ['apple', 'iphone', '15', 'pro', 'max'] = 5
      // Jaccard similarity: 3/5 = 0.6
      expect(overlap).toBeCloseTo(0.6, 2);
    });

    it('should handle empty keyword arrays', () => {
      const overlap1 = (service as any).calculateKeywordOverlap([], ['test']);
      const overlap2 = (service as any).calculateKeywordOverlap(['test'], []);
      const overlap3 = (service as any).calculateKeywordOverlap([], []);

      expect(overlap1).toBe(0);
      expect(overlap2).toBe(0);
      expect(overlap3).toBe(0);
    });

    it('should handle identical keyword arrays', () => {
      const keywords = ['apple', 'iphone', 'pro'];
      const overlap = (service as any).calculateKeywordOverlap(keywords, keywords);

      expect(overlap).toBe(1.0);
    });
  });

  describe('getDuplicateGroups', () => {
    it('should return stored duplicate groups', async () => {
      await service.detectDuplicates(sampleProducts);
      const groups = service.getDuplicateGroups();

      expect(Array.isArray(groups)).toBe(true);
      expect(groups.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array when no duplicates detected', () => {
      const groups = service.getDuplicateGroups();
      expect(groups).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle malformed product data gracefully', async () => {
      const malformedProduct: any = {
        id: '1',
        title: null,
        url: 'https://example.com',
        retailer: 'test',
        category: 'test',
        extractedAt: new Date()
      };

      expect(() => service.normalizeProduct(malformedProduct)).toThrow();
    });

    it('should return empty matches on error', async () => {
      const targetProduct = sampleProducts[0];
      const malformedCandidates: any[] = [null, undefined];

      const matches = await service.findMatches(targetProduct, malformedCandidates);
      expect(matches).toEqual([]);
    });

    it('should return empty duplicate groups on error', async () => {
      const malformedProducts: any[] = [null, undefined];

      const duplicateGroups = await service.detectDuplicates(malformedProducts);
      expect(duplicateGroups).toEqual([]);
    });
  });
});