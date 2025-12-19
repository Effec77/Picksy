# Picksy Developer Guide

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Development Setup](#development-setup)
- [API Documentation](#api-documentation)
- [Security Implementation](#security-implementation)
- [Legal Compliance Framework](#legal-compliance-framework)
- [Testing Guidelines](#testing-guidelines)
- [Deployment Procedures](#deployment-procedures)
- [Monitoring and Observability](#monitoring-and-observability)
- [Contributing Guidelines](#contributing-guidelines)

## Architecture Overview

### System Architecture

Picksy follows a clean, modular architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser       │    │   API Gateway   │    │   External      │
│   Extension     │◄──►│   (Node.js)     │◄──►│   Services      │
│                 │    │                 │    │                 │
│ • User Agent    │    │ • Auth Service  │    │ • Retailer APIs │
│ • Price Display │    │ • Rate Limiter  │    │ • Notification  │
│ • Notifications │    │ • Data Proxy    │    │ • Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   Data Layer    │
                       │                 │
                       │ • PostgreSQL    │
                       │ • Redis Cache   │
                       │ • File Storage  │
                       └─────────────────┘
```

### Core Components

#### 1. Browser Extension (Frontend)
- **Technology:** TypeScript, Webpack, Chrome Extension APIs
- **Responsibilities:** User interface, product detection, local notifications
- **Key Files:**
  - `src/extension/manifest.json` - Extension configuration
  - `src/extension/popup/` - Main user interface
  - `src/extension/content/` - Content scripts for product detection
  - `src/extension/background/` - Service worker for background tasks

#### 2. API Gateway (Backend)
- **Technology:** Node.js, Express.js, TypeScript
- **Responsibilities:** Authentication, rate limiting, external API coordination
- **Key Files:**
  - `src/api-gateway/src/server.ts` - Main server entry point
  - `src/api-gateway/src/routes/` - API route definitions
  - `src/api-gateway/src/middleware/` - Security and validation middleware
  - `src/api-gateway/src/services/` - Business logic services

#### 3. Data Layer
- **PostgreSQL:** Structured data (users, products, prices)
- **Redis:** Caching, session management, rate limiting
- **File Storage:** Product images, user uploads

### Data Flow

1. **Product Detection:** Content script detects product on retailer page
2. **User Action:** User clicks "Track Product" in extension popup
3. **API Request:** Extension sends tracking request to API Gateway
4. **Authentication:** JWT token validated, user authorized
5. **Data Processing:** Product information extracted and validated
6. **Storage:** Product and initial price data stored in PostgreSQL
7. **Monitoring:** Background job scheduled for price checking
8. **Notifications:** Price changes trigger multi-channel notifications

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 6+
- Git
- Chrome/Firefox for extension testing

### Environment Setup

1. **Clone Repository**
```bash
git clone https://github.com/picksy/picksy-refactor.git
cd picksy-refactor
```

2. **Install Dependencies**
```bash
# Root dependencies
npm install

# API Gateway dependencies
cd src/api-gateway
npm install

# Extension dependencies
cd ../extension
npm install
```

3. **Database Setup**
```bash
# Start PostgreSQL and Redis
sudo systemctl start postgresql redis

# Create database
createdb picksy_dev

# Run migrations
cd src/api-gateway
npm run migrate
```

4. **Environment Configuration**
```bash
# Copy environment templates
cp src/api-gateway/.env.example src/api-gateway/.env
cp src/extension/.env.example src/extension/.env

# Edit configuration files with your settings
```

### Development Commands

```bash
# Start API Gateway in development mode
cd src/api-gateway
npm run dev

# Build extension for development
cd src/extension
npm run build:dev

# Run tests
npm run test

# Run linting
npm run lint

# Type checking
npm run type-check
```

## API Documentation

### Authentication

All API requests require JWT authentication via the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

### Core Endpoints

#### Authentication Endpoints

**POST /api/auth/register**
```typescript
interface RegisterRequest {
  email: string;
  password: string;
  preferences?: UserPreferences;
}

interface RegisterResponse {
  user: User;
  token: string;
  expiresIn: number;
}
```

**POST /api/auth/login**
```typescript
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  user: User;
  token: string;
  expiresIn: number;
}
```

#### Product Tracking Endpoints

**POST /api/products/track**
```typescript
interface TrackProductRequest {
  url: string;
  targetPrice?: number;
  notifications?: NotificationPreferences;
}

interface TrackProductResponse {
  product: TrackedProduct;
  tracking: TrackingStatus;
}
```

**GET /api/products/tracked**
```typescript
interface TrackedProductsResponse {
  products: TrackedProduct[];
  pagination: PaginationInfo;
}
```

**DELETE /api/products/{id}/untrack**
```typescript
interface UntrackResponse {
  success: boolean;
  message: string;
}
```

#### Price History Endpoints

**GET /api/products/{id}/history**
```typescript
interface PriceHistoryResponse {
  productId: string;
  history: PricePoint[];
  statistics: PriceStatistics;
}
```

### Error Handling

All API errors follow a consistent format:

```typescript
interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId: string;
}
```

Common error codes:
- `AUTHENTICATION_FAILED` - Invalid or expired token
- `VALIDATION_ERROR` - Request validation failed
- `RATE_LIMITED` - Too many requests
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `EXTERNAL_SERVICE_ERROR` - External API failure

## Security Implementation

### Authentication & Authorization

#### JWT Implementation
```typescript
// JWT configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET, // 256-bit minimum
  expiresIn: '24h',
  issuer: 'picksy-api',
  audience: 'picksy-extension'
};

// Token validation middleware
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ code: 'MISSING_TOKEN', message: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, jwtConfig.secret) as JWTPayload;
    req.user = await getUserById(decoded.userId);
    next();
  } catch (error) {
    return res.status(403).json({ code: 'INVALID_TOKEN', message: 'Invalid access token' });
  }
};
```

#### Role-Based Access Control
```typescript
enum UserRole {
  USER = 'user',
  PREMIUM = 'premium',
  ADMIN = 'admin'
}

export const requireRole = (role: UserRole) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !hasRole(req.user, role)) {
      return res.status(403).json({ code: 'INSUFFICIENT_PERMISSIONS', message: 'Access denied' });
    }
    next();
  };
};
```

### Input Validation & Sanitization

#### Request Validation
```typescript
import { z } from 'zod';

