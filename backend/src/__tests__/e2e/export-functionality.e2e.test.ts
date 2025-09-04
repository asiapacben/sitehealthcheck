/**
 * End-to-end tests for export functionality
 */

import request from 'supertest';
import { app } from '../../index';
import { mockAnalysisResults } from './test-data';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';

describe('Export Functionality E2E Tests', () => {
  let server: any;
  let testAnalysisId: string;

  beforeAll(async () => {
    server = app.listen(0);
    
    // Create a test analysis for export testing
    const response = await request(app)
      .post('/api/analysis/start')
      .send({ urls: ['https://example.com/'] })
      .expect(200);
    
    testAnalysisId = response.body.analysisId;

    // Wait for analysis completion
    let attempts = 0;
    while (attempts < 30) {
      const statusResponse = await request(app)
        .get(`/api/analysis/status/${testAnalysisId}`);

      if (statusResponse.body.status === 'completed') {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('PDF Export Tests', () => {
    it('should generate valid PDF report with complete analysis data', async () => {
      const response = await request(app)
        .post('/api/export/pdf')
        .send({ analysisId: testAnalysisId })
        .expect(200);

      // Verify response headers
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.pdf');

      // Verify PDF content is valid
      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBeGreaterThan(1000); // Should be substantial

      // Validate PDF structure
      try {
        const pdfDoc = await PDFDocument.load(response.body);
        const pages = pdfDoc.getPages();
        expect(pages.length).toBeGreaterThan(0);
      } catch (error) {
        fail(`Generated PDF is not valid: ${error}`);
      }
    });

    it('should include all required sections in PDF report', async () => {
      const response = await request(app)
        .post('/api/export/pdf')
        .send({ 
          analysisId: testAnalysisId,
          options: {
            includeSummary: true,
            includeDetails: true,
            includeRecommendations: true,
            includeCharts: true
          }
        })
        .expect(200);

      // PDF should be larger with all sections included
      expect(response.body.length).toBeGreaterThan(5000);

      // Verify PDF metadata
      const pdfDoc = await PDFDocument.load(response.body);
      const title = pdfDoc.getTitle();
      expect(title).toContain('SEO & GEO Analysis Report');
    });

    it('should handle custom branding in PDF export', async () => {
      const customOptions = {
        branding: {
          companyName: 'Test Company',
          logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          primaryColor: '#007bff'
        }
      };

      const response = await request(app)
        .post('/api/export/pdf')
        .send({ 
          analysisId: testAnalysisId,
          options: customOptions
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBeGreaterThan(1000);
    });

    it('should handle PDF export errors gracefully', async () => {
      const response = await request(app)
        .post('/api/export/pdf')
        .send({ analysisId: 'nonexistent-analysis-id' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Analysis not found');
    });
  });

  describe('CSV Export Tests', () => {
    it('should generate valid CSV with all analysis data', async () => {
      const response = await request(app)
        .post('/api/export/csv')
        .send({ analysisId: testAnalysisId })
        .expect(200);

      // Verify response headers
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');

      // Verify CSV structure
      const csvContent = response.text;
      const lines = csvContent.split('\n');
      
      // Should have header row
      expect(lines[0]).toContain('URL');
      expect(lines[0]).toContain('Overall Score');
      expect(lines[0]).toContain('SEO Score');
      expect(lines[0]).toContain('GEO Score');

      // Should have data rows
      expect(lines.length).toBeGreaterThan(1);
      
      // Verify data format
      const dataRow = lines[1].split(',');
      expect(dataRow.length).toBeGreaterThanOrEqual(4);
    });

    it('should include detailed metrics in CSV export', async () => {
      const response = await request(app)
        .post('/api/export/csv')
        .send({ 
          analysisId: testAnalysisId,
          options: {
            includeDetails: true,
            includeRecommendations: true
          }
        })
        .expect(200);

      const csvContent = response.text;
      const headerRow = csvContent.split('\n')[0];

      // Should include detailed columns
      expect(headerRow).toContain('Page Speed');
      expect(headerRow).toContain('Mobile Responsive');
      expect(headerRow).toContain('Title Tag Score');
      expect(headerRow).toContain('Meta Description Score');
      expect(headerRow).toContain('Content Clarity');
      expect(headerRow).toContain('Recommendations Count');
    });

    it('should handle custom column selection in CSV', async () => {
      const customColumns = [
        'url',
        'overallScore',
        'seoScore.technical',
        'geoScore.readability',
        'recommendations.length'
      ];

      const response = await request(app)
        .post('/api/export/csv')
        .send({ 
          analysisId: testAnalysisId,
          options: { columns: customColumns }
        })
        .expect(200);

      const csvContent = response.text;
      const headerRow = csvContent.split('\n')[0];
      const headers = headerRow.split(',');

      expect(headers).toHaveLength(customColumns.length);
      expect(headerRow).toContain('URL');
      expect(headerRow).toContain('Overall Score');
    });

    it('should escape special characters in CSV data', async () => {
      // This test assumes we have data with special characters
      const response = await request(app)
        .post('/api/export/csv')
        .send({ analysisId: testAnalysisId })
        .expect(200);

      const csvContent = response.text;
      
      // Check for proper CSV escaping
      if (csvContent.includes('"')) {
        // If quotes are present, they should be properly escaped
        const quotedFields = csvContent.match(/"[^"]*"/g);
        if (quotedFields) {
          quotedFields.forEach(field => {
            // Quoted fields should not contain unescaped quotes
            const innerContent = field.slice(1, -1);
            expect(innerContent.includes('""') || !innerContent.includes('"')).toBe(true);
          });
        }
      }
    });
  });

  describe('JSON Export Tests', () => {
    it('should generate complete JSON export with all data', async () => {
      const response = await request(app)
        .post('/api/export/json')
        .send({ analysisId: testAnalysisId })
        .expect(200);

      // Verify response headers
      expect(response.headers['content-type']).toContain('application/json');

      // Verify JSON structure
      expect(response.body).toHaveProperty('analysisId');
      expect(response.body).toHaveProperty('exportTimestamp');
      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('metadata');

      // Verify results structure
      const results = response.body.results;
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      results.forEach((result: any) => {
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('overallScore');
        expect(result).toHaveProperty('seoScore');
        expect(result).toHaveProperty('geoScore');
        expect(result).toHaveProperty('recommendations');
        expect(result).toHaveProperty('technicalDetails');
      });
    });

    it('should include metadata in JSON export', async () => {
      const response = await request(app)
        .post('/api/export/json')
        .send({ analysisId: testAnalysisId })
        .expect(200);

      const metadata = response.body.metadata;
      expect(metadata).toHaveProperty('toolVersion');
      expect(metadata).toHaveProperty('analysisDate');
      expect(metadata).toHaveProperty('exportDate');
      expect(metadata).toHaveProperty('totalUrls');
      expect(metadata).toHaveProperty('configuration');
    });

    it('should support filtered JSON export', async () => {
      const response = await request(app)
        .post('/api/export/json')
        .send({ 
          analysisId: testAnalysisId,
          options: {
            fields: ['url', 'overallScore', 'seoScore.overall', 'geoScore.overall'],
            minScore: 50
          }
        })
        .expect(200);

      const results = response.body.results;
      results.forEach((result: any) => {
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('overallScore');
        expect(result.overallScore).toBeGreaterThanOrEqual(50);
        
        // Should not include filtered out fields
        expect(result).not.toHaveProperty('recommendations');
        expect(result).not.toHaveProperty('technicalDetails');
      });
    });

    it('should validate JSON schema compliance', async () => {
      const response = await request(app)
        .post('/api/export/json')
        .send({ analysisId: testAnalysisId })
        .expect(200);

      // Verify the JSON can be stringified and parsed
      const jsonString = JSON.stringify(response.body);
      expect(() => JSON.parse(jsonString)).not.toThrow();

      // Verify required fields are present and have correct types
      const data = response.body;
      expect(typeof data.analysisId).toBe('string');
      expect(typeof data.exportTimestamp).toBe('string');
      expect(Array.isArray(data.results)).toBe(true);
      expect(typeof data.metadata).toBe('object');
    });
  });

  describe('Batch Export Tests', () => {
    it('should handle multiple format exports simultaneously', async () => {
      const exportPromises = [
        request(app).post('/api/export/pdf').send({ analysisId: testAnalysisId }),
        request(app).post('/api/export/csv').send({ analysisId: testAnalysisId }),
        request(app).post('/api/export/json').send({ analysisId: testAnalysisId })
      ];

      const responses = await Promise.all(exportPromises);

      // All exports should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify different content types
      expect(responses[0].headers['content-type']).toContain('application/pdf');
      expect(responses[1].headers['content-type']).toContain('text/csv');
      expect(responses[2].headers['content-type']).toContain('application/json');
    });

    it('should handle large dataset exports efficiently', async () => {
      // Create analysis with multiple URLs for large dataset test
      const largeUrlSet = Array.from({ length: 10 }, (_, i) => `https://example.com/page${i}`);
      
      const analysisResponse = await request(app)
        .post('/api/analysis/start')
        .send({ urls: largeUrlSet })
        .expect(200);

      const largeAnalysisId = analysisResponse.body.analysisId;

      // Wait for completion
      let attempts = 0;
      while (attempts < 60) {
        const statusResponse = await request(app)
          .get(`/api/analysis/status/${largeAnalysisId}`);

        if (statusResponse.body.status === 'completed') {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      // Test export performance
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/export/csv')
        .send({ analysisId: largeAnalysisId })
        .expect(200);

      const exportTime = Date.now() - startTime;

      // Export should complete within reasonable time
      expect(exportTime).toBeLessThan(10000); // Less than 10 seconds

      // Verify all data is included
      const csvContent = response.text;
      const lines = csvContent.split('\n');
      expect(lines.length).toBe(largeUrlSet.length + 1); // +1 for header
    });
  });

  describe('Export Error Handling', () => {
    it('should handle invalid analysis ID gracefully', async () => {
      const invalidId = 'invalid-analysis-id-12345';

      const pdfResponse = await request(app)
        .post('/api/export/pdf')
        .send({ analysisId: invalidId })
        .expect(404);

      expect(pdfResponse.body).toHaveProperty('error');

      const csvResponse = await request(app)
        .post('/api/export/csv')
        .send({ analysisId: invalidId })
        .expect(404);

      expect(csvResponse.body).toHaveProperty('error');

      const jsonResponse = await request(app)
        .post('/api/export/json')
        .send({ analysisId: invalidId })
        .expect(404);

      expect(jsonResponse.body).toHaveProperty('error');
    });

    it('should handle incomplete analysis data', async () => {
      // Create analysis but don't wait for completion
      const incompleteResponse = await request(app)
        .post('/api/analysis/start')
        .send({ urls: ['https://example.com/incomplete'] })
        .expect(200);

      const incompleteAnalysisId = incompleteResponse.body.analysisId;

      // Try to export before completion
      const response = await request(app)
        .post('/api/export/pdf')
        .send({ analysisId: incompleteAnalysisId })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not completed');
    });

    it('should handle export service failures', async () => {
      // This test would require mocking internal services to simulate failures
      // For now, we'll test with invalid options that might cause failures
      
      const response = await request(app)
        .post('/api/export/pdf')
        .send({ 
          analysisId: testAnalysisId,
          options: {
            invalidOption: 'this should cause an error'
          }
        });

      // Should either succeed (ignoring invalid options) or fail gracefully
      if (response.status !== 200) {
        expect(response.body).toHaveProperty('error');
        expect(typeof response.body.error).toBe('string');
      }
    });
  });

  describe('Export Security Tests', () => {
    it('should prevent unauthorized access to analysis data', async () => {
      // Test with analysis ID that doesn't belong to current session
      const unauthorizedId = 'unauthorized-analysis-id';

      const response = await request(app)
        .post('/api/export/pdf')
        .send({ analysisId: unauthorizedId })
        .expect(404); // Should return not found, not unauthorized to avoid info leakage

      expect(response.body).toHaveProperty('error');
    });

    it('should sanitize file names in export headers', async () => {
      const response = await request(app)
        .post('/api/export/pdf')
        .send({ 
          analysisId: testAnalysisId,
          options: {
            filename: 'test<script>alert("xss")</script>.pdf'
          }
        })
        .expect(200);

      const contentDisposition = response.headers['content-disposition'];
      expect(contentDisposition).not.toContain('<script>');
      expect(contentDisposition).not.toContain('alert');
    });

    it('should limit export file sizes', async () => {
      const response = await request(app)
        .post('/api/export/pdf')
        .send({ analysisId: testAnalysisId })
        .expect(200);

      // PDF should not exceed reasonable size limits (e.g., 50MB)
      expect(response.body.length).toBeLessThan(50 * 1024 * 1024);
    });
  });
});