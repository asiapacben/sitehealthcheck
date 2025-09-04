import { GooglePageSpeedClient, PageSpeedInsightsResult } from './external/GooglePageSpeedClient';
import { SchemaValidatorClient, SchemaValidationResult } from './external/SchemaValidatorClient';
import { APIKeyManager } from '../utils/APIKeyManager';
import { logger } from '../utils/logger';

export interface ExternalAPIConfig {
  googlePageSpeed?: {
    enabled: boolean;
    timeout?: number;
    retryAttempts?: number;
  };
  schemaValidator?: {
    enabled: boolean;
    timeout?: number;
    retryAttempts?: number;
  };
}

export interface ExternalAPIResults {
  pageSpeed?: {
    mobile?: PageSpeedInsightsResult;
    desktop?: PageSpeedInsightsResult;
    error?: string;
  };
  schemaValidation?: {
    result?: SchemaValidationResult;
    error?: string;
  };
}

export class ExternalAPIService {
  private googlePageSpeedClient?: GooglePageSpeedClient;
  private schemaValidatorClient?: SchemaValidatorClient;
  private apiKeyManager: APIKeyManager;
  private config: Required<ExternalAPIConfig>;

  constructor(config: ExternalAPIConfig = {}) {
    this.config = {
      googlePageSpeed: {
        enabled: true,
        timeout: 30000,
        retryAttempts: 3,
        ...config.googlePageSpeed
      },
      schemaValidator: {
        enabled: true,
        timeout: 30000,
        retryAttempts: 3,
        ...config.schemaValidator
      }
    };

    this.apiKeyManager = new APIKeyManager();
    this.initializeClients();
  }

  private initializeClients(): void {
    // Initialize Google PageSpeed Insights client
    if (this.config.googlePageSpeed.enabled) {
      const apiKey = this.apiKeyManager.getCurrentKey('google-pagespeed');
      if (apiKey) {
        this.googlePageSpeedClient = new GooglePageSpeedClient({
          apiKey,
          timeout: this.config.googlePageSpeed.timeout,
          retryAttempts: this.config.googlePageSpeed.retryAttempts
        });
        logger.info('External API Service: Google PageSpeed Insights client initialized');
      } else {
        logger.warn('External API Service: Google PageSpeed Insights API key not found, service disabled');
        this.config.googlePageSpeed.enabled = false;
      }
    }

    // Initialize Schema Validator client
    if (this.config.schemaValidator.enabled) {
      this.schemaValidatorClient = new SchemaValidatorClient({
        timeout: this.config.schemaValidator.timeout,
        retryAttempts: this.config.schemaValidator.retryAttempts
      });
      logger.info('External API Service: Schema Validator client initialized');
    }
  }

  async analyzeURL(url: string): Promise<ExternalAPIResults> {
    const results: ExternalAPIResults = {};

    // Run analyses in parallel
    const promises: Promise<void>[] = [];

    // Google PageSpeed Insights analysis
    if (this.config.googlePageSpeed.enabled && this.googlePageSpeedClient) {
      promises.push(this.analyzePageSpeed(url, results));
    }

    // Schema validation analysis
    if (this.config.schemaValidator.enabled && this.schemaValidatorClient) {
      promises.push(this.analyzeSchema(url, results));
    }

    // Wait for all analyses to complete
    await Promise.allSettled(promises);

    return results;
  }

  private async analyzePageSpeed(url: string, results: ExternalAPIResults): Promise<void> {
    try {
      if (!this.googlePageSpeedClient) {
        throw new Error('Google PageSpeed client not initialized');
      }

      // Analyze both mobile and desktop
      const [mobileResult, desktopResult] = await Promise.allSettled([
        this.googlePageSpeedClient.analyzeURL(url, 'mobile'),
        this.googlePageSpeedClient.analyzeURL(url, 'desktop')
      ]);

      results.pageSpeed = {};

      if (mobileResult.status === 'fulfilled') {
        results.pageSpeed.mobile = mobileResult.value;
      } else {
        logger.error('PageSpeed mobile analysis failed', {
          url,
          error: mobileResult.reason.message
        });
        this.handleAPIKeyFailure('google-pagespeed', mobileResult.reason);
      }

      if (desktopResult.status === 'fulfilled') {
        results.pageSpeed.desktop = desktopResult.value;
      } else {
        logger.error('PageSpeed desktop analysis failed', {
          url,
          error: desktopResult.reason.message
        });
        this.handleAPIKeyFailure('google-pagespeed', desktopResult.reason);
      }

      // If both failed, set error message
      if (mobileResult.status === 'rejected' && desktopResult.status === 'rejected') {
        results.pageSpeed.error = `PageSpeed analysis failed: ${mobileResult.reason.message}`;
      }

    } catch (error) {
      logger.error('PageSpeed analysis error', { url, error: (error as Error).message });
      results.pageSpeed = {
        error: `PageSpeed analysis failed: ${(error as Error).message}`
      };
      this.handleAPIKeyFailure('google-pagespeed', error as Error);
    }
  }

