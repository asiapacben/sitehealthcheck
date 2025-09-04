import puppeteer, { Browser, Page } from 'puppeteer';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/ErrorHandler';
import { PerformanceAnalyzer } from './PerformanceAnalyzer';
import { 
  TechnicalSEOResult, 
  QualityScore, 
  NetworkError,
  AnalysisConfig 
} from '@shared/types';

export class TechnicalSEOAnalyzer {
  private browser: Browser | null = null;
  private errorHandler: ErrorHandler;
  private performanceAnalyzer: PerformanceAnalyzer;

  constructor() {
    this.errorHandler = new ErrorHandler();
    this.performanceAnalyzer = new PerformanceAnalyzer();
  }

  /**
   * Analyzes technical SEO factors for a given URL
   */
  async analyzeTechnicalSEO(url: string, config: AnalysisConfig): Promise<TechnicalSEOResult> {
    logger.info('Starting technical SEO analysis', { url });

    try {
      // Initialize browser if not already done
      await this.initializeBrowser();

      // Run parallel analyses
      const [
        pageSpeedResult,
        mobileResponsiveResult,
        crawlabilityResult,
        performanceResult
      ] = await Promise.allSettled([
        this.analyzePageSpeed(url, config),
        this.analyzeMobileResponsiveness(url),
        this.analyzeCrawlability(url),
        this.performanceAnalyzer.analyzePerformance(url)
      ]);

      // Process results and handle any failures
      const performanceData = this.extractResult(performanceResult, null);
      
      const result: TechnicalSEOResult = {
        pageSpeed: this.extractResult(pageSpeedResult, 0),
        mobileResponsive: this.extractResult(mobileResponsiveResult, false),
        crawlability: this.extractResult(crawlabilityResult, {
          score: 0,
          issues: ['Analysis failed'],
          suggestions: ['Retry analysis']
        }),
        coreWebVitals: performanceData ? performanceData.metrics.coreWebVitals : {
          lcp: 0,
          fid: 0,
          cls: 0,
          fcp: 0,
          ttfb: 0,
          score: 0
        }
      };

      logger.info('Technical SEO analysis completed', {
        url,
        pageSpeed: result.pageSpeed,
        mobileResponsive: result.mobileResponsive,
        crawlabilityScore: result.crawlability.score
      });

      return result;

    } catch (error) {
      logger.error('Technical SEO analysis failed', { url, error });
      throw this.errorHandler.createNetworkError(
        url, 
        error instanceof Error ? error : new Error('Technical SEO analysis failed')
      );
    }
  }

