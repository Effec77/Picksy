import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/subscriptionService.js';
import { ErrorCode, SubscriptionLimits } from '../types/index.js';
import { logger } from '../utils/logger.js';

const subscriptionService = new SubscriptionService();

// Middleware to check and enforce usage limits
export const enforceUsageLimit = (limitType: keyof SubscriptionLimits) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({
          code: ErrorCode.AUTHENTICATION_FAILED,
          message: 'Authentication required'
        });
      }

      const limitCheck = await subscriptionService.checkUsageLimit(req.user.userId, limitType);
      
      if (!limitCheck.allowed) {
        const tierConfig = SubscriptionService.getTierConfig(req.user.subscriptionTier);
        
        logger.warn('Usage limit exceeded', {
          userId: req.user.userId,
          limitType,
          current: limitCheck.current,
          limit: limitCheck.limit,
          tier: req.user.subscriptionTier
        });
        
        return res.status(429).json({
          code: ErrorCode.TIER_LIMIT_EXCEEDED,
          message: `${limitType} limit exceeded for ${tierConfig.name} tier`,
          details: {
            limitType,
            current: limitCheck.current,
            limit: limitCheck.limit,
            tier: req.user.subscriptionTier,
            upgradeUrl: '/api/subscription/upgrade',
            availableTiers: SubscriptionService.getAllTierConfigs()
              .filter(tier => tier.tier !== req.user?.subscriptionTier)
              .map(tier => ({
                tier: tier.tier,
                name: tier.name,
                price: tier.price,
                limits: tier.limits
              }))
          }
        });
      }

      // Increment usage counter for this action
      if (limitType === 'priceChecksPerDay') {
        await subscriptionService.incrementUsage(req.user.userId, 'priceChecks');
      } else if (limitType === 'notificationsPerDay') {
        await subscriptionService.incrementUsage(req.user.userId, 'notifications');
      } else if (limitType === 'apiRequestsPerHour') {
        await subscriptionService.incrementUsage(req.user.userId, 'apiRequests');
      }

      next();
    } catch (error) {
      logger.error('Error enforcing usage limit', {
        userId: req.user?.userId,
        limitType,
        error
      });
      
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to check usage limits'
      });
    }
  };
};

// Middleware to check if user can add more tracked products
export const enforceProductLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        code: ErrorCode.AUTHENTICATION_FAILED,
        message: 'Authentication required'
      });
    }

    const limitCheck = await subscriptionService.checkUsageLimit(req.user.userId, 'productsTracked');
    
    if (!limitCheck.allowed) {
      const tierConfig = SubscriptionService.getTierConfig(req.user.subscriptionTier);
      
      return res.status(429).json({
        code: ErrorCode.TIER_LIMIT_EXCEEDED,
        message: `Product tracking limit reached for ${tierConfig.name} tier`,
        details: {
          current: limitCheck.current,
          limit: limitCheck.limit,
          tier: req.user.subscriptionTier,
          upgradeUrl: '/api/subscription/upgrade'
        }
      });
    }

    next();
  } catch (error) {
    logger.error('Error enforcing product limit', {
      userId: req.user?.userId,
      error
    });
    
    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Failed to check product limits'
    });
  }
};

// Middleware to add usage tracking to API requests
export const trackApiUsage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.userId) {
      // Track API usage for authenticated users
      await subscriptionService.incrementUsage(req.user.userId, 'apiRequests');
    }
    next();
  } catch (error) {
    // Don't fail the request if usage tracking fails
    logger.error('Error tracking API usage', {
      userId: req.user?.userId,
      error
    });
    next();
  }
};