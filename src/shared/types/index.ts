// Core data models and interfaces for Picksy refactor
// Based on design document specifications

export interface User {
  id: string;
  email: string;
  createdAt: Date;
  preferences: UserPreferences;
  subscription: SubscriptionTier;
}

export interface UserPreferences {
  notificationChannels: NotificationChannel[];
  checkFrequency: number; // minutes
  priceThreshold: number; // percentage
}

export enum SubscriptionTier {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

export enum NotificationChannel {
  BROWSER = 'browser',
  EMAIL = 'email',
  PUSH = 'push'
}

export interface ProductInfo {
  id: string;
  title: string;
  url: string;
  retailer: string;
  category: string;
  brand?: string;
  model?: string;
  imageUrl?: string;
  extractedAt: Date;
}

export interface TrackedProduct extends ProductInfo {
  userId: string;
  targetPrice?: number;
  isActive: boolean;
  addedAt: Date;
}

export interface PricePoint {
  id: string;
  productId: string;
  price: number;
  currency: string;
  availability: AvailabilityStatus;
  checkedAt: Date;
  source: DataSource;
}

export interface PriceHistory {
  productId: string;
  points: PricePoint[];
  statistics: PriceStatistics;
}

export interface PriceStatistics {
  average: number;
  minimum: number;
  maximum: number;
  trend: PriceTrend;
  volatility: number;
}

export enum AvailabilityStatus {
  IN_STOCK = 'in_stock',
  OUT_OF_STOCK = 'out_of_stock',
  LIMITED_STOCK = 'limited_stock',
  UNKNOWN = 'unknown'
}

export enum DataSource {
  OFFICIAL_API = 'official_api',
  LEGAL_SCRAPER = 'legal_scraper',
  CACHED = 'cached'
}

export enum PriceTrend {
  INCREASING = 'increasing',
  DECREASING = 'decreasing',
  STABLE = 'stable',
  VOLATILE = 'volatile'
}

export interface PriceAlert {
  id: string;
  userId: string;
  productId: string;
  alertType: AlertType;
  threshold?: number;
  message: string;
  createdAt: Date;
  delivered: boolean;
}

export enum AlertType {
  PRICE_DROP = 'price_drop',
  PRICE_INCREASE = 'price_increase',
  BACK_IN_STOCK = 'back_in_stock',
  TARGET_PRICE_REACHED = 'target_price_reached'
}

// API Response interfaces
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
  timestamp: Date;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  retryAfter?: number;
  supportContact?: string;
}

export enum ErrorCode {
  UNSUPPORTED_SITE = 'UNSUPPORTED_SITE',
  RATE_LIMITED = 'RATE_LIMITED',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}

// Tracking and monitoring interfaces
export interface TrackingResult {
  success: boolean;
  productId?: string;
  error?: string;
  estimatedNextCheck?: Date;
}

export interface PriceUpdate {
  productId: string;
  oldPrice?: number;
  newPrice: number;
  priceChange: number;
  percentageChange: number;
  updatedAt: Date;
}