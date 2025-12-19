import { db } from './connection.js';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Migration {
  id: string;
  name: string;
  sql: string;
  applied_at?: Date;
}

export class MigrationService {
  
  /**
   * Initializes the migration system by creating the migrations table
   */
  async initialize(): Promise<void> {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      logger.info('Migration system initialized');
    } catch (error) {
      logger.error('Failed to initialize migration system', { error });
      throw error;
    }
  }
  
  /**
   * Runs all pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      await this.initialize();
      
      // Get applied migrations
      const appliedResult = await db.query('SELECT id FROM schema_migrations ORDER BY applied_at');
      const appliedMigrations = new Set(appliedResult?.rows?.map(row => row.id) || []);
      
      // Get available migrations
      const availableMigrations = await this.getAvailableMigrations();
      
      // Filter pending migrations
      const pendingMigrations = availableMigrations.filter(
        migration => !appliedMigrations.has(migration.id)
      );
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        return;
      }
      
      logger.info(`Running ${pendingMigrations.length} pending migrations`);
      
      // Run each pending migration
      for (const migration of pendingMigrations) {
        await this.runMigration(migration);
      }
      
      logger.info('All migrations completed successfully');
      
    } catch (error) {
      logger.error('Migration failed', { error });
      throw error;
    }
  }
  
  /**
   * Runs a single migration
   */
  private async runMigration(migration: Migration): Promise<void> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      logger.info(`Running migration: ${migration.name}`);
      
      // Execute migration SQL
      await client.query(migration.sql);
      
      // Record migration as applied
      await client.query(
        'INSERT INTO schema_migrations (id, name) VALUES ($1, $2)',
        [migration.id, migration.name]
      );
      
      await client.query('COMMIT');
      
      logger.info(`Migration completed: ${migration.name}`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Migration failed: ${migration.name}`, { error });
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Gets all available migrations from the migrations directory
   */
  private async getAvailableMigrations(): Promise<Migration[]> {
    const migrations: Migration[] = [];
    
    // Built-in initial schema migration
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    
    migrations.push({
      id: '001_initial_schema',
      name: 'Initial database schema',
      sql: schemaContent
    });
    
    // Look for additional migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    
    try {
      const files = await fs.readdir(migrationsDir);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Ensure consistent ordering
      
      for (const file of migrationFiles) {
        const filePath = path.join(migrationsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const id = file.replace('.sql', '');
        const name = id.replace(/^\d+_/, '').replace(/_/g, ' ');
        
        migrations.push({
          id,
          name,
          sql: content
        });
      }
    } catch (error) {
      // Migrations directory doesn't exist or is empty
      logger.info('No additional migration files found');
    }
    
    return migrations.sort((a, b) => a.id.localeCompare(b.id));
  }
  
  /**
   * Gets the status of all migrations
   */
  async getMigrationStatus(): Promise<{ migration: Migration; applied: boolean }[]> {
    try {
      await this.initialize();
      
      const appliedResult = await db.query('SELECT * FROM schema_migrations ORDER BY applied_at');
      const appliedMigrations = new Map(
        (appliedResult?.rows || []).map(row => [row.id, row])
      );
      
      const availableMigrations = await this.getAvailableMigrations();
      
      return availableMigrations.map(migration => ({
        migration,
        applied: appliedMigrations.has(migration.id)
      }));
      
    } catch (error) {
      logger.error('Failed to get migration status', { error });
      throw error;
    }
  }
  
  /**
   * Creates a new migration file
   */
  async createMigration(name: string, sql: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
      const filename = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
      
      const migrationsDir = path.join(__dirname, 'migrations');
      
      // Ensure migrations directory exists
      try {
        await fs.access(migrationsDir);
      } catch {
        await fs.mkdir(migrationsDir, { recursive: true });
      }
      
      const filePath = path.join(migrationsDir, filename);
      await fs.writeFile(filePath, sql, 'utf-8');
      
      logger.info(`Migration file created: ${filename}`);
      return filename;
      
    } catch (error) {
      logger.error('Failed to create migration file', { error, name });
      throw error;
    }
  }
  
  /**
   * Validates database schema against expected structure
   */
  async validateSchema(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      // Check required tables exist
      const requiredTables = [
        'users',
        'user_consents',
        'consent_audit_logs',
        'deletion_requests',
        'deletion_audit_logs',
        'financial_data_violations',
        'data_breach_alerts'
      ];
      
      for (const table of requiredTables) {
        const result = await db.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )`,
          [table]
        );
        
        if (!result?.rows?.[0]?.exists) {
          issues.push(`Missing required table: ${table}`);
        }
      }
      
      // Check required indexes exist
      const requiredIndexes = [
        'idx_users_email',
        'idx_user_consents_user_id',
        'idx_deletion_requests_status',
        'idx_financial_violations_severity'
      ];
      
      for (const index of requiredIndexes) {
        const result = await db.query(
          `SELECT EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname = $1
          )`,
          [index]
        );
        
        if (!result?.rows?.[0]?.exists) {
          issues.push(`Missing required index: ${index}`);
        }
      }
      
      return {
        valid: issues.length === 0,
        issues
      };
      
    } catch (error) {
      logger.error('Schema validation failed', { error });
      return {
        valid: false,
        issues: [`Schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}

export const migrationService = new MigrationService();