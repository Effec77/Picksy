import express from 'express';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { configureSecurityMiddleware, configureErrorHandling } from './middleware/index.js';
import { 
  createServiceFailoverMiddleware, 
  createExternalServiceFallbackMiddleware,
  addServiceStatusHeaders 
} from './middleware/serviceFailover.js';
import { databaseStartupService } from './database/startup.js';
import { EnhancedHealthMonitor } from './services/enhancedHealthMonitor.js';
import { ServiceDependency, ServiceStatus } from './services/serviceHealthMonitor.js';
import { OfflineModeService } from './services/offlineMode.js';
import { NotificationEngine } from './services/notificationEngine.js';
import { InMemoryNotificationQueue } from './services/inMemoryNotificationQueue.js';
import { db } from './database/connection.js';
import { redis } from './database/redis.js';
import authRoutes from './routes/auth.js';
import healthRoutes, { setHealthServices } from './routes/health.js';
import productsRoutes from './routes/products.js';
import notificationRoutes from './routes/notifications.js';
import subscriptionRoutes from './routes/subscription.js';
import affiliateRoutes from './routes/affiliate.js';

const app = express();

// Initialize enhanced service health monitoring and offline mode
const healthMonitor = new EnhancedHealthMonitor();
const offlineMode = new OfflineModeService({
  enabled: true,
  maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
  fallbackDataRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
  limitedFeatures: ['real-time-updates', 'new-product-tracking', 'external-comparisons']
});

// Configure comprehensive security middleware
configureSecurityMiddleware(app);

// Health check routes (no authentication required)
app.use('/health', healthRoutes);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/affiliate', affiliateRoutes);

// Configure error handling (must be last)
configureErrorHandling(app);

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Stop health monitoring
      await healthMonitor.stop();
      
      // Shutdown database connections
      await databaseStartupService.shutdown();
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  });
};

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connections and run migrations
    await databaseStartupService.initialize();
    
    // Set up service health monitoring
    await setupServiceHealthMonitoring();
    
    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`Picksy API Gateway started on port ${config.port}`, {
        environment: config.nodeEnv,
        port: config.port
      });
    });
    
    return server;
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Setup service health monitoring with all dependencies
async function setupServiceHealthMonitoring() {
  try {
    // Register database dependency
    const databaseDependency: ServiceDependency = {
      name: 'database',
      healthCheck: async () => {
        try {
          return await db.healthCheck();
        } catch {
          return false;
        }
      },
      critical: true,
      timeout: 5000
    };

    // Register Redis dependency
    const redisDependency: ServiceDependency = {
      name: 'redis',
      healthCheck: async () => {
        try {
          return await redis.healthCheck();
        } catch {
          return false;
        }
      },
      critical: true,
      timeout: 3000
    };

    // Register external API dependency (mock for now)
    const externalApiDependency: ServiceDependency = {
      name: 'external-api',
      healthCheck: async () => {
        try {
          // In real implementation, this would check retailer APIs
          // For now, simulate with a simple check
          return Math.random() > 0.1; // 90% success rate for demo
        } catch {
          return false;
        }
      },
      critical: false,
      timeout: 10000
    };

    // Register notification service dependency
    const notificationDependency: ServiceDependency = {
      name: 'notification-service',
      healthCheck: async () => {
        try {
          // In real implementation, this would check notification providers
          return Math.random() > 0.05; // 95% success rate for demo
        } catch {
          return false;
        }
      },
      critical: false,
      timeout: 5000
    };

    // Register all services
    healthMonitor.registerService(databaseDependency);
    healthMonitor.registerService(redisDependency);
    healthMonitor.registerService(externalApiDependency);
    healthMonitor.registerService(notificationDependency);

    // Set up notification engine for health alerts
    const notificationQueue = new InMemoryNotificationQueue();
    const notificationEngine = new NotificationEngine(notificationQueue);
    healthMonitor.setNotificationEngine(notificationEngine);

    // Start monitoring
    await healthMonitor.start();

    // Set up automatic offline mode switching based on health status
    setInterval(async () => {
      const systemHealth = healthMonitor.getSystemHealth();
      
      if (systemHealth.overall === ServiceStatus.UNHEALTHY && !offlineMode.isOffline()) {
        logger.warn('System unhealthy, enabling offline mode');
        offlineMode.enableOfflineMode();
      } else if (systemHealth.overall === ServiceStatus.HEALTHY && offlineMode.isOffline()) {
        logger.info('System healthy, disabling offline mode');
        offlineMode.disableOfflineMode();
      }
    }, 30000); // Check every 30 seconds

    // Clean up expired cache periodically
    setInterval(() => {
      offlineMode.cleanupExpiredCache();
    }, 60000); // Clean up every minute

    // Set health services in routes
    setHealthServices(healthMonitor, offlineMode);

    // Configure service failover middleware for API routes
    app.use('/api', addServiceStatusHeaders(healthMonitor, offlineMode));
    app.use('/api', createServiceFailoverMiddleware(healthMonitor, offlineMode));
    app.use('/api', createExternalServiceFallbackMiddleware(offlineMode));

    logger.info('Service health monitoring and offline mode initialized');
  } catch (error) {
    logger.error('Failed to setup service health monitoring:', error);
    throw error;
  }
}

const server = await startServer();

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Export services for use in other modules
export { healthMonitor, offlineMode };
export default app;