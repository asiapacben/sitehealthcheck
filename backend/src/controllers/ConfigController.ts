import { Request, Response } from 'express';
import { AnalysisConfigManager, FeatureFlags, EnvironmentConfig } from '../config/AnalysisConfig';
import { AnalysisConfig } from '../../../shared/types';

export class ConfigController {
  /**
   * Get current configuration
   */
  static async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = AnalysisConfigManager.loadConfig();
      res.json({
        success: true,
        config
      });
    } catch (error) {
      console.error('Error loading configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load configuration'
      });
    }
  }

  /**
   * Update scoring weights
   */
  static async updateScoringWeights(req: Request, res: Response): Promise<void> {
    try {
      const { seoWeights, geoWeights } = req.body;
      
      const updatedConfig = AnalysisConfigManager.updateScoringWeights({
        seoWeights,
        geoWeights
      });

      res.json({
        success: true,
        config: updatedConfig,
        message: 'Scoring weights updated successfully'
      });
    } catch (error) {
      console.error('Error updating scoring weights:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update scoring weights'
      });
    }
  }

  /**
   * Update analysis thresholds
   */
  static async updateThresholds(req: Request, res: Response): Promise<void> {
    try {
      const thresholds = req.body;
      
      const updatedConfig = AnalysisConfigManager.updateThresholds(thresholds);

      res.json({
        success: true,
        config: updatedConfig,
        message: 'Thresholds updated successfully'
      });
    } catch (error) {
      console.error('Error updating thresholds:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update thresholds'
      });
    }
  }

  /**
   * Update feature flags
   */
  static async updateFeatureFlags(req: Request, res: Response): Promise<void> {
    try {
      const flags: Partial<FeatureFlags> = req.body;
      
      const updatedConfig = AnalysisConfigManager.updateFeatureFlags(flags);

      res.json({
        success: true,
        config: updatedConfig,
        message: 'Feature flags updated successfully'
      });
    } catch (error) {
      console.error('Error updating feature flags:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update feature flags'
      });
    }
  }

  /**
   * Update environment configuration
   */
  static async updateEnvironmentConfig(req: Request, res: Response): Promise<void> {
    try {
      const envConfig: Partial<EnvironmentConfig> = req.body;
      
      const updatedConfig = AnalysisConfigManager.updateEnvironmentConfig(envConfig);

      res.json({
        success: true,
        config: updatedConfig,
        message: 'Environment configuration updated successfully'
      });
    } catch (error) {
      console.error('Error updating environment configuration:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update environment configuration'
      });
    }
  }

  /**
   * Get available configuration presets
   */
  static async getPresets(req: Request, res: Response): Promise<void> {
    try {
      const presets = AnalysisConfigManager.getConfigPresets();
      const presetNames = AnalysisConfigManager.getAvailablePresets();

      res.json({
        success: true,
        presets,
        presetNames
      });
    } catch (error) {
      console.error('Error loading presets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load configuration presets'
      });
    }
  }

  /**
   * Apply configuration preset
   */
  static async applyPreset(req: Request, res: Response): Promise<void> {
    try {
      const { presetName } = req.params;
      
      const updatedConfig = AnalysisConfigManager.applyPreset(presetName);

      res.json({
        success: true,
        config: updatedConfig,
        message: `Applied preset: ${presetName}`
      });
    } catch (error) {
      console.error('Error applying preset:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply preset'
      });
    }
  }

  /**
   * Reset configuration to defaults
   */
  static async resetToDefaults(req: Request, res: Response): Promise<void> {
    try {
      const defaultConfig = AnalysisConfigManager.resetToDefaults();

      res.json({
        success: true,
        config: defaultConfig,
        message: 'Configuration reset to defaults'
      });
    } catch (error) {
      console.error('Error resetting configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset configuration'
      });
    }
  }

  /**
   * Validate configuration
   */
  static async validateConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = req.body;
      const validation = AnalysisConfigManager.validateConfig(config);

      res.json({
        success: true,
        validation
      });
    } catch (error) {
      console.error('Error validating configuration:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate configuration'
      });
    }
  }

  /**
   * Get specific threshold value
   */
  static async getThreshold(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const value = AnalysisConfigManager.getThreshold(key);

      if (value === undefined) {
        res.status(404).json({
          success: false,
          error: `Threshold '${key}' not found`
        });
        return;
      }

      res.json({
        success: true,
        key,
        value
      });
    } catch (error) {
      console.error('Error getting threshold:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get threshold value'
      });
    }
  }

  /**
   * Check if feature is enabled
   */
  static async checkFeature(req: Request, res: Response): Promise<void> {
    try {
      const { feature } = req.params;
      const enabled = AnalysisConfigManager.isFeatureEnabled(feature as keyof FeatureFlags);

      res.json({
        success: true,
        feature,
        enabled
      });
    } catch (error) {
      console.error('Error checking feature:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check feature status'
      });
    }
  }

  /**
   * Export configuration
   */
  static async exportConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = AnalysisConfigManager.loadConfig();
      const { format = 'json' } = req.query;

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="analysis-config.json"');
        res.json(config);
      } else {
        res.status(400).json({
          success: false,
          error: 'Unsupported export format. Only JSON is supported.'
        });
      }
    } catch (error) {
      console.error('Error exporting configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export configuration'
      });
    }
  }

  /**
   * Import configuration
   */
  static async importConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = req.body;
      
      // Validate the imported configuration
      const validation = AnalysisConfigManager.validateConfig(config);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Invalid configuration',
          validationErrors: validation.errors
        });
        return;
      }

      AnalysisConfigManager.saveConfig(config);

      res.json({
        success: true,
        config,
        message: 'Configuration imported successfully'
      });
    } catch (error) {
      console.error('Error importing configuration:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import configuration'
      });
    }
  }
}