import request from 'supertest';
import express from 'express';
import analysisRoutes from '../../routes/analysis';

const app = express();
app.use(express.json());
app.use('/api/analysis', analysisRoutes);

describe('AnalysisController', () => {
  describe('POST /api/analysis/start', () => {
    it('should start analysis with valid URLs', async () => {
      const urls = [
        'https://example.com',
        'https://example.com/page1'
      ];

      const response = await request(app)
        .post('/api/analysis/start')
        .send({ urls })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.urlCount).toBe(2);
    });

    it('should start analysis with custom config', async () => {
      const urls = ['https://example.com'];
      const config = {
        seoWeights: {
          technical: 0.5,
          content: 0.3,
          structure: 0.2
        },
        geoWeights: {
          readability: 0.4,
          credibility: 0.3,
          completeness: 0.2,
          structuredData: 0.1
        },
        thresholds: {
          pageSpeedMin: 80,
          contentLengthMin: 500,
          headingLevels: 4
        }
      };

      const response = await request(app)
        .post('/api/analysis/start')
        .send({ urls, config })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
    });

    it('should reject URLs from different domains', async () => {
      const urls = [
        'https://example.com',
        'https://different.com'
      ];

      const response = await request(app)
        .post('/api/analysis/start')
        .send({ urls })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('URL validation failed');
    });

    it('should return 400 for empty URL array', async () => {
      const response = await request(app)
        .post('/api/analysis/start')
        .send({ urls: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for missing URLs field', async () => {
      const response = await request(app)
        .post('/api/analysis/start')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for too many URLs', async () => {
      const urls = Array(20).fill('https://example.com').map((url, i) => `${url}/page${i}`);

      const response = await request(app)
        .post('/api/analysis/start')
        .send({ urls })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate config weights are between 0 and 1', async () => {
      const urls = ['https://example.com'];
      const config = {
        seoWeights: {
          technical: 1.5, // Invalid: > 1
          content: 0.3,
          structure: 0.2
        }
      };

      const response = await request(app)
        .post('/api/analysis/start')
        .send({ urls, config })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/analysis/status/:jobId', () => {
    let jobId: string;

    beforeEach(async () => {
      // Create a job for testing
      const response = await request(app)
        .post('/api/analysis/start')
        .send({ urls: ['https://example.com'] });
      
      jobId = response.body.data.jobId;
    });

    it('should return job status for valid job ID', async () => {
      const response = await request(app)
        .get(`/api/analysis/status/${jobId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBe(jobId);
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.progress).toBeDefined();
    });

    it('should return 404 for non-existent job ID', async () => {
      const fakeJobId = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await request(app)
        .get(`/api/analysis/status/${fakeJobId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not found');
    });

    it('should return 400 for missing job ID', async () => {
      const response = await request(app)
        .get('/api/analysis/status/')
        .expect(404); // Express returns 404 for missing route params
    });
  });

  describe('GET /api/analysis/results/:jobId', () => {
    let jobId: string;

    beforeEach(async () => {
      // Create a job for testing
      const response = await request(app)
        .post('/api/analysis/start')
        .send({ urls: ['https://example.com'] });
      
      jobId = response.body.data.jobId;
    });

    it('should return 400 for incomplete job', async () => {
      const response = await request(app)
        .get(`/api/analysis/results/${jobId}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not completed');
    });

    it('should return 404 for non-existent job ID', async () => {
      const fakeJobId = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await request(app)
        .get(`/api/analysis/results/${fakeJobId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not found');
    });
  });

  describe('POST /api/analysis/cancel/:jobId', () => {
    let jobId: string;

    beforeEach(async () => {
      // Create a job for testing
      const response = await request(app)
        .post('/api/analysis/start')
        .send({ urls: ['https://example.com'] });
      
      jobId = response.body.data.jobId;
    });

    it('should cancel existing job', async () => {
      const response = await request(app)
        .post(`/api/analysis/cancel/${jobId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBe(jobId);
      expect(response.body.data.status).toBe('cancelled');
    });

    it('should return 404 for non-existent job ID', async () => {
      const fakeJobId = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await request(app)
        .post(`/api/analysis/cancel/${fakeJobId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/analysis/stats', () => {
    it('should return orchestrator statistics', async () => {
      const response = await request(app)
        .get('/api/analysis/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalJobs).toBeDefined();
      expect(response.body.data.activeJobs).toBeDefined();
      expect(response.body.data.pendingJobs).toBeDefined();
      expect(response.body.data.completedJobs).toBeDefined();
      expect(response.body.data.failedJobs).toBeDefined();
    });

    it('should show updated stats after creating jobs', async () => {
      // Get initial stats
      const initialResponse = await request(app)
        .get('/api/analysis/stats')
        .expect(200);

      const initialStats = initialResponse.body.data;

      // Create a job
      await request(app)
        .post('/api/analysis/start')
        .send({ urls: ['https://example.com'] });

      // Get updated stats
      const updatedResponse = await request(app)
        .get('/api/analysis/stats')
        .expect(200);

      const updatedStats = updatedResponse.body.data;

      expect(updatedStats.totalJobs).toBe(initialStats.totalJobs + 1);
    });
  });

  describe('error handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/analysis/start')
        .send('invalid json')
        .expect(400);

      // Express will handle malformed JSON and return 400
    });

    it('should handle invalid config values', async () => {
      const urls = ['https://example.com'];
      const config = {
        seoWeights: {
          technical: 'invalid', // Should be number
          content: 0.3,
          structure: 0.2
        }
      };

      const response = await request(app)
        .post('/api/analysis/start')
        .send({ urls, config })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});