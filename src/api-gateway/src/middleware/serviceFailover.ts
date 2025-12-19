import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { ServiceStatus } from '../services/serviceHealthMonitor.js';
import { ErrorCode } from '../../../shared/types/index.js';

// Extend Request interface to include service status
declare global {
  namespace Express {
    interface Request {
      serviceStatus?: {
        isOffline: boolean;
        degradedServices: string[];
        availableFeatures: string[];
      };
    }
  }
}

/**
 * Middleware that handles service failover and graceful degradation
 */
export function createServiceFailoverMiddleware(
  healthMonitor: any,
  offlineMode: any
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get current system health
      const systemHealth = healthMonitor.getSystemHealth();
      const offlineStatus = offlineMode.getOfflineStatus();

      // Add service status to request for use by route handlers
      req.serviceStatus = {
        isOffline: offlineStatus.isOffline,
        degradedServices: systemHealth.services
          .filter((s: any) => s.status !== ServiceStatus.HEALTHY)
          .map((s: any) => s.name),
        availableFeatures: offlineStatus.availableFeatures
      };

      // Handle requests based on system status
      if (systemHealth.overall === ServiceStatus.UNHEALTHY) {
        // System is unhealthy - check if request can be handled in offline mode
        if (canHandleOffline(req.path, req.method)) {
          logger.warn(`Handling request ${req.method} ${req.path} in offline mode`);
          next();
        } else {
          // Request cannot be handled offline
          return res.status(503).json({
            code: ErrorCode.EXTERNAL_SERVICE_ERROR,
            message: 'Service temporarily unavailable',
            details: {
              systemStatus: systemHealth.overall,
              offlineMode: offlineStatus.isOffline,
              degradedFeatures: systemHealth.degradedFeatures
            },
            retryAfter: 60, // Suggest retry after 60 seconds
            supportContact: 'Please try again later or contact support if the issue persists'
          });
        }
      } else if (systemHealth.overall === ServiceStatus.DEGRADED) {
        // System is degraded - add warning headers but continue
        res.setHeader('X-Service-Status', 'degraded');
        res.setHeader('X-Degraded-Features', systemHealth.degradedFeatures.join(','));
        logger.info(`Handling request ${req.method} ${req.path} with degraded services`);
        next();
      } else {
        // System is healthy
        next();
      }
    } catch (error) {
      logger.error('Service failover middleware error:', error);
      // Don't block requests if middleware fails
      next();
    }
  };
}

/**
 * Check if a request can be handled in offline mode
 */
function canHandleOffline(path: string, method: string): boolean {
  // Define which endpoints can work in offline mode
  const offlineCapableEndpoints = [
    { path: '/health', methods: ['GET'] },
    { path: '/health/live', methods: ['GET'] },
    { path: '/health/system', methods: ['GET'] },
    { path: '/api/products', methods: ['GET'] }, // Can serve cached data
    { path: '/api/auth/verify', methods: ['POST'] }, // Can verify cached tokens
  ];

  return offlineCapableEndpoints.some(endpoint => {
    const pathMatches = path.startsWith(endpoint.path);
    const methodMatches = endpoint.methods.includes(method);
    return pathMatches && methodMatches;
  });
}

/**
 * Middleware to handle external service failures with automatic fallback
 */
export function createExternalServiceFallbackMiddleware(offlineMode: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original res.json to intercept responses
    const originalJson = res.json.bind(res);
    
    res.json = function(body: any) {
      // Check if response indicates external service failure
      if (isExternalServiceError(body)) {
        logger.warn(`External service error detected for ${req.path}, attempting fallback`);
        
        // Try to provide fallback data
        const fallbackData = getFallbackData(req.path, req.query, offlineMode);
        if (fallbackData) {
          // Add headers to indicate fallback data
          res.setHeader('X-Data-Source', 'cache');
          res.setHeader('X-Cache-Age', getCacheAge(req.path, offlineMode));
          
          return originalJson({
            ...fallbackData,
            _metadata: {
              source: 'cache',
              message: 'Data served from cache due to external service unavailability',
              lastUpdated: getCacheTimestamp(req.path, offlineMode)
            }
          });
        }
      }
      
      return originalJson(body);
    };
    
    next();
  };
}

/**
 * Check if response body indicates external service error
 */
function isExternalServiceError(body: any): boolean {
  if (!body || typeof body !== 'object') return false;
  
  return (
    body.code === ErrorCode.EXTERNAL_SERVICE_ERROR ||
    (body.error && body.error.includes('external')) ||
    (body.message && body.message.includes('unavailable'))
  );
}

/**
 * Get fallback data from cache for specific endpoints
 */
function getFallbackData(path: string, query: any, offlineMode: any): any | null {
  try {
    if (path.startsWith('/api/products')) {
      // Try to get cached product data
      const productId = query.id || query.productId;
      if (productId) {
        const cachedProduct = offlineMode.getCachedProduct(productId);
        if (cachedProduct) {
          return { product: cachedProduct };
        }
      }
      
      // Could return list of cached products
      return null;
    }
    
    if (path.includes('/prices')) {
      const productId = query.productId;
      if (productId) {
        const cachedPrices = offlineMode.getCachedPriceHistory(productId);
        if (cachedPrices) {
          return { priceHistory: cachedPrices };
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Error getting fallback data:', error);
    return null;
  }
}

/**
 * Get cache age for a specific path
 */
function getCacheAge(path: string, offlineMode: any): string {
  try {
    // This would need to be implemented based on the specific caching strategy
    const age = offlineMode.getCacheAge(path);
    if (age !== null) {
      return `${Math.floor(age / 1000)}s`;
    }
  } catch (error) {
    logger.error('Error getting cache age:', error);
  }
  return 'unknown';
}

/**
 * Get cache timestamp for a specific path
 */
function getCacheTimestamp(path: string, offlineMode: any): string {
  try {
    // This would need to be implemented based on the specific caching strategy
    return new Date().toISOString();
  } catch (error) {
    logger.error('Error getting cache timestamp:', error);
    return new Date().toISOString();
  }
}

/**
 * Middleware to add service status headers to all responses
 */
export function addServiceStatusHeaders(healthMonitor: any, offlineMode: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const systemHealth = healthMonitor.getSystemHealth();
      const offlineStatus = offlineMode.getOfflineStatus();
      
      // Add service status headers
      res.setHeader('X-System-Status', systemHealth.overall);
      res.setHeader('X-Offline-Mode', offlineStatus.isOffline.toString());
      
      if (systemHealth.degradedFeatures.length > 0) {
        res.setHeader('X-Degraded-Features', systemHealth.degradedFeatures.join(','));
      }
      
      next();
    } catch (error) {
      logger.error('Error adding service status headers:', error);
      next();
    }
  };
}