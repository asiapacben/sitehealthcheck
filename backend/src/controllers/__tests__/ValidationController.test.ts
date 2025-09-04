import request from 'supertest';
import express from 'express';
import validationRoutes from '../../routes/validation';

const app = express();
app.use(express.json());
app.use('/api/validation', validationRoutes);

describe('ValidationController', () => {
  describe('POST /api/validation/urls', () => {
    it('should validate URLs from the same domain', async () => {
      const urls = [
        'https://example.com',
        'https://example.com/page1',
        'https://www.example.com/page2'
      ];

      const response = await request(app)
        .post('/api/validation/urls')
        .send({ urls })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.normalizedUrls).toHaveLength(3);
      expect(response.body.data.domain).toBe('example.com');
    });

    it('should reject URLs from different domains', async () => {
      const urls = [
        'https://example.com',
        'https://different.com'
      ];

      const response = await request(app)
        .post('/api/validation/urls')
        .send({ urls })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some((e: any) => e.code === 'DOMAIN_MISMATCH')).toBe(true);
    });

    it('should return 400 for empty URL array', async () => {
      const response = await request(app)
        .post('/api/validation/urls')
        .send({ urls: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for missing URLs field', async () => {
      const response = await request(app)
        .post('/api/validation/urls')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for invalid URL format', async () => {
      const response = await request(app)
        .post('/api/validation/urls')
        .send({ urls: ['not-a-url'] })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/validation/domain-consistency', () => {
    it('should return true for consistent domains', async () => {
      const urls = [
        'https://example.com',
        'https://www.example.com/page'
      ];

      const response = await request(app)
        .post('/api/validation/domain-consistency')
        .send({ urls })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.consistent).toBe(true);
      expect(response.body.data.domain).toBe('example.com');
    });

    it('should return false for inconsistent domains', async () => {
      const urls = [
        'https://example.com',
        'https://different.com'
      ];

      const response = await request(app)
        .post('/api/validation/domain-consistency')
        .send({ urls })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.consistent).toBe(false);
    });
  });

  describe('POST /api/validation/normalize-url', () => {
    it('should normalize a valid URL', async () => {
      const url = 'example.com/page/';

      const response = await request(app)
        .post('/api/validation/normalize-url')
        .send({ url })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.originalUrl).toBe(url);
      expect(response.body.data.normalizedUrl).toBe('https://example.com/page');
      expect(response.body.data.domain).toBe('example.com');
    });

    it('should return 400 for missing URL', async () => {
      const response = await request(app)
        .post('/api/validation/normalize-url')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for invalid URL', async () => {
      const response = await request(app)
        .post('/api/validation/normalize-url')
        .send({ url: 'not-a-url' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/validation/check-accessibility', () => {
    it('should return 400 for invalid URL', async () => {
      const response = await request(app)
        .post('/api/validation/check-accessibility')
        .send({ url: 'not-a-url' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing URL', async () => {
      const response = await request(app)
        .post('/api/validation/check-accessibility')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    // Note: We can't easily test actual URL accessibility in unit tests
    // without mocking fetch or using integration tests with real URLs
  });

  describe('Error handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/validation/urls')
        .send('invalid json')
        .expect(400);

      // Express will handle malformed JSON and return 400
    });

    it('should handle very long URL lists', async () => {
      // Create array with more URLs than the limit
      const urls = Array(20).fill('https://example.com').map((url, i) => `${url}/page${i}`);

      const response = await request(app)
        .post('/api/validation/urls')
        .send({ urls })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});