import { db } from '../database/connection.js';
import { redis } from '../database/redis.js';
import { logger } from '../utils/logger.js';
import { 
  SubscriptionTier, 
  TierFeatures, 
  SubscriptionLimits, 
  UsageStats,
  ErrorCode 
} from '../types/index.js';

export class SubscriptionService {
  // Define tier configurations
  private static readonly TIER_CONFIGS: Record<SubscriptionTier, TierFeatures> = {
    [SubscriptionTier.FREE]: {
      tier: SubscriptionTier.FREE,
      name: 'Free',
      description: 'Perfect for casual price tracking',
      price: 0,
      limits: {
        productsTracked: 10,
        priceChecksPerDay: 50,
        notificationsPerDay: 20,
        apiRequestsPerHour: 100,
        dataRetentionDays: 30
      },
      features: [
        'Track up to 10 products',
        '50 price checks per day',
        '20 notifications per day',
        '30 days data retention',
        'Basic price alerts'
      ]
    },
    [SubscriptionTier.PREMIUM]: {
      tier: SubscriptionTier.PREMIUM,
      name: 'Premium',
      description: 'For serious deal hunters',
      price: 999, // $9.99
      limits: {
        productsTracked: 100,
        priceChecksPerDay: 500,
        notificationsPerDay: 200,
        apiRequestsPerHour: 1000,
        dataRetentionDays: 365
      },
      features: [
        'Track up to 100 products',
        '500 price checks per day',
        '200 notifications per day',
        '1 year data retention',
        'Advanced price analytics',
        'Priority notifications',
        'Email notifications',
        'Price history charts'
      ],
      isPopular: true
    },
    [SubscriptionTier.ENTERPRISE]: {
      tier: SubscriptionTier.ENTERPRISE,
      name: 'Enterprise',
      description: 'For businesses and power users',
      price: 4999, // $49.99
      limits: {
        productsTracked: 1000,
        priceChecksPerDay: 5000,
        notificationsPerDay: 1000,
        apiRequestsPerHour: 10000,
        dataRetentionDays: -1 // unlimited
      },
      features: [
        'Track up to 1000 products',
        '5000 price checks per day',
        '1000 notifications per day',
        'Unlimited data retention',
        'Advanced analytics dashboard',
        'API access',
        'Bulk operations',
        'Priority support',
        'Custom integrations'
      ]
    }
  };

  static getTierConfig(tier: SubscriptionTier): TierFeatures {
    return this.TIER_CONFIGS[tier];
  }

  static getAllTierConfigs(): TierFeatures[] {
    return Object.values(this.TIER_CONFIGS);
  }

  static getLimits(tier: SubscriptionTier): SubscriptionLimits {
    return this.TIER_CONFIGS[tier].limits;
  }

  async getUserUsageStats(userId: string): Promise<UsageStats | null> {
    try {
      // Get user's current tier
      const userQuery = `
        SELECT subscription_tier 
        FROM users 
        WHERE id = $1 AND is_active = true
      `;
      const userResult = await db.query(userQuery, [userId]);
      
      if (!userResult?.rows || userResult.rows.length === 0) {
        return null;
      }

      const tier = userResult.rows[0].subscription_tier as SubscriptionTier;
      
      // Calculate current period (daily for most limits)
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      
      // Get usage from Redis (for real-time counters)
      const usageKey = `usage:${userId}:${startOfDay.toISOString().split('T')[0]}`;
      const usageData = await redis.hgetall(usageKey);
      
      // Get products tracked count from database
      const productsQuery = `
        SELECT COUNT(*) as count 
        FROM tracked_products 
        WHERE user_id = $1 AND is_active = true
      `;
      const productsResult = await db.query(productsQuery, [userId]);
      const productsTracked = parseInt(productsResult?.rows?.[0]?.count || '0');

      return {
        userId,
        tier,
        currentPeriodStart: startOfDay,
        currentPeriodEnd: endOfDay,
        productsTracked,
        priceChecksToday: parseInt(usageData.priceChecks || '0'),
        notificationsToday: parseInt(usageData.notifications || '0'),
        apiRequestsThisHour: await this.getHourlyApiRequests(userId)
      };
    } catch (error) {
      logger.error('Error getting user usage stats', { userId, error });
      return null;
    }
  }

