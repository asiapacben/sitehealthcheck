import {
  AnalysisResults,
  AnalysisConfig,
  SEOScore,
  GEOScore,
  Recommendation
} from '../../../shared/types';
import { ScoringConfigManager } from '../utils/ScoringConfig';
import { RecommendationEngine } from './RecommendationEngine';

export class ScoringEngine {
  private config: AnalysisConfig;
  private recommendationEngine: RecommendationEngine;

  constructor(config?: Partial<AnalysisConfig>) {
    if (config) {
      this.config = this.mergeWithDefaults(config);
    } else {
      // Load configuration from file or use defaults
      this.config = ScoringConfigManager.loadConfig();
    }
    
    this.recommendationEngine = new RecommendationEngine();
  }

  /**
   * Calculate overall score combining SEO and GEO factors
   */
  calculateOverallScore(results: AnalysisResults): number {
    const seoScore = this.calculateSEOScore(results);
    const geoScore = this.calculateGEOScore(results);
    
    // Weight SEO and GEO equally by default (50/50 split)
    const overallScore = (seoScore.overall * 0.5) + (geoScore.overall * 0.5);
    
    return this.normalizeScore(overallScore);
  }

  /**
   * Calculate comprehensive SEO score with category breakdown
   */
  calculateSEOScore(results: AnalysisResults): SEOScore {
    const technicalScore = this.calculateTechnicalSEOScore(results);
    const contentScore = this.calculateContentSEOScore(results);
    const structureScore = this.calculateStructureSEOScore(results);

    const overall = this.calculateWeightedAverage([
      { score: technicalScore, weight: this.config.seoWeights.technical },
      { score: contentScore, weight: this.config.seoWeights.content },
      { score: structureScore, weight: this.config.seoWeights.structure }
    ]);

    return {
      overall: this.normalizeScore(overall),
      technical: this.normalizeScore(technicalScore),
      content: this.normalizeScore(contentScore),
      structure: this.normalizeScore(structureScore),
      details: {
        pageSpeed: results.seoScore?.details?.pageSpeed || 0,
        mobileResponsive: results.seoScore?.details?.mobileResponsive || false,
        titleTag: results.seoScore?.details?.titleTag || { score: 0, issues: [], suggestions: [] },
        metaDescription: results.seoScore?.details?.metaDescription || { score: 0, issues: [], suggestions: [] },
        headingStructure: results.seoScore?.details?.headingStructure || { score: 0, issues: [], suggestions: [] },
        internalLinks: results.seoScore?.details?.internalLinks || 0
      }
    };
  }

  /**
   * Calculate comprehensive GEO score with category breakdown
   */
  calculateGEOScore(results: AnalysisResults): GEOScore {
    const readabilityScore = this.calculateReadabilityScore(results);
    const credibilityScore = this.calculateCredibilityScore(results);
    const completenessScore = this.calculateCompletenessScore(results);
    const structuredDataScore = this.calculateStructuredDataScore(results);

    const overall = this.calculateWeightedAverage([
      { score: readabilityScore, weight: this.config.geoWeights.readability },
      { score: credibilityScore, weight: this.config.geoWeights.credibility },
      { score: completenessScore, weight: this.config.geoWeights.completeness },
      { score: structuredDataScore, weight: this.config.geoWeights.structuredData }
    ]);

    return {
      overall: this.normalizeScore(overall),
      readability: this.normalizeScore(readabilityScore),
      credibility: this.normalizeScore(credibilityScore),
      completeness: this.normalizeScore(completenessScore),
      structuredData: this.normalizeScore(structuredDataScore),
      details: {
        contentClarity: results.geoScore?.details?.contentClarity || { score: 0, issues: [], suggestions: [] },
        questionAnswerFormat: results.geoScore?.details?.questionAnswerFormat || false,
        authorInformation: results.geoScore?.details?.authorInformation || false,
        citations: results.geoScore?.details?.citations || 0,
        schemaMarkup: results.geoScore?.details?.schemaMarkup || []
      }
    };
  }

  /**
   * Generate actionable recommendations based on analysis results
   */
  generateRecommendations(results: AnalysisResults): Recommendation[] {
    return this.recommendationEngine.generateRecommendations(results);
  }

  /**
   * Prioritize recommendations by impact and effort
   */
  prioritizeRecommendations(recommendations: Recommendation[]): Recommendation[] {
    return this.recommendationEngine.prioritizeRecommendations(recommendations);
  }

