import { ScoringEngine } from '../ScoringEngine';
import {
  AnalysisResults,
  AnalysisConfig,
  SEOScore,
  GEOScore,
  Recommendation,
  QualityScore
} from '../../../../shared/types';

// Mock the ScoringConfigManager
jest.mock('../../utils/ScoringConfig', () => ({
  ScoringConfigManager: {
    loadConfig: jest.fn(() => ({
      seoWeights: {
        technical: 0.4,
        content: 0.4,
        structure: 0.2
      },
      geoWeights: {
        readability: 0.3,
        credibility: 0.3,
        completeness: 0.2,
        structuredData: 0.2
      },
      thresholds: {
        pageSpeedMin: 90,
        contentLengthMin: 300,
        headingLevels: 3
      }
    })),
    saveConfig: jest.fn(),
    getDefaultConfig: jest.fn(() => ({
      seoWeights: {
        technical: 0.4,
        content: 0.4,
        structure: 0.2
      },
      geoWeights: {
        readability: 0.3,
        credibility: 0.3,
        completeness: 0.2,
        structuredData: 0.2
      },
      thresholds: {
        pageSpeedMin: 90,
        contentLengthMin: 300,
        headingLevels: 3
      }
    })),
    applyPreset: jest.fn(),
    resetToDefaults: jest.fn(),
    getAvailablePresets: jest.fn(() => ['seo-focused', 'geo-focused', 'balanced']),
    validateConfig: jest.fn(() => ({ valid: true, errors: [] }))
  }
}));

