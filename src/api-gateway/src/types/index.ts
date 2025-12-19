export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

export enum SubscriptionTier {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: Omit<User, 'passwordHash'>;
  expiresIn: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  retryAfter?: number;
  supportContact?: string;
}

export enum ErrorCode {
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
  INVALID_TOKEN = "INVALID_TOKEN",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS",
  INVALID_INPUT = "INVALID_INPUT",
  RATE_LIMITED = "RATE_LIMITED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  TIER_LIMIT_EXCEEDED = "TIER_LIMIT_EXCEEDED",
  UPGRADE_REQUIRED = "UPGRADE_REQUIRED",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
}

// Subscription and monetization types
export interface SubscriptionLimits {
  productsTracked: number;
  priceChecksPerDay: number;
  notificationsPerDay: number;
  apiRequestsPerHour: number;
  dataRetentionDays: number;
}

export interface TierFeatures {
  tier: SubscriptionTier;
  name: string;
  description: string;
  price: number; // in cents
  limits: SubscriptionLimits;
  features: string[];
  isPopular?: boolean;
}

export interface UsageStats {
  userId: string;
  tier: SubscriptionTier;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  productsTracked: number;
  priceChecksToday: number;
  notificationsToday: number;
  apiRequestsThisHour: number;
}

export interface AffiliatePartner {
  id: string;
  name: string;
  domain: string;
  commissionRate: number; // percentage
  isActive: boolean;
  createdAt: Date;
}

export interface AffiliateLink {
  id: string;
  partnerId: string;
  originalUrl: string;
  affiliateUrl: string;
  userId: string;
  productId?: string;
  createdAt: Date;
  clickCount: number;
  conversionCount: number;
  revenue: number; // in cents
}

export interface RevenueReport {
  period: string;
  totalRevenue: number;
  subscriptionRevenue: number;
  affiliateRevenue: number;
  activeSubscribers: number;
  newSubscribers: number;
  churnedSubscribers: number;
  affiliateClicks: number;
  affiliateConversions: number;
}