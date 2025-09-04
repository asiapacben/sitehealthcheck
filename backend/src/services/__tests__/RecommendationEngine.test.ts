import { RecommendationEngine, RecommendationTemplate, RecommendationContext } from '../RecommendationEngine';
import { AnalysisResults, Recommendation } from '../../../../shared/types';

describe('RecommendationEngine', () => {
  let engine: RecommendationEngine;
  let mockAnalysisResults: AnalysisResults;

  beforeEach(() => {
    engine = new RecommendationEngine();
    
    // Create comprehensive mock analysis results
    mockAnalysisResults = {
      url: 'https://example.com',
      timestamp: new Date('2024-01-01'),
      overallScore: 65,
      seoScore: {
        overall: 60,
        technical: 45,
        content: 70,
        structure: 65,
        details: {
          pageSpeed: 45,
          mobileResponsive: false,
          titleTag: {
            score: 75,
            issues: ['Title too long'],
            suggestions: ['Shorten title to under 60 characters']
          },
          metaDescription: {
            score: 60,
            issues: ['Missing meta description'],
            suggestions: ['Add compelling meta description']
          },
          headingStructure: {
            score: 80,
            issues: [],
            suggestions: []
          },
          internalLinks: 2
        }
      },
      geoScore: {
        overall: 70,
        readability: 65,
        credibility: 50,
        completeness: 75,
        structuredData: 0,
        details: {
          contentClarity: {
            score: 65,
            issues: ['Complex sentences'],
            suggestions: ['Use simpler language']
          },
          questionAnswerFormat: false,
          authorInformation: false,
          citations: 1,
          schemaMarkup: []
        }
      },
      recommendations: [],
      technicalDetails: {
        loadTime: 3500,
        pageSize: 2048000,
        requests: 45,
        statusCode: 200,
        redirects: 0
      }
    };
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations based on analysis results', () => {
      const recommendations = engine.generateRecommendations(mockAnalysisResults);
      
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should generate page speed recommendation for low scores', () => {
      const recommendations = engine.generateRecommendations(mockAnalysisResults);
      
      const pageSpeedRec = recommendations.find(r => r.id === 'seo-page-speed-critical');
      expect(pageSpeedRec).toBeDefined();
      expect(pageSpeedRec?.category).toBe('SEO');
      expect(pageSpeedRec?.priority).toBe('High');
      expect(pageSpeedRec?.impact).toBe(95);
    });

    it('should generate mobile responsiveness recommendation', () => {
      const recommendations = engine.generateRecommendations(mockAnalysisResults);
      
      const mobileRec = recommendations.find(r => r.id === 'seo-mobile-responsive');
      expect(mobileRec).toBeDefined();
      expect(mobileRec?.title).toBe('Implement Mobile Responsiveness');
      expect(mobileRec?.effort).toBe('Hard');
    });

    it('should generate content clarity recommendation for GEO', () => {
      const recommendations = engine.generateRecommendations(mockAnalysisResults);
      
      const clarityRec = recommendations.find(r => r.id === 'geo-content-clarity');
      expect(clarityRec).toBeDefined();
      expect(clarityRec?.category).toBe('GEO');
      expect(clarityRec?.description).toContain('65/100');
    });

    it('should generate structured data recommendation', () => {
      const recommendations = engine.generateRecommendations(mockAnalysisResults);
      
      const structuredDataRec = recommendations.find(r => r.id === 'tech-structured-data');
      expect(structuredDataRec).toBeDefined();
      expect(structuredDataRec?.category).toBe('Technical');
    });

    it('should not generate recommendations for good scores', () => {
      // Create results with good page speed
      const goodResults = {
        ...mockAnalysisResults,
        seoScore: {
          ...mockAnalysisResults.seoScore,
          details: {
            ...mockAnalysisResults.seoScore.details,
            pageSpeed: 95
          }
        }
      };

      const recommendations = engine.generateRecommendations(goodResults);
      
      const pageSpeedRecs = recommendations.filter(r => 
        r.id === 'seo-page-speed-critical' || r.id === 'seo-page-speed-moderate'
      );
      expect(pageSpeedRecs).toHaveLength(0);
    });

    it('should apply user preferences when provided', () => {
      const context: RecommendationContext = {
        url: 'https://example.com',
        analysisType: 'full',
        timestamp: new Date(),
        userPreferences: {
          focusArea: 'SEO',
          maxRecommendations: 3
        }
      };

      const recommendations = engine.generateRecommendations(mockAnalysisResults, context);
      
      expect(recommendations.length).toBeLessThanOrEqual(3);
      recommendations.forEach(rec => {
        expect(rec.category).toBe('SEO');
      });
    });

    it('should prioritize easy wins when requested', () => {
      const context: RecommendationContext = {
        url: 'https://example.com',
        analysisType: 'full',
        timestamp: new Date(),
        userPreferences: {
          prioritizeEasyWins: true
        }
      };

      const recommendations = engine.generateRecommendations(mockAnalysisResults, context);
      
      // First few recommendations should be easy
      const firstThree = recommendations.slice(0, 3);
      const easyCount = firstThree.filter(rec => rec.effort === 'Easy').length;
      expect(easyCount).toBeGreaterThan(0);
    });
  });

  describe('prioritizeRecommendations', () => {
    it('should sort recommendations by priority score', () => {
      const recommendations: Recommendation[] = [
        {
          id: 'low-priority',
          category: 'SEO',
          priority: 'Low',
          impact: 30,
          effort: 'Hard',
          title: 'Low Priority Task',
          description: 'Low priority recommendation',
          actionSteps: ['Step 1']
        },
        {
          id: 'high-priority',
          category: 'SEO',
          priority: 'High',
          impact: 90,
          effort: 'Easy',
          title: 'High Priority Task',
          description: 'High priority recommendation',
          actionSteps: ['Step 1']
        },
        {
          id: 'medium-priority',
          category: 'SEO',
          priority: 'Medium',
          impact: 60,
          effort: 'Medium',
          title: 'Medium Priority Task',
          description: 'Medium priority recommendation',
          actionSteps: ['Step 1']
        }
      ];

      const prioritized = engine.prioritizeRecommendations(recommendations);
      
      expect(prioritized[0].id).toBe('high-priority');
      expect(prioritized[1].id).toBe('medium-priority');
      expect(prioritized[2].id).toBe('low-priority');
    });

    it('should prioritize high impact over low impact for same priority', () => {
      const recommendations: Recommendation[] = [
        {
          id: 'low-impact',
          category: 'SEO',
          priority: 'High',
          impact: 40,
          effort: 'Easy',
          title: 'Low Impact Task',
          description: 'Low impact recommendation',
          actionSteps: ['Step 1']
        },
        {
          id: 'high-impact',
          category: 'SEO',
          priority: 'High',
          impact: 90,
          effort: 'Easy',
          title: 'High Impact Task',
          description: 'High impact recommendation',
          actionSteps: ['Step 1']
        }
      ];

      const prioritized = engine.prioritizeRecommendations(recommendations);
      
      expect(prioritized[0].id).toBe('high-impact');
      expect(prioritized[1].id).toBe('low-impact');
    });

    it('should prioritize easier tasks over harder ones for same priority and impact', () => {
      const recommendations: Recommendation[] = [
        {
          id: 'hard-task',
          category: 'SEO',
          priority: 'High',
          impact: 80,
          effort: 'Hard',
          title: 'Hard Task',
          description: 'Hard recommendation',
          actionSteps: ['Step 1']
        },
        {
          id: 'easy-task',
          category: 'SEO',
          priority: 'High',
          impact: 80,
          effort: 'Easy',
          title: 'Easy Task',
          description: 'Easy recommendation',
          actionSteps: ['Step 1']
        }
      ];

      const prioritized = engine.prioritizeRecommendations(recommendations);
      
      expect(prioritized[0].id).toBe('easy-task');
      expect(prioritized[1].id).toBe('hard-task');
    });
  });

  describe('getRecommendationsByCategory', () => {
    it('should filter recommendations by category', () => {
      const recommendations = engine.generateRecommendations(mockAnalysisResults);
      
      const seoRecs = engine.getRecommendationsByCategory(recommendations, 'SEO');
      const geoRecs = engine.getRecommendationsByCategory(recommendations, 'GEO');
      const techRecs = engine.getRecommendationsByCategory(recommendations, 'Technical');
      
      seoRecs.forEach(rec => expect(rec.category).toBe('SEO'));
      geoRecs.forEach(rec => expect(rec.category).toBe('GEO'));
      techRecs.forEach(rec => expect(rec.category).toBe('Technical'));
    });
  });

  describe('getQuickWins', () => {
    it('should return high-impact, easy recommendations', () => {
      const recommendations = engine.generateRecommendations(mockAnalysisResults);
      const quickWins = engine.getQuickWins(recommendations);
      
      quickWins.forEach(rec => {
        expect(rec.impact).toBeGreaterThanOrEqual(70);
        expect(rec.effort).toBe('Easy');
        expect(rec.priority).toBe('High');
      });
    });
  });

  describe('template management', () => {
    it('should allow adding custom templates', () => {
      const customTemplate: RecommendationTemplate = {
        id: 'custom-test',
        category: 'SEO',
        condition: () => true,
        priority: 'Medium',
        impact: 50,
        effort: 'Easy',
        title: 'Custom Test Recommendation',
        description: () => 'Custom test description',
        actionSteps: ['Custom step 1', 'Custom step 2']
      };

      engine.addTemplate(customTemplate);
      
      const recommendations = engine.generateRecommendations(mockAnalysisResults);
      const customRec = recommendations.find(r => r.id === 'custom-test');
      
      expect(customRec).toBeDefined();
      expect(customRec?.title).toBe('Custom Test Recommendation');
    });

    it('should allow removing templates', () => {
      const initialTemplates = engine.getTemplates();
      const templateToRemove = initialTemplates[0];
      
      engine.removeTemplate(templateToRemove.id);
      
      const updatedTemplates = engine.getTemplates();
      expect(updatedTemplates.length).toBe(initialTemplates.length - 1);
      expect(updatedTemplates.find(t => t.id === templateToRemove.id)).toBeUndefined();
    });

    it('should return all templates', () => {
      const templates = engine.getTemplates();
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      
      // Check that we have templates for all categories
      const categories = templates.map(t => t.category);
      expect(categories).toContain('SEO');
      expect(categories).toContain('GEO');
      expect(categories).toContain('Technical');
    });
  });

  describe('recommendation content quality', () => {
    it('should include actionable steps in all recommendations', () => {
      const recommendations = engine.generateRecommendations(mockAnalysisResults);
      
      recommendations.forEach(rec => {
        expect(rec.actionSteps).toBeDefined();
        expect(Array.isArray(rec.actionSteps)).toBe(true);
        expect(rec.actionSteps.length).toBeGreaterThan(0);
        
        // Each action step should be a non-empty string
        rec.actionSteps.forEach(step => {
          expect(typeof step).toBe('string');
          expect(step.length).toBeGreaterThan(0);
        });
      });
    });

    it('should include examples where available', () => {
      const recommendations = engine.generateRecommendations(mockAnalysisResults);
      
      const recsWithExamples = recommendations.filter(rec => rec.example);
      expect(recsWithExamples.length).toBeGreaterThan(0);
      
      recsWithExamples.forEach(rec => {
        expect(typeof rec.example).toBe('string');
        expect(rec.example!.length).toBeGreaterThan(0);
      });
    });

    it('should have meaningful titles and descriptions', () => {
      const recommendations = engine.generateRecommendations(mockAnalysisResults);
      
      recommendations.forEach(rec => {
        expect(rec.title).toBeDefined();
        expect(typeof rec.title).toBe('string');
        expect(rec.title.length).toBeGreaterThan(0);
        
        expect(rec.description).toBeDefined();
        expect(typeof rec.description).toBe('string');
        expect(rec.description.length).toBeGreaterThan(0);
      });
    });

    it('should assign appropriate impact and effort scores', () => {
      const recommendations = engine.generateRecommendations(mockAnalysisResults);
      
      recommendations.forEach(rec => {
        expect(rec.impact).toBeGreaterThanOrEqual(0);
        expect(rec.impact).toBeLessThanOrEqual(100);
        expect(['Easy', 'Medium', 'Hard']).toContain(rec.effort);
        expect(['High', 'Medium', 'Low']).toContain(rec.priority);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty analysis results gracefully', () => {
      const emptyResults: AnalysisResults = {
        url: 'https://example.com',
        timestamp: new Date(),
        overallScore: 0,
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
        },
        geoScore: {
          overall: 0,
          readability: 0,
          credibility: 0,
          completeness: 0,
          structuredData: 0,
          details: {
            contentClarity: { score: 0, issues: [], suggestions: [] },
            questionAnswerFormat: false,
            authorInformation: false,
            citations: 0,
            schemaMarkup: []
          }
        },
        recommendations: [],
        technicalDetails: {
          loadTime: 0,
          pageSize: 0,
          requests: 0,
          statusCode: 200,
          redirects: 0
        }
      };

      const recommendations = engine.generateRecommendations(emptyResults);
      
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      // Should still generate recommendations for poor scores
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should handle perfect analysis results', () => {
      const perfectResults: AnalysisResults = {
        url: 'https://example.com',
        timestamp: new Date(),
        overallScore: 100,
        seoScore: {
          overall: 100,
          technical: 100,
          content: 100,
          structure: 100,
          details: {
            pageSpeed: 100,
            mobileResponsive: true,
            titleTag: { score: 100, issues: [], suggestions: [] },
            metaDescription: { score: 100, issues: [], suggestions: [] },
            headingStructure: { score: 100, issues: [], suggestions: [] },
            internalLinks: 10
          }
        },
        geoScore: {
          overall: 100,
          readability: 100,
          credibility: 100,
          completeness: 100,
          structuredData: 100,
          details: {
            contentClarity: { score: 100, issues: [], suggestions: [] },
            questionAnswerFormat: true,
            authorInformation: true,
            citations: 10,
            schemaMarkup: ['Article', 'Organization', 'Person']
          }
        },
        recommendations: [],
        technicalDetails: {
          loadTime: 500,
          pageSize: 500000,
          requests: 10,
          statusCode: 200,
          redirects: 0
        }
      };

      const recommendations = engine.generateRecommendations(perfectResults);
      
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      // Should generate few or no recommendations for perfect scores
      expect(recommendations.length).toBeLessThan(3);
    });
  });
});