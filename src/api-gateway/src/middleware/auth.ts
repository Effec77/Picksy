import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.js';
import { logger } from '../utils/logger.js';
import { ErrorCode, UserRole, SubscriptionTier } from '../types/index.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: UserRole;
        subscriptionTier: SubscriptionTier;
      };
    }
  }
}

const authService = new AuthService();

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        code: ErrorCode.AUTHENTICATION_FAILED,
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const payload = await authService.validateToken(token);
    
    if (!payload) {
      return res.status(401).json({
        code: ErrorCode.INVALID_TOKEN,
        message: 'Invalid or expired token'
      });
    }

    // Attach user info to request
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      subscriptionTier: payload.subscriptionTier
    };

    logger.debug('User authenticated', { userId: payload.userId, email: payload.email });
    next();
  } catch (error) {
    logger.error('Authentication middleware error', error);
    return res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Authentication service error'
    });
  }
};

export const requireRole = (requiredRole: UserRole) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        code: ErrorCode.AUTHENTICATION_FAILED,
        message: 'Authentication required'
      });
    }

    if (req.user.role !== requiredRole && req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({
        code: ErrorCode.AUTHENTICATION_FAILED,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);
    const payload = await authService.validateToken(token);
    
    if (payload) {
      req.user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        subscriptionTier: payload.subscriptionTier
      };
      
      // Log successful authentication for monitoring
      logger.debug('Optional authentication successful', { 
        userId: payload.userId, 
        email: payload.email,
        path: req.path
      });
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error', error);
    next(); // Continue without authentication on error
  }
};

// Enhanced authentication with request context
export const authenticateWithContext = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication attempt without proper header', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      return res.status(401).json({
        code: ErrorCode.AUTHENTICATION_FAILED,
        message: 'Missing or invalid authorization header',
        details: {
          expectedFormat: 'Bearer <token>',
          loginUrl: '/api/auth/login'
        }
      });
    }

    const token = authHeader.substring(7);
    const payload = await authService.validateToken(token);
    
    if (!payload) {
      logger.warn('Authentication failed with invalid token', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        tokenPrefix: token.substring(0, 10) + '...'
      });
      
      return res.status(401).json({
        code: ErrorCode.INVALID_TOKEN,
        message: 'Invalid or expired token',
        details: {
          loginUrl: '/api/auth/login'
        }
      });
    }

    // Attach user info and request context
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      subscriptionTier: payload.subscriptionTier
    };

    // Add request context for monitoring
    (req as any).authContext = {
      authenticatedAt: new Date(),
      tokenIssuedAt: new Date(payload.iat * 1000),
      tokenExpiresAt: new Date(payload.exp * 1000)
    };

    logger.debug('Authentication successful', { 
      userId: payload.userId, 
      email: payload.email,
      path: req.path,
      tokenAge: Date.now() - (payload.iat * 1000)
    });
    
    next();
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      path: req.path
    });
    
    return res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Authentication service error'
    });
  }
};