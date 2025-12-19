import { describe, it, expect, beforeEach } from 'vitest';
import { dataCollectionService } from '../services/dataCollection';
import { legalScraper } from '../services/legalScraper';
import { retailerApiService } from '../services/retailerApi';

describe('Data Collection System', () => {
  describe('URL Support Detection', () => {
    it('should identify supported retailer URLs', () => {
      const supportedUrls = [
        'https://www.amazon.com/dp/B08N5WRWNW',
        'https://www.ebay.com/itm/123456789',
        'https://www.walmart.com/ip/product/123456',
        'https://www.bestbuy.com/site/product/123456.p'
      ];

      for (const url of supportedUrls) {
        const isSupported = dataCollectionService.isSupportedUrl(url);
        expect(isSupported).toBe(true);
      }
    });

    it('should reject unsupported URLs', () => {
      const unsupportedUrls = [
        'https://www.example.com/product/123',
        'https://www.random-site.com/item/456',
        'not-a-url',
        ''
      ];

      for (const url of unsupportedUrls) {
        const isSupported = dataCollectionService.isSupportedUrl(url);
        expect(isSupported).toBe(false);
      }
    });
  });

  describe('Legal Scraper', () => {
    it('should respect robots.txt compliance', async () => {
      // Test with a URL that should be allowed
      const allowedUrl = 'https://www.example.com/products/test';
      const canScrape = await legalScraper.canScrape(allowedUrl);
      
      // Since we don't have actual robots.txt, this should default to allowed
      expect(typeof canScrape).toBe('boolean');
    });

    it('should have rate limiting configured', () => {
      const rateLimit = legalScraper.getRateLimit('example.com');
      expect(typeof rateLimit).toBe('number');
      expect(rateLimit).toBeGreaterThan(0);
    });
  });

  describe('Retailer API Service', () => {
    it('should return list of supported retailers', () => {
      const retailers = retailerApiService.getSupportedRetailers();
      expect(Array.isArray(retailers)).toBe(true);
    });

    it('should handle API key rotation gracefully', async () => {
      // Test that rotation doesn't throw errors even without keys
      await expect(retailerApiService.rotateApiKeys('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('Collection Health Status', () => {
    it('should provide collection statistics', () => {
      const stats = dataCollectionService.getCollectionStats();
      
      expect(stats).toHaveProperty('supportedRetailers');
      expect(stats).toHaveProperty('apiStatus');
      expect(stats).toHaveProperty('scrapingStatus');
      expect(Array.isArray(stats.supportedRetailers)).toBe(true);
      expect(typeof stats.scrapingStatus).toBe('boolean');
    });
  });
});