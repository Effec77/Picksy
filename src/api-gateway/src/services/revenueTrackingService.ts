import { db } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { AffiliateService } from './affiliateService.js';
import { SubscriptionService } from './subscriptionService.js';
import { 
  RevenueReport,
  SubscriptionTier,
  AffiliatePartner 
} from '../types/index.js';

export interface DetailedRevenueReport extends RevenueReport {
  subscriptionMetrics: {
    totalSubscribers: number;
    activeSubscribers: number;
    newSubscribers: number;
    churnedSubscribers: number;
    tierDistribution: Record<SubscriptionTier, number>;
    estimatedMonthlyRevenue: number;
  };
  affiliateMetrics: {
    totalPartners: number;
    activePartners: number;
    topPerformingPartners: Array<{
      partner: AffiliatePartner;
      revenue: number;
      clicks: number;
      conversions: number;
      conversionRate: number;
    }>;
  };
  ethicalMetrics: {
    transparencyScore: number;
    userConsentRate: number;
    dataMinimizationCompliance: number;
    affiliateDisclosureRate: number;
  };
  sustainability: {
    freeTierUsage: number;
    freeTierCosts: number;
    paidTierRevenue: number;
    sustainabilityRatio: number; // Revenue / Costs
  };
}

export class RevenueTrackingService {
  private affiliateService: AffiliateService;
  private subscriptionService: SubscriptionService;

  constructor() {
    this.affiliateService = new AffiliateService();
    this.subscriptionService = new SubscriptionService();
  }

  /**
   * Generate comprehensive revenue report with ethical metrics
   */
  async generateDetailedReport(startDate: Date, endDate: Date): Promise<DetailedRevenueReport> {
    try {
      logger.info('Generating detailed revenue report', { startDate, endDate });

      // Get base affiliate report
      const baseReport = await this.affiliateService.generateRevenueReport(startDate, endDate);
      
      // Get subscription metrics
      const subscriptionMetrics = await this.subscriptionService.getSubscriptionMetrics(startDate, endDate);
      
      // Get affiliate metrics
      const affiliateMetrics = await this.getAffiliateMetrics(startDate, endDate);
      
      // Calculate ethical metrics
      const ethicalMetrics = await this.calculateEthicalMetrics(startDate, endDate);
      
      // Calculate sustainability metrics
      const sustainability = await this.calculateSustainabilityMetrics(subscriptionMetrics);

      const detailedReport: DetailedRevenueReport = {
        ...baseReport,
        subscriptionMetrics,
        affiliateMetrics,
        ethicalMetrics,
        sustainability
      };

      logger.info('Detailed revenue report generated', {
        totalRevenue: detailedReport.totalRevenue,
        sustainabilityRatio: detailedReport.sustainability.sustainabilityRatio,
        transparencyScore: detailedReport.ethicalMetrics.transparencyScore
      });

      return detailedReport;
    } catch (error) {
      logger.error('Error generating detailed revenue report', { startDate, endDate, error });
      throw error;
    }
  }

  /**
   * Get detailed affiliate performance metrics
   */
  private async getAffiliateMetrics(startDate: Date, endDate: Date): Promise<DetailedRevenueReport['affiliateMetrics']> {
    try {
      const partners = await this.affiliateService.getActivePartners();
      
      const performanceQuery = `
        SELECT 
          ap.id,
          ap.name,
          ap.domain,
          ap.commission_rate,
          ap.is_active,
          ap.created_at,
          COALESCE(SUM(al.revenue), 0) as total_revenue,
          COALESCE(SUM(al.click_count), 0) as total_clicks,
          COALESCE(SUM(al.conversion_count), 0) as total_conversions
        FROM affiliate_partners ap
        LEFT JOIN affiliate_links al ON ap.id = al.partner_id 
          AND al.created_at BETWEEN $1 AND $2
        WHERE ap.is_active = true
        GROUP BY ap.id, ap.name, ap.domain, ap.commission_rate, ap.is_active, ap.created_at
        ORDER BY total_revenue DESC
      `;

      const result = await db.query(performanceQuery, [startDate, endDate]);
      
      const topPerformingPartners = result?.rows?.map(row => {
        const partner: AffiliatePartner = {
          id: row.id,
          name: row.name,
          domain: row.domain,
          commissionRate: parseFloat(row.commission_rate),
          isActive: row.is_active,
          createdAt: row.created_at
        };

        const revenue = parseInt(row.total_revenue || '0');
        const clicks = parseInt(row.total_clicks || '0');
        const conversions = parseInt(row.total_conversions || '0');
        const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

        return {
          partner,
          revenue,
          clicks,
          conversions,
          conversionRate
        };
      }) || [];

      return {
        totalPartners: partners.length,
        activePartners: partners.filter(p => p.isActive).length,
        topPerformingPartners
      };
    } catch (error) {
      logger.error('Error getting affiliate metrics', { startDate, endDate, error });
      return {
        totalPartners: 0,
        activePartners: 0,
        topPerformingPartners: []
      };
    }
  }

