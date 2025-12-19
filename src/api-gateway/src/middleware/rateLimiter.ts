import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { ErrorCode, UserRole, SubscriptionTier } from '../types/index.js';

// General rate limiter
export const generalRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.userId || req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', { 
      ip: req.ip, 
      userId: req.user?.userId,
      path: req.path 
    });
    
    res.status(429).json({
      code: ErrorCode.RATE_LIMITED,
      message: 'Too many requests, please try again later',
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter rate limiter for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMaxRequests,
  keyGenerator: (req: Request) => {
    // For auth endpoints, always use IP to prevent abuse
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', { 
      ip: req.ip, 
      path: req.path 
    });
    
    res.status(429).json({
      code: ErrorCode.RATE_LIMITED,
      message: 'Too many authentication attempts, please try again later',
      retryAfter: Math.ceil(config.rateLimit.authWindowMs / 1000)
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Per-user rate limiter for API endpoints
export const createUserRateLimit = (maxRequests: number, windowMs: number = config.rateLimit.windowMs) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    keyGenerator: (req: Request) => {
      if (!req.user?.userId) {
        throw new Error('User rate limiter requires authentication');
      }
      return req.user.userId;
    },
    handler: (req: Request, res: Response) => {
      logger.warn('User rate limit exceeded', { 
        userId: req.user?.userId,
        path: req.path 
      });
      
      res.status(429).json({
        code: ErrorCode.RATE_LIMITED,
        message: 'User rate limit exceeded, please try again later',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Endpoint-specific rate limiter with user tier support
export const createEndpointRateLimit = (
  endpoint: string, 
  limits: { [key in UserRole | SubscriptionTier | 'anonymous']?: number },
  windowMs: number = config.rateLimit.windowMs
) => {
  return rateLimit({
    windowMs,
    max: (req: Request) => {
      // Determine user tier and return appropriate limit
      if (req.user?.role === UserRole.ADMIN) {
        return limits[UserRole.ADMIN] || limits[UserRole.USER] || limits.anonymous || 100;
      } else if (req.user?.role === UserRole.USER) {
        // Check subscription tier for more granular limits
        const subscriptionTier = req.user.subscriptionTier;
        if (subscriptionTier && limits[subscriptionTier]) {
          return limits[subscriptionTier];
        }
        return limits[UserRole.USER] || limits.anonymous || 50;
      } else {
        return limits.anonymous || 10;
      }
    },
    keyGenerator: (req: Request) => {
      // Create unique key combining user/IP and endpoint
      const identifier = req.user?.userId || req.ip || 'unknown';
      return `${identifier}:${endpoint}`;
    },
    handler: (req: Request, res: Response) => {
      const userTier = req.user?.subscriptionTier || req.user?.role || 'anonymous';
      logger.warn('Endpoint rate limit exceeded', { 
        userId: req.user?.userId,
        ip: req.ip,
        endpoint,
        userTier,
        subscriptionTier: req.user?.subscriptionTier,
        path: req.path 
      });
      
      res.status(429).json({
        code: ErrorCode.RATE_LIMITED,
        message: `Rate limit exceeded for ${endpoint}. Upgrade your plan for higher limits.`,
        retryAfter: Math.ceil(windowMs / 1000),
        details: {
          endpoint,
          userTier,
          subscriptionTier: req.user?.subscriptionTier,
          upgradeUrl: userTier === 'anonymous' ? '/api/auth/register' : '/api/subscription/upgrade'
        }
      });
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Usage tier enforcement middleware
export const enforceUsageTier = (requiredTier: UserRole = UserRole.USER) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Allow anonymous access if no tier required
    if (requiredTier === UserRole.USER && !req.user) {
      return next();
    }

    // Check if user meets required tier
    if (!req.user) {
      return res.status(401).json({
        code: ErrorCode.AUTHENTICATION_FAILED,
        message: 'Authentication required for this endpoint',
        details: {
          requiredTier,
          upgradeUrl: '/api/auth/register'
        }
      });
    }

    // Admin users have access to everything
    if (req.user.role === UserRole.ADMIN) {
      return next();
    }

    // Check specific tier requirements
    const userRole = req.user.role as UserRole;
    if (requiredTier === UserRole.ADMIN && userRole !== UserRole.ADMIN) {
      return res.status(403).json({
        code: ErrorCode.AUTHENTICATION_FAILED,
        message: 'Admin access required for this endpoint',
        details: {
          currentTier: userRole,
          requiredTier
        }
      });
    }

    next();
  };
};