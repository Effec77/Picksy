import { config } from '../config/config.js';

export interface TierFeatures {
  tier: string;
  name: string;
  description: string;
  price: number;
  limits: {
    productsTracked: number;
    priceChecksPerDay: number;
    notificationsPerDay: number;
    apiRequestsPerHour: number;
    dataRetentionDays: number;
  };
  features: string[];
  isPopular?: boolean;
}

export interface UsageStats {
  userId: string;
  tier: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  productsTracked: number;
  priceChecksToday: number;
  notificationsToday: number;
  apiRequestsThisHour: number;
}

export class ExtensionSubscriptionService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = config.apiBaseUrl || 'http://localhost:3000/api';
  }

  async getTiers(): Promise<{ tiers: TierFeatures[]; currentTier: string }> {
    try {
      const token = await this.getAuthToken();
      const response = await fetch(`${this.apiBaseUrl}/subscription/tiers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching subscription tiers:', error);
      throw error;
    }
  }

  async getUserUsage(): Promise<UsageStats | null> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return null;
      }

      const response = await fetch(`${this.apiBaseUrl}/subscription/usage`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          return null; // User not authenticated
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data.usage;
    } catch (error) {
      console.error('Error fetching user usage:', error);
      return null;
    }
  }

  async checkUsageLimit(action: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { allowed: false, current: 0, limit: 0 };
      }

      const response = await fetch(`${this.apiBaseUrl}/subscription/check-limit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error checking usage limit:', error);
      return { allowed: false, current: 0, limit: 0 };
    }
  }

  async upgradeSubscription(targetTier: string): Promise<boolean> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return false;
      }

      const response = await fetch(`${this.apiBaseUrl}/subscription/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetTier })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      return false;
    }
  }

  private async getAuthToken(): Promise<string | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['authToken'], (result) => {
        resolve(result.authToken || null);
      });
    });
  }

  formatPrice(priceInCents: number): string {
    if (priceInCents === 0) {
      return 'Free';
    }
    return `$${(priceInCents / 100).toFixed(2)}`;
  }

  getUsagePercentage(current: number, limit: number): number {
    if (limit === -1) return 0; // Unlimited
    if (limit === 0) return 100;
    return Math.min((current / limit) * 100, 100);
  }

  isNearLimit(current: number, limit: number, threshold: number = 80): boolean {
    if (limit === -1) return false; // Unlimited
    return this.getUsagePercentage(current, limit) >= threshold;
  }
}