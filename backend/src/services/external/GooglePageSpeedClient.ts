import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../../utils/logger';
import { APIRateLimiter } from '../../utils/APIRateLimiter';

export interface PageSpeedInsightsResult {
  id: string;
  loadingExperience: {
    id: string;
    metrics: {
      FIRST_CONTENTFUL_PAINT_MS?: MetricData;
      FIRST_INPUT_DELAY_MS?: MetricData;
      LARGEST_CONTENTFUL_PAINT_MS?: MetricData;
      CUMULATIVE_LAYOUT_SHIFT_SCORE?: MetricData;
    };
    overall_category: 'FAST' | 'AVERAGE' | 'SLOW';
  };
  lighthouseResult: {
    categories: {
      performance: CategoryResult;
      accessibility: CategoryResult;
      'best-practices': CategoryResult;
      seo: CategoryResult;
    };
    audits: Record<string, AuditResult>;
  };
}

interface MetricData {
  percentile: number;
  distributions: Array<{
    min: number;
    max?: number;
    proportion: number;
  }>;
  category: 'FAST' | 'AVERAGE' | 'SLOW';
}

interface CategoryResult {
  id: string;
  title: string;
  score: number;
}

interface AuditResult {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  numericValue?: number;
  displayValue?: string;
}

export interface PageSpeedConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class GooglePageSpeedClient {
  private client: AxiosInstance;
  private rateLimiter: APIRateLimiter;
  private config: Required<PageSpeedConfig>;

  constructor(config: PageSpeedConfig) {
    this.config = {
      baseURL: 'https://www.googleapis.com/pagespeedonline/v5',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SEO-GEO-Health-Checker/1.0'
      }
    });

    // Google PageSpeed Insights API has a limit of 25,000 requests per day
    // and 400 requests per 100 seconds per IP
    this.rateLimiter = new APIRateLimiter({
      requestsPerInterval: 400,
      intervalMs: 100000, // 100 seconds
      maxConcurrent: 10
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Making PageSpeed Insights API request', {
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('PageSpeed Insights API request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('PageSpeed Insights API response received', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('PageSpeed Insights API response error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  async analyzeURL(url: string, strategy: 'mobile' | 'desktop' = 'mobile'): Promise<PageSpeedInsightsResult> {
    return this.rateLimiter.execute(async () => {
      const params = {
        url: encodeURIComponent(url),
        key: this.config.apiKey,
        strategy,
        category: ['performance', 'accessibility', 'best-practices', 'seo'].join(','),
        locale: 'en'
      };

      let lastError: Error;
      
      for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
        try {
          const response: AxiosResponse<PageSpeedInsightsResult> = await this.client.get('/runPagespeed', {
            params
          });

          if (!response.data || !response.data.lighthouseResult) {
            throw new Error('Invalid response format from PageSpeed Insights API');
          }

          return response.data;
        } catch (error) {
          lastError = error as Error;
          
          if (this.isRetryableError(error)) {
            if (attempt < this.config.retryAttempts) {
              const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
              logger.warn(`PageSpeed Insights API request failed, retrying in ${delay}ms`, {
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

  async analyzeBatch(urls: string[], strategy: 'mobile' | 'desktop' = 'mobile'): Promise<Array<{
    url: string;
    result?: PageSpeedInsightsResult;
    error?: string;
  }>> {
    const results = await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const result = await this.analyzeURL(url, strategy);
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
      // Retry on server errors, rate limits, and timeouts
      return !status || status >= 500 || status === 429 || error.code === 'ECONNABORTED';
    }
    return false;
  }

  private handleAPIError(error: any, url: string): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;

      switch (status) {
        case 400:
          return new Error(`Invalid URL or parameters: ${message}`);
        case 403:
          return new Error(`API key invalid or quota exceeded: ${message}`);
        case 429:
          return new Error(`Rate limit exceeded. Please try again later: ${message}`);
        case 500:
        case 502:
        case 503:
        case 504:
          return new Error(`PageSpeed Insights service temporarily unavailable: ${message}`);
        default:
          return new Error(`PageSpeed Insights API error: ${message}`);
      }
    }

    return new Error(`Unexpected error analyzing ${url}: ${error.message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Use a simple test URL to check if the API is accessible
      await this.analyzeURL('https://example.com');
      return true;
    } catch (error) {
      logger.error('PageSpeed Insights API health check failed', { error: (error as Error).message });
      return false;
    }
  }

  getRemainingQuota(): number {
    return this.rateLimiter.getRemainingRequests();
  }
}