// Product tracking validation schema
const trackProductSchema = z.object({
  url: z.string().url().max(2048),
  targetPrice: z.number().positive().optional(),
  notifications: z.object({
    email: z.boolean().default(true),
    browser: z.boolean().default(true),
    threshold: z.number().min(0).max(100).default(5)
  }).optional()
});

// Validation middleware
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.errors
        });
      }
      next(error);
    }
  };
};
```

### Rate Limiting

#### Implementation
```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl_api',
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60, // Block for 60 seconds if limit exceeded
});

export const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = req.user?.id || req.ip;
    await rateLimiter.consume(key);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      retryAfter: secs
    });
  }
};
```

## Legal Compliance Framework

### Robots.txt Compliance

```typescript
import { RobotsParser } from '../shared/compliance/robots-parser.js';

class LegalScraper {
  private robotsParser = new RobotsParser();
  
  async canScrapeUrl(url: string): Promise<boolean> {
    const result = await this.robotsParser.canFetch(url, 'Picksy-Bot/1.0');
    return result.canFetch;
  }
  
  async scrapeWithCompliance(url: string): Promise<ProductInfo | null> {
    // Check robots.txt compliance
    if (!await this.canScrapeUrl(url)) {
      throw new ComplianceError('Robots.txt violation');
    }
    
    // Apply rate limiting
    await this.rateLimiter.checkRateLimit(url);
    
    // Perform scraping with proper attribution
    const headers = this.generateAttributionHeaders(url);
    return this.performScraping(url, headers);
  }
}
```

### Data Protection Compliance

#### GDPR Implementation
```typescript
class PrivacyManager {
  // Right to access (Article 15)
  async exportUserData(userId: string): Promise<UserDataExport> {
    const user = await this.getUserData(userId);
    const products = await this.getUserProducts(userId);
    const priceHistory = await this.getUserPriceHistory(userId);
    
    return {
      user: this.sanitizeUserData(user),
      products: products.map(p => this.sanitizeProductData(p)),
      priceHistory: priceHistory.map(h => this.sanitizePriceData(h)),
      exportedAt: new Date(),
      format: 'JSON'
    };
  }
  