  private async getHourlyApiRequests(userId: string): Promise<number> {
    const now = new Date();
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    const hourKey = `api_requests:${userId}:${currentHour.toISOString()}`;
    
    const count = await redis.get(hourKey);
    return parseInt(count || '0');
  }

  async incrementUsage(userId: string, type: 'priceChecks' | 'notifications' | 'apiRequests'): Promise<void> {
    try {
      const now = new Date();
      
      if (type === 'apiRequests') {
        // Track hourly API requests
        const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
        const hourKey = `api_requests:${userId}:${currentHour.toISOString()}`;
        await redis.incr(hourKey);
        await redis.expire(hourKey, 3600); // Expire after 1 hour
      } else {
        // Track daily usage
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const usageKey = `usage:${userId}:${startOfDay.toISOString().split('T')[0]}`;
        await redis.hincrby(usageKey, type, 1);
        await redis.expire(usageKey, 86400); // Expire after 24 hours
      }
    } catch (error) {
      logger.error('Error incrementing usage', { userId, type, error });
    }
  }

  async checkUsageLimit(userId: string, type: keyof SubscriptionLimits): Promise<{ allowed: boolean; current: number; limit: number }> {
    try {
      const stats = await this.getUserUsageStats(userId);
      if (!stats) {
        throw new Error('User not found');
      }

      const limits = SubscriptionService.getLimits(stats.tier);
      let current = 0;
      let limit = 0;

      switch (type) {
        case 'productsTracked':
          current = stats.productsTracked;
          limit = limits.productsTracked;
          break;
        case 'priceChecksPerDay':
          current = stats.priceChecksToday;
          limit = limits.priceChecksPerDay;
          break;
        case 'notificationsPerDay':
          current = stats.notificationsToday;
          limit = limits.notificationsPerDay;
          break;
        case 'apiRequestsPerHour':
          current = stats.apiRequestsThisHour;
          limit = limits.apiRequestsPerHour;
          break;
        default:
          return { allowed: true, current: 0, limit: -1 };
      }

      return {
        allowed: limit === -1 || current < limit,
        current,
        limit
      };
    } catch (error) {
      logger.error('Error checking usage limit', { userId, type, error });
      return { allowed: false, current: 0, limit: 0 };
    }
  }

