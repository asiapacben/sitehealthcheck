import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../../config/swagger';
import { 
  securityHeaders, 
  validateRequestSize, 
  ipFilter, 
  requestLogger
} from '../../middleware/security';

// Import routes
import validationRoutes from '../../routes/validation';
import analysisRoutes from '../../routes/analysis';
import exportRoutes from '../../routes/export';

/**
 * Create a test Express application with all middleware and routes
 */
export const createTestApp = () => {
  const app = express();

  // Security middleware (simplified for testing)
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(securityHeaders);
  
  // Skip IP filtering and request logging in tests unless specifically testing them
  if (process.env.TEST_SECURITY_MIDDLEWARE) {
    app.use(ipFilter);
    app.use(requestLogger);
  }

  app.use(cors({
    origin: true, // Allow all origins in tests
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
  }));

  // Skip rate limiting in tests unless specifically testing it
  if (!process.env.TEST_RATE_LIMITING) {
    app.use((req, res, next) => next());
  }

  app.use(validateRequestSize);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // API Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'SEO & GEO Health Checker API Documentation'
  }));

  // Routes
  app.use('/api/validation', validationRoutes);
  app.use('/api/analysis', analysisRoutes);
  app.use('/api/export', exportRoutes);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });

  // API info endpoint
  app.get('/api', (req, res) => {
    res.json({ 
      message: 'SEO & GEO Health Checker API',
      version: '1.0.0',
      documentation: '/api-docs',
      endpoints: {
        health: '/health',
        validation: '/api/validation',
        analysis: '/api/analysis',
        export: '/api/export'
      }
    });
  });

  // Error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: `Route ${req.originalUrl} not found`
    });
  });

  return app;
};

/**
 * Mock data generators for testing
 */
export const mockData = {
  validUrls: [
    'https://example.com',
    'https://example.com/about',
    'https://example.com/contact'
  ],
  
  invalidUrls: [
    'not-a-url',
    'ftp://example.com',
    'javascript:alert("xss")'
  ],
  
  mixedDomainUrls: [
    'https://example.com',
    'https://different.com'
  ],
  
  analysisResults: [
    {
      url: 'https://example.com',
      timestamp: new Date().toISOString(),
      overallScore: 85,
      seoScore: {
        overall: 80,
        technical: 85,
        content: 75,
        structure: 80,
        details: {
          pageSpeed: 90,
          mobileResponsive: true,
          titleTag: { score: 85, issues: [] },
          metaDescription: { score: 80, issues: [] },
          headingStructure: { score: 75, issues: [] },
          internalLinks: 15
        }
      },
      geoScore: {
        overall: 90,
        readability: 85,
        credibility: 95,
        completeness: 88,
        structuredData: 92,
        details: {
          contentClarity: { score: 85, issues: [] },
          questionAnswerFormat: true,
          authorInformation: true,
          citations: 5,
          schemaMarkup: ['Organization', 'WebPage']
        }
      },
      recommendations: [
        {
          id: 'rec-1',
          category: 'SEO' as const,
          priority: 'High' as const,
          impact: 85,
          effort: 'Medium' as const,
          title: 'Improve page loading speed',
          description: 'Optimize images and reduce server response time',
          actionSteps: [
            'Compress images',
            'Enable browser caching',
            'Minimize HTTP requests'
          ],
          example: 'Use WebP format for images'
        }
      ],
      technicalDetails: {
        loadTime: 2.5,
        pageSize: 1024000,
        requests: 25
      }
    }
  ],
  
  analysisConfig: {
    seoWeights: {
      technical: 0.4,
      content: 0.4,
      structure: 0.2
    },
    geoWeights: {
      readability: 0.3,
      credibility: 0.3,
      completeness: 0.2,
      structuredData: 0.2
    },
    thresholds: {
      pageSpeedMin: 70,
      contentLengthMin: 300,
      headingLevels: 3
    }
  }
};

/**
 * Test utilities
 */
export const testUtils = {
  /**
   * Generate a valid UUID for testing
   */
  generateUUID: (): string => {
    return '550e8400-e29b-41d4-a716-446655440000';
  },
  
  /**
   * Create a large payload for testing size limits
   */
  createLargePayload: (sizeInMB: number) => {
    const size = sizeInMB * 1024 * 1024;
    return {
      urls: ['https://example.com'],
      largeField: 'x'.repeat(size)
    };
  },
  
  /**
   * Wait for a specified amount of time
   */
  wait: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  /**
   * Validate response structure
   */
  validateApiResponse: (response: any, expectedProperties: string[]) => {
    expectedProperties.forEach(prop => {
      expect(response.body).toHaveProperty(prop);
    });
  }
};