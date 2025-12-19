import { Request, Response, NextFunction } from 'express';
import { financialDataProtectionService } from '../services/financialDataProtection.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to validate that request data does not contain financial information
 */
export function validateNoFinancialData(req: Request, res: Response, next: NextFunction): void {
  try {
    const context = {
      userId: req.user?.userId,
      endpoint: `${req.method} ${req.path}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    // Check request body
    if (req.body && Object.keys(req.body).length > 0) {
      financialDataProtectionService.validateNoFinancialData(req.body, context);
    }
    
    // Check query parameters
    if (req.query && Object.keys(req.query).length > 0) {
      financialDataProtectionService.validateNoFinancialData(req.query, context);
    }
    
    // Check URL parameters
    if (req.params && Object.keys(req.params).length > 0) {
      financialDataProtectionService.validateNoFinancialData(req.params, context);
    }
    
    next();
  } catch (error) {
    logger.error('Financial data protection validation failed', {
      endpoint: `${req.method} ${req.path}`,
      userId: req.user?.userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(400).json({
      error: 'Request blocked for security compliance',
      message: 'The request contains data that cannot be processed for security reasons',
      code: 'FINANCIAL_DATA_DETECTED'
    });
  }
}

/**
 * Middleware specifically for user registration/profile updates
 */
export function validateUserDataSafety(req: Request, res: Response, next: NextFunction): void {
  try {
    const context = {
      userId: req.user?.userId,
      endpoint: `${req.method} ${req.path}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    // Extra strict validation for user data
    if (req.body) {
      financialDataProtectionService.validateNoFinancialData(req.body, context);
      
      // Additional checks for user profile data
      const sensitiveFields = ['password', 'email', 'phone'];
      for (const field of sensitiveFields) {
        if (req.body[field]) {
          // Validate that these fields don't contain financial patterns
          financialDataProtectionService.validateNoFinancialData({ [field]: req.body[field] }, context);
        }
      }
    }
    
    next();
  } catch (error) {
    logger.error('User data safety validation failed', {
      endpoint: `${req.method} ${req.path}`,
      userId: req.user?.userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(400).json({
      error: 'User data validation failed',
      message: 'The provided user data contains information that cannot be stored for security reasons',
      code: 'UNSAFE_USER_DATA'
    });
  }
}

/**
 * Middleware for product tracking data validation
 */
export function validateProductDataSafety(req: Request, res: Response, next: NextFunction): void {
  try {
    const context = {
      userId: req.user?.userId,
      endpoint: `${req.method} ${req.path}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    if (req.body) {
      // Validate product data doesn't contain financial information
      financialDataProtectionService.validateNoFinancialData(req.body, context);
      
      // Additional validation for product URLs and descriptions
      const productFields = ['url', 'title', 'description', 'notes'];
      for (const field of productFields) {
        if (req.body[field]) {
          financialDataProtectionService.validateNoFinancialData({ [field]: req.body[field] }, context);
        }
      }
    }
    
    next();
  } catch (error) {
    logger.error('Product data safety validation failed', {
      endpoint: `${req.method} ${req.path}`,
      userId: req.user?.userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(400).json({
      error: 'Product data validation failed',
      message: 'The product information contains data that cannot be stored for security reasons',
      code: 'UNSAFE_PRODUCT_DATA'
    });
  }
}