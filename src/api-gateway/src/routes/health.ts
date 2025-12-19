import { Router, Request, Response } from 'express';
import { db } from '../database/connection.js';
import { redis } from '../database/redis.js';
import { databaseStartupService } from '../database/startup.js';
import { logger } from '../utils/logger.js';
import { EnhancedHealthMonitor } from '../services/enhancedHealthMonitor.js';
import { ErrorHandlingService } from '../services/errorHandling.js';

// Import health monitor - will be set by server initialization
let healthMonitor: EnhancedHealthMonitor | null = null;
let offlineMode: any = null;

// Function to set the health monitor instance (called from server.ts)
export function setHealthServices(monitor: any, offline: any) {
  healthMonitor = monitor;
  offlineMode = offline;
}

const router = Router();

// Basic health check
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'picksy-api-gateway'
  });
});

// Detailed health check with dependencies
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    let systemHealth = null;
    let offlineStatus = null;
    
    // Use service health monitor if available
    if (healthMonitor) {
      systemHealth = healthMonitor.getSystemHealth();
    }
    
    // Get offline mode status if available
    if (offlineMode) {
      offlineStatus = offlineMode.getOfflineStatus();
    }
    
    // Fallback to basic database health check
    const basicHealthStatus = await databaseStartupService.getHealthStatus();
    
    const health = {
      status: systemHealth ? 
        (systemHealth.overall === 'healthy' ? 'ok' : 'degraded') : 
        (basicHealthStatus.overall ? 'ok' : 'degraded'),
      timestamp: new Date().toISOString(),
      service: 'picksy-api-gateway',
      systemHealth: systemHealth || {
        overall: basicHealthStatus.overall ? 'healthy' : 'degraded',
        services: [
          {
            name: 'database',
            status: basicHealthStatus.postgresql ? 'healthy' : 'unhealthy',
            lastCheck: new Date()
          },
          {
            name: 'redis', 
            status: basicHealthStatus.redis ? 'healthy' : 'unhealthy',
            lastCheck: new Date()
          }
        ],
        degradedFeatures: basicHealthStatus.overall ? [] : ['Some features may be unavailable']
      },
      offlineMode: offlineStatus || {
        isOffline: false,
        availableFeatures: ['All features available'],
        unavailableFeatures: [],
        cacheStats: { products: 0, priceHistories: 0, oldestCache: null }
      },
      uptime: healthMonitor ? healthMonitor.getUptimeStats() : {},
      stats: basicHealthStatus.stats
    };
    
    const statusCode = (systemHealth?.overall === 'healthy' || basicHealthStatus.overall) ? 200 : 503;
    res.status(statusCode).json(health);
    
  } catch (error) {
    logger.error('Health check error', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'picksy-api-gateway',
      error: 'Health check failed'
    });
  }
});

// Readiness probe (for Kubernetes)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const dbHealthy = await db.healthCheck();
    const redisHealthy = await redis.healthCheck();
    
    if (dbHealthy && redisHealthy) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready' });
    }
  } catch (error) {
    logger.error('Readiness check error', error);
    res.status(503).json({ status: 'not ready' });
  }
});

// Liveness probe (for Kubernetes)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

// System status endpoint for monitoring service degradation
router.get('/system', async (req: Request, res: Response) => {
  try {
    if (!healthMonitor || !offlineMode) {
      return res.status(503).json({
        error: 'Health monitoring services not initialized'
      });
    }

    const systemHealth = healthMonitor.getSystemHealth();
    const offlineStatus = offlineMode.getOfflineStatus();
    const uptimeStats = healthMonitor.getUptimeStats();

    res.json({
      timestamp: new Date().toISOString(),
      system: {
        status: systemHealth.overall,
        degradedFeatures: systemHealth.degradedFeatures,
        services: systemHealth.services.map((service: any) => ({
          name: service.name,
          status: service.status,
          lastCheck: service.lastCheck,
          responseTime: service.responseTime,
          consecutiveFailures: service.consecutiveFailures,
          uptime: uptimeStats[service.name]
        }))
      },
      offlineMode: offlineStatus,
      recommendations: generateRecommendations(systemHealth, offlineStatus)
    });
  } catch (error) {
    logger.error('System status check error', error);
    res.status(500).json({
      error: 'Failed to get system status',
      timestamp: new Date().toISOString()
    });
  }
});

