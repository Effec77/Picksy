/**
 * Type definitions for Picksy Extension
 */

export interface ProductInfo {
  id?: string;
  title: string;
  price: number;
  currency: string;
  url: string;
  imageUrl?: string;
  retailer: string;
  brand?: string;
  model?: string;
  category?: string;
  availability?: string;
  extractedAt: Date;
}

export interface TrackedProduct extends ProductInfo {
  id: string;
  userId?: string;
  targetPrice?: number;
  isActive: boolean;
  addedAt: string;
  lastChecked?: string;
  priceHistory?: PricePoint[];
}

export interface PricePoint {
  price: number;
  currency: string;
  timestamp: string;
  availability: string;
}

export interface UserPreferences {
  notificationChannels: NotificationChannel[];
  checkFrequency: number; // minutes
  priceThreshold: number; // percentage
  enableOnboarding: boolean;
}

export enum NotificationChannel {
  BROWSER = 'browser',
  EMAIL = 'email',
  PUSH = 'push'
}

export interface ExtensionError {
  code: string;
  message: string;
  details?: any;
  recoveryOptions?: RecoveryOption[];
  timestamp: Date;
}

export interface RecoveryOption {
  label: string;
  action: () => void;
  description?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ExtensionError;
  timestamp: string;
}

export interface SiteSupport {
  domain: string;
  supported: boolean;
  reason?: string;
  alternatives?: string[];
}

export interface PerformanceMetrics {
  initializationTime: number;
  productDetectionTime: number;
  apiResponseTime: number;
  memoryUsage: number;
}