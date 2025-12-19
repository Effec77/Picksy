import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/subscriptionService.js';
import { SubscriptionLimits, ErrorCode } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to enforce usage policies while preserving core functionality
 * Implements fair usage policies that protect essential features for free users
 */
export function createUsagePolicyEnforcer(action: keyof SubscriptionLimits) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({
          code: ErrorCode.AUTHENTICATION_FAILED,
          message: 'Authentication required'
        });
      }

      const subscriptionService = new SubscriptionService();
      const policyResult = await subscriptionService.enforceUsagePolicy(req.user.userId, action);

      if (!policyResult.allowed) {
        // Log usage policy enforcement
        logger.info('Usage policy enforced', {
          userId: req.user.userId,
          action,
          reason: policyResult.reason,
          upgradeRequired: policyResult.upgradeRequired
        });

        const statusCode = policyResult.upgradeRequired ? 402 : 429; // 402 Payment Required or 429 Too Many Requests
        const errorCode = policyResult.upgradeRequired ? ErrorCode.UPGRADE_REQUIRED : ErrorCode.TIER_LIMIT_EXCEEDED;

        return res.status(statusCode).json({
          code: errorCode,
          message: policyResult.reason,
          details: {
            action,
            upgradeRequired: policyResult.upgradeRequired,
            coreFunctionalityProtected: true,
            upgradeOptions: policyResult.upgradeRequired ? {
              availableTiers: ['premium', 'enterprise'],
              benefits: 'Higher limits, advanced features, and priority support'
            } : undefined
          }
        });
      }

      // If in grace period, add warning header
      if (policyResult.gracePeriod) {
        res.setHeader('X-Usage-Warning', policyResult.reason || 'Approaching usage limits');
        res.setHeader('X-Grace-Period', 'true');
      }

      // Increment usage counter for successful requests
      await subscriptionService.incrementUsage(req.user.userId, action as any);

      next();
    } catch (error) {
      logger.error('Error in usage policy enforcer', {
        userId: req.user?.userId,
        action,
        error
      });
      
      // On error, allow the request to proceed (fail open for availability)
      next();
    }
  };
}

/**
 * Middleware to track usage without enforcement (for monitoring)
 */
export function createUsageTracker(action: keyof SubscriptionLimits) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user?.userId) {
        const subscriptionService = new SubscriptionService();
        
        // Track usage after successful request
        res.on('finish', async () => {
          if (res.statusCode < 400) { // Only track successful requests
            try {
              await subscriptionService.incrementUsage(req.user!.userId, action as any);
            } catch (error) {
              logger.error('Error tracking usage', {
                userId: req.user!.userId,
                action,
                error
              });
            }
          }
        });
      }
      
      next();
    } catch (error) {
      logger.error('Error in usage tracker', {
        userId: req.user?.userId,
        action,
        error
      });
      
      // Continue on error
      next();
    }
  };
}

/**
 * Middleware to provide usage recommendations in response headers
 */
export function addUsageRecommendations() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user?.userId) {
        const subscriptionService = new SubscriptionService();
        
        // Add recommendations after request processing
        res.on('finish', async () => {
          try {
            const recommendations = await subscriptionService.getUsageRecommendations(req.user!.userId);
            
            if (recommendations.warnings.length > 0) {
              res.setHeader('X-Usage-Warnings', recommendations.warnings.length.toString());
            }
            
            if (recommendations.upgradeRecommendation) {
              res.setHeader('X-Upgrade-Recommended', 'true');
              res.setHeader('X-Suggested-Tier', recommendations.upgradeRecommendation.suggestedTier);
            }
          } catch (error) {
            logger.error('Error adding usage recommendations', {
              userId: req.user!.userId,
              error
            });
          }
        });
      }
      
      next();
    } catch (error) {
      logger.error('Error in usage recommendations middleware', {
        userId: req.user?.userId,
        error
      });
      
      // Continue on error
      next();
    }
  };
}