import { AnalysisConfigManager, FeatureFlags, EnvironmentConfig } from '../AnalysisConfig';
import { AnalysisConfig } from '../../../../shared/types';

describe('AnalysisConfigManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AnalysisConfigManager.clearCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getDefaultExtendedConfig', () => {
    it('should return default extended configuration', () => {
      const config = AnalysisConfigManager.getDefaultExtendedConfig();

      expect(config).toMatchObject({
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
      });
      expect(config.featureFlags).toBeDefined();
      expect(config.environment).toBeDefined();
      expect(config.customThresholds).toBeDefined();
      expect(config.analysisPreferences).toBeDefined();
    });
  });

  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const validConfig = AnalysisConfigManager.getDefaultExtendedConfig();
      
      const validation = AnalysisConfigManager.validateConfig(validConfig);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid SEO weights', () => {
      const invalidConfig = AnalysisConfigManager.getDefaultExtendedConfig();
      invalidConfig.seoWeights.technical = 1.5; // Invalid: > 1

      const validation = AnalysisConfigManager.validateConfig(invalidConfig);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('SEO weight technical must be between 0 and 1, got 1.5');
    });

    it('should detect invalid GEO weights sum', () => {
      const invalidConfig = AnalysisConfigManager.getDefaultExtendedConfig();
      invalidConfig.geoWeights = {
        readability: 0.5,
        credibility: 0.5,
        completeness: 0.3,
        structuredData: 0.3
      }; // Sum = 1.6

      const validation = AnalysisConfigManager.validateConfig(invalidConfig);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(error => error.includes('GEO weights must sum to 1.0'))).toBe(true);
    });

    it('should detect invalid environment configuration', () => {
      const invalidConfig = AnalysisConfigManager.getDefaultExtendedConfig();
      invalidConfig.environment.maxConcurrentAnalyses = 0; // Invalid: < 1

      const validation = AnalysisConfigManager.validateConfig(invalidConfig);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Max concurrent analyses must be at least 1');
    });

    it('should detect invalid custom thresholds', () => {
      const invalidConfig = AnalysisConfigManager.getDefaultExtendedConfig();
      invalidConfig.customThresholds.invalidNumber = NaN;

      const validation = AnalysisConfigManager.validateConfig(invalidConfig);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Custom threshold invalidNumber must be a valid number');
    });
  });

  describe('presets', () => {
    it('should return available presets', () => {
      const presets = AnalysisConfigManager.getConfigPresets();
      const presetNames = AnalysisConfigManager.getAvailablePresets();

      expect(presetNames).toContain('seo-focused');
      expect(presetNames).toContain('geo-focused');
      expect(presetNames).toContain('balanced');
      expect(presetNames).toContain('performance-focused');
      expect(presetNames).toContain('experimental');
      expect(presetNames).toContain('fast-analysis');

      expect(presets['seo-focused']).toBeDefined();
      expect(presets['seo-focused'].seoWeights.technical).toBe(0.5);
    });

    it('should throw error for unknown preset', () => {
      expect(() => AnalysisConfigManager.applyPreset('unknown-preset'))
        .toThrow('Unknown preset: unknown-preset');
    });
  });

  describe('environment-specific configurations', () => {
    it('should return development environment config', () => {
      const devConfig = AnalysisConfigManager.getEnvironmentConfig('development');

      expect(devConfig.environment).toBe('development');
      expect(devConfig.logLevel).toBe('debug');
      expect(devConfig.maxConcurrentAnalyses).toBe(2);
    });

    it('should return staging environment config', () => {
      const stagingConfig = AnalysisConfigManager.getEnvironmentConfig('staging');

      expect(stagingConfig.environment).toBe('staging');
      expect(stagingConfig.logLevel).toBe('info');
      expect(stagingConfig.maxConcurrentAnalyses).toBe(5);
    });

    it('should return production environment config', () => {
      const prodConfig = AnalysisConfigManager.getEnvironmentConfig('production');

      expect(prodConfig.environment).toBe('production');
      expect(prodConfig.logLevel).toBe('warn');
      expect(prodConfig.maxConcurrentAnalyses).toBe(10);
    });
  });

  describe('default configurations', () => {
    it('should return default feature flags', () => {
      const flags = AnalysisConfigManager.getDefaultFeatureFlags();

      expect(flags.enableExperimentalGEO).toBe(false);
      expect(flags.enableAdvancedStructuredData).toBe(true);
      expect(flags.enableAIContentAnalysis).toBe(true);
      expect(flags.enablePerformanceOptimizations).toBe(true);
      expect(flags.enableBetaRecommendations).toBe(false);
    });

    it('should return default analysis preferences', () => {
      const prefs = AnalysisConfigManager.getDefaultAnalysisPreferences();

      expect(prefs.skipMobileAnalysis).toBe(false);
      expect(prefs.skipPerformanceAnalysis).toBe(false);
      expect(prefs.enableDeepContentAnalysis).toBe(true);
      expect(prefs.enableCompetitorComparison).toBe(false);
    });
  });
});