# Design Document

## Overview

The refactored Picksy system transforms from a monolithic, over-engineered solution into a clean, modular, and legally compliant price tracking platform. The new architecture prioritizes user privacy, legal compliance, performance, and maintainability while delivering the core value proposition: reliable price tracking and notifications.

## Architecture

### High-Level Architecture

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

### Component Breakdown

1. **Browser Extension (User Agent)**
   - Lightweight popup interface
   - Content script for product detection
   - Background service worker for notifications
   - Local storage for user preferences

2. **API Gateway (Backend Service)**
   - RESTful API with proper authentication
   - Rate limiting and request validation
   - Proxy for external retailer APIs
   - Business logic for price analysis

3. **Data Layer**
   - PostgreSQL for structured data (users, products, prices)
   - Redis for caching and session management
   - File storage for product images and metadata

4. **External Services**
   - Official retailer APIs (Amazon Product Advertising API, etc.)
   - Email/Push notification services
   - Legal web scraping service (as fallback)

## Components and Interfaces

### 1. User Agent (Browser Extension)

**Core Responsibilities:**
- Product detection and extraction
- User interface for price tracking
- Local notification display
- Secure communication with API Gateway

**Key Interfaces:**
```typescript
interface ProductDetector {
  detectProduct(url: string): Promise<ProductInfo | null>
  getSupportedSites(): string[]
}

interface PriceTracker {
  addProduct(product: ProductInfo): Promise<TrackingResult>
  removeProduct(productId: string): Promise<void>
  getTrackedProducts(): Promise<TrackedProduct[]>
}

interface NotificationManager {
  showPriceAlert(alert: PriceAlert): void
  requestPermissions(): Promise<boolean>
}
```

### 2. API Gateway

**Core Responsibilities:**
- Authentication and authorization
- Rate limiting and abuse prevention
- Data validation and sanitization
- Coordination with external services

**Key Interfaces:**
```typescript
interface AuthService {
  authenticate(token: string): Promise<User | null>
  generateToken(userId: string): Promise<string>
  revokeToken(token: string): Promise<void>
}

interface PriceService {
  trackProduct(userId: string, product: ProductInfo): Promise<TrackingResult>
  checkPrices(productIds: string[]): Promise<PriceUpdate[]>
  getPriceHistory(productId: string): Promise<PriceHistory>
}

interface RetailerService {
  getProductInfo(url: string, retailer: string): Promise<ProductInfo>
  checkAvailability(productId: string): Promise<AvailabilityStatus>
}
```

### 3. Legal Scraper

**Core Responsibilities:**
- Respectful web scraping as API fallback
- Rate limiting and robots.txt compliance
- Error handling and retry logic
- Data normalization across retailers

**Key Interfaces:**
```typescript
interface LegalScraper {
  canScrape(url: string): Promise<boolean>
  scrapeProduct(url: string): Promise<ProductInfo | null>
  getRateLimit(domain: string): number
}
```

## Data Models

### User Model
```typescript
interface User {
  id: string
  email: string
  createdAt: Date
  preferences: UserPreferences
  subscription: SubscriptionTier
}

interface UserPreferences {
  notificationChannels: NotificationChannel[]
  checkFrequency: number // minutes
  priceThreshold: number // percentage
}
```

### Product Model
```typescript
interface ProductInfo {
  id: string
  title: string
  url: string
  retailer: string
  category: string
  brand?: string
  model?: string
  imageUrl?: string
  extractedAt: Date
}

interface TrackedProduct extends ProductInfo {
  userId: string
  targetPrice?: number
  isActive: boolean
  addedAt: Date
}
```

### Price Model
```typescript
interface PricePoint {
  id: string
  productId: string
  price: number
  currency: string
  availability: AvailabilityStatus
  checkedAt: Date
  source: DataSource
}

interface PriceHistory {
  productId: string
  points: PricePoint[]
  statistics: PriceStatistics
}
```

## Error Handling

### Error Categories
1. **User Errors**: Invalid input, unsupported sites
2. **System Errors**: Database failures, API timeouts
3. **External Errors**: Retailer API failures, network issues
4. **Legal Errors**: Rate limiting, access denied

### Error Response Strategy
```typescript
interface ErrorResponse {
  code: string
  message: string
  details?: any
  retryAfter?: number
  supportContact?: string
}

// Example error codes
enum ErrorCode {
  UNSUPPORTED_SITE = "UNSUPPORTED_SITE",
  RATE_LIMITED = "RATE_LIMITED", 
  PRODUCT_NOT_FOUND = "PRODUCT_NOT_FOUND",
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
}
```

### Graceful Degradation
- When official APIs fail, fallback to legal scraping
- When scraping fails, show cached data with staleness indicator
- When notifications fail, store alerts for later delivery
- When backend is unavailable, show offline mode with limited functionality

## Testing Strategy

### Unit Testing
- **Coverage Target**: 90% for core business logic
- **Framework**: Jest for JavaScript/TypeScript components
- **Focus Areas**: Price calculation, product matching, data validation

### Integration Testing
- **API Testing**: Test all API endpoints with various scenarios
- **Database Testing**: Test data persistence and retrieval
- **External Service Testing**: Mock retailer APIs and test error handling

