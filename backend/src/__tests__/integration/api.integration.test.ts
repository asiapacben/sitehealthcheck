import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from '../../utils/logger';

// Import routes
import validationRoutes from '../../routes/validation';
import analysisRoutes from '../../routes/analysis';
import exportRoutes from '../../routes/export';

// Create test app
const createTestApp = () => {
  const app = express();

  // Basic middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Disable rate limiting for tests
  app.use((req, res, next) => next());

  // Routes
  app.use('/api/validation', validationRoutes);
  app.use('/api/analysis', analysisRoutes);
  app.use('/api/export', exportRoutes);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // Error handling
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  });

  return app;
};

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Validation API', () => {
    describe('POST /api/validation/urls', () => {
      it('should validate URLs successfully', async () => {
        const testUrls = [
          'https://example.com',
          'https://example.com/about'
        ];

        const response = await request(app)
          .post('/api/validation/urls')
          .send({ urls: testUrls })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('valid');
        expect(response.body).toHaveProperty('normalizedUrls');
        expect(Array.isArray(response.body.normalizedUrls)).toBe(true);
      });

      it('should reject empty URL array', async () => {
        const response = await request(app)
          .post('/api/validation/urls')
          .send({ urls: [] })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'Validation failed');
      });

      it('should reject missing URLs field', async () => {
        const response = await request(app)
          .post('/api/validation/urls')
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'Validation failed');
      });

      it('should reject too many URLs', async () => {
        const tooManyUrls = Array(20).fill('https://example.com');

        const response = await request(app)
          .post('/api/validation/urls')
          .send({ urls: tooManyUrls })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'Validation failed');
      });
    });

    describe('POST /api/validation/domain-consistency', () => {
      it('should check domain consistency', async () => {
        const testUrls = [
          'https://example.com',
          'https://example.com/about'
        ];

        const response = await request(app)
          .post('/api/validation/domain-consistency')
          .send({ urls: testUrls })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('consistent');
        expect(response.body).toHaveProperty('domain');
      });

      it('should detect inconsistent domains', async () => {
        const testUrls = [
          'https://example.com',
          'https://different.com'
        ];

        const response = await request(app)
          .post('/api/validation/domain-consistency')
          .send({ urls: testUrls })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('consistent', false);
        expect(response.body).toHaveProperty('inconsistentUrls');
        expect(Array.isArray(response.body.inconsistentUrls)).toBe(true);
      });
    });

    describe('POST /api/validation/normalize-url', () => {
      it('should normalize URL successfully', async () => {
        const response = await request(app)
          .post('/api/validation/normalize-url')
          .send({ url: 'example.com/page' })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('originalUrl');
        expect(response.body).toHaveProperty('normalizedUrl');
        expect(response.body).toHaveProperty('domain');
      });

      it('should reject missing URL', async () => {
        const response = await request(app)
          .post('/api/validation/normalize-url')
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'Validation failed');
      });
    });

    describe('POST /api/validation/check-accessibility', () => {
      it('should check URL accessibility', async () => {
        const response = await request(app)
          .post('/api/validation/check-accessibility')
          .send({ url: 'https://httpbin.org/status/200' })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('accessible');
        expect(response.body).toHaveProperty('statusCode');
        expect(response.body).toHaveProperty('responseTime');
      });

      it('should handle inaccessible URLs', async () => {
        const response = await request(app)
          .post('/api/validation/check-accessibility')
          .send({ url: 'https://httpbin.org/status/404' })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('accessible', false);
        expect(response.body).toHaveProperty('statusCode', 404);
      });

      it('should reject invalid URL format', async () => {
        const response = await request(app)
          .post('/api/validation/check-accessibility')
          .send({ url: 'not-a-url' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'Validation failed');
      });
    });
  });

  describe('Analysis API', () => {
    let testJobId: string;

    describe('POST /api/analysis/start', () => {
      it('should start analysis successfully', async () => {
        const testUrls = [
          'https://example.com',
          'https://example.com/about'
        ];

        const response = await request(app)
          .post('/api/analysis/start')
          .send({ urls: testUrls })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('jobId');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('urls');
        expect(response.body).toHaveProperty('createdAt');

        testJobId = response.body.jobId;
      });

      it('should start analysis with custom config', async () => {
        const testUrls = ['https://example.com'];
        const config = {
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
          }
        };

        const response = await request(app)
          .post('/api/analysis/start')
          .send({ urls: testUrls, config })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('jobId');
      });

      it('should reject empty URLs', async () => {
        const response = await request(app)
          .post('/api/analysis/start')
          .send({ urls: [] })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'Validation failed');
      });

      it('should reject invalid config weights', async () => {
        const testUrls = ['https://example.com'];
        const config = {
          seoWeights: {
            technical: 1.5, // Invalid: > 1
            content: 0.4,
            structure: 0.2
          }
        };

        const response = await request(app)
          .post('/api/analysis/start')
          .send({ urls: testUrls, config })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'Validation failed');
      });
    });

    describe('GET /api/analysis/status/:jobId', () => {
      it('should get job status', async () => {
        if (!testJobId) {
          // Create a job first
          const startResponse = await request(app)
            .post('/api/analysis/start')
            .send({ urls: ['https://example.com'] });
          testJobId = startResponse.body.jobId;
        }

        const response = await request(app)
          .get(`/api/analysis/status/${testJobId}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('jobId', testJobId);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('progress');
      });

      it('should handle non-existent job ID', async () => {
        const fakeJobId = '550e8400-e29b-41d4-a716-446655440000';

        const response = await request(app)
          .get(`/api/analysis/status/${fakeJobId}`)
          .expect(404);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
      });

      it('should reject invalid job ID format', async () => {
        const response = await request(app)
          .get('/api/analysis/status/invalid-id')
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('GET /api/analysis/results/:jobId', () => {
      it('should get job results when completed', async () => {
        if (!testJobId) {
          const startResponse = await request(app)
            .post('/api/analysis/start')
            .send({ urls: ['https://example.com'] });
          testJobId = startResponse.body.jobId;
        }

        // Note: In a real scenario, we'd wait for completion or mock the results
        const response = await request(app)
          .get(`/api/analysis/results/${testJobId}`);

        // Should either return results (200) or indicate job not complete (404/400)
        expect([200, 400, 404]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body).toHaveProperty('success', true);
          expect(response.body).toHaveProperty('jobId', testJobId);
          expect(response.body).toHaveProperty('results');
          expect(Array.isArray(response.body.results)).toBe(true);
        }
      });
    });

    describe('POST /api/analysis/cancel/:jobId', () => {
      it('should cancel job successfully', async () => {
        if (!testJobId) {
          const startResponse = await request(app)
            .post('/api/analysis/start')
            .send({ urls: ['https://example.com'] });
          testJobId = startResponse.body.jobId;
        }

        const response = await request(app)
          .post(`/api/analysis/cancel/${testJobId}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message');
      });
    });

    describe('GET /api/analysis/stats', () => {
      it('should get analysis statistics', async () => {
        const response = await request(app)
          .get('/api/analysis/stats')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('stats');
        expect(response.body.stats).toHaveProperty('totalJobs');
        expect(response.body.stats).toHaveProperty('activeJobs');
        expect(response.body.stats).toHaveProperty('completedJobs');
      });
    });
  });

  describe('Export API', () => {
    const mockResults = [
      {
        url: 'https://example.com',
        timestamp: new Date().toISOString(),
        overallScore: 85,
        seoScore: {
          overall: 80,
          technical: 85,
          content: 75,
          structure: 80
        },
        geoScore: {
          overall: 90,
          readability: 85,
          credibility: 95,
          completeness: 88,
          structuredData: 92
        },
        recommendations: []
      }
    ];

    describe('POST /api/export', () => {
      it('should generate PDF report', async () => {
        const response = await request(app)
          .post('/api/export')
          .send({
            format: 'pdf',
            results: mockResults,
            includeDetails: true
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('filename');
        expect(response.body.filename).toMatch(/\.pdf$/);
      });

      it('should generate CSV report', async () => {
        const response = await request(app)
          .post('/api/export')
          .send({
            format: 'csv',
            results: mockResults
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('filename');
        expect(response.body.filename).toMatch(/\.csv$/);
      });

      it('should generate JSON report', async () => {
        const response = await request(app)
          .post('/api/export')
          .send({
            format: 'json',
            results: mockResults,
            customNotes: 'Test analysis report'
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('filename');
        expect(response.body.filename).toMatch(/\.json$/);
      });

      it('should reject invalid format', async () => {
        const response = await request(app)
          .post('/api/export')
          .send({
            format: 'invalid',
            results: mockResults
          })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'Validation failed');
      });

      it('should reject empty results', async () => {
        const response = await request(app)
          .post('/api/export')
          .send({
            format: 'pdf',
            results: []
          })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'Validation failed');
      });
    });

    describe('POST /api/export/multi', () => {
      it('should generate multiple format reports', async () => {
        const response = await request(app)
          .post('/api/export/multi')
          .send({
            formats: ['pdf', 'csv'],
            results: mockResults
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('files');
        expect(Array.isArray(response.body.files)).toBe(true);
        expect(response.body.files).toHaveLength(2);
      });
    });

    describe('GET /api/export/list', () => {
      it('should list available reports', async () => {
        const response = await request(app)
          .get('/api/export/list')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('files');
        expect(Array.isArray(response.body.files)).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/validation/urls')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle large payloads', async () => {
      const largePayload = {
        urls: ['https://example.com'],
        largeField: 'x'.repeat(20 * 1024 * 1024) // 20MB
      };

      const response = await request(app)
        .post('/api/validation/urls')
        .send(largePayload)
        .expect(413);
    });
  });
});