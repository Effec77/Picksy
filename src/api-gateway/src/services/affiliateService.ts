import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { 
  AffiliatePartner, 
  AffiliateLink, 
  RevenueReport,
  ErrorCode 
} from '../types/index.js';

export class AffiliateService {
  // Predefined affiliate partners with their commission rates
  private static readonly DEFAULT_PARTNERS: Omit<AffiliatePartner, 'id' | 'createdAt'>[] = [
    {
      name: 'Amazon',
      domain: 'amazon.com',
      commissionRate: 4.0, // 4% commission
      isActive: true
    },
    {
      name: 'Best Buy',
      domain: 'bestbuy.com',
      commissionRate: 3.5,
      isActive: true
    },
    {
      name: 'Target',
      domain: 'target.com',
      commissionRate: 3.0,
      isActive: true
    },
    {
      name: 'Walmart',
      domain: 'walmart.com',
      commissionRate: 2.5,
      isActive: true
    }
  ];

  async initializeDefaultPartners(): Promise<void> {
    try {
      for (const partner of AffiliateService.DEFAULT_PARTNERS) {
        // Check if partner already exists
        const existingQuery = `
          SELECT id FROM affiliate_partners 
          WHERE domain = $1
        `;
        const existing = await db.query(existingQuery, [partner.domain]);
        
        if (!existing?.rows || existing.rows.length === 0) {
          // Create new partner
          const insertQuery = `
            INSERT INTO affiliate_partners (id, name, domain, commission_rate, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
          `;
          
          await db.query(insertQuery, [
            uuidv4(),
            partner.name,
            partner.domain,
            partner.commissionRate,
            partner.isActive
          ]);
          
          logger.info('Initialized affiliate partner', { domain: partner.domain });
        }
      }
    } catch (error) {
      logger.error('Error initializing default partners', error);
    }
  }

