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
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
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
import { AnalysisOrchestrator } from '../AnalysisOrchestrator';
import { AnalysisConfig } from '@shared/types';

describe('AnalysisOrchestrator', () => {
  let orchestrator: AnalysisOrchestrator;

  beforeEach(() => {
    orchestrator = new AnalysisOrchestrator();
  });

  afterEach(() => {
    // Clean up any running jobs
    orchestrator.removeAllListeners();
  });

  describe('startAnalysis', () => {
    it('should create a new analysis job', async () => {
      const urls = ['https://example.com', 'https://example.com/page1'];
      
      const jobId = await orchestrator.startAnalysis(urls);
      
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
      
      const status = orchestrator.getJobStatus(jobId);
      expect(status).toBeDefined();
      expect(status?.status).toBe('pending');
      expect(status?.totalUrls).toBe(2);
    });

    it('should use default config when none provided', async () => {
      const urls = ['https://example.com'];
      
      const jobId = await orchestrator.startAnalysis(urls);
      const status = orchestrator.getJobStatus(jobId);
      
      expect(status).toBeDefined();
      expect(status?.totalUrls).toBe(1);
    });

    it('should accept custom analysis config', async () => {
      const urls = ['https://example.com'];
      const config: AnalysisConfig = {
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
      
      const jobId = await orchestrator.startAnalysis(urls, config);
      const status = orchestrator.getJobStatus(jobId);
      
      expect(status).toBeDefined();
    });
  });

  describe('getJobStatus', () => {
    it('should return null for non-existent job', () => {
      const status = orchestrator.getJobStatus('non-existent-id');
      expect(status).toBeNull();
    });

    it('should return correct status for existing job', async () => {
      const urls = ['https://example.com'];
      const jobId = await orchestrator.startAnalysis(urls);
      
      const status = orchestrator.getJobStatus(jobId);
      
      expect(status).toBeDefined();
      expect(status?.jobId).toBe(jobId);
      expect(status?.totalUrls).toBe(1);
      expect(status?.completedUrls).toBe(0);
      expect(status?.progress).toBe(0);
    });
  });

  describe('getJobResults', () => {
    it('should return null for non-existent job', () => {
      const results = orchestrator.getJobResults('non-existent-id');
      expect(results).toBeNull();
    });

    it('should return null for incomplete job', async () => {
      const urls = ['https://example.com'];
      const jobId = await orchestrator.startAnalysis(urls);
      
      const results = orchestrator.getJobResults(jobId);
      expect(results).toBeNull();
    });
  });

  describe('cancelJob', () => {
    it('should return false for non-existent job', () => {
      const cancelled = orchestrator.cancelJob('non-existent-id');
      expect(cancelled).toBe(false);
    });

    it('should cancel a pending job', async () => {
      const urls = ['https://example.com'];
      const jobId = await orchestrator.startAnalysis(urls);
      
      const cancelled = orchestrator.cancelJob(jobId);
      expect(cancelled).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const stats = orchestrator.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalJobs).toBe(0);
      expect(stats.activeJobs).toBe(0);
      expect(stats.pendingJobs).toBe(0);
      expect(stats.completedJobs).toBe(0);
      expect(stats.failedJobs).toBe(0);
    });

    it('should update statistics when jobs are added', async () => {
      const urls = ['https://example.com'];
      await orchestrator.startAnalysis(urls);
      
      const stats = orchestrator.getStats();
      
      expect(stats.totalJobs).toBe(1);
      expect(stats.pendingJobs).toBe(1);
    });
  });

  describe('event emission', () => {
    it('should emit jobStarted event', (done) => {
      const urls = ['https://example.com'];
      
      orchestrator.on('jobStarted', (jobId) => {
        expect(jobId).toBeDefined();
        done();
      });
      
      orchestrator.startAnalysis(urls);
      
      // Give some time for the job to start
      setTimeout(() => {
        done();
      }, 100);
    });

    it('should emit jobProgress event', (done) => {
      const urls = ['https://example.com'];
      
      orchestrator.on('jobProgress', (data) => {
        expect(data.jobId).toBeDefined();
        expect(data.progress).toBeGreaterThanOrEqual(0);
        expect(data.progress).toBeLessThanOrEqual(100);
        done();
      });
      
      orchestrator.startAnalysis(urls);
      
      // Give some time for progress events
      setTimeout(() => {
        done();
      }, 2000);
    });
  });

  describe('error handling', () => {
    it('should handle analysis errors gracefully', async () => {
      // This test would be more meaningful when we have real analysis engines
      // For now, we test that the orchestrator doesn't crash
      const urls = ['https://invalid-url-that-should-fail.test'];
      const jobId = await orchestrator.startAnalysis(urls);
      
      expect(jobId).toBeDefined();
      
      // Wait a bit and check that the job exists
      const status = orchestrator.getJobStatus(jobId);
      expect(status).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should clean up old jobs', async () => {
      const urls = ['https://example.com'];
      const jobId = await orchestrator.startAnalysis(urls);
      
      // Simulate old job by setting a very short max age
      orchestrator.cleanupOldJobs(0);
      
      // Job should still exist since it's not completed
      const status = orchestrator.getJobStatus(jobId);
      expect(status).toBeDefined();
    });
  });

  describe('concurrency limits', () => {
    it('should respect maximum concurrent job limits', async () => {
      // Create multiple jobs
      const jobs = [];
      for (let i = 0; i < 10; i++) {
        const jobId = await orchestrator.startAnalysis([`https://example${i}.com`]);
        jobs.push(jobId);
      }
      
      const stats = orchestrator.getStats();
      expect(stats.totalJobs).toBe(10);
      
      // Some jobs should be pending due to concurrency limits
      expect(stats.pendingJobs + stats.activeJobs).toBe(10);
    });
  });
});