// Performance metrics endpoint
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    if (!healthMonitor) {
      return res.status(503).json({
        error: 'Health monitoring service not initialized'
      });
    }

    const serviceName = req.query.service as string;
    
    if (serviceName) {
      // Get metrics for specific service
      const metrics = healthMonitor.getPerformanceMetrics(serviceName);
      res.json({
        service: serviceName,
        metrics,
        timestamp: new Date().toISOString()
      });
    } else {
      // Get comprehensive health report
      const report = healthMonitor.getComprehensiveHealthReport();
      res.json({
        ...report,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Metrics endpoint error', error);
    res.status(500).json({
      error: 'Failed to get performance metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// Active alerts endpoint
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    if (!healthMonitor) {
      return res.status(503).json({
        error: 'Health monitoring service not initialized'
      });
    }

    const activeAlerts = healthMonitor.getActiveAlerts();
    const automatedResponses = healthMonitor.getAutomatedResponses();
    
    res.json({
      activeAlerts,
      automatedResponses: automatedResponses.slice(-10), // Last 10 responses
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Alerts endpoint error', error);
    res.status(500).json({
      error: 'Failed to get alerts',
      timestamp: new Date().toISOString()
    });
  }
});

// Error statistics endpoint
router.get('/errors', async (req: Request, res: Response) => {
  try {
    const errorService = ErrorHandlingService.getInstance();
    const errorStats = errorService.getErrorStats();
    
    res.json({
      errorStats,
      timestamp: new Date().toISOString(),
      timeWindow: '1 hour'
    });
  } catch (error) {
    logger.error('Error stats endpoint error', error);
    res.status(500).json({
      error: 'Failed to get error statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// Service-specific health check
router.get('/service/:serviceName', async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    
    if (!healthMonitor) {
      return res.status(503).json({
        error: 'Health monitoring service not initialized'
      });
    }

    // Force health check for specific service
    const serviceHealth = await healthMonitor.checkServiceHealthWithMetrics(serviceName);
    
    if (!serviceHealth) {
      return res.status(404).json({
        error: `Service '${serviceName}' not found or not monitored`
      });
    }

    const metrics = healthMonitor.getPerformanceMetrics(serviceName);
    
    res.json({
      service: serviceHealth,
      recentMetrics: metrics.slice(-10), // Last 10 metrics
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Service health check error for ${req.params.serviceName}`, error);
    res.status(500).json({
      error: 'Failed to check service health',
      timestamp: new Date().toISOString()
    });
  }
});

// Resolve alert endpoint
router.post('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    
    if (!healthMonitor) {
      return res.status(503).json({
        error: 'Health monitoring service not initialized'
      });
    }

    const resolved = healthMonitor.resolveAlert(alertId, false);
    
    if (resolved) {
      res.json({
        message: `Alert ${alertId} resolved successfully`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        error: `Alert ${alertId} not found or already resolved`
      });
    }
  } catch (error) {
    logger.error(`Failed to resolve alert ${req.params.alertId}`, error);
    res.status(500).json({
      error: 'Failed to resolve alert',
      timestamp: new Date().toISOString()
    });
  }
});

// System diagnostics endpoint
router.get('/diagnostics', async (req: Request, res: Response) => {
  try {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid
    };

    // Add health monitor diagnostics if available
    if (healthMonitor) {
      const systemHealth = healthMonitor.getSystemHealth();
      const uptimeStats = healthMonitor.getUptimeStats();
      
      diagnostics.systemHealth = systemHealth;
      diagnostics.serviceUptime = uptimeStats;
    }

    // Add database diagnostics
    try {
      const dbStats = await databaseStartupService.getHealthStatus();
      diagnostics.database = dbStats;
    } catch (error) {
      diagnostics.database = { error: 'Failed to get database stats' };
    }

    res.json(diagnostics);
  } catch (error) {
    logger.error('Diagnostics endpoint error', error);
    res.status(500).json({
      error: 'Failed to get system diagnostics',
      timestamp: new Date().toISOString()
    });
  }
});

// Generate user-friendly recommendations based on system status
function generateRecommendations(systemHealth: any, offlineStatus: any): string[] {
  const recommendations: string[] = [];

  if (offlineStatus.isOffline) {
    recommendations.push('System is in offline mode. Limited functionality available.');
    recommendations.push('Check your internet connection and refresh the page.');
  }

  if (systemHealth.overall === 'degraded') {
    recommendations.push('Some services are experiencing issues. Functionality may be limited.');
  }

  if (systemHealth.overall === 'unhealthy') {
    recommendations.push('System is experiencing significant issues. Please try again later.');
  }

  if (systemHealth.degradedFeatures.length > 0) {
    recommendations.push(`Affected features: ${systemHealth.degradedFeatures.join(', ')}`);
  }

  if (recommendations.length === 0) {
    recommendations.push('All systems operational.');
  }

  return recommendations;
}

export default router;