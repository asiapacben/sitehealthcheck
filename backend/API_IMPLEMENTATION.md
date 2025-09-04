# SEO & GEO Health Checker API Backend Implementation

## Overview

This document describes the implementation of the Express.js API backend for the SEO & GEO Health Checker application. The API provides comprehensive endpoints for website analysis, validation, and report generation with robust security, rate limiting, and error handling.

## Architecture

### Technology Stack
- **Framework**: Express.js with TypeScript
- **Documentation**: Swagger/OpenAPI 3.0
- **Security**: Helmet, CORS, custom security middleware
- **Validation**: Joi and express-validator
- **Rate Limiting**: express-rate-limit with custom configurations
- **Testing**: Jest with Supertest for integration testing

### Key Components

#### 1. API Routes
- **Validation Routes** (`/api/validation/*`): URL validation and domain consistency checking
- **Analysis Routes** (`/api/analysis/*`): Website analysis job management
- **Export Routes** (`/api/export/*`): Report generation and download

#### 2. Security Middleware
- **Rate Limiting**: Different limits for different endpoint types
- **Security Headers**: CSP, XSS protection, frame options
- **Request Validation**: Size limits, input sanitization
- **IP Filtering**: Blacklist/whitelist support
- **API Key Validation**: Optional authentication layer

#### 3. Documentation
- **Swagger UI**: Interactive API documentation at `/api-docs`
- **OpenAPI 3.0 Spec**: Complete API specification with schemas
- **Type Safety**: Full TypeScript integration

## API Endpoints

### Core Endpoints

#### Health Check
```
GET /health
```
Returns server health status and version information.

#### API Information
```
GET /api
```
Returns API metadata and available endpoints.

#### API Documentation
```
GET /api-docs
```
Interactive Swagger UI documentation.

### Validation Endpoints

#### Validate URLs
```
POST /api/validation/urls
```
Validates multiple URLs for format and domain consistency.

**Request Body:**
```json
{
  "urls": ["https://example.com", "https://example.com/about"]
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "normalizedUrls": ["https://example.com", "https://example.com/about"],
  "errors": []
}
```

#### Check Domain Consistency
```
POST /api/validation/domain-consistency
```
Verifies all URLs belong to the same domain.

#### Normalize URL
```
POST /api/validation/normalize-url
```
Converts URL to standard format.

#### Check URL Accessibility
```
POST /api/validation/check-accessibility
```
Tests if URL is accessible and returns response information.

### Analysis Endpoints

#### Start Analysis
```
POST /api/analysis/start
```
Initiates a new website analysis job.

