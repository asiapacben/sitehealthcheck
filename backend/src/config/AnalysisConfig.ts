import { AnalysisConfig } from '../../../shared/types';
import * as fs from 'fs';
import * as path from 'path';

export interface FeatureFlags {
  enableExperimentalGEO: boolean;
  enableAdvancedStructuredData: boolean;
  enableAIContentAnalysis: boolean;
  enablePerformanceOptimizations: boolean;
  enableBetaRecommendations: boolean;
}

export interface EnvironmentConfig {
  environment: 'development' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableMetrics: boolean;
  enableCaching: boolean;
  cacheTimeout: number;
  maxConcurrentAnalyses: number;
  analysisTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface ExtendedAnalysisConfig extends AnalysisConfig {
  featureFlags: FeatureFlags;
  environment: EnvironmentConfig;
  customThresholds: {
    [key: string]: number | boolean | string;
  };
  analysisPreferences: {
    skipMobileAnalysis: boolean;
    skipPerformanceAnalysis: boolean;
    skipAccessibilityAnalysis: boolean;
    skipStructuredDataAnalysis: boolean;
    enableDeepContentAnalysis: boolean;
    enableCompetitorComparison: boolean;
  };
}

export class AnalysisConfigManager {
  private static readonly CONFIG_FILE = 'analysis-config.json';
  private static readonly ENV_CONFIG_FILE = 'environment-config.json';
  private static readonly FEATURE_FLAGS_FILE = 'feature-flags.json';
  private static readonly CONFIG_DIR = path.join(__dirname, '../../config');
  
  private static readonly CONFIG_PATH = path.join(AnalysisConfigManager.CONFIG_DIR, AnalysisConfigManager.CONFIG_FILE);
  private static readonly ENV_CONFIG_PATH = path.join(AnalysisConfigManager.CONFIG_DIR, AnalysisConfigManager.ENV_CONFIG_FILE);
  private static readonly FEATURE_FLAGS_PATH = path.join(AnalysisConfigManager.CONFIG_DIR, AnalysisConfigManager.FEATURE_FLAGS_FILE);

  private static cachedConfig: ExtendedAnalysisConfig | null = null;
  private static configWatchers: fs.FSWatcher[] = [];

  /**
   * Load complete analysis configuration
   */
  static loadConfig(): ExtendedAnalysisConfig {
    if (AnalysisConfigManager.cachedConfig) {
      return AnalysisConfigManager.cachedConfig;
    }

    try {
      const baseConfig = AnalysisConfigManager.loadBaseConfig();
      const envConfig = AnalysisConfigManager.loadEnvironmentConfig();
      const featureFlags = AnalysisConfigManager.loadFeatureFlags();

      const config: ExtendedAnalysisConfig = {
        ...baseConfig,
        environment: envConfig,
        featureFlags,
        customThresholds: {},
        analysisPreferences: AnalysisConfigManager.getDefaultAnalysisPreferences()
      };

      AnalysisConfigManager.cachedConfig = config;
      AnalysisConfigManager.setupConfigWatchers();
      
      return config;
    } catch (error) {
      console.warn('Failed to load configuration, using defaults:', error);
      return AnalysisConfigManager.getDefaultExtendedConfig();
    }
  }

  /**
   * Save complete analysis configuration
   */
  static saveConfig(config: ExtendedAnalysisConfig): void {
    try {
      AnalysisConfigManager.ensureConfigDirectory();

      // Save base configuration
      const baseConfig: AnalysisConfig = {
        seoWeights: config.seoWeights,
        geoWeights: config.geoWeights,
        thresholds: config.thresholds
      };
      
      fs.writeFileSync(AnalysisConfigManager.CONFIG_PATH, JSON.stringify(baseConfig, null, 2));
      fs.writeFileSync(AnalysisConfigManager.ENV_CONFIG_PATH, JSON.stringify(config.environment, null, 2));
      fs.writeFileSync(AnalysisConfigManager.FEATURE_FLAGS_PATH, JSON.stringify(config.featureFlags, null, 2));

      AnalysisConfigManager.cachedConfig = config;
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw new Error('Unable to save analysis configuration');
    }
  }

