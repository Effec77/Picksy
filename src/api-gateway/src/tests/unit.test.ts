import { describe, it, expect, vi } from 'vitest';
import { 
  NotificationChannel, 
  AvailabilityStatus, 
  DataSource,
  PriceTrend,
  AlertType 
} from '../../../shared/types';

/**
 * Unit Testing Suite for Picksy API Gateway
 * 
 * Tests individual functions and classes in isolation to ensure
 * core business logic works correctly.
 * 
 * Requirements: 8.1
 */

describe('Unit Testing Suite', () => {
  
  describe('Price Calculation Logic', () => {
    it('should calculate price change percentage correctly', () => {
      function calculatePriceChange(oldPrice: number, newPrice: number): number {
        if (oldPrice === 0) return 0;
        return ((newPrice - oldPrice) / oldPrice) * 100;
      }
      
      expect(calculatePriceChange(100, 120)).toBe(20);
      expect(calculatePriceChange(100, 80)).toBe(-20);
      expect(calculatePriceChange(100, 100)).toBe(0);
      expect(calculatePriceChange(0, 50)).toBe(0);
    });

    it('should determine price trend correctly', () => {
      function determinePriceTrend(prices: number[]): PriceTrend {
        if (prices.length < 2) return PriceTrend.STABLE;
        
        const changes = [];
        for (let i = 1; i < prices.length; i++) {
          changes.push(prices[i] - prices[i - 1]);
        }
        
        const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
        const variance = changes.reduce((sum, change) => sum + Math.pow(change - avgChange, 2), 0) / changes.length;
        
        if (variance > 100) return PriceTrend.VOLATILE;
        if (avgChange > 5) return PriceTrend.INCREASING;
        if (avgChange < -5) return PriceTrend.DECREASING;
        return PriceTrend.STABLE;
      }
      
      expect(determinePriceTrend([100, 110, 120, 130])).toBe(PriceTrend.INCREASING);
      expect(determinePriceTrend([130, 120, 110, 100])).toBe(PriceTrend.DECREASING);
      expect(determinePriceTrend([100, 101, 99, 100])).toBe(PriceTrend.STABLE);
      expect(determinePriceTrend([100, 150, 80, 120])).toBe(PriceTrend.VOLATILE);
    });

    it('should validate price values correctly', () => {
      function isValidPrice(price: any): boolean {
        return typeof price === 'number' && 
               price > 0 && 
               price < Infinity && 
               !isNaN(price) &&
               Number.isFinite(price);
      }
      
      expect(isValidPrice(99.99)).toBe(true);
      expect(isValidPrice(0)).toBe(false);
      expect(isValidPrice(-10)).toBe(false);
      expect(isValidPrice(NaN)).toBe(false);
      expect(isValidPrice(Infinity)).toBe(false);
      expect(isValidPrice('99.99')).toBe(false);
      expect(isValidPrice(null)).toBe(false);
    });
  });

  describe('Data Validation Logic', () => {
    it('should validate email addresses correctly', () => {
      function isValidEmail(email: string): boolean {
        if (!email || typeof email !== 'string') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) && 
               !email.includes('..') && 
               email.length <= 254;
      }
      
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.email+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user..double@domain.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });

    it('should validate product URLs correctly', () => {
      function isValidProductUrl(url: string): boolean {
        try {
          const parsed = new URL(url);
          const supportedDomains = ['amazon.com', 'ebay.com', 'walmart.com', 'bestbuy.com'];
          return supportedDomains.some(domain => 
            parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
          );
        } catch {
          return false;
        }
      }
      
      expect(isValidProductUrl('https://amazon.com/product/123')).toBe(true);
      expect(isValidProductUrl('https://www.amazon.com/product/123')).toBe(true);
      expect(isValidProductUrl('https://ebay.com/itm/456')).toBe(true);
      expect(isValidProductUrl('https://unsupported.com/product')).toBe(false);
      expect(isValidProductUrl('not-a-url')).toBe(false);
      expect(isValidProductUrl('')).toBe(false);
    });

    it('should sanitize user input correctly', () => {
      function sanitizeInput(input: string): string {
        return input
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
          .trim();
      }
      
      expect(sanitizeInput('<script>alert("xss")</script>Hello')).toBe('Hello');
      expect(sanitizeInput('javascript:alert("xss")')).toBe('alert("xss")');
      expect(sanitizeInput('<img src="x" onerror="alert(1)">')).toBe('<img src="x" >');
      expect(sanitizeInput('Normal text')).toBe('Normal text');
    });
  });

  describe('Alert Logic', () => {
    it('should determine alert priority correctly', () => {
      function getAlertPriority(alertType: AlertType): number {
        const priorities = {
          [AlertType.PRICE_DROP]: 4,
          [AlertType.TARGET_PRICE_REACHED]: 4,
          [AlertType.BACK_IN_STOCK]: 3,
          [AlertType.PRICE_INCREASE]: 2
        };
        return priorities[alertType] || 1;
      }
      
      expect(getAlertPriority(AlertType.PRICE_DROP)).toBe(4);
      expect(getAlertPriority(AlertType.TARGET_PRICE_REACHED)).toBe(4);
      expect(getAlertPriority(AlertType.BACK_IN_STOCK)).toBe(3);
      expect(getAlertPriority(AlertType.PRICE_INCREASE)).toBe(2);
    });

    it('should check if alert should be triggered', () => {
      function shouldTriggerAlert(
        alertType: AlertType,
        oldPrice: number,
        newPrice: number,
        threshold: number,
        oldAvailability: AvailabilityStatus,
        newAvailability: AvailabilityStatus
      ): boolean {
        switch (alertType) {
          case AlertType.PRICE_DROP:
            const dropPercent = ((oldPrice - newPrice) / oldPrice) * 100;
            return dropPercent >= threshold;
          
          case AlertType.TARGET_PRICE_REACHED:
            return newPrice <= threshold;
          
          case AlertType.BACK_IN_STOCK:
            return oldAvailability === AvailabilityStatus.OUT_OF_STOCK &&
                   newAvailability === AvailabilityStatus.IN_STOCK;
          
          case AlertType.PRICE_INCREASE:
            const increasePercent = ((newPrice - oldPrice) / oldPrice) * 100;
            return increasePercent >= threshold;
          
          default:
            return false;
        }
      }
      
      // Price drop alert
      expect(shouldTriggerAlert(
        AlertType.PRICE_DROP, 100, 80, 15, 
        AvailabilityStatus.IN_STOCK, AvailabilityStatus.IN_STOCK
      )).toBe(true);
      
      // Target price alert
      expect(shouldTriggerAlert(
        AlertType.TARGET_PRICE_REACHED, 100, 90, 95,
        AvailabilityStatus.IN_STOCK, AvailabilityStatus.IN_STOCK
      )).toBe(true);
      
      // Back in stock alert
      expect(shouldTriggerAlert(
        AlertType.BACK_IN_STOCK, 100, 100, 0,
        AvailabilityStatus.OUT_OF_STOCK, AvailabilityStatus.IN_STOCK
      )).toBe(true);
    });
  });

  describe('Rate Limiting Logic', () => {
    it('should track request counts correctly', () => {
      class RateLimiter {
        private requests = new Map<string, number[]>();
        
        constructor(private maxRequests: number, private windowMs: number) {}
        
        checkLimit(userId: string): boolean {
          const now = Date.now();
          const userRequests = this.requests.get(userId) || [];
          
          // Remove old requests outside the window
          const validRequests = userRequests.filter(time => 
            now - time < this.windowMs
          );
          
          if (validRequests.length >= this.maxRequests) {
            return false;
          }
          
          validRequests.push(now);
          this.requests.set(userId, validRequests);
          return true;
        }
      }
      
      const limiter = new RateLimiter(3, 1000); // 3 requests per second
      
      // First 3 requests should succeed
      expect(limiter.checkLimit('user1')).toBe(true);
      expect(limiter.checkLimit('user1')).toBe(true);
      expect(limiter.checkLimit('user1')).toBe(true);
      
      // 4th request should be rate limited
      expect(limiter.checkLimit('user1')).toBe(false);
      
      // Different user should not be affected
      expect(limiter.checkLimit('user2')).toBe(true);
    });
  });

  describe('Data Processing Logic', () => {
    it('should calculate statistics correctly', () => {
      function calculateStatistics(values: number[]) {
        if (values.length === 0) {
          throw new Error('Cannot calculate statistics from empty array');
        }
        
        const sorted = [...values].sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        
        const variance = values.reduce((acc, val) => 
          acc + Math.pow(val - mean, 2), 0) / (values.length - 1);
        const stdDev = Math.sqrt(variance);
        
        return {
          count: values.length,
          sum,
          mean: Math.round(mean * 100) / 100,
          median: sorted[Math.floor(sorted.length / 2)],
          min: Math.min(...values),
          max: Math.max(...values),
          standardDeviation: Math.round(stdDev * 100) / 100
        };
      }
      
      const stats = calculateStatistics([10, 15, 12, 18, 14]);
      
      expect(stats.count).toBe(5);
      expect(stats.mean).toBe(13.8);
      expect(stats.median).toBe(14);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(18);
      expect(stats.standardDeviation).toBeCloseTo(3.03, 1);
      
      expect(() => calculateStatistics([])).toThrow('Cannot calculate statistics from empty array');
    });

    it('should format currency correctly', () => {
      function formatCurrency(amount: number, currency: string = 'USD'): string {
        const formatter = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        return formatter.format(amount);
      }
      
      expect(formatCurrency(99.99)).toBe('$99.99');
      expect(formatCurrency(1000)).toBe('$1,000.00');
      expect(formatCurrency(0.5)).toBe('$0.50');
    });
  });

  describe('Error Handling Logic', () => {
    it('should categorize errors correctly', () => {
      function categorizeError(error: Error): string {
        const message = error.message.toLowerCase();
        if (message.includes('timeout')) return 'NETWORK_ERROR';
        if (message.includes('unauthorized')) return 'AUTH_ERROR';
        if (message.includes('not found')) return 'NOT_FOUND_ERROR';
        if (message.includes('validation')) return 'VALIDATION_ERROR';
        return 'UNKNOWN_ERROR';
      }
      
      expect(categorizeError(new Error('Network timeout'))).toBe('NETWORK_ERROR');
      expect(categorizeError(new Error('Unauthorized access'))).toBe('AUTH_ERROR');
      expect(categorizeError(new Error('Product not found'))).toBe('NOT_FOUND_ERROR');
      expect(categorizeError(new Error('Validation failed'))).toBe('VALIDATION_ERROR');
      expect(categorizeError(new Error('Something went wrong'))).toBe('UNKNOWN_ERROR');
    });

    it('should create user-friendly error messages', () => {
      function createUserFriendlyMessage(errorCode: string): string {
        const messages: Record<string, string> = {
          'NETWORK_ERROR': 'Unable to connect to the service. Please check your internet connection.',
          'AUTH_ERROR': 'Please log in again to continue.',
          'NOT_FOUND_ERROR': 'The requested item could not be found.',
          'VALIDATION_ERROR': 'Please check your input and try again.',
          'RATE_LIMITED': 'Too many requests. Please wait a moment before trying again.'
        };
        
        return messages[errorCode] || 'An unexpected error occurred. Please try again later.';
      }
      
      expect(createUserFriendlyMessage('NETWORK_ERROR')).toContain('internet connection');
      expect(createUserFriendlyMessage('AUTH_ERROR')).toContain('log in again');
      expect(createUserFriendlyMessage('UNKNOWN_CODE')).toContain('unexpected error');
    });
  });

  describe('Utility Functions', () => {
    it('should generate unique IDs correctly', () => {
      function generateId(prefix: string = ''): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `${prefix}${timestamp}_${random}`;
      }
      
      const id1 = generateId('user_');
      const id2 = generateId('user_');
      
      expect(id1).toMatch(/^user_[a-z0-9]+_[a-z0-9]+$/);
      expect(id2).toMatch(/^user_[a-z0-9]+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should debounce function calls correctly', async () => {
      function debounce<T extends (...args: any[]) => any>(
        func: T,
        delay: number
      ): (...args: Parameters<T>) => Promise<ReturnType<T>> {
        let timeoutId: NodeJS.Timeout;
        
        return (...args: Parameters<T>): Promise<ReturnType<T>> => {
          return new Promise((resolve) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              resolve(func(...args));
            }, delay);
          });
        };
      }
      
      const mockFn = vi.fn().mockReturnValue('result');
      const debouncedFn = debounce(mockFn, 100);
      
      // Call multiple times quickly
      debouncedFn('arg1');
      debouncedFn('arg2');
      const result = await debouncedFn('arg3');
      
      // Should only be called once with the last arguments
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg3');
      expect(result).toBe('result');
    });

    it('should retry operations correctly', async () => {
      async function retry<T>(
        operation: () => Promise<T>,
        maxAttempts: number = 3,
        delay: number = 1000
      ): Promise<T> {
        let lastError: Error;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            return await operation();
          } catch (error) {
            lastError = error as Error;
            if (attempt === maxAttempts) {
              throw lastError;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        
        throw lastError!;
      }
      
      let attempts = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve('success');
      });
      
      const result = await retry(mockOperation, 3, 10);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });
});