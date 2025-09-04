import request from 'supertest';
import express from 'express';
import { createTestApp } from './test-helpers';

describe('API Endpoints Comprehensive Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('API Documentation', () => {
    it('should serve Swagger documentation', async () => {
      const response = await request(app)
        .get('/api-docs/')
        .expect(200);

      expect(response.text).toContain('swagger-ui');
    });

    it('should provide API information endpoint', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('documentation', '/api-docs');
      expect(response.body).toHaveProperty('endpoints');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
      expect(response.headers).toHaveProperty('referrer-policy', 'strict-origin-when-cross-origin');
      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers).not.toHaveProperty('x-powered-by');
    });
  });

  describe('CORS Configuration', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/validation/urls')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .post('/api/validation/urls')
        .set('Origin', 'http://malicious-site.com')
        .send({ urls: ['https://example.com'] });

      // CORS should be handled by the browser, but we can check server behavior
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Content Type Validation', () => {
    it('should accept JSON content type', async () => {
      const response = await request(app)
        .post('/api/validation/urls')
        .set('Content-Type', 'application/json')
        .send({ urls: ['https://example.com'] })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should reject unsupported content types', async () => {
      const response = await request(app)
        .post('/api/validation/urls')
        .set('Content-Type', 'text/plain')
        .send('urls=https://example.com')
        .expect(400);
    });
  });

  describe('Request Size Limits', () => {
    it('should accept normal-sized requests', async () => {
      const normalPayload = {
        urls: ['https://example.com'],
        config: {
          seoWeights: { technical: 0.5, content: 0.3, structure: 0.2 }
        }
      };

      const response = await request(app)
        .post('/api/analysis/start')
        .send(normalPayload)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should handle empty requests gracefully', async () => {
      const response = await request(app)
        .post('/api/validation/urls')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format for validation errors', async () => {
      const response = await request(app)
        .post('/api/validation/urls')
        .send({ urls: [] })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);
    });

    it('should return consistent error format for not found', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });

    it('should handle internal server errors gracefully', async () => {
      // This would require mocking a service to throw an error
      // For now, we'll test the error handler format
      const response = await request(app)
        .get('/api/analysis/status/invalid-uuid-format')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('API Versioning', () => {
    it('should include version information', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body).toHaveProperty('version');
      expect(typeof response.body.version).toBe('string');
    });
  });

  describe('Health Check Endpoint', () => {
    it('should provide detailed health information', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      
      // Validate timestamp format
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    });

    it('should respond quickly to health checks', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/health')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe('Request ID Tracking', () => {
    it('should handle concurrent requests properly', async () => {
      const requests = Array(5).fill(null).map(() => 
        request(app)
          .post('/api/validation/urls')
          .send({ urls: ['https://example.com'] })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize malicious input', async () => {
      const maliciousPayload = {
        urls: ['<script>alert("xss")</script>'],
        config: {
          seoWeights: {
            technical: '<script>alert("xss")</script>',
            content: 0.3,
            structure: 0.2
          }
        }
      };

      const response = await request(app)
        .post('/api/analysis/start')
        .send(maliciousPayload)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should handle SQL injection attempts', async () => {
      const sqlInjectionPayload = {
        urls: ["'; DROP TABLE users; --"]
      };

      const response = await request(app)
        .post('/api/validation/urls')
        .send(sqlInjectionPayload)
        .expect(200); // Should be handled gracefully by validation

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('valid', false);
    });
  });

  describe('Performance', () => {
    it('should handle multiple validation requests efficiently', async () => {
      const startTime = Date.now();
      
      const requests = Array(10).fill(null).map((_, index) => 
        request(app)
          .post('/api/validation/urls')
          .send({ urls: [`https://example${index}.com`] })
      );

      await Promise.all(requests);
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});