import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { ErrorCode, ApiError } from '../types/index.js';

export interface ErrorContext {
  requestId: string;
  userId?: string;
  endpoint: string;
  method: string;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface RecoveryOption {
  action: string;
  description: string;
  url?: string;
  retryAfter?: number;
}

export class EnhancedError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public context: Partial<ErrorContext>;
  public readonly recoveryOptions: RecoveryOption[];
  public readonly retryAfter?: number;
  public readonly supportContact?: string;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    context: Partial<ErrorContext> = {},
    recoveryOptions: RecoveryOption[] = [],
    retryAfter?: number,
    supportContact?: string
  ) {
    super(message);
    this.name = 'EnhancedError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.recoveryOptions = recoveryOptions;
    this.retryAfter = retryAfter;
    this.supportContact = supportContact;
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: {
        context: this.context,
        recoveryOptions: this.recoveryOptions
      },
      retryAfter: this.retryAfter,
      supportContact: this.supportContact
    };
  }
}

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private errorCounts: Map<string, number> = new Map();
  private lastErrorTime: Map<string, number> = new Map();

  static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Create a standardized error with recovery options
   */
  createError(
    code: ErrorCode,
    message: string,
    statusCode: number,
    context: Partial<ErrorContext>,
    recoveryOptions: RecoveryOption[] = []
  ): EnhancedError {
    // Add default recovery options based on error type
    const defaultRecoveryOptions = this.getDefaultRecoveryOptions(code);
    const allRecoveryOptions = [...recoveryOptions, ...defaultRecoveryOptions];

    return new EnhancedError(
      code,
      message,
      statusCode,
      context,
      allRecoveryOptions,
      this.getRetryAfter(code),
      'support@picksy.com'
    );
  }

  /**
   * Handle authentication errors with clear recovery paths
   */
  createAuthError(context: Partial<ErrorContext>): EnhancedError {
    return this.createError(
      ErrorCode.AUTHENTICATION_FAILED,
      'Authentication failed. Please log in again.',
      401,
      context,
      [
        {
          action: 'login',
          description: 'Log in with your credentials',
          url: '/api/auth/login'
        },
        {
          action: 'register',
          description: 'Create a new account',
          url: '/api/auth/register'
        },
        {
          action: 'reset_password',
          description: 'Reset your password',
          url: '/api/auth/reset-password'
        }
      ]
    );
  }

  /**
   * Handle rate limiting errors with clear timing
   */
  createRateLimitError(context: Partial<ErrorContext>, retryAfter: number): EnhancedError {
    return this.createError(
      ErrorCode.RATE_LIMITED,
      `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
      429,
      context,
      [
        {
          action: 'wait',
          description: `Wait ${retryAfter} seconds before retrying`,
          retryAfter
        },
        {
          action: 'upgrade',
          description: 'Upgrade to premium for higher limits',
          url: '/api/subscription/upgrade'
        }
      ]
    );
  }

  /**
   * Handle external service errors with fallback options
   */
  createExternalServiceError(
    serviceName: string,
    context: Partial<ErrorContext>
  ): EnhancedError {
    return this.createError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      `${serviceName} is temporarily unavailable. Using cached data where possible.`,
      503,
      context,
      [
        {
          action: 'retry',
          description: 'Try again in a few minutes',
          retryAfter: 300
        },
        {
          action: 'use_cached',
          description: 'Continue with cached data',
        },
        {
          action: 'check_status',
          description: 'Check service status',
          url: '/health'
        }
      ]
    );
  }

  /**
   * Handle validation errors with specific field guidance
   */
  createValidationError(
    validationErrors: any[],
    context: Partial<ErrorContext>
  ): EnhancedError {
    const fieldErrors = validationErrors.map(err => `${err.path}: ${err.message}`).join(', ');
    
    return this.createError(
      ErrorCode.INVALID_INPUT,
      `Validation failed: ${fieldErrors}`,
      400,
      context,
      [
        {
          action: 'fix_input',
          description: 'Correct the highlighted fields and try again'
        },
        {
          action: 'get_help',
          description: 'View API documentation',
          url: '/docs'
        }
      ]
    );
  }

  /**
   * Track error frequency for monitoring
   */
  trackError(error: EnhancedError): void {
    const errorKey = `${error.code}:${error.context.endpoint}`;
    const currentCount = this.errorCounts.get(errorKey) || 0;
    const now = Date.now();
    
    this.errorCounts.set(errorKey, currentCount + 1);
    this.lastErrorTime.set(errorKey, now);

    // Log high-frequency errors for monitoring
    if (currentCount > 10) {
      logger.warn('High error frequency detected', {
        errorCode: error.code,
        endpoint: error.context.endpoint,
        count: currentCount + 1,
        timeWindow: '1 hour'
      });
    }
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): { [key: string]: number } {
    const stats: { [key: string]: number } = {};
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    for (const [errorKey, lastTime] of this.lastErrorTime.entries()) {
      if (lastTime > oneHourAgo) {
        stats[errorKey] = this.errorCounts.get(errorKey) || 0;
      }
    }

    return stats;
  }

  private getDefaultRecoveryOptions(code: ErrorCode): RecoveryOption[] {
    switch (code) {
      case ErrorCode.INTERNAL_ERROR:
        return [
          {
            action: 'retry',
            description: 'Try again in a few moments',
            retryAfter: 30
          },
          {
            action: 'contact_support',
            description: 'Contact support if the problem persists'
          }
        ];
      
      case ErrorCode.USER_NOT_FOUND:
        return [
          {
            action: 'register',
            description: 'Create a new account',
            url: '/api/auth/register'
          }
        ];
      
      default:
        return [
          {
            action: 'retry',
            description: 'Try again',
            retryAfter: 5
          }
        ];
    }
  }

  private getRetryAfter(code: ErrorCode): number | undefined {
    switch (code) {
      case ErrorCode.RATE_LIMITED:
        return 60;
      case ErrorCode.EXTERNAL_SERVICE_ERROR:
        return 300;
      case ErrorCode.INTERNAL_ERROR:
        return 30;
      default:
        return undefined;
    }
  }
}

/**
 * Express middleware for enhanced error handling
 */
export function enhancedErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const errorService = ErrorHandlingService.getInstance();
  const requestId = (req as any).requestId || 'unknown';
  
  const context: ErrorContext = {
    requestId,
    userId: (req as any).user?.userId,
    endpoint: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date()
  };

  let enhancedError: EnhancedError;

  if (error instanceof EnhancedError) {
    enhancedError = error;
    enhancedError.context = { ...enhancedError.context, ...context };
  } else {
    // Convert regular errors to enhanced errors
    enhancedError = errorService.createError(
      ErrorCode.INTERNAL_ERROR,
      error.message || 'An unexpected error occurred',
      500,
      context
    );
  }

  // Track error for monitoring
  errorService.trackError(enhancedError);

  // Log error with full context
  logger.error('Request error', {
    ...context,
    error: {
      code: enhancedError.code,
      message: enhancedError.message,
      stack: enhancedError.stack
    }
  });

  // Send structured error response
  const apiError = enhancedError.toApiError();
  
  // Add retry-after header if specified
  if (enhancedError.retryAfter) {
    res.set('Retry-After', enhancedError.retryAfter.toString());
  }

  res.status(enhancedError.statusCode).json(apiError);
}

/**
 * Middleware to add request context for error handling
 */
export function addErrorContext(req: Request, res: Response, next: NextFunction): void {
  // Generate unique request ID
  (req as any).requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID to response headers for debugging
  res.set('X-Request-ID', (req as any).requestId);
  
  next();
}

/**
 * Async error wrapper for route handlers
 */
export function asyncErrorHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}