import { Router, Request, Response } from 'express';
import { 
  enhancedAuth,
  createEndpointRateLimit,
  enforceUsageTier
} from '../middleware/index.js';
import { UserRole, SubscriptionTier, ErrorCode } from '../types/index.js';
import { SubscriptionService } from '../services/subscriptionService.js';
import { logger } from '../utils/logger.js';

const router = Router();
const subscriptionService = new SubscriptionService();

// Get all available tiers and pricing with feature comparison
router.get('/tiers', 
  createEndpointRateLimit('subscription-tiers', {
    anonymous: 20,
    [UserRole.USER]: 50,
    [UserRole.ADMIN]: 100
  }),
  async (req: Request, res: Response) => {
    try {
      const comparison = SubscriptionService.getTierComparison();
      
      res.json({
        success: true,
        data: {
          ...comparison,
          currentTier: req.user?.subscriptionTier || SubscriptionTier.FREE,
          transparency: {
            coreFunctionalityGuarantee: 'Core price tracking features will always remain free',
            fairUsagePolicy: 'Free tier includes generous limits for personal use',
            upgradeValue: 'Premium tiers offer enhanced features and higher limits for power users'
          }
        }
      });
    } catch (error) {
      logger.error('Error getting subscription tiers', error);
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to get subscription tiers'
      });
    }
  }
);

// Get current user's usage statistics with recommendations
router.get('/usage',
  enhancedAuth,
  enforceUsageTier(UserRole.USER),
  createEndpointRateLimit('usage-stats', {
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

      const usage = await subscriptionService.getUserUsageStats(req.user.userId);
      
      if (!usage) {
        return res.status(404).json({
          code: ErrorCode.USER_NOT_FOUND,
          message: 'User not found'
        });
      }

      const tierConfig = SubscriptionService.getTierConfig(usage.tier);
      const recommendations = await subscriptionService.getUsageRecommendations(req.user.userId);
      
      res.json({
        success: true,
        data: {
          usage,
          limits: tierConfig.limits,
          tierInfo: {
            name: tierConfig.name,
            tier: tierConfig.tier,
            features: tierConfig.features,
            price: tierConfig.price
          },
          recommendations,
          fairUsagePolicy: {
            coreFeaturesProtected: 'Core functionality remains available even when approaching limits',
            gracePeriodAvailable: usage.tier === SubscriptionTier.FREE,
            upgradeRecommended: recommendations.warnings.length >= 2
          }
        }
      });
    } catch (error) {
      logger.error('Error getting usage stats', { userId: req.user?.userId, error });
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to get usage statistics'
      });
    }
  }
);

// Check if user can perform a specific action with fair usage policy
router.post('/check-limit',
  enhancedAuth,
  enforceUsageTier(UserRole.USER),
  createEndpointRateLimit('check-limit', {
    [UserRole.USER]: 100,
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

      const { action } = req.body;
      
      if (!action) {
        return res.status(400).json({
          code: ErrorCode.INVALID_INPUT,
          message: 'Action is required'
        });
      }

      const policyCheck = await subscriptionService.enforceUsagePolicy(req.user.userId, action);
      
      res.json({
        success: true,
        data: policyCheck
      });
    } catch (error) {
      logger.error('Error checking usage limit', { userId: req.user?.userId, error });
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to check usage limit'
      });
    }
  }
);

