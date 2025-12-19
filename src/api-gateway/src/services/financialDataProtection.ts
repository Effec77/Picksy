import { logger } from '../utils/logger.js';
import { db } from '../database/connection.js';
import { generateSecureToken } from '../utils/encryption.js';

/**
 * Patterns that indicate financial data
 */
const FINANCIAL_DATA_PATTERNS = [
  // Credit card patterns
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g, // Credit card numbers
  /\b(?:cvv|cvc|security\s*code|card\s*verification)\s*:?\s*[0-9]{3,4}\b/gi, // CVV codes
  /\b(?:exp|expir|expiry)\s*(?:date)?\s*:?\s*(?:0[1-9]|1[0-2])\s*[\/\-]\s*(?:[0-9]{2}|[0-9]{4})\b/gi, // Expiration dates
  
  // Bank account patterns
  /\b(?:routing|aba|transit)\s*(?:number)?\s*:?\s*[0-9]{9}\b/gi, // Routing numbers
  /\b(?:account|acct)\s*(?:number)?\s*:?\s*[0-9]{8,17}\b/gi, // Account numbers
  
  // SSN patterns
  /\b(?:ssn|social\s*security)\s*(?:number)?\s*:?\s*[0-9]{3}\s*-?\s*[0-9]{2}\s*-?\s*[0-9]{4}\b/gi,
  
  // Financial keywords
  /\b(?:credit\s*card|debit\s*card|bank\s*account|payment\s*method|billing\s*info|financial\s*data)\b/gi,
  
  // Payment processor tokens (should also be blocked)
  /\b(?:stripe|paypal|square|braintree)_[a-zA-Z0-9_]+\b/gi
];

/**
 * Fields that should never be stored
 */
const PROHIBITED_FINANCIAL_FIELDS = [
  'credit_card_number',
  'card_number',
  'cvv',
  'cvc',
  'security_code',
  'expiration_date',
  'exp_date',
  'bank_account_number',
  'routing_number',
  'aba_number',
  'ssn',
  'social_security_number',
  'payment_token',
  'billing_address',
  'payment_method_id'
];

export interface FinancialDataViolation {
  id: string;
  violation_type: 'pattern_match' | 'prohibited_field' | 'suspicious_content';
  detected_pattern?: string;
  field_name?: string;
  content_sample: string; // First 50 chars for audit
  user_id?: string;
  endpoint?: string;
  ip_address?: string;
  user_agent?: string;
  detected_at: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action_taken: 'blocked' | 'sanitized' | 'logged_only';
}

export interface DataBreachAlert {
  id: string;
  alert_type: 'financial_data_detected' | 'unauthorized_access' | 'data_exfiltration';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affected_users?: string[];
  detected_at: Date;
  resolved_at?: Date;
  resolution_notes?: string;
}

export class FinancialDataProtectionService {
  
  /**
   * Validates that data does not contain financial information
   */
  validateNoFinancialData(data: any, context?: { userId?: string; endpoint?: string; ipAddress?: string; userAgent?: string }): void {
    const violations: FinancialDataViolation[] = [];
    
    // Convert data to string for pattern matching
    const dataString = JSON.stringify(data);
    
    // Check for prohibited field names
    if (typeof data === 'object' && data !== null) {
      this.checkProhibitedFields(data, violations, context);
    }
    
    // Check for financial data patterns in content
    this.checkFinancialPatterns(dataString, violations, context);
    
    if (violations.length > 0) {
      // Log all violations
      this.logViolations(violations);
      
      // Determine if we should block the request
      const criticalViolations = violations.filter(v => v.severity === 'critical' || v.severity === 'high');
      
      if (criticalViolations.length > 0) {
        throw new Error('Financial data detected and blocked for security compliance');
      }
    }
  }
  
  /**
   * Checks for prohibited field names
   */
  private checkProhibitedFields(
    data: Record<string, any>, 
    violations: FinancialDataViolation[], 
    context?: { userId?: string; endpoint?: string; ipAddress?: string; userAgent?: string }
  ): void {
    const checkObject = (obj: any, path: string = ''): void => {
      if (typeof obj !== 'object' || obj === null) return;
      
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        const lowerKey = key.toLowerCase();
        
        // Check if field name is prohibited
        const prohibitedField = PROHIBITED_FINANCIAL_FIELDS.find(field => 
          lowerKey.includes(field.toLowerCase()) || field.toLowerCase().includes(lowerKey)
        );
        
        if (prohibitedField) {
          violations.push({
            id: generateSecureToken(16),
            violation_type: 'prohibited_field',
            field_name: fullPath,
            content_sample: String(value).substring(0, 50),
            user_id: context?.userId,
            endpoint: context?.endpoint,
            ip_address: context?.ipAddress,
            user_agent: context?.userAgent,
            detected_at: new Date(),
            severity: 'critical',
            action_taken: 'blocked'
          });
        }
        
        // Recursively check nested objects
        if (typeof value === 'object' && value !== null) {
          checkObject(value, fullPath);
        }
      }
    };
    
    checkObject(data);
  }
  
  /**
   * Checks for financial data patterns in content
   */
  private checkFinancialPatterns(
    content: string, 
    violations: FinancialDataViolation[], 
    context?: { userId?: string; endpoint?: string; ipAddress?: string; userAgent?: string }
  ): void {
    for (const pattern of FINANCIAL_DATA_PATTERNS) {
      const matches = content.match(pattern);
      
      if (matches) {
        for (const match of matches) {
          violations.push({
            id: generateSecureToken(16),
            violation_type: 'pattern_match',
            detected_pattern: pattern.source,
            content_sample: match.substring(0, 50),
            user_id: context?.userId,
            endpoint: context?.endpoint,
            ip_address: context?.ipAddress,
            user_agent: context?.userAgent,
            detected_at: new Date(),
            severity: this.getSeverityForPattern(pattern),
            action_taken: 'blocked'
          });
        }
      }
    }
  }
  
  /**
   * Determines severity based on pattern type
   */
  private getSeverityForPattern(pattern: RegExp): 'low' | 'medium' | 'high' | 'critical' {
    const patternString = pattern.source.toLowerCase();
    
    if (patternString.includes('credit') || patternString.includes('cvv') || patternString.includes('ssn')) {
      return 'critical';
    }
    
    if (patternString.includes('account') || patternString.includes('routing')) {
      return 'high';
    }
    
    if (patternString.includes('payment') || patternString.includes('billing')) {
      return 'medium';
    }
    
    return 'low';
  }
  
  /**
   * Logs violations to database and audit system
   */
  private async logViolations(violations: FinancialDataViolation[]): Promise<void> {
    try {
      for (const violation of violations) {
        await db.query(
          `INSERT INTO financial_data_violations 
           (id, violation_type, detected_pattern, field_name, content_sample, user_id, 
            endpoint, ip_address, user_agent, detected_at, severity, action_taken)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            violation.id,
            violation.violation_type,
            violation.detected_pattern,
            violation.field_name,
            violation.content_sample,
            violation.user_id,
            violation.endpoint,
            violation.ip_address,
            violation.user_agent,
            violation.detected_at,
            violation.severity,
            violation.action_taken
          ]
        );
      }
      
      logger.error('Financial data violations detected', {
        violationCount: violations.length,
        severities: violations.map(v => v.severity),
        types: violations.map(v => v.violation_type)
      });
      
      // Trigger breach alert for critical violations
      const criticalViolations = violations.filter(v => v.severity === 'critical');
      if (criticalViolations.length > 0) {
        await this.triggerDataBreachAlert({
          alert_type: 'financial_data_detected',
          description: `Critical financial data patterns detected in ${criticalViolations.length} violations`,
          severity: 'critical',
          affected_users: [...new Set(criticalViolations.map(v => v.user_id).filter(Boolean))] as string[]
        });
      }
      
    } catch (error) {
      logger.error('Failed to log financial data violations', { error, violationCount: violations.length });
    }
  }
  
  /**
   * Triggers a data breach alert
   */
  async triggerDataBreachAlert(alert: Omit<DataBreachAlert, 'id' | 'detected_at'>): Promise<void> {
    try {
      const alertId = generateSecureToken(16);
      const now = new Date();
      
      await db.query(
        `INSERT INTO data_breach_alerts 
         (id, alert_type, description, severity, affected_users, detected_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          alertId,
          alert.alert_type,
          alert.description,
          alert.severity,
          JSON.stringify(alert.affected_users || []),
          now
        ]
      );
      
      logger.error('Data breach alert triggered', {
        alertId,
        alertType: alert.alert_type,
        severity: alert.severity,
        affectedUserCount: alert.affected_users?.length || 0
      });
      
      // In a real system, this would trigger notifications to security team
      // For now, we'll just log it
      
    } catch (error) {
      logger.error('Failed to trigger data breach alert', { error, alert });
    }
  }
  
  /**
   * Gets financial data violations for audit purposes
   */
  async getViolations(
    filters?: {
      userId?: string;
      severity?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<FinancialDataViolation[]> {
    try {
      let query = 'SELECT * FROM financial_data_violations WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (filters?.userId) {
        query += ` AND user_id = $${paramIndex}`;
        params.push(filters.userId);
        paramIndex++;
      }
      
      if (filters?.severity) {
        query += ` AND severity = $${paramIndex}`;
        params.push(filters.severity);
        paramIndex++;
      }
      
      if (filters?.startDate) {
        query += ` AND detected_at >= $${paramIndex}`;
        params.push(filters.startDate);
        paramIndex++;
      }
      
      if (filters?.endDate) {
        query += ` AND detected_at <= $${paramIndex}`;
        params.push(filters.endDate);
        paramIndex++;
      }
      
      query += ' ORDER BY detected_at DESC';
      
      if (filters?.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
      }
      
      const result = await db.query(query, params);
      return result?.rows || [];
      
    } catch (error) {
      logger.error('Failed to get financial data violations', { error, filters });
      throw new Error('Failed to get financial data violations');
    }
  }
  
  /**
   * Gets data breach alerts
   */
  async getDataBreachAlerts(resolved?: boolean): Promise<DataBreachAlert[]> {
    try {
      let query = 'SELECT * FROM data_breach_alerts';
      const params: any[] = [];
      
      if (resolved !== undefined) {
        query += resolved ? ' WHERE resolved_at IS NOT NULL' : ' WHERE resolved_at IS NULL';
      }
      
      query += ' ORDER BY detected_at DESC';
      
      const result = await db.query(query, params);
      return (result?.rows || []).map(row => ({
        ...row,
        affected_users: JSON.parse(row.affected_users || '[]')
      }));
      
    } catch (error) {
      logger.error('Failed to get data breach alerts', { error });
      throw new Error('Failed to get data breach alerts');
    }
  }
  
  /**
   * Resolves a data breach alert
   */
  async resolveDataBreachAlert(alertId: string, resolutionNotes: string): Promise<void> {
    try {
      await db.query(
        `UPDATE data_breach_alerts 
         SET resolved_at = CURRENT_TIMESTAMP, resolution_notes = $2
         WHERE id = $1`,
        [alertId, resolutionNotes]
      );
      
      logger.info('Data breach alert resolved', { alertId, resolutionNotes });
      
    } catch (error) {
      logger.error('Failed to resolve data breach alert', { error, alertId });
      throw new Error('Failed to resolve data breach alert');
    }
  }
}

export const financialDataProtectionService = new FinancialDataProtectionService();