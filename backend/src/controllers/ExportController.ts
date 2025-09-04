import { Request, Response } from 'express';
import { ReportGenerator, ReportOptions } from '../services/ReportGenerator';
import { ResultsAggregator } from '../services/ResultsAggregator';
import { ExportRequest, ExportResponse } from '../../../shared/types';
import { logger } from '../utils/logger';
import path from 'path';

/**
 * ExportController handles HTTP requests for generating and downloading analysis reports
 * Supports PDF, CSV, and JSON export formats with customizable options
 */
export class ExportController {
  private reportGenerator: ReportGenerator;
  private resultsAggregator: ResultsAggregator;

  constructor(
    reportGenerator?: ReportGenerator,
    resultsAggregator?: ResultsAggregator
  ) {
    this.reportGenerator = reportGenerator || new ReportGenerator();
    this.resultsAggregator = resultsAggregator || new ResultsAggregator();
  }

  /**
   * Generates a report in the specified format
   * POST /api/export
   */
  async generateReport(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Export request received', { 
        format: req.body.format,
        resultCount: req.body.results?.length 
      });

      const exportRequest: ExportRequest = req.body;
      
      // Validate request
      const validation = this.validateExportRequest(exportRequest);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: validation.error
        });
        return;
      }

      // Prepare report options
      const options: ReportOptions = {
        includeDetails: exportRequest.includeDetails,
        customNotes: exportRequest.customNotes,
        branding: exportRequest.branding
      };

      // Generate report based on format
      let result;
      switch (exportRequest.format) {
        case 'pdf':
          result = await this.reportGenerator.generatePDFReport(exportRequest.results, options);
          break;
        case 'csv':
          result = await this.reportGenerator.generateCSVReport(exportRequest.results, options);
          break;
        case 'json':
          result = await this.reportGenerator.generateJSONReport(exportRequest.results, options);
          break;
        default:
          res.status(400).json({
            success: false,
            error: `Unsupported format: ${exportRequest.format}`
          });
          return;
      }

      if (result.success) {
        logger.info('Report generated successfully', {
          format: exportRequest.format,
          filePath: result.filePath,
          fileSize: result.metadata?.fileSize
        });

        const response: ExportResponse = {
          success: true,
          filePath: result.filePath,
          downloadUrl: `/api/export/download/${path.basename(result.filePath!)}`,
          metadata: result.metadata
        };

        res.json(response);
      } else {
        logger.error('Report generation failed', { error: result.error });
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('Export controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generates reports in multiple formats
   * POST /api/export/multi
   */
  async generateMultiFormatReport(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Multi-format export request received', {
        formats: req.body.formats,
        resultCount: req.body.results?.length
      });

      const { formats, results, includeDetails, customNotes, branding } = req.body;

      // Validate request
      if (!Array.isArray(formats) || formats.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Formats array is required and must not be empty'
        });
        return;
      }

      if (!Array.isArray(results) || results.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Results array is required and must not be empty'
        });
        return;
      }

      // Validate formats
      const validFormats = ['pdf', 'csv', 'json'];
      const invalidFormats = formats.filter((f: string) => !validFormats.includes(f));
      if (invalidFormats.length > 0) {
        res.status(400).json({
          success: false,
          error: `Invalid formats: ${invalidFormats.join(', ')}`
        });
        return;
      }

      const options: ReportOptions = {
        includeDetails: includeDetails ?? true,
        customNotes,
        branding
      };

      const exportResults = await this.reportGenerator.generateMultiFormatReport(
        results,
        formats,
        options
      );

      const responses = exportResults.map(result => ({
        success: result.success,
        filePath: result.filePath,
        downloadUrl: result.filePath ? `/api/export/download/${path.basename(result.filePath)}` : undefined,
        error: result.error,
        metadata: result.metadata
      }));

      logger.info('Multi-format report generation completed', {
        totalFormats: formats.length,
        successCount: responses.filter(r => r.success).length
      });

      res.json({
        success: true,
        results: responses
      });
    } catch (error) {
      logger.error('Multi-format export controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Downloads a generated report file
   * GET /api/export/download/:filename
   */
  async downloadReport(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      
      logger.info('Download request received', { filename });

      // Validate filename to prevent directory traversal
      if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        res.status(400).json({
          success: false,
          error: 'Invalid filename'
        });
        return;
      }

      const filePath = path.join('./reports', filename);
      
      // Set appropriate headers based on file extension
      const ext = path.extname(filename).toLowerCase();
      let contentType = 'application/octet-stream';
      let disposition = 'attachment';

      switch (ext) {
        case '.pdf':
          contentType = 'application/pdf';
          break;
        case '.csv':
          contentType = 'text/csv';
          break;
        case '.json':
          contentType = 'application/json';
          break;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);

      // Send file
      res.sendFile(path.resolve(filePath), (err) => {
        if (err) {
          logger.error('File download error:', err);
          if (!res.headersSent) {
            res.status(404).json({
              success: false,
              error: 'File not found'
            });
          }
        } else {
          logger.info('File downloaded successfully', { filename });
        }
      });
    } catch (error) {
      logger.error('Download controller error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Exports results by result IDs
   * POST /api/export/by-ids
   */
  async exportByIds(req: Request, res: Response): Promise<void> {
    try {
      const { ids, format, includeDetails, customNotes, branding } = req.body;

      logger.info('Export by IDs request received', {
        format,
        idCount: ids?.length
      });

      // Validate request
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          success: false,
          error: 'IDs array is required and must not be empty'
        });
        return;
      }

      if (!format || !['pdf', 'csv', 'json'].includes(format)) {
        res.status(400).json({
          success: false,
          error: 'Valid format is required (pdf, csv, json)'
        });
        return;
      }

      // Retrieve results by IDs
      const results = [];
      for (const id of ids) {
        const result = await this.resultsAggregator.getResultById(id);
        if (result) {
          results.push(result);
        }
      }

      if (results.length === 0) {
        res.status(404).json({
          success: false,
          error: 'No results found for the provided IDs'
        });
        return;
      }

      // Generate export
      const exportRequest: ExportRequest = {
        format,
        results,
        includeDetails: includeDetails ?? true,
        customNotes,
        branding
      };

      // Reuse the generateReport logic
      req.body = exportRequest;
      await this.generateReport(req, res);
    } catch (error) {
      logger.error('Export by IDs controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Lists available report files
   * GET /api/export/list
   */
  async listReports(req: Request, res: Response): Promise<void> {
    try {
      logger.info('List reports request received');

      const fs = require('fs').promises;
      const reportsDir = './reports';

      try {
        const files = await fs.readdir(reportsDir);
        const reportFiles = [];

        for (const file of files) {
          const filePath = path.join(reportsDir, file);
          const stats = await fs.stat(filePath);
          
          reportFiles.push({
            filename: file,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            format: path.extname(file).substring(1).toUpperCase(),
            downloadUrl: `/api/export/download/${file}`
          });
        }

        // Sort by creation date (newest first)
        reportFiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        logger.info('Report list retrieved', { count: reportFiles.length });

        res.json({
          success: true,
          reports: reportFiles
        });
      } catch (dirError) {
        logger.warn('Reports directory not found or empty');
        res.json({
          success: true,
          reports: []
        });
      }
    } catch (error) {
      logger.error('List reports controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Cleans up old report files
   * DELETE /api/export/cleanup
   */
  async cleanupReports(req: Request, res: Response): Promise<void> {
    try {
      const { daysOld = 30 } = req.query;
      
      logger.info('Cleanup reports request received', { daysOld });

      await this.reportGenerator.cleanupOldReports(Number(daysOld));

      res.json({
        success: true,
        message: `Cleaned up reports older than ${daysOld} days`
      });
    } catch (error) {
      logger.error('Cleanup reports controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Private helper methods

  private validateExportRequest(request: ExportRequest): { valid: boolean; error?: string } {
    if (!request.format) {
      return { valid: false, error: 'Format is required' };
    }

    if (!['pdf', 'csv', 'json'].includes(request.format)) {
      return { valid: false, error: 'Invalid format. Must be pdf, csv, or json' };
    }

    if (!Array.isArray(request.results) || request.results.length === 0) {
      return { valid: false, error: 'Results array is required and must not be empty' };
    }

    // Validate each result has required fields
    for (let i = 0; i < request.results.length; i++) {
      const result = request.results[i];
      if (!result.url || !result.overallScore || !result.seoScore || !result.geoScore) {
        return { 
          valid: false, 
          error: `Invalid result at index ${i}: missing required fields` 
        };
      }
    }

    return { valid: true };
  }
}