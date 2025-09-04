import { ExternalAPIService } from '../ExternalAPIService';
import { GooglePageSpeedClient } from '../external/GooglePageSpeedClient';
import { SchemaValidatorClient } from '../external/SchemaValidatorClient';
import { APIKeyManager } from '../../utils/APIKeyManager';

// Mock the external clients
jest.mock('../external/GooglePageSpeedClient');
jest.mock('../external/SchemaValidatorClient');
jest.mock('../../utils/APIKeyManager');

const MockedGooglePageSpeedClient = GooglePageSpeedClient as jest.MockedClass<typeof GooglePageSpeedClient>;
const MockedSchemaValidatorClient = SchemaValidatorClient as jest.MockedClass<typeof SchemaValidatorClient>;
const MockedAPIKeyManager = APIKeyManager as jest.MockedClass<typeof APIKeyManager>;

describe('ExternalAPIService', () => {
  let service: ExternalAPIService;
  let mockGoogleClient: jest.Mocked<GooglePageSpeedClient>;
  let mockSchemaClient: jest.Mocked<SchemaValidatorClient>;
  let mockKeyManager: jest.Mocked<APIKeyManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock API Key Manager
    mockKeyManager = new MockedAPIKeyManager() as jest.Mocked<APIKeyManager>;
    mockKeyManager.getCurrentKey.mockReturnValue('test-api-key');
    mockKeyManager.getAllStats.mockReturnValue({});
    mockKeyManager.performHealthCheck.mockResolvedValue();

    // Mock Google PageSpeed Client
    mockGoogleClient = new MockedGooglePageSpeedClient({
      apiKey: 'test-key'
    }) as jest.Mocked<GooglePageSpeedClient>;
    
    mockGoogleClient.analyzeURL.mockResolvedValue({
      id: 'test-url',
      loadingExperience: {
        id: 'test-url',
        metrics: {
          FIRST_CONTENTFUL_PAINT_MS: {
            percentile: 1500,
            distributions: [],
            category: 'FAST'
          }
        },
        overall_category: 'FAST'
      },
      lighthouseResult: {
        categories: {
          performance: { id: 'performance', title: 'Performance', score: 0.95 },
          accessibility: { id: 'accessibility', title: 'Accessibility', score: 0.90 },
          'best-practices': { id: 'best-practices', title: 'Best Practices', score: 0.85 },
          seo: { id: 'seo', title: 'SEO', score: 0.88 }
        },
        audits: {}
      }
    });

    mockGoogleClient.healthCheck.mockResolvedValue(true);
    mockGoogleClient.getRemainingQuota.mockReturnValue(100);

    // Mock Schema Validator Client
    mockSchemaClient = new MockedSchemaValidatorClient() as jest.Mocked<SchemaValidatorClient>;
    
    mockSchemaClient.validateURL.mockResolvedValue({
      url: 'https://example.com',
      valid: true,
      errors: [],
      warnings: [],
      schemas: [{
        type: 'Organization',
        format: 'json-ld',
        valid: true,
        properties: ['name', 'url'],
        errors: [],
        warnings: []
      }],
      summary: {
        totalSchemas: 1,
        validSchemas: 1,
        errorCount: 0,
        warningCount: 0
      }
    });

    mockSchemaClient.healthCheck.mockResolvedValue(true);
    mockSchemaClient.getRemainingQuota.mockReturnValue(50);

    // Override the constructor mocks to return our mocked instances
    MockedGooglePageSpeedClient.mockImplementation(() => mockGoogleClient);
    MockedSchemaValidatorClient.mockImplementation(() => mockSchemaClient);
    MockedAPIKeyManager.mockImplementation(() => mockKeyManager);

    service = new ExternalAPIService({
      googlePageSpeed: { enabled: true },
      schemaValidator: { enabled: true }
    });
  });

  describe('analyzeURL', () => {
    it('should analyze URL with both services successfully', async () => {
      const url = 'https://example.com';
      const results = await service.analyzeURL(url);

      expect(results.pageSpeed).toBeDefined();
      expect(results.pageSpeed?.mobile).toBeDefined();
      expect(results.pageSpeed?.desktop).toBeDefined();
      expect(results.schemaValidation).toBeDefined();
      expect(results.schemaValidation?.result).toBeDefined();

      expect(mockGoogleClient.analyzeURL).toHaveBeenCalledTimes(2); // mobile + desktop
      expect(mockSchemaClient.validateURL).toHaveBeenCalledWith(url);
    });

    it('should handle Google PageSpeed API failures gracefully', async () => {
      mockGoogleClient.analyzeURL.mockRejectedValue(new Error('API quota exceeded'));

      const url = 'https://example.com';
      const results = await service.analyzeURL(url);

      expect(results.pageSpeed?.error).toContain('PageSpeed analysis failed');
      expect(results.schemaValidation?.result).toBeDefined(); // Should still work
    });

    it('should handle Schema Validator failures gracefully', async () => {
      mockSchemaClient.validateURL.mockRejectedValue(new Error('Validation service unavailable'));

      const url = 'https://example.com';
      const results = await service.analyzeURL(url);

      expect(results.pageSpeed?.mobile).toBeDefined(); // Should still work
      expect(results.schemaValidation?.error).toContain('Schema validation failed');
    });

    it('should handle API key rotation on failures', async () => {
      mockGoogleClient.analyzeURL.mockRejectedValue(new Error('Invalid API key'));
      mockKeyManager.getCurrentKey
        .mockReturnValueOnce('old-key')
        .mockReturnValueOnce('new-key');

      const url = 'https://example.com';
      await service.analyzeURL(url);

      expect(mockKeyManager.reportKeyFailure).toHaveBeenCalledWith('google-pagespeed', 'old-key');
    });
  });

  describe('analyzeBatch', () => {
    it('should analyze multiple URLs', async () => {
      const urls = ['https://example1.com', 'https://example2.com'];
      const results = await service.analyzeBatch(urls);

      expect(results).toHaveLength(2);
      expect(results[0].url).toBe(urls[0]);
      expect(results[1].url).toBe(urls[1]);
      expect(results[0].results).toBeDefined();
      expect(results[1].results).toBeDefined();
    });

    it('should handle mixed success and failure in batch', async () => {
      mockGoogleClient.analyzeURL
        .mockResolvedValueOnce({} as any) // Success for first URL
        .mockRejectedValueOnce(new Error('Failed')) // Failure for second URL
        .mockResolvedValueOnce({} as any) // Success for first URL desktop
        .mockRejectedValueOnce(new Error('Failed')); // Failure for second URL desktop

      const urls = ['https://example1.com', 'https://example2.com'];
      const results = await service.analyzeBatch(urls);

      expect(results).toHaveLength(2);
      expect(results[0].results).toBeDefined();
      expect(results[1].results).toBeDefined(); // Should have partial results
    });
  });

  describe('performHealthChecks', () => {
    it('should perform health checks for all enabled services', async () => {
      const healthResults = await service.performHealthChecks();

      expect(healthResults['google-pagespeed']).toBe(true);
      expect(healthResults['schema-validator']).toBe(true);
      expect(mockGoogleClient.healthCheck).toHaveBeenCalled();
      expect(mockSchemaClient.healthCheck).toHaveBeenCalled();
    });

    it('should handle health check failures', async () => {
      mockGoogleClient.healthCheck.mockResolvedValue(false);
      mockSchemaClient.healthCheck.mockRejectedValue(new Error('Service down'));

      const healthResults = await service.performHealthChecks();

      expect(healthResults['google-pagespeed']).toBe(false);
      expect(healthResults['schema-validator']).toBe(false);
    });
  });

  describe('getServiceStats', () => {
    it('should return comprehensive service statistics', () => {
      const stats = service.getServiceStats();

      expect(stats.apiKeys).toBeDefined();
      expect(stats.googlePageSpeed).toBeDefined();
      expect(stats.googlePageSpeed.remainingQuota).toBe(100);
      expect(stats.schemaValidator).toBeDefined();
      expect(stats.schemaValidator.remainingQuota).toBe(50);
    });
  });

  describe('isServiceAvailable', () => {
    it('should return correct availability status', () => {
      expect(service.isServiceAvailable('google-pagespeed')).toBe(true);
      expect(service.isServiceAvailable('schema-validator')).toBe(true);
    });

    it('should return false for disabled services', () => {
      const disabledService = new ExternalAPIService({
        googlePageSpeed: { enabled: false },
        schemaValidator: { enabled: false }
      });

      expect(disabledService.isServiceAvailable('google-pagespeed')).toBe(false);
      expect(disabledService.isServiceAvailable('schema-validator')).toBe(false);
    });
  });

  describe('rotateAPIKeys', () => {
    it('should rotate API keys for all services', async () => {
      mockKeyManager.rotateKey.mockReturnValue(true);

      await service.rotateAPIKeys();

      expect(mockKeyManager.rotateKey).toHaveBeenCalledWith('google-pagespeed');
      expect(mockKeyManager.rotateKey).toHaveBeenCalledWith('schema-validator');
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', () => {
      service.shutdown();
      expect(mockKeyManager.shutdown).toHaveBeenCalled();
    });
  });
});

// Integration test with real API responses (mocked)
describe('ExternalAPIService Integration', () => {
  let service: ExternalAPIService;

  beforeEach(() => {
    // Set up environment variables for testing
    process.env.GOOGLE_PAGESPEED_API_KEY = 'test-key-1,test-key-2';
    process.env.GOOGLE_PAGESPEED_ENABLED = 'true';
    process.env.SCHEMA_VALIDATOR_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.GOOGLE_PAGESPEED_API_KEY;
    delete process.env.GOOGLE_PAGESPEED_ENABLED;
    delete process.env.SCHEMA_VALIDATOR_ENABLED;
  });

  it('should initialize with environment configuration', () => {
    service = new ExternalAPIService();
    
    const stats = service.getServiceStats();
    expect(stats.googlePageSpeed?.enabled).toBe(true);
    expect(stats.schemaValidator?.enabled).toBe(true);
  });

  it('should handle configuration changes', () => {
    service = new ExternalAPIService({
      googlePageSpeed: { enabled: false, timeout: 60000 },
      schemaValidator: { enabled: true, retryAttempts: 5 }
    });

    expect(service.isServiceAvailable('google-pagespeed')).toBe(false);
    expect(service.isServiceAvailable('schema-validator')).toBe(true);
  });
});