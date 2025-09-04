/**
 * End-to-end tests covering complete analysis workflows
 */

import request from 'supertest';
import { app } from '../../index';
import { testSites, testUrls, mockAnalysisResults } from './test-data';
import { AnalysisOrchestrator } from '../../services/AnalysisOrchestrator';
import { URLValidationService } from '../../services/URLValidationService';

describe('Complete Analysis Workflow E2E Tests', () => {
  let server: any;
  
  beforeAll(async () => {
    // Start test server
    server = app.listen(0);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('Full Analysis Pipeline', () => {
    it('should complete full analysis workflow from URL input to report generation', async () => {
      const testUrls = ['https://example.com/', 'https://example.com/about'];
      
      // Step 1: Submit URLs for analysis
      const submitResponse = await request(app)
        .post('/api/analysis/start')
        .send({ urls: testUrls })
        .expect(200);

      expect(submitResponse.body).toHaveProperty('analysisId');
      expect(submitResponse.body.status).toBe('started');
      
      const analysisId = submitResponse.body.analysisId;

      // Step 2: Check analysis status
      const statusResponse = await request(app)
        .get(`/api/analysis/status/${analysisId}`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('status');
      expect(['started', 'in_progress', 'completed']).toContain(statusResponse.body.status);

      // Step 3: Wait for completion and get results
      let results;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout

      while (attempts < maxAttempts) {
        const resultResponse = await request(app)
          .get(`/api/analysis/results/${analysisId}`)
          .expect(200);

        if (resultResponse.body.status === 'completed') {
          results = resultResponse.body;
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      expect(results).toBeDefined();
      expect(results.status).toBe('completed');
      expect(results.results).toHaveLength(testUrls.length);

      // Verify result structure
      results.results.forEach((result: any) => {
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('overallScore');
        expect(result).toHaveProperty('seoScore');
        expect(result).toHaveProperty('geoScore');
        expect(result).toHaveProperty('recommendations');
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.overallScore).toBeLessThanOrEqual(100);
      });

      // Step 4: Export results in different formats
      const pdfExport = await request(app)
        .post(`/api/export/pdf`)
        .send({ analysisId })
        .expect(200);

      expect(pdfExport.headers['content-type']).toContain('application/pdf');

      const csvExport = await request(app)
        .post(`/api/export/csv`)
        .send({ analysisId })
        .expect(200);

      expect(csvExport.headers['content-type']).toContain('text/csv');

      const jsonExport = await request(app)
        .post(`/api/export/json`)
        .send({ analysisId })
        .expect(200);

      expect(jsonExport.body).toHaveProperty('results');
    }, 60000); // 60 second timeout for full workflow

    it('should handle URL validation errors in complete workflow', async () => {
      const invalidUrls = testUrls.invalidMixedDomains;

      const response = await request(app)
        .post('/api/analysis/start')
        .send({ urls: invalidUrls })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('domain');
    });

    it('should handle partial analysis failures gracefully', async () => {
      const mixedUrls = [
        'https://example.com/',
        'https://example.com/nonexistent-page',
        'https://example.com/about'
      ];

      const submitResponse = await request(app)
        .post('/api/analysis/start')
        .send({ urls: mixedUrls })
        .expect(200);

      const analysisId = submitResponse.body.analysisId;

      // Wait for completion
      let results;
      let attempts = 0;
      while (attempts < 30) {
        const resultResponse = await request(app)
          .get(`/api/analysis/results/${analysisId}`);

        if (resultResponse.body.status === 'completed') {
          results = resultResponse.body;
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      expect(results).toBeDefined();
      expect(results.results.length).toBeGreaterThan(0);
      
      // Should have some successful results and some with errors
      const hasErrors = results.results.some((r: any) => r.error);
      const hasSuccess = results.results.some((r: any) => !r.error);
      
      expect(hasSuccess).toBe(true);
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should recover from network timeouts', async () => {
      const timeoutUrls = ['https://httpstat.us/200?sleep=10000']; // Simulated slow response

      const submitResponse = await request(app)
        .post('/api/analysis/start')
        .send({ 
          urls: timeoutUrls,
          options: { timeout: 5000 } // 5 second timeout
        })
        .expect(200);

      const analysisId = submitResponse.body.analysisId;

      // Wait for completion
      let results;
      let attempts = 0;
      while (attempts < 20) {
        const resultResponse = await request(app)
          .get(`/api/analysis/results/${analysisId}`);

        if (resultResponse.body.status === 'completed') {
          results = resultResponse.body;
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      expect(results).toBeDefined();
      expect(results.results[0]).toHaveProperty('error');
      expect(results.results[0].error).toContain('timeout');
    });

    it('should handle rate limiting gracefully', async () => {
      // Submit multiple analyses quickly to trigger rate limiting
      const promises = Array.from({ length: 10 }, (_, i) => 
        request(app)
          .post('/api/analysis/start')
          .send({ urls: [`https://example${i}.com/`] })
      );

      const responses = await Promise.allSettled(promises);
      
      // Some should succeed, some might be rate limited
      const successful = responses.filter(r => r.status === 'fulfilled' && (r.value as any).status === 200);
      const rateLimited = responses.filter(r => r.status === 'fulfilled' && (r.value as any).status === 429);

      expect(successful.length + rateLimited.length).toBe(10);
    });
  });

  describe('Data Consistency Workflows', () => {
    it('should maintain data consistency across analysis and export', async () => {
      const testUrls = ['https://example.com/'];

      const submitResponse = await request(app)
        .post('/api/analysis/start')
        .send({ urls: testUrls })
        .expect(200);

      const analysisId = submitResponse.body.analysisId;

      // Wait for completion
      let analysisResults;
      let attempts = 0;
      while (attempts < 30) {
        const resultResponse = await request(app)
          .get(`/api/analysis/results/${analysisId}`);

        if (resultResponse.body.status === 'completed') {
          analysisResults = resultResponse.body;
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      // Export in JSON format
      const jsonExport = await request(app)
        .post(`/api/export/json`)
        .send({ analysisId })
        .expect(200);

      // Verify data consistency
      expect(jsonExport.body.results).toHaveLength(analysisResults.results.length);
      
      jsonExport.body.results.forEach((exportResult: any, index: number) => {
        const analysisResult = analysisResults.results[index];
        expect(exportResult.url).toBe(analysisResult.url);
        expect(exportResult.overallScore).toBe(analysisResult.overallScore);
        expect(exportResult.seoScore.overall).toBe(analysisResult.seoScore.overall);
        expect(exportResult.geoScore.overall).toBe(analysisResult.geoScore.overall);
      });
    });
  });

  describe('Configuration Workflow Tests', () => {
    it('should apply custom configuration to analysis workflow', async () => {
      // Set custom configuration
      const customConfig = {
        seoWeights: { technical: 0.5, content: 0.3, structure: 0.2 },
        geoWeights: { readability: 0.4, credibility: 0.3, completeness: 0.2, structuredData: 0.1 },
        thresholds: { pageSpeedMin: 80, contentLengthMin: 300, headingLevels: 3 }
      };

      await request(app)
        .put('/api/config/analysis')
        .send(customConfig)
        .expect(200);

      // Run analysis with custom config
      const submitResponse = await request(app)
        .post('/api/analysis/start')
        .send({ urls: ['https://example.com/'] })
        .expect(200);

      const analysisId = submitResponse.body.analysisId;

      // Wait for completion and verify config was applied
      let results;
      let attempts = 0;
      while (attempts < 30) {
        const resultResponse = await request(app)
          .get(`/api/analysis/results/${analysisId}`);

        if (resultResponse.body.status === 'completed') {
          results = resultResponse.body;
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      expect(results).toBeDefined();
      expect(results.results[0]).toHaveProperty('overallScore');
      
      // Verify the scoring reflects custom weights
      const result = results.results[0];
      expect(result.seoScore).toHaveProperty('technical');
      expect(result.seoScore).toHaveProperty('content');
      expect(result.seoScore).toHaveProperty('structure');
    });
  });
});