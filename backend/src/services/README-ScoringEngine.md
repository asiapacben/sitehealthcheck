# ScoringEngine Usage Guide

The ScoringEngine is a comprehensive scoring system for SEO & GEO analysis results. It provides configurable weights, normalized scoring, and actionable recommendations.

## Features

- **Configurable Weights**: Customize the importance of different SEO and GEO factors
- **Normalized Scoring**: All scores are normalized to 0-100 range
- **Comprehensive Recommendations**: Generate prioritized, actionable suggestions
- **Configuration Management**: Save/load configurations with presets
- **Validation**: Validate configuration parameters

## Basic Usage

```typescript
import { ScoringEngine } from './ScoringEngine';
import { AnalysisResults } from '../../../shared/types';

// Create scoring engine with default configuration
const scoringEngine = new ScoringEngine();

// Or with custom configuration
const customConfig = {
  seoWeights: {
    technical: 0.5,
    content: 0.3,
    structure: 0.2
  }
};
const scoringEngine = new ScoringEngine(customConfig);

// Calculate scores
const overallScore = scoringEngine.calculateOverallScore(analysisResults);
const seoScore = scoringEngine.calculateSEOScore(analysisResults);
const geoScore = scoringEngine.calculateGEOScore(analysisResults);

// Generate recommendations
const recommendations = scoringEngine.generateRecommendations(analysisResults);
```

## Configuration Management

```typescript
// Apply a preset configuration
scoringEngine.applyPreset('seo-focused');

// Get available presets
const presets = scoringEngine.getAvailablePresets();
// Returns: ['seo-focused', 'geo-focused', 'balanced', 'performance-focused']

// Update configuration
scoringEngine.updateConfig({
  seoWeights: {
    technical: 0.6,
    content: 0.2,
    structure: 0.2
  }
});

// Reset to defaults
scoringEngine.resetToDefaults();

// Validate configuration
const validation = scoringEngine.validateConfig(newConfig);
if (!validation.valid) {
  console.log('Validation errors:', validation.errors);
}
```

## Configuration Presets

### SEO-Focused
- Emphasizes technical performance and traditional SEO factors
- Technical: 50%, Content: 40%, Structure: 10%

### GEO-Focused
- Optimized for AI and generative engine optimization
- Readability: 40%, Credibility: 40%, Completeness: 10%, Structured Data: 10%

### Balanced
- Equal weight to all factors
- All categories weighted equally at 25%

### Performance-Focused
- Heavily weighted toward technical performance
- Technical: 70%, Content: 20%, Structure: 10%

## Scoring Methodology

### SEO Score Components

1. **Technical SEO (Default: 40%)**
   - Page speed (70% of technical score)
   - Mobile responsiveness (30% of technical score)

2. **Content SEO (Default: 40%)**
   - Title tag quality (40% of content score)
   - Meta description quality (30% of content score)
   - Heading structure (30% of content score)

3. **Structure SEO (Default: 20%)**
   - Internal linking (based on optimal 5-20 links)
   - URL structure quality
   - Sitemap presence

### GEO Score Components

1. **Readability (Default: 30%)**
   - Content clarity (80% of readability score)
   - Question-answer format bonus (20% of readability score)

2. **Credibility (Default: 30%)**
   - Author information presence (40 points)
   - Citations count (up to 60 points, 6 points per citation)

3. **Completeness (Default: 20%)**
   - Topic coverage analysis (placeholder: 75 points)

4. **Structured Data (Default: 20%)**
   - Schema markup variety (33 points per schema type, max 100)

## Recommendation Generation

The engine generates recommendations based on:

- **Priority**: High, Medium, Low
- **Impact**: 0-100 scale
- **Effort**: Easy, Medium, Hard

Recommendations are automatically prioritized by:
1. Priority level
2. Impact score (higher first)
3. Effort level (easier first)

## Integration Example

```typescript
// In AnalysisOrchestrator
const scoringEngine = new ScoringEngine(config);

// After collecting analysis data
const seoScore = scoringEngine.calculateSEOScore(initialResults);
const geoScore = scoringEngine.calculateGEOScore(initialResults);
const overallScore = scoringEngine.calculateOverallScore(initialResults);
const recommendations = scoringEngine.generateRecommendations(initialResults);

const finalResults = {
  ...initialResults,
  overallScore,
  seoScore,
  geoScore,
  recommendations
};
```

## Configuration File

The ScoringEngine automatically saves and loads configuration from:
`backend/config/scoring-config.json`

This allows configurations to persist between application restarts.