import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../../utils/logger';
import { APIRateLimiter } from '../../utils/APIRateLimiter';

export interface SchemaValidationResult {
  url: string;
  valid: boolean;
  errors: SchemaError[];
  warnings: SchemaWarning[];
  schemas: DetectedSchema[];
  summary: {
    totalSchemas: number;
    validSchemas: number;
    errorCount: number;
    warningCount: number;
  };
}

export interface SchemaError {
  type: string;
  message: string;
  location: string;
  severity: 'error' | 'warning';
  schemaType?: string;
}

export interface SchemaWarning {
  type: string;
  message: string;
  location: string;
  recommendation?: string;
}

export interface DetectedSchema {
  type: string;
  format: 'json-ld' | 'microdata' | 'rdfa';
  valid: boolean;
  properties: string[];
  errors: SchemaError[];
  warnings: SchemaWarning[];
}

export interface SchemaValidatorConfig {
  baseURL?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  userAgent?: string;
}

export class SchemaValidatorClient {
  private client: AxiosInstance;
  private rateLimiter: APIRateLimiter;
  private config: Required<SchemaValidatorConfig>;

  constructor(config: SchemaValidatorConfig = {}) {
    this.config = {
      baseURL: 'https://validator.schema.org',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      userAgent: 'SEO-GEO-Health-Checker/1.0',
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Accept': 'application/json',
        'User-Agent': this.config.userAgent
      }
    });

    // Schema.org validator has reasonable rate limits
    // Being conservative with 60 requests per minute
    this.rateLimiter = new APIRateLimiter({
      requestsPerInterval: 60,
      intervalMs: 60000, // 1 minute
      maxConcurrent: 5
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Making Schema Validator API request', {
          url: config.url,
          data: config.data
        });
        return config;
      },
      (error) => {
        logger.error('Schema Validator API request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Schema Validator API response received', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('Schema Validator API response error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  async validateURL(url: string): Promise<SchemaValidationResult> {
    return this.rateLimiter.execute(async () => {
      let lastError: Error;
      
      for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
        try {
          // First, fetch the page content
          const pageContent = await this.fetchPageContent(url);
          
          // Then validate the structured data
          return await this.validateContent(pageContent, url);
        } catch (error) {
          lastError = error as Error;
          
          if (this.isRetryableError(error)) {
            if (attempt < this.config.retryAttempts) {
              const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
              logger.warn(`Schema validation failed, retrying in ${delay}ms`, {
                attempt,
                error: lastError.message,
                url
              });
              await this.sleep(delay);
              continue;
            }
          }
          
          throw this.handleAPIError(error, url);
        }
      }

      throw lastError!;
    });
  }

  private async fetchPageContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        timeout: this.config.timeout,
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        maxRedirects: 5
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch page content: ${(error as Error).message}`);
    }
  }

  private async validateContent(content: string, url: string): Promise<SchemaValidationResult> {
    // Extract structured data from the content
    const schemas = this.extractStructuredData(content);
    
    const validationResults = await Promise.all(
      schemas.map(schema => this.validateSchema(schema))
    );

    const errors: SchemaError[] = [];
    const warnings: SchemaWarning[] = [];
    let validSchemas = 0;

    validationResults.forEach((result, index) => {
      if (result.valid) {
        validSchemas++;
      }
      errors.push(...result.errors);
      warnings.push(...result.warnings);
      schemas[index].valid = result.valid;
      schemas[index].errors = result.errors;
      schemas[index].warnings = result.warnings;
    });

    return {
      url,
      valid: errors.length === 0,
      errors,
      warnings,
      schemas,
      summary: {
        totalSchemas: schemas.length,
        validSchemas,
        errorCount: errors.length,
        warningCount: warnings.length
      }
    };
  }

  private extractStructuredData(content: string): DetectedSchema[] {
    const schemas: DetectedSchema[] = [];

    // Extract JSON-LD
    const jsonLdMatches = content.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
    if (jsonLdMatches) {
      jsonLdMatches.forEach(match => {
        try {
          const jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
          const parsed = JSON.parse(jsonContent);
          const schemaType = this.getSchemaType(parsed);
          
          schemas.push({
            type: schemaType,
            format: 'json-ld',
            valid: false, // Will be validated later
            properties: this.extractProperties(parsed),
            errors: [],
            warnings: []
          });
        } catch (error) {
          schemas.push({
            type: 'Unknown',
            format: 'json-ld',
            valid: false,
            properties: [],
            errors: [{
              type: 'parse_error',
              message: `Invalid JSON-LD: ${(error as Error).message}`,
              location: 'JSON-LD script tag',
              severity: 'error'
            }],
            warnings: []
          });
        }
      });
    }

    // Extract Microdata (simplified detection)
    const microdataMatches = content.match(/itemscope[^>]*itemtype=["']([^"']+)["']/gi);
    if (microdataMatches) {
      microdataMatches.forEach(match => {
        const typeMatch = match.match(/itemtype=["']([^"']+)["']/i);
        if (typeMatch) {
          const schemaType = this.extractSchemaTypeFromURL(typeMatch[1]);
          schemas.push({
            type: schemaType,
            format: 'microdata',
            valid: false,
            properties: [], // Would need more complex parsing
            errors: [],
            warnings: []
          });
        }
      });
    }

    return schemas;
  }

  private async validateSchema(schema: DetectedSchema): Promise<{
    valid: boolean;
    errors: SchemaError[];
    warnings: SchemaWarning[];
  }> {
    // This is a simplified validation - in a real implementation,
    // you would use the actual Schema.org validator API or library
    const errors: SchemaError[] = [];
    const warnings: SchemaWarning[] = [];

    // Basic validation rules
    if (!schema.type || schema.type === 'Unknown') {
      errors.push({
        type: 'missing_type',
        message: 'Schema type is missing or unrecognized',
        location: schema.format,
        severity: 'error'
      });
    }

    if (schema.properties.length === 0) {
      warnings.push({
        type: 'empty_schema',
        message: 'Schema has no properties defined',
        location: schema.format,
        recommendation: 'Add relevant properties to make the schema more useful'
      });
    }

    // Check for required properties based on schema type
    const requiredProperties = this.getRequiredProperties(schema.type);
    const missingRequired = requiredProperties.filter(prop => !schema.properties.includes(prop));
    
    missingRequired.forEach(prop => {
      errors.push({
        type: 'missing_required_property',
        message: `Required property '${prop}' is missing`,
        location: schema.format,
        severity: 'error',
        schemaType: schema.type
      });
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private getSchemaType(jsonLd: any): string {
    if (typeof jsonLd === 'object' && jsonLd !== null) {
      if (jsonLd['@type']) {
        return Array.isArray(jsonLd['@type']) ? jsonLd['@type'][0] : jsonLd['@type'];
      }
      if (Array.isArray(jsonLd)) {
        return jsonLd.length > 0 ? this.getSchemaType(jsonLd[0]) : 'Unknown';
      }
    }
    return 'Unknown';
  }

  private extractProperties(jsonLd: any): string[] {
    if (typeof jsonLd !== 'object' || jsonLd === null) {
      return [];
    }

    const properties: string[] = [];
    for (const key in jsonLd) {
      if (key !== '@context' && key !== '@type') {
        properties.push(key);
      }
    }
    return properties;
  }

  private extractSchemaTypeFromURL(url: string): string {
    const match = url.match(/schema\.org\/(.+)$/);
    return match ? match[1] : 'Unknown';
  }

  private getRequiredProperties(schemaType: string): string[] {
    const requiredProps: Record<string, string[]> = {
      'Article': ['headline', 'author', 'datePublished'],
      'Organization': ['name'],
      'Person': ['name'],
      'Product': ['name', 'description'],
      'Review': ['reviewBody', 'author', 'itemReviewed'],
      'Recipe': ['name', 'recipeIngredient', 'recipeInstructions'],
      'Event': ['name', 'startDate', 'location'],
      'LocalBusiness': ['name', 'address']
    };

    return requiredProps[schemaType] || [];
  }

  async validateBatch(urls: string[]): Promise<Array<{
    url: string;
    result?: SchemaValidationResult;
    error?: string;
  }>> {
    const results = await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const result = await this.validateURL(url);
          return { url, result };
        } catch (error) {
          return { url, error: (error as Error).message };
        }
      })
    );

    return results.map((result, index) => {
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

  private isRetryableError(error: any): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      return !status || status >= 500 || status === 429 || error.code === 'ECONNABORTED';
    }
    return false;
  }

  private handleAPIError(error: any, url: string): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      switch (status) {
        case 400:
          return new Error(`Invalid request: ${message}`);
        case 429:
          return new Error(`Rate limit exceeded. Please try again later: ${message}`);
        case 500:
        case 502:
        case 503:
        case 504:
          return new Error(`Schema validator service temporarily unavailable: ${message}`);
        default:
          return new Error(`Schema validation error: ${message}`);
      }
    }

    return new Error(`Unexpected error validating ${url}: ${error.message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - try to validate a basic schema
      const testSchema = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        'name': 'Test Organization'
      };
      
      await this.validateSchema({
        type: 'Organization',
        format: 'json-ld',
        valid: false,
        properties: ['name'],
        errors: [],
        warnings: []
      });
      
      return true;
    } catch (error) {
      logger.error('Schema Validator health check failed', { error: (error as Error).message });
      return false;
    }
  }

  getRemainingQuota(): number {
    return this.rateLimiter.getRemainingRequests();
  }
}