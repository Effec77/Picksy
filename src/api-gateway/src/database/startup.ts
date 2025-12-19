import { db } from './connection.js';
import { redis } from './redis.js';
import { migrationService } from './migrations.js';
import { logger } from '../utils/logger.js';

export class DatabaseStartupService {
  
  /**
   * Initializes all database connections and runs migrations
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Starting database initialization...');
      
      // Test PostgreSQL connection
      await this.testPostgreSQLConnection();
      
      // Test Redis connection
      await this.testRedisConnection();
      
      // Run database migrations
      await this.runMigrations();
      
      // Validate schema
      await this.validateSchema();
      
      logger.info('Database initialization completed successfully');
      
    } catch (error) {
      logger.error('Database initialization failed', { error });
      throw error;
    }
  }
  
  /**
   * Tests PostgreSQL connection
   */
  private async testPostgreSQLConnection(): Promise<void> {
    try {
      const isHealthy = await db.healthCheck();
      
      if (!isHealthy) {
        throw new Error('PostgreSQL health check failed');
      }
      
      const stats = db.getConnectionStats();
      logger.info('PostgreSQL connection established', {
        totalConnections: stats.totalConnections,
        idleConnections: stats.idleConnections,
        waitingClients: stats.waitingClients
      });
      
    } catch (error) {
      logger.error('PostgreSQL connection failed', { error });
      throw new Error(`PostgreSQL connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Tests Redis connection
   */
  private async testRedisConnection(): Promise<void> {
    try {
      const isHealthy = await redis.healthCheck();
      
      if (!isHealthy) {
        throw new Error('Redis health check failed');
      }
      
      logger.info('Redis connection established');
      
    } catch (error) {
      logger.error('Redis connection failed', { error });
      throw new Error(`Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Runs database migrations
   */
  private async runMigrations(): Promise<void> {
    try {
      logger.info('Running database migrations...');
      
      await migrationService.runMigrations();
      
      // Get migration status for logging
      const migrationStatus = await migrationService.getMigrationStatus();
      const appliedCount = migrationStatus.filter(m => m.applied).length;
      const totalCount = migrationStatus.length;
      
      logger.info('Database migrations completed', {
        appliedMigrations: appliedCount,
        totalMigrations: totalCount
      });
      
    } catch (error) {
      logger.error('Database migration failed', { error });
      throw new Error(`Database migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Validates database schema
   */
  private async validateSchema(): Promise<void> {
    try {
      logger.info('Validating database schema...');
      
      const validation = await migrationService.validateSchema();
      
      if (!validation.valid) {
        logger.error('Schema validation failed', { issues: validation.issues });
        throw new Error(`Schema validation failed: ${validation.issues.join(', ')}`);
      }
      
      logger.info('Database schema validation passed');
      
    } catch (error) {
      logger.error('Schema validation error', { error });
      throw new Error(`Schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Gracefully shuts down database connections
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down database connections...');
      
      await Promise.all([
        db.close(),
        redis.disconnect()
      ]);
      
      logger.info('Database connections closed successfully');
      
    } catch (error) {
      logger.error('Error during database shutdown', { error });
      throw error;
    }
  }
  
  /**
   * Gets overall database health status
   */
  async getHealthStatus(): Promise<{
    postgresql: boolean;
    redis: boolean;
    overall: boolean;
    stats?: any;
  }> {
    try {
      const [postgresqlHealth, redisHealth] = await Promise.all([
        db.healthCheck(),
        redis.healthCheck()
      ]);
      
      const stats = {
        postgresql: db.getConnectionStats(),
        redis: {
          connected: redisHealth
        }
      };
      
      return {
        postgresql: postgresqlHealth,
        redis: redisHealth,
        overall: postgresqlHealth && redisHealth,
        stats
      };
      
    } catch (error) {
      logger.error('Health status check failed', { error });
      return {
        postgresql: false,
        redis: false,
        overall: false
      };
    }
  }
}

export const databaseStartupService = new DatabaseStartupService();