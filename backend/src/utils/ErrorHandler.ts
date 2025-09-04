import { logger } from './logger';
import { 
  NetworkError, 
  ParsingError, 
  APIError, 
  PartialResults, 
  ErrorHandler as IErrorHandler 
} from '@shared/types';

export interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  lastErrorTime: Date;
  errorsByType: Record<string, number>;
  errorsByService: Record<string, number>;
}

export interface TroubleshootingGuide {
  errorType: string;
  userMessage: string;
  technicalDetails: string;
  possibleCauses: string[];
  suggestedActions: string[];
  preventionTips: string[];
}

export interface ErrorContext {
  jobId?: string;
  url?: string;
  userId?: string;
  userAgent?: string;
  timestamp: Date;
  retryAttempt?: number;
  operationType?: string;
}

export class ErrorHandler implements IErrorHandler {
  private errorMetrics: ErrorMetrics = {
    errorCount: 0,
    errorRate: 0,
    lastErrorTime: new Date(),
    errorsByType: {},
    errorsByService: {}
  };

  private troubleshootingGuides: Map<string, TroubleshootingGuide> = new Map();
  private operationErrors: Map<string, { count: number; lastError: Date }> = new Map();

  constructor() {
    this.initializeTroubleshootingGuides();
  }
  /**
   * Initialize troubleshooting guides for different error types
   */
  private initializeTroubleshootingGuides(): void {
    this.troubleshootingGuides.set('TIMEOUT', {
      errorType: 'TIMEOUT',
      userMessage: 'The website took too long to respond. This might be due to slow server response or network issues.',
      technicalDetails: 'Request timeout exceeded the configured limit',
      possibleCauses: [
        'Server is overloaded or experiencing high traffic',
        'Network connectivity issues',
        'DNS resolution problems',
        'Firewall or security software blocking the request'
      ],
      suggestedActions: [
        'Try again in a few minutes',
        'Check if the website is accessible in your browser',
        'Verify your internet connection',
        'Contact the website administrator if the issue persists'
      ],
      preventionTips: [
        'Use websites with good hosting infrastructure',
        'Consider analyzing during off-peak hours',
        'Ensure stable internet connection'
      ]
    });

    this.troubleshootingGuides.set('DNS_FAILURE', {
      errorType: 'DNS_FAILURE',
      userMessage: 'Unable to find the website. The domain name could not be resolved.',
      technicalDetails: 'DNS lookup failed for the provided domain',
      possibleCauses: [
        'Domain name is misspelled',
        'Domain has expired or been suspended',
        'DNS server issues',
        'Network configuration problems'
      ],
      suggestedActions: [
        'Double-check the URL spelling',
        'Try accessing the website directly in your browser',
        'Wait a few minutes and try again',
        'Contact your network administrator'
      ],
      preventionTips: [
        'Verify domain names before analysis',
        'Use reliable DNS servers',
        'Keep domain registrations up to date'
      ]
    });

    this.troubleshootingGuides.set('RATE_LIMITED', {
      errorType: 'RATE_LIMITED',
      userMessage: 'Too many requests have been made. Please wait before trying again.',
      technicalDetails: 'API rate limit exceeded for external service',
      possibleCauses: [
        'Exceeded API quota for external services',
        'Too many concurrent analyses running',
        'Shared rate limits with other users'
      ],
      suggestedActions: [
        'Wait for the specified retry period',
        'Reduce the number of URLs being analyzed',
        'Try analyzing fewer pages at once',
        'Contact support if you need higher limits'
      ],
      preventionTips: [
        'Analyze URLs in smaller batches',
        'Space out analysis requests',
        'Consider upgrading to higher API limits'
      ]
    });

    this.troubleshootingGuides.set('PARSING_ERROR', {
      errorType: 'PARSING_ERROR',
      userMessage: 'Unable to analyze the webpage content. The page structure may be invalid or incomplete.',
      technicalDetails: 'HTML parsing failed due to malformed content',
      possibleCauses: [
        'Invalid or malformed HTML',
        'JavaScript-heavy content that requires rendering',
        'Protected or restricted content',
        'Incomplete page loading'
      ],
      suggestedActions: [
        'Check if the page loads correctly in a browser',
        'Verify the page is publicly accessible',
        'Try again later in case of temporary issues',
        'Contact the website owner about HTML validation'
      ],
      preventionTips: [
        'Ensure pages have valid HTML',
        'Test pages in multiple browsers',
        'Use HTML validators during development'
      ]
    });

    this.troubleshootingGuides.set('SERVICE_UNAVAILABLE', {
      errorType: 'SERVICE_UNAVAILABLE',
      userMessage: 'External analysis service is temporarily unavailable. Some features may be limited.',
      technicalDetails: 'Third-party service returned 503 Service Unavailable',
      possibleCauses: [
        'External service maintenance',
        'Service overload or outage',
        'Network connectivity issues',
        'Service configuration problems'
      ],
      suggestedActions: [
        'Try again in a few minutes',
        'Check service status pages',
        'Use alternative analysis methods if available',
        'Contact support if the issue persists'
      ],
      preventionTips: [
        'Monitor service status pages',
        'Have backup analysis methods',
        'Schedule analyses during stable periods'
      ]
    });
  }

