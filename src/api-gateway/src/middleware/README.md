# API Gateway Security Middleware

This document describes the comprehensive security middleware implementation for the Picksy API Gateway, addressing Requirements 2.3 and 7.2 from the specification.

## Overview

The security middleware stack provides multiple layers of protection including:
- Request authentication and authorization
- Rate limiting per user and endpoint
- Comprehensive request logging and monitoring
- CORS configuration for browser extensions
- Security threat detection and blocking
- Usage tier enforcement

## Middleware Components

### 1. Authentication Middleware (`auth.ts`)

#### `authenticateToken`
Basic JWT token authentication middleware.
```typescript
app.use('/api/protected', authenticateToken);
```

#### `authenticateWithContext` (Enhanced)
Enhanced authentication with additional request context and monitoring.
```typescript
app.use('/api/protected', authenticateWithContext);
```

#### `optionalAuth`
Allows endpoints to work with or without authentication.
```typescript
app.use('/api/public', optionalAuth);
```

#### `requireRole`
Enforces specific user roles for endpoints.
```typescript
app.use('/api/admin', requireRole(UserRole.ADMIN));
```

### 2. Rate Limiting Middleware (`rateLimiter.ts`)

#### `generalRateLimit`
Applied to all routes for basic protection.

#### `authRateLimit`
Stricter limits for authentication endpoints to prevent brute force attacks.

#### `createUserRateLimit`
Per-user rate limiting for authenticated endpoints.
```typescript
const userLimit = createUserRateLimit(100); // 100 requests per window
app.use('/api/user-specific', userLimit);
```

#### `createEndpointRateLimit` (New)
Endpoint-specific rate limiting with user tier support.
```typescript
const productLimits = createEndpointRateLimit('product-tracking', {
  anonymous: 5,
  [UserRole.USER]: 50,
  [UserRole.ADMIN]: 500
});
app.use('/api/products/track', productLimits);
```

#### `enforceUsageTier` (New)
Enforces usage tiers and provides upgrade guidance.
```typescript
app.use('/api/premium', enforceUsageTier(UserRole.USER));
```

### 3. Security Middleware (`security.ts`)

#### `corsMiddleware`
Configured for browser extension origins with wildcard support.

#### `securityHeaders`
Applies comprehensive security headers using Helmet.

#### `sanitizeRequest`
Removes potentially dangerous characters from requests.

#### `securityMonitoring` (Enhanced)
Advanced threat detection with pattern matching:
- Path traversal attempts
- XSS injection
- SQL injection
- Code execution attempts
- JavaScript/VBScript protocols
- Event handler injection

High-risk threats are automatically blocked.

#### `validateRequest` (New)
Enhanced request validation including:
- Content-Type validation
- Required header checks
- Suspicious header detection

### 4. Logging Middleware (`logging.ts`)

#### `requestLogger` (Enhanced)
Comprehensive request logging with:
- Unique request IDs for tracing
- Enhanced request/response details
- Performance monitoring (slow request detection)
- Security threat logging
- Structured JSON logging

#### `errorLogger`
Centralized error logging with context.

### 5. Middleware Orchestrator (`index.ts`)

#### `configureSecurityMiddleware`
Sets up the complete middleware stack in the correct order:
1. Security headers and CORS
2. Request validation and sanitization
3. Security monitoring
4. Body parsing
5. Request logging
6. Rate limiting

#### `configureErrorHandling`
Sets up comprehensive error handling:
- 404 handler with logging
- Global error handler with request context
- Development vs production error details

## Usage Examples

### Basic Route Protection
```typescript
import { enhancedAuth, createEndpointRateLimit } from './middleware/index.js';

app.get('/api/products',
  enhancedAuth,
  createEndpointRateLimit('products', { [UserRole.USER]: 100 }),
  productController.getProducts
);
```

### Tiered Access Control
```typescript
import { enforceUsageTier, createEndpointRateLimit } from './middleware/index.js';

app.post('/api/products/track',
  enhancedAuth,
  enforceUsageTier(UserRole.USER),
  createEndpointRateLimit('product-tracking', {
    anonymous: 5,
    [UserRole.USER]: 50,
    [UserRole.ADMIN]: 500
  }),
  productController.trackProduct
);
```

### Public Endpoint with Rate Limiting
```typescript
import { optionalAuth, createEndpointRateLimit } from './middleware/index.js';

app.get('/api/products/:id/price',
  optionalAuth,
  createEndpointRateLimit('price-check', {
    anonymous: 10,
    [UserRole.USER]: 100
  }),
  productController.getPrice
);
```

## Security Features

### Threat Detection
The security monitoring middleware detects and logs:
- **Path Traversal**: `../../../etc/passwd`
- **XSS Attempts**: `<script>alert('xss')</script>`
- **SQL Injection**: `UNION SELECT * FROM users`
- **Code Execution**: `exec('rm -rf /')`
- **Protocol Injection**: `javascript:alert(1)`

High-risk patterns (Path Traversal, SQL Injection, Code Execution) are automatically blocked.

### Rate Limiting Strategy
- **Anonymous Users**: Lower limits to prevent abuse
- **Registered Users**: Higher limits for normal usage
- **Admin Users**: Highest limits for administrative tasks
- **Endpoint-Specific**: Different limits per API endpoint
- **Upgrade Guidance**: Clear messaging about tier limits and upgrade options

### Request Monitoring
Every request is logged with:
- Unique request ID for tracing
- User context (if authenticated)
- Performance metrics
- Security threat detection results
- Response details

### Error Handling
- Structured error responses with error codes
- Request context preservation
- Development vs production error details
- Comprehensive logging for debugging

## Configuration

### Environment Variables
```bash
# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000          # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100          # General limit
AUTH_RATE_LIMIT_WINDOW_MS=900000     # Auth window
AUTH_RATE_LIMIT_MAX_REQUESTS=5       # Auth limit

# CORS
CORS_ORIGIN=chrome-extension://*,moz-extension://*

# Security
JWT_SECRET=your-secret-key
```

### CORS Origins
Supports wildcard patterns for browser extensions:
- `chrome-extension://*`
- `moz-extension://*`
- Specific extension IDs

## Testing

The middleware includes comprehensive tests covering:
- CORS configuration
- Security headers
- Threat detection and blocking
- Rate limiting enforcement
- Usage tier enforcement
- Request logging
- Error handling

Run tests with:
```bash
npm test -- --run middleware.test.ts
```

## Requirements Compliance

This implementation addresses:

**Requirement 2.3**: API Gateway Security
- ✅ Request authentication middleware
- ✅ Rate limiting per user and endpoint
- ✅ Request logging and monitoring
- ✅ CORS configuration for browser extension

**Requirement 7.2**: Usage Tier Enforcement
- ✅ Usage tier management with core functionality preservation
- ✅ Rate limiting per user tier
- ✅ Clear upgrade messaging
- ✅ Transparent pricing communication

## Performance Considerations

- Middleware is ordered for optimal performance
- Rate limiting uses Redis for distributed scenarios
- Request logging is non-blocking
- Security monitoring uses efficient regex patterns
- Error handling preserves request context

## Security Best Practices

1. **Defense in Depth**: Multiple security layers
2. **Fail Secure**: Block suspicious requests by default
3. **Comprehensive Logging**: Full audit trail
4. **Rate Limiting**: Prevent abuse and DoS
5. **Input Validation**: Sanitize all inputs
6. **Error Handling**: Don't leak sensitive information
7. **Monitoring**: Proactive threat detection