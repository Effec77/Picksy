import express, { Express } from 'express';
import { 
  apiGatewaySecurityMiddleware,
  corsMiddleware,
  securityHeaders,
  sanitizeRequest,
  securityMonitoring,
  validateRequest
} from './security.js';
import { 
  generalRateLimit,
  authRateLimit,
  createUserRateLimit,
  createEndpointRateLimit,
  enforceUsageTier
} from './rateLimiter.js';
import { 
  authenticateToken,
  authenticateWithContext,
  optionalAuth,
  requireRole
} from './auth.js';
import { 
  requestLogger,
  errorLogger
} from './logging.js';
import { logger } from '../utils/logger.js';
import { ErrorCode } from '../types/index.js';
import { 
  enhancedErrorHandler, 
  addErrorContext 
} from '../services/errorHandling.js';
import {
  enforceUsageLimit,
  enforceProductLimit,
  trackApiUsage
} from './usageLimiter.js';
import {
  createUsagePolicyEnforcer,
  createUsageTracker,
  addUsageRecommendations
} from './usagePolicyEnforcer.js';

/**
 * Configure all security middleware for the API Gateway
 * This function sets up the middleware stack in the correct order
 * to ensure proper security, authentication, and monitoring
 */
export function configureSecurityMiddleware(app: Express): void {
  // Trust proxy (important for rate limiting and logging when behind a reverse proxy)
  app.set('trust proxy', 1);

  // 1. Security headers and CORS (applied first)
  app.use(securityHeaders);
  app.use(corsMiddleware);

  // 2. Request validation and sanitization
  app.use(validateRequest);
  app.use(sanitizeRequest);

  // 3. Security monitoring (after sanitization)
  app.use(securityMonitoring);

  // 4. Body parsing middleware (with size limits)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 5. Error context (for enhanced error handling)
  app.use(addErrorContext);

  // 6. Request logging (after body parsing)
  app.use(requestLogger);

  // 7. General rate limiting (applied to all routes)
  app.use(generalRateLimit);

  logger.info('Security middleware configured successfully');
}

/**
 * Apply all security middleware at once
 * Use this for routes that need full security protection
 */
export const fullSecurityMiddleware = [
  ...apiGatewaySecurityMiddleware,
  generalRateLimit,
  requestLogger
];

/**
 * Authentication middleware with enhanced context
 * Use this instead of basic authenticateToken for better monitoring
 */
export const enhancedAuth = authenticateWithContext;

/**
 * Error handling middleware (must be applied last)
 */
export function configureErrorHandling(app: Express): void {
  // 404 handler
  app.use('*', (req, res) => {
    logger.warn('404 - Endpoint not found', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId
    });
    
    res.status(404).json({
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      details: {
        method: req.method,
        path: req.path,
        availableEndpoints: [
          'GET /health',
          'POST /api/auth/login',
          'POST /api/auth/register',
          'GET /api/products',
          'POST /api/products/track'
        ]
      },
      supportContact: 'support@picksy.com'
    });
  });

  // Error logging middleware
  app.use(errorLogger);

  // Enhanced error handler
  app.use(enhancedErrorHandler);

  logger.info('Enhanced error handling middleware configured successfully');
}

// Re-export all middleware for convenience
export {
  // Security
  corsMiddleware,
  securityHeaders,
  sanitizeRequest,
  securityMonitoring,
  validateRequest,
  apiGatewaySecurityMiddleware,
  
  // Rate Limiting
  generalRateLimit,
  authRateLimit,
  createUserRateLimit,
  createEndpointRateLimit,
  enforceUsageTier,
  
  // Authentication
  authenticateToken,
  authenticateWithContext,
  optionalAuth,
  requireRole,
  
  // Logging
  requestLogger,
  errorLogger,
  
  // Usage Limiting
  enforceUsageLimit,
  enforceProductLimit,
  trackApiUsage,
  
  // Usage Policy Enforcement
  createUsagePolicyEnforcer,
  createUsageTracker,
  addUsageRecommendations
};