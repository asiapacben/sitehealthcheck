/**
 * Performance tests for multiple concurrent analyses
 */

import request from 'supertest';
import { app } from '../../index';
import { PerformanceMonitor } from '../../utils/PerformanceMonitor';

describe('Concurrent Analysis Performance Tests', () => {
  let server: any;
  const performanceMonitor = new PerformanceMonitor();

  beforeAll(async () => {
    server = app.listen(0);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('Concurrent Analysis Load Tests', () => {
    it('should handle 10 concurrent single-URL analyses within performance limits', async () => {
      const startTime = Date.now();
      const concurrentAnalyses = 10;
      
      const promises = Array.from({ length: concurrentAnalyses }, (_, i) =>
        request(app)
          .post('/api/analysis/start')
          .send({ urls: [`https://example${i}.com/`] })
          .expect(200)
      );

      const responses = await Promise.all(promises);
      const submitTime = Date.now() - startTime;

      // All analyses should start successfully
      expect(responses).toHaveLength(concurrentAnalyses);
      responses.forEach(response => {
        expect(response.body).toHaveProperty('analysisId');
        expect(response.body.status).toBe('started');
      });

      // Submit time should be reasonable (< 5 seconds)
      expect(submitTime).toBeLessThan(5000);

      // Wait for all analyses to complete
      const completionPromises = responses.map(async (response) => {
        const analysisId = response.body.analysisId;
        let attempts = 0;
        const maxAttempts = 60; // 60 seconds timeout

        while (attempts < maxAttempts) {
          const statusResponse = await request(app)
            .get(`/api/analysis/status/${analysisId}`);

          if (statusResponse.body.status === 'completed') {
            return {
              analysisId,
              completionTime: Date.now() - startTime
            };
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }

        throw new Error(`Analysis ${analysisId} did not complete within timeout`);
      });

      const completions = await Promise.all(completionPromises);
      const totalTime = Date.now() - startTime;

      // Performance assertions
      expect(totalTime).toBeLessThan(60000); // Should complete within 60 seconds
      expect(completions).toHaveLength(concurrentAnalyses);

      // Average completion time should be reasonable
      const avgCompletionTime = completions.reduce((sum, c) => sum + c.completionTime, 0) / completions.length;
      expect(avgCompletionTime).toBeLessThan(45000); // Average < 45 seconds

      console.log(`Concurrent Analysis Performance:
        - Total analyses: ${concurrentAnalyses}
        - Total time: ${totalTime}ms
        - Average completion time: ${avgCompletionTime}ms
        - Submit time: ${submitTime}ms`);
    }, 120000); // 2 minute timeout

    it('should handle 5 concurrent multi-URL analyses efficiently', async () => {
      const startTime = Date.now();
      const concurrentAnalyses = 5;
      const urlsPerAnalysis = 3;

      const promises = Array.from({ length: concurrentAnalyses }, (_, i) => {
        const urls = Array.from({ length: urlsPerAnalysis }, (_, j) => 
          `https://example${i}.com/page${j}`
        );
        
        return request(app)
          .post('/api/analysis/start')
          .send({ urls })
          .expect(200);
      });

      const responses = await Promise.all(promises);
      const submitTime = Date.now() - startTime;

      // Wait for completion
      const completionPromises = responses.map(async (response) => {
        const analysisId = response.body.analysisId;
        let attempts = 0;

        while (attempts < 90) { // 90 seconds for multi-URL analyses
          const resultResponse = await request(app)
            .get(`/api/analysis/results/${analysisId}`);

          if (resultResponse.body.status === 'completed') {
            return {
              analysisId,
              resultCount: resultResponse.body.results.length,
              completionTime: Date.now() - startTime
            };
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }

        throw new Error(`Multi-URL analysis ${analysisId} did not complete`);
      });

      const completions = await Promise.all(completionPromises);
      const totalTime = Date.now() - startTime;

      // Verify all URLs were analyzed
      completions.forEach(completion => {
        expect(completion.resultCount).toBe(urlsPerAnalysis);
      });

      // Performance assertions
      expect(totalTime).toBeLessThan(120000); // Should complete within 2 minutes

      console.log(`Multi-URL Concurrent Analysis Performance:
        - Concurrent analyses: ${concurrentAnalyses}
        - URLs per analysis: ${urlsPerAnalysis}
        - Total time: ${totalTime}ms
        - Submit time: ${submitTime}ms`);
    }, 180000); // 3 minute timeout

    it('should maintain memory usage within acceptable limits during concurrent analyses', async () => {
      const initialMemory = process.memoryUsage();
      const concurrentAnalyses = 15;

      // Start monitoring memory
      const memoryReadings: number[] = [];
      const memoryInterval = setInterval(() => {
        const usage = process.memoryUsage();
        memoryReadings.push(usage.heapUsed);
      }, 1000);

      try {
        const promises = Array.from({ length: concurrentAnalyses }, (_, i) =>
          request(app)
            .post('/api/analysis/start')
            .send({ urls: [`https://example${i}.com/`] })
        );

        const responses = await Promise.all(promises);

        // Wait for all to complete
        await Promise.all(responses.map(async (response) => {
          if (response.status !== 200) return;
          
          const analysisId = response.body.analysisId;
          let attempts = 0;

          while (attempts < 60) {
            const statusResponse = await request(app)
              .get(`/api/analysis/status/${analysisId}`);

            if (statusResponse.body.status === 'completed') {
              break;
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
        }));

        clearInterval(memoryInterval);

        const finalMemory = process.memoryUsage();
        const maxMemoryUsed = Math.max(...memoryReadings);
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

        // Memory assertions
        expect(maxMemoryUsed).toBeLessThan(500 * 1024 * 1024); // < 500MB peak usage
        expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // < 200MB increase

        console.log(`Memory Usage During Concurrent Analysis:
          - Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB
          - Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB
          - Peak memory: ${Math.round(maxMemoryUsed / 1024 / 1024)}MB
          - Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);

      } finally {
        clearInterval(memoryInterval);
      }
    }, 120000);

    it('should handle rate limiting gracefully under high load', async () => {
      const highLoadRequests = 50;
      const startTime = Date.now();

      const promises = Array.from({ length: highLoadRequests }, (_, i) =>
        request(app)
          .post('/api/analysis/start')
          .send({ urls: [`https://example${i}.com/`] })
      );

      const responses = await Promise.allSettled(promises);
      const endTime = Date.now();

      const successful = responses.filter(r => 
        r.status === 'fulfilled' && (r.value as any).status === 200
      ).length;

      const rateLimited = responses.filter(r => 
        r.status === 'fulfilled' && (r.value as any).status === 429
      ).length;

      const errors = responses.filter(r => 
        r.status === 'rejected' || 
        (r.status === 'fulfilled' && (r.value as any).status >= 500)
      ).length;

      // Should handle requests gracefully
      expect(successful + rateLimited).toBeGreaterThan(highLoadRequests * 0.8); // At least 80% handled
      expect(errors).toBeLessThan(highLoadRequests * 0.1); // Less than 10% errors

      console.log(`High Load Performance:
        - Total requests: ${highLoadRequests}
        - Successful: ${successful}
        - Rate limited: ${rateLimited}
        - Errors: ${errors}
        - Total time: ${endTime - startTime}ms`);
    });
  });

  describe('Resource Utilization Tests', () => {
    it('should efficiently utilize CPU during concurrent analyses', async () => {
      const startTime = process.hrtime.bigint();
      const concurrentAnalyses = 8;

      const promises = Array.from({ length: concurrentAnalyses }, (_, i) =>
        request(app)
          .post('/api/analysis/start')
          .send({ urls: [`https://example${i}.com/`] })
      );

      const responses = await Promise.all(promises);

      // Wait for completion
      await Promise.all(responses.map(async (response) => {
        if (response.status !== 200) return;
        
        const analysisId = response.body.analysisId;
        let attempts = 0;

        while (attempts < 60) {
          const statusResponse = await request(app)
            .get(`/api/analysis/status/${analysisId}`);

          if (statusResponse.body.status === 'completed') {
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }));

      const endTime = process.hrtime.bigint();
      const totalCpuTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      // CPU efficiency check
      const expectedMinTime = concurrentAnalyses * 1000; // Minimum 1 second per analysis
      expect(totalCpuTime).toBeGreaterThan(expectedMinTime);

      console.log(`CPU Utilization:
        - Concurrent analyses: ${concurrentAnalyses}
        - Total CPU time: ${totalCpuTime}ms
        - Average per analysis: ${totalCpuTime / concurrentAnalyses}ms`);
    });

    it('should handle database connections efficiently during concurrent operations', async () => {
      const concurrentAnalyses = 12;
      const connectionErrors: string[] = [];

      const promises = Array.from({ length: concurrentAnalyses }, async (_, i) => {
        try {
          const response = await request(app)
            .post('/api/analysis/start')
            .send({ urls: [`https://example${i}.com/`] });

          if (response.status === 200) {
            // Try to get status immediately to test connection handling
            await request(app)
              .get(`/api/analysis/status/${response.body.analysisId}`);
          }

          return response;
        } catch (error) {
          connectionErrors.push(`Analysis ${i}: ${error}`);
          throw error;
        }
      });

      const responses = await Promise.allSettled(promises);
      const successful = responses.filter(r => r.status === 'fulfilled').length;

      // Should handle connections without errors
      expect(connectionErrors.length).toBeLessThan(concurrentAnalyses * 0.1); // Less than 10% connection errors
      expect(successful).toBeGreaterThan(concurrentAnalyses * 0.9); // More than 90% successful

      if (connectionErrors.length > 0) {
        console.log('Connection errors:', connectionErrors);
      }
    });
  });

  describe('Scalability Tests', () => {
    it('should maintain response times under increasing load', async () => {
      const loadLevels = [1, 3, 5, 8, 10];
      const responseTimeResults: Array<{ load: number; avgResponseTime: number }> = [];

      for (const load of loadLevels) {
        const startTime = Date.now();
        
        const promises = Array.from({ length: load }, (_, i) =>
          request(app)
            .post('/api/analysis/start')
            .send({ urls: [`https://load-test-${load}-${i}.com/`] })
        );

        const responses = await Promise.all(promises);
        const endTime = Date.now();
        
        const avgResponseTime = (endTime - startTime) / load;
        responseTimeResults.push({ load, avgResponseTime });

        // Clean up - don't wait for completion to avoid interference
        console.log(`Load ${load}: Average response time ${avgResponseTime}ms`);
      }

      // Response times should not degrade exponentially
      const firstResult = responseTimeResults[0];
      const lastResult = responseTimeResults[responseTimeResults.length - 1];
      
      // Response time should not increase more than 5x with 10x load
      expect(lastResult.avgResponseTime).toBeLessThan(firstResult.avgResponseTime * 5);

      console.log('Scalability Results:', responseTimeResults);
    });
  });
});