import { Pool, PoolClient } from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface ConnectionStats {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
}

class DatabaseConnection {
  private pool: Pool;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private maxRetries: number = 5;
  private retryDelay: number = 1000; // 1 second

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      min: 2, // Minimum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
      // acquireTimeoutMillis: 60000, // Not available in pg library
      statement_timeout: 30000, // 30 second statement timeout
      query_timeout: 30000, // 30 second query timeout
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', { error: err });
      this.isConnected = false;
    });

    // Handle client connections
    this.pool.on('connect', (client: PoolClient) => {
      logger.debug('New client connected to database');
      this.isConnected = true;
      this.connectionAttempts = 0;
    });

    // Handle client acquisition
    this.pool.on('acquire', (client: PoolClient) => {
      logger.debug('Client acquired from pool');
    });

    // Handle client release
    this.pool.on('release', (err: Error | undefined, client: PoolClient) => {
      if (err) {
        logger.error('Client released with error', { error: err });
      } else {
        logger.debug('Client released back to pool');
      }
    });

    // Handle client removal
    this.pool.on('remove', (client: PoolClient) => {
      logger.debug('Client removed from pool');
    });
  }

  async query(text: string, params?: any[]) {
    const start = Date.now();
    let retries = 0;
    
    while (retries < this.maxRetries) {
      try {
        const result = await this.pool.query(text, params);
        const duration = Date.now() - start;
        
        logger.debug('Executed query', { 
          text: text.substring(0, 100), // Truncate long queries for logging
          duration, 
          rows: result.rowCount,
          retries 
        });
        
        return result;
      } catch (error) {
        retries++;
        
        if (this.isRetryableError(error) && retries < this.maxRetries) {
          logger.warn('Retryable database error, attempting retry', { 
            text: text.substring(0, 100),
            error: error instanceof Error ? error.message : 'Unknown error',
            retries,
            maxRetries: this.maxRetries
          });
          
          await this.delay(this.retryDelay * retries); // Exponential backoff
          continue;
        }
        
        logger.error('Database query error', { 
          text: text.substring(0, 100),
          error,
          retries,
          finalAttempt: true
        });
        
        throw error;
      }
    }
  }

  async getClient(): Promise<PoolClient> {
    try {
      const client = await this.pool.connect();
      return client;
    } catch (error) {
      logger.error('Failed to acquire database client', { error });
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection pool closed');
    } catch (error) {
      logger.error('Error closing database connection pool', { error });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health_check');
      this.isConnected = true;
      return result?.rows?.[0]?.health_check === 1;
    } catch (error) {
      logger.error('Database health check failed', { error });
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Gets connection pool statistics
   */
  getConnectionStats(): ConnectionStats {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount
    };
  }

  /**
   * Checks if the database is currently connected
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Determines if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const retryableCodes = [
      'ECONNRESET',
      'ECONNREFUSED', 
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      '53300', // PostgreSQL: too_many_connections
      '53400', // PostgreSQL: configuration_limit_exceeded
      '08000', // PostgreSQL: connection_exception
      '08003', // PostgreSQL: connection_does_not_exist
      '08006', // PostgreSQL: connection_failure
    ];
    
    return retryableCodes.includes(error.code) || 
           retryableCodes.includes(error.errno) ||
           (error.message && error.message.includes('connection'));
  }

  /**
   * Delays execution for the specified number of milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Performs a transaction with automatic rollback on error
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back due to error', { error });
      throw error;
    } finally {
      client.release();
    }
  }
}

export const db = new DatabaseConnection();