  /**
   * Handles network-related errors (timeouts, DNS failures, etc.)
   */
  handleNetworkError(error: NetworkError, context?: ErrorContext): PartialResults {
    this.updateErrorMetrics('NetworkError', error.code);
    
    const enrichedContext = {
      ...context,
      timestamp: new Date(),
      errorType: 'NetworkError',
      errorCode: error.code
    };

    logger.error('Network error encountered', {
      url: error.url,
      code: error.code,
      statusCode: error.statusCode,
      message: error.message,
      context: enrichedContext,
      troubleshooting: this.getTroubleshootingGuide(error.code)
    });

    return {
      completedChecks: [],
      failedChecks: ['network-connectivity'],
      results: {
        url: error.url,
        timestamp: new Date(),
        overallScore: 0,
        technicalDetails: {
          loadTime: 0,
          pageSize: 0,
          requests: 0,
          statusCode: error.statusCode || 0,
          redirects: 0
        }
      },
      errors: [error]
    };
  }

  /**
   * Handles HTML parsing errors
   */
  handleParsingError(error: ParsingError, context?: ErrorContext): PartialResults {
    this.updateErrorMetrics('ParsingError', error.code);
    
    const enrichedContext = {
      ...context,
      timestamp: new Date(),
      errorType: 'ParsingError',
      errorCode: error.code,
      element: error.element
    };

    logger.error('Parsing error encountered', {
      url: error.url,
      code: error.code,
      element: error.element,
      message: error.message,
      context: enrichedContext,
      troubleshooting: this.getTroubleshootingGuide(error.code)
    });

    // We can still provide some results even with parsing errors
    const completedChecks = ['basic-connectivity'];
    const failedChecks = ['html-parsing', 'content-analysis'];

    if (error.element) {
      failedChecks.push(`parsing-${error.element}`);
    }

    return {
      completedChecks,
      failedChecks,
      results: {
        url: error.url,
        timestamp: new Date(),
        overallScore: 25, // Partial score since we have basic connectivity
        technicalDetails: {
          loadTime: 0,
          pageSize: 0,
          requests: 0,
          statusCode: 200, // Assume 200 if we got content to parse
          redirects: 0
        }
      },
      errors: [error]
    };
  }

