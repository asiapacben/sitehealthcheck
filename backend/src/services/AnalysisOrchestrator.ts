import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/ErrorHandler';
import { 
  AnalysisResults, 
  AnalysisStatus, 
  AnalysisConfig, 
  ValidationResult,
  NetworkError,
  ParsingError,
  APIError,
  PartialResults,
  TechnicalSEOResult,
  Recommendation,
  ErrorContext
} from '@shared/types';

export interface AnalysisJob {
  id: string;
  urls: string[];
  config: AnalysisConfig;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  completedUrls: number;
  totalUrls: number;
  results: AnalysisResults[];
  errors: Error[];
  startTime: Date;
  endTime?: Date;
}

export interface AnalysisEngine {
  analyze(url: string, config: AnalysisConfig): Promise<Partial<AnalysisResults>>;
}

export class AnalysisOrchestrator extends EventEmitter {
  private jobs: Map<string, AnalysisJob> = new Map();
  private activeJobs: Set<string> = new Set();
  private maxConcurrentJobs: number;
  private analysisTimeout: number;
  private retryAttempts: number;
  private retryDelay: number;
  private errorHandler: ErrorHandler;

  constructor() {
    super();
    this.maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_ANALYSES || '5');
    this.analysisTimeout = parseInt(process.env.ANALYSIS_TIMEOUT_MS || '30000');
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second base delay
    this.errorHandler = new ErrorHandler();
  }

  /**
   * Starts a new analysis job
   */
  async startAnalysis(
    urls: string[], 
    config: AnalysisConfig = this.getDefaultConfig()
  ): Promise<string> {
    const jobId = uuidv4();
    
    const job: AnalysisJob = {
      id: jobId,
      urls: [...urls], // Create a copy
      config,
      status: 'pending',
      progress: 0,
      completedUrls: 0,
      totalUrls: urls.length,
      results: [],
      errors: [],
      startTime: new Date()
    };

    this.jobs.set(jobId, job);
    
    logger.info('Analysis job created', {
      jobId,
      urlCount: urls.length,
      config: {
        seoWeights: config.seoWeights,
        geoWeights: config.geoWeights
      }
    });

    // Start processing if we have capacity
    this.processJobQueue();

    return jobId;
  }

  /**
   * Gets the status of an analysis job
   */
  getJobStatus(jobId: string): AnalysisStatus | null {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      return null;
    }

    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      completedUrls: job.completedUrls,
      totalUrls: job.totalUrls,
      results: job.results,
      error: job.errors.length > 0 ? job.errors[job.errors.length - 1].message : undefined
    };
  }

  /**
   * Gets completed analysis results
   */
  getJobResults(jobId: string): AnalysisResults[] | null {
    const job = this.jobs.get(jobId);
    
    if (!job || job.status !== 'completed') {
      return null;
    }

    return job.results;
  }

  /**
   * Cancels a running analysis job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      return false;
    }

    if (job.status === 'running') {
      job.status = 'failed';
      job.errors.push(new Error('Job cancelled by user'));
      job.endTime = new Date();
      this.activeJobs.delete(jobId);
      
      logger.info('Analysis job cancelled', { jobId });
      this.emit('jobCancelled', jobId);
      
      // Process next job in queue
      this.processJobQueue();
    }

    return true;
  }

  /**
   * Processes the job queue
   */
  private async processJobQueue(): Promise<void> {
    // Find pending jobs
    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'pending')
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // Start jobs up to the concurrent limit
    for (const job of pendingJobs) {
      if (this.activeJobs.size >= this.maxConcurrentJobs) {
        break;
      }

      this.activeJobs.add(job.id);
      this.processJob(job).catch(error => {
        logger.error('Error processing job', { jobId: job.id, error });
      });
    }
  }

  /**
   * Processes a single analysis job
   */
  private async processJob(job: AnalysisJob): Promise<void> {
    try {
      job.status = 'running';
      logger.info('Starting analysis job', { jobId: job.id });
      
      this.emit('jobStarted', job.id);

      // Process each URL
      for (let i = 0; i < job.urls.length; i++) {
        const url = job.urls[i];
        
        try {
          logger.debug('Analyzing URL', { jobId: job.id, url, progress: `${i + 1}/${job.urls.length}` });
          
          // Analyze URL with timeout and retry logic
          const result = await this.analyzeUrlWithRetry(url, job.config, job.id);
          
          if (result) {
            job.results.push(result);
          }
          
          job.completedUrls = i + 1;
          job.progress = Math.round((job.completedUrls / job.totalUrls) * 100);
          
          this.emit('jobProgress', {
            jobId: job.id,
            progress: job.progress,
            completedUrls: job.completedUrls,
            totalUrls: job.totalUrls,
            currentUrl: url
          });

        } catch (error) {
          const analysisError = error instanceof Error ? error : new Error('Unknown analysis error');
          
          // Enhanced error logging with context
          this.errorHandler.logError(analysisError, {
            jobId: job.id,
            url,
            timestamp: new Date(),
            operationType: 'url-analysis'
          });
          
          job.errors.push(analysisError);
          
          // Continue with next URL even if one fails
          job.completedUrls = i + 1;
          job.progress = Math.round((job.completedUrls / job.totalUrls) * 100);
        }
      }

      // Job completed
      job.status = 'completed';
      job.endTime = new Date();
      
      // Log error summary for the job
      if (job.errors.length > 0) {
        this.errorHandler.logErrorSummary(job.errors, {
          jobId: job.id,
          url: `${job.results.length}/${job.totalUrls} URLs analyzed`
        });
      }

      logger.info('Analysis job completed', {
        jobId: job.id,
        duration: job.endTime.getTime() - job.startTime.getTime(),
        successfulUrls: job.results.length,
        failedUrls: job.errors.length,
        errorMetrics: this.errorHandler.getErrorMetrics()
      });
      
      this.emit('jobCompleted', job.id);

    } catch (error) {
      // Job failed completely
      job.status = 'failed';
      job.endTime = new Date();
      job.errors.push(error instanceof Error ? error : new Error('Job processing failed'));
      
      logger.error('Analysis job failed', { 
        jobId: job.id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      this.emit('jobFailed', job.id);
    } finally {
      this.activeJobs.delete(job.id);
      
      // Process next job in queue
      this.processJobQueue();
    }
  }

  /**
   * Analyzes a single URL with retry logic using enhanced error handling
   */
  private async analyzeUrlWithRetry(
    url: string, 
    config: AnalysisConfig, 
    jobId: string
  ): Promise<AnalysisResults | null> {
    const context: ErrorContext = {
      jobId,
      url,
      timestamp: new Date(),
      operationType: 'url-analysis'
    };

    try {
      // Use enhanced retry with circuit breaker
      return await this.errorHandler.retryWithCircuitBreaker(
        async () => {
          // Create timeout promise
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              const timeoutError = this.errorHandler.createNetworkError(
                url, 
                new Error('Analysis timeout'), 
                408
              );
              reject(timeoutError);
            }, this.analysisTimeout);
          });

          // Create analysis promise
          const analysisPromise = this.performAnalysis(url, config);

          // Race between analysis and timeout
          return await Promise.race([analysisPromise, timeoutPromise]);
        },
        this.retryAttempts,
        this.retryDelay,
        3 // Circuit breaker threshold
      );

    } catch (error) {
      const analysisError = error instanceof Error ? error : new Error('Unknown analysis error');
      
      // Log error with enhanced context
      this.errorHandler.logError(analysisError, {
        ...context,
        retryAttempt: this.retryAttempts
      });

      // Handle different error types with graceful degradation
      if (analysisError.name === 'NetworkError') {
        const partialResults = this.errorHandler.handleNetworkError(
          analysisError as NetworkError, 
          context
        );
        return this.convertPartialToFullResults(partialResults, url);
      } else if (analysisError.name === 'ParsingError') {
        const partialResults = this.errorHandler.handleParsingError(
          analysisError as ParsingError, 
          context
        );
        return this.convertPartialToFullResults(partialResults, url);
      } else if (analysisError.name === 'APIError') {
        const partialResults = this.errorHandler.handleAPIError(
          analysisError as APIError, 
          context
        );
        return this.convertPartialToFullResults(partialResults, url);
      }

      // For other errors, provide user-friendly message
      const userMessage = this.errorHandler.getUserFriendlyErrorMessage(analysisError);
      logger.error('Analysis failed with user message', {
        jobId,
        url,
        userMessage,
        originalError: analysisError.message
      });

      throw analysisError;
    }
  }

  /**
   * Performs actual analysis using technical, content, and structure SEO analyzers
   */
  private async performAnalysis(url: string, config: AnalysisConfig): Promise<AnalysisResults> {
    const { TechnicalSEOAnalyzer } = await import('./TechnicalSEOAnalyzer');
    const { ContentSEOAnalyzer } = await import('./ContentSEOAnalyzer');
    const { StructureAnalyzer } = await import('./StructureAnalyzer');
    const { ScoringEngine } = await import('./ScoringEngine');
    const { PerformanceMonitor } = await import('../utils/PerformanceMonitor');
    
    const technicalAnalyzer = new TechnicalSEOAnalyzer();
    const contentAnalyzer = new ContentSEOAnalyzer();
    const structureAnalyzer = new StructureAnalyzer();
    const scoringEngine = new ScoringEngine(config);
    const performanceMonitor = PerformanceMonitor.getInstance();
    
    try {
      logger.debug('Performing comprehensive SEO analysis', { url });
      
      // Run all SEO analyses in parallel
      const [technicalResult, contentResult, structureResult] = await Promise.all([
        performanceMonitor.monitor(
          `technical-seo-${url}`,
          () => technicalAnalyzer.analyzeTechnicalSEO(url, config),
          { url, type: 'technical-seo' }
        ),
        performanceMonitor.monitor(
          `content-seo-${url}`,
          () => contentAnalyzer.analyzeContentSEO(url, config),
          { url, type: 'content-seo' }
        ),
        performanceMonitor.monitor(
          `structure-seo-${url}`,
          () => structureAnalyzer.analyzeStructure(url, config),
          { url, type: 'structure-seo' }
        )
      ]);

      // Create initial analysis results with raw data
      const initialResults: AnalysisResults = {
        url,
        timestamp: new Date(),
        overallScore: 0, // Will be calculated by scoring engine
        seoScore: {
          overall: 0, // Will be calculated by scoring engine
          technical: this.calculateTechnicalScore(technicalResult.result),
          content: this.calculateContentScore(contentResult.result),
          structure: this.calculateStructureScore(structureResult.result),
          details: {
            pageSpeed: technicalResult.result.pageSpeed,
            mobileResponsive: technicalResult.result.mobileResponsive,
            titleTag: contentResult.result.titleTag,
            metaDescription: contentResult.result.metaDescription,
            headingStructure: contentResult.result.headingStructure,
            internalLinks: structureResult.result.internalLinks
          }
        },
        geoScore: {
          overall: 50, // Placeholder - will be implemented in later tasks
          readability: 50,
          credibility: 50,
          completeness: 50,
          structuredData: 50,
          details: {
            contentClarity: {
              score: 50,
              issues: [],
              suggestions: []
            },
            questionAnswerFormat: false,
            authorInformation: false,
            citations: 0,
            schemaMarkup: []
          }
        },
        recommendations: [], // Will be generated by scoring engine
        technicalDetails: {
          loadTime: technicalResult.result.coreWebVitals.lcp,
          pageSize: 0, // Could be enhanced with additional analysis
          requests: 0, // Could be enhanced with additional analysis
          statusCode: 200,
          redirects: 0
        }
      };

      // Use ScoringEngine to calculate comprehensive scores and recommendations
      const seoScore = scoringEngine.calculateSEOScore(initialResults);
      const geoScore = scoringEngine.calculateGEOScore(initialResults);
      const overallScore = scoringEngine.calculateOverallScore(initialResults);
      const recommendations = scoringEngine.generateRecommendations(initialResults);

      // Update results with calculated scores and recommendations
      const analysisResults: AnalysisResults = {
        ...initialResults,
        overallScore,
        seoScore,
        geoScore,
        recommendations
      };

      logger.info('Analysis completed', {
        url,
        overallScore: analysisResults.overallScore,
        technicalScore: analysisResults.seoScore.technical,
        contentScore: analysisResults.seoScore.content,
        structureScore: analysisResults.seoScore.structure,
        pageSpeed: technicalResult.result.pageSpeed,
        mobileResponsive: technicalResult.result.mobileResponsive,
        titleScore: contentResult.result.titleTag.score,
        metaScore: contentResult.result.metaDescription.score,
        internalLinks: structureResult.result.internalLinks,
        sitemapPresent: structureResult.result.sitemapPresent
      });

      return analysisResults;

    } finally {
      // Clean up resources
      await technicalAnalyzer.cleanup();
    }
  }

  /**
   * Calculates technical SEO score from technical analysis results
   */
  private calculateTechnicalScore(technicalResult: any): number {
    let score = 0;
    let factors = 0;

    // Page speed (40% weight)
    score += technicalResult.pageSpeed * 0.4;
    factors += 0.4;

    // Mobile responsiveness (30% weight)
    score += (technicalResult.mobileResponsive ? 100 : 0) * 0.3;
    factors += 0.3;

    // Crawlability (20% weight)
    score += technicalResult.crawlability.score * 0.2;
    factors += 0.2;

    // Core Web Vitals (10% weight) - simplified scoring
    const cwvScore = this.calculateCoreWebVitalsScore(technicalResult.coreWebVitals);
    score += cwvScore * 0.1;
    factors += 0.1;

    return Math.round(score / factors);
  }

  /**
   * Calculates Core Web Vitals score
   */
  private calculateCoreWebVitalsScore(cwv: { lcp: number; fid: number; cls: number }): number {
    let score = 100;

    // LCP scoring (Good: <2.5s, Needs Improvement: 2.5-4s, Poor: >4s)
    if (cwv.lcp > 4000) score -= 40;
    else if (cwv.lcp > 2500) score -= 20;

    // FID scoring (Good: <100ms, Needs Improvement: 100-300ms, Poor: >300ms)
    if (cwv.fid > 300) score -= 30;
    else if (cwv.fid > 100) score -= 15;

    // CLS scoring (Good: <0.1, Needs Improvement: 0.1-0.25, Poor: >0.25)
    if (cwv.cls > 0.25) score -= 30;
    else if (cwv.cls > 0.1) score -= 15;

    return Math.max(0, score);
  }

  /**
   * Calculates structure SEO score from structure analysis results
   */
  private calculateStructureScore(structureResult: any): number {
    let score = 0;
    let factors = 0;

    // URL structure (40% weight)
    score += structureResult.urlStructure.score * 0.4;
    factors += 0.4;

    // Accessibility (35% weight)
    score += structureResult.accessibility.score * 0.35;
    factors += 0.35;

    // Internal links (15% weight) - scoring based on reasonable link count
    const linkScore = Math.min(100, Math.max(0, (structureResult.internalLinks / 10) * 100));
    score += linkScore * 0.15;
    factors += 0.15;

    // Sitemap presence (10% weight)
    score += (structureResult.sitemapPresent ? 100 : 0) * 0.1;
    factors += 0.1;

    return Math.round(score / factors);
  }

  /**
   * Calculates content SEO score from content analysis results
   */
  private calculateContentScore(contentResult: any): number {
    let score = 0;
    let factors = 0;

    // Title tag (30% weight)
    score += contentResult.titleTag.score * 0.3;
    factors += 0.3;

    // Meta description (25% weight)
    score += contentResult.metaDescription.score * 0.25;
    factors += 0.25;

    // Heading structure (25% weight)
    score += contentResult.headingStructure.score * 0.25;
    factors += 0.25;

    // Keyword optimization (20% weight)
    score += contentResult.keywordOptimization.score * 0.2;
    factors += 0.2;

    return Math.round(score / factors);
  }

  /**
   * Generates recommendations based on technical analysis
   */
  private generateTechnicalRecommendations(technicalResult: any): any[] {
    const recommendations = [];

    // Page speed recommendations
    if (technicalResult.pageSpeed < 70) {
      recommendations.push({
        id: 'improve-page-speed',
        category: 'Technical',
        priority: 'High',
        impact: 85,
        effort: 'Medium',
        title: 'Improve Page Speed',
        description: 'Your page speed score is below the recommended threshold.',
        actionSteps: [
          'Optimize images and use modern formats (WebP, AVIF)',
          'Minify CSS and JavaScript files',
          'Enable compression (gzip/brotli)',
          'Use a Content Delivery Network (CDN)',
          'Optimize server response time'
        ]
      });
    }

    // Mobile responsiveness recommendations
    if (!technicalResult.mobileResponsive) {
      recommendations.push({
        id: 'mobile-responsiveness',
        category: 'Technical',
        priority: 'High',
        impact: 90,
        effort: 'Hard',
        title: 'Implement Mobile Responsiveness',
        description: 'Your website is not mobile-friendly.',
        actionSteps: [
          'Add viewport meta tag',
          'Use responsive CSS media queries',
          'Implement flexible grid layouts',
          'Optimize touch targets for mobile',
          'Test on various mobile devices'
        ]
      });
    }

    // Crawlability recommendations
    if (technicalResult.crawlability.score < 80) {
      recommendations.push({
        id: 'improve-crawlability',
        category: 'Technical',
        priority: 'Medium',
        impact: 70,
        effort: 'Easy',
        title: 'Improve Crawlability',
        description: 'Search engines may have difficulty crawling your site.',
        actionSteps: technicalResult.crawlability.suggestions
      });
    }

    // Core Web Vitals recommendations
    const cwvScore = this.calculateCoreWebVitalsScore(technicalResult.coreWebVitals);
    if (cwvScore < 70) {
      recommendations.push({
        id: 'core-web-vitals',
        category: 'Technical',
        priority: 'High',
        impact: 80,
        effort: 'Medium',
        title: 'Optimize Core Web Vitals',
        description: 'Your Core Web Vitals scores need improvement.',
        actionSteps: [
          'Optimize Largest Contentful Paint (LCP)',
          'Reduce First Input Delay (FID)',
          'Minimize Cumulative Layout Shift (CLS)',
          'Use performance monitoring tools',
          'Implement performance budgets'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Generates recommendations based on content analysis
   */
  private generateContentRecommendations(contentResult: any): any[] {
    const recommendations = [];

    // Title tag recommendations
    if (contentResult.titleTag.score < 70) {
      recommendations.push({
        id: 'optimize-title-tag',
        category: 'SEO',
        priority: 'High',
        impact: 90,
        effort: 'Easy',
        title: 'Optimize Title Tag',
        description: 'Your title tag needs improvement for better SEO performance.',
        actionSteps: contentResult.titleTag.suggestions
      });
    }

    // Meta description recommendations
    if (contentResult.metaDescription.score < 70) {
      recommendations.push({
        id: 'optimize-meta-description',
        category: 'SEO',
        priority: 'High',
        impact: 80,
        effort: 'Easy',
        title: 'Optimize Meta Description',
        description: 'Your meta description could be improved to increase click-through rates.',
        actionSteps: contentResult.metaDescription.suggestions
      });
    }

    // Heading structure recommendations
    if (contentResult.headingStructure.score < 70) {
      recommendations.push({
        id: 'improve-heading-structure',
        category: 'SEO',
        priority: 'Medium',
        impact: 70,
        effort: 'Medium',
        title: 'Improve Heading Structure',
        description: 'Your heading structure needs optimization for better content organization.',
        actionSteps: contentResult.headingStructure.suggestions
      });
    }

    // Keyword optimization recommendations
    if (contentResult.keywordOptimization.score < 70) {
      recommendations.push({
        id: 'optimize-keywords',
        category: 'SEO',
        priority: 'Medium',
        impact: 75,
        effort: 'Medium',
        title: 'Optimize Keyword Usage',
        description: 'Your keyword optimization could be improved for better search rankings.',
        actionSteps: contentResult.keywordOptimization.suggestions
      });
    }

    // Content length recommendations
    if (contentResult.contentLength < 300) {
      recommendations.push({
        id: 'increase-content-length',
        category: 'SEO',
        priority: 'Medium',
        impact: 65,
        effort: 'Hard',
        title: 'Increase Content Length',
        description: `Your content is quite short (${contentResult.contentLength} words). Longer content often performs better in search results.`,
        actionSteps: [
          'Expand existing sections with more detailed information',
          'Add relevant examples and case studies',
          'Include frequently asked questions',
          'Add related topics and subtopics',
          'Aim for at least 300-500 words for better SEO performance'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Converts partial results to full analysis results for graceful degradation
   */
  private convertPartialToFullResults(partialResults: PartialResults, url: string): AnalysisResults {
    const baseResults: AnalysisResults = {
      url,
      timestamp: new Date(),
      overallScore: partialResults.results.overallScore || 0,
      seoScore: {
        overall: 0,
        technical: 0,
        content: 0,
        structure: 0,
        details: {
          pageSpeed: 0,
          mobileResponsive: false,
          titleTag: { score: 0, issues: ['Analysis failed'], suggestions: ['Retry analysis'] },
          metaDescription: { score: 0, issues: ['Analysis failed'], suggestions: ['Retry analysis'] },
          headingStructure: { score: 0, issues: ['Analysis failed'], suggestions: ['Retry analysis'] },
          internalLinks: 0
        }
      },
      geoScore: {
        overall: 0,
        readability: 0,
        credibility: 0,
        completeness: 0,
        structuredData: 0,
        details: {
          contentClarity: { score: 0, issues: ['Analysis failed'], suggestions: ['Retry analysis'] },
          questionAnswerFormat: false,
          authorInformation: false,
          citations: 0,
          schemaMarkup: []
        }
      },
      recommendations: [
        {
          id: 'analysis-failed',
          category: 'Technical',
          priority: 'High',
          impact: 100,
          effort: 'Easy',
          title: 'Analysis Failed - Retry Recommended',
          description: `Analysis failed for ${url}. ${partialResults.failedChecks.length} checks failed: ${partialResults.failedChecks.join(', ')}`,
          actionSteps: [
            'Check if the website is accessible',
            'Verify the URL is correct',
            'Try again in a few minutes',
            'Contact support if the issue persists'
          ]
        }
      ],
      technicalDetails: partialResults.results.technicalDetails || {
        loadTime: 0,
        pageSize: 0,
        requests: 0,
        statusCode: 0,
        redirects: 0
      }
    };

    // Add error-specific recommendations based on failed checks
    if (partialResults.failedChecks.includes('network-connectivity')) {
      baseResults.recommendations.push({
        id: 'network-connectivity-failed',
        category: 'Technical',
        priority: 'High',
        impact: 100,
        effort: 'Easy',
        title: 'Network Connectivity Issue',
        description: 'Unable to connect to the website',
        actionSteps: [
          'Verify the website URL is correct',
          'Check if the website is online',
          'Ensure your internet connection is stable',
          'Try accessing the website in a browser'
        ]
      });
    }

    if (partialResults.failedChecks.includes('html-parsing')) {
      baseResults.recommendations.push({
        id: 'html-parsing-failed',
        category: 'Technical',
        priority: 'Medium',
        impact: 80,
        effort: 'Medium',
        title: 'HTML Parsing Issue',
        description: 'Unable to parse the website content',
        actionSteps: [
          'Check if the website loads properly in a browser',
          'Validate HTML markup using W3C validator',
          'Ensure the page is publicly accessible',
          'Check for JavaScript-heavy content that may need rendering'
        ]
      });
    }

    return baseResults;
  }

  /**
   * Checks if an error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    // Don't retry validation errors, 404s, etc.
    const nonRetryablePatterns = [
      /validation/i,
      /404/i,
      /not found/i,
      /forbidden/i,
      /unauthorized/i,
      /invalid url/i
    ];

    return nonRetryablePatterns.some(pattern => 
      pattern.test(error.message)
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets default analysis configuration
   */
  private getDefaultConfig(): AnalysisConfig {
    return {
      seoWeights: {
        technical: 0.4,
        content: 0.4,
        structure: 0.2
      },
      geoWeights: {
        readability: 0.3,
        credibility: 0.3,
        completeness: 0.2,
        structuredData: 0.2
      },
      thresholds: {
        pageSpeedMin: 70,
        contentLengthMin: 300,
        headingLevels: 3
      }
    };
  }

  /**
   * Cleanup old completed jobs
   */
  cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoffTime = Date.now() - maxAge;
    
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        const jobTime = job.endTime?.getTime() || job.startTime.getTime();
        
        if (jobTime < cutoffTime) {
          this.jobs.delete(jobId);
          logger.debug('Cleaned up old job', { jobId, status: job.status });
        }
      }
    }
  }

  /**
   * Gets orchestrator statistics including error metrics
   */
  getStats(): {
    totalJobs: number;
    activeJobs: number;
    pendingJobs: number;
    completedJobs: number;
    failedJobs: number;
    errorMetrics: any;
  } {
    const jobs = Array.from(this.jobs.values());
    
    return {
      totalJobs: jobs.length,
      activeJobs: jobs.filter(j => j.status === 'running').length,
      pendingJobs: jobs.filter(j => j.status === 'pending').length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
      errorMetrics: this.errorHandler.getErrorMetrics()
    };
  }

  /**
   * Gets troubleshooting information for a specific error code
   */
  getTroubleshootingGuide(errorCode: string) {
    return this.errorHandler.getTroubleshootingGuide(errorCode);
  }

  /**
   * Gets user-friendly error message for display in UI
   */
  getUserFriendlyErrorMessage(error: Error): string {
    return this.errorHandler.getUserFriendlyErrorMessage(error);
  }

  /**
   * Validates error recovery for a failed job
   */
  async validateJobRecovery(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.errors.length === 0) {
      return true;
    }

    const lastError = job.errors[job.errors.length - 1];
    
    return this.errorHandler.validateRecoveryStrategy(lastError, async () => {
      // Simple recovery test - try to restart the job
      if (job.status === 'failed') {
        job.status = 'pending';
        job.errors = [];
        this.processJobQueue();
      }
    });
  }

  /**
   * Generates recommendations based on structure analysis
   */
  private generateStructureRecommendations(structureResult: any): any[] {
    const recommendations = [];

    // URL structure recommendations
    if (structureResult.urlStructure.score < 70) {
      recommendations.push({
        id: 'improve-url-structure',
        category: 'SEO',
        priority: 'Medium',
        impact: 70,
        effort: 'Medium',
        title: 'Improve URL Structure',
        description: 'Your URL structure could be optimized for better SEO performance.',
        actionSteps: structureResult.urlStructure.suggestions
      });
    }

    // Accessibility recommendations
    if (structureResult.accessibility.score < 70) {
      recommendations.push({
        id: 'improve-accessibility',
        category: 'SEO',
        priority: 'High',
        impact: 85,
        effort: 'Medium',
        title: 'Improve Website Accessibility',
        description: 'Your website accessibility needs improvement for better user experience and SEO.',
        actionSteps: structureResult.accessibility.suggestions
      });
    }

    // Internal linking recommendations
    if (structureResult.internalLinks < 5) {
      recommendations.push({
        id: 'increase-internal-links',
        category: 'SEO',
        priority: 'Medium',
        impact: 60,
        effort: 'Easy',
        title: 'Increase Internal Linking',
        description: `Your page has only ${structureResult.internalLinks} internal links. More internal links can help with SEO and user navigation.`,
        actionSteps: [
          'Add relevant internal links to other pages on your site',
          'Use descriptive anchor text for internal links',
          'Link to related content and important pages',
          'Ensure internal links are contextually relevant',
          'Aim for 5-10 internal links per page'
        ]
      });
    } else if (structureResult.internalLinks > 50) {
      recommendations.push({
        id: 'reduce-internal-links',
        category: 'SEO',
        priority: 'Low',
        impact: 30,
        effort: 'Easy',
        title: 'Optimize Internal Link Count',
        description: `Your page has ${structureResult.internalLinks} internal links, which might be excessive.`,
        actionSteps: [
          'Review and remove unnecessary internal links',
          'Focus on the most important and relevant links',
          'Ensure links provide value to users',
          'Consider using navigation menus instead of excessive in-content links'
        ]
      });
    }

    // Sitemap recommendations
    if (!structureResult.sitemapPresent) {
      recommendations.push({
        id: 'create-sitemap',
        category: 'Technical',
        priority: 'Medium',
        impact: 65,
        effort: 'Easy',
        title: 'Create XML Sitemap',
        description: 'Your website is missing an XML sitemap, which helps search engines discover and index your pages.',
        actionSteps: [
          'Generate an XML sitemap for your website',
          'Submit sitemap to Google Search Console',
          'Add sitemap reference to robots.txt file',
          'Keep sitemap updated when adding new pages',
          'Consider creating separate sitemaps for different content types'
        ]
      });
    }

    return recommendations;
  }}
