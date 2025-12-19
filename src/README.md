# Picksy Refactor - Project Structure

This directory contains the refactored Picksy price tracking system with clean architecture and legal compliance.

## Architecture Overview

```
src/
├── shared/           # Shared utilities, types, and compliance framework
├── api-gateway/      # Secure backend API service
└── extension/        # Lightweight browser extension
```

## Components

### Shared (`src/shared/`)
Common utilities and types used across all components:
- **Types**: TypeScript interfaces for all data models
- **Validation**: Zod schemas for data validation
- **Utils**: Data transformation utilities
- **Compliance**: Legal compliance framework (robots.txt, rate limiting, ToS checking)

### API Gateway (`src/api-gateway/`)
Secure backend service that handles:
- Authentication and authorization (JWT)
- Rate limiting and request validation
- External API coordination
- Data persistence and caching
- Legal compliance enforcement

### Browser Extension (`src/extension/`)
Lightweight browser extension focused on:
- Product detection and extraction
- User interface for price tracking
- Local notifications
- Secure communication with API gateway

## Key Features

### Legal Compliance
- **Robots.txt Parser**: Respects robots.txt directives
- **Rate Limiter**: Configurable rate limiting per domain
- **ToS Checker**: Terms of Service compliance validation
- **Attribution Headers**: Proper identification in requests

### Security
- JWT-based authentication
- Request validation and sanitization
- Minimal browser permissions
- Secure data transmission

### Performance
- TypeScript with strict type checking
- Modular architecture for maintainability
- Efficient caching strategies
- Non-blocking operations

## Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup
```bash
# Install all dependencies
npm run install:all

# Build all components
npm run build

# Run tests
npm run test

# Lint and format
npm run lint:fix
npm run format
```

### Development Workflow
```bash
# Start API gateway in development mode
npm run dev:api

# Build extension for testing
npm run build:extension

# Watch mode for shared utilities
npm run build:shared -- --watch
```

## Configuration

Each component has its own `package.json` and `tsconfig.json` for independent development and deployment.

### TypeScript Configuration
- Strict type checking enabled
- ES2022 target with ESNext modules
- Comprehensive compiler options for safety

### ESLint Configuration
- TypeScript-aware linting
- Strict rules for code quality
- Consistent code style enforcement

### Prettier Configuration
- Consistent code formatting
- Single quotes, semicolons, 100 char width
- Automatic formatting on save

## Deployment

### API Gateway
```bash
npm run build:api
npm run start:api
```

### Browser Extension
```bash
npm run package:extension
# Generates extension package in src/extension/dist/
```

## Testing

Each component includes comprehensive testing:
- Unit tests for business logic
- Integration tests for API endpoints
- Property-based tests for correctness properties
- End-to-end tests for user flows

Run tests with:
```bash
npm run test              # All tests
npm run test:watch        # Watch mode
```

## Legal Compliance

This refactor prioritizes legal compliance:
- API-first data collection where possible
- Respectful web scraping as fallback
- Proper attribution and rate limiting
- Terms of Service compliance checking
- User data protection and privacy

## Next Steps

1. Implement core interfaces and services
2. Set up authentication and security
3. Build data collection system
4. Create price tracking engine
5. Develop notification system
6. Build browser extension UI
7. Comprehensive testing
8. Production deployment