  /**
   * Analyzes page speed using Puppeteer
   */
  private async analyzePageSpeed(url: string, config: AnalysisConfig): Promise<number> {
    const page = await this.browser!.newPage();
    
    try {
      // Set up performance monitoring
      await page.setCacheEnabled(false);
      
      const startTime = Date.now();
      
      // Navigate to page and wait for load
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      if (!response || !response.ok()) {
        throw new Error(`HTTP ${response?.status()}: ${response?.statusText()}`);
      }

      const loadTime = Date.now() - startTime;
      
      // Get performance metrics
      const performanceMetrics = await page.evaluate(() => {
        const navigationEntries = (performance as any).getEntriesByType('navigation');
        const navigation = navigationEntries[0];
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
        };
      });

      // Calculate page speed score (0-100)
      // Based on load time thresholds: <1s=100, 1-3s=80-99, 3-5s=60-79, >5s=<60
      let score = 100;
      if (loadTime > 1000) score = Math.max(60, 100 - ((loadTime - 1000) / 100));
      if (loadTime > 3000) score = Math.max(40, 80 - ((loadTime - 3000) / 200));
      if (loadTime > 5000) score = Math.max(20, 60 - ((loadTime - 5000) / 300));

      logger.debug('Page speed analysis completed', {
        url,
        loadTime,
        score,
        metrics: performanceMetrics
      });

      return Math.round(score);

    } finally {
      await page.close();
    }
  }

  /**
   * Analyzes mobile responsiveness
   */
  private async analyzeMobileResponsiveness(url: string): Promise<boolean> {
    const page = await this.browser!.newPage();
    
    try {
      // Set mobile viewport
      await page.setViewport({
        width: 375,
        height: 667,
        isMobile: true,
        hasTouch: true
      });

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Check for mobile-responsive indicators
      const mobileChecks = await page.evaluate(`() => {
        // Check for viewport meta tag
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        const hasViewportMeta = !!viewportMeta;
        
        // Check if content fits in viewport
        const bodyWidth = document.body.scrollWidth;
        const viewportWidth = window.innerWidth;
        const fitsInViewport = bodyWidth <= viewportWidth * 1.1; // Allow 10% tolerance
        
        // Check for responsive CSS
        const hasMediaQueries = Array.from(document.styleSheets).some(sheet => {
          try {
            return Array.from(sheet.cssRules || []).some(rule => 
              rule.type === CSSRule.MEDIA_RULE
            );
          } catch (e) {
            return false; // Cross-origin stylesheets
          }
        });

        // Check for mobile-friendly elements
        const hasFlexbox = getComputedStyle(document.body).display.includes('flex');
        const hasGrid = getComputedStyle(document.body).display.includes('grid');
        
        return {
          hasViewportMeta,
          fitsInViewport,
          hasMediaQueries,
          hasFlexbox,
          hasGrid,
          bodyWidth,
          viewportWidth
        };
      }`);

      // Calculate mobile responsiveness score
      const checks = mobileChecks as any;
      let score = 0;
      if (checks.hasViewportMeta) score += 30;
      if (checks.fitsInViewport) score += 40;
      if (checks.hasMediaQueries) score += 20;
      if (checks.hasFlexbox || checks.hasGrid) score += 10;

      const isMobileResponsive = score >= 70;

      logger.debug('Mobile responsiveness analysis completed', {
        url,
        isMobileResponsive,
        score,
        checks: mobileChecks
      });

      return isMobileResponsive;

    } finally {
      await page.close();
    }
  }

  /**
   * Analyzes crawlability factors
   */
  private async analyzeCrawlability(url: string): Promise<QualityScore> {
    const page = await this.browser!.newPage();
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    try {
      // Check robots.txt first
      const robotsUrl = new URL('/robots.txt', url).toString();
      const robotsCheck = await this.checkRobotsTxt(robotsUrl);
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Analyze page crawlability
      const crawlabilityData = await page.evaluate(`() => {
        // Check meta robots
        const metaRobots = document.querySelector('meta[name="robots"]');
        const robotsContent = metaRobots?.getAttribute('content')?.toLowerCase() || '';
        
        // Check for noindex/nofollow
        const hasNoIndex = robotsContent.includes('noindex');
        const hasNoFollow = robotsContent.includes('nofollow');
        
        // Check canonical URL
        const canonicalLink = document.querySelector('link[rel="canonical"]');
        const canonicalUrl = canonicalLink?.getAttribute('href');
        
        // Check for redirect chains (basic check)
        const currentUrl = window.location.href;
        
        // Check for HTTPS
        const isHttps = window.location.protocol === 'https:';
        
        // Check page structure
        const hasH1 = !!document.querySelector('h1');
        const h1Count = document.querySelectorAll('h1').length;
        
        // Check for XML sitemap reference
        const sitemapLink = document.querySelector('link[rel="sitemap"]') || 
                           document.querySelector('link[type="application/xml"]');
        
        return {
          hasNoIndex,
          hasNoFollow,
          canonicalUrl,
          currentUrl,
          isHttps,
          hasH1,
          h1Count,
          hasSitemapLink: !!sitemapLink,
          robotsContent
        };
      }`);

      let score = 100;
      const data = crawlabilityData as any;

      // Evaluate crawlability factors
      if (data.hasNoIndex) {
        score -= 50;
        issues.push('Page has noindex directive');
        suggestions.push('Remove noindex if you want this page indexed');
      }

      if (!data.isHttps) {
        score -= 20;
        issues.push('Page is not served over HTTPS');
        suggestions.push('Implement SSL certificate and redirect HTTP to HTTPS');
      }

      if (!data.hasH1) {
        score -= 15;
        issues.push('Page missing H1 tag');
        suggestions.push('Add a descriptive H1 tag to the page');
      } else if (data.h1Count > 1) {
        score -= 10;
        issues.push('Multiple H1 tags found');
        suggestions.push('Use only one H1 tag per page');
      }

      if (!data.canonicalUrl) {
        score -= 10;
        issues.push('Missing canonical URL');
        suggestions.push('Add canonical link tag to prevent duplicate content issues');
      }

      if (robotsCheck.blocked) {
        score -= 30;
        issues.push('URL may be blocked by robots.txt');
        suggestions.push('Check robots.txt configuration');
      }

      // Ensure score doesn't go below 0
      score = Math.max(0, score);

      logger.debug('Crawlability analysis completed', {
        url,
        score,
        issues: issues.length,
        data: crawlabilityData
      });

      return {
        score: Math.round(score),
        issues,
        suggestions
      };

    } finally {
      await page.close();
    }
  }



  /**
   * Checks robots.txt for crawl restrictions
   */
  private async checkRobotsTxt(robotsUrl: string): Promise<{ exists: boolean; blocked: boolean; content?: string }> {
    try {
      const page = await this.browser!.newPage();
      
      try {
        const response = await page.goto(robotsUrl, { timeout: 10000 });
        
        if (!response || response.status() === 404) {
          return { exists: false, blocked: false };
        }

        if (!response.ok()) {
          return { exists: false, blocked: false };
        }

        const content = await page.content();
        const robotsText = await page.evaluate(`() => document.body.textContent || ''`);
        
        // Basic check for disallow rules
        const text = robotsText as string;
        const hasDisallowAll = /disallow:\s*\/\s*$/im.test(text);
        const hasUserAgentAll = /user-agent:\s*\*/im.test(text);
        
        const blocked = hasDisallowAll && hasUserAgentAll;

        return {
          exists: true,
          blocked,
          content: text.substring(0, 500) // Limit content length
        };

      } finally {
        await page.close();
      }

    } catch (error) {
      logger.debug('Could not check robots.txt', { robotsUrl, error });
      return { exists: false, blocked: false };
    }
  }

  /**
   * Initializes Puppeteer browser
   */
  private async initializeBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      logger.debug('Puppeteer browser initialized');
    }
  }

  /**
   * Closes the browser instance
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.debug('Puppeteer browser closed');
    }
    
    // Cleanup performance analyzer
    await this.performanceAnalyzer.cleanup();
  }

  /**
   * Extracts result from Promise.allSettled result
   */
  private extractResult<T>(result: PromiseSettledResult<T>, fallback: T): T {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      logger.warn('Analysis step failed, using fallback', { 
        error: result.reason?.message || 'Unknown error' 
      });
      return fallback;
    }
  }
}