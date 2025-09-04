import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../../config/swagger';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { describe } from 'node:test';

// Create a minimal test app for basic API testing
const createMinimalApp = () => {
  const app = express();

  // Basic middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());

  // API Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  // API info
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

  // Mock validation endpoint
  app.post('/api/validation/urls', (req, res): void => {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: [{ field: 'urls', message: 'At least one URL is required' }]
      });
      return;
    }

    res.json({
      success: true,
      valid: true,
      normalizedUrls: urls.map((url: string) => url.startsWith('http') ? url : `https://${url}`),
      errors: []
    });
  });

  // Mock analysis endpoint
  app.post('/api/analysis/start', (req, res): void => {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: [{ field: 'urls', message: 'At least one URL is required' }]
      });
      return;
    }

    const jobId = '550e8400-e29b-41d4-a716-446655440000';
    
    res.json({
      success: true,
      jobId,
      status: 'pending',
      urls,
      createdAt: new Date().toISOString()
    });
  });

  // Mock status endpoint
  app.get('/api/analysis/status/:jobId', (req, res): void => {
    const { jobId } = req.params;
    
    if (!jobId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      res.status(400).json({
        success: false,
        error: 'Invalid job ID format'
      });
      return;
    }

    res.json({
      success: true,
      jobId,
      status: 'running',
      progress: {
        completed: 1,
        total: 2,
        percentage: 50
      },
      currentUrl: 'https://example.com',
      estimatedTimeRemaining: 30
    });
  });

  // Error handling
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
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

describe('Basic API Structure Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createMinimalApp();
  });

  describe('Core Endpoints', () => {
    it('should serve health check', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
    });

    it('should serve API information', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('documentation', '/api-docs');
      expect(response.body).toHaveProperty('endpoints');
    });

    it('should serve Swagger documentation', async () => {
      const response = await request(app)
        .get('/api-docs/')
        .expect(200);

      expect(response.text).toContain('swagger-ui');
    });
  });

  describe('API Validation', () => {
    it('should validate URLs successfully', async () => {
      const response = await request(app)
        .post('/api/validation/urls')
        .send({ urls: ['https://example.com', 'example.com/about'] })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('valid', true);
      expect(response.body).toHaveProperty('normalizedUrls');
      expect(Array.isArray(response.body.normalizedUrls)).toBe(true);
    });

    it('should reject empty URL arrays', async () => {
      const response = await request(app)
        .post('/api/validation/urls')
        .send({ urls: [] })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('Analysis API', () => {
    it('should start analysis job', async () => {
      const response = await request(app)
        .post('/api/analysis/start')
        .send({ urls: ['https://example.com'] })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('status', 'pending');
      expect(response.body).toHaveProperty('urls');
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should get job status', async () => {
      const jobId = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await request(app)
        .get(`/api/analysis/status/${jobId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('jobId', jobId);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('progress');
    });

    it('should reject invalid job ID format', async () => {
      const response = await request(app)
        .get('/api/analysis/status/invalid-id')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Invalid job ID format');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Not found');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/validation/urls')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(500); // Express returns 500 for malformed JSON by default

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for basic security headers from helmet
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).not.toHaveProperty('x-powered-by');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/validation/urls')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});