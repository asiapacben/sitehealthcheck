/**
 * Demonstration of the RecommendationEngine functionality
 * This example shows how to use the RecommendationEngine to generate
 * actionable recommendations based on analysis results.
 */

import { RecommendationEngine, RecommendationContext } from '../services/RecommendationEngine';
import { AnalysisResults } from '../../../shared/types';

// Example analysis results for a poorly optimized website
const poorWebsiteResults: AnalysisResults = {
  url: 'https://example-poor-seo.com',
  timestamp: new Date('2024-01-15'),
  overallScore: 35,
  seoScore: {
    overall: 30,
    technical: 25,
    content: 40,
    structure: 25,
    details: {
      pageSpeed: 35, // Critical page speed issue
      mobileResponsive: false, // Not mobile responsive
      titleTag: {
        score: 45,
        issues: ['Title too long', 'Missing primary keyword'],
        suggestions: ['Shorten title', 'Add primary keyword']
      },
      metaDescription: {
        score: 30,
        issues: ['Missing meta description'],
        suggestions: ['Add compelling meta description']
      },
      headingStructure: {
        score: 60,
        issues: ['Missing H1 tag'],
        suggestions: ['Add proper H1 tag']
      },
      internalLinks: 1 // Very few internal links
    }
  },
  geoScore: {
    overall: 40,
    readability: 35,
    credibility: 20,
    completeness: 60,
    structuredData: 0,
    details: {
      contentClarity: {
        score: 35,
        issues: ['Complex sentences', 'Technical jargon'],
        suggestions: ['Simplify language', 'Define technical terms']
      },
      questionAnswerFormat: false,
      authorInformation: false,
      citations: 0,
      schemaMarkup: []
    }
  },
  recommendations: [],
  technicalDetails: {
    loadTime: 4500,
    pageSize: 3200000,
    requests: 85,
    statusCode: 200,
    redirects: 2
  }
};

// Example analysis results for a well-optimized website
const goodWebsiteResults: AnalysisResults = {
  url: 'https://example-good-seo.com',
  timestamp: new Date('2024-01-15'),
  overallScore: 88,
  seoScore: {
    overall: 90,
    technical: 95,
    content: 85,
    structure: 90,
    details: {
      pageSpeed: 92,
      mobileResponsive: true,
      titleTag: {
        score: 85,
        issues: [],
        suggestions: []
      },
      metaDescription: {
        score: 88,
        issues: [],
        suggestions: []
      },
      headingStructure: {
        score: 90,
        issues: [],
        suggestions: []
      },
      internalLinks: 12
    }
  },
  geoScore: {
    overall: 86,
    readability: 85,
    credibility: 90,
    completeness: 80,
    structuredData: 90,
    details: {
      contentClarity: {
        score: 85,
        issues: [],
        suggestions: []
      },
      questionAnswerFormat: true,
      authorInformation: true,
      citations: 8,
      schemaMarkup: ['Article', 'Organization', 'Person']
    }
  },
  recommendations: [],
  technicalDetails: {
    loadTime: 1200,
    pageSize: 800000,
    requests: 25,
    statusCode: 200,
    redirects: 0
  }
};

