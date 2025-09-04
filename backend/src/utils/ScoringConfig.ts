import { AnalysisConfig } from '../../../shared/types';
import * as fs from 'fs';
import * as path from 'path';

export class ScoringConfigManager {
  private static readonly CONFIG_FILE = 'scoring-config.json';
  private static readonly CONFIG_DIR = path.join(__dirname, '../../config');
  private static readonly CONFIG_PATH = path.join(ScoringConfigManager.CONFIG_DIR, ScoringConfigManager.CONFIG_FILE);

  /**
   * Load scoring configuration from file or return defaults
   */
  static loadConfig(): AnalysisConfig {
    try {
      if (fs.existsSync(ScoringConfigManager.CONFIG_PATH)) {
        const configData = fs.readFileSync(ScoringConfigManager.CONFIG_PATH, 'utf8');
        const savedConfig = JSON.parse(configData);
        return ScoringConfigManager.mergeWithDefaults(savedConfig);
      }
    } catch (error) {
      console.warn('Failed to load scoring configuration, using defaults:', error);
    }
    
    return ScoringConfigManager.getDefaultConfig();
  }

  /**
   * Save scoring configuration to file
   */
  static saveConfig(config: AnalysisConfig): void {
    try {
      // Ensure config directory exists
      if (!fs.existsSync(ScoringConfigManager.CONFIG_DIR)) {
        fs.mkdirSync(ScoringConfigManager.CONFIG_DIR, { recursive: true });
      }

      const configData = JSON.stringify(config, null, 2);
      fs.writeFileSync(ScoringConfigManager.CONFIG_PATH, configData, 'utf8');
    } catch (error) {
      console.error('Failed to save scoring configuration:', error);
      throw new Error('Unable to save scoring configuration');
    }
  }

  /**
   * Get default scoring configuration
   */
  static getDefaultConfig(): AnalysisConfig {
    return {
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
    };
  }

  /**
   * Get predefined configuration presets
   */
  static getConfigPresets(): Record<string, AnalysisConfig> {
    return {
      'seo-focused': {
        seoWeights: {
          technical: 0.5,
          content: 0.4,
          structure: 0.1
        },
        geoWeights: {
          readability: 0.2,
          credibility: 0.2,
          completeness: 0.3,
          structuredData: 0.3
        },
        thresholds: {
          pageSpeedMin: 95,
          contentLengthMin: 500,
          headingLevels: 4
        }
      },
      'geo-focused': {
        seoWeights: {
          technical: 0.3,
          content: 0.3,
          structure: 0.4
        },
        geoWeights: {
          readability: 0.4,
          credibility: 0.4,
          completeness: 0.1,
          structuredData: 0.1
        },
        thresholds: {
          pageSpeedMin: 85,
          contentLengthMin: 800,
          headingLevels: 5
        }
      },
      'balanced': {
        seoWeights: {
          technical: 0.35,
          content: 0.35,
          structure: 0.3
        },
        geoWeights: {
          readability: 0.25,
          credibility: 0.25,
          completeness: 0.25,
          structuredData: 0.25
        },
        thresholds: {
          pageSpeedMin: 90,
          contentLengthMin: 400,
          headingLevels: 3
        }
      },
      'performance-focused': {
        seoWeights: {
          technical: 0.7,
          content: 0.2,
          structure: 0.1
        },
        geoWeights: {
          readability: 0.3,
          credibility: 0.2,
          completeness: 0.2,
          structuredData: 0.3
        },
        thresholds: {
          pageSpeedMin: 98,
          contentLengthMin: 200,
          headingLevels: 2
        }
      }
    };
  }

  /**
   * Validate configuration values
   */
  static validateConfig(config: Partial<AnalysisConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate SEO weights
    if (config.seoWeights) {
      const seoSum = Object.values(config.seoWeights).reduce((sum, weight) => sum + weight, 0);
      if (Math.abs(seoSum - 1.0) > 0.01) {
        errors.push(`SEO weights must sum to 1.0, got ${seoSum}`);
      }

      Object.entries(config.seoWeights).forEach(([key, weight]) => {
        if (weight < 0 || weight > 1) {
          errors.push(`SEO weight ${key} must be between 0 and 1, got ${weight}`);
        }
      });
    }

    // Validate GEO weights
    if (config.geoWeights) {
      const geoSum = Object.values(config.geoWeights).reduce((sum, weight) => sum + weight, 0);
      if (Math.abs(geoSum - 1.0) > 0.01) {
        errors.push(`GEO weights must sum to 1.0, got ${geoSum}`);
      }

      Object.entries(config.geoWeights).forEach(([key, weight]) => {
        if (weight < 0 || weight > 1) {
          errors.push(`GEO weight ${key} must be between 0 and 1, got ${weight}`);
        }
      });
    }

    // Validate thresholds
    if (config.thresholds) {
      if (config.thresholds.pageSpeedMin !== undefined) {
        if (config.thresholds.pageSpeedMin < 0 || config.thresholds.pageSpeedMin > 100) {
          errors.push(`Page speed minimum must be between 0 and 100, got ${config.thresholds.pageSpeedMin}`);
        }
      }

      if (config.thresholds.contentLengthMin !== undefined) {
        if (config.thresholds.contentLengthMin < 0) {
          errors.push(`Content length minimum must be positive, got ${config.thresholds.contentLengthMin}`);
        }
      }

      if (config.thresholds.headingLevels !== undefined) {
        if (config.thresholds.headingLevels < 1 || config.thresholds.headingLevels > 6) {
          errors.push(`Heading levels must be between 1 and 6, got ${config.thresholds.headingLevels}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Merge partial configuration with defaults
   */
  private static mergeWithDefaults(config: Partial<AnalysisConfig>): AnalysisConfig {
    const defaults = ScoringConfigManager.getDefaultConfig();
    
    return {
      seoWeights: { ...defaults.seoWeights, ...config.seoWeights },
      geoWeights: { ...defaults.geoWeights, ...config.geoWeights },
      thresholds: { ...defaults.thresholds, ...config.thresholds }
    };
  }

  /**
   * Reset configuration to defaults
   */
  static resetToDefaults(): AnalysisConfig {
    const defaultConfig = ScoringConfigManager.getDefaultConfig();
    ScoringConfigManager.saveConfig(defaultConfig);
    return defaultConfig;
  }

  /**
   * Apply a preset configuration
   */
  static applyPreset(presetName: string): AnalysisConfig {
    const presets = ScoringConfigManager.getConfigPresets();
    const preset = presets[presetName];
    
    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}. Available presets: ${Object.keys(presets).join(', ')}`);
    }

    ScoringConfigManager.saveConfig(preset);
    return preset;
  }

  /**
   * Get available preset names
   */
  static getAvailablePresets(): string[] {
    return Object.keys(ScoringConfigManager.getConfigPresets());
  }
}