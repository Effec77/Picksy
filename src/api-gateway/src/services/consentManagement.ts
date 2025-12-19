import { db } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { generateSecureToken } from '../utils/encryption.js';

export interface ConsentRecord {
  id: string;
  user_id: string;
  consent_type: ConsentType;
  granted: boolean;
  granted_at?: Date;
  revoked_at?: Date;
  version: string;
  ip_address?: string;
  user_agent?: string;
  legal_basis: LegalBasis;
  purpose: string;
  data_categories: string[];
  retention_period_days: number;
}

export type ConsentType = 
  | 'data_processing'
  | 'marketing_communications'
  | 'analytics'
  | 'price_tracking'
  | 'notifications'
  | 'data_sharing';

export type LegalBasis = 
  | 'consent'
  | 'contract'
  | 'legal_obligation'
  | 'vital_interests'
  | 'public_task'
  | 'legitimate_interests';

export interface ConsentRequest {
  consent_type: ConsentType;
  purpose: string;
  data_categories: string[];
  retention_period_days: number;
  legal_basis: LegalBasis;
  version: string;
}

export class ConsentManagementService {
  private readonly CURRENT_CONSENT_VERSION = '1.0.0';
  
  /**
   * Records user consent
   */
  async recordConsent(
    userId: string,
    consentRequests: ConsentRequest[],
    ipAddress?: string,
    userAgent?: string
  ): Promise<ConsentRecord[]> {
    const client = await db.getClient();
    const consentRecords: ConsentRecord[] = [];
    
    try {
      await client.query('BEGIN');
      
      for (const request of consentRequests) {
        const consentId = generateSecureToken(16);
        const now = new Date();
        
        const consentRecord: ConsentRecord = {
          id: consentId,
          user_id: userId,
          consent_type: request.consent_type,
          granted: true,
          granted_at: now,
          version: request.version,
          ip_address: ipAddress,
          user_agent: userAgent,
          legal_basis: request.legal_basis,
          purpose: request.purpose,
          data_categories: request.data_categories,
          retention_period_days: request.retention_period_days
        };
        
        // Insert consent record
        await client.query(
          `INSERT INTO user_consents 
           (id, user_id, consent_type, granted, granted_at, version, ip_address, user_agent, 
            legal_basis, purpose, data_categories, retention_period_days)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            consentRecord.id,
            consentRecord.user_id,
            consentRecord.consent_type,
            consentRecord.granted,
            consentRecord.granted_at,
            consentRecord.version,
            consentRecord.ip_address,
            consentRecord.user_agent,
            consentRecord.legal_basis,
            consentRecord.purpose,
            JSON.stringify(consentRecord.data_categories),
            consentRecord.retention_period_days
          ]
        );
        
        consentRecords.push(consentRecord);
      }
      
      await client.query('COMMIT');
      
      logger.info('User consent recorded', {
        userId,
        consentTypes: consentRequests.map(r => r.consent_type),
        ipAddress,
        timestamp: new Date()
      });
      
      return consentRecords;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to record consent', { userId, error });
      throw new Error('Failed to record consent');
    } finally {
      client.release();
    }
  }
  
  /**
   * Revokes user consent
   */
  async revokeConsent(
    userId: string,
    consentTypes: ConsentType[],
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      for (const consentType of consentTypes) {
        // Update existing consent record
        await client.query(
          `UPDATE user_consents 
           SET granted = false, revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $1 AND consent_type = $2 AND granted = true`,
          [userId, consentType]
        );
        
        // Insert revocation audit log
        const revocationId = generateSecureToken(16);
        await client.query(
          `INSERT INTO consent_audit_logs 
           (id, user_id, consent_type, action, ip_address, user_agent, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [revocationId, userId, consentType, 'revoked', ipAddress, userAgent]
        );
      }
      
      await client.query('COMMIT');
      
      logger.info('User consent revoked', {
        userId,
        consentTypes,
        ipAddress,
        timestamp: new Date()
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to revoke consent', { userId, consentTypes, error });
      throw new Error('Failed to revoke consent');
    } finally {
      client.release();
    }
  }
  
  /**
   * Checks if user has granted specific consent
   */
  async hasConsent(userId: string, consentType: ConsentType): Promise<boolean> {
    try {
      const result = await db.query(
        `SELECT granted FROM user_consents 
         WHERE user_id = $1 AND consent_type = $2 AND granted = true
         ORDER BY granted_at DESC LIMIT 1`,
        [userId, consentType]
      );
      
      return result?.rows && result.rows.length > 0 && result.rows[0].granted;
    } catch (error) {
      logger.error('Failed to check consent', { userId, consentType, error });
      return false;
    }
  }
  
  /**
   * Gets all consents for a user
   */
  async getUserConsents(userId: string): Promise<ConsentRecord[]> {
    try {
      const result = await db.query(
        `SELECT * FROM user_consents 
         WHERE user_id = $1 
         ORDER BY granted_at DESC`,
        [userId]
      );
      
      return (result?.rows || []).map(row => ({
        ...row,
        data_categories: JSON.parse(row.data_categories || '[]')
      }));
    } catch (error) {
      logger.error('Failed to get user consents', { userId, error });
      throw new Error('Failed to get user consents');
    }
  }
  
  /**
   * Checks if consent needs to be renewed (version changed)
   */
  async needsConsentRenewal(userId: string, consentType: ConsentType): Promise<boolean> {
    try {
      const result = await db.query(
        `SELECT version FROM user_consents 
         WHERE user_id = $1 AND consent_type = $2 AND granted = true
         ORDER BY granted_at DESC LIMIT 1`,
        [userId, consentType]
      );
      
      if (!result?.rows || result.rows.length === 0) {
        return true; // No consent recorded
      }
      
      return result.rows[0].version !== this.CURRENT_CONSENT_VERSION;
    } catch (error) {
      logger.error('Failed to check consent renewal', { userId, consentType, error });
      return true; // Err on the side of caution
    }
  }
  
  /**
   * Gets required consents for the application
   */
  getRequiredConsents(): ConsentRequest[] {
    return [
      {
        consent_type: 'data_processing',
        purpose: 'Process user data for price tracking functionality',
        data_categories: ['email', 'user_preferences', 'tracked_products'],
        retention_period_days: 365,
        legal_basis: 'consent',
        version: this.CURRENT_CONSENT_VERSION
      },
      {
        consent_type: 'price_tracking',
        purpose: 'Monitor product prices and send notifications',
        data_categories: ['product_urls', 'price_preferences', 'notification_preferences'],
        retention_period_days: 365,
        legal_basis: 'contract',
        version: this.CURRENT_CONSENT_VERSION
      },
      {
        consent_type: 'notifications',
        purpose: 'Send price alerts and system notifications',
        data_categories: ['email', 'notification_preferences'],
        retention_period_days: 90,
        legal_basis: 'consent',
        version: this.CURRENT_CONSENT_VERSION
      }
    ];
  }
  
  /**
   * Gets optional consents for the application
   */
  getOptionalConsents(): ConsentRequest[] {
    return [
      {
        consent_type: 'analytics',
        purpose: 'Improve service quality and user experience',
        data_categories: ['usage_statistics', 'performance_metrics'],
        retention_period_days: 730,
        legal_basis: 'legitimate_interests',
        version: this.CURRENT_CONSENT_VERSION
      },
      {
        consent_type: 'marketing_communications',
        purpose: 'Send promotional emails and product updates',
        data_categories: ['email', 'user_preferences'],
        retention_period_days: 1095,
        legal_basis: 'consent',
        version: this.CURRENT_CONSENT_VERSION
      }
    ];
  }
  
  /**
   * Validates that data processing is allowed based on consent
   */
  async validateDataProcessing(
    userId: string,
    dataCategories: string[],
    purpose: string
  ): Promise<boolean> {
    try {
      // Check if user has granted consent for data processing
      const hasDataProcessingConsent = await this.hasConsent(userId, 'data_processing');
      
      if (!hasDataProcessingConsent) {
        logger.warn('Data processing attempted without consent', {
          userId,
          dataCategories,
          purpose
        });
        return false;
      }
      
      // Get user's consent records to check data categories
      const consents = await this.getUserConsents(userId);
      const dataProcessingConsent = consents.find(
        c => c.consent_type === 'data_processing' && c.granted
      );
      
      if (!dataProcessingConsent) {
        return false;
      }
      
      // Check if all requested data categories are covered by consent
      const allowedCategories = dataProcessingConsent.data_categories;
      const unauthorizedCategories = dataCategories.filter(
        category => !allowedCategories.includes(category)
      );
      
      if (unauthorizedCategories.length > 0) {
        logger.warn('Data processing attempted for unauthorized categories', {
          userId,
          unauthorizedCategories,
          allowedCategories,
          purpose
        });
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to validate data processing', { userId, error });
      return false;
    }
  }
}

export const consentManagementService = new ConsentManagementService();