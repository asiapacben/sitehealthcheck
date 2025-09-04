import { ScoringConfigManager } from '../ScoringConfig';
import { AnalysisConfig } from '../../../../shared/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ScoringConfigManager', () => {
  const mockConfigDir = path.join(__dirname, '../../config');
  const mockConfigPath = path.join(mockConfigDir, 'scoring-config.json');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDefaultConfig', () => {
    it('should return valid default configuration', () => {
      const config = ScoringConfigManager.getDefaultConfig();
      
      expect(config.seoWeights.technical).toBe(0.4);
      expect(config.seoWeights.content).toBe(0.4);
      expect(config.seoWeights.structure).toBe(0.2);
      expect(config.geoWeights.readability).toBe(0.3);
      expect(config.geoWeights.credibility).toBe(0.3);
      expect(config.geoWeights.completeness).toBe(0.2);
      expect(config.geoWeights.structuredData).toBe(0.2);
      expect(config.thresholds.pageSpeedMin).toBe(90);
      expect(config.thresholds.contentLengthMin).toBe(300);
      expect(config.thresholds.headingLevels).toBe(3);
    });

    it('should have weights that sum to 1.0', () => {
      const config = ScoringConfigManager.getDefaultConfig();
      
      const seoSum = Object.values(config.seoWeights).reduce((sum, weight) => sum + weight, 0);
      const geoSum = Object.values(config.geoWeights).reduce((sum, weight) => sum + weight, 0);
      
      expect(seoSum).toBeCloseTo(1.0);
      expect(geoSum).toBeCloseTo(1.0);
    });
  });

  describe('loadConfig', () => {
    it('should load configuration from file when it exists', () => {
      const mockConfig: AnalysisConfig = {
        seoWeights: { technical: 0.5, content: 0.3, structure: 0.2 },
        geoWeights: { readability: 0.4, credibility: 0.3, completeness: 0.2, structuredData: 0.1 },
        thresholds: { pageSpeedMin: 95, contentLengthMin: 500, headingLevels: 4 }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const config = ScoringConfigManager.loadConfig();
      
      expect(config.seoWeights.technical).toBe(0.5);
      expect(config.thresholds.pageSpeedMin).toBe(95);
    });

    it('should return defaults when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const config = ScoringConfigManager.loadConfig();
      
      expect(config.seoWeights.technical).toBe(0.4);
      expect(config.thresholds.pageSpeedMin).toBe(90);
    });

    it('should return defaults when file is corrupted', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      const config = ScoringConfigManager.loadConfig();
      
      expect(config.seoWeights.technical).toBe(0.4);
      expect(config.thresholds.pageSpeedMin).toBe(90);
    });
  });

  describe('saveConfig', () => {
    it('should save configuration to file', () => {
      const config: AnalysisConfig = {
        seoWeights: { technical: 0.5, content: 0.3, structure: 0.2 },
        geoWeights: { readability: 0.4, credibility: 0.3, completeness: 0.2, structuredData: 0.1 },
        thresholds: { pageSpeedMin: 95, contentLengthMin: 500, headingLevels: 4 }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      ScoringConfigManager.saveConfig(config);
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('scoring-config.json'),
        JSON.stringify(config, null, 2),
        'utf8'
      );
    });

    it('should create config directory if it does not exist', () => {
      const config = ScoringConfigManager.getDefaultConfig();

      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => '');
      mockFs.writeFileSync.mockImplementation(() => {});

      ScoringConfigManager.saveConfig(config);
      
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('config'),
        { recursive: true }
      );
    });

    it('should throw error when save fails', () => {
      const config = ScoringConfigManager.getDefaultConfig();

      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      expect(() => ScoringConfigManager.saveConfig(config)).toThrow('Unable to save scoring configuration');
    });
  });

  describe('getConfigPresets', () => {
    it('should return predefined presets', () => {
      const presets = ScoringConfigManager.getConfigPresets();
      
      expect(presets['seo-focused']).toBeDefined();
      expect(presets['geo-focused']).toBeDefined();
      expect(presets['balanced']).toBeDefined();
      expect(presets['performance-focused']).toBeDefined();
    });

    it('should have valid weights in all presets', () => {
      const presets = ScoringConfigManager.getConfigPresets();
      
      Object.values(presets).forEach(preset => {
        const seoSum = Object.values(preset.seoWeights).reduce((sum, weight) => sum + weight, 0);
        const geoSum = Object.values(preset.geoWeights).reduce((sum, weight) => sum + weight, 0);
        
        expect(seoSum).toBeCloseTo(1.0);
        expect(geoSum).toBeCloseTo(1.0);
      });
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const config: Partial<AnalysisConfig> = {
        seoWeights: { technical: 0.4, content: 0.4, structure: 0.2 },
        geoWeights: { readability: 0.3, credibility: 0.3, completeness: 0.2, structuredData: 0.2 },
        thresholds: { pageSpeedMin: 90, contentLengthMin: 300, headingLevels: 3 }
      };

      const result = ScoringConfigManager.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid SEO weight sum', () => {
      const config: Partial<AnalysisConfig> = {
        seoWeights: { technical: 0.5, content: 0.4, structure: 0.2 } // Sum = 1.1
      };

      const result = ScoringConfigManager.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('SEO weights must sum to 1.0'))).toBe(true);
    });

    it('should detect invalid GEO weight sum', () => {
      const config: Partial<AnalysisConfig> = {
        geoWeights: { readability: 0.4, credibility: 0.4, completeness: 0.3, structuredData: 0.2 } // Sum = 1.3
      };

      const result = ScoringConfigManager.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('GEO weights must sum to 1.0'))).toBe(true);
    });

    it('should detect negative weights', () => {
      const config: Partial<AnalysisConfig> = {
        seoWeights: { technical: -0.1, content: 0.6, structure: 0.5 }
      };

      const result = ScoringConfigManager.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('must be between 0 and 1'))).toBe(true);
    });

    it('should detect invalid page speed threshold', () => {
      const config: Partial<AnalysisConfig> = {
        thresholds: { pageSpeedMin: 150, contentLengthMin: 300, headingLevels: 3 }
      };

      const result = ScoringConfigManager.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Page speed minimum must be between 0 and 100'))).toBe(true);
    });

    it('should detect invalid content length threshold', () => {
      const config: Partial<AnalysisConfig> = {
        thresholds: { pageSpeedMin: 90, contentLengthMin: -100, headingLevels: 3 }
      };

      const result = ScoringConfigManager.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Content length minimum must be positive'))).toBe(true);
    });

    it('should detect invalid heading levels', () => {
      const config: Partial<AnalysisConfig> = {
        thresholds: { pageSpeedMin: 90, contentLengthMin: 300, headingLevels: 7 }
      };

      const result = ScoringConfigManager.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Heading levels must be between 1 and 6'))).toBe(true);
    });
  });

  describe('applyPreset', () => {
    it('should apply valid preset', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      const config = ScoringConfigManager.applyPreset('seo-focused');
      
      expect(config.seoWeights.technical).toBe(0.5);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should throw error for invalid preset', () => {
      expect(() => ScoringConfigManager.applyPreset('invalid-preset')).toThrow('Unknown preset: invalid-preset');
    });
  });

  describe('getAvailablePresets', () => {
    it('should return list of available presets', () => {
      const presets = ScoringConfigManager.getAvailablePresets();
      
      expect(presets).toContain('seo-focused');
      expect(presets).toContain('geo-focused');
      expect(presets).toContain('balanced');
      expect(presets).toContain('performance-focused');
    });
  });

  describe('resetToDefaults', () => {
    it('should reset configuration to defaults', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      const config = ScoringConfigManager.resetToDefaults();
      
      expect(config.seoWeights.technical).toBe(0.4);
      expect(config.seoWeights.content).toBe(0.4);
      expect(config.seoWeights.structure).toBe(0.2);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });
});