  /**
   * Calculate ethical business metrics
   */
  private async calculateEthicalMetrics(startDate: Date, endDate: Date): Promise<DetailedRevenueReport['ethicalMetrics']> {
    try {
      // Calculate transparency score based on disclosure compliance
      const disclosureQuery = `
        SELECT 
          COUNT(*) as total_links,
          COUNT(CASE WHEN affiliate_url LIKE '%utm_source=picksy%' OR affiliate_url LIKE '%ref=picksy%' THEN 1 END) as disclosed_links
        FROM affiliate_links 
        WHERE created_at BETWEEN $1 AND $2
      `;
      
      const disclosureResult = await db.query(disclosureQuery, [startDate, endDate]);
      const disclosureData = disclosureResult?.rows?.[0] || { total_links: 0, disclosed_links: 0 };
      
      const affiliateDisclosureRate = disclosureData.total_links > 0 
        ? (parseInt(disclosureData.disclosed_links) / parseInt(disclosureData.total_links)) * 100 
        : 100;

      // Calculate user consent rate
      const consentQuery = `
        SELECT 
          COUNT(DISTINCT user_id) as total_users,
          COUNT(DISTINCT CASE WHEN granted = true THEN user_id END) as consented_users
        FROM user_consents 
        WHERE created_at BETWEEN $1 AND $2
      `;
      
      const consentResult = await db.query(consentQuery, [startDate, endDate]);
      const consentData = consentResult?.rows?.[0] || { total_users: 0, consented_users: 0 };
      
      const userConsentRate = consentData.total_users > 0 
        ? (parseInt(consentData.consented_users) / parseInt(consentData.total_users)) * 100 
        : 100;

      // Data minimization compliance (simplified metric)
      const dataMinimizationCompliance = 95; // Would implement actual compliance checking

      // Overall transparency score
      const transparencyScore = (affiliateDisclosureRate + userConsentRate + dataMinimizationCompliance) / 3;

      return {
        transparencyScore: Math.round(transparencyScore * 100) / 100,
        userConsentRate: Math.round(userConsentRate * 100) / 100,
        dataMinimizationCompliance: Math.round(dataMinimizationCompliance * 100) / 100,
        affiliateDisclosureRate: Math.round(affiliateDisclosureRate * 100) / 100
      };
    } catch (error) {
      logger.error('Error calculating ethical metrics', { startDate, endDate, error });
      return {
        transparencyScore: 0,
        userConsentRate: 0,
        dataMinimizationCompliance: 0,
        affiliateDisclosureRate: 0
      };
    }
  }

  /**
   * Calculate business sustainability metrics
   */
  private async calculateSustainabilityMetrics(subscriptionMetrics: any): Promise<DetailedRevenueReport['sustainability']> {
    try {
      const freeTierUsers = subscriptionMetrics.tierDistribution[SubscriptionTier.FREE] || 0;
      const paidTierRevenue = subscriptionMetrics.estimatedMonthlyRevenue;
      
      // Estimate costs for free tier (simplified calculation)
      const costPerFreeUser = 50; // cents per month (server costs, etc.)
      const freeTierCosts = freeTierUsers * costPerFreeUser;
      
      const sustainabilityRatio = freeTierCosts > 0 ? paidTierRevenue / freeTierCosts : 0;

      return {
        freeTierUsage: freeTierUsers,
        freeTierCosts,
        paidTierRevenue,
        sustainabilityRatio: Math.round(sustainabilityRatio * 100) / 100
      };
    } catch (error) {
      logger.error('Error calculating sustainability metrics', error);
      return {
        freeTierUsage: 0,
        freeTierCosts: 0,
        paidTierRevenue: 0,
        sustainabilityRatio: 0
      };
    }
  }

