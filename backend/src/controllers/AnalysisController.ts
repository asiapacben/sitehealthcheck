import { Request, Response } from 'express';
import { AnalysisOrchestrator } from '../services/AnalysisOrchestrator';
import { URLValidationServiceImpl } from '../services/URLValidationService';
import { logger } from '../utils/logger';
import { AnalysisRequest, AnalysisConfig } from '@shared/types';

// Singleton instances
const analysisOrchestrator = new AnalysisOrchestrator();
const urlValidationService = new URLValidationServiceImpl();

export class AnalysisController {
  /**
   * Starts a new analysis job
   * POST /api/analysis/start
   */
  static async startAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { urls, config }: AnalysisRequest = req.body;

      logger.info('Starting analysis request', {
        urlCount: urls.length,
        hasCustomConfig: !!config
      });

      // Validate URLs first
      const validationResult = urlValidationService.validateURLs(urls);
      
      if (!validationResult.valid) {
        res.status(400).json({
          success: false,
          error: 'URL validation failed',
          details: validationResult.errors
        });
        return;
      }

      // Start analysis job - merge partial config with defaults if provided
      const finalConfig = config ? 
        { ...analysisOrchestrator.getDefaultConfig(), ...config } : 
        analysisOrchestrator.getDefaultConfig();
        
      const jobId = await analysisOrchestrator.startAnalysis(
        validationResult.normalizedUrls,
        finalConfig
      );

      logger.info('Analysis job started', {
        jobId,
        urlCount: validationResult.normalizedUrls.length,
        domain: urlValidationService.normalizeDomain(validationResult.normalizedUrls[0])
      });

      res.json({
        success: true,
        data: {
          jobId,
          status: 'pending',
          urlCount: validationResult.normalizedUrls.length,
          estimatedDuration: validationResult.normalizedUrls.length * 10 // rough estimate in seconds
        }
      });

    } catch (error) {
      logger.error('Error starting analysis:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to start analysis'
      });
    }
  }

  /**
   * Gets the status of an analysis job
   * GET /api/analysis/status/:jobId
   */
  static async getAnalysisStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        res.status(400).json({
          success: false,
          error: 'Job ID is required'
        });
        return;
      }

      const status = analysisOrchestrator.getJobStatus(jobId);

      if (!status) {
        res.status(404).json({
          success: false,
          error: 'Job not found',
          message: `Analysis job with ID ${jobId} not found`
        });
        return;
      }

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      logger.error('Error getting analysis status:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get analysis status'
      });
    }
  }

  /**
   * Gets the results of a completed analysis job
   * GET /api/analysis/results/:jobId
   */
  static async getAnalysisResults(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        res.status(400).json({
          success: false,
          error: 'Job ID is required'
        });
        return;
      }

      const results = analysisOrchestrator.getJobResults(jobId);

      if (!results) {
        const status = analysisOrchestrator.getJobStatus(jobId);
        
        if (!status) {
          res.status(404).json({
            success: false,
            error: 'Job not found',
            message: `Analysis job with ID ${jobId} not found`
          });
          return;
        }

        if (status.status !== 'completed') {
          res.status(400).json({
            success: false,
            error: 'Job not completed',
            message: `Analysis job is still ${status.status}`,
            data: { status: status.status, progress: status.progress }
          });
          return;
        }
      }

      logger.info('Analysis results retrieved', {
        jobId,
        resultCount: results?.length || 0
      });

      res.json({
        success: true,
        data: {
          jobId,
          results: results || [],
          summary: {
            totalUrls: results?.length || 0,
            averageScore: results && results.length > 0 
              ? Math.round(results.reduce((sum, r) => sum + r.overallScore, 0) / results.length)
              : 0
          }
        }
      });

    } catch (error) {
      logger.error('Error getting analysis results:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get analysis results'
      });
    }
  }

  /**
   * Cancels a running analysis job
   * POST /api/analysis/cancel/:jobId
   */
  static async cancelAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        res.status(400).json({
          success: false,
          error: 'Job ID is required'
        });
        return;
      }

      const cancelled = analysisOrchestrator.cancelJob(jobId);

      if (!cancelled) {
        res.status(404).json({
          success: false,
          error: 'Job not found or cannot be cancelled',
          message: `Analysis job with ID ${jobId} not found or not in a cancellable state`
        });
        return;
      }

      logger.info('Analysis job cancelled', { jobId });

      res.json({
        success: true,
        data: {
          jobId,
          status: 'cancelled'
        }
      });

    } catch (error) {
      logger.error('Error cancelling analysis:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to cancel analysis'
      });
    }
  }

  /**
   * Gets orchestrator statistics
   * GET /api/analysis/stats
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = analysisOrchestrator.getStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error getting analysis stats:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get analysis statistics'
      });
    }
  }

  /**
   * WebSocket endpoint for real-time job updates
   */
  static setupWebSocketHandlers(io: any): void {
    analysisOrchestrator.on('jobStarted', (jobId: string) => {
      io.emit('jobStarted', { jobId });
    });

    analysisOrchestrator.on('jobProgress', (data: any) => {
      io.emit('jobProgress', data);
    });

    analysisOrchestrator.on('jobCompleted', (jobId: string) => {
      io.emit('jobCompleted', { jobId });
    });

    analysisOrchestrator.on('jobFailed', (jobId: string) => {
      io.emit('jobFailed', { jobId });
    });

    analysisOrchestrator.on('jobCancelled', (jobId: string) => {
      io.emit('jobCancelled', { jobId });
    });

    logger.info('WebSocket handlers set up for analysis orchestrator');
  }

  /**
   * Cleanup old jobs (can be called periodically)
   */
  static cleanupOldJobs(): void {
    analysisOrchestrator.cleanupOldJobs();
    logger.info('Old analysis jobs cleaned up');
  }
}