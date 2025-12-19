import { Router, Request, Response } from 'express';
import { 
  enhancedAuth,
  createEndpointRateLimit,
  enforceUsageTier
} from '../middleware/index.js';
import { UserRole, ErrorCode } from '../types/index.js';
import { AffiliateService } from '../services/affiliateService.js';
import { logger } from '../utils/logger.js';

const router = Router();
const affiliateService = new AffiliateService();

// Get active affiliate partners (public endpoint for transparency)
router.get('/partners',
  createEndpointRateLimit('affiliate-partners', {
    anonymous: 20,
    [UserRole.USER]: 50,
    [UserRole.ADMIN]: 100
  }),
  async (req: Request, res: Response) => {
    try {
      const partners = await affiliateService.getActivePartners();
      
      // Return only public information
      const publicPartners = partners.map(partner => ({
        name: partner.name,
        domain: partner.domain,
        commissionRate: partner.commissionRate
      }));
      
      res.json({
        success: true,
        data: {
          partners: publicPartners,
          disclosure: 'Picksy may earn commission from purchases made through affiliate links. This helps us keep the service free while maintaining our commitment to finding you the best deals.'
        }
      });
    } catch (error) {
      logger.error('Error getting affiliate partners', error);
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to get affiliate partners'
      });
    }
  }
);

// Create affiliate link for a product URL
router.post('/create-link',
  enhancedAuth,
  enforceUsageTier(UserRole.USER),
  createEndpointRateLimit('create-affiliate-link', {
    [UserRole.USER]: 50,
    [UserRole.ADMIN]: 200
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({
          code: ErrorCode.AUTHENTICATION_FAILED,
          message: 'Authentication required'
        });
      }

      const { originalUrl, productId } = req.body;
      
      if (!originalUrl) {
        return res.status(400).json({
          code: ErrorCode.INVALID_INPUT,
          message: 'Original URL is required'
        });
      }

      // Validate URL format
      try {
        new URL(originalUrl);
      } catch {
        return res.status(400).json({
          code: ErrorCode.INVALID_INPUT,
          message: 'Invalid URL format'
        });
      }

      const affiliateLink = await affiliateService.createAffiliateLink(
        req.user.userId,
        originalUrl,
        productId
      );
      
      if (!affiliateLink) {
        return res.status(404).json({
          code: ErrorCode.INVALID_INPUT,
          message: 'No affiliate partner available for this domain'
        });
      }

      res.json({
        success: true,
        data: {
          affiliateLink,
          disclosure: 'This is an affiliate link. Picksy may earn a commission from purchases made through this link.'
        }
      });
    } catch (error) {
      logger.error('Error creating affiliate link', { userId: req.user?.userId, error });
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to create affiliate link'
      });
    }
  }
);

// Get user's affiliate links
router.get('/my-links',
  enhancedAuth,
  enforceUsageTier(UserRole.USER),
  createEndpointRateLimit('user-affiliate-links', {
    [UserRole.USER]: 30,
    [UserRole.ADMIN]: 100
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({
          code: ErrorCode.AUTHENTICATION_FAILED,
          message: 'Authentication required'
        });
      }

      const links = await affiliateService.getUserAffiliateLinks(req.user.userId);
      
      res.json({
        success: true,
        data: {
          links,
          totalLinks: links.length,
          totalClicks: links.reduce((sum, link) => sum + link.clickCount, 0),
          totalRevenue: links.reduce((sum, link) => sum + link.revenue, 0)
        }
      });
    } catch (error) {
      logger.error('Error getting user affiliate links', { userId: req.user?.userId, error });
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to get affiliate links'
      });
    }
  }
);

// Track affiliate link click (public endpoint)
router.post('/track-click/:linkId',
  createEndpointRateLimit('track-click', {
    anonymous: 100,
    [UserRole.USER]: 200,
    [UserRole.ADMIN]: 500
  }),
  async (req: Request, res: Response) => {
    try {
      const { linkId } = req.params;
      
      if (!linkId) {
        return res.status(400).json({
          code: ErrorCode.INVALID_INPUT,
          message: 'Link ID is required'
        });
      }

      const success = await affiliateService.trackClick(linkId);
      
      if (!success) {
        return res.status(404).json({
          code: ErrorCode.INVALID_INPUT,
          message: 'Affiliate link not found'
        });
      }

      res.json({
        success: true,
        message: 'Click tracked successfully'
      });
    } catch (error) {
      logger.error('Error tracking affiliate click', { linkId: req.params.linkId, error });
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to track click'
      });
    }
  }
);

// Check if URL should show affiliate disclosure
router.post('/check-disclosure',
  createEndpointRateLimit('check-disclosure', {
    anonymous: 50,
    [UserRole.USER]: 100,
    [UserRole.ADMIN]: 200
  }),
  async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({
          code: ErrorCode.INVALID_INPUT,
          message: 'URL is required'
        });
      }

      const disclosure = await affiliateService.shouldShowAffiliateDisclosure(url);
      
      res.json({
        success: true,
        data: disclosure
      });
    } catch (error) {
      logger.error('Error checking affiliate disclosure', error);
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to check disclosure requirement'
      });
    }
  }
);

// Admin endpoint to track conversion
router.post('/track-conversion',
  enhancedAuth,
  enforceUsageTier(UserRole.ADMIN),
  createEndpointRateLimit('track-conversion', {
    [UserRole.ADMIN]: 100
  }),
  async (req: Request, res: Response) => {
    try {
      const { linkId, revenue } = req.body;
      
      if (!linkId || revenue === undefined) {
        return res.status(400).json({
          code: ErrorCode.INVALID_INPUT,
          message: 'Link ID and revenue are required'
        });
      }

      const success = await affiliateService.trackConversion(linkId, revenue);
      
      if (!success) {
        return res.status(404).json({
          code: ErrorCode.INVALID_INPUT,
          message: 'Affiliate link not found'
        });
      }

      res.json({
        success: true,
        message: 'Conversion tracked successfully'
      });
    } catch (error) {
      logger.error('Error tracking affiliate conversion', error);
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to track conversion'
      });
    }
  }
);

// Admin endpoint to generate affiliate-specific revenue report
router.get('/revenue-report',
  enhancedAuth,
  enforceUsageTier(UserRole.ADMIN),
  createEndpointRateLimit('affiliate-revenue-report', {
    [UserRole.ADMIN]: 10
  }),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const report = await affiliateService.generateRevenueReport(start, end);
      
      // Add ethical monetization context
      const enhancedReport = {
        ...report,
        ethicalPractices: {
          transparentDisclosure: 'All affiliate relationships are clearly disclosed to users',
          userBenefit: 'Affiliate partnerships help keep core features free for all users',
          noDataSelling: 'User data is never sold to affiliate partners',
          fairCommissions: 'Commission rates are negotiated to benefit users with better deals'
        },
        partnerCompliance: {
          termsOfServiceRespect: 'All affiliate activities respect partner terms of service',
          rateLimitCompliance: 'Automated systems respect partner rate limits',
          attributionAccuracy: 'Revenue attribution is accurate and transparent'
        }
      };
      
      res.json({
        success: true,
        data: enhancedReport
      });
    } catch (error) {
      logger.error('Error generating affiliate revenue report', error);
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to generate revenue report'
      });
    }
  }
);

export default router;