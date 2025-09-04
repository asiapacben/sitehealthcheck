import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { APIKeyManager } from '../APIKeyManager';

// Mock environment variables
const originalEnv = process.env;

describe('APIKeyManager', () => {
  let apiKeyManager: APIKeyManager;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    apiKeyManager = new APIKeyManager();
  });

  afterEach(() => {
    process.env = originalEnv;
    apiKeyManager.shutdown();
  });

  describe('initialization', () => {
    it('should initialize with environment variables', () => {
      process.env.GOOGLE_PAGESPEED_API_KEY = 'key1,key2,key3';
      
      const manager = new APIKeyManager();
      const stats = manager.getStats('google-pagespeed');
      
      expect(stats).toBeDefined();
      expect(stats?.totalKeys).toBe(3);
      expect(stats?.currentKeyIndex).toBe(0);
      
      manager.shutdown();
    });

    it('should handle missing environment variables gracefully', () => {
      delete process.env.GOOGLE_PAGESPEED_API_KEY;
      
      const manager = new APIKeyManager();
      const stats = manager.getStats('google-pagespeed');
      
      expect(stats).toBeNull();
      
      manager.shutdown();
    });

    it('should parse comma-separated API keys correctly', () => {
      process.env.GOOGLE_PAGESPEED_API_KEY = 'key1, key2 , key3,';
      
      const manager = new APIKeyManager();
      const stats = manager.getStats('google-pagespeed');
      
      expect(stats?.totalKeys).toBe(3);
      
      manager.shutdown();
    });
  });

  describe('addService', () => {
    it('should add a new service with configuration', () => {
      apiKeyManager.addService({
        service: 'test-service',
        keys: ['key1', 'key2'],
        rotationIntervalMs: 1000,
        maxFailuresBeforeRotation: 3
      });

      const stats = apiKeyManager.getStats('test-service');
      expect(stats).toBeDefined();
      expect(stats?.totalKeys).toBe(2);
      expect(stats?.healthyKeys).toBe(2);
    });

    it('should use default configuration values', () => {
      apiKeyManager.addService({
        service: 'test-service',
        keys: ['key1']
      });

      const stats = apiKeyManager.getStats('test-service');
      expect(stats).toBeDefined();
      expect(stats?.totalKeys).toBe(1);
    });
  });

  describe('getCurrentKey', () => {
    beforeEach(() => {
      apiKeyManager.addService({
        service: 'test-service',
        keys: ['key1', 'key2', 'key3'],
        maxFailuresBeforeRotation: 2
      });
    });

    it('should return the current key', () => {
      const key = apiKeyManager.getCurrentKey('test-service');
      expect(key).toBe('key1');
    });

    it('should return null for non-existent service', () => {
      const key = apiKeyManager.getCurrentKey('non-existent');
      expect(key).toBeNull();
    });

    it('should increment usage count', () => {
      apiKeyManager.getCurrentKey('test-service');
      apiKeyManager.getCurrentKey('test-service');
      
      const stats = apiKeyManager.getStats('test-service');
      expect(stats?.keyUsageCount[0]).toBe(2);
    });

    it('should switch to healthy key when current key is unhealthy', () => {
      // Mark first key as unhealthy by reporting failures
      apiKeyManager.reportKeyFailure('test-service', 'key1');
      apiKeyManager.reportKeyFailure('test-service', 'key1');
      
      const key = apiKeyManager.getCurrentKey('test-service');
      expect(key).toBe('key2'); // Should switch to next healthy key
    });
  });

  describe('reportKeyFailure', () => {
    beforeEach(() => {
      apiKeyManager.addService({
        service: 'test-service',
        keys: ['key1', 'key2', 'key3'],
        maxFailuresBeforeRotation: 2
      });
    });

    it('should increment failure count', () => {
      apiKeyManager.reportKeyFailure('test-service', 'key1');
      
      const stats = apiKeyManager.getStats('test-service');
      expect(stats?.keyFailureCount[0]).toBe(1);
    });

    it('should mark key as unhealthy after max failures', () => {
      apiKeyManager.reportKeyFailure('test-service', 'key1');
      apiKeyManager.reportKeyFailure('test-service', 'key1');
      
      const stats = apiKeyManager.getStats('test-service');
      expect(stats?.healthyKeys).toBe(2); // One key should be marked unhealthy
    });

    it('should rotate key when current key fails', () => {
      const initialKey = apiKeyManager.getCurrentKey('test-service');
      expect(initialKey).toBe('key1');
      
      apiKeyManager.reportKeyFailure('test-service', 'key1');
      
      const newKey = apiKeyManager.getCurrentKey('test-service');
      expect(newKey).toBe('key2'); // Should rotate to next key
    });

    it('should reset all keys to healthy when no healthy keys remain', () => {
      // Mark all keys as unhealthy
      ['key1', 'key2', 'key3'].forEach(key => {
        apiKeyManager.reportKeyFailure('test-service', key);
        apiKeyManager.reportKeyFailure('test-service', key);
      });
      
      const stats = apiKeyManager.getStats('test-service');
      expect(stats?.healthyKeys).toBe(3); // Should reset all to healthy
    });
  });

  describe('rotateKey', () => {
    beforeEach(() => {
      apiKeyManager.addService({
        service: 'test-service',
        keys: ['key1', 'key2', 'key3']
      });
    });

    it('should rotate to next key', () => {
      const rotated = apiKeyManager.rotateKey('test-service');
      expect(rotated).toBe(true);
      
      const key = apiKeyManager.getCurrentKey('test-service');
      expect(key).toBe('key2');
    });

    it('should wrap around to first key', () => {
      // Rotate to last key
      apiKeyManager.rotateKey('test-service'); // key2
      apiKeyManager.rotateKey('test-service'); // key3
      apiKeyManager.rotateKey('test-service'); // key1 (wrap around)
      
      const key = apiKeyManager.getCurrentKey('test-service');
      expect(key).toBe('key1');
    });

    it('should skip unhealthy keys', () => {
      // Start with key1 (index 0)
      expect(apiKeyManager.getCurrentKey('test-service')).toBe('key1');
      
      // Manually mark key2 as unhealthy by directly manipulating the healthy keys set
      // This simulates a key being marked unhealthy through health checks rather than failures
      const healthyKeys = new Set([0, 2]); // key1 and key3 are healthy, key2 is not
      const currentHealthyKeys = apiKeyManager['healthyKeys'];
      currentHealthyKeys.set('test-service', healthyKeys);
      
      // Rotate from key1 (index 0) - should skip key2 (index 1) and go to key3 (index 2)
      const rotated = apiKeyManager.rotateKey('test-service');
      expect(rotated).toBe(true);
      
      const key = apiKeyManager.getCurrentKey('test-service');
      expect(key).toBe('key3'); // Should skip unhealthy key2
    });

    it('should return false for non-existent service', () => {
      const rotated = apiKeyManager.rotateKey('non-existent');
      expect(rotated).toBe(false);
    });
  });

  describe('performHealthCheck', () => {
    beforeEach(() => {
      apiKeyManager.addService({
        service: 'test-service',
        keys: ['key1', 'key2', 'key3']
      });
    });

    it('should perform health check for all keys', async () => {
      const healthCheckFn = jest.fn()
        .mockResolvedValueOnce(true)  // key1 healthy
        .mockResolvedValueOnce(false) // key2 unhealthy
        .mockResolvedValueOnce(true); // key3 healthy

      await apiKeyManager.performHealthCheck('test-service', healthCheckFn);
      
      expect(healthCheckFn).toHaveBeenCalledTimes(3);
      
      const stats = apiKeyManager.getStats('test-service');
      expect(stats?.healthyKeys).toBe(2); // key1 and key3 should be healthy
    });

    it('should handle health check failures', async () => {
      const healthCheckFn = jest.fn()
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Health check failed'))
        .mockResolvedValueOnce(true);

      await apiKeyManager.performHealthCheck('test-service', healthCheckFn);
      
      const stats = apiKeyManager.getStats('test-service');
      expect(stats?.healthyKeys).toBe(2); // Failed health check should mark key as unhealthy
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      apiKeyManager.addService({
        service: 'test-service',
        keys: ['key1', 'key2']
      });
    });

    it('should return comprehensive statistics', () => {
      apiKeyManager.getCurrentKey('test-service');
      apiKeyManager.reportKeyFailure('test-service', 'key1');
      
      const stats = apiKeyManager.getStats('test-service');
      
      expect(stats).toBeDefined();
      expect(stats?.service).toBe('test-service');
      expect(stats?.totalKeys).toBe(2);
      expect(stats?.keyUsageCount[0]).toBe(1);
      expect(stats?.keyFailureCount[0]).toBe(1);
      expect(stats?.lastRotation).toBeInstanceOf(Date);
    });

    it('should return null for non-existent service', () => {
      const stats = apiKeyManager.getStats('non-existent');
      expect(stats).toBeNull();
    });
  });

  describe('getAllStats', () => {
    it('should return stats for all services', () => {
      apiKeyManager.addService({
        service: 'service1',
        keys: ['key1']
      });
      
      apiKeyManager.addService({
        service: 'service2',
        keys: ['key2', 'key3']
      });
      
      const allStats = apiKeyManager.getAllStats();
      
      expect(Object.keys(allStats)).toHaveLength(2);
      expect(allStats['service1']).toBeDefined();
      expect(allStats['service2']).toBeDefined();
    });

    it('should return empty object when no services exist', () => {
      const allStats = apiKeyManager.getAllStats();
      expect(allStats).toEqual({});
    });
  });

  describe('removeService', () => {
    it('should remove service and clean up resources', () => {
      apiKeyManager.addService({
        service: 'test-service',
        keys: ['key1']
      });
      
      expect(apiKeyManager.getStats('test-service')).toBeDefined();
      
      apiKeyManager.removeService('test-service');
      
      expect(apiKeyManager.getStats('test-service')).toBeNull();
    });
  });

  describe('automatic rotation', () => {
    it('should set up automatic rotation timer', (done) => {
      apiKeyManager.addService({
        service: 'test-service',
        keys: ['key1', 'key2'],
        rotationIntervalMs: 100 // Short interval for testing
      });
      
      const initialKey = apiKeyManager.getCurrentKey('test-service');
      expect(initialKey).toBe('key1');
      
      // Wait for automatic rotation
      setTimeout(() => {
        const rotatedKey = apiKeyManager.getCurrentKey('test-service');
        expect(rotatedKey).toBe('key2');
        done();
      }, 150);
    });
  });

  describe('edge cases', () => {
    it('should handle service with single key', () => {
      apiKeyManager.addService({
        service: 'single-key-service',
        keys: ['only-key']
      });
      
      const key1 = apiKeyManager.getCurrentKey('single-key-service');
      expect(key1).toBe('only-key');
      
      apiKeyManager.rotateKey('single-key-service');
      
      const key2 = apiKeyManager.getCurrentKey('single-key-service');
      expect(key2).toBe('only-key'); // Should stay the same
    });

    it('should handle empty key array', () => {
      expect(() => {
        apiKeyManager.addService({
          service: 'empty-service',
          keys: []
        });
      }).not.toThrow();
      
      const key = apiKeyManager.getCurrentKey('empty-service');
      expect(key).toBeNull();
    });
  });
});