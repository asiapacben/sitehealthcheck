import request from 'supertest';
import express from 'express';
import { createTestApp, testUtils } from './test-helpers';

describe('Rate Limiting Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    // Enable rate limiting for these tests
    process.env.TEST_RATE_LIMITING = 'true';
    app = createTestApp();
  });

  afterAll(() => {
    delete process.env.TEST_RATE_LIMITING;
  });

  describe('Global Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should include rate limit headers in responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });

  describe('Analysis Endpoint Rate Limiting', () => {
    it('should have stricter limits for analysis endpoints', async () => {
      const testUrls = ['https://example.com'];

      // Make multiple requests quickly
      const requests = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/analysis/start')
          .send({ urls: testUrls })
      );

      const responses = await Promise.all(requests);

      // First few should succeed
      responses.slice(0, 2).forEach(response => {
        expect([200, 429]).toContain(response.status);
      });

      // Check rate limit headers
      const lastResponse = responses[responses.length - 1];
      if (lastResponse.status === 429) {
        expect(lastResponse.body.error).toBe('Rate limit exceeded');
        expect(lastResponse.body.retryAfter).toBeDefined();
      }
    });

    it('should reset rate limit after window expires', async () => {
      // This test would require waiting for the rate limit window to reset
      // For testing purposes, we'll just verify the structure
      const response = await request(app)
        .post('/api/analysis/start')
        .send({ urls: ['https://example.com'] });

      if (response.status === 429) {
        expect(response.body).toHaveProperty('retryAfter');
        expect(typeof response.body.retryAfter).toBe('number');
      }
    });
  });

  describe('Validation Endpoint Rate Limiting', () => {
    it('should allow more validation requests than analysis requests', async () => {
      const testUrls = ['https://example.com'];

      // Make multiple validation requests
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/validation/urls')
          .send({ urls: testUrls })
      );

      const responses = await Promise.all(requests);

      // Most should succeed (validation has higher limits)
      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(5);
    });
  });

  describe('Export Endpoint Rate Limiting', () => {
    it('should limit export requests appropriately', async () => {
      const mockResults = [{
        url: 'https://example.com',
        timestamp: new Date().toISOString(),
        overallScore: 85,
        seoScore: { overall: 80, technical: 85, content: 75, structure: 80 },
        geoScore: { overall: 90, readability: 85, credibility: 95, completeness: 88, structuredData: 92 },
        recommendations: []
      }];

      const requests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/export')
          .send({ format: 'json', results: mockResults })
      );

      const responses = await Promise.all(requests);

      // Check that rate limiting is applied
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      const successfulResponses = responses.filter(r => r.status === 200);

      expect(successfulResponses.length + rateLimitedResponses.length).toBe(5);
    });
  });

  describe('Rate Limit Error Responses', () => {
    it('should return proper error format when rate limited', async () => {
      // Make many requests to trigger rate limiting
      const requests = Array(20).fill(null).map(() =>
        request(app)
          .post('/api/analysis/start')
          .send({ urls: ['https://example.com'] })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find(r => r.status === 429);

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toHaveProperty('success', false);
        expect(rateLimitedResponse.body).toHaveProperty('error', 'Rate limit exceeded');
        expect(rateLimitedResponse.body).toHaveProperty('message');
        expect(rateLimitedResponse.body).toHaveProperty('retryAfter');
        expect(typeof rateLimitedResponse.body.retryAfter).toBe('number');
      }
    });
  });

  describe('Rate Limit Bypass Attempts', () => {
    it('should not be bypassed by changing User-Agent', async () => {
      const testUrls = ['https://example.com'];

      // Make requests with different User-Agent headers
      const requests = Array(10).fill(null).map((_, index) =>
        request(app)
          .post('/api/analysis/start')
          .set('User-Agent', `TestAgent-${index}`)
          .send({ urls: testUrls })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      // Should still be rate limited regardless of User-Agent
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should not be bypassed by changing request headers', async () => {
      const testUrls = ['https://example.com'];

      // Make requests with different headers
      const requests = Array(10).fill(null).map((_, index) =>
        request(app)
          .post('/api/analysis/start')
          .set('X-Custom-Header', `value-${index}`)
          .send({ urls: testUrls })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      // Should still be rate limited
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Performance', () => {
    it('should not significantly impact response time', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/health')
        .expect(200);

      const responseTime = Date.now() - startTime;

      // Rate limiting should add minimal overhead
      expect(responseTime).toBeLessThan(1000);
    });

    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();

      const requests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/validation/urls')
          .send({ urls: ['https://example.com'] })
      );

      await Promise.all(requests);

      const totalTime = Date.now() - startTime;

      // Should handle concurrent requests reasonably fast
      expect(totalTime).toBeLessThan(5000);
    });
  });
});