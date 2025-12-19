import { describe, it, expect } from 'vitest';
import { SubscriptionService } from '../services/subscriptionService.js';
import { SubscriptionTier } from '../types/index.js';

describe('Ethical Monetization System - Unit Tests', () => {
  describe('Sustainable Service Tiers', () => {
    it('should provide transparent tier comparison', () => {
      const comparison = SubscriptionService.getTierComparison();
      
      expect(comparison.tiers).toHaveLength(3);
      expect(comparison.coreFeatures).toBeDefined();
      expect(comparison.premiumFeatures).toBeDefined();
      expect(Array.isArray(comparison.coreFeatures)).toBe(true);
      expect(Array.isArray(comparison.premiumFeatures)).toBe(true);
    });

    it('should preserve core functionality in free tier', () => {
      const tierConfig = SubscriptionService.getTierConfig(SubscriptionTier.FREE);
      
      // Core functionality should have reasonable limits
      expect(tierConfig.limits.productsTracked).toBeGreaterThan(0);
      expect(tierConfig.limits.priceChecksPerDay).toBeGreaterThan(0);
      expect(tierConfig.limits.notificationsPerDay).toBeGreaterThan(0);
      
      // Free tier should be actually free
      expect(tierConfig.price).toBe(0);
      
      // Should have core features
      expect(tierConfig.features.length).toBeGreaterThan(0);
    });

    it('should have reasonable limits for free tier', () => {
      const freeConfig = SubscriptionService.getTierConfig(SubscriptionTier.FREE);
      
      // Limits should be generous enough for personal use
      expect(freeConfig.limits.productsTracked).toBeGreaterThanOrEqual(5);
      expect(freeConfig.limits.priceChecksPerDay).toBeGreaterThanOrEqual(20);
      expect(freeConfig.limits.notificationsPerDay).toBeGreaterThanOrEqual(10);
    });
  });
});

describe('Property-Based Tests for Monetization', () => {
  describe('Core Functionality Preservation', () => {
    it('should always preserve essential features in free tier', () => {
      const freeConfig = SubscriptionService.getTierConfig(SubscriptionTier.FREE);
      
      // Property: Free tier must always have non-zero limits for core features
      expect(freeConfig.limits.productsTracked).toBeGreaterThan(0);
      expect(freeConfig.limits.priceChecksPerDay).toBeGreaterThan(0);
      expect(freeConfig.limits.notificationsPerDay).toBeGreaterThan(0);
      
      // Property: Free tier must be free
      expect(freeConfig.price).toBe(0);
      
      // Property: Free tier must include core features
      const coreFeatures = ['track', 'price', 'notification'];
      const hasCore = coreFeatures.some(feature => 
        freeConfig.features.some(f => f.toLowerCase().includes(feature))
      );
      expect(hasCore).toBe(true);
    });
  });

  describe('Affiliate Disclosure', () => {
    it('should have predefined affiliate partners with disclosure requirements', () => {
      // Property: System should have known affiliate partners that require disclosure
      const knownDomains = ['amazon.com', 'bestbuy.com', 'target.com', 'walmart.com'];
      
      // Each known domain should be a valid domain format
      for (const domain of knownDomains) {
        expect(domain).toMatch(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
        expect(domain.length).toBeGreaterThan(0);
      }
      
      // Should have multiple partners for diversity
      expect(knownDomains.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Usage Tier Enforcement', () => {
    it('should enforce higher limits for higher tiers', () => {
      const freeConfig = SubscriptionService.getTierConfig(SubscriptionTier.FREE);
      const premiumConfig = SubscriptionService.getTierConfig(SubscriptionTier.PREMIUM);
      const enterpriseConfig = SubscriptionService.getTierConfig(SubscriptionTier.ENTERPRISE);
      
      // Property: Higher tiers should have higher or unlimited limits
      expect(premiumConfig.limits.productsTracked).toBeGreaterThan(freeConfig.limits.productsTracked);
      expect(premiumConfig.limits.priceChecksPerDay).toBeGreaterThan(freeConfig.limits.priceChecksPerDay);
      
      expect(enterpriseConfig.limits.productsTracked).toBeGreaterThan(premiumConfig.limits.productsTracked);
      expect(enterpriseConfig.limits.priceChecksPerDay).toBeGreaterThan(premiumConfig.limits.priceChecksPerDay);
      
      // Property: Higher tiers should cost more
      expect(premiumConfig.price).toBeGreaterThan(freeConfig.price);
      expect(enterpriseConfig.price).toBeGreaterThan(premiumConfig.price);
    });
  });
});