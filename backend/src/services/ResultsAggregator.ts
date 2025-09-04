import { 
  AnalysisResults, 
  StoredAnalysisResults, 
  AnalysisSession,
  ResultsQuery, 
  AggregatedResults, 
  ResultsFilter,
  Recommendation 
} from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * ResultsAggregator handles the aggregation, storage, and retrieval of analysis results
 * Provides in-memory storage with persistence capabilities for analysis data
 */
export class ResultsAggregator {
  private results: Map<string, StoredAnalysisResults> = new Map();
  private sessions: Map<string, AnalysisSession> = new Map();
  private readonly analysisVersion = '1.0.0';

  /**
   * Aggregates analysis results and prepares them for storage
   * @param results Array of analysis results to aggregate
   * @returns Promise resolving to stored analysis results with metadata
   */
  async aggregateResults(results: AnalysisResults[]): Promise<StoredAnalysisResults[]> {
    try {
      logger.info(`Aggregating ${results.length} analysis results`);
      
      const storedResults: StoredAnalysisResults[] = results.map(result => {
        const id = uuidv4();
        const domain = this.extractDomain(result.url);
        const now = new Date();
        
        return {
          ...result,
          id,
          domain,
          analysisVersion: this.analysisVersion,
          createdAt: now,
          updatedAt: now,
          metadata: {
            aggregatedAt: now.toISOString(),
            resultCount: results.length
          }
        };
      });

      logger.info(`Successfully aggregated ${storedResults.length} results`);
      return storedResults;
    } catch (error) {
      logger.error('Error aggregating results:', error);
      throw new Error(`Failed to aggregate results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stores analysis results in memory with indexing
   * @param results Array of stored analysis results to persist
   */
  async storeResults(results: StoredAnalysisResults[]): Promise<void> {
    try {
      logger.info(`Storing ${results.length} analysis results`);
      
      for (const result of results) {
        result.updatedAt = new Date();
        this.results.set(result.id, result);
      }

      logger.info(`Successfully stored ${results.length} results`);
    } catch (error) {
      logger.error('Error storing results:', error);
      throw new Error(`Failed to store results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieves and filters analysis results based on query parameters
   * @param query Query parameters for filtering and sorting results
   * @returns Promise resolving to aggregated results with summary
   */
  async retrieveResults(query: ResultsQuery = {}): Promise<AggregatedResults> {
    try {
      logger.info('Retrieving analysis results with query:', query);
      
      let filteredResults = Array.from(this.results.values());

      // Apply filters
      if (query.filter) {
        filteredResults = this.applyFilters(filteredResults, query.filter);
      }

      // Apply sorting
      if (query.sortBy) {
        filteredResults = this.applySorting(filteredResults, query.sortBy, query.sortOrder || 'desc');
      }

      // Apply pagination
      const totalResults = filteredResults.length;
      if (query.filter?.limit || query.filter?.offset) {
        const offset = query.filter.offset || 0;
        const limit = query.filter.limit || 50;
        filteredResults = filteredResults.slice(offset, offset + limit);
      }

      // Generate summary
      const summary = this.generateSummary(filteredResults);

      logger.info(`Retrieved ${filteredResults.length} of ${totalResults} total results`);
      
      return {
        totalResults,
        results: filteredResults,
        summary
      };
    } catch (error) {
      logger.error('Error retrieving results:', error);
      throw new Error(`Failed to retrieve results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieves a specific analysis result by ID
   * @param id Unique identifier of the analysis result
   * @returns Promise resolving to the stored analysis result or null if not found
   */
  async getResultById(id: string): Promise<StoredAnalysisResults | null> {
    try {
      logger.info(`Retrieving result by ID: ${id}`);
      
      const result = this.results.get(id) || null;
      
      if (result) {
        logger.info(`Found result for ID: ${id}`);
      } else {
        logger.warn(`No result found for ID: ${id}`);
      }
      
      return result;
    } catch (error) {
      logger.error('Error retrieving result by ID:', error);
      throw new Error(`Failed to retrieve result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deletes analysis results by their IDs
   * @param ids Array of result IDs to delete
   */
  async deleteResults(ids: string[]): Promise<void> {
    try {
      logger.info(`Deleting ${ids.length} analysis results`);
      
      let deletedCount = 0;
      for (const id of ids) {
        if (this.results.delete(id)) {
          deletedCount++;
        }
      }

      logger.info(`Successfully deleted ${deletedCount} of ${ids.length} results`);
    } catch (error) {
      logger.error('Error deleting results:', error);
      throw new Error(`Failed to delete results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Creates or updates an analysis session
   * @param session Analysis session to store
   */
  async storeSession(session: AnalysisSession): Promise<void> {
    try {
      logger.info(`Storing analysis session: ${session.id}`);
      
      session.updatedAt = new Date();
      this.sessions.set(session.id, session);
      
      logger.info(`Successfully stored session: ${session.id}`);
    } catch (error) {
      logger.error('Error storing session:', error);
      throw new Error(`Failed to store session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieves an analysis session by ID
   * @param sessionId Unique identifier of the analysis session
   * @returns Promise resolving to the analysis session or null if not found
   */
  async getSessionResults(sessionId: string): Promise<AnalysisSession | null> {
    try {
      logger.info(`Retrieving session results for ID: ${sessionId}`);
      
      const session = this.sessions.get(sessionId) || null;
      
      if (session) {
        logger.info(`Found session for ID: ${sessionId}`);
      } else {
        logger.warn(`No session found for ID: ${sessionId}`);
      }
      
      return session;
    } catch (error) {
      logger.error('Error retrieving session results:', error);
      throw new Error(`Failed to retrieve session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets storage statistics
   * @returns Object containing storage metrics
   */
  getStorageStats(): { totalResults: number; totalSessions: number; domains: string[] } {
    const domains = Array.from(new Set(Array.from(this.results.values()).map(r => r.domain)));
    
    return {
      totalResults: this.results.size,
      totalSessions: this.sessions.size,
      domains
    };
  }

  /**
   * Clears all stored data (useful for testing)
   */
  clearAll(): void {
    this.results.clear();
    this.sessions.clear();
    logger.info('Cleared all stored results and sessions');
  }

  // Private helper methods

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  }

  private applyFilters(results: StoredAnalysisResults[], filter: ResultsFilter): StoredAnalysisResults[] {
    return results.filter(result => {
      // Domain filter
      if (filter.domain && result.domain !== filter.domain) {
        return false;
      }

      // Date range filter
      if (filter.dateFrom && result.timestamp < filter.dateFrom) {
        return false;
      }
      if (filter.dateTo && result.timestamp > filter.dateTo) {
        return false;
      }

      // Score range filter
      if (filter.minScore !== undefined && result.overallScore < filter.minScore) {
        return false;
      }
      if (filter.maxScore !== undefined && result.overallScore > filter.maxScore) {
        return false;
      }

      // Category filter
      if (filter.categories && filter.categories.length > 0) {
        const hasMatchingCategory = result.recommendations.some(rec => 
          filter.categories!.includes(rec.category)
        );
        if (!hasMatchingCategory) {
          return false;
        }
      }

      return true;
    });
  }

  private applySorting(
    results: StoredAnalysisResults[], 
    sortBy: 'timestamp' | 'overallScore' | 'domain',
    sortOrder: 'asc' | 'desc'
  ): StoredAnalysisResults[] {
    return results.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'timestamp':
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case 'overallScore':
          comparison = a.overallScore - b.overallScore;
          break;
        case 'domain':
          comparison = a.domain.localeCompare(b.domain);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  private generateSummary(results: StoredAnalysisResults[]): AggregatedResults['summary'] {
    if (results.length === 0) {
      return {
        averageScore: 0,
        scoreDistribution: {},
        commonIssues: [],
        topRecommendations: []
      };
    }

    // Calculate average score
    const averageScore = results.reduce((sum, result) => sum + result.overallScore, 0) / results.length;

    // Generate score distribution
    const scoreDistribution: Record<string, number> = {
      'Excellent (90-100)': 0,
      'Good (70-89)': 0,
      'Fair (50-69)': 0,
      'Poor (0-49)': 0
    };

    results.forEach(result => {
      if (result.overallScore >= 90) scoreDistribution['Excellent (90-100)']++;
      else if (result.overallScore >= 70) scoreDistribution['Good (70-89)']++;
      else if (result.overallScore >= 50) scoreDistribution['Fair (50-69)']++;
      else scoreDistribution['Poor (0-49)']++;
    });

    // Find common issues
    const issueCount: Record<string, number> = {};
    results.forEach(result => {
      result.recommendations.forEach(rec => {
        issueCount[rec.title] = (issueCount[rec.title] || 0) + 1;
      });
    });

    const commonIssues = Object.entries(issueCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([issue]) => issue);

    // Get top recommendations
    const allRecommendations = results.flatMap(result => result.recommendations);
    const topRecommendations = this.getTopRecommendations(allRecommendations);

    return {
      averageScore: Math.round(averageScore * 100) / 100,
      scoreDistribution,
      commonIssues,
      topRecommendations
    };
  }

  private getTopRecommendations(recommendations: Recommendation[]): Recommendation[] {
    // Group recommendations by title and calculate frequency
    const recommendationGroups: Record<string, { recommendation: Recommendation; count: number }> = {};
    
    recommendations.forEach(rec => {
      if (!recommendationGroups[rec.title]) {
        recommendationGroups[rec.title] = { recommendation: rec, count: 0 };
      }
      recommendationGroups[rec.title].count++;
    });

    // Sort by frequency and priority, return top 5
    return Object.values(recommendationGroups)
      .sort((a, b) => {
        // First sort by count (frequency)
        if (a.count !== b.count) {
          return b.count - a.count;
        }
        // Then by priority (High > Medium > Low)
        const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
        return priorityOrder[b.recommendation.priority] - priorityOrder[a.recommendation.priority];
      })
      .slice(0, 5)
      .map(group => group.recommendation);
  }
}