// Upgrade user tier (simplified - in production would integrate with payment processor)
router.post('/upgrade',
  enhancedAuth,
  enforceUsageTier(UserRole.USER),
  createEndpointRateLimit('tier-upgrade', {
    [UserRole.USER]: 5,
    [UserRole.ADMIN]: 20
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({
          code: ErrorCode.AUTHENTICATION_FAILED,
          message: 'Authentication required'
        });
      }

      const { targetTier } = req.body;
      
      if (!targetTier || !Object.values(SubscriptionTier).includes(targetTier)) {
        return res.status(400).json({
          code: ErrorCode.INVALID_INPUT,
          message: 'Valid target tier is required'
        });
      }

      // Prevent downgrading to free (would need separate cancellation flow)
      if (targetTier === SubscriptionTier.FREE) {
        return res.status(400).json({
          code: ErrorCode.INVALID_INPUT,
          message: 'Cannot downgrade to free tier through this endpoint'
        });
      }

      const currentTier = await subscriptionService.getUserTier(req.user.userId);
      
      if (currentTier === targetTier) {
        return res.status(400).json({
          code: ErrorCode.INVALID_INPUT,
          message: 'User is already on the target tier'
        });
      }

      // In production, this would:
      // 1. Process payment through Stripe/PayPal
      // 2. Verify payment success
      // 3. Update subscription in database
      // 4. Send confirmation email
      
      const success = await subscriptionService.upgradeUserTier(req.user.userId, targetTier);
      
      if (!success) {
        return res.status(500).json({
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to upgrade subscription'
        });
      }

      const newTierConfig = SubscriptionService.getTierConfig(targetTier);
      
      logger.info('User tier upgraded', { 
        userId: req.user.userId, 
        fromTier: currentTier, 
        toTier: targetTier 
      });
      
      res.json({
        success: true,
        message: `Successfully upgraded to ${newTierConfig.name}`,
        data: {
          newTier: targetTier,
          tierConfig: newTierConfig
        }
      });
    } catch (error) {
      logger.error('Error upgrading user tier', { userId: req.user?.userId, error });
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to upgrade subscription'
      });
    }
  }
);

// Admin endpoint to get comprehensive revenue reports
router.get('/revenue-report',
  enhancedAuth,
  enforceUsageTier(UserRole.ADMIN),
  createEndpointRateLimit('revenue-report', {
    [UserRole.ADMIN]: 10
  }),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      // Import RevenueTrackingService for comprehensive reporting
      const { RevenueTrackingService } = await import('../services/revenueTrackingService.js');
      const revenueService = new RevenueTrackingService();
      
      const detailedReport = await revenueService.generateDetailedReport(start, end);
      
      const enhancedReport = {
        ...detailedReport,
        transparency: {
          affiliateDisclosure: 'All affiliate partnerships are transparently disclosed to users',
          revenueSharing: 'Revenue helps maintain free tier and improve service quality',
          ethicalMonetization: 'No user data is sold; revenue comes from affiliate commissions and subscriptions',
          coreFunctionalityGuarantee: 'Essential price tracking features will always remain free',
          sustainabilityCommitment: 'Business model designed for long-term sustainability without compromising user privacy'
        }
      };
      
      res.json({
        success: true,
        data: enhancedReport
      });
    } catch (error) {
      logger.error('Error generating revenue report', error);
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to generate revenue report'
      });
    }
  }
);

// Admin endpoint to get revenue forecasting
router.get('/forecast',
  enhancedAuth,
  enforceUsageTier(UserRole.ADMIN),
  createEndpointRateLimit('revenue-forecast', {
    [UserRole.ADMIN]: 5
  }),
  async (req: Request, res: Response) => {
    try {
      const { months } = req.query;
      const forecastMonths = months ? parseInt(months as string) : 6;
      
      if (forecastMonths < 1 || forecastMonths > 24) {
        return res.status(400).json({
          code: ErrorCode.INVALID_INPUT,
          message: 'Forecast months must be between 1 and 24'
        });
      }

      const { RevenueTrackingService } = await import('../services/revenueTrackingService.js');
      const revenueService = new RevenueTrackingService();
      
      const forecast = await revenueService.getRevenueForecast(forecastMonths);
      
      res.json({
        success: true,
        data: {
          ...forecast,
          forecastPeriod: `${forecastMonths} months`,
          ethicalConsiderations: {
            sustainabilityFocus: 'Forecasts prioritize long-term sustainability over aggressive growth',
            userValueFirst: 'Revenue projections based on providing genuine value to users',
            transparentPricing: 'No hidden fees or surprise charges in revenue model'
          }
        }
      });
    } catch (error) {
      logger.error('Error generating revenue forecast', error);
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to generate revenue forecast'
      });
    }
  }
);

export default router;