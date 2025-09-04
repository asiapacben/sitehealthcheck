import { ErrorHandler } from '../ErrorHandler';
import { NetworkError, ParsingError, APIError, ErrorContext } from '@shared/types';
import { logger } from '../logger';

// Mock the logger
jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    mockLogger = logger as jest.Mocked<typeof logger>;
    jest.clearAllMocks();
    errorHandler.resetErrorMetrics();
  });

  describe('Network Error Handling', () => {
    it('should handle timeout errors correctly', () => {
      const networkError: NetworkError = {
        name: 'NetworkError',
        message: 'Request timeout',
        code: 'TIMEOUT',
        url: 'https://example.com',
        statusCode: 408
      };

      const context: ErrorContext = {
        jobId: 'test-job-123',
        url: 'https://example.com',
        timestamp: new Date()
      };

      const result = errorHandler.handleNetworkError(networkError, context);

      expect(result.completedChecks).toEqual([]);
      expect(result.failedChecks).toContain('network-connectivity');
      expect(result.results.overallScore).toBe(0);
      expect(result.errors).toContain(networkError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Network error encountered',
        expect.objectContaining({
          url: 'https://example.com',
          code: 'TIMEOUT',
          statusCode: 408,
          troubleshooting: expect.objectContaining({
            errorType: 'TIMEOUT',
            userMessage: expect.stringContaining('took too long to respond')
          })
        })
      );
    });

    it('should handle DNS failure errors', () => {
      const networkError: NetworkError = {
        name: 'NetworkError',
        message: 'DNS lookup failed',
        code: 'DNS_FAILURE',
        url: 'https://nonexistent.example.com'
      };

      const result = errorHandler.handleNetworkError(networkError);

      expect(result.failedChecks).toContain('network-connectivity');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Network error encountered',
        expect.objectContaining({
          code: 'DNS_FAILURE',
          troubleshooting: expect.objectContaining({
            errorType: 'DNS_FAILURE',
            possibleCauses: expect.arrayContaining([
              expect.stringContaining('Domain name is misspelled')
            ])
          })
        })
      );
    });

    it('should handle connection refused errors', () => {
      const networkError: NetworkError = {
        name: 'NetworkError',
        message: 'Connection refused',
        code: 'CONNECTION_REFUSED',
        url: 'https://example.com'
      };

      const result = errorHandler.handleNetworkError(networkError);

      expect(result.failedChecks).toContain('network-connectivity');
      expect(result.results.overallScore).toBe(0);
    });
  });

  describe('Parsing Error Handling', () => {
    it('should handle HTML parsing errors with graceful degradation', () => {
      const parsingError: ParsingError = {
        name: 'ParsingError',
        message: 'Invalid HTML structure',
        code: 'PARSING_ERROR',
        url: 'https://example.com',
        element: 'title'
      };

      const result = errorHandler.handleParsingError(parsingError);

      expect(result.completedChecks).toContain('basic-connectivity');
      expect(result.failedChecks).toContain('html-parsing');
      expect(result.failedChecks).toContain('content-analysis');
      expect(result.failedChecks).toContain('parsing-title');
      expect(result.results.overallScore).toBe(25); // Partial score
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Parsing error encountered',
        expect.objectContaining({
          code: 'PARSING_ERROR',
          element: 'title'
        })
      );
    });

    it('should handle missing element errors', () => {
      const parsingError: ParsingError = {
        name: 'ParsingError',
        message: 'Missing required element',
        code: 'MISSING_ELEMENT',
        url: 'https://example.com',
        element: 'meta[name="description"]'
      };

      const result = errorHandler.handleParsingError(parsingError);

      expect(result.completedChecks).toContain('basic-connectivity');
      expect(result.failedChecks).toContain('parsing-meta[name="description"]');
    });
  });

  describe('API Error Handling', () => {
    it('should handle rate limiting errors', () => {
      const apiError: APIError = {
        name: 'APIError',
        message: 'Rate limit exceeded',
        code: 'RATE_LIMITED',
        service: 'pagespeed-insights',
        statusCode: 429,
        retryAfter: 60
      };

      const result = errorHandler.handleAPIError(apiError);

      expect(result.completedChecks).toContain('basic-connectivity');
      expect(result.completedChecks).toContain('html-parsing');
      expect(result.failedChecks).toContain('api-pagespeed-insights');
      expect(result.failedChecks).toContain('core-web-vitals');
      expect(result.failedChecks).toContain('performance-metrics');
      expect(result.results.overallScore).toBe(60); // Partial score
      expect(mockLogger.error).toHaveBeenCalledWith(
        'API error encountered',
        expect.objectContaining({
          service: 'pagespeed-insights',
          code: 'RATE_LIMITED',
          retryAfter: 60,
          troubleshooting: expect.objectContaining({
            errorType: 'RATE_LIMITED'
          })
        })
      );
    });

    it('should handle service unavailable errors', () => {
      const apiError: APIError = {
        name: 'APIError',
        message: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
        service: 'schema-validator',
        statusCode: 503
      };

      const result = errorHandler.handleAPIError(apiError);

      expect(result.failedChecks).toContain('api-schema-validator');
      expect(result.failedChecks).toContain('structured-data-validation');
    });

    it('should handle authentication errors', () => {
      const apiError: APIError = {
        name: 'APIError',
        message: 'Invalid API key',
        code: 'AUTHENTICATION_ERROR',
        service: 'pagespeed-insights',
        statusCode: 401
      };

      const result = errorHandler.handleAPIError(apiError);

      expect(result.failedChecks).toContain('api-pagespeed-insights');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Retry Logic', () => {
    it('should retry operations with exponential backoff', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve('success');
      });

      const result = await errorHandler.retryWithBackoff(operation, 3, 100);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(
        errorHandler.retryWithBackoff(operation, 2, 100)
      ).rejects.toThrow('Persistent failure');

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('404 not found'));

      await expect(
        errorHandler.retryWithBackoff(operation, 3, 100)
      ).rejects.toThrow('404 not found');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should implement circuit breaker pattern', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Service failure'));
      
      // Give the operation a name for tracking
      Object.defineProperty(operation, 'name', { value: 'testOperation' });

      // First call should attempt retries and track the error
      await expect(
        errorHandler.retryWithCircuitBreaker(operation, 2, 100, 1)
      ).rejects.toThrow('Service failure');

      // Second call should fail fast due to circuit breaker
      await expect(
        errorHandler.retryWithCircuitBreaker(operation, 2, 100, 1)
      ).rejects.toThrow('Circuit breaker open');
    });
  });

  describe('Error Creation Utilities', () => {
    it('should create network errors with appropriate codes', () => {
      const timeoutError = new Error('Request timeout');
      const networkError = errorHandler.createNetworkError(
        'https://example.com',
        timeoutError,
        408
      );

      expect(networkError.name).toBe('NetworkError');
      expect(networkError.code).toBe('TIMEOUT');
      expect(networkError.url).toBe('https://example.com');
      expect(networkError.statusCode).toBe(408);
    });

    it('should create parsing errors with element context', () => {
      const htmlError = new Error('Invalid HTML');
      const parsingError = errorHandler.createParsingError(
        'https://example.com',
        htmlError,
        'title'
      );

      expect(parsingError.name).toBe('ParsingError');
      expect(parsingError.code).toBe('PARSING_ERROR');
      expect(parsingError.element).toBe('title');
    });

    it('should create API errors with service context', () => {
      const rateLimitError = new Error('Too many requests');
      const apiError = errorHandler.createAPIError(
        'pagespeed-insights',
        rateLimitError,
        429,
        60
      );

      expect(apiError.name).toBe('APIError');
      expect(apiError.code).toBe('RATE_LIMITED');
      expect(apiError.service).toBe('pagespeed-insights');
      expect(apiError.retryAfter).toBe(60);
    });
  });

  describe('Troubleshooting Guides', () => {
    it('should provide troubleshooting guide for timeout errors', () => {
      const guide = errorHandler.getTroubleshootingGuide('TIMEOUT');

      expect(guide).toBeDefined();
      expect(guide?.errorType).toBe('TIMEOUT');
      expect(guide?.userMessage).toContain('took too long to respond');
      expect(guide?.suggestedActions).toContain('Try again in a few minutes');
      expect(guide?.preventionTips).toContain('Ensure stable internet connection');
    });

    it('should provide troubleshooting guide for DNS failures', () => {
      const guide = errorHandler.getTroubleshootingGuide('DNS_FAILURE');

      expect(guide).toBeDefined();
      expect(guide?.possibleCauses).toContain('Domain name is misspelled');
      expect(guide?.suggestedActions).toContain('Double-check the URL spelling');
    });

    it('should return null for unknown error codes', () => {
      const guide = errorHandler.getTroubleshootingGuide('UNKNOWN_CODE');
      expect(guide).toBeNull();
    });

    it('should provide user-friendly error messages', () => {
      const error = { code: 'TIMEOUT', message: 'Request timeout' } as any;
      const message = errorHandler.getUserFriendlyErrorMessage(error);

      expect(message).toContain('took too long to respond');
      expect(message).toContain('Suggested actions:');
      expect(message).toContain('Try again in a few minutes');
    });

    it('should handle unknown errors gracefully', () => {
      const error = new Error('Unknown error');
      const message = errorHandler.getUserFriendlyErrorMessage(error);

      expect(message).toContain('An unexpected error occurred');
      expect(message).toContain('Unknown error');
    });
  });

  describe('Error Severity and Alerting', () => {
    it('should classify authentication errors as critical', () => {
      const error = new Error('authentication failed');
      const severity = errorHandler.getErrorSeverity(error);
      expect(severity).toBe('critical');
    });

    it('should classify service unavailable as high severity', () => {
      const error = new Error('service unavailable');
      const severity = errorHandler.getErrorSeverity(error);
      expect(severity).toBe('high');
    });

    it('should classify parsing errors as medium severity', () => {
      const error = new Error('HTML parsing failed');
      Object.defineProperty(error, 'constructor', {
        value: { name: 'ParsingError' }
      });
      const severity = errorHandler.getErrorSeverity(error);
      expect(severity).toBe('medium');
    });

    it('should trigger alerts for critical errors', () => {
      const error = new Error('authentication failed');
      const shouldAlert = errorHandler.shouldTriggerAlert(error);
      expect(shouldAlert).toBe(true);
    });

    it('should not trigger alerts for low severity errors', () => {
      const error = new Error('minor issue');
      const shouldAlert = errorHandler.shouldTriggerAlert(error);
      expect(shouldAlert).toBe(false);
    });
  });

  describe('Error Metrics', () => {
    it('should track error metrics correctly', () => {
      const networkError: NetworkError = {
        name: 'NetworkError',
        message: 'Test error',
        code: 'TIMEOUT',
        url: 'https://example.com'
      };

      errorHandler.handleNetworkError(networkError);
      errorHandler.handleNetworkError(networkError);

      const metrics = errorHandler.getErrorMetrics();
      expect(metrics.errorCount).toBe(2);
      expect(metrics.errorsByType.NetworkError).toBe(2);
      expect(metrics.lastErrorTime).toBeInstanceOf(Date);
    });

    it('should reset error metrics', () => {
      const networkError: NetworkError = {
        name: 'NetworkError',
        message: 'Test error',
        code: 'TIMEOUT',
        url: 'https://example.com'
      };

      errorHandler.handleNetworkError(networkError);
      errorHandler.resetErrorMetrics();

      const metrics = errorHandler.getErrorMetrics();
      expect(metrics.errorCount).toBe(0);
      expect(metrics.errorsByType).toEqual({});
    });
  });

  describe('Partial Results Merging', () => {
    it('should merge multiple partial results correctly', () => {
      const partial1 = {
        completedChecks: ['check1', 'check2'],
        failedChecks: ['check3'],
        results: { url: 'https://example.com', timestamp: new Date(), overallScore: 50 },
        errors: [new Error('Error 1')]
      };

      const partial2 = {
        completedChecks: ['check2', 'check4'], // check2 is duplicate
        failedChecks: ['check5'],
        results: { url: 'https://example.com', timestamp: new Date(), overallScore: 60 },
        errors: [new Error('Error 2')]
      };

      const merged = errorHandler.mergePartialResults([partial1, partial2]);

      expect(merged.completedChecks).toEqual(['check1', 'check2', 'check4']);
      expect(merged.failedChecks).toEqual(['check3', 'check5']);
      expect(merged.errors).toHaveLength(2);
      expect(merged.results.overallScore).toBe(60); // 3 completed out of 5 total checks (check1, check2, check4 completed; check3, check5 failed)
    });

    it('should handle single partial result', () => {
      const partial = {
        completedChecks: ['check1'],
        failedChecks: ['check2'],
        results: { url: 'https://example.com', timestamp: new Date(), overallScore: 50 },
        errors: [new Error('Test error')]
      };

      const result = errorHandler.mergePartialResults([partial]);
      expect(result).toEqual(partial);
    });

    it('should throw error for empty partial results array', () => {
      expect(() => errorHandler.mergePartialResults([])).toThrow(
        'Cannot merge empty partial results array'
      );
    });
  });

  describe('Error Logging', () => {
    it('should log errors with appropriate severity levels', () => {
      const criticalError = new Error('authentication failed');
      const context: ErrorContext = {
        jobId: 'test-job',
        timestamp: new Date()
      };

      errorHandler.logError(criticalError, context);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Critical error occurred',
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'authentication failed'
          }),
          context,
          severity: 'critical',
          shouldAlert: true
        })
      );
    });

    it('should log error summaries with distribution data', () => {
      const errors = [
        new Error('Network error'),
        new Error('Parsing error'),
        new Error('authentication failed')
      ];

      errorHandler.logErrorSummary(errors, { jobId: 'test-job' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Error summary report',
        expect.objectContaining({
          totalErrors: 3,
          errorTypes: expect.objectContaining({
            Error: 3
          }),
          severityDistribution: expect.any(Object)
        })
      );
    });
  });

  describe('Recovery Strategy Validation', () => {
    it('should validate successful recovery strategies', async () => {
      const error = new Error('Test error');
      const recoveryFn = jest.fn().mockResolvedValue('recovered');

      const result = await errorHandler.validateRecoveryStrategy(error, recoveryFn);

      expect(result).toBe(true);
      expect(recoveryFn).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Error recovery successful',
        expect.objectContaining({
          errorType: 'Error',
          errorMessage: 'Test error'
        })
      );
    });

    it('should handle failed recovery strategies', async () => {
      const error = new Error('Original error');
      const recoveryFn = jest.fn().mockRejectedValue(new Error('Recovery failed'));

      const result = await errorHandler.validateRecoveryStrategy(error, recoveryFn);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error recovery failed',
        expect.objectContaining({
          originalError: 'Original error',
          recoveryError: 'Recovery failed'
        })
      );
    });
  });
});