  async upgradeUserTier(userId: string, newTier: SubscriptionTier): Promise<boolean> {
    try {
      const query = `
        UPDATE users 
        SET subscription_tier = $1, updated_at = NOW()
        WHERE id = $2 AND is_active = true
        RETURNING id
      `;
      
      const result = await db.query(query, [newTier, userId]);
      
      if (result?.rows && result.rows.length > 0) {
        logger.info('User tier upgraded', { userId, newTier });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error upgrading user tier', { userId, newTier, error });
      return false;
    }
  }

  async getUserTier(userId: string): Promise<SubscriptionTier | null> {
    try {
      const query = `
        SELECT subscription_tier 
        FROM users 
        WHERE id = $1 AND is_active = true
      `;
      
      const result = await db.query(query, [userId]);
      
      if (result?.rows && result.rows.length > 0) {
        return result.rows[0].subscription_tier as SubscriptionTier;
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting user tier', { userId, error });
      return null;
    }
  }

  async canUserPerformAction(userId: string, action: keyof SubscriptionLimits): Promise<boolean> {
    const limitCheck = await this.checkUsageLimit(userId, action);
    return limitCheck.allowed;
  }

  /**
   * Get tier comparison for pricing page
   * Ensures core functionality is preserved in free tier
   */
  static getTierComparison(): {
    tiers: TierFeatures[];
    coreFeatures: string[];
    premiumFeatures: string[];
  } {
    const tiers = this.getAllTierConfigs();
    
    // Core features that must remain available in free tier
    const coreFeatures = [
      'Basic price tracking',
      'Price change notifications',
      'Product management',
      'Browser extension access'
    ];
    
    // Premium features that can be restricted
    const premiumFeatures = [
      'Advanced analytics',
      'Email notifications',
      'Extended data retention',
      'Priority support',
      'API access',
      'Bulk operations'
    ];
    
    return {
      tiers,
      coreFeatures,
      premiumFeatures
    };
  }

  /**
   * Enforce fair usage policies while preserving core functionality
   */
  async enforceUsagePolicy(userId: string, action: keyof SubscriptionLimits): Promise<{
    allowed: boolean;
    reason?: string;
    upgradeRequired?: boolean;
    gracePeriod?: boolean;
  }> {
    try {
      const limitCheck = await this.checkUsageLimit(userId, action);
      
      if (limitCheck.allowed) {
        return { allowed: true };
      }

      const userTier = await this.getUserTier(userId);
      
      // For free tier users, provide grace period for core functionality
      if (userTier === SubscriptionTier.FREE) {
        const isCoreFunctionality = this.isCoreFunction(action);
        
        if (isCoreFunctionality) {
          // Allow limited overage for core functions with warning
          const overage = limitCheck.current - limitCheck.limit;
          const maxGraceOverage = Math.floor(limitCheck.limit * 0.1); // 10% grace
          
          if (overage <= maxGraceOverage) {
            return {
              allowed: true,
              gracePeriod: true,
              reason: `You've exceeded your ${action} limit but we're allowing this as core functionality. Consider upgrading for unlimited access.`
            };
          }
        }
        
        return {
          allowed: false,
          upgradeRequired: true,
          reason: `You've reached your ${action} limit (${limitCheck.current}/${limitCheck.limit}). Upgrade to continue with unlimited access.`
        };
      }
      
      // For paid tiers, strict enforcement
      return {
        allowed: false,
        reason: `Usage limit exceeded for ${action} (${limitCheck.current}/${limitCheck.limit}). Your limit will reset in the next billing period.`
      };
    } catch (error) {
      logger.error('Error enforcing usage policy', { userId, action, error });
      return { allowed: false, reason: 'Unable to verify usage limits' };
    }
  }

  /**
   * Determine if an action is core functionality that should have grace period
   */
  private isCoreFunction(action: keyof SubscriptionLimits): boolean {
    const coreFunctions: (keyof SubscriptionLimits)[] = [
      'productsTracked',
      'priceChecksPerDay',
      'notificationsPerDay'
    ];
    
    return coreFunctions.includes(action);
  }

  /**
   * Get usage recommendations for users approaching limits
   */
  async getUsageRecommendations(userId: string): Promise<{
    warnings: Array<{
      type: keyof SubscriptionLimits;
      current: number;
      limit: number;
      percentage: number;
      recommendation: string;
    }>;
    upgradeRecommendation?: {
      suggestedTier: SubscriptionTier;
      benefits: string[];
      savings?: string;
    };
  }> {
    try {
      const stats = await this.getUserUsageStats(userId);
      if (!stats) {
        return { warnings: [] };
      }

      const limits = SubscriptionService.getLimits(stats.tier);
      const warnings = [];

      // Check each usage type
      const usageChecks = [
        { type: 'productsTracked' as const, current: stats.productsTracked, limit: limits.productsTracked },
        { type: 'priceChecksPerDay' as const, current: stats.priceChecksToday, limit: limits.priceChecksPerDay },
        { type: 'notificationsPerDay' as const, current: stats.notificationsToday, limit: limits.notificationsPerDay },
        { type: 'apiRequestsPerHour' as const, current: stats.apiRequestsThisHour, limit: limits.apiRequestsPerHour }
      ];

      for (const check of usageChecks) {
        if (check.limit > 0) { // Skip unlimited limits
          const percentage = (check.current / check.limit) * 100;
          
          if (percentage >= 80) { // Warn at 80% usage
            warnings.push({
              type: check.type,
              current: check.current,
              limit: check.limit,
              percentage,
              recommendation: this.getUsageRecommendation(check.type, percentage)
            });
          }
        }
      }

      // Suggest upgrade if user is consistently hitting limits
      let upgradeRecommendation;
      if (warnings.length >= 2 && stats.tier === SubscriptionTier.FREE) {
        upgradeRecommendation = {
          suggestedTier: SubscriptionTier.PREMIUM,
          benefits: [
            '10x more products to track',
            '10x more price checks per day',
            'Advanced analytics and insights',
            'Email notifications',
            'Priority support'
          ],
          savings: 'Save time and never miss a deal again'
        };
      }

      return { warnings, upgradeRecommendation };
    } catch (error) {
      logger.error('Error getting usage recommendations', { userId, error });
      return { warnings: [] };
    }
  }

  private getUsageRecommendation(type: keyof SubscriptionLimits, percentage: number): string {
    const recommendations = {
      productsTracked: percentage >= 95 
        ? 'You\'re at your product tracking limit. Consider upgrading or removing unused products.'
        : 'You\'re approaching your product tracking limit. Consider upgrading for unlimited tracking.',
      priceChecksPerDay: percentage >= 95
        ? 'You\'ve used most of your daily price checks. They\'ll reset tomorrow, or upgrade for more.'
        : 'You\'re using most of your daily price checks. Consider upgrading for unlimited checks.',
      notificationsPerDay: percentage >= 95
        ? 'You\'re at your daily notification limit. Consider upgrading for unlimited notifications.'
        : 'You\'re approaching your daily notification limit. Upgrade for unlimited alerts.',
      apiRequestsPerHour: percentage >= 95
        ? 'You\'re at your hourly API limit. It will reset next hour, or upgrade for higher limits.'
        : 'You\'re approaching your hourly API limit. Consider upgrading for higher limits.',
      dataRetentionDays: 'Your data retention period is limited. Upgrade for longer history.'
    };

    return recommendations[type] || 'Consider upgrading for better limits.';
  }

  /**
   * Get subscription metrics for revenue reporting
   */
  async getSubscriptionMetrics(startDate: Date, endDate: Date): Promise<{
    totalSubscribers: number;
    activeSubscribers: number;
    newSubscribers: number;
    churnedSubscribers: number;
    tierDistribution: Record<SubscriptionTier, number>;
    estimatedMonthlyRevenue: number;
  }> {
    try {
      // Get total and active subscribers
      const totalQuery = `
        SELECT COUNT(*) as total, 
               COUNT(CASE WHEN is_active = true THEN 1 END) as active
        FROM users
      `;
      const totalResult = await db.query(totalQuery);
      const totals = totalResult?.rows?.[0] || { total: 0, active: 0 };

      // Get new subscribers in period
      const newSubscribersQuery = `
        SELECT COUNT(*) as count
        FROM users 
        WHERE created_at BETWEEN $1 AND $2
      `;
      const newResult = await db.query(newSubscribersQuery, [startDate, endDate]);
      const newSubscribers = parseInt(newResult?.rows?.[0]?.count || '0');

      // Get churned subscribers (simplified - would need to track cancellation dates)
      const churnedSubscribers = 0; // Would implement proper churn tracking

      // Get tier distribution
      const tierQuery = `
        SELECT subscription_tier, COUNT(*) as count
        FROM users 
        WHERE is_active = true
        GROUP BY subscription_tier
      `;
      const tierResult = await db.query(tierQuery);
      
      const tierDistribution: Record<SubscriptionTier, number> = {
        [SubscriptionTier.FREE]: 0,
        [SubscriptionTier.PREMIUM]: 0,
        [SubscriptionTier.ENTERPRISE]: 0
      };

      tierResult?.rows?.forEach(row => {
        tierDistribution[row.subscription_tier as SubscriptionTier] = parseInt(row.count);
      });

      // Calculate estimated monthly revenue
      const premiumRevenue = tierDistribution[SubscriptionTier.PREMIUM] * 999; // $9.99
      const enterpriseRevenue = tierDistribution[SubscriptionTier.ENTERPRISE] * 4999; // $49.99
      const estimatedMonthlyRevenue = premiumRevenue + enterpriseRevenue;

      return {
        totalSubscribers: parseInt(totals.total),
        activeSubscribers: parseInt(totals.active),
        newSubscribers,
        churnedSubscribers,
        tierDistribution,
        estimatedMonthlyRevenue
      };
    } catch (error) {
      logger.error('Error getting subscription metrics', { startDate, endDate, error });
      return {
        totalSubscribers: 0,
        activeSubscribers: 0,
        newSubscribers: 0,
        churnedSubscribers: 0,
        tierDistribution: {
          [SubscriptionTier.FREE]: 0,
          [SubscriptionTier.PREMIUM]: 0,
          [SubscriptionTier.ENTERPRISE]: 0
        },
        estimatedMonthlyRevenue: 0
      };
    }
  }
}