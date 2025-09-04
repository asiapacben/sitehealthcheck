import { ReportGenerator } from '../ReportGenerator';
import { AnalysisResults } from '../../../../shared/types';
import { promises as fs } from 'fs';
import path from 'path';

describe('ReportGenerator Integration Tests', () => {
  let reportGenerator: ReportGenerator;
  let mockResults: AnalysisResults[];
  const testOutputDir = './test-reports-integration';

  beforeAll(async () => {
    // Create test directory
    try {
      await fs.mkdir(testOutputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      const files = await fs.readdir(testOutputDir);
      for (const file of files) {
        await fs.unlink(path.join(testOutputDir, file));
      }
      await fs.rmdir(testOutputDir);
    } catch (error) {
      // Directory might not exist or be empty
    }
  });

  beforeEach(() => {
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
          }
        ],
        technicalDetails: {
          loadTime: 2500,
          pageSize: 1024000,
          requests: 25,
          statusCode: 200,
          redirects: 0
        }
      }
    ];
  });

  describe('JSON Export', () => {
    it('should generate JSON report successfully', async () => {
      const result = await reportGenerator.generateJSONReport(mockResults);

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      expect(result.filePath).toContain('.json');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.format).toBe('JSON');

      // Verify file was created
      if (result.filePath) {
        const fileExists = await fs.access(result.filePath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);

        // Verify file content
        const content = await fs.readFile(result.filePath, 'utf8');
        const jsonData = JSON.parse(content);
        
        expect(jsonData.metadata).toBeDefined();
        expect(jsonData.results).toHaveLength(1);
        expect(jsonData.results[0].url).toBe('https://example.com');
        expect(jsonData.summary).toBeDefined();
      }
    });

    it('should generate JSON with custom options', async () => {
      const options = {
        includeDetails: false,
        customNotes: 'Test custom notes',
        branding: {
          companyName: 'Test Company'
        }
      };

      const result = await reportGenerator.generateJSONReport(mockResults, options);

      expect(result.success).toBe(true);
      
      if (result.filePath) {
        const content = await fs.readFile(result.filePath, 'utf8');
        const jsonData = JSON.parse(content);
        
        expect(jsonData.metadata.customNotes).toBe('Test custom notes');
        expect(jsonData.metadata.includeDetails).toBe(false);
      }
    });
  });

  describe('CSV Export', () => {
    it('should generate CSV report successfully', async () => {
      const result = await reportGenerator.generateCSVReport(mockResults);

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      expect(result.filePath).toContain('.csv');
      expect(result.metadata?.format).toBe('CSV');

      // Verify file was created
      if (result.filePath) {
        const fileExists = await fs.access(result.filePath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);

        // Verify file has content
        const stats = await fs.stat(result.filePath);
        expect(stats.size).toBeGreaterThan(0);
      }
    });
  });

  describe('Multi-Format Export', () => {
    it('should generate multiple formats', async () => {
      const formats: ('csv' | 'json')[] = ['csv', 'json']; // Skip PDF for now
      const results = await reportGenerator.generateMultiFormatReport(mockResults, formats);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      
      // Verify files were created
      for (const result of results) {
        if (result.filePath) {
          const fileExists = await fs.access(result.filePath).then(() => true).catch(() => false);
          expect(fileExists).toBe(true);
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle empty results gracefully', async () => {
      const result = await reportGenerator.generateJSONReport([]);

      expect(result.success).toBe(true);
      
      if (result.filePath) {
        const content = await fs.readFile(result.filePath, 'utf8');
        const jsonData = JSON.parse(content);
        
        expect(jsonData.results).toEqual([]);
        expect(jsonData.summary.averageScore).toBe(0);
      }
    });
  });
});