  /**
   * Track revenue event for analytics
   */
  async trackRevenueEvent(event: {
    type: 'subscription_upgrade' | 'affiliate_conversion' | 'subscription_cancellation';
    userId: string;
    amount: number; // in cents
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const query = `
        INSERT INTO revenue_events (id, event_type, user_id, amount, metadata, created_at)
        VALUES (uuid_generate_v4(), $1, $2, $3, $4, NOW())
      `;
      
      await db.query(query, [
        event.type,
        event.userId,
        event.amount,
        JSON.stringify(event.metadata || {})
      ]);

      logger.info('Revenue event tracked', {
        type: event.type,
        userId: event.userId,
        amount: event.amount
      });
    } catch (error) {
      logger.error('Error tracking revenue event', { event, error });
    }
  }

  /**
   * Get revenue forecasting data
   */
  async getRevenueForecast(months: number = 6): Promise<{
    projectedSubscriptionRevenue: number;
    projectedAffiliateRevenue: number;
    growthRate: number;
    recommendations: string[];
  }> {
    try {
      // Get historical data for trend analysis
      const historicalQuery = `
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as new_subscribers
        FROM users 
        WHERE subscription_tier != 'free'
          AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month
      `;

      const historicalResult = await db.query(historicalQuery);
      const historicalData = historicalResult?.rows || [];

      // Simple growth rate calculation
      const growthRate = historicalData.length >= 2 
        ? ((historicalData[historicalData.length - 1]?.new_subscribers || 0) - 
           (historicalData[0]?.new_subscribers || 0)) / (historicalData[0]?.new_subscribers || 1) * 100
        : 0;

      // Project revenue based on current metrics
      const currentMetrics = await this.subscriptionService.getSubscriptionMetrics(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date()
      );

      const monthlyGrowthRate = growthRate / 100 / 12; // Convert to monthly
      const projectedSubscriptionRevenue = currentMetrics.estimatedMonthlyRevenue * months * (1 + monthlyGrowthRate);
      
      // Estimate affiliate revenue growth (typically slower than subscription growth)
      const projectedAffiliateRevenue = projectedSubscriptionRevenue * 0.15; // Assume 15% of subscription revenue

      const recommendations = this.generateRevenueRecommendations(growthRate, currentMetrics);

      return {
        projectedSubscriptionRevenue: Math.round(projectedSubscriptionRevenue),
        projectedAffiliateRevenue: Math.round(projectedAffiliateRevenue),
        growthRate: Math.round(growthRate * 100) / 100,
        recommendations
      };
    } catch (error) {
      logger.error('Error generating revenue forecast', { months, error });
      return {
        projectedSubscriptionRevenue: 0,
        projectedAffiliateRevenue: 0,
        growthRate: 0,
        recommendations: ['Unable to generate forecast due to insufficient data']
      };
    }
  }

  private generateRevenueRecommendations(growthRate: number, metrics: any): string[] {
    const recommendations = [];

    if (growthRate < 5) {
      recommendations.push('Consider improving user onboarding to increase conversion rates');
      recommendations.push('Implement referral program to boost organic growth');
    }

    if (metrics.tierDistribution[SubscriptionTier.FREE] > metrics.tierDistribution[SubscriptionTier.PREMIUM] * 10) {
      recommendations.push('High free-to-paid ratio detected. Consider optimizing upgrade prompts');
    }

    if (metrics.estimatedMonthlyRevenue < 10000) { // Less than $100/month
      recommendations.push('Focus on user acquisition and retention strategies');
      recommendations.push('Consider adding more premium features to increase upgrade incentives');
    }

    recommendations.push('Maintain transparent pricing and ethical monetization practices');
    recommendations.push('Continue investing in core functionality to retain free users');

    return recommendations;
  }
}