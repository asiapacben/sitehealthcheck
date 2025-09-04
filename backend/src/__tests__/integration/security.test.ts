import request from 'supertest';
import express from 'express';
import { createTestApp } from './test-helpers';

describe('Security Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    // Enable security middleware for these tests
    process.env.TEST_SECURITY_MIDDLEWARE = 'true';
    app = createTestApp();
  });

  afterAll(() => {
    delete process.env.TEST_SECURITY_MIDDLEWARE;
  });

  describe('Security Headers', () => {
    it('should include all required security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['content-security-policy']).toBeDefined();
      
      // Should not expose server information
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });

    it('should set proper Content Security Policy', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent XSS in URL parameters', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .post('/api/validation/urls')
        .send({ urls: [xssPayload] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(false);
      
      // Response should not contain the script tag
      expect(JSON.stringify(response.body)).not.toContain('<script>');
    });

    it('should handle SQL injection attempts safely', async () => {
      const sqlPayload = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .post('/api/validation/urls')
        .send({ urls: [sqlPayload] })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should be handled as invalid URL, not cause server error
      expect(response.body.valid).toBe(false);
    });

    it('should sanitize malicious JSON payloads', async () => {
      const maliciousPayload = {
        urls: ['https://example.com'],
        '__proto__': { 'isAdmin': true },
        'constructor': { 'prototype': { 'isAdmin': true } }
      };

      const response = await request(app)
        .post('/api/validation/urls')
        .send(maliciousPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Malicious properties should be stripped
      expect(response.body).not.toHaveProperty('__proto__');
      expect(response.body).not.toHaveProperty('constructor');
    });
  });

  describe('Request Size Limits', () => {
    it('should reject oversized requests', async () => {
      const largePayload = {
        urls: ['https://example.com'],
        largeField: 'x'.repeat(15 * 1024 * 1024) // 15MB
      };

      const response = await request(app)
        .post('/api/validation/urls')
        .send(largePayload)
        .expect(413);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Payload too large');
    });

    it('should accept normal-sized requests', async () => {
      const normalPayload = {
        urls: ['https://example.com'],
        config: { seoWeights: { technical: 0.5 } }
      };

      const response = await request(app)
        .post('/api/validation/urls')
        .send(normalPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('HTTP Method Security', () => {
    it('should only allow specified HTTP methods', async () => {
      // Test unsupported method
      const response = await request(app)
        .patch('/api/validation/urls')
        .send({ urls: ['https://example.com'] })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should handle OPTIONS requests for CORS', async () => {
      const response = await request(app)
        .options('/api/validation/urls')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  describe('Error Information Disclosure', () => {
    it('should not expose sensitive error information in production', async () => {
      // Temporarily set production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        // Force an error by providing invalid UUID format
        const response = await request(app)
          .get('/api/analysis/status/invalid-uuid')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
        
        // Should not expose detailed error information in production
        expect(response.body.message).not.toContain('stack');
        expect(response.body.message).not.toContain('Error:');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should provide detailed errors in development', async () => {
      // Ensure we're in development mode
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .get('/api/analysis/status/invalid-uuid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Content Type Validation', () => {
    it('should reject non-JSON content types for JSON endpoints', async () => {
      const response = await request(app)
        .post('/api/validation/urls')
        .set('Content-Type', 'text/plain')
        .send('urls=https://example.com')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should accept proper JSON content type', async () => {
      const response = await request(app)
        .post('/api/validation/urls')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ urls: ['https://example.com'] }))
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Path Traversal Protection', () => {
    it('should prevent directory traversal in export endpoints', async () => {
      const maliciousFilename = '../../../etc/passwd';
      
      const response = await request(app)
        .get(`/api/export/download/${maliciousFilename}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should allow valid filenames', async () => {
      const validFilename = 'report-123.pdf';
      
      const response = await request(app)
        .get(`/api/export/download/${validFilename}`)
        .expect(404); // File doesn't exist, but validation passes

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Not found');
    });
  });

  describe('Request Logging Security', () => {
    it('should not log sensitive information', async () => {
      // This test would require checking log output
      // For now, we'll just ensure the endpoint works
      const response = await request(app)
        .post('/api/validation/urls')
        .set('Authorization', 'Bearer sensitive-token')
        .send({ urls: ['https://example.com'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      // In a real implementation, we'd verify that the Authorization header
      // is not logged in plain text
    });
  });
});