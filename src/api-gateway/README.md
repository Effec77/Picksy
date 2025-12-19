# Picksy API Gateway

Secure API gateway for the Picksy price tracking service, implementing JWT authentication, rate limiting, and comprehensive security measures.

## Features

- **JWT Authentication**: Secure token-based authentication with configurable expiration
- **Rate Limiting**: Redis-backed rate limiting with different limits for auth and general endpoints
- **Security Middleware**: CORS, security headers, request sanitization, and monitoring
- **Role-Based Access Control**: Support for user and admin roles
- **Health Checks**: Comprehensive health monitoring for dependencies
- **Request Logging**: Structured logging with Winston
- **Input Validation**: Zod-based request validation and sanitization

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set Up Database**
   ```bash
   # Create PostgreSQL database and run schema
   psql -U postgres -d picksy -f src/database/schema.sql
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/validate` - Token validation
- `POST /api/auth/logout` - User logout
- `POST /api/auth/logout-all` - Revoke all user sessions
- `GET /api/auth/me` - Get current user profile

### Health Checks
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check with dependencies
- `GET /health/ready` - Readiness probe (Kubernetes)
- `GET /health/live` - Liveness probe (Kubernetes)

## Security Features

### Rate Limiting
- General API: 100 requests per 15 minutes per user/IP
- Auth endpoints: 5 requests per 15 minutes per IP
- Configurable per-user limits for different tiers

### Authentication
- JWT tokens with secure key management
- Session management with Redis
- Token revocation support
- Role-based access control

### Request Security
- CORS configuration for browser extensions
- Security headers with Helmet
- Request sanitization and validation
- Suspicious activity monitoring

## Configuration

Key environment variables:

```env
# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Database
DB_HOST=localhost
DB_NAME=picksy
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX_REQUESTS=5
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Development

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Format code
npm run format
```

## Architecture

The API gateway follows a layered architecture:

1. **Security Layer**: CORS, rate limiting, security headers
2. **Authentication Layer**: JWT validation and user context
3. **Validation Layer**: Request validation and sanitization
4. **Business Logic Layer**: Service classes and route handlers
5. **Data Layer**: Database and Redis connections

## Deployment

The service is designed to be deployed in containerized environments with:

- Health check endpoints for load balancers
- Graceful shutdown handling
- Structured logging for monitoring
- Environment-based configuration
- Database connection pooling

## Monitoring

The service provides comprehensive monitoring through:

- Structured JSON logging
- Health check endpoints
- Request/response logging
- Error tracking and alerting
- Security event monitoring