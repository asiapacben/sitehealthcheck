import { ReportGenerator, ReportOptions } from '../ReportGenerator';
import { AnalysisResults } from '../../../../shared/types';
import { promises as fs } from 'fs';
import path from 'path';

// Mock dependencies

jest.mock('csv-writer', () => ({
  createObjectCsvWriter: jest.fn(() => ({
    writeRecords: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock the require function for fs.createWriteStream
const mockWriteStream = {
  on: jest.fn((event, callback) => {
    if (event === 'finish') {
      setTimeout(callback, 10);
    }
  })
};

jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    stat: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn()
  },
  createWriteStream: jest.fn(() => mockWriteStream)
}));

// Also mock the require('fs') call
jest.doMock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    stat: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn()
  },
  createWriteStream: jest.fn(() => mockWriteStream)
}));

jest.mock('pdfkit', () => {
  const mockDoc = {
    fontSize: jest.fn().mockReturnThis(),
    fillColor: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    strokeColor: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    addPage: jest.fn().mockReturnThis(),
    end: jest.fn(),
    pipe: jest.fn(() => mockWriteStream)
  };
  return jest.fn(() => mockDoc);
});

describe('ReportGenerator', () => {
  let reportGenerator: ReportGenerator;
  let mockResults: AnalysisResults[];
  const testOutputDir = './test-reports';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset all fs mocks
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.stat as jest.Mock).mockResolvedValue({ size: 1024, mtime: new Date() });
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    
    // Reset CSV writer mock
    const { createObjectCsvWriter } = require('csv-writer');
    createObjectCsvWriter.mockReturnValue({
      writeRecords: jest.fn().mockResolvedValue(undefined)
    });
    
    reportGenerator = new ReportGenerator(testOutputDir);
    
    // Mock sample analysis results
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
            titleTag: { score: 90, issues: [], suggestions: ['Optimize length'] },
            metaDescription: { score: 85, issues: [], suggestions: [] },
            headingStructure: { score: 80, issues: ['Missing H2'], suggestions: ['Add H2 tags'] },
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
            schemaMarkup: ['Article', 'Organization']
          }
        },
        recommendations: [
          {
            id: '1',
            category: 'SEO',
            priority: 'High',
            impact: 8,
            effort: 'Easy',
            title: 'Improve page speed',
            description: 'Optimize images and reduce server response time',
            actionSteps: ['Compress images', 'Enable caching']
          },
          {
            id: '2',
            category: 'GEO',
            priority: 'Medium',
            impact: 6,
            effort: 'Medium',
            title: 'Add more structured data',
            description: 'Include FAQ schema markup',
            actionSteps: ['Add FAQ schema']
          }
        ],
        technicalDetails: {
          loadTime: 2500,
          pageSize: 1024000,
          requests: 25,
          statusCode: 200,
          redirects: 0
        }
      },
      {
        url: 'https://example.com/page2',
        timestamp: new Date('2024-01-01T10:05:00Z'),
        overallScore: 75,
        seoScore: {
          overall: 70,
          technical: 65,
          content: 75,
          structure: 70,
          details: {
            pageSpeed: 60,
            mobileResponsive: false,
            titleTag: { score: 80, issues: ['Too long'], suggestions: ['Shorten title'] },
            metaDescription: { score: 75, issues: [], suggestions: [] },
            headingStructure: { score: 70, issues: ['No H1'], suggestions: ['Add H1 tag'] },
            internalLinks: 8
          }
        },
        geoScore: {
          overall: 80,
          readability: 75,
          credibility: 85,
          completeness: 78,
          structuredData: 82,
          details: {
            contentClarity: { score: 75, issues: ['Complex sentences'], suggestions: ['Simplify language'] },
            questionAnswerFormat: false,
            authorInformation: false,
            citations: 2,
            schemaMarkup: ['WebPage']
          }
        },
        recommendations: [
          {
            id: '3',
            category: 'Technical',
            priority: 'High',
            impact: 9,
            effort: 'Hard',
            title: 'Fix mobile responsiveness',
            description: 'Implement responsive design',
            actionSteps: ['Add viewport meta tag', 'Use responsive CSS']
          },
          {
            id: '4',
            category: 'SEO',
            priority: 'High',
            impact: 7,
            effort: 'Easy',
            title: 'Improve page speed',
            description: 'Optimize images and reduce server response time',
            actionSteps: ['Compress images', 'Enable caching']
          }
        ],
        technicalDetails: {
          loadTime: 3500,
          pageSize: 2048000,
          requests: 40,
          statusCode: 200,
          redirects: 1
        }
      }
    ];

    // Mock fs operations
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.stat as jest.Mock).mockResolvedValue({ size: 1024, mtime: new Date() });
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
  });

  describe('PDF Report Generation', () => {
    it('should generate a PDF report successfully', async () => {
      const result = await reportGenerator.generatePDFReport(mockResults);

      expect(result.success).toBe(true);
      expect(result.filePath).toContain('.pdf');
      expect(result.metadata).toEqual({
        format: 'PDF',
        fileSize: 1024,
        generatedAt: expect.any(Date)
      });
    });

    it('should generate PDF with custom branding options', async () => {
      const options: ReportOptions = {
        includeDetails: true,
        customNotes: 'Custom analysis notes',
        branding: {
          companyName: 'Test Company',
          colors: {
            primary: '#ff0000',
            secondary: '#00ff00'
          }
        }
      };

      const result = await reportGenerator.generatePDFReport(mockResults, options);

      expect(result.success).toBe(true);
      expect(result.filePath).toContain('.pdf');
    });

    it('should handle PDF generation errors gracefully', async () => {
      // Mock PDF generation error
      const PDFDocument = require('pdfkit');
      PDFDocument.mockImplementation(() => {
        throw new Error('PDF generation failed');
      });

      const result = await reportGenerator.generatePDFReport(mockResults);

      expect(result.success).toBe(false);
      expect(result.error).toBe('PDF generation failed');
    });

    it('should generate PDF without detailed analysis when includeDetails is false', async () => {
      const options: ReportOptions = { includeDetails: false };
      const result = await reportGenerator.generatePDFReport(mockResults, options);

      expect(result.success).toBe(true);
    });
  });

  describe('CSV Report Generation', () => {
    it('should generate a CSV report successfully', async () => {
      const result = await reportGenerator.generateCSVReport(mockResults);

      expect(result.success).toBe(true);
      expect(result.filePath).toContain('.csv');
      expect(result.metadata).toEqual({
        format: 'CSV',
        fileSize: 1024,
        generatedAt: expect.any(Date)
      });
    });

    it('should generate CSV with detailed columns when includeDetails is true', async () => {
      const options: ReportOptions = { includeDetails: true };
      const result = await reportGenerator.generateCSVReport(mockResults, options);

      expect(result.success).toBe(true);
      
      const { createObjectCsvWriter } = require('csv-writer');
      expect(createObjectCsvWriter).toHaveBeenCalledWith({
        path: expect.stringContaining('.csv'),
        header: expect.arrayContaining([
          { id: 'url', title: 'URL' },
          { id: 'overallScore', title: 'Overall Score' },
          { id: 'technicalSEO', title: 'Technical SEO' },
          { id: 'pageSpeed', title: 'Page Speed' }
        ])
      });
    });

    it('should generate CSV with basic columns when includeDetails is false', async () => {
      const options: ReportOptions = { includeDetails: false };
      const result = await reportGenerator.generateCSVReport(mockResults, options);

      expect(result.success).toBe(true);
      
      const { createObjectCsvWriter } = require('csv-writer');
      const call = (createObjectCsvWriter as jest.Mock).mock.calls[0][0];
      
      expect(call.header).toHaveLength(7); // Basic headers only
      expect(call.header).toEqual(expect.arrayContaining([
        { id: 'url', title: 'URL' },
        { id: 'overallScore', title: 'Overall Score' },
        { id: 'seoScore', title: 'SEO Score' },
        { id: 'geoScore', title: 'GEO Score' }
      ]));
    });

    it('should handle CSV generation errors gracefully', async () => {
      const { createObjectCsvWriter } = require('csv-writer');
      createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockRejectedValue(new Error('CSV write failed'))
      });

      const result = await reportGenerator.generateCSVReport(mockResults);

      expect(result.success).toBe(false);
      expect(result.error).toBe('CSV write failed');
    });
  });

  describe('JSON Report Generation', () => {
    it('should generate a JSON report successfully', async () => {
      const result = await reportGenerator.generateJSONReport(mockResults);

      expect(result.success).toBe(true);
      expect(result.filePath).toContain('.json');
      expect(result.metadata).toEqual({
        format: 'JSON',
        fileSize: 1024,
        generatedAt: expect.any(Date)
      });
    });

    it('should include full results when includeDetails is true', async () => {
      const options: ReportOptions = { includeDetails: true };
      await reportGenerator.generateJSONReport(mockResults, options);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expect.stringContaining('"results"'),
        'utf8'
      );

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const jsonData = JSON.parse(writeCall[1]);
      
      expect(jsonData.metadata.includeDetails).toBe(true);
      expect(jsonData.results).toHaveLength(2);
      expect(jsonData.results[0]).toHaveProperty('recommendations');
      expect(jsonData.results[0]).toHaveProperty('technicalDetails');
    });

    it('should include simplified results when includeDetails is false', async () => {
      const options: ReportOptions = { includeDetails: false };
      await reportGenerator.generateJSONReport(mockResults, options);

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const jsonData = JSON.parse(writeCall[1]);
      
      expect(jsonData.metadata.includeDetails).toBe(false);
      expect(jsonData.results[0]).not.toHaveProperty('technicalDetails');
      expect(jsonData.results[0]).toHaveProperty('topRecommendations');
    });

    it('should include custom notes in JSON export', async () => {
      const options: ReportOptions = {
        includeDetails: true,
        customNotes: 'These are custom analysis notes'
      };
      
      await reportGenerator.generateJSONReport(mockResults, options);

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const jsonData = JSON.parse(writeCall[1]);
      
      expect(jsonData.metadata.customNotes).toBe('These are custom analysis notes');
    });

    it('should handle JSON generation errors gracefully', async () => {
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('File write failed'));

      const result = await reportGenerator.generateJSONReport(mockResults);

      expect(result.success).toBe(false);
      expect(result.error).toBe('File write failed');
    });
  });

  describe('Multi-Format Report Generation', () => {
    it('should generate reports in multiple formats successfully', async () => {
      const formats: ('pdf' | 'csv' | 'json')[] = ['pdf', 'csv', 'json'];
      const results = await reportGenerator.generateMultiFormatReport(mockResults, formats);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true); // PDF
      expect(results[1].success).toBe(true); // CSV
      expect(results[2].success).toBe(true); // JSON
      
      expect(results[0].metadata?.format).toBe('PDF');
      expect(results[1].metadata?.format).toBe('CSV');
      expect(results[2].metadata?.format).toBe('JSON');
    });

    it('should handle partial failures in multi-format generation', async () => {
      // Mock CSV failure for this specific test
      const { createObjectCsvWriter } = require('csv-writer');
      createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockRejectedValue(new Error('CSV failed'))
      });

      const formats: ('pdf' | 'csv' | 'json')[] = ['pdf', 'csv', 'json'];
      const results = await reportGenerator.generateMultiFormatReport(mockResults, formats);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);  // PDF should succeed
      expect(results[1].success).toBe(false); // CSV should fail
      expect(results[2].success).toBe(true);  // JSON should succeed
    });

    it('should throw error for unsupported format', async () => {
      const formats = ['pdf', 'xml' as any];
      
      await expect(
        reportGenerator.generateMultiFormatReport(mockResults, formats)
      ).rejects.toThrow('Unsupported format: xml');
    });
  });

  describe('Report Cleanup', () => {
    it('should clean up old report files', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days old
      
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5); // 5 days old

      (fs.readdir as jest.Mock).mockResolvedValue(['old-report.pdf', 'recent-report.pdf']);
      (fs.stat as jest.Mock)
        .mockResolvedValueOnce({ mtime: oldDate })
        .mockResolvedValueOnce({ mtime: recentDate });

      await reportGenerator.cleanupOldReports(30);

      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(testOutputDir, 'old-report.pdf')
      );
      expect(fs.unlink).not.toHaveBeenCalledWith(
        path.join(testOutputDir, 'recent-report.pdf')
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      (fs.readdir as jest.Mock).mockRejectedValue(new Error('Directory read failed'));

      // Should not throw
      await expect(reportGenerator.cleanupOldReports()).resolves.toBeUndefined();
    });
  });

  describe('Data Processing', () => {
    it('should generate accurate summary statistics', async () => {
      await reportGenerator.generateJSONReport(mockResults);

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const jsonData = JSON.parse(writeCall[1]);
      
      expect(jsonData.summary.averageScore).toBe(80); // (85 + 75) / 2
      expect(jsonData.summary.averageSEOScore).toBe(75); // (80 + 70) / 2
      expect(jsonData.summary.averageGEOScore).toBe(85); // (90 + 80) / 2
      expect(jsonData.summary.topIssues).toContain('Improve page speed');
    });

    it('should handle empty results gracefully', async () => {
      const result = await reportGenerator.generateJSONReport([]);

      expect(result.success).toBe(true);
      
      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const jsonData = JSON.parse(writeCall[1]);
      
      expect(jsonData.summary.averageScore).toBe(0);
      expect(jsonData.summary.topIssues).toEqual([]);
      expect(jsonData.results).toEqual([]);
    });

    it('should properly group recommendations by title', async () => {
      await reportGenerator.generateJSONReport(mockResults);

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const jsonData = JSON.parse(writeCall[1]);
      
      // "Improve page speed" appears in both results
      expect(jsonData.summary.topIssues).toContain('Improve page speed');
    });
  });

  describe('Directory Management', () => {
    it('should create output directory if it does not exist', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('Directory not found'));
      
      const generator = new ReportGenerator('./new-reports-dir');
      await generator.generateJSONReport(mockResults); // This will trigger ensureOutputDirectory

      expect(fs.mkdir).toHaveBeenCalledWith('./new-reports-dir', { recursive: true });
    });

    it('should not create directory if it already exists', async () => {
      const generator = new ReportGenerator('./existing-reports-dir');
      await generator.generateJSONReport(mockResults); // This will trigger ensureOutputDirectory

      expect(fs.mkdir).not.toHaveBeenCalled();
    });
  });
});