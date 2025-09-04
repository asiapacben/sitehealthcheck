import { APIRateLimiter } from '../APIRateLimiter';

describe('APIRateLimiter', () => {
  let rateLimiter: APIRateLimiter;

  beforeEach(() => {
    rateLimiter = new APIRateLimiter({
      requestsPerInterval: 5,
      intervalMs: 1000,
      maxConcurrent: 2
    });
  });

  afterEach(() => {
    rateLimiter.reset();
    rateLimiter.destroy();
  });

  describe('execute', () => {
    it('should execute operations within rate limits immediately', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const startTime = Date.now();
      const result = await rateLimiter.execute(mockOperation);
      const endTime = Date.now();

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(endTime - startTime).toBeLessThan(100); // Should be immediate
    });

    it('should queue operations when rate limit is exceeded', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      // Fill up the rate limit
      const promises = Array(6).fill(null).map(() => 
        rateLimiter.execute(mockOperation)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(6);
      expect(results.every(r => r === 'success')).toBe(true);
      expect(mockOperation).toHaveBeenCalledTimes(6);
    });

    it('should respect concurrency limits', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const mockOperation = jest.fn().mockImplementation(async () => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 100));
        
        concurrentCount--;
        return 'success';
      });

      // Start more operations than the concurrency limit
      const promises = Array(5).fill(null).map(() => 
        rateLimiter.execute(mockOperation)
      );

      await Promise.all(promises);
      
      expect(maxConcurrent).toBeLessThanOrEqual(2); // Should not exceed maxConcurrent
    });

    it('should handle operation failures correctly', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      
      await expect(rateLimiter.execute(mockOperation)).rejects.toThrow('Operation failed');
      
      const stats = rateLimiter.getStats();
      expect(stats.failedRequests).toBe(1);
      expect(stats.successfulRequests).toBe(0);
    });

    it('should update statistics correctly', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      await rateLimiter.execute(mockOperation);
      await rateLimiter.execute(mockOperation);
      
      const stats = rateLimiter.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.successfulRequests).toBe(2);
      expect(stats.failedRequests).toBe(0);
    });
  });

  describe('getRemainingRequests', () => {
    it('should return correct remaining request count', () => {
      expect(rateLimiter.getRemainingRequests()).toBe(5);
      
      // Execute one operation
      rateLimiter.execute(jest.fn().mockResolvedValue('success'));
      
      expect(rateLimiter.getRemainingRequests()).toBe(4);
    });

    it('should reset remaining requests after interval', async () => {
      // Use a shorter interval for testing
      const shortRateLimiter = new APIRateLimiter({
        requestsPerInterval: 2,
        intervalMs: 100,
        maxConcurrent: 5
      });

      // Fill up the rate limit
      await shortRateLimiter.execute(jest.fn().mockResolvedValue('success'));
      await shortRateLimiter.execute(jest.fn().mockResolvedValue('success'));
      
      expect(shortRateLimiter.getRemainingRequests()).toBe(0);
      
      // Wait for interval to pass
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(shortRateLimiter.getRemainingRequests()).toBe(2);
      
      shortRateLimiter.destroy();
    });
  });

  describe('executeBurst', () => {
    it('should handle burst operations correctly', async () => {
      const burstRateLimiter = new APIRateLimiter({
        requestsPerInterval: 3,
        intervalMs: 1000,
        maxConcurrent: 10,
        burstAllowance: 2
      });

      const operations = Array(5).fill(null).map(() => 
        jest.fn().mockResolvedValue('success')
      );

      const results = await burstRateLimiter.executeBurst(operations);
      
      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
      
      burstRateLimiter.destroy();
    });

    it('should handle mixed success and failure in burst', async () => {
      const operations = [
        jest.fn().mockResolvedValue('success'),
        jest.fn().mockRejectedValue(new Error('failed')),
        jest.fn().mockResolvedValue('success')
      ];

      const results = await rateLimiter.executeBurst(operations);
      
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('getEstimatedWaitTime', () => {
    it('should return 0 when requests can be executed immediately', () => {
      expect(rateLimiter.getEstimatedWaitTime()).toBe(0);
    });

    it('should return estimated wait time when rate limited', async () => {
      // Fill up the rate limit
      const promises = Array(5).fill(null).map(() => 
        rateLimiter.execute(jest.fn().mockResolvedValue('success'))
      );

      // This should be queued
      const waitTime = rateLimiter.getEstimatedWaitTime();
      expect(waitTime).toBeGreaterThan(0);

      await Promise.all(promises);
    });
  });

  describe('isHealthy', () => {
    it('should return true for healthy rate limiter', () => {
      expect(rateLimiter.isHealthy()).toBe(true);
    });

    it('should return false when overwhelmed with failures', async () => {
      // Generate many failures
      const failingOperations = Array(10).fill(null).map(() => 
        rateLimiter.execute(jest.fn().mockRejectedValue(new Error('failed')))
      );

      await Promise.allSettled(failingOperations);
      
      // Should be unhealthy due to high failure rate
      expect(rateLimiter.isHealthy()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all statistics and state', async () => {
      // Execute some operations
      await rateLimiter.execute(jest.fn().mockResolvedValue('success'));
      
      try {
        await rateLimiter.execute(jest.fn().mockRejectedValue(new Error('failed')));
      } catch (error) {
        // Expected to fail
      }
      
      expect(rateLimiter.getStats().totalRequests).toBe(2);
      
      rateLimiter.reset();
      
      const stats = rateLimiter.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(rateLimiter.getRemainingRequests()).toBe(5);
    });
  });

  describe('concurrent request handling', () => {
    it('should handle concurrent requests correctly', async () => {
      const concurrentRateLimiter = new APIRateLimiter({
        requestsPerInterval: 10,
        intervalMs: 1000,
        maxConcurrent: 3
      });

      let activeOperations = 0;
      let maxActive = 0;

      const mockOperation = jest.fn().mockImplementation(async () => {
        activeOperations++;
        maxActive = Math.max(maxActive, activeOperations);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        activeOperations--;
        return 'success';
      });

      // Start many concurrent operations
      const promises = Array(8).fill(null).map(() => 
        concurrentRateLimiter.execute(mockOperation)
      );

      await Promise.all(promises);
      
      expect(maxActive).toBeLessThanOrEqual(3);
      expect(mockOperation).toHaveBeenCalledTimes(8);
      
      concurrentRateLimiter.destroy();
    });
  });

  describe('time-based rate limiting', () => {
    it('should allow requests after time window passes', async () => {
      const timeBasedLimiter = new APIRateLimiter({
        requestsPerInterval: 2,
        intervalMs: 200,
        maxConcurrent: 10
      });

      // Fill the initial quota
      await timeBasedLimiter.execute(jest.fn().mockResolvedValue('success'));
      await timeBasedLimiter.execute(jest.fn().mockResolvedValue('success'));
      
      expect(timeBasedLimiter.getRemainingRequests()).toBe(0);
      
      // Wait for time window to pass
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // Should be able to make requests again
      expect(timeBasedLimiter.getRemainingRequests()).toBe(2);
      
      await timeBasedLimiter.execute(jest.fn().mockResolvedValue('success'));
      expect(timeBasedLimiter.getRemainingRequests()).toBe(1);
      
      timeBasedLimiter.destroy();
    });
  });
});