  // Right to erasure (Article 17)
  async deleteUserData(userId: string): Promise<DeletionResult> {
    const deletionId = generateDeletionId();
    
    // Mark for deletion (soft delete initially)
    await this.markForDeletion(userId, deletionId);
    
    // Schedule hard deletion after grace period
    await this.scheduleHardDeletion(userId, deletionId, 30); // 30 days
    
    return {
      deletionId,
      scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      gracePeriod: 30,
      canRecover: true
    };
  }
}
```

## Testing Guidelines

### Unit Testing

#### Test Structure
```typescript
// Example unit test
describe('PriceTracker', () => {
  let priceTracker: PriceTracker;
  let mockDatabase: jest.Mocked<Database>;
  
  beforeEach(() => {
    mockDatabase = createMockDatabase();
    priceTracker = new PriceTracker(mockDatabase);
  });
  
  describe('trackProduct', () => {
    it('should successfully track a valid product', async () => {
      // Arrange
      const productInfo = createMockProductInfo();
      mockDatabase.products.create.mockResolvedValue(productInfo);
      
      // Act
      const result = await priceTracker.trackProduct('user123', productInfo);
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockDatabase.products.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          url: productInfo.url
        })
      );
    });
  });
});
```

### Integration Testing

#### API Integration Tests
```typescript
describe('Product API Integration', () => {
  let app: Express;
  let testDb: TestDatabase;
  
  beforeAll(async () => {
    testDb = await createTestDatabase();
    app = createTestApp(testDb);
  });
  
  afterAll(async () => {
    await testDb.cleanup();
  });
  
  it('should track product with valid authentication', async () => {
    const user = await testDb.createUser();
    const token = generateTestToken(user.id);
    
    const response = await request(app)
      .post('/api/products/track')
      .set('Authorization', `Bearer ${token}`)
      .send({
        url: 'https://example.com/product/123',
        targetPrice: 99.99
      });
    
    expect(response.status).toBe(201);
    expect(response.body.product.url).toBe('https://example.com/product/123');
  });
});
```

### Property-Based Testing

#### Example Property Tests
```typescript
import fc from 'fast-check';

describe('Price Calculation Properties', () => {
  it('should maintain price history ordering', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        price: fc.float({ min: 0.01, max: 9999.99 }),
        timestamp: fc.date()
      })),
      (pricePoints) => {
        const sorted = sortPriceHistory(pricePoints);
        
        // Property: sorted array should be in chronological order
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i].timestamp.getTime()).toBeGreaterThanOrEqual(
            sorted[i - 1].timestamp.getTime()
          );
        }
      }
    ));
  });
});
```

## Deployment Procedures

### Environment Configuration

#### Production Environment
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  api-gateway:
    image: picksy/api-gateway:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
      
  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=picksy
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      
  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data
```

#### CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run lint
      - run: npm run type-check
      
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm audit --audit-level high
      - run: npx snyk test
      
  deploy:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: docker build -t picksy/api-gateway .
      - run: docker push picksy/api-gateway:latest
      - run: kubectl apply -f k8s/
```

### Database Migrations

#### Migration System
```typescript
// Migration example
export const up = async (knex: Knex): Promise<void> => {
  await knex.schema.createTable('price_alerts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users');
    table.uuid('product_id').notNullable().references('id').inTable('products');
    table.decimal('target_price', 10, 2).notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    
    table.index(['user_id', 'product_id']);
    table.index(['is_active']);
  });
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.schema.dropTable('price_alerts');
};
```

## Monitoring and Observability

### Logging

#### Structured Logging
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'picksy-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Usage example
logger.info('Product tracking started', {
  userId: user.id,
  productUrl: product.url,
  targetPrice: product.targetPrice,
  requestId: req.id
});
```

### Metrics Collection

#### Prometheus Metrics
```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Define metrics
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route']
});

const activeTrackedProducts = new Gauge({
  name: 'active_tracked_products_total',
  help: 'Total number of actively tracked products'
});

// Middleware to collect metrics
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    
    httpRequestsTotal
      .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
      .inc();
      
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path)
      .observe(duration);
  });
  
  next();
};
```

### Health Checks

#### Health Check Endpoints
```typescript
// Health check implementation
export const healthCheck = async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      externalAPIs: await checkExternalAPIs()
    }
  };
  
  const isHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
  
  res.status(isHealthy ? 200 : 503).json(health);
};

const checkDatabase = async (): Promise<HealthCheckResult> => {
  try {
    await db.raw('SELECT 1');
    return { status: 'healthy', responseTime: Date.now() };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
};
```

## Contributing Guidelines

### Code Standards

#### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

#### ESLint Configuration
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### Pull Request Process

1. **Branch Naming:** `feature/description` or `fix/description`
2. **Commit Messages:** Follow conventional commits format
3. **Testing:** All tests must pass, coverage > 80%
4. **Code Review:** Minimum 2 approvals required
5. **Documentation:** Update relevant documentation

### Security Guidelines

- Never commit secrets or API keys
- Use environment variables for configuration
- Validate all user inputs
- Follow OWASP security guidelines
- Regular dependency updates

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Next Review:** March 2025  
**Maintainer:** Development Team