  /**
   * Handles external API errors (rate limits, service unavailable, etc.)
   */
  handleAPIError(error: APIError, context?: ErrorContext): PartialResults {
    this.updateErrorMetrics('APIError', error.service);
    
    const enrichedContext = {
      ...context,
      timestamp: new Date(),
      errorType: 'APIError',
      errorCode: error.code,
      service: error.service
    };

    logger.error('API error encountered', {
      service: error.service,
      code: error.code,
      statusCode: error.statusCode,
      retryAfter: error.retryAfter,
      message: error.message,
      context: enrichedContext,
      troubleshooting: this.getTroubleshootingGuide(error.code)
    });

    // Determine what checks we can still complete without this API
    const completedChecks = ['basic-connectivity', 'html-parsing'];
    const failedChecks = [`api-${error.service}`];

    // Different handling based on which service failed
    switch (error.service) {
      case 'pagespeed-insights':
        failedChecks.push('core-web-vitals', 'performance-metrics');
        break;
      case 'schema-validator':
        failedChecks.push('structured-data-validation');
        break;
      default:
        failedChecks.push('external-service');
    }

    return {
      completedChecks,
      failedChecks,
      results: {
        url: '', // Will be set by caller
        timestamp: new Date(),
        overallScore: 60, // Partial score - we can still do local analysis
        technicalDetails: {
          loadTime: 0,
          pageSize: 0,
          requests: 0,
          statusCode: 200,
          redirects: 0
        }
      },
      errors: [error]
    };
  }

  /**
   * Retry operation with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>, 
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        logger.debug('Retry attempt failed', {
          attempt,
          maxRetries,
          error: lastError.message
        });

        // Don't retry on certain types of errors
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }

        // Don't wait after the last attempt
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
          await this.sleep(delay + jitter);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Creates appropriate error objects based on error type
   */
  createNetworkError(url: string, originalError: Error, statusCode?: number): NetworkError {
    const error = new Error(originalError.message) as NetworkError;
    error.name = 'NetworkError';
    error.url = url;
    error.statusCode = statusCode;
    
    // Determine error code based on the original error
    if (originalError.message.includes('timeout')) {
      error.code = 'TIMEOUT';
    } else if (originalError.message.includes('ENOTFOUND')) {
      error.code = 'DNS_FAILURE';
    } else if (originalError.message.includes('ECONNREFUSED')) {
      error.code = 'CONNECTION_REFUSED';
    } else if (statusCode && statusCode >= 400) {
      error.code = `HTTP_${statusCode}`;
    } else {
      error.code = 'NETWORK_ERROR';
    }
    
    return error;
  }

  createParsingError(url: string, originalError: Error, element?: string): ParsingError {
    const error = new Error(originalError.message) as ParsingError;
    error.name = 'ParsingError';
    error.url = url;
    error.element = element;
    
    if (originalError.message.includes('invalid HTML')) {
      error.code = 'INVALID_HTML';
    } else if (originalError.message.includes('missing')) {
      error.code = 'MISSING_ELEMENT';
    } else {
      error.code = 'PARSING_ERROR';
    }
    
    return error;
  }

  createAPIError(service: string, originalError: Error, statusCode?: number, retryAfter?: number): APIError {
    const error = new Error(originalError.message) as APIError;
    error.name = 'APIError';
    error.service = service;
    error.statusCode = statusCode;
    error.retryAfter = retryAfter;
    
    if (statusCode === 429) {
      error.code = 'RATE_LIMITED';
    } else if (statusCode === 503) {
      error.code = 'SERVICE_UNAVAILABLE';
    } else if (statusCode === 401 || statusCode === 403) {
      error.code = 'AUTHENTICATION_ERROR';
    } else {
      error.code = 'API_ERROR';
    }
    
    return error;
  }