### End-to-End Testing
- **User Flows**: Complete price tracking workflow from product detection to notification
- **Cross-Browser Testing**: Chrome, Firefox, Edge compatibility
- **Performance Testing**: Load testing for concurrent users

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several redundant properties that can be consolidated:
- Properties related to data security (encryption, secure transmission) can be combined into comprehensive data protection properties
- Properties about API behavior (authentication, rate limiting) can be unified into API gateway properties  
- Properties about user interface consistency can be consolidated into UX properties
- Properties about error handling can be combined into system reliability properties

### Core Properties

**Property 1: API-First Data Collection**
*For any* product data request, the system should attempt official retailer APIs before falling back to scraping, and should never scrape when APIs are available
**Validates: Requirements 1.1**

**Property 2: Rate Limit Compliance**
*For any* scraping operation, the system should respect robots.txt and never exceed the configured rate limits for any domain
**Validates: Requirements 1.2**

**Property 3: Data Minimization and Deletion**
*For any* user data storage operation, only essential fields should be stored, and deletion requests should completely remove all user data within 30 days
**Validates: Requirements 1.4**

**Property 4: External Site Attribution**
*For any* external site access, proper attribution headers and Terms of Service compliance should be maintained
**Validates: Requirements 1.5**

**Property 5: API Gateway Security**
*For any* user request, the API gateway should enforce authentication, apply rate limiting, and coordinate external API access
**Validates: Requirements 2.3**

**Property 6: JWT Authentication Integrity**
*For any* API request requiring authentication, valid JWT tokens should be required and secure key management should be enforced
**Validates: Requirements 3.1**

**Property 7: Data Protection**
*For any* sensitive user data, encryption should be applied during storage and secure protocols should be used for transmission
**Validates: Requirements 3.3**

**Property 8: Financial Data Prohibition**
*For any* system operation, sensitive financial information should never be stored or transmitted
**Validates: Requirements 3.4**

**Property 9: Complete Data Deletion**
*For any* user deletion request, all associated data should be completely removed from all systems within 30 days
**Validates: Requirements 3.5**

**Property 10: Price Monitoring Compliance**
*For any* price checking operation, user-configured intervals should be respected and site rate limits should never be exceeded
**Validates: Requirements 4.1**

**Property 11: Timely Notifications**
*For any* detected price change, notifications should be delivered within 5 minutes through all configured channels
**Validates: Requirements 4.2**

**Property 12: Graceful Scraping Failures**
*For any* scraping failure due to site changes, the system should handle errors gracefully and notify affected users
**Validates: Requirements 4.3**

**Property 13: Real Data Only**
*For any* price history display, only actual historical data should be shown without any mock or generated data
**Validates: Requirements 4.4**

**Property 14: Accurate Price Statistics**
*For any* price trend calculation, statistical analysis should be mathematically correct based on actual data points
**Validates: Requirements 4.5**

**Property 15: Essential Information Only**
*For any* product addition, only essential information should be required and clear feedback should be provided
**Validates: Requirements 5.2**

**Property 16: Simple Product Display**
*For any* product information display, price, availability, and basic trust indicators should be shown without overwhelming details
**Validates: Requirements 5.3**

**Property 17: Simple Price Comparison**
*For any* price comparison request, simple side-by-side comparisons should be provided without complex AI analysis
**Validates: Requirements 5.4**

**Property 18: Fast Initialization**
*For any* extension load, initialization should complete within 2 seconds and be ready for user interaction
**Validates: Requirements 6.1**

**Property 19: Non-blocking Operations**
*For any* multi-product tracking operation, processing should not block the user interface
**Validates: Requirements 6.2**

**Property 20: Graceful Service Degradation**
*For any* external service failure, functionality should degrade gracefully and users should be informed
**Validates: Requirements 6.3**

**Property 21: Automatic Reconnection**
*For any* service worker inactivity, the system should automatically reconnect and resume functionality
**Validates: Requirements 6.4**

**Property 22: Clear Error Communication**
*For any* system error, clear error messages and recovery options should be provided to users
**Validates: Requirements 6.5**

**Property 23: Usage Tier Enforcement**
*For any* API usage, proper tier limits and rate limiting should be enforced to manage costs
**Validates: Requirements 7.2**

**Property 24: Core Functionality Preservation**
*For any* free tier user exceeding limits, core functionality should remain available while premium features are restricted
**Validates: Requirements 7.4**

**Property 25: Affiliate Disclosure**
*For any* affiliate link, clear disclosure of affiliate relationships should be provided to users
**Validates: Requirements 7.5**

**Property 26: System Health Monitoring**
*For any* production deployment, health checks should function correctly and error reporting should capture issues proactively
**Validates: Requirements 8.5**

### Property-Based Testing
- **Price Calculation Properties**: Ensure mathematical correctness across all price data sets
- **Data Validation Properties**: Test input sanitization with generated invalid inputs
- **API Contract Properties**: Verify API response consistency across all endpoints
- **Security Properties**: Test authentication and authorization with various token states
- **Performance Properties**: Verify timing requirements under various load conditions
