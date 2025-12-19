import { z } from 'zod';
import {
  SubscriptionTier,
  NotificationChannel,
  AvailabilityStatus,
  DataSource,
  PriceTrend,
  AlertType,
  ErrorCode
} from '../types/index.js';

// User validation schemas
export const UserPreferencesSchema = z.object({
  notificationChannels: z.array(z.nativeEnum(NotificationChannel)),
  checkFrequency: z.number().min(5).max(1440), // 5 minutes to 24 hours
  priceThreshold: z.number().min(0).max(100) // 0% to 100%
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.date(),
  preferences: UserPreferencesSchema,
  subscription: z.nativeEnum(SubscriptionTier)
});

// Product validation schemas
export const ProductInfoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500),
  url: z.string().url(),
  retailer: z.string().min(1).max(100),
  category: z.string().min(1).max(100),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  imageUrl: z.string().url().optional(),
  extractedAt: z.date()
});

export const TrackedProductSchema = ProductInfoSchema.extend({
  userId: z.string().uuid(),
  targetPrice: z.number().positive().optional(),
  isActive: z.boolean(),
  addedAt: z.date()
});

// Price validation schemas
export const PricePointSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  price: z.number().positive(),
  currency: z.string().length(3), // ISO currency codes
  availability: z.nativeEnum(AvailabilityStatus),
  checkedAt: z.date(),
  source: z.nativeEnum(DataSource)
});

export const PriceStatisticsSchema = z.object({
  average: z.number().positive(),
  minimum: z.number().positive(),
  maximum: z.number().positive(),
  trend: z.nativeEnum(PriceTrend),
  volatility: z.number().min(0).max(1)
});

export const PriceHistorySchema = z.object({
  productId: z.string().uuid(),
  points: z.array(PricePointSchema),
  statistics: PriceStatisticsSchema
});

// Alert validation schemas
export const PriceAlertSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  productId: z.string().uuid(),
  alertType: z.nativeEnum(AlertType),
  threshold: z.number().positive().optional(),
  message: z.string().min(1).max(1000),
  createdAt: z.date(),
  delivered: z.boolean()
});

// API validation schemas
export const ErrorResponseSchema = z.object({
  code: z.nativeEnum(ErrorCode),
  message: z.string().min(1),
  details: z.any().optional(),
  retryAfter: z.number().positive().optional(),
  supportContact: z.string().email().optional()
});

export const ApiResponseSchema = <T>(dataSchema: z.ZodSchema<T>) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  error: ErrorResponseSchema.optional(),
  timestamp: z.date()
});

export const TrackingResultSchema = z.object({
  success: z.boolean(),
  productId: z.string().uuid().optional(),
  error: z.string().optional(),
  estimatedNextCheck: z.date().optional()
});

export const PriceUpdateSchema = z.object({
  productId: z.string().uuid(),
  oldPrice: z.number().positive().optional(),
  newPrice: z.number().positive(),
  priceChange: z.number(),
  percentageChange: z.number(),
  updatedAt: z.date()
});

// Input validation schemas for API endpoints
export const AddProductRequestSchema = z.object({
  url: z.string().url(),
  targetPrice: z.number().positive().optional()
});

export const UpdatePreferencesRequestSchema = z.object({
  notificationChannels: z.array(z.nativeEnum(NotificationChannel)).optional(),
  checkFrequency: z.number().min(5).max(1440).optional(),
  priceThreshold: z.number().min(0).max(100).optional()
});

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
    'Password must contain at least one lowercase letter, one uppercase letter, and one number')
});