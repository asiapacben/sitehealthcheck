import { ExternalAPIService } from '../../services/ExternalAPIService';
import { GooglePageSpeedClient } from '../../services/external/GooglePageSpeedClient';
import { SchemaValidatorClient } from '../../services/external/SchemaValidatorClient';

// Mock the external clients for integration testing
jest.mock('../../services/external/GooglePageSpeedClient');
jest.mock('../../services/external/SchemaValidatorClient');

const MockedGooglePageSpeedClient = GooglePageSpeedClient as jest.MockedClass<typeof GooglePageSpeedClient>;
const MockedSchemaValidatorClient = SchemaValidatorClient as jest.MockedClass<typeof SchemaValidatorClient>;

describe('External API Integration', () => {
  let externalAPIService: ExternalAPIService;
  let mockGoogleClient: jest.Mocked<GooglePageSpeedClient>;
  let mockSchemaClient: jest.Mocked<SchemaValidatorClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up environment for testing
    process.env.GOOGLE_PAGESPEED_API_KEY = 'test-key-1,test-key-2';
    process.env.GOOGLE_PAGESPEED_ENABLED = 'true';
    process.env.SCHEMA_VALIDATOR_ENABLED = 'true';

    // Mock Google PageSpeed Client
    mockGoogleClient = {
      analyzeURL: jest.fn(),
      analyzeBatch: jest.fn(),
      healthCheck: jest.fn(),
      getRemainingQuota: jest.fn()
    } as any;

    // Mock Schema Validator Client
    mockSchemaClient = {
      validateURL: jest.fn(),
      validateBatch: jest.fn(),
      healthCheck: jest.fn(),
      getRemainingQuota: jest.fn()
    } as any;

    MockedGooglePageSpeedClient.mockImplementation(() => mockGoogleClient);
    MockedSchemaValidatorClient.mockImplementation(() => mockSchemaClient);

    externalAPIService = new ExternalAPIService();
  });

  afterEach(() => {
    externalAPIService.shutdown();
    delete process.env.GOOGLE_PAGESPEED_API_KEY;
    delete process.env.GOOGLE_PAGESPEED_ENABLED;
    delete process.env.SCHEMA_VALIDATOR_ENABLED;
  });

  describe('Full Analysis Workflow', () => {
    it('should perform complete external API analysis', async () => {
      // Mock successful responses
      mockGoogleClient.analyzeURL.mockResolvedValue({
        id: 'https://example.com',
        loadingExperience: {
          id: 'https://example.com',
          metrics: {
            LARGEST_CONTENTFUL_PAINT_MS: {
              percentile: 2500,
              distributions: [],
              category: 'AVERAGE'
            }
          },
          overall_category: 'AVERAGE'
        },
        lighthouseResult: {
          categories: {
            performance: { id: 'performance', title: 'Performance', score: 0.75 },
            accessibility: { id: 'accessibility', title: 'Accessibility', score: 0.85 },
            'best-practices': { id: 'best-practices', title: 'Best Practices', score: 0.90 },
            seo: { id: 'seo', title: 'SEO', score: 0.80 }
          },
          audits: {
            'first-contentful-paint': {
              id: 'first-contentful-paint',
              title: 'First Contentful Paint',
              description: 'First Contentful Paint marks the time at which the first text or image is painted.',
              score: 0.8,
              scoreDisplayMode: 'numeric',
              numericValue: 1500,
              displayValue: '1.5 s'
            }
          }
        }
      });

      mockSchemaClient.validateURL.mockResolvedValue({
        url: 'https://example.com',
        valid: true,
        errors: [],
        warnings: [{
          type: 'missing_property',
          message: 'Consider adding dateModified property',
          location: 'Article schema',
          recommendation: 'Add dateModified to improve SEO'
        }],
        schemas: [{
          type: 'Article',
          format: 'json-ld',
          valid: true,
          properties: ['headline', 'author', 'datePublished', 'description'],
          errors: [],
          warnings: []
        }],
        summary: {
          totalSchemas: 1,
          validSchemas: 1,
          errorCount: 0,
          warningCount: 1
        }
      });

      mockGoogleClient.healthCheck.mockResolvedValue(true);
      mockSchemaClient.healthCheck.mockResolvedValue(true);
      mockGoogleClient.getRemainingQuota.mockReturnValue(95);
      mockSchemaClient.getRemainingQuota.mockReturnValue(45);

      // Perform analysis
      const results = await externalAPIService.analyzeURL('https://example.com');

      // Verify results structure
      expect(results.pageSpeed).toBeDefined();
      expect(results.pageSpeed?.mobile).toBeDefined();
      expect(results.pageSpeed?.desktop).toBeDefined();
      expect(results.schemaValidation).toBeDefined();
      expect(results.schemaValidation?.result).toBeDefined();

      // Verify PageSpeed results
      expect(results.pageSpeed?.mobile?.lighthouseResult.categories.performance.score).toBe(0.75);
      expect(results.pageSpeed?.desktop?.lighthouseResult.categories.seo.score).toBe(0.80);

      // Verify Schema validation results
      expect(results.schemaValidation?.result?.valid).toBe(true);
      expect(results.schemaValidation?.result?.schemas).toHaveLength(1);
      expect(results.schemaValidation?.result?.schemas[0].type).toBe('Article');

      // Verify API calls
      expect(mockGoogleClient.analyzeURL).toHaveBeenCalledTimes(2); // mobile + desktop
      expect(mockSchemaClient.validateURL).toHaveBeenCalledWith('https://example.com');
    });

    it('should handle partial failures gracefully', async () => {
      // Mock PageSpeed failure and Schema success
      mockGoogleClient.analyzeURL.mockRejectedValue(new Error('Rate limit exceeded'));
      mockSchemaClient.validateURL.mockResolvedValue({
        url: 'https://example.com',
        valid: false,
        errors: [{
          type: 'invalid_schema',
          message: 'Invalid JSON-LD syntax',
          location: 'script tag',
          severity: 'error'
        }],
        warnings: [],
        schemas: [],
        summary: {
          totalSchemas: 0,
          validSchemas: 0,
          errorCount: 1,
          warningCount: 0
        }
      });

      const results = await externalAPIService.analyzeURL('https://example.com');

      // Should have error for PageSpeed but success for Schema
      expect(results.pageSpeed?.error).toContain('PageSpeed analysis failed');
      expect(results.schemaValidation?.result).toBeDefined();
      expect(results.schemaValidation?.result?.valid).toBe(false);
      expect(results.schemaValidation?.result?.errors).toHaveLength(1);
    });

    it('should perform batch analysis correctly', async () => {
      const urls = ['https://example1.com', 'https://example2.com', 'https://example3.com'];

      // Mock successful responses for all URLs
      mockGoogleClient.analyzeURL.mockResolvedValue({
        id: 'test-url',
        loadingExperience: {
          id: 'test-url',
          metrics: {},
          overall_category: 'FAST'
        },
        lighthouseResult: {
          categories: {
            performance: { id: 'performance', title: 'Performance', score: 0.90 },
            accessibility: { id: 'accessibility', title: 'Accessibility', score: 0.85 },
            'best-practices': { id: 'best-practices', title: 'Best Practices', score: 0.88 },
            seo: { id: 'seo', title: 'SEO', score: 0.92 }
          },
          audits: {}
        }
      });

      mockSchemaClient.validateURL.mockResolvedValue({
        url: 'test-url',
        valid: true,
        errors: [],
        warnings: [],
        schemas: [],
        summary: {
          totalSchemas: 0,
          validSchemas: 0,
          errorCount: 0,
          warningCount: 0
        }
      });

      const results = await externalAPIService.analyzeBatch(urls);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.results)).toBe(true);
      expect(results.every(r => !r.error)).toBe(true);

      // Verify all URLs were processed
      expect(results.map(r => r.url)).toEqual(urls);
    });
  });

  describe('Health Monitoring', () => {
    it('should monitor service health correctly', async () => {
      mockGoogleClient.healthCheck.mockResolvedValue(true);
      mockSchemaClient.healthCheck.mockResolvedValue(true);

      const healthResults = await externalAPIService.performHealthChecks();

      expect(healthResults['google-pagespeed']).toBe(true);
      expect(healthResults['schema-validator']).toBe(true);
    });

    it('should report service statistics', () => {
      mockGoogleClient.getRemainingQuota.mockReturnValue(80);
      mockSchemaClient.getRemainingQuota.mockReturnValue(40);

      const stats = externalAPIService.getServiceStats();

      expect(stats.googlePageSpeed).toBeDefined();
      expect(stats.googlePageSpeed.remainingQuota).toBe(80);
      expect(stats.schemaValidator).toBeDefined();
      expect(stats.schemaValidator.remainingQuota).toBe(40);
      expect(stats.apiKeys).toBeDefined();
    });
  });

  describe('API Key Management', () => {
    it('should handle API key rotation', async () => {
      await externalAPIService.rotateAPIKeys();

      // Should not throw and should complete successfully
      expect(true).toBe(true);
    });

    it('should check service availability', () => {
      expect(externalAPIService.isServiceAvailable('google-pagespeed')).toBe(true);
      expect(externalAPIService.isServiceAvailable('schema-validator')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      mockGoogleClient.analyzeURL.mockRejectedValue(new Error('ECONNABORTED'));
      mockSchemaClient.validateURL.mockRejectedValue(new Error('Request timeout'));

      const results = await externalAPIService.analyzeURL('https://example.com');

      expect(results.pageSpeed?.error).toBeDefined();
      expect(results.schemaValidation?.error).toBeDefined();
    });

    it('should handle invalid API responses', async () => {
      mockGoogleClient.analyzeURL.mockResolvedValue(null as any);
      mockSchemaClient.validateURL.mockResolvedValue(null as any);

      const results = await externalAPIService.analyzeURL('https://example.com');

      // Should handle null responses gracefully
      expect(results).toBeDefined();
    });
  });
});