  /**
   * Determines if an error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const nonRetryablePatterns = [
      /404/i,
      /not found/i,
      /forbidden/i,
      /unauthorized/i,
      /invalid url/i,
      /validation/i,
      /authentication/i
    ];

    return nonRetryablePatterns.some(pattern => 
      pattern.test(error.message)
    );
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Merges multiple partial results into a single result
   */
  mergePartialResults(partialResults: PartialResults[]): PartialResults {
    if (partialResults.length === 0) {
      throw new Error('Cannot merge empty partial results array');
    }

    if (partialResults.length === 1) {
      return partialResults[0];
    }

    const merged: PartialResults = {
      completedChecks: [],
      failedChecks: [],
      results: partialResults[0].results,
      errors: []
    };

    // Merge all completed and failed checks
    for (const partial of partialResults) {
      merged.completedChecks.push(...partial.completedChecks);
      merged.failedChecks.push(...partial.failedChecks);
      merged.errors.push(...partial.errors);
    }

    // Remove duplicates
    merged.completedChecks = [...new Set(merged.completedChecks)];
    merged.failedChecks = [...new Set(merged.failedChecks)];

    // Calculate overall score based on success ratio
    const totalChecks = merged.completedChecks.length + merged.failedChecks.length;
    const successRatio = totalChecks > 0 ? merged.completedChecks.length / totalChecks : 0;
    
    if (merged.results) {
      merged.results.overallScore = Math.round(successRatio * 100);
    }

    return merged;
  }

