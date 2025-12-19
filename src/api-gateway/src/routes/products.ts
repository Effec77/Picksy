import { Router, Request, Response } from 'express';
import { 
  enhancedAuth,
  createEndpointRateLimit,
  enforceUsageTier,
  enforceProductLimit,
  enforceUsageLimit
} from '../middleware/index.js';
import { UserRole, SubscriptionTier } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { apiDataCollectionService } from '../services/apiDataCollection.js';
import { dataCollectionService } from '../services/dataCollection.js';

const router = Router();

// Rate limits for different user tiers on product endpoints
const productTrackingLimits = createEndpointRateLimit('product-tracking', {
  anonymous: 5,        // 5 requests per window for anonymous users
  [UserRole.USER]: 50, // 50 requests per window for registered users
  [UserRole.ADMIN]: 500, // 500 requests per window for admin users
  [SubscriptionTier.FREE]: 20,     // 20 requests for free tier
  [SubscriptionTier.PREMIUM]: 100, // 100 requests for premium tier
  [SubscriptionTier.ENTERPRISE]: 500 // 500 requests for enterprise tier
});

const priceCheckLimits = createEndpointRateLimit('price-check', {
  anonymous: 10,
  [UserRole.USER]: 100,
  [UserRole.ADMIN]: 1000,
  [SubscriptionTier.FREE]: 50,
  [SubscriptionTier.PREMIUM]: 200,
  [SubscriptionTier.ENTERPRISE]: 1000
});

// Add product to tracking using API-first data collection
router.post('/track', 
  enhancedAuth,
  enforceUsageTier(UserRole.USER),
  enforceProductLimit,
  productTrackingLimits,
  async (req: Request, res: Response) => {
    try {
      const { url, enableDeduplication = true, enableRetry = true } = req.body;
      
      if (!url) {
        return res.status(400).json({
          code: 'INVALID_INPUT',
          message: 'Product URL is required'
        });
      }

      logger.info('Product tracking request', {
        userId: req.user?.userId,
        productUrl: url
      });

      // Use API-first data collection
      const result = await apiDataCollectionService.collectProductData(url, {
        enableDeduplication,
        enableRetry,
        maxRetryAttempts: 3
      });

      if (!result.success) {
        return res.status(400).json({
          code: 'COLLECTION_FAILED',
          message: result.error || 'Failed to collect product data'
        });
      }
      
      res.json({
        success: true,
        message: 'Product added to tracking',
        data: {
          productId: result.productId,
          trackingEnabled: true,
          estimatedNextCheck: result.estimatedNextCheck
        }
      });
    } catch (error) {
      logger.error('Product tracking error', error);
      res.status(500).json({
        code: 'TRACKING_ERROR',
        message: 'Failed to add product to tracking'
      });
    }
  }
);

// Example: Check current prices (allows anonymous with lower limits)
router.get('/prices/:productId',
  priceCheckLimits,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      
      logger.info('Price check request', {
        productId,
        userId: req.user?.userId || 'anonymous',
        userTier: req.user?.role || 'anonymous'
      });
      
      res.json({
        success: true,
        data: {
          productId,
          currentPrice: 29.99,
          currency: 'USD',
          lastUpdated: new Date().toISOString(),
          priceHistory: [] // Would be populated from database
        }
      });
    } catch (error) {
      logger.error('Price check error', error);
      res.status(500).json({
        code: 'PRICE_CHECK_ERROR',
        message: 'Failed to check product price'
      });
    }
  }
);

// Example: Get user's tracked products (requires authentication)
router.get('/tracked',
  enhancedAuth,
  enforceUsageTier(UserRole.USER),
  createEndpointRateLimit('get-tracked', {
    [UserRole.USER]: 30,
    [UserRole.ADMIN]: 300
  }),
  async (req: Request, res: Response) => {
    try {
      logger.info('Get tracked products request', {
        userId: req.user?.userId
      });
      
      res.json({
        success: true,
        data: {
          products: [], // Would be populated from database
          totalCount: 0,
          limits: {
            current: 0,
            maximum: req.user?.role === UserRole.ADMIN ? 1000 : 100
          }
        }
      });
    } catch (error) {
      logger.error('Get tracked products error', error);
      res.status(500).json({
        code: 'GET_TRACKED_ERROR',
        message: 'Failed to get tracked products'
      });
    }
  }
);

// Batch add multiple products to tracking
router.post('/track/batch',
  enhancedAuth,
  enforceUsageTier(UserRole.USER),
  createEndpointRateLimit('batch-tracking', {
    [UserRole.USER]: 5,   // 5 batch requests per window
    [UserRole.ADMIN]: 20  // 20 batch requests per window
  }),
  async (req: Request, res: Response) => {
    try {
      const { urls, enableDeduplication = true, enableRetry = true } = req.body;
      
      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({
          code: 'INVALID_INPUT',
          message: 'URLs array is required and must not be empty'
        });
      }

      if (urls.length > 10) {
        return res.status(400).json({
          code: 'BATCH_TOO_LARGE',
          message: 'Maximum 10 URLs allowed per batch request'
        });
      }

      logger.info('Batch product tracking request', {
        userId: req.user?.userId,
        urlCount: urls.length
      });

      const results = await apiDataCollectionService.batchCollectProducts(urls, {
        enableDeduplication,
        enableRetry,
        maxRetryAttempts: 2 // Lower retry for batch to avoid timeouts
      });

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      res.json({
        success: true,
        message: `Batch processing completed: ${successful.length}/${urls.length} successful`,
        data: {
          successful: successful.length,
          failed: failed.length,
          results: results
        }
      });
    } catch (error) {
      logger.error('Batch tracking error', error);
      res.status(500).json({
        code: 'BATCH_TRACKING_ERROR',
        message: 'Failed to process batch tracking request'
      });
    }
  }
);

// Check if URL is supported for tracking
router.post('/check-support',
  createEndpointRateLimit('check-support', {
    anonymous: 20,
    [UserRole.USER]: 100,
    [UserRole.ADMIN]: 500
  }),
  async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({
          code: 'INVALID_INPUT',
          message: 'URL is required'
        });
      }

      const isSupported = dataCollectionService.isSupportedUrl(url);
      const supportedRetailers = apiDataCollectionService.getSupportedRetailers();

      res.json({
        success: true,
        data: {
          supported: isSupported,
          url: url,
          supportedRetailers: supportedRetailers
        }
      });
    } catch (error) {
      logger.error('Check support error', error);
      res.status(500).json({
        code: 'CHECK_SUPPORT_ERROR',
        message: 'Failed to check URL support'
      });
    }
  }
);

// Get data collection health status
router.get('/collection/health',
  enhancedAuth,
  enforceUsageTier(UserRole.ADMIN), // Admin only
  async (req: Request, res: Response) => {
    try {
      const healthStatus = apiDataCollectionService.getHealthStatus();
      
      res.json({
        success: true,
        data: healthStatus
      });
    } catch (error) {
      logger.error('Health check error', error);
      res.status(500).json({
        code: 'HEALTH_CHECK_ERROR',
        message: 'Failed to get health status'
      });
    }
  }
);

// Get supported retailers and their capabilities
router.get('/retailers',
  createEndpointRateLimit('get-retailers', {
    anonymous: 10,
    [UserRole.USER]: 50,
    [UserRole.ADMIN]: 200
  }),
  async (req: Request, res: Response) => {
    try {
      const retailers = apiDataCollectionService.getSupportedRetailers();
      
      res.json({
        success: true,
        data: {
          retailers: retailers,
          totalCount: retailers.length
        }
      });
    } catch (error) {
      logger.error('Get retailers error', error);
      res.status(500).json({
        code: 'GET_RETAILERS_ERROR',
        message: 'Failed to get supported retailers'
      });
    }
  }
);

export default router;