function demonstrateRecommendationEngine() {
  console.log('🚀 RecommendationEngine Demonstration\n');
  
  const engine = new RecommendationEngine();

  // Demo 1: Generate recommendations for a poorly optimized website
  console.log('📊 Demo 1: Poorly Optimized Website');
  console.log('=====================================');
  console.log(`URL: ${poorWebsiteResults.url}`);
  console.log(`Overall Score: ${poorWebsiteResults.overallScore}/100\n`);

  const poorRecommendations = engine.generateRecommendations(poorWebsiteResults);
  
  console.log(`Generated ${poorRecommendations.length} recommendations:\n`);
  
  poorRecommendations.slice(0, 5).forEach((rec, index) => {
    console.log(`${index + 1}. ${rec.title}`);
    console.log(`   Category: ${rec.category} | Priority: ${rec.priority} | Impact: ${rec.impact} | Effort: ${rec.effort}`);
    console.log(`   Description: ${rec.description}`);
    console.log(`   Action Steps: ${rec.actionSteps.slice(0, 2).join(', ')}...`);
    if (rec.example) {
      console.log(`   Example: ${rec.example}`);
    }
    console.log('');
  });

  // Demo 2: Generate recommendations for a well-optimized website
  console.log('\n📊 Demo 2: Well-Optimized Website');
  console.log('==================================');
  console.log(`URL: ${goodWebsiteResults.url}`);
  console.log(`Overall Score: ${goodWebsiteResults.overallScore}/100\n`);

  const goodRecommendations = engine.generateRecommendations(goodWebsiteResults);
  
  console.log(`Generated ${goodRecommendations.length} recommendations (fewer for good sites):\n`);
  
  goodRecommendations.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec.title} (${rec.category})`);
  });

  // Demo 3: Filter recommendations by category
  console.log('\n📊 Demo 3: Recommendations by Category');
  console.log('======================================');
  
  const seoRecs = engine.getRecommendationsByCategory(poorRecommendations, 'SEO');
  const geoRecs = engine.getRecommendationsByCategory(poorRecommendations, 'GEO');
  const techRecs = engine.getRecommendationsByCategory(poorRecommendations, 'Technical');
  
  console.log(`SEO Recommendations: ${seoRecs.length}`);
  console.log(`GEO Recommendations: ${geoRecs.length}`);
  console.log(`Technical Recommendations: ${techRecs.length}\n`);

  // Demo 4: Get quick wins (high-impact, easy tasks)
  console.log('📊 Demo 4: Quick Wins (High Impact + Easy Implementation)');
  console.log('=========================================================');
  
  const quickWins = engine.getQuickWins(poorRecommendations);
  
  console.log(`Found ${quickWins.length} quick wins:\n`);
  
  quickWins.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec.title}`);
    console.log(`   Impact: ${rec.impact} | Effort: ${rec.effort} | Priority: ${rec.priority}\n`);
  });

  // Demo 5: User preferences and context
  console.log('📊 Demo 5: Applying User Preferences');
  console.log('====================================');
  
  const context: RecommendationContext = {
    url: poorWebsiteResults.url,
    analysisType: 'full',
    timestamp: new Date(),
    userPreferences: {
      focusArea: 'SEO',
      prioritizeEasyWins: true,
      maxRecommendations: 3
    }
  };
  
  const filteredRecs = engine.generateRecommendations(poorWebsiteResults, context);
  
  console.log('User preferences: Focus on SEO, prioritize easy wins, max 3 recommendations\n');
  console.log(`Filtered to ${filteredRecs.length} recommendations:\n`);
  
  filteredRecs.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec.title}`);
    console.log(`   Category: ${rec.category} | Effort: ${rec.effort}\n`);
  });

  // Demo 6: Before/After Examples
  console.log('📊 Demo 6: Before/After Examples');
  console.log('=================================');
  
  const templates = engine.getTemplates();
  const templatesWithExamples = templates.filter(t => t.beforeAfterExample);
  
  console.log(`Found ${templatesWithExamples.length} templates with before/after examples:\n`);
  
  templatesWithExamples.slice(0, 2).forEach((template, index) => {
    console.log(`${index + 1}. ${template.title}`);
    if (template.beforeAfterExample) {
      console.log(`   Before: ${template.beforeAfterExample.before}`);
      console.log(`   After: ${template.beforeAfterExample.after}`);
      console.log(`   Explanation: ${template.beforeAfterExample.explanation}\n`);
    }
  });

  console.log('✅ RecommendationEngine demonstration complete!');
}

// Run the demonstration
if (require.main === module) {
  demonstrateRecommendationEngine();
}

export { demonstrateRecommendationEngine, poorWebsiteResults, goodWebsiteResults };