  /**
   * Update scoring weights with validation
   */
  static updateScoringWeights(weights: Partial<AnalysisConfig>): ExtendedAnalysisConfig {
    const config = AnalysisConfigManager.loadConfig();
    
    if (weights.seoWeights) {
      config.seoWeights = { ...config.seoWeights, ...weights.seoWeights };
    }
    
    if (weights.geoWeights) {
      config.geoWeights = { ...config.geoWeights, ...weights.geoWeights };
    }

    const validation = AnalysisConfigManager.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    AnalysisConfigManager.saveConfig(config);
    return config;
  }

  /**
   * Update analysis thresholds
   */
  static updateThresholds(thresholds: Partial<AnalysisConfig['thresholds']> & Record<string, any>): ExtendedAnalysisConfig {
    const config = AnalysisConfigManager.loadConfig();
    
    // Update standard thresholds
    config.thresholds = { ...config.thresholds, ...thresholds };
    
    // Update custom thresholds
    Object.keys(thresholds).forEach(key => {
      if (!['pageSpeedMin', 'contentLengthMin', 'headingLevels'].includes(key)) {
        config.customThresholds[key] = thresholds[key];
      }
    });

    const validation = AnalysisConfigManager.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid thresholds: ${validation.errors.join(', ')}`);
    }

    AnalysisConfigManager.saveConfig(config);
    return config;
  }

  /**
   * Update feature flags
   */
  static updateFeatureFlags(flags: Partial<FeatureFlags>): ExtendedAnalysisConfig {
    const config = AnalysisConfigManager.loadConfig();
    config.featureFlags = { ...config.featureFlags, ...flags };
    
    AnalysisConfigManager.saveConfig(config);
    return config;
  }

  /**
   * Update environment configuration
   */
  static updateEnvironmentConfig(envConfig: Partial<EnvironmentConfig>): ExtendedAnalysisConfig {
    const config = AnalysisConfigManager.loadConfig();
    config.environment = { ...config.environment, ...envConfig };
    
    AnalysisConfigManager.saveConfig(config);
    return config;
  }

  /**
   * Get configuration for specific environment
   */
  static getEnvironmentConfig(environment: 'development' | 'staging' | 'production'): EnvironmentConfig {
    const configs = {
      development: {
        environment: 'development' as const,
        logLevel: 'debug' as const,
        enableMetrics: true,
        enableCaching: false,
        cacheTimeout: 300,
        maxConcurrentAnalyses: 2,
        analysisTimeout: 60000,
        retryAttempts: 2,
        retryDelay: 1000
      },
      staging: {
        environment: 'staging' as const,
        logLevel: 'info' as const,
        enableMetrics: true,
        enableCaching: true,
        cacheTimeout: 600,
        maxConcurrentAnalyses: 5,
        analysisTimeout: 45000,
        retryAttempts: 3,
        retryDelay: 2000
      },
      production: {
        environment: 'production' as const,
        logLevel: 'warn' as const,
        enableMetrics: true,
        enableCaching: true,
        cacheTimeout: 1800,
        maxConcurrentAnalyses: 10,
        analysisTimeout: 30000,
        retryAttempts: 3,
        retryDelay: 5000
      }
    };

    return configs[environment];
  }

  /**
   * Get default feature flags
   */
  static getDefaultFeatureFlags(): FeatureFlags {
    return {
      enableExperimentalGEO: false,
      enableAdvancedStructuredData: true,
      enableAIContentAnalysis: true,
      enablePerformanceOptimizations: true,
      enableBetaRecommendations: false
    };
  }

  /**
   * Get default analysis preferences
   */
  static getDefaultAnalysisPreferences() {
    return {
      skipMobileAnalysis: false,
      skipPerformanceAnalysis: false,
      skipAccessibilityAnalysis: false,
      skipStructuredDataAnalysis: false,
      enableDeepContentAnalysis: true,
      enableCompetitorComparison: false
    };
  }

  /**
   * Validate complete configuration
   */
  static validateConfig(config: ExtendedAnalysisConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate base configuration
    const baseValidation = AnalysisConfigManager.validateBaseConfig(config);
    errors.push(...baseValidation.errors);

    // Validate environment configuration
    if (config.environment.maxConcurrentAnalyses < 1) {
      errors.push('Max concurrent analyses must be at least 1');
    }

    if (config.environment.analysisTimeout < 1000) {
      errors.push('Analysis timeout must be at least 1000ms');
    }

    if (config.environment.retryAttempts < 0) {
      errors.push('Retry attempts must be non-negative');
    }

    if (config.environment.retryDelay < 0) {
      errors.push('Retry delay must be non-negative');
    }

    if (config.environment.cacheTimeout < 0) {
      errors.push('Cache timeout must be non-negative');
    }

    // Validate custom thresholds
    Object.entries(config.customThresholds).forEach(([key, value]) => {
      if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
        errors.push(`Custom threshold ${key} must be a valid number`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Reset configuration to defaults
   */
  static resetToDefaults(): ExtendedAnalysisConfig {
    const defaultConfig = AnalysisConfigManager.getDefaultExtendedConfig();
    AnalysisConfigManager.saveConfig(defaultConfig);
    return defaultConfig;
  }

  /**
   * Apply configuration preset
   */
  static applyPreset(presetName: string): ExtendedAnalysisConfig {
    const presets = AnalysisConfigManager.getConfigPresets();
    const preset = presets[presetName];
    
    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}. Available presets: ${Object.keys(presets).join(', ')}`);
    }

    AnalysisConfigManager.saveConfig(preset);
    return preset;
  }

  /**
   * Get available configuration presets
   */
  static getConfigPresets(): Record<string, ExtendedAnalysisConfig> {
    const basePresets = AnalysisConfigManager.getBaseConfigPresets();
    const defaultEnv = AnalysisConfigManager.getEnvironmentConfig('production');
    const defaultFlags = AnalysisConfigManager.getDefaultFeatureFlags();
    const defaultPrefs = AnalysisConfigManager.getDefaultAnalysisPreferences();

    const extendedPresets: Record<string, ExtendedAnalysisConfig> = {};

    Object.entries(basePresets).forEach(([name, baseConfig]) => {
      extendedPresets[name] = {
        ...baseConfig,
        environment: defaultEnv,
        featureFlags: defaultFlags,
        customThresholds: {},
        analysisPreferences: defaultPrefs
      };
    });

    // Add specialized presets
    extendedPresets['experimental'] = {
      ...extendedPresets['balanced'],
      featureFlags: {
        enableExperimentalGEO: true,
        enableAdvancedStructuredData: true,
        enableAIContentAnalysis: true,
        enablePerformanceOptimizations: true,
        enableBetaRecommendations: true
      },
      analysisPreferences: {
        ...defaultPrefs,
        enableDeepContentAnalysis: true,
        enableCompetitorComparison: true
      }
    };

    extendedPresets['fast-analysis'] = {
      ...extendedPresets['performance-focused'],
      analysisPreferences: {
        skipMobileAnalysis: true,
        skipPerformanceAnalysis: false,
        skipAccessibilityAnalysis: true,
        skipStructuredDataAnalysis: true,
        enableDeepContentAnalysis: false,
        enableCompetitorComparison: false
      },
      environment: {
        ...defaultEnv,
        analysisTimeout: 15000,
        maxConcurrentAnalyses: 15
      }
    };

    return extendedPresets;
  }

  /**
   * Get available preset names
   */
  static getAvailablePresets(): string[] {
    return Object.keys(AnalysisConfigManager.getConfigPresets());
  }

  /**
   * Check if feature is enabled
   */
  static isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    const config = AnalysisConfigManager.loadConfig();
    return config.featureFlags[feature];
  }

  /**
   * Get threshold value (custom or standard)
   */
  static getThreshold(key: string): number | boolean | string | undefined {
    const config = AnalysisConfigManager.loadConfig();
    
    // Check custom thresholds first
    if (key in config.customThresholds) {
      return config.customThresholds[key];
    }
    
    // Check standard thresholds
    if (key in config.thresholds) {
      return (config.thresholds as any)[key];
    }
    
    return undefined;
  }

  /**
   * Clear configuration cache
   */
  static clearCache(): void {
    AnalysisConfigManager.cachedConfig = null;
    AnalysisConfigManager.cleanupWatchers();
  }

  // Private helper methods

  private static loadBaseConfig(): AnalysisConfig {
    try {
      if (fs.existsSync(AnalysisConfigManager.CONFIG_PATH)) {
        const configData = fs.readFileSync(AnalysisConfigManager.CONFIG_PATH, 'utf8');
        const savedConfig = JSON.parse(configData);
        return AnalysisConfigManager.mergeWithBaseDefaults(savedConfig);
      }
    } catch (error) {
      console.warn('Failed to load base configuration:', error);
    }
    
    return AnalysisConfigManager.getDefaultBaseConfig();
  }

  private static loadEnvironmentConfig(): EnvironmentConfig {
    try {
      if (fs.existsSync(AnalysisConfigManager.ENV_CONFIG_PATH)) {
        const configData = fs.readFileSync(AnalysisConfigManager.ENV_CONFIG_PATH, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.warn('Failed to load environment configuration:', error);
    }
    
    const env = (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development';
    return AnalysisConfigManager.getEnvironmentConfig(env);
  }

  private static loadFeatureFlags(): FeatureFlags {
    try {
      if (fs.existsSync(AnalysisConfigManager.FEATURE_FLAGS_PATH)) {
        const flagsData = fs.readFileSync(AnalysisConfigManager.FEATURE_FLAGS_PATH, 'utf8');
        const savedFlags = JSON.parse(flagsData);
        return { ...AnalysisConfigManager.getDefaultFeatureFlags(), ...savedFlags };
      }
    } catch (error) {
      console.warn('Failed to load feature flags:', error);
    }
    
    return AnalysisConfigManager.getDefaultFeatureFlags();
  }

  static getDefaultExtendedConfig(): ExtendedAnalysisConfig {
    const env = (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development';
    
    return {
      ...AnalysisConfigManager.getDefaultBaseConfig(),
      environment: AnalysisConfigManager.getEnvironmentConfig(env),
      featureFlags: AnalysisConfigManager.getDefaultFeatureFlags(),
      customThresholds: {},
      analysisPreferences: AnalysisConfigManager.getDefaultAnalysisPreferences()
    };
  }

  private static getDefaultBaseConfig(): AnalysisConfig {
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

  private static getBaseConfigPresets(): Record<string, AnalysisConfig> {
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

  private static validateBaseConfig(config: Partial<AnalysisConfig>): { valid: boolean; errors: string[] } {
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

  private static mergeWithBaseDefaults(config: Partial<AnalysisConfig>): AnalysisConfig {
    const defaults = AnalysisConfigManager.getDefaultBaseConfig();
    
    return {
      seoWeights: { ...defaults.seoWeights, ...config.seoWeights },
      geoWeights: { ...defaults.geoWeights, ...config.geoWeights },
      thresholds: { ...defaults.thresholds, ...config.thresholds }
    };
  }

  private static ensureConfigDirectory(): void {
    if (!fs.existsSync(AnalysisConfigManager.CONFIG_DIR)) {
      fs.mkdirSync(AnalysisConfigManager.CONFIG_DIR, { recursive: true });
    }
  }

  private static setupConfigWatchers(): void {
    if (AnalysisConfigManager.configWatchers.length > 0) {
      return; // Already watching
    }

    const watchFiles = [
      AnalysisConfigManager.CONFIG_PATH,
      AnalysisConfigManager.ENV_CONFIG_PATH,
      AnalysisConfigManager.FEATURE_FLAGS_PATH
    ];

    watchFiles.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        const watcher = fs.watch(filePath, () => {
          AnalysisConfigManager.clearCache();
        });
        AnalysisConfigManager.configWatchers.push(watcher);
      }
    });
  }

  private static cleanupWatchers(): void {
    AnalysisConfigManager.configWatchers.forEach(watcher => {
      if (watcher && typeof watcher.close === 'function') {
        watcher.close();
      }
    });
    AnalysisConfigManager.configWatchers = [];
  }
}