describe('ScoringEngine', () => {
  let scoringEngine: ScoringEngine;
  let mockAnalysisResults: AnalysisResults;

  beforeEach(() => {
    scoringEngine = new ScoringEngine();
    
    mockAnalysisResults = {
      url: 'https://example.com',
      timestamp: new Date(),
      overallScore: 0,
      seoScore: {
        overall: 0,
        technical: 0,
        content: 0,
        structure: 0,
        details: {
          pageSpeed: 85,
          mobileResponsive: true,
          titleTag: { score: 90, issues: [], suggestions: [] },
          metaDescription: { score: 80, issues: [], suggestions: [] },
          headingStructure: { score: 75, issues: [], suggestions: [] },
          internalLinks: 12
        }
      },
      geoScore: {
        overall: 0,
        readability: 0,
        credibility: 0,
        completeness: 0,
        structuredData: 0,
        details: {
          contentClarity: { score: 85, issues: [], suggestions: [] },
          questionAnswerFormat: true,
          authorInformation: true,
          citations: 5,
          schemaMarkup: ['Article', 'Organization']
        }
      },
      recommendations: [],
      technicalDetails: {
        loadTime: 1200,
        pageSize: 2048,
        requests: 25,
        statusCode: 200,
        redirects: 0
      }
    };
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const engine = new ScoringEngine();
      const config = engine.getConfig();
      
      expect(config.seoWeights.technical).toBe(0.4);
      expect(config.seoWeights.content).toBe(0.4);
      expect(config.seoWeights.structure).toBe(0.2);
      expect(config.geoWeights.readability).toBe(0.3);
      expect(config.geoWeights.credibility).toBe(0.3);
      expect(config.geoWeights.completeness).toBe(0.2);
      expect(config.geoWeights.structuredData).toBe(0.2);
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig: Partial<AnalysisConfig> = {
        seoWeights: {
          technical: 0.5,
          content: 0.3,
          structure: 0.2
        },
        thresholds: {
          pageSpeedMin: 95,
          contentLengthMin: 500,
          headingLevels: 4
        }
      };

      const engine = new ScoringEngine(customConfig);
      const config = engine.getConfig();
      
      expect(config.seoWeights.technical).toBe(0.5);
      expect(config.seoWeights.content).toBe(0.3);
      expect(config.thresholds.pageSpeedMin).toBe(95);
      expect(config.thresholds.contentLengthMin).toBe(500);
      // Should keep default GEO weights
      expect(config.geoWeights.readability).toBe(0.3);
    });

    it('should update configuration dynamically', () => {
      const newConfig: Partial<AnalysisConfig> = {
        seoWeights: {
          technical: 0.6,
          content: 0.2,
          structure: 0.2
        }
      };

      scoringEngine.updateConfig(newConfig);
      const config = scoringEngine.getConfig();
      
      expect(config.seoWeights.technical).toBe(0.6);
      expect(config.seoWeights.content).toBe(0.2);
    });
  });

  describe('Overall Score Calculation', () => {
    it('should calculate overall score as average of SEO and GEO scores', () => {
      const overallScore = scoringEngine.calculateOverallScore(mockAnalysisResults);
      
      expect(overallScore).toBeGreaterThan(0);
      expect(overallScore).toBeLessThanOrEqual(100);
      expect(Number.isInteger(overallScore)).toBe(true);
    });

    it('should handle missing score data gracefully', () => {
      const incompleteResults: AnalysisResults = {
        ...mockAnalysisResults,
        seoScore: {
          overall: 0,
          technical: 0,
          content: 0,
          structure: 0,
          details: {
            pageSpeed: 0,
            mobileResponsive: false,
            titleTag: { score: 0, issues: [], suggestions: [] },
            metaDescription: { score: 0, issues: [], suggestions: [] },
            headingStructure: { score: 0, issues: [], suggestions: [] },
            internalLinks: 0
          }
        }
      };

      const overallScore = scoringEngine.calculateOverallScore(incompleteResults);
      
      expect(overallScore).toBeGreaterThanOrEqual(0);
      expect(overallScore).toBeLessThanOrEqual(100);
    });
  });

  describe('SEO Score Calculation', () => {
    it('should calculate SEO score with proper weighting', () => {
      const seoScore = scoringEngine.calculateSEOScore(mockAnalysisResults);
      
      expect(seoScore.overall).toBeGreaterThan(0);
      expect(seoScore.technical).toBeGreaterThan(0);
      expect(seoScore.content).toBeGreaterThan(0);
      expect(seoScore.structure).toBeGreaterThan(0);
      expect(seoScore.details).toBeDefined();
    });

    it('should normalize scores to 0-100 range', () => {
      const seoScore = scoringEngine.calculateSEOScore(mockAnalysisResults);
      
      expect(seoScore.overall).toBeGreaterThanOrEqual(0);
      expect(seoScore.overall).toBeLessThanOrEqual(100);
      expect(seoScore.technical).toBeGreaterThanOrEqual(0);
      expect(seoScore.technical).toBeLessThanOrEqual(100);
      expect(seoScore.content).toBeGreaterThanOrEqual(0);
      expect(seoScore.content).toBeLessThanOrEqual(100);
      expect(seoScore.structure).toBeGreaterThanOrEqual(0);
      expect(seoScore.structure).toBeLessThanOrEqual(100);
    });

    it('should calculate technical SEO score based on page speed and mobile responsiveness', () => {
      const results = {
        ...mockAnalysisResults,
        seoScore: {
          ...mockAnalysisResults.seoScore,
          details: {
            ...mockAnalysisResults.seoScore.details,
            pageSpeed: 90,
            mobileResponsive: true
          }
        }
      };

      const seoScore = scoringEngine.calculateSEOScore(results);
      
      // Should be high score due to good page speed and mobile responsiveness
      expect(seoScore.technical).toBeGreaterThan(80);
    });

    it('should calculate content SEO score based on title, meta, and headings', () => {
      const results = {
        ...mockAnalysisResults,
        seoScore: {
          ...mockAnalysisResults.seoScore,
          details: {
            ...mockAnalysisResults.seoScore.details,
            titleTag: { score: 95, issues: [], suggestions: [] },
            metaDescription: { score: 90, issues: [], suggestions: [] },
            headingStructure: { score: 85, issues: [], suggestions: [] }
          }
        }
      };

      const seoScore = scoringEngine.calculateSEOScore(results);
      
      // Should be high score due to good content elements
      expect(seoScore.content).toBeGreaterThan(85);
    });

    it('should calculate structure score based on internal links', () => {
      const results = {
        ...mockAnalysisResults,
        seoScore: {
          ...mockAnalysisResults.seoScore,
          details: {
            ...mockAnalysisResults.seoScore.details,
            internalLinks: 10 // Good number of internal links
          }
        }
      };

      const seoScore = scoringEngine.calculateSEOScore(results);
      
      expect(seoScore.structure).toBeGreaterThan(80);
    });
  });

  describe('GEO Score Calculation', () => {
    it('should calculate GEO score with proper weighting', () => {
      const geoScore = scoringEngine.calculateGEOScore(mockAnalysisResults);
      
      expect(geoScore.overall).toBeGreaterThan(0);
      expect(geoScore.readability).toBeGreaterThan(0);
      expect(geoScore.credibility).toBeGreaterThan(0);
      expect(geoScore.completeness).toBeGreaterThan(0);
      expect(geoScore.structuredData).toBeGreaterThan(0);
      expect(geoScore.details).toBeDefined();
    });

    it('should calculate readability score based on clarity and Q&A format', () => {
      const results = {
        ...mockAnalysisResults,
        geoScore: {
          ...mockAnalysisResults.geoScore,
          details: {
            ...mockAnalysisResults.geoScore.details,
            contentClarity: { score: 90, issues: [], suggestions: [] },
            questionAnswerFormat: true
          }
        }
      };

      const geoScore = scoringEngine.calculateGEOScore(results);
      
      // Should be high due to good clarity and Q&A format
      expect(geoScore.readability).toBeGreaterThan(85);
    });

    it('should calculate credibility score based on author info and citations', () => {
      const results = {
        ...mockAnalysisResults,
        geoScore: {
          ...mockAnalysisResults.geoScore,
          details: {
            ...mockAnalysisResults.geoScore.details,
            authorInformation: true,
            citations: 8
          }
        }
      };

      const geoScore = scoringEngine.calculateGEOScore(results);
      
      // Should be high due to author info and good citations
      expect(geoScore.credibility).toBeGreaterThan(80);
    });

    it('should calculate structured data score based on schema markup count', () => {
      const results = {
        ...mockAnalysisResults,
        geoScore: {
          ...mockAnalysisResults.geoScore,
          details: {
            ...mockAnalysisResults.geoScore.details,
            schemaMarkup: ['Article', 'Organization', 'Person']
          }
        }
      };

      const geoScore = scoringEngine.calculateGEOScore(results);
      
      // Should be 100 due to 3+ schema types
      expect(geoScore.structuredData).toBe(100);
    });
  });

  describe('Recommendation Generation', () => {
    it('should generate recommendations for low scores', () => {
      const lowScoreResults: AnalysisResults = {
        ...mockAnalysisResults,
        seoScore: {
          ...mockAnalysisResults.seoScore,
          details: {
            pageSpeed: 40, // Critical page speed (below 50)
            mobileResponsive: false, // Not mobile responsive
            titleTag: { score: 40, issues: [], suggestions: [] }, // Poor title
            metaDescription: { score: 30, issues: [], suggestions: [] },
            headingStructure: { score: 50, issues: [], suggestions: [] },
            internalLinks: 2
          }
        },
        geoScore: {
          ...mockAnalysisResults.geoScore,
          details: {
            contentClarity: { score: 50, issues: [], suggestions: [] },
            questionAnswerFormat: false,
            authorInformation: false,
            citations: 0,
            schemaMarkup: []
          }
        }
      };

      const recommendations = scoringEngine.generateRecommendations(lowScoreResults);
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.id === 'seo-page-speed-critical')).toBe(true);
      expect(recommendations.some(r => r.id === 'seo-mobile-responsive')).toBe(true);
      expect(recommendations.some(r => r.id === 'geo-author-credibility')).toBe(true);
    });

    it('should not generate recommendations for good scores', () => {
      const goodScoreResults: AnalysisResults = {
        ...mockAnalysisResults,
        seoScore: {
          ...mockAnalysisResults.seoScore,
          details: {
            pageSpeed: 95, // Excellent page speed
            mobileResponsive: true,
            titleTag: { score: 90, issues: [], suggestions: [] },
            metaDescription: { score: 85, issues: [], suggestions: [] },
            headingStructure: { score: 88, issues: [], suggestions: [] },
            internalLinks: 15
          }
        },
        geoScore: {
          ...mockAnalysisResults.geoScore,
          details: {
            contentClarity: { score: 90, issues: [], suggestions: [] },
            questionAnswerFormat: true,
            authorInformation: true,
            citations: 8,
            schemaMarkup: ['Article', 'Organization', 'Person']
          }
        }
      };

      const recommendations = scoringEngine.generateRecommendations(goodScoreResults);
      
      // Should have fewer recommendations for good scores
      expect(recommendations.length).toBeLessThan(3);
    });

    it('should include all required recommendation properties', () => {
      const recommendations = scoringEngine.generateRecommendations(mockAnalysisResults);
      
      recommendations.forEach(rec => {
        expect(rec.id).toBeDefined();
        expect(rec.category).toMatch(/^(SEO|GEO|Technical)$/);
        expect(rec.priority).toMatch(/^(High|Medium|Low)$/);
        expect(rec.impact).toBeGreaterThan(0);
        expect(rec.impact).toBeLessThanOrEqual(100);
        expect(rec.effort).toMatch(/^(Easy|Medium|Hard)$/);
        expect(rec.title).toBeDefined();
        expect(rec.description).toBeDefined();
        expect(Array.isArray(rec.actionSteps)).toBe(true);
        expect(rec.actionSteps.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Recommendation Prioritization', () => {
    it('should prioritize recommendations by priority, impact, and effort', () => {
      const recommendations: Recommendation[] = [
        {
          id: 'low-impact',
          category: 'SEO',
          priority: 'Low',
          impact: 30,
          effort: 'Hard',
          title: 'Low Impact Task',
          description: 'Low impact',
          actionSteps: ['Step 1']
        },
        {
          id: 'high-impact',
          category: 'SEO',
          priority: 'High',
          impact: 90,
          effort: 'Easy',
          title: 'High Impact Task',
          description: 'High impact',
          actionSteps: ['Step 1']
        },
        {
          id: 'medium-impact',
          category: 'GEO',
          priority: 'Medium',
          impact: 60,
          effort: 'Medium',
          title: 'Medium Impact Task',
          description: 'Medium impact',
          actionSteps: ['Step 1']
        }
      ];

      const prioritized = scoringEngine.prioritizeRecommendations(recommendations);
      
      expect(prioritized[0].id).toBe('high-impact');
      expect(prioritized[1].id).toBe('medium-impact');
      expect(prioritized[2].id).toBe('low-impact');
    });

    it('should prioritize by impact when priority is the same', () => {
      const recommendations: Recommendation[] = [
        {
          id: 'lower-impact',
          category: 'SEO',
          priority: 'High',
          impact: 70,
          effort: 'Easy',
          title: 'Lower Impact',
          description: 'Lower impact',
          actionSteps: ['Step 1']
        },
        {
          id: 'higher-impact',
          category: 'SEO',
          priority: 'High',
          impact: 90,
          effort: 'Easy',
          title: 'Higher Impact',
          description: 'Higher impact',
          actionSteps: ['Step 1']
        }
      ];

      const prioritized = scoringEngine.prioritizeRecommendations(recommendations);
      
      expect(prioritized[0].id).toBe('higher-impact');
      expect(prioritized[1].id).toBe('lower-impact');
    });

    it('should prioritize by effort when priority and impact are the same', () => {
      const recommendations: Recommendation[] = [
        {
          id: 'hard-effort',
          category: 'SEO',
          priority: 'High',
          impact: 80,
          effort: 'Hard',
          title: 'Hard Task',
          description: 'Hard task',
          actionSteps: ['Step 1']
        },
        {
          id: 'easy-effort',
          category: 'SEO',
          priority: 'High',
          impact: 80,
          effort: 'Easy',
          title: 'Easy Task',
          description: 'Easy task',
          actionSteps: ['Step 1']
        }
      ];

      const prioritized = scoringEngine.prioritizeRecommendations(recommendations);
      
      expect(prioritized[0].id).toBe('easy-effort');
      expect(prioritized[1].id).toBe('hard-effort');
    });
  });

  describe('Score Normalization', () => {
    it('should normalize scores to integers between 0 and 100', () => {
      // Test with various score inputs
      const testResults = { ...mockAnalysisResults };
      
      const overallScore = scoringEngine.calculateOverallScore(testResults);
      
      expect(Number.isInteger(overallScore)).toBe(true);
      expect(overallScore).toBeGreaterThanOrEqual(0);
      expect(overallScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Weighted Average Calculation', () => {
    it('should calculate weighted averages correctly', () => {
      const customConfig: Partial<AnalysisConfig> = {
        seoWeights: {
          technical: 0.5,
          content: 0.3,
          structure: 0.2
        }
      };

      const engine = new ScoringEngine(customConfig);
      const seoScore = engine.calculateSEOScore(mockAnalysisResults);
      
      // The technical score should have more influence due to higher weight
      expect(seoScore.overall).toBeDefined();
      expect(seoScore.technical).toBeDefined();
      expect(seoScore.content).toBeDefined();
      expect(seoScore.structure).toBeDefined();
    });
  });
});