  /**
   * Get recommendations by category
   */
  getRecommendationsByCategory(
    recommendations: Recommendation[],
    category: 'SEO' | 'GEO' | 'Technical'
  ): Recommendation[] {
    return this.recommendationEngine.getRecommendationsByCategory(recommendations, category);
  }

  /**
   * Get quick wins (high-impact, easy recommendations)
   */
  getQuickWins(recommendations: Recommendation[]): Recommendation[] {
    return this.recommendationEngine.getQuickWins(recommendations);
  }

  /**
   * Update scoring configuration
   */
  updateConfig(newConfig: Partial<AnalysisConfig>): void {
    this.config = this.mergeWithDefaults(newConfig);
    // Save updated configuration
    ScoringConfigManager.saveConfig(this.config);
  }

  /**
   * Get current scoring configuration
   */
  getConfig(): AnalysisConfig {
    return { ...this.config };
  }

  /**
   * Apply a configuration preset
   */
  applyPreset(presetName: string): void {
    this.config = ScoringConfigManager.applyPreset(presetName);
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.config = ScoringConfigManager.resetToDefaults();
  }

  /**
   * Get available configuration presets
   */
  getAvailablePresets(): string[] {
    return ScoringConfigManager.getAvailablePresets();
  }

  /**
   * Validate configuration
   */
  validateConfig(config: Partial<AnalysisConfig>): { valid: boolean; errors: string[] } {
    return ScoringConfigManager.validateConfig(config);
  }

  // Private helper methods

  private mergeWithDefaults(config?: Partial<AnalysisConfig>): AnalysisConfig {
    const defaults = ScoringConfigManager.getDefaultConfig();

    return {
      seoWeights: { ...defaults.seoWeights, ...config?.seoWeights },
      geoWeights: { ...defaults.geoWeights, ...config?.geoWeights },
      thresholds: { ...defaults.thresholds, ...config?.thresholds }
    };
  }

  private calculateWeightedAverage(scores: Array<{ score: number; weight: number }>): number {
    const totalWeight = scores.reduce((sum, item) => sum + item.weight, 0);
    const weightedSum = scores.reduce((sum, item) => sum + (item.score * item.weight), 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private normalizeScore(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private calculateTechnicalSEOScore(results: AnalysisResults): number {
    const pageSpeed = results.seoScore?.details?.pageSpeed || 0;
    const mobileResponsive = results.seoScore?.details?.mobileResponsive ? 100 : 0;
    
    // Weight page speed more heavily as it's critical for SEO
    return (pageSpeed * 0.7) + (mobileResponsive * 0.3);
  }

  private calculateContentSEOScore(results: AnalysisResults): number {
    const titleScore = results.seoScore?.details?.titleTag?.score || 0;
    const metaScore = results.seoScore?.details?.metaDescription?.score || 0;
    const headingScore = results.seoScore?.details?.headingStructure?.score || 0;

    return (titleScore * 0.4) + (metaScore * 0.3) + (headingScore * 0.3);
  }

  private calculateStructureSEOScore(results: AnalysisResults): number {
    const internalLinks = results.seoScore?.details?.internalLinks || 0;
    
    // Score based on reasonable number of internal links (5-20 is good)
    let linkScore = 0;
    if (internalLinks >= 5 && internalLinks <= 20) {
      linkScore = 100;
    } else if (internalLinks > 0) {
      linkScore = Math.max(50, 100 - Math.abs(internalLinks - 12) * 5);
    }

    return linkScore;
  }

  private calculateReadabilityScore(results: AnalysisResults): number {
    const clarityScore = results.geoScore?.details?.contentClarity?.score || 0;
    const hasQAFormat = results.geoScore?.details?.questionAnswerFormat ? 20 : 0;
    
    return (clarityScore * 0.8) + hasQAFormat;
  }

  private calculateCredibilityScore(results: AnalysisResults): number {
    const hasAuthor = results.geoScore?.details?.authorInformation ? 40 : 0;
    const citations = Math.min(results.geoScore?.details?.citations || 0, 10) * 6; // Max 60 points for citations
    
    return hasAuthor + citations;
  }

  private calculateCompletenessScore(results: AnalysisResults): number {
    // This would typically be calculated by content analysis services
    // For now, return a base score that can be enhanced by actual analysis
    return 75; // Placeholder - would be replaced by actual completeness analysis
  }

  private calculateStructuredDataScore(results: AnalysisResults): number {
    const schemaCount = results.geoScore?.details?.schemaMarkup?.length || 0;
    
    // Score based on presence and variety of structured data
    if (schemaCount === 0) return 0;
    if (schemaCount >= 3) return 100;
    return schemaCount * 33; // 33 points per schema type
  }


}