  private async analyzeSchema(url: string, results: ExternalAPIResults): Promise<void> {
    try {
      if (!this.schemaValidatorClient) {
        throw new Error('Schema Validator client not initialized');
      }

      const result = await this.schemaValidatorClient.validateURL(url);
      results.schemaValidation = { result };

    } catch (error) {
      logger.error('Schema validation error', { url, error: (error as Error).message });
      results.schemaValidation = {
        error: `Schema validation failed: ${(error as Error).message}`
      };
    }
  }

  private handleAPIKeyFailure(service: string, error: Error): void {
    const currentKey = this.apiKeyManager.getCurrentKey(service);
    if (currentKey) {
      this.apiKeyManager.reportKeyFailure(service, currentKey);
      
      // Reinitialize client with new key if rotation occurred
      if (service === 'google-pagespeed') {
        const newKey = this.apiKeyManager.getCurrentKey(service);
        if (newKey && newKey !== currentKey) {
          this.googlePageSpeedClient = new GooglePageSpeedClient({
            apiKey: newKey,
            timeout: this.config.googlePageSpeed.timeout,
            retryAttempts: this.config.googlePageSpeed.retryAttempts
          });
          logger.info('External API Service: Reinitialized Google PageSpeed client with new API key');
        }
      }
    }
  }

  async analyzeBatch(urls: string[]): Promise<Array<{
    url: string;
    results?: ExternalAPIResults;
    error?: string;
  }>> {
    const batchResults = await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const results = await this.analyzeURL(url);
          return { url, results };
        } catch (error) {
          return { url, error: (error as Error).message };
        }
      })
    );

    return batchResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          url: urls[index],
          error: result.reason.message || 'Unknown error occurred'
        };
      }
    });
  }

  async performHealthChecks(): Promise<Record<string, boolean>> {
    const healthResults: Record<string, boolean> = {};

    // Google PageSpeed health check
    if (this.config.googlePageSpeed.enabled && this.googlePageSpeedClient) {
      try {
        await this.apiKeyManager.performHealthCheck('google-pagespeed', async (key) => {
          const tempClient = new GooglePageSpeedClient({ apiKey: key });
          return await tempClient.healthCheck();
        });
        healthResults['google-pagespeed'] = await this.googlePageSpeedClient.healthCheck();
      } catch (error) {
        logger.error('Google PageSpeed health check failed', { error: (error as Error).message });
        healthResults['google-pagespeed'] = false;
      }
    }

    // Schema Validator health check
    if (this.config.schemaValidator.enabled && this.schemaValidatorClient) {
      try {
        healthResults['schema-validator'] = await this.schemaValidatorClient.healthCheck();
      } catch (error) {
        logger.error('Schema Validator health check failed', { error: (error as Error).message });
        healthResults['schema-validator'] = false;
      }
    }

    return healthResults;
  }

  getServiceStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    // API Key Manager stats
    stats.apiKeys = this.apiKeyManager.getAllStats();

    // Rate limiter stats
    if (this.googlePageSpeedClient) {
      stats.googlePageSpeed = {
        remainingQuota: this.googlePageSpeedClient.getRemainingQuota(),
        enabled: this.config.googlePageSpeed.enabled
      };
    }

    if (this.schemaValidatorClient) {
      stats.schemaValidator = {
        remainingQuota: this.schemaValidatorClient.getRemainingQuota(),
        enabled: this.config.schemaValidator.enabled
      };
    }

    return stats;
  }

  isServiceAvailable(service: 'google-pagespeed' | 'schema-validator'): boolean {
    switch (service) {
      case 'google-pagespeed':
        return this.config.googlePageSpeed.enabled && !!this.googlePageSpeedClient;
      case 'schema-validator':
        return this.config.schemaValidator.enabled && !!this.schemaValidatorClient;
      default:
        return false;
    }
  }

  async rotateAPIKeys(): Promise<void> {
    const services = ['google-pagespeed', 'schema-validator'];
    
    for (const service of services) {
      const rotated = this.apiKeyManager.rotateKey(service);
      if (rotated) {
        logger.info(`External API Service: Rotated API key for ${service}`);
        
        // Reinitialize clients with new keys
        if (service === 'google-pagespeed') {
          const newKey = this.apiKeyManager.getCurrentKey(service);
          if (newKey) {
            this.googlePageSpeedClient = new GooglePageSpeedClient({
              apiKey: newKey,
              timeout: this.config.googlePageSpeed.timeout,
              retryAttempts: this.config.googlePageSpeed.retryAttempts
            });
          }
        }
      }
    }
  }

  shutdown(): void {
    this.apiKeyManager.shutdown();
    logger.info('External API Service: Shutdown completed');
  }
}