  /**
   * Updates error metrics for monitoring
   */
  private updateErrorMetrics(errorType: string, errorCode: string): void {
    this.errorMetrics.errorCount++;
    this.errorMetrics.lastErrorTime = new Date();
    this.errorMetrics.errorsByType[errorType] = (this.errorMetrics.errorsByType[errorType] || 0) + 1;
    
    // Calculate error rate (errors per minute over last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (this.errorMetrics.lastErrorTime > oneHourAgo) {
      const minutesSinceLastError = (Date.now() - this.errorMetrics.lastErrorTime.getTime()) / (1000 * 60);
      this.errorMetrics.errorRate = this.errorMetrics.errorCount / Math.max(minutesSinceLastError, 1);
    }
  }

  /**
   * Gets troubleshooting guide for specific error code
   */
  getTroubleshootingGuide(errorCode: string): TroubleshootingGuide | null {
    return this.troubleshootingGuides.get(errorCode) || null;
  }

  /**
   * Gets user-friendly error message with troubleshooting info
   */
  getUserFriendlyErrorMessage(error: Error): string {
    let errorCode = 'UNKNOWN_ERROR';
    
    if ('code' in error) {
      errorCode = (error as any).code;
    }
    
    const guide = this.getTroubleshootingGuide(errorCode);
    if (guide) {
      return `${guide.userMessage}\n\nSuggested actions:\n${guide.suggestedActions.map(action => `• ${action}`).join('\n')}`;
    }
    
    return `An unexpected error occurred: ${error.message}. Please try again or contact support if the issue persists.`;
  }

  /**
   * Determines error severity based on type and frequency
   */
  getErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const errorType = error.constructor.name;
    const errorCount = this.errorMetrics.errorsByType[errorType] || 0;
    
    // Critical errors that should never happen
    if (error.message.includes('authentication') || error.message.includes('authorization')) {
      return 'critical';
    }
    
    // High severity for frequent errors or service outages
    if (errorCount > 10 || error.message.includes('service unavailable')) {
      return 'high';
    }
    
    // Medium severity for parsing or network issues
    if (errorType === 'ParsingError' || errorType === 'NetworkError') {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Checks if error should trigger an alert
   */
  shouldTriggerAlert(error: Error): boolean {
    const severity = this.getErrorSeverity(error);
    const errorRate = this.errorMetrics.errorRate;
    
    // Trigger alert for critical errors or high error rates
    return severity === 'critical' || severity === 'high' || errorRate > 5;
  }

  /**
   * Enhanced retry logic with circuit breaker pattern
   */
  async retryWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    circuitBreakerThreshold: number = 5
  ): Promise<T> {
    const operationName = operation.name || 'anonymous';
    const recentErrors = this.getRecentErrors(operationName, 5 * 60 * 1000); // Last 5 minutes
    
    // Circuit breaker: if too many recent failures, fail fast
    if (recentErrors >= circuitBreakerThreshold) {
      throw new Error(`Circuit breaker open for ${operationName}. Too many recent failures (${recentErrors})`);
    }
    
    try {
      return await this.retryWithBackoff(operation, maxRetries, baseDelay);
    } catch (error) {
      // Track operation-specific errors for circuit breaker
      this.trackOperationError(operationName);
      throw error;
    }
  }

  /**
   * Tracks operation-specific errors for circuit breaker
   */
  private trackOperationError(operationName: string): void {
    const existing = this.operationErrors.get(operationName) || { count: 0, lastError: new Date() };
    this.operationErrors.set(operationName, {
      count: existing.count + 1,
      lastError: new Date()
    });
  }

  /**
   * Gets count of recent errors for a specific operation
   */
  private getRecentErrors(operationName: string, timeWindowMs: number): number {
    const operationData = this.operationErrors.get(operationName);
    if (!operationData) {
      return 0;
    }
    
    const cutoff = new Date(Date.now() - timeWindowMs);
    return operationData.lastError > cutoff ? operationData.count : 0;
  }

  /**
   * Enhanced error logging with structured data
   */
  logError(error: Error, context: ErrorContext = { timestamp: new Date() }): void {
    const severity = this.getErrorSeverity(error);
    const shouldAlert = this.shouldTriggerAlert(error);
    const troubleshooting = this.getTroubleshootingGuide((error as any).code || 'UNKNOWN_ERROR');
    
    const logData = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      },
      context,
      severity,
      shouldAlert,
      troubleshooting,
      metrics: this.errorMetrics
    };
    
    // Log at appropriate level based on severity
    switch (severity) {
      case 'critical':
        logger.error('Critical error occurred', logData);
        break;
      case 'high':
        logger.error('High severity error', logData);
        break;
      case 'medium':
        logger.warn('Medium severity error', logData);
        break;
      default:
        logger.info('Low severity error', logData);
    }
    
    // Trigger monitoring alerts if needed
    if (shouldAlert) {
      this.triggerMonitoringAlert(error, context, severity);
    }
  }

  /**
   * Triggers monitoring alerts for critical errors
   */
  private triggerMonitoringAlert(error: Error, context: ErrorContext, severity: string): void {
    // In a real implementation, this would integrate with monitoring services
    // like DataDog, New Relic, or custom alerting systems
    logger.error('ALERT: Critical error requires attention', {
      alert: true,
      error: error.message,
      severity,
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Gets current error metrics for monitoring dashboard
   */
  getErrorMetrics(): ErrorMetrics {
    return { ...this.errorMetrics };
  }

  /**
   * Resets error metrics (useful for testing or periodic resets)
   */
  resetErrorMetrics(): void {
    this.errorMetrics = {
      errorCount: 0,
      errorRate: 0,
      lastErrorTime: new Date(),
      errorsByType: {},
      errorsByService: {}
    };
    this.operationErrors.clear();
  }

  /**
   * Logs error summary for monitoring
   */
  logErrorSummary(errors: Error[], context: { jobId?: string; url?: string } = {}): void {
    const errorSummary = {
      totalErrors: errors.length,
      errorTypes: {} as Record<string, number>,
      severityDistribution: {} as Record<string, number>,
      context,
      timestamp: new Date().toISOString()
    };

    // Count error types and severities
    for (const error of errors) {
      const errorType = error.constructor.name;
      const severity = this.getErrorSeverity(error);
      
      errorSummary.errorTypes[errorType] = (errorSummary.errorTypes[errorType] || 0) + 1;
      errorSummary.severityDistribution[severity] = (errorSummary.severityDistribution[severity] || 0) + 1;
    }

    logger.info('Error summary report', errorSummary);
  }

  /**
   * Validates error recovery strategies
   */
  async validateRecoveryStrategy(error: Error, recoveryFn: () => Promise<any>): Promise<boolean> {
    try {
      await recoveryFn();
      logger.info('Error recovery successful', {
        errorType: error.constructor.name,
        errorMessage: error.message,
        recoveryTime: new Date().toISOString()
      });
      return true;
    } catch (recoveryError) {
      logger.error('Error recovery failed', {
        originalError: error.message,
        recoveryError: recoveryError instanceof Error ? recoveryError.message : 'Unknown recovery error',
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }
}