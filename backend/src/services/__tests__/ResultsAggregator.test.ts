import { ResultsAggregator } from '../ResultsAggregator';
import { 
  AnalysisResults, 
  StoredAnalysisResults, 
  AnalysisSession,
  ResultsQuery,
  ResultsFilter 
} from '../../../../shared/types';

describe('ResultsAggregator', () => {
  let aggregator: ResultsAggregator;
  let mockAnalysisResults: AnalysisResults[];

  beforeEach(() => {
    aggregator = new ResultsAggregator();
    
    // Create mock analysis results
    mockAnalysisResults = [
      {
        url: 'https://example.com/page1',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        overallScore: 85,
        seoScore: {
          overall: 80,
          technical: 85,
          content: 75,
          structure: 80,
          details: {
            pageSpeed: 90,
            mobileResponsive: true,
            titleTag: { score: 85, issues: [], suggestions: [] },
            metaDescription: { score: 80, issues: [], suggestions: [] },
            headingStructure: { score: 75, issues: [], suggestions: [] },
            internalLinks: 10
          }
        },
        geoScore: {
          overall: 90,
          readability: 85,
          credibility: 95,
          completeness: 90,
          structuredData: 85,
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
            id: 'rec1',
            category: 'SEO',
            priority: 'High',
            impact: 8,
            effort: 'Medium',
            title: 'Improve page speed',
            description: 'Optimize images and reduce bundle size',
            actionSteps: ['Compress images', 'Minify CSS/JS']
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
        timestamp: new Date('2024-01-02T10:00:00Z'),
        overallScore: 65,
        seoScore: {
          overall: 60,
          technical: 65,
          content: 55,
          structure: 60,
          details: {
            pageSpeed: 70,
            mobileResponsive: false,
            titleTag: { score: 65, issues: ['Too long'], suggestions: ['Shorten title'] },
            metaDescription: { score: 60, issues: [], suggestions: [] },
            headingStructure: { score: 55, issues: [], suggestions: [] },
            internalLinks: 5
          }
        },
        geoScore: {
          overall: 70,
          readability: 65,
          credibility: 75,
          completeness: 70,
          structuredData: 65,
          details: {
            contentClarity: { score: 65, issues: [], suggestions: [] },
            questionAnswerFormat: false,
            authorInformation: false,
            citations: 2,
            schemaMarkup: ['WebPage']
          }
        },
        recommendations: [
          {
            id: 'rec2',
            category: 'Technical',
            priority: 'High',
            impact: 9,
            effort: 'Easy',
            title: 'Fix mobile responsiveness',
            description: 'Add responsive design',
            actionSteps: ['Add viewport meta tag', 'Use responsive CSS']
          },
          {
            id: 'rec3',
            category: 'SEO',
            priority: 'Medium',
            impact: 6,
            effort: 'Easy',
            title: 'Improve page speed',
            description: 'Optimize images and reduce bundle size',
            actionSteps: ['Compress images', 'Minify CSS/JS']
          }
        ],
        technicalDetails: {
          loadTime: 4500,
          pageSize: 2048000,
          requests: 45,
          statusCode: 200,
          redirects: 1
        }
      }
    ];
  });

  afterEach(() => {
    aggregator.clearAll();
  });

  describe('aggregateResults', () => {
    it('should aggregate analysis results with metadata', async () => {
      const storedResults = await aggregator.aggregateResults(mockAnalysisResults);

      expect(storedResults).toHaveLength(2);
      expect(storedResults[0]).toMatchObject({
        ...mockAnalysisResults[0],
        id: expect.any(String),
        domain: 'example.com',
        analysisVersion: '1.0.0',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        metadata: expect.objectContaining({
          aggregatedAt: expect.any(String),
          resultCount: 2
        })
      });
    });

    it('should handle empty results array', async () => {
      const storedResults = await aggregator.aggregateResults([]);
      expect(storedResults).toHaveLength(0);
    });

    it('should extract domain correctly from URLs', async () => {
      const results = [{
        ...mockAnalysisResults[0],
        url: 'https://www.test-domain.com/path'
      }];

      const storedResults = await aggregator.aggregateResults(results);
      expect(storedResults[0].domain).toBe('test-domain.com');
    });

    it('should handle invalid URLs gracefully', async () => {
      const results = [{
        ...mockAnalysisResults[0],
        url: 'invalid-url'
      }];

      const storedResults = await aggregator.aggregateResults(results);
      expect(storedResults[0].domain).toBe('unknown');
    });
  });

  describe('storeResults', () => {
    it('should store results successfully', async () => {
      const storedResults = await aggregator.aggregateResults(mockAnalysisResults);
      await aggregator.storeResults(storedResults);

      const stats = aggregator.getStorageStats();
      expect(stats.totalResults).toBe(2);
      expect(stats.domains).toContain('example.com');
    });

    it('should update timestamps when storing', async () => {
      const storedResults = await aggregator.aggregateResults(mockAnalysisResults);
      const originalTimestamp = storedResults[0].updatedAt;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await aggregator.storeResults(storedResults);
      
      const retrievedResult = await aggregator.getResultById(storedResults[0].id);
      expect(retrievedResult!.updatedAt.getTime()).toBeGreaterThan(originalTimestamp.getTime());
    });
  });

  describe('retrieveResults', () => {
    beforeEach(async () => {
      const storedResults = await aggregator.aggregateResults(mockAnalysisResults);
      await aggregator.storeResults(storedResults);
    });

    it('should retrieve all results without filters', async () => {
      const aggregatedResults = await aggregator.retrieveResults();
      
      expect(aggregatedResults.totalResults).toBe(2);
      expect(aggregatedResults.results).toHaveLength(2);
      expect(aggregatedResults.summary.averageScore).toBe(75); // (85 + 65) / 2
    });

    it('should filter by domain', async () => {
      const query: ResultsQuery = {
        filter: { domain: 'example.com' }
      };
      
      const aggregatedResults = await aggregator.retrieveResults(query);
      expect(aggregatedResults.totalResults).toBe(2);
      expect(aggregatedResults.results.every(r => r.domain === 'example.com')).toBe(true);
    });

    it('should filter by score range', async () => {
      const query: ResultsQuery = {
        filter: { minScore: 80 }
      };
      
      const aggregatedResults = await aggregator.retrieveResults(query);
      expect(aggregatedResults.totalResults).toBe(1);
      expect(aggregatedResults.results[0].overallScore).toBe(85);
    });

    it('should filter by date range', async () => {
      const query: ResultsQuery = {
        filter: { 
          dateFrom: new Date('2024-01-01T00:00:00Z'),
          dateTo: new Date('2024-01-01T23:59:59Z')
        }
      };
      
      const aggregatedResults = await aggregator.retrieveResults(query);
      expect(aggregatedResults.totalResults).toBe(1);
      expect(aggregatedResults.results[0].url).toBe('https://example.com/page1');
    });

    it('should filter by categories', async () => {
      const query: ResultsQuery = {
        filter: { categories: ['Technical'] }
      };
      
      const aggregatedResults = await aggregator.retrieveResults(query);
      expect(aggregatedResults.totalResults).toBe(1);
      expect(aggregatedResults.results[0].url).toBe('https://example.com/page2');
    });

    it('should sort by overall score descending', async () => {
      const query: ResultsQuery = {
        sortBy: 'overallScore',
        sortOrder: 'desc'
      };
      
      const aggregatedResults = await aggregator.retrieveResults(query);
      expect(aggregatedResults.results[0].overallScore).toBe(85);
      expect(aggregatedResults.results[1].overallScore).toBe(65);
    });

    it('should sort by overall score ascending', async () => {
      const query: ResultsQuery = {
        sortBy: 'overallScore',
        sortOrder: 'asc'
      };
      
      const aggregatedResults = await aggregator.retrieveResults(query);
      expect(aggregatedResults.results[0].overallScore).toBe(65);
      expect(aggregatedResults.results[1].overallScore).toBe(85);
    });

    it('should apply pagination', async () => {
      const query: ResultsQuery = {
        filter: { limit: 1, offset: 0 }
      };
      
      const aggregatedResults = await aggregator.retrieveResults(query);
      expect(aggregatedResults.totalResults).toBe(2);
      expect(aggregatedResults.results).toHaveLength(1);
    });

    it('should generate correct summary statistics', async () => {
      const aggregatedResults = await aggregator.retrieveResults();
      
      expect(aggregatedResults.summary.averageScore).toBe(75);
      expect(aggregatedResults.summary.scoreDistribution['Good (70-89)']).toBe(1);
      expect(aggregatedResults.summary.scoreDistribution['Fair (50-69)']).toBe(1);
      expect(aggregatedResults.summary.commonIssues).toContain('Improve page speed');
      expect(aggregatedResults.summary.topRecommendations).toHaveLength(2);
    });
  });

  describe('getResultById', () => {
    it('should retrieve result by ID', async () => {
      const storedResults = await aggregator.aggregateResults(mockAnalysisResults);
      await aggregator.storeResults(storedResults);
      
      const result = await aggregator.getResultById(storedResults[0].id);
      expect(result).toMatchObject(storedResults[0]);
    });

    it('should return null for non-existent ID', async () => {
      const result = await aggregator.getResultById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('deleteResults', () => {
    it('should delete results by IDs', async () => {
      const storedResults = await aggregator.aggregateResults(mockAnalysisResults);
      await aggregator.storeResults(storedResults);
      
      await aggregator.deleteResults([storedResults[0].id]);
      
      const result = await aggregator.getResultById(storedResults[0].id);
      expect(result).toBeNull();
      
      const stats = aggregator.getStorageStats();
      expect(stats.totalResults).toBe(1);
    });

    it('should handle deletion of non-existent IDs gracefully', async () => {
      await aggregator.deleteResults(['non-existent-id']);
      // Should not throw error
    });
  });

  describe('session management', () => {
    it('should store and retrieve analysis sessions', async () => {
      const session: AnalysisSession = {
        id: 'session-1',
        domain: 'example.com',
        urls: ['https://example.com/page1', 'https://example.com/page2'],
        status: 'completed',
        progress: 100,
        results: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date()
      };

      await aggregator.storeSession(session);
      const retrievedSession = await aggregator.getSessionResults('session-1');
      
      expect(retrievedSession).toMatchObject(session);
    });

    it('should return null for non-existent session', async () => {
      const session = await aggregator.getSessionResults('non-existent-session');
      expect(session).toBeNull();
    });

    it('should update session timestamps when storing', async () => {
      const originalTimestamp = new Date('2024-01-01T10:00:00Z');
      const session: AnalysisSession = {
        id: 'session-1',
        domain: 'example.com',
        urls: ['https://example.com/page1'],
        status: 'running',
        progress: 50,
        results: [],
        createdAt: new Date(),
        updatedAt: originalTimestamp
      };

      await aggregator.storeSession(session);
      const retrievedSession = await aggregator.getSessionResults('session-1');
      
      expect(retrievedSession!.updatedAt.getTime()).toBeGreaterThan(originalTimestamp.getTime());
    });
  });

  describe('getStorageStats', () => {
    it('should return correct storage statistics', async () => {
      const storedResults = await aggregator.aggregateResults(mockAnalysisResults);
      await aggregator.storeResults(storedResults);

      const session: AnalysisSession = {
        id: 'session-1',
        domain: 'example.com',
        urls: ['https://example.com/page1'],
        status: 'completed',
        progress: 100,
        results: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await aggregator.storeSession(session);

      const stats = aggregator.getStorageStats();
      expect(stats.totalResults).toBe(2);
      expect(stats.totalSessions).toBe(1);
      expect(stats.domains).toEqual(['example.com']);
    });

    it('should return empty stats for empty storage', () => {
      const stats = aggregator.getStorageStats();
      expect(stats.totalResults).toBe(0);
      expect(stats.totalSessions).toBe(0);
      expect(stats.domains).toEqual([]);
    });
  });

  describe('clearAll', () => {
    it('should clear all stored data', async () => {
      const storedResults = await aggregator.aggregateResults(mockAnalysisResults);
      await aggregator.storeResults(storedResults);

      aggregator.clearAll();

      const stats = aggregator.getStorageStats();
      expect(stats.totalResults).toBe(0);
      expect(stats.totalSessions).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle errors in aggregateResults gracefully', async () => {
      // Mock a scenario that could cause an error
      const invalidResults = [null as any];
      
      await expect(aggregator.aggregateResults(invalidResults)).rejects.toThrow('Failed to aggregate results');
    });

    it('should handle errors in retrieveResults gracefully', async () => {
      // Create a query that might cause issues
      const query: ResultsQuery = {
        filter: { dateFrom: new Date('invalid-date') }
      };
      
      // Should handle gracefully and not throw
      const results = await aggregator.retrieveResults(query);
      expect(results).toBeDefined();
    });
  });
});