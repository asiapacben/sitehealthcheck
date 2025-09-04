import { ResultsAggregator } from '../services/ResultsAggregator';
import { AnalysisResults, AnalysisSession } from '../../../shared/types';

/**
 * Demo script showing how to use the ResultsAggregator service
 * This demonstrates the complete workflow of aggregating, storing, and retrieving analysis results
 */
async function demonstrateResultsAggregation() {
  console.log('🚀 Starting Results Aggregation Demo\n');

  // Initialize the aggregator
  const aggregator = new ResultsAggregator();

  // Sample analysis results (would normally come from analysis engines)
  const sampleResults: AnalysisResults[] = [
    {
      url: 'https://example.com/home',
      timestamp: new Date('2024-01-15T10:00:00Z'),
      overallScore: 92,
      seoScore: {
        overall: 90,
        technical: 95,
        content: 88,
        structure: 87,
        details: {
          pageSpeed: 95,
          mobileResponsive: true,
          titleTag: { score: 90, issues: [], suggestions: ['Add more descriptive keywords'] },
          metaDescription: { score: 85, issues: [], suggestions: [] },
          headingStructure: { score: 88, issues: [], suggestions: [] },
          internalLinks: 15
        }
      },
      geoScore: {
        overall: 94,
        readability: 92,
        credibility: 96,
        completeness: 94,
        structuredData: 94,
        details: {
          contentClarity: { score: 92, issues: [], suggestions: [] },
          questionAnswerFormat: true,
          authorInformation: true,
          citations: 8,
          schemaMarkup: ['Article', 'Organization', 'WebPage']
        }
      },
      recommendations: [
        {
          id: 'rec1',
          category: 'SEO',
          priority: 'Medium',
          impact: 6,
          effort: 'Easy',
          title: 'Enhance title tag keywords',
          description: 'Add more specific keywords to improve search relevance',
          actionSteps: ['Research target keywords', 'Update title tag', 'Test changes']
        }
      ],
      technicalDetails: {
        loadTime: 1800,
        pageSize: 850000,
        requests: 18,
        statusCode: 200,
        redirects: 0
      }
    },
    {
      url: 'https://example.com/about',
      timestamp: new Date('2024-01-15T10:05:00Z'),
      overallScore: 78,
      seoScore: {
        overall: 75,
        technical: 80,
        content: 70,
        structure: 75,
        details: {
          pageSpeed: 82,
          mobileResponsive: true,
          titleTag: { score: 70, issues: ['Too generic'], suggestions: ['Make more specific'] },
          metaDescription: { score: 68, issues: ['Too short'], suggestions: ['Expand description'] },
          headingStructure: { score: 75, issues: [], suggestions: [] },
          internalLinks: 8
        }
      },
      geoScore: {
        overall: 81,
        readability: 78,
        credibility: 85,
        completeness: 80,
        structuredData: 81,
        details: {
          contentClarity: { score: 78, issues: [], suggestions: [] },
          questionAnswerFormat: false,
          authorInformation: true,
          citations: 3,
          schemaMarkup: ['Organization', 'WebPage']
        }
      },
      recommendations: [
        {
          id: 'rec2',
          category: 'SEO',
          priority: 'High',
          impact: 8,
          effort: 'Easy',
          title: 'Improve title and meta description',
          description: 'Make title more specific and expand meta description',
          actionSteps: ['Rewrite title tag', 'Expand meta description', 'Add relevant keywords']
        },
        {
          id: 'rec3',
          category: 'GEO',
          priority: 'Medium',
          impact: 7,
          effort: 'Medium',
          title: 'Add Q&A format content',
          description: 'Structure content in question-answer format for better AI understanding',
          actionSteps: ['Identify common questions', 'Restructure content', 'Add FAQ section']
        }
      ],
      technicalDetails: {
        loadTime: 2400,
        pageSize: 1200000,
        requests: 28,
        statusCode: 200,
        redirects: 1
      }
    },
    {
      url: 'https://example.com/services',
      timestamp: new Date('2024-01-15T10:10:00Z'),
      overallScore: 65,
      seoScore: {
        overall: 62,
        technical: 58,
        content: 65,
        structure: 63,
        details: {
          pageSpeed: 65,
          mobileResponsive: false,
          titleTag: { score: 75, issues: [], suggestions: [] },
          metaDescription: { score: 70, issues: [], suggestions: [] },
          headingStructure: { score: 60, issues: ['Missing H1'], suggestions: ['Add H1 tag'] },
          internalLinks: 5
        }
      },
      geoScore: {
        overall: 68,
        readability: 65,
        credibility: 70,
        completeness: 68,
        structuredData: 69,
        details: {
          contentClarity: { score: 65, issues: [], suggestions: [] },
          questionAnswerFormat: false,
          authorInformation: false,
          citations: 1,
          schemaMarkup: ['Service', 'WebPage']
        }
      },
      recommendations: [
        {
          id: 'rec4',
          category: 'Technical',
          priority: 'High',
          impact: 9,
          effort: 'Medium',
          title: 'Fix mobile responsiveness',
          description: 'Implement responsive design for mobile devices',
          actionSteps: ['Add viewport meta tag', 'Update CSS for mobile', 'Test on devices']
        },
        {
          id: 'rec5',
          category: 'SEO',
          priority: 'High',
          impact: 8,
          effort: 'Easy',
          title: 'Add missing H1 tag',
          description: 'Add proper H1 heading to improve page structure',
          actionSteps: ['Add H1 tag', 'Ensure proper heading hierarchy']
        }
      ],
      technicalDetails: {
        loadTime: 3200,
        pageSize: 1800000,
        requests: 42,
        statusCode: 200,
        redirects: 0
      }
    }
  ];

  try {
    // Step 1: Aggregate the results
    console.log('📊 Step 1: Aggregating analysis results...');
    const storedResults = await aggregator.aggregateResults(sampleResults);
    console.log(`✅ Aggregated ${storedResults.length} results with metadata\n`);

    // Step 2: Store the results
    console.log('💾 Step 2: Storing results...');
    await aggregator.storeResults(storedResults);
    console.log('✅ Results stored successfully\n');

    // Step 3: Create and store an analysis session
    console.log('📝 Step 3: Creating analysis session...');
    const session: AnalysisSession = {
      id: 'demo-session-001',
      domain: 'example.com',
      urls: sampleResults.map(r => r.url),
      status: 'completed',
      progress: 100,
      results: storedResults,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date()
    };
    await aggregator.storeSession(session);
    console.log('✅ Analysis session created\n');

    // Step 4: Demonstrate various retrieval methods
    console.log('🔍 Step 4: Demonstrating retrieval capabilities...\n');

    // Get all results
    const allResults = await aggregator.retrieveResults();
    console.log(`📈 Total results: ${allResults.totalResults}`);
    console.log(`📊 Average score: ${allResults.summary.averageScore}`);
    console.log(`🎯 Score distribution:`, allResults.summary.scoreDistribution);
    console.log(`⚠️  Common issues: ${allResults.summary.commonIssues.slice(0, 3).join(', ')}\n`);

    // Filter by score range
    const highScoreResults = await aggregator.retrieveResults({
      filter: { minScore: 80 }
    });
    console.log(`🏆 High-scoring pages (80+): ${highScoreResults.totalResults}`);

    // Filter by category
    const technicalIssues = await aggregator.retrieveResults({
      filter: { categories: ['Technical'] }
    });
    console.log(`🔧 Pages with technical issues: ${technicalIssues.totalResults}`);

    // Sort by score
    const sortedResults = await aggregator.retrieveResults({
      sortBy: 'overallScore',
      sortOrder: 'desc'
    });
    console.log(`📊 Top scoring page: ${sortedResults.results[0]?.url} (${sortedResults.results[0]?.overallScore})`);
    console.log(`📉 Lowest scoring page: ${sortedResults.results[sortedResults.results.length - 1]?.url} (${sortedResults.results[sortedResults.results.length - 1]?.overallScore})\n`);

    // Step 5: Demonstrate individual result retrieval
    console.log('🔎 Step 5: Individual result retrieval...');
    const firstResult = await aggregator.getResultById(storedResults[0].id);
    if (firstResult) {
      console.log(`✅ Retrieved result for: ${firstResult.url}`);
      console.log(`📊 Score: ${firstResult.overallScore}`);
      console.log(`📝 Recommendations: ${firstResult.recommendations.length}\n`);
    }

    // Step 6: Demonstrate session retrieval
    console.log('📋 Step 6: Session retrieval...');
    const retrievedSession = await aggregator.getSessionResults('demo-session-001');
    if (retrievedSession) {
      console.log(`✅ Retrieved session: ${retrievedSession.id}`);
      console.log(`🌐 Domain: ${retrievedSession.domain}`);
      console.log(`📊 Status: ${retrievedSession.status}`);
      console.log(`📈 Progress: ${retrievedSession.progress}%\n`);
    }

    // Step 7: Show storage statistics
    console.log('📊 Step 7: Storage statistics...');
    const stats = aggregator.getStorageStats();
    console.log(`📁 Total results: ${stats.totalResults}`);
    console.log(`📝 Total sessions: ${stats.totalSessions}`);
    console.log(`🌐 Domains analyzed: ${stats.domains.join(', ')}\n`);

    // Step 8: Demonstrate top recommendations
    console.log('💡 Step 8: Top recommendations across all pages...');
    allResults.summary.topRecommendations.forEach((rec, index) => {
      console.log(`${index + 1}. [${rec.priority}] ${rec.title}`);
      console.log(`   Category: ${rec.category} | Impact: ${rec.impact}/10 | Effort: ${rec.effort}`);
    });

    console.log('\n🎉 Results Aggregation Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Clean up for demo purposes
    aggregator.clearAll();
    console.log('🧹 Demo data cleared');
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateResultsAggregation().catch(console.error);
}

export { demonstrateResultsAggregation };