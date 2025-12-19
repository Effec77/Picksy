import { db } from '../database/connection.js';
import { redis } from '../database/redis.js';
import { logger } from '../utils/logger.js';
import { generateSecureToken } from '../utils/encryption.js';

export interface DeletionRequest {
  id: string;
  user_id: string;
  requested_at: Date;
  scheduled_for: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  deletion_type: 'user_requested' | 'retention_policy' | 'admin_requested';
  reason?: string;
  completed_at?: Date;
  verification_token?: string;
}

export interface DeletionAuditLog {
  id: string;
  deletion_request_id: string;
  table_name: string;
  records_deleted: number;
  deleted_at: Date;
  checksum?: string;
}

export class DataDeletionService {
  /**
   * Creates a new deletion request
   */
  async requestDataDeletion(
    userId: string,
    deletionType: DeletionRequest['deletion_type'] = 'user_requested',
    reason?: string
  ): Promise<DeletionRequest> {
    const deletionId = generateSecureToken(16);
    const verificationToken = generateSecureToken(32);
    
    // Schedule deletion for 30 days from now (as per GDPR requirements)
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + 30);
    
    const deletionRequest: DeletionRequest = {
      id: deletionId,
      user_id: userId,
      requested_at: new Date(),
      scheduled_for: scheduledFor,
      status: 'pending',
      deletion_type: deletionType,
      reason,
      verification_token: verificationToken
    };
    
    try {
      await db.query(
        `INSERT INTO deletion_requests 
         (id, user_id, requested_at, scheduled_for, status, deletion_type, reason, verification_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          deletionRequest.id,
          deletionRequest.user_id,
          deletionRequest.requested_at,
          deletionRequest.scheduled_for,
          deletionRequest.status,
          deletionRequest.deletion_type,
          deletionRequest.reason,
          deletionRequest.verification_token
        ]
      );
      
      logger.info('Data deletion request created', {
        deletionId,
        userId,
        scheduledFor: deletionRequest.scheduled_for,
        deletionType
      });
      
      return deletionRequest;
    } catch (error) {
      logger.error('Failed to create deletion request', { userId, error });
      throw new Error('Failed to create deletion request');
    }
  }
  
  /**
   * Cancels a pending deletion request
   */
  async cancelDeletionRequest(deletionId: string, userId: string): Promise<boolean> {
    try {
      const result = await db.query(
        `UPDATE deletion_requests 
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
        [deletionId, userId]
      );
      
      if (!result || result.rowCount === 0) {
        return false;
      }
      
      logger.info('Data deletion request cancelled', { deletionId, userId });
      return true;
    } catch (error) {
      logger.error('Failed to cancel deletion request', { deletionId, userId, error });
      throw new Error('Failed to cancel deletion request');
    }
  }
  
  /**
   * Executes pending deletion requests
   */
  async executePendingDeletions(): Promise<void> {
    try {
      // Get all pending deletions that are due
      const result = await db.query(
        `SELECT * FROM deletion_requests 
         WHERE status = 'pending' AND scheduled_for <= CURRENT_TIMESTAMP
         ORDER BY requested_at ASC`
      );
      
      for (const request of result?.rows || []) {
        await this.executeUserDataDeletion(request);
      }
    } catch (error) {
      logger.error('Failed to execute pending deletions', { error });
      throw error;
    }
  }
  
  /**
   * Executes complete data deletion for a user
   */
  private async executeUserDataDeletion(request: DeletionRequest): Promise<void> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Update request status
      await client.query(
        `UPDATE deletion_requests SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [request.id]
      );
      
      const auditLogs: DeletionAuditLog[] = [];
      
      // Delete user data from all tables in correct order (respecting foreign keys)
      const deletionTables = [
        'user_sessions',
        'price_alerts',
        'tracked_products',
        'user_preferences',
        'audit_logs',
        'users'
      ];
      
      for (const tableName of deletionTables) {
        const deleteResult = await client.query(
          `DELETE FROM ${tableName} WHERE user_id = $1`,
          [request.user_id]
        );
        
        const auditLog: DeletionAuditLog = {
          id: generateSecureToken(16),
          deletion_request_id: request.id,
          table_name: tableName,
          records_deleted: deleteResult.rowCount || 0,
          deleted_at: new Date()
        };
        
        auditLogs.push(auditLog);
        
        // Insert audit log
        await client.query(
          `INSERT INTO deletion_audit_logs 
           (id, deletion_request_id, table_name, records_deleted, deleted_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            auditLog.id,
            auditLog.deletion_request_id,
            auditLog.table_name,
            auditLog.records_deleted,
            auditLog.deleted_at
          ]
        );
      }
      
      // Delete Redis cache data
      await this.deleteUserCacheData(request.user_id);
      
      // Mark deletion as completed
      await client.query(
        `UPDATE deletion_requests 
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [request.id]
      );
      
      await client.query('COMMIT');
      
      logger.info('User data deletion completed', {
        deletionId: request.id,
        userId: request.user_id,
        tablesProcessed: deletionTables.length,
        totalRecordsDeleted: auditLogs.reduce((sum, log) => sum + log.records_deleted, 0)
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Mark deletion as failed
      await client.query(
        `UPDATE deletion_requests 
         SET status = 'failed', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [request.id]
      );
      
      logger.error('User data deletion failed', {
        deletionId: request.id,
        userId: request.user_id,
        error
      });
      
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Deletes user data from Redis cache
   */
  private async deleteUserCacheData(userId: string): Promise<void> {
    try {
      const patterns = [
        `user:${userId}:*`,
        `session:${userId}:*`,
        `rate_limit:${userId}:*`,
        `preferences:${userId}:*`
      ];
      
      for (const pattern of patterns) {
        // Note: In production, consider using SCAN instead of KEYS for better performance
        const keys = await redis.get(`keys:${pattern}`);
        if (keys) {
          const keyList = JSON.parse(keys);
          for (const key of keyList) {
            await redis.del(key);
          }
        }
      }
      
      logger.info('User cache data deleted', { userId });
    } catch (error) {
      logger.error('Failed to delete user cache data', { userId, error });
      // Don't throw here as cache deletion failure shouldn't fail the entire process
    }
  }
  
  /**
   * Gets deletion request status
   */
  async getDeletionStatus(deletionId: string, userId: string): Promise<DeletionRequest | null> {
    try {
      const result = await db.query(
        `SELECT * FROM deletion_requests WHERE id = $1 AND user_id = $2`,
        [deletionId, userId]
      );
      
      return result?.rows?.[0] || null;
    } catch (error) {
      logger.error('Failed to get deletion status', { deletionId, userId, error });
      throw new Error('Failed to get deletion status');
    }
  }
  
  /**
   * Gets all deletion requests for a user
   */
  async getUserDeletionRequests(userId: string): Promise<DeletionRequest[]> {
    try {
      const result = await db.query(
        `SELECT * FROM deletion_requests WHERE user_id = $1 ORDER BY requested_at DESC`,
        [userId]
      );
      
      return result?.rows || [];
    } catch (error) {
      logger.error('Failed to get user deletion requests', { userId, error });
      throw new Error('Failed to get user deletion requests');
    }
  }
}

export const dataDeletionService = new DataDeletionService();