  async getActivePartners(): Promise<AffiliatePartner[]> {
    try {
      const query = `
        SELECT id, name, domain, commission_rate, is_active, created_at
        FROM affiliate_partners 
        WHERE is_active = true
        ORDER BY name
      `;
      
      const result = await db.query(query);
      
      if (!result?.rows) {
        return [];
      }
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        domain: row.domain,
        commissionRate: parseFloat(row.commission_rate),
        isActive: row.is_active,
        createdAt: row.created_at
      }));
    } catch (error) {
      logger.error('Error getting active partners', error);
      return [];
    }
  }

  async getPartnerByDomain(domain: string): Promise<AffiliatePartner | null> {
    try {
      const query = `
        SELECT id, name, domain, commission_rate, is_active, created_at
        FROM affiliate_partners 
        WHERE domain = $1 AND is_active = true
      `;
      
      const result = await db.query(query, [domain]);
      
      if (!result?.rows || result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        domain: row.domain,
        commissionRate: parseFloat(row.commission_rate),
        isActive: row.is_active,
        createdAt: row.created_at
      };
    } catch (error) {
      logger.error('Error getting partner by domain', { domain, error });
      return null;
    }
  }

  async createAffiliateLink(
    userId: string, 
    originalUrl: string, 
    productId?: string
  ): Promise<AffiliateLink | null> {
    try {
      // Extract domain from URL
      const url = new URL(originalUrl);
      const domain = url.hostname.replace('www.', '');
      
      // Find matching partner
      const partner = await this.getPartnerByDomain(domain);
      if (!partner) {
        logger.warn('No affiliate partner found for domain', { domain });
        return null;
      }

      // Generate affiliate URL (simplified - in production, use actual affiliate APIs)
      const affiliateUrl = this.generateAffiliateUrl(originalUrl, partner);
      
      const linkId = uuidv4();
      const query = `
        INSERT INTO affiliate_links (
          id, partner_id, original_url, affiliate_url, user_id, product_id, 
          created_at, click_count, conversion_count, revenue
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), 0, 0, 0)
        RETURNING *
      `;
      
      const result = await db.query(query, [
        linkId,
        partner.id,
        originalUrl,
        affiliateUrl,
        userId,
        productId || null
      ]);
      
      if (!result?.rows || result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      logger.info('Created affiliate link', { linkId, userId, domain });
      
      return {
        id: row.id,
        partnerId: row.partner_id,
        originalUrl: row.original_url,
        affiliateUrl: row.affiliate_url,
        userId: row.user_id,
        productId: row.product_id,
        createdAt: row.created_at,
        clickCount: row.click_count,
        conversionCount: row.conversion_count,
        revenue: row.revenue
      };
    } catch (error) {
      logger.error('Error creating affiliate link', { userId, originalUrl, error });
      return null;
    }
  }

  private generateAffiliateUrl(originalUrl: string, partner: AffiliatePartner): string {
    // Simplified affiliate URL generation
    // In production, integrate with actual affiliate APIs
    const url = new URL(originalUrl);
    
    switch (partner.domain) {
      case 'amazon.com':
        url.searchParams.set('tag', 'picksy-20'); // Example affiliate tag
        break;
      case 'bestbuy.com':
        url.searchParams.set('ref', 'picksy');
        break;
      default:
        url.searchParams.set('utm_source', 'picksy');
        url.searchParams.set('utm_medium', 'affiliate');
    }
    
    return url.toString();
  }

  async trackClick(linkId: string): Promise<boolean> {
    try {
      const query = `
        UPDATE affiliate_links 
        SET click_count = click_count + 1
        WHERE id = $1
        RETURNING id
      `;
      
      const result = await db.query(query, [linkId]);
      
      if (result?.rows && result.rows.length > 0) {
        logger.info('Tracked affiliate click', { linkId });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error tracking click', { linkId, error });
      return false;
    }
  }

  async trackConversion(linkId: string, revenue: number): Promise<boolean> {
    try {
      const query = `
        UPDATE affiliate_links 
        SET conversion_count = conversion_count + 1, revenue = revenue + $2
        WHERE id = $1
        RETURNING id
      `;
      
      const result = await db.query(query, [linkId, revenue]);
      
      if (result?.rows && result.rows.length > 0) {
        logger.info('Tracked affiliate conversion', { linkId, revenue });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error tracking conversion', { linkId, revenue, error });
      return false;
    }
  }

  async getUserAffiliateLinks(userId: string): Promise<AffiliateLink[]> {
    try {
      const query = `
        SELECT al.*, ap.name as partner_name
        FROM affiliate_links al
        JOIN affiliate_partners ap ON al.partner_id = ap.id
        WHERE al.user_id = $1
        ORDER BY al.created_at DESC
      `;
      
      const result = await db.query(query, [userId]);
      
      if (!result?.rows) {
        return [];
      }
      
      return result.rows.map(row => ({
        id: row.id,
        partnerId: row.partner_id,
        originalUrl: row.original_url,
        affiliateUrl: row.affiliate_url,
        userId: row.user_id,
        productId: row.product_id,
        createdAt: row.created_at,
        clickCount: row.click_count,
        conversionCount: row.conversion_count,
        revenue: row.revenue
      }));
    } catch (error) {
      logger.error('Error getting user affiliate links', { userId, error });
      return [];
    }
  }

  async generateRevenueReport(startDate: Date, endDate: Date): Promise<RevenueReport> {
    try {
      // Get subscription revenue (simplified - would integrate with payment processor)
      const subscriptionQuery = `
        SELECT COUNT(*) as active_subscribers
        FROM users 
        WHERE subscription_tier != 'free' AND is_active = true
      `;
      
      const subscriptionResult = await db.query(subscriptionQuery);
      const activeSubscribers = parseInt(subscriptionResult?.rows?.[0]?.active_subscribers || '0');
      
      // Estimate subscription revenue (simplified)
      const subscriptionRevenue = activeSubscribers * 999; // Assuming average $9.99/month
      
      // Get affiliate revenue
      const affiliateQuery = `
        SELECT 
          SUM(revenue) as total_affiliate_revenue,
          SUM(click_count) as total_clicks,
          SUM(conversion_count) as total_conversions
        FROM affiliate_links 
        WHERE created_at BETWEEN $1 AND $2
      `;
      
      const affiliateResult = await db.query(affiliateQuery, [startDate, endDate]);
      const affiliateData = affiliateResult?.rows?.[0] || {};
      
      const affiliateRevenue = parseInt(affiliateData.total_affiliate_revenue || '0');
      const affiliateClicks = parseInt(affiliateData.total_clicks || '0');
      const affiliateConversions = parseInt(affiliateData.total_conversions || '0');
      
      return {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        totalRevenue: subscriptionRevenue + affiliateRevenue,
        subscriptionRevenue,
        affiliateRevenue,
        activeSubscribers,
        newSubscribers: 0, // Would need to track signups in date range
        churnedSubscribers: 0, // Would need to track cancellations
        affiliateClicks,
        affiliateConversions
      };
    } catch (error) {
      logger.error('Error generating revenue report', { startDate, endDate, error });
      return {
        period: 'Error',
        totalRevenue: 0,
        subscriptionRevenue: 0,
        affiliateRevenue: 0,
        activeSubscribers: 0,
        newSubscribers: 0,
        churnedSubscribers: 0,
        affiliateClicks: 0,
        affiliateConversions: 0
      };
    }
  }

  async shouldShowAffiliateDisclosure(url: string): Promise<{ show: boolean; partner?: AffiliatePartner }> {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      
      const partner = await this.getPartnerByDomain(domain);
      
      return {
        show: !!partner,
        partner: partner || undefined
      };
    } catch (error) {
      logger.error('Error checking affiliate disclosure', { url, error });
      return { show: false };
    }
  }
}