**Request Body:**
```json
{
  "urls": ["https://example.com"],
  "config": {
    "seoWeights": {
      "technical": 0.4,
      "content": 0.4,
      "structure": 0.2
    },
    "geoWeights": {
      "readability": 0.3,
      "credibility": 0.3,
      "completeness": 0.2,
      "structuredData": 0.2
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "urls": ["https://example.com"],
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### Get Analysis Status
```
GET /api/analysis/status/:jobId
```
Returns current status and progress of analysis job.

#### Get Analysis Results
```
GET /api/analysis/results/:jobId
```
Returns complete analysis results for finished job.

#### Cancel Analysis
```
POST /api/analysis/cancel/:jobId
```
Cancels a running analysis job.

#### Get Statistics
```
GET /api/analysis/stats
```
Returns system statistics and performance metrics.

### Export Endpoints

#### Generate Report
```
POST /api/export
```
Generates report in specified format (PDF, CSV, JSON).

#### Generate Multi-Format Report
```
POST /api/export/multi
```
Generates reports in multiple formats simultaneously.

#### Export by IDs
```
POST /api/export/by-ids
```
Exports results using stored result IDs.

#### Download Report
```
GET /api/export/download/:filename
```
Downloads a generated report file.

#### List Reports
```
GET /api/export/list
```
Lists all available report files.

#### Cleanup Reports
```
DELETE /api/export/cleanup
```
Removes old report files.

## Security Features

### Rate Limiting
- **Global Limit**: 100 requests per 15 minutes per IP
- **Analysis Limit**: 5 requests per 15 minutes per IP
- **Validation Limit**: 50 requests per 5 minutes per IP
- **Export Limit**: 20 requests per 10 minutes per IP

### Security Headers
- Content Security Policy (CSP)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

### Input Validation
- Request size limits (10MB maximum)
- JSON schema validation
- SQL injection prevention
- XSS protection through sanitization

### CORS Configuration
- Configurable allowed origins
- Proper preflight handling
- Credential support for authenticated requests

## Error Handling

### Error Response Format
All errors follow a consistent format:
```json
{
  "success": false,
  "error": "Error category",
  "message": "Detailed error message",
  "details": [
    {
      "field": "fieldName",
      "message": "Field-specific error"
    }
  ]
}
```

### Error Categories
- **Validation Errors** (400): Invalid input data
- **Authentication Errors** (401): Missing or invalid API key
- **Authorization Errors** (403): Access denied
- **Not Found Errors** (404): Resource not found
- **Rate Limit Errors** (429): Too many requests
- **Server Errors** (500): Internal server errors

### Graceful Degradation
- Partial results when some checks fail
- Retry logic with exponential backoff
- Fallback mechanisms for external API failures
- Clear error messages with troubleshooting guidance

## Testing

### Test Structure
```
src/__tests__/
├── setup.ts                    # Test configuration
├── integration/
│   ├── basic-api.test.ts      # Core API functionality
│   ├── api.integration.test.ts # Full integration tests
│   ├── security.test.ts       # Security feature tests
│   ├── rate-limiting.test.ts  # Rate limiting tests
│   └── test-helpers.ts        # Test utilities
```

### Test Coverage
- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end API workflows
- **Security Tests**: Vulnerability and attack prevention
- **Performance Tests**: Load and stress testing
- **Error Handling Tests**: All error scenarios

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- --testPathPattern="basic-api.test.ts"

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## Configuration

### Environment Variables
```bash
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Rate Limiting
MAX_URLS_PER_REQUEST=10

# Security
BLACKLISTED_IPS=192.168.1.100,10.0.0.5
VALID_API_KEYS=key1,key2,key3

# External APIs
GOOGLE_PAGESPEED_API_KEY=your_api_key
SCHEMA_VALIDATOR_API_KEY=your_api_key
```

### Swagger Configuration
The API documentation is automatically generated from:
- Route definitions with JSDoc comments
- TypeScript interfaces and types
- OpenAPI 3.0 schema definitions

## Deployment

### Production Considerations
1. **Environment Variables**: Set all required environment variables
2. **API Keys**: Configure external service API keys
3. **Rate Limiting**: Adjust limits based on expected traffic
4. **Monitoring**: Set up logging and error tracking
5. **Security**: Enable all security features and IP filtering

### Docker Support
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### Health Checks
The `/health` endpoint provides:
- Server status
- Version information
- Timestamp for monitoring
- Can be extended with database connectivity checks

## Performance

### Optimization Features
- Request/response compression
- Efficient JSON parsing
- Connection pooling for external APIs
- Caching for frequently accessed data
- Asynchronous processing for long-running tasks

### Monitoring
- Request/response logging
- Performance metrics collection
- Error rate tracking
- Rate limit monitoring
- External API health checks

## Future Enhancements

### Planned Features
1. **Authentication**: JWT-based user authentication
2. **Database Integration**: Persistent storage for results
3. **WebSocket Support**: Real-time progress updates
4. **Caching Layer**: Redis for improved performance
5. **Metrics Dashboard**: Real-time API metrics
6. **API Versioning**: Support for multiple API versions

### Scalability
- Horizontal scaling support
- Load balancer compatibility
- Microservice architecture readiness
- Container orchestration support

## Conclusion

The Express.js API backend provides a robust, secure, and well-documented foundation for the SEO & GEO Health Checker application. With comprehensive testing, security features, and clear documentation, it's ready for production deployment and future enhancements.