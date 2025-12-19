import { logger } from './logger.js';

/**
 * Defines what fields are essential for each data type
 */
const ESSENTIAL_FIELDS = {
  user: ['id', 'email', 'role', 'created_at', 'is_active'],
  product: ['id', 'title', 'url', 'retailer', 'category', 'extracted_at'],
  price: ['id', 'product_id', 'price', 'currency', 'availability', 'checked_at', 'source'],
  tracking: ['id', 'user_id', 'product_id', 'target_price', 'is_active', 'added_at']
} as const;

/**
 * Fields that should never be stored (financial data, etc.)
 */
const PROHIBITED_FIELDS = [
  'credit_card',
  'card_number',
  'cvv',
  'ssn',
  'social_security',
  'bank_account',
  'routing_number',
  'payment_method',
  'billing_address',
  'full_address'
] as const;

/**
 * Fields that require encryption when stored
 */
const SENSITIVE_FIELDS = [
  'email',
  'phone',
  'address',
  'personal_info'
] as const;

type DataType = keyof typeof ESSENTIAL_FIELDS;

/**
 * Validates that data contains only essential fields
 */
export function validateEssentialFields<T extends Record<string, any>>(
  data: T,
  dataType: DataType
): Partial<T> {
  const essentialFields = ESSENTIAL_FIELDS[dataType];
  const minimizedData: Partial<T> = {};
  
  // Only include essential fields
  for (const field of essentialFields) {
    if (field in data) {
      minimizedData[field as keyof T] = data[field];
    }
  }
  
  // Log if non-essential fields were removed
  const removedFields = Object.keys(data).filter(
    key => !essentialFields.includes(key as any)
  );
  
  if (removedFields.length > 0) {
    logger.info('Data minimization applied', {
      dataType,
      removedFields,
      retainedFields: Object.keys(minimizedData)
    });
  }
  
  return minimizedData;
}

/**
 * Checks if data contains prohibited fields
 */
export function validateProhibitedFields(data: Record<string, any>): void {
  const dataKeys = Object.keys(data).map(key => key.toLowerCase());
  const foundProhibited = PROHIBITED_FIELDS.filter(prohibited =>
    dataKeys.some(key => key.includes(prohibited))
  );
  
  if (foundProhibited.length > 0) {
    logger.error('Prohibited fields detected in data', {
      prohibitedFields: foundProhibited,
      dataKeys
    });
    throw new Error(`Prohibited fields detected: ${foundProhibited.join(', ')}`);
  }
}

/**
 * Identifies fields that need encryption
 */
export function identifySensitiveFields(data: Record<string, any>): string[] {
  const dataKeys = Object.keys(data).map(key => key.toLowerCase());
  return SENSITIVE_FIELDS.filter(sensitive =>
    dataKeys.some(key => key.includes(sensitive))
  );
}

/**
 * Sanitizes data by applying data minimization and validation
 */
export function sanitizeData<T extends Record<string, any>>(
  data: T,
  dataType: DataType
): Partial<T> {
  // First check for prohibited fields
  validateProhibitedFields(data);
  
  // Then apply data minimization
  const minimizedData = validateEssentialFields(data, dataType);
  
  // Log sensitive fields for audit purposes
  const sensitiveFields = identifySensitiveFields(data);
  if (sensitiveFields.length > 0) {
    logger.info('Sensitive fields identified', {
      dataType,
      sensitiveFields,
      requiresEncryption: true
    });
  }
  
  return minimizedData;
}

/**
 * Creates a data retention policy checker
 */
export class DataRetentionPolicy {
  private static readonly RETENTION_PERIODS = {
    user_activity: 90, // days
    price_history: 365, // days
    audit_logs: 2555, // 7 years
    session_data: 1, // days
    temporary_data: 0.04 // 1 hour in days
  };
  
  static shouldRetain(dataType: keyof typeof DataRetentionPolicy.RETENTION_PERIODS, createdAt: Date): boolean {
    const retentionDays = this.RETENTION_PERIODS[dataType];
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    const now = new Date();
    
    return (now.getTime() - createdAt.getTime()) < retentionMs;
  }
  
  static getRetentionPeriod(dataType: keyof typeof DataRetentionPolicy.RETENTION_PERIODS): number {
    return this.RETENTION_PERIODS[dataType];
  }
  
  static getAllDataTypes(): string[] {
    return Object.keys(this.RETENTION_PERIODS);
  }
}