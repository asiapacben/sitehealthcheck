import { Request, Response } from 'express';
import { ConfigController } from '../ConfigController';
import { AnalysisConfigManager } from '../../config/AnalysisConfig';

// Mock the AnalysisConfigManager
jest.mock('../../config/AnalysisConfig');
const mockAnalysisConfigManager = AnalysisConfigManager as jest.Mocked<typeof AnalysisConfigManager>;

describe('ConfigController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockRequest = {};
    mockResponse = {
      json: mockJson,
      status: mockStatus,
      setHeader: jest.fn()
    };

    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return current configuration', async () => {
      const mockConfig = {
        seoWeights: { technical: 0.4, content: 0.4, structure: 0.2 },
        geoWeights: { readability: 0.3, credibility: 0.3, completeness: 0.2, structuredData: 0.2 },
        thresholds: { pageSpeedMin: 90, contentLengthMin: 300, headingLevels: 3 },
        featureFlags: { enableExperimentalGEO: false },
        environment: { environment: 'development' as const }
      };

      mockAnalysisConfigManager.loadConfig.mockReturnValue(mockConfig as any);

      await ConfigController.getConfig(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        config: mockConfig
      });
    });

    it('should handle errors when loading configuration', async () => {
      mockAnalysisConfigManager.loadConfig.mockImplementation(() => {
        throw new Error('Config load error');
      });

      await ConfigController.getConfig(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to load configuration'
      });
    });
  });

  describe('updateScoringWeights', () => {
    it('should update scoring weights successfully', async () => {
      const mockWeights = {
        seoWeights: { technical: 0.5, content: 0.3, structure: 0.2 },
        geoWeights: { readability: 0.4, credibility: 0.3, completeness: 0.2, structuredData: 0.1 }
      };

      const mockUpdatedConfig = { ...mockWeights, thresholds: {} };

      mockRequest.body = mockWeights;
      mockAnalysisConfigManager.updateScoringWeights.mockReturnValue(mockUpdatedConfig as any);

      await ConfigController.updateScoringWeights(mockRequest as Request, mockResponse as Response);

      expect(mockAnalysisConfigManager.updateScoringWeights).toHaveBeenCalledWith(mockWeights);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        config: mockUpdatedConfig,
        message: 'Scoring weights updated successfully'
      });
    });

    it('should handle validation errors', async () => {
      mockRequest.body = { seoWeights: { technical: 1.5 } };
      mockAnalysisConfigManager.updateScoringWeights.mockImplementation(() => {
        throw new Error('Invalid configuration: SEO weight technical must be between 0 and 1');
      });

      await ConfigController.updateScoringWeights(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid configuration: SEO weight technical must be between 0 and 1'
      });
    });
  });

  describe('updateThresholds', () => {
    it('should update thresholds successfully', async () => {
      const mockThresholds = {
        pageSpeedMin: 95,
        contentLengthMin: 500,
        customThreshold: 75
      };

      const mockUpdatedConfig = { thresholds: mockThresholds };

      mockRequest.body = mockThresholds;
      mockAnalysisConfigManager.updateThresholds.mockReturnValue(mockUpdatedConfig as any);

      await ConfigController.updateThresholds(mockRequest as Request, mockResponse as Response);

      expect(mockAnalysisConfigManager.updateThresholds).toHaveBeenCalledWith(mockThresholds);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        config: mockUpdatedConfig,
        message: 'Thresholds updated successfully'
      });
    });

    it('should handle threshold validation errors', async () => {
      mockRequest.body = { pageSpeedMin: 150 };
      mockAnalysisConfigManager.updateThresholds.mockImplementation(() => {
        throw new Error('Invalid thresholds: Page speed minimum must be between 0 and 100');
      });

      await ConfigController.updateThresholds(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid thresholds: Page speed minimum must be between 0 and 100'
      });
    });
  });

  describe('updateFeatureFlags', () => {
    it('should update feature flags successfully', async () => {
      const mockFlags = {
        enableExperimentalGEO: true,
        enableBetaRecommendations: false
      };

      const mockUpdatedConfig = { featureFlags: mockFlags };

      mockRequest.body = mockFlags;
      mockAnalysisConfigManager.updateFeatureFlags.mockReturnValue(mockUpdatedConfig as any);

      await ConfigController.updateFeatureFlags(mockRequest as Request, mockResponse as Response);

      expect(mockAnalysisConfigManager.updateFeatureFlags).toHaveBeenCalledWith(mockFlags);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        config: mockUpdatedConfig,
        message: 'Feature flags updated successfully'
      });
    });
  });

  describe('updateEnvironmentConfig', () => {
    it('should update environment configuration successfully', async () => {
      const mockEnvConfig = {
        maxConcurrentAnalyses: 15,
        analysisTimeout: 20000
      };

      const mockUpdatedConfig = { environment: mockEnvConfig };

      mockRequest.body = mockEnvConfig;
      mockAnalysisConfigManager.updateEnvironmentConfig.mockReturnValue(mockUpdatedConfig as any);

      await ConfigController.updateEnvironmentConfig(mockRequest as Request, mockResponse as Response);

      expect(mockAnalysisConfigManager.updateEnvironmentConfig).toHaveBeenCalledWith(mockEnvConfig);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        config: mockUpdatedConfig,
        message: 'Environment configuration updated successfully'
      });
    });
  });

  describe('getPresets', () => {
    it('should return available presets', async () => {
      const mockPresets = {
        'seo-focused': { seoWeights: { technical: 0.5 } },
        'geo-focused': { geoWeights: { readability: 0.4 } }
      };
      const mockPresetNames = ['seo-focused', 'geo-focused'];

      mockAnalysisConfigManager.getConfigPresets.mockReturnValue(mockPresets as any);
      mockAnalysisConfigManager.getAvailablePresets.mockReturnValue(mockPresetNames);

      await ConfigController.getPresets(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        presets: mockPresets,
        presetNames: mockPresetNames
      });
    });
  });

  describe('applyPreset', () => {
    it('should apply preset successfully', async () => {
      const presetName = 'seo-focused';
      const mockUpdatedConfig = { seoWeights: { technical: 0.5 } };

      mockRequest.params = { presetName };
      mockAnalysisConfigManager.applyPreset.mockReturnValue(mockUpdatedConfig as any);

      await ConfigController.applyPreset(mockRequest as Request, mockResponse as Response);

      expect(mockAnalysisConfigManager.applyPreset).toHaveBeenCalledWith(presetName);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        config: mockUpdatedConfig,
        message: `Applied preset: ${presetName}`
      });
    });

    it('should handle unknown preset error', async () => {
      const presetName = 'unknown-preset';
      mockRequest.params = { presetName };
      mockAnalysisConfigManager.applyPreset.mockImplementation(() => {
        throw new Error('Unknown preset: unknown-preset');
      });

      await ConfigController.applyPreset(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown preset: unknown-preset'
      });
    });
  });

  describe('resetToDefaults', () => {
    it('should reset configuration to defaults', async () => {
      const mockDefaultConfig = { seoWeights: { technical: 0.4 } };

      mockAnalysisConfigManager.resetToDefaults.mockReturnValue(mockDefaultConfig as any);

      await ConfigController.resetToDefaults(mockRequest as Request, mockResponse as Response);

      expect(mockAnalysisConfigManager.resetToDefaults).toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        config: mockDefaultConfig,
        message: 'Configuration reset to defaults'
      });
    });
  });

  describe('validateConfig', () => {
    it('should validate configuration successfully', async () => {
      const mockConfig = { seoWeights: { technical: 0.4 } };
      const mockValidation = { valid: true, errors: [] };

      mockRequest.body = mockConfig;
      mockAnalysisConfigManager.validateConfig.mockReturnValue(mockValidation);

      await ConfigController.validateConfig(mockRequest as Request, mockResponse as Response);

      expect(mockAnalysisConfigManager.validateConfig).toHaveBeenCalledWith(mockConfig);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        validation: mockValidation
      });
    });

    it('should return validation errors', async () => {
      const mockConfig = { seoWeights: { technical: 1.5 } };
      const mockValidation = { valid: false, errors: ['Invalid weight'] };

      mockRequest.body = mockConfig;
      mockAnalysisConfigManager.validateConfig.mockReturnValue(mockValidation);

      await ConfigController.validateConfig(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        validation: mockValidation
      });
    });
  });

  describe('getThreshold', () => {
    it('should return threshold value', async () => {
      const key = 'pageSpeedMin';
      const value = 90;

      mockRequest.params = { key };
      mockAnalysisConfigManager.getThreshold.mockReturnValue(value);

      await ConfigController.getThreshold(mockRequest as Request, mockResponse as Response);

      expect(mockAnalysisConfigManager.getThreshold).toHaveBeenCalledWith(key);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        key,
        value
      });
    });

    it('should handle threshold not found', async () => {
      const key = 'nonexistent';

      mockRequest.params = { key };
      mockAnalysisConfigManager.getThreshold.mockReturnValue(undefined);

      await ConfigController.getThreshold(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: `Threshold '${key}' not found`
      });
    });
  });

  describe('checkFeature', () => {
    it('should return feature status', async () => {
      const feature = 'enableExperimentalGEO';
      const enabled = true;

      mockRequest.params = { feature };
      mockAnalysisConfigManager.isFeatureEnabled.mockReturnValue(enabled);

      await ConfigController.checkFeature(mockRequest as Request, mockResponse as Response);

      expect(mockAnalysisConfigManager.isFeatureEnabled).toHaveBeenCalledWith(feature);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        feature,
        enabled
      });
    });
  });

  describe('exportConfig', () => {
    it('should export configuration as JSON', async () => {
      const mockConfig = { seoWeights: { technical: 0.4 } };

      mockRequest.query = { format: 'json' };
      mockAnalysisConfigManager.loadConfig.mockReturnValue(mockConfig as any);

      await ConfigController.exportConfig(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="analysis-config.json"');
      expect(mockJson).toHaveBeenCalledWith(mockConfig);
    });

    it('should handle unsupported export format', async () => {
      mockRequest.query = { format: 'xml' };

      await ConfigController.exportConfig(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Unsupported export format. Only JSON is supported.'
      });
    });
  });

  describe('importConfig', () => {
    it('should import valid configuration', async () => {
      const mockConfig = { seoWeights: { technical: 0.4 } };
      const mockValidation = { valid: true, errors: [] };

      mockRequest.body = mockConfig;
      mockAnalysisConfigManager.validateConfig.mockReturnValue(mockValidation);
      mockAnalysisConfigManager.saveConfig.mockImplementation(() => {});

      await ConfigController.importConfig(mockRequest as Request, mockResponse as Response);

      expect(mockAnalysisConfigManager.validateConfig).toHaveBeenCalledWith(mockConfig);
      expect(mockAnalysisConfigManager.saveConfig).toHaveBeenCalledWith(mockConfig);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        config: mockConfig,
        message: 'Configuration imported successfully'
      });
    });

    it('should reject invalid configuration', async () => {
      const mockConfig = { seoWeights: { technical: 1.5 } };
      const mockValidation = { valid: false, errors: ['Invalid weight'] };

      mockRequest.body = mockConfig;
      mockAnalysisConfigManager.validateConfig.mockReturnValue(mockValidation);

      await ConfigController.importConfig(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid configuration',
        validationErrors: mockValidation.errors
      });
    });

    it('should handle import errors', async () => {
      const mockConfig = { seoWeights: { technical: 0.4 } };
      const mockValidation = { valid: true, errors: [] };

      mockRequest.body = mockConfig;
      mockAnalysisConfigManager.validateConfig.mockReturnValue(mockValidation);
      mockAnalysisConfigManager.saveConfig.mockImplementation(() => {
        throw new Error('Save error');
      });

      await ConfigController.importConfig(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Save error'
      });
    });
  });
});