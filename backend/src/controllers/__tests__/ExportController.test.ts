import { Request, Response } from 'express';
import { ExportController } from '../ExportController';
import { ReportGenerator } from '../../services/ReportGenerator';
import { ResultsAggregator } from '../../services/ResultsAggregator';
import { AnalysisResults } from '../../../../shared/types';

// Mock dependencies
jest.mock('../../services/ReportGenerator');
jest.mock('../../services/ResultsAggregator');
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('ExportController', () => {
  let exportController: ExportController;
  let mockReportGenerator: jest.Mocked<ReportGenerator>;
  let mockResultsAggregator: jest.Mocked<ResultsAggregator>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockResults: AnalysisResults[];

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockReportGenerator = {
      generatePDFReport: jest.fn(),
      generateCSVReport: jest.fn(),
      generateJSONReport: jest.fn(),
      generateMultiFormatReport: jest.fn(),
      cleanupOldReports: jest.fn()
    } as any;

    mockResultsAggregator = {
      getResultById: jest.fn(),
      aggregateResults: jest.fn(),
      storeResults: jest.fn(),
      retrieveResults: jest.fn(),
      deleteResults: jest.fn(),
      getSessionResults: jest.fn(),
      storeSession: jest.fn(),
      getStorageStats: jest.fn(),
      clearAll: jest.fn()
    } as any;

    exportController = new ExportController(mockReportGenerator, mockResultsAggregator);

    // Mock sample results
    mockResults = [
      {
        url: 'https://example.com',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        overallScore: 85,
        seoScore: {
          overall: 80,
          technical: 75,
          content: 85,
          structure: 80,
          details: {
            pageSpeed: 70,
            mobileResponsive: true,
            titleTag: { score: 90, issues: [], suggestions: [] },
            metaDescription: { score: 85, issues: [], suggestions: [] },
            headingStructure: { score: 80, issues: [], suggestions: [] },
            internalLinks: 15
          }
        },
        geoScore: {
          overall: 90,
          readability: 85,
          credibility: 95,
          completeness: 88,
          structuredData: 92,
          details: {
            contentClarity: { score: 85, issues: [], suggestions: [] },
            questionAnswerFormat: true,
            authorInformation: true,
            citations: 5,
            schemaMarkup: ['Article']
          }
        },
        recommendations: [],
        technicalDetails: {
          loadTime: 2500,
          pageSize: 1024000,
          requests: 25,
          statusCode: 200,
          redirects: 0
        }
      }
    ];

    // Mock Express request and response
    mockRequest = {
      body: {},
      params: {},
      query: {}
    };

    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      sendFile: jest.fn()
    };
  });

  describe('generateReport', () => {
    it('should generate PDF report successfully', async () => {
      mockRequest.body = {
        format: 'pdf',
        results: mockResults,
        includeDetails: true
      };

      mockReportGenerator.generatePDFReport.mockResolvedValue({
        success: true,
        filePath: './reports/test-report.pdf',
        metadata: {
          format: 'PDF',
          fileSize: 1024,
          generatedAt: new Date()
        }
      });

      await exportController.generateReport(mockRequest as Request, mockResponse as Response);

      expect(mockReportGenerator.generatePDFReport).toHaveBeenCalledWith(
        mockResults,
        expect.objectContaining({
          includeDetails: true
        })
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        filePath: './reports/test-report.pdf',
        downloadUrl: '/api/export/download/test-report.pdf',
        metadata: expect.any(Object)
      });
    });

    it('should generate CSV report successfully', async () => {
      mockRequest.body = {
        format: 'csv',
        results: mockResults,
        includeDetails: false
      };

      mockReportGenerator.generateCSVReport.mockResolvedValue({
        success: true,
        filePath: './reports/test-report.csv',
        metadata: {
          format: 'CSV',
          fileSize: 512,
          generatedAt: new Date()
        }
      });

      await exportController.generateReport(mockRequest as Request, mockResponse as Response);

      expect(mockReportGenerator.generateCSVReport).toHaveBeenCalledWith(
        mockResults,
        expect.objectContaining({
          includeDetails: false
        })
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        filePath: './reports/test-report.csv',
        downloadUrl: '/api/export/download/test-report.csv',
        metadata: expect.any(Object)
      });
    });

    it('should generate JSON report successfully', async () => {
      mockRequest.body = {
        format: 'json',
        results: mockResults,
        includeDetails: true,
        customNotes: 'Test notes'
      };

      mockReportGenerator.generateJSONReport.mockResolvedValue({
        success: true,
        filePath: './reports/test-report.json',
        metadata: {
          format: 'JSON',
          fileSize: 2048,
          generatedAt: new Date()
        }
      });

      await exportController.generateReport(mockRequest as Request, mockResponse as Response);

      expect(mockReportGenerator.generateJSONReport).toHaveBeenCalledWith(
        mockResults,
        expect.objectContaining({
          includeDetails: true,
          customNotes: 'Test notes'
        })
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        filePath: './reports/test-report.json',
        downloadUrl: '/api/export/download/test-report.json',
        metadata: expect.any(Object)
      });
    });

    it('should handle invalid format', async () => {
      mockRequest.body = {
        format: 'xml',
        results: mockResults,
        includeDetails: true
      };

      await exportController.generateReport(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid format. Must be pdf, csv, or json'
      });
    });

    it('should handle missing results', async () => {
      mockRequest.body = {
        format: 'pdf',
        results: [],
        includeDetails: true
      };

      await exportController.generateReport(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Results array is required and must not be empty'
      });
    });

    it('should handle report generation failure', async () => {
      mockRequest.body = {
        format: 'pdf',
        results: mockResults,
        includeDetails: true
      };

      mockReportGenerator.generatePDFReport.mockResolvedValue({
        success: false,
        error: 'PDF generation failed'
      });

      await exportController.generateReport(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'PDF generation failed'
      });
    });

    it('should handle controller errors', async () => {
      mockRequest.body = {
        format: 'pdf',
        results: mockResults,
        includeDetails: true
      };

      mockReportGenerator.generatePDFReport.mockRejectedValue(new Error('Unexpected error'));

      await exportController.generateReport(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unexpected error'
      });
    });
  });

  describe('generateMultiFormatReport', () => {
    it('should generate reports in multiple formats successfully', async () => {
      mockRequest.body = {
        formats: ['pdf', 'csv', 'json'],
        results: mockResults,
        includeDetails: true
      };

      mockReportGenerator.generateMultiFormatReport.mockResolvedValue([
        {
          success: true,
          filePath: './reports/test-report.pdf',
          metadata: { format: 'PDF', fileSize: 1024, generatedAt: new Date() }
        },
        {
          success: true,
          filePath: './reports/test-report.csv',
          metadata: { format: 'CSV', fileSize: 512, generatedAt: new Date() }
        },
        {
          success: true,
          filePath: './reports/test-report.json',
          metadata: { format: 'JSON', fileSize: 2048, generatedAt: new Date() }
        }
      ]);

      await exportController.generateMultiFormatReport(mockRequest as Request, mockResponse as Response);

      expect(mockReportGenerator.generateMultiFormatReport).toHaveBeenCalledWith(
        mockResults,
        ['pdf', 'csv', 'json'],
        expect.objectContaining({
          includeDetails: true
        })
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        results: expect.arrayContaining([
          expect.objectContaining({
            success: true,
            filePath: './reports/test-report.pdf',
            downloadUrl: '/api/export/download/test-report.pdf'
          })
        ])
      });
    });

    it('should handle invalid formats array', async () => {
      mockRequest.body = {
        formats: [],
        results: mockResults,
        includeDetails: true
      };

      await exportController.generateMultiFormatReport(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Formats array is required and must not be empty'
      });
    });

    it('should handle invalid format types', async () => {
      mockRequest.body = {
        formats: ['pdf', 'xml', 'csv'],
        results: mockResults,
        includeDetails: true
      };

      await exportController.generateMultiFormatReport(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid formats: xml'
      });
    });
  });

  describe('downloadReport', () => {
    it('should download report file successfully', async () => {
      mockRequest.params = { filename: 'test-report.pdf' };
      
      (mockResponse.sendFile as jest.Mock).mockImplementation((filePath, callback) => {
        callback(null); // Simulate successful file send
      });

      await exportController.downloadReport(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition', 
        'attachment; filename="test-report.pdf"'
      );
      expect(mockResponse.sendFile).toHaveBeenCalled();
    });

    it('should handle invalid filename', async () => {
      mockRequest.params = { filename: '../../../etc/passwd' };

      await exportController.downloadReport(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid filename'
      });
    });

    it('should handle file not found', async () => {
      mockRequest.params = { filename: 'nonexistent.pdf' };
      
      (mockResponse.sendFile as jest.Mock).mockImplementation((filePath, callback) => {
        callback(new Error('File not found')); // Simulate file not found
      });

      await exportController.downloadReport(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'File not found'
      });
    });
  });

  describe('exportByIds', () => {
    it('should export results by IDs successfully', async () => {
      mockRequest.body = {
        ids: ['id1', 'id2'],
        format: 'pdf',
        includeDetails: true
      };

      mockResultsAggregator.getResultById
        .mockResolvedValueOnce({
          ...mockResults[0],
          id: 'id1',
          domain: 'example.com',
          analysisVersion: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .mockResolvedValueOnce({
          ...mockResults[0],
          id: 'id2',
          domain: 'example.com',
          analysisVersion: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date()
        });

      mockReportGenerator.generatePDFReport.mockResolvedValue({
        success: true,
        filePath: './reports/export-by-ids.pdf',
        metadata: {
          format: 'PDF',
          fileSize: 1024,
          generatedAt: new Date()
        }
      });

      await exportController.exportByIds(mockRequest as Request, mockResponse as Response);

      expect(mockResultsAggregator.getResultById).toHaveBeenCalledTimes(2);
      expect(mockReportGenerator.generatePDFReport).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          filePath: './reports/export-by-ids.pdf'
        })
      );
    });

    it('should handle no results found for IDs', async () => {
      mockRequest.body = {
        ids: ['nonexistent1', 'nonexistent2'],
        format: 'pdf',
        includeDetails: true
      };

      mockResultsAggregator.getResultById.mockResolvedValue(null);

      await exportController.exportByIds(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'No results found for the provided IDs'
      });
    });

    it('should handle invalid IDs array', async () => {
      mockRequest.body = {
        ids: [],
        format: 'pdf',
        includeDetails: true
      };

      await exportController.exportByIds(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'IDs array is required and must not be empty'
      });
    });
  });

  describe('listReports', () => {
    it('should list available reports successfully', async () => {
      const fs = require('fs').promises;
      jest.doMock('fs', () => ({
        promises: {
          readdir: jest.fn().mockResolvedValue(['report1.pdf', 'report2.csv']),
          stat: jest.fn()
            .mockResolvedValueOnce({
              size: 1024,
              birthtime: new Date('2024-01-01'),
              mtime: new Date('2024-01-02')
            })
            .mockResolvedValueOnce({
              size: 512,
              birthtime: new Date('2024-01-03'),
              mtime: new Date('2024-01-04')
            })
        }
      }));

      await exportController.listReports(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        reports: expect.arrayContaining([
          expect.objectContaining({
            filename: 'report1.pdf',
            size: 1024,
            format: 'PDF',
            downloadUrl: '/api/export/download/report1.pdf'
          }),
          expect.objectContaining({
            filename: 'report2.csv',
            size: 512,
            format: 'CSV',
            downloadUrl: '/api/export/download/report2.csv'
          })
        ])
      });
    });

    it('should handle empty reports directory', async () => {
      const fs = require('fs').promises;
      jest.doMock('fs', () => ({
        promises: {
          readdir: jest.fn().mockRejectedValue(new Error('Directory not found'))
        }
      }));

      await exportController.listReports(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        reports: []
      });
    });
  });

  describe('cleanupReports', () => {
    it('should cleanup old reports successfully', async () => {
      mockRequest.query = { daysOld: '7' };

      await exportController.cleanupReports(mockRequest as Request, mockResponse as Response);

      expect(mockReportGenerator.cleanupOldReports).toHaveBeenCalledWith(7);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Cleaned up reports older than 7 days'
      });
    });

    it('should use default days when not specified', async () => {
      mockRequest.query = {};

      await exportController.cleanupReports(mockRequest as Request, mockResponse as Response);

      expect(mockReportGenerator.cleanupOldReports).toHaveBeenCalledWith(30);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Cleaned up reports older than 30 days'
      });
    });

    it('should handle cleanup errors', async () => {
      mockRequest.query = { daysOld: '7' };
      mockReportGenerator.cleanupOldReports.mockRejectedValue(new Error('Cleanup failed'));

      await exportController.cleanupReports(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Cleanup failed'
      });
    });
  });
});