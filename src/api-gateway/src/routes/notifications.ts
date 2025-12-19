import { Router, Request, Response } from 'express';
import { 
  PriceAlert, 
  NotificationChannel, 
  UserPreferences,
  ApiResponse,
  ErrorCode
} from '../../../shared/types';
import { NotificationService } from '../services/notificationService';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Initialize notification service
const notificationService = new NotificationService({
  rateLimitPerUser: 10, // 10 notifications per hour
  rateLimitWindow: 60 * 60 * 1000, // 1 hour
  enableOfflineMode: true,
  maxCacheAge: 30 * 60 * 1000 // 30 minutes
});

// Start the service
notificationService.start().catch(error => {
  logger.error('Failed to start notification service:', error);
});

/**
 * Send a price alert notification
 */
router.post('/alerts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { alert, userPreferences } = req.body;
    const userId = (req as any).user.userId;

    // Validate input
    if (!alert || !userPreferences) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Alert and user preferences are required'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    // Ensure alert belongs to authenticated user
    if (alert.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.PERMISSION_DENIED,
          message: 'Cannot send alerts for other users'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    // Send the alert
    const result = await notificationService.sendPriceAlert(alert, userPreferences);

    if (result.success) {
      res.json({
        success: true,
        data: {
          alertId: alert.id,
          deliveries: result.deliveries,
          message: 'Alert queued for delivery'
        },
        timestamp: new Date()
      } as ApiResponse<any>);
    } else {
      res.status(429).json({
        success: false,
        error: {
          code: ErrorCode.RATE_LIMITED,
          message: result.error || 'Failed to send alert',
          retryAfter: 3600 // 1 hour
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }
  } catch (error) {
    logger.error('Error sending price alert:', error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.EXTERNAL_SERVICE_ERROR,
        message: 'Internal server error while sending alert'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * Update user notification preferences
 */
router.put('/preferences', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const preferences: UserPreferences = req.body;

    // Validate preferences
    if (!preferences.notificationChannels || !Array.isArray(preferences.notificationChannels)) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Valid notification channels are required'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    // Validate channels
    const validChannels = Object.values(NotificationChannel);
    const invalidChannels = preferences.notificationChannels.filter(
      channel => !validChannels.includes(channel)
    );

    if (invalidChannels.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: `Invalid notification channels: ${invalidChannels.join(', ')}`
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    // Update preferences
    const result = await notificationService.updateUserPreferences(userId, preferences);

    if (result.success) {
      res.json({
        success: true,
        data: {
          validChannels: result.validChannels,
          message: 'Notification preferences updated successfully'
        },
        timestamp: new Date()
      } as ApiResponse<any>);
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCode.EXTERNAL_SERVICE_ERROR,
          message: result.error || 'Failed to update preferences'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }
  } catch (error) {
    logger.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.EXTERNAL_SERVICE_ERROR,
        message: 'Internal server error while updating preferences'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * Get notification service status
 */
router.get('/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const status = await notificationService.getServiceStatus();

    res.json({
      success: true,
      data: status,
      timestamp: new Date()
    } as ApiResponse<any>);
  } catch (error) {
    logger.error('Error getting notification status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.EXTERNAL_SERVICE_ERROR,
        message: 'Failed to get service status'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * Trigger manual health check (admin only)
 */
router.post('/health-check', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user.role;
    
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.PERMISSION_DENIED,
          message: 'Admin access required'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    await notificationService.triggerHealthCheck();

    res.json({
      success: true,
      data: { message: 'Health check triggered successfully' },
      timestamp: new Date()
    } as ApiResponse<any>);
  } catch (error) {
    logger.error('Error triggering health check:', error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.EXTERNAL_SERVICE_ERROR,
        message: 'Failed to trigger health check'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * Clear rate limits for a user (admin only)
 */
router.delete('/rate-limits/:userId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user.role;
    const targetUserId = req.params.userId;
    
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.PERMISSION_DENIED,
          message: 'Admin access required'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    notificationService.clearUserRateLimit(targetUserId);

    res.json({
      success: true,
      data: { message: `Rate limits cleared for user ${targetUserId}` },
      timestamp: new Date()
    } as ApiResponse<any>);
  } catch (error) {
    logger.error('Error clearing rate limits:', error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.EXTERNAL_SERVICE_ERROR,
        message: 'Failed to clear rate limits'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

export default router;