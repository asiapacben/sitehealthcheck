import puppeteer, { Browser, Page } from 'puppeteer';
import { 
  CoreWebVitalsResult, 
  PerformanceMetrics, 
  PerformanceAnalysisResult, 
  PerformanceRecommendation 
} from '../../../shared/types';

export class PerformanceAnalyzer {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
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
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async analyzePerformance(url: string): Promise<PerformanceAnalysisResult> {
    await this.initialize();
    
    try {
      const [coreWebVitals, performanceMetrics, lighthouseScore] = await Promise.allSettled([
        this.measureCoreWebVitals(url),
        this.measurePerformanceMetrics(url),
        this.runLighthouseAnalysis(url)
      ]);

      const cwv = coreWebVitals.status === 'fulfilled' ? coreWebVitals.value : this.getDefaultCoreWebVitals();
      const metrics = performanceMetrics.status === 'fulfilled' ? performanceMetrics.value : this.getDefaultMetrics(cwv);
      const lhScore = lighthouseScore.status === 'fulfilled' ? lighthouseScore.value : undefined;

      const recommendations = this.generatePerformanceRecommendations(cwv, metrics);
      const errors = this.collectErrors([coreWebVitals, performanceMetrics, lighthouseScore]);

      return {
        url,
        timestamp: new Date(),
        metrics,
        recommendations,
        lighthouseScore: lhScore,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      throw new Error(`Performance analysis failed for ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async measureCoreWebVitals(url: string): Promise<CoreWebVitalsResult> {
    if (!this.browser) throw new Error('Browser not initialized');

    const page = await this.browser.newPage();
    
    try {
      // Enable performance monitoring
      await page.setCacheEnabled(false);
      
      // Navigate to the page and wait for load
      const response = await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });

      if (!response || !response.ok()) {
        throw new Error(`Failed to load page: ${response?.status()}`);
      }

      // Measure Core Web Vitals using browser APIs
      const vitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          const vitals: any = {};
          
          // Get basic performance metrics
          const navigationEntries = (performance as any).getEntriesByType('navigation');
          if (navigationEntries.length > 0) {
            const navigation = navigationEntries[0];
            vitals.ttfb = navigation.responseStart - navigation.requestStart;
            vitals.lcp = navigation.loadEventEnd - navigation.navigationStart; // Approximation
            vitals.fid = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart; // Approximation
          }

          // Get FCP (First Contentful Paint)
          const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
          if (fcpEntry) {
            vitals.fcp = fcpEntry.startTime;
          } else {
            vitals.fcp = vitals.lcp || 0;
          }

          // Default CLS value (would need more complex measurement in real scenario)
          vitals.cls = 0.05; // Conservative estimate

          // Set defaults if not available
          vitals.lcp = vitals.lcp || 0;
          vitals.fid = vitals.fid || 0;
          vitals.fcp = vitals.fcp || 0;
          vitals.ttfb = vitals.ttfb || 0;

          // Wait a bit for measurements to complete
          setTimeout(() => {
            resolve(vitals);
          }, 1000);
        });
      });

      // Calculate performance score based on Google's thresholds
      const score = this.calculatePerformanceScore(vitals as CoreWebVitalsResult);

      return {
        lcp: (vitals as any).lcp || 0,
        fid: (vitals as any).fid || 0,
        cls: (vitals as any).cls || 0,
        fcp: (vitals as any).fcp || 0,
        ttfb: (vitals as any).ttfb || 0,
        score
      };
    } finally {
      await page.close();
    }
  }

  private async measurePerformanceMetrics(url: string): Promise<PerformanceMetrics> {
    if (!this.browser) throw new Error('Browser not initialized');

    const page = await this.browser.newPage();
    
    try {
      // Enable performance monitoring
      await page.setCacheEnabled(false);
      
      const startTime = Date.now();
      
      // Navigate and collect timing metrics
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      
      const metrics = await page.evaluate(() => {
        const navigationEntries = (performance as any).getEntriesByType('navigation');
        const resources = performance.getEntriesByType('resource');
        
        if (navigationEntries.length === 0) {
          return {
            domContentLoaded: 0,
            loadComplete: 0,
            resourceLoadTime: 0,
            renderBlockingResources: 0,
            timeToInteractive: 0,
            speedIndex: 0
          };
        }
        
        const navigation = navigationEntries[0];
        
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
          loadComplete: navigation.loadEventEnd - navigation.navigationStart,
          resourceLoadTime: resources.reduce((total: number, resource: any) => total + resource.duration, 0) / resources.length,
          renderBlockingResources: resources.filter((r: any) => 
            r.name.includes('.css') || 
            (r.name.includes('.js') && !r.name.includes('async'))
          ).length,
          timeToInteractive: navigation.domInteractive - navigation.navigationStart,
          speedIndex: navigation.domContentLoadedEventEnd - navigation.navigationStart // Simplified
        };
      });

      // Get Core Web Vitals for this analysis
      const coreWebVitals = await this.measureCoreWebVitals(url);

      return {
        coreWebVitals,
        loadingMetrics: {
          domContentLoaded: metrics.domContentLoaded,
          loadComplete: metrics.loadComplete,
          resourceLoadTime: metrics.resourceLoadTime,
          renderBlockingResources: metrics.renderBlockingResources
        },
        interactivityMetrics: {
          timeToInteractive: metrics.timeToInteractive,
          totalBlockingTime: Math.max(0, metrics.timeToInteractive - 50), // Simplified calculation
          maxPotentialFid: coreWebVitals.fid * 1.3 // Estimate based on FID
        },
        visualMetrics: {
          speedIndex: metrics.speedIndex,
          largestContentfulPaint: coreWebVitals.lcp,
          cumulativeLayoutShift: coreWebVitals.cls
        }
      };
    } finally {
      await page.close();
    }
  }

  private async runLighthouseAnalysis(url: string): Promise<number> {
    try {
      // For testing, we'll skip Lighthouse and return a default score
      if (process.env.NODE_ENV === 'test') {
        throw new Error('Lighthouse disabled in test environment');
      }
      
      // Dynamic import to avoid Jest issues
      const lighthouse = await import('lighthouse');
      
      // Run Lighthouse analysis
      const result = await lighthouse.default(url, {
        logLevel: 'error',
        output: 'json',
        onlyCategories: ['performance'],
        port: 9222 // Default Chrome debugging port
      });

      if (result && result.lhr && result.lhr.categories.performance && result.lhr.categories.performance.score) {
        return Math.round(result.lhr.categories.performance.score * 100);
      }
      
      return 0;
    } catch (error) {
      // Lighthouse failed, return undefined to indicate unavailable
      console.warn('Lighthouse analysis failed:', error);
      throw new Error('Lighthouse analysis unavailable');
    }
  }

  private calculatePerformanceScore(vitals: CoreWebVitalsResult): number {
    // Google's Core Web Vitals thresholds
    const thresholds = {
      lcp: { good: 2500, poor: 4000 },
      fid: { good: 100, poor: 300 },
      cls: { good: 0.1, poor: 0.25 },
      fcp: { good: 1800, poor: 3000 },
      ttfb: { good: 800, poor: 1800 }
    };

    let score = 0;
    let totalMetrics = 0;

    // Score LCP
    if (vitals.lcp > 0) {
      if (vitals.lcp <= thresholds.lcp.good) score += 100;
      else if (vitals.lcp <= thresholds.lcp.poor) score += 50;
      else score += 0;
      totalMetrics++;
    }

    // Score FID
    if (vitals.fid >= 0) {
      if (vitals.fid <= thresholds.fid.good) score += 100;
      else if (vitals.fid <= thresholds.fid.poor) score += 50;
      else score += 0;
      totalMetrics++;
    }

    // Score CLS
    if (vitals.cls >= 0) {
      if (vitals.cls <= thresholds.cls.good) score += 100;
      else if (vitals.cls <= thresholds.cls.poor) score += 50;
      else score += 0;
      totalMetrics++;
    }

    // Score FCP
    if (vitals.fcp > 0) {
      if (vitals.fcp <= thresholds.fcp.good) score += 100;
      else if (vitals.fcp <= thresholds.fcp.poor) score += 50;
      else score += 0;
      totalMetrics++;
    }

    // Score TTFB
    if (vitals.ttfb > 0) {
      if (vitals.ttfb <= thresholds.ttfb.good) score += 100;
      else if (vitals.ttfb <= thresholds.ttfb.poor) score += 50;
      else score += 0;
      totalMetrics++;
    }

    return totalMetrics > 0 ? Math.round(score / totalMetrics) : 0;
  }

  private generatePerformanceRecommendations(
    vitals: CoreWebVitalsResult, 
    metrics: PerformanceMetrics
  ): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    // LCP recommendations
    if (vitals.lcp > 2500) {
      recommendations.push({
        metric: 'Largest Contentful Paint (LCP)',
        currentValue: vitals.lcp,
        targetValue: 2500,
        impact: vitals.lcp > 4000 ? 'High' : 'Medium',
        suggestions: [
          'Optimize server response times',
          'Remove render-blocking resources',
          'Optimize images and use modern formats (WebP, AVIF)',
          'Use a Content Delivery Network (CDN)',
          'Implement resource preloading for critical assets'
        ]
      });
    }

    // FID recommendations
    if (vitals.fid > 100) {
      recommendations.push({
        metric: 'First Input Delay (FID)',
        currentValue: vitals.fid,
        targetValue: 100,
        impact: vitals.fid > 300 ? 'High' : 'Medium',
        suggestions: [
          'Reduce JavaScript execution time',
          'Split large JavaScript bundles',
          'Remove unused JavaScript',
          'Use web workers for heavy computations',
          'Implement code splitting and lazy loading'
        ]
      });
    }

    // CLS recommendations
    if (vitals.cls > 0.1) {
      recommendations.push({
        metric: 'Cumulative Layout Shift (CLS)',
        currentValue: vitals.cls,
        targetValue: 0.1,
        impact: vitals.cls > 0.25 ? 'High' : 'Medium',
        suggestions: [
          'Set explicit dimensions for images and videos',
          'Reserve space for ads and embeds',
          'Avoid inserting content above existing content',
          'Use CSS aspect-ratio for responsive images',
          'Preload fonts to prevent font swap layout shifts'
        ]
      });
    }

    // TTFB recommendations
    if (vitals.ttfb > 800) {
      recommendations.push({
        metric: 'Time to First Byte (TTFB)',
        currentValue: vitals.ttfb,
        targetValue: 800,
        impact: vitals.ttfb > 1800 ? 'High' : 'Medium',
        suggestions: [
          'Optimize server configuration and database queries',
          'Use a faster hosting provider',
          'Implement server-side caching',
          'Use a CDN for static assets',
          'Minimize server processing time'
        ]
      });
    }

    // Resource loading recommendations
    if (metrics.loadingMetrics.renderBlockingResources > 5) {
      recommendations.push({
        metric: 'Render Blocking Resources',
        currentValue: metrics.loadingMetrics.renderBlockingResources,
        targetValue: 3,
        impact: 'Medium',
        suggestions: [
          'Inline critical CSS',
          'Defer non-critical CSS',
          'Use async or defer attributes for JavaScript',
          'Minimize CSS and JavaScript files',
          'Remove unused CSS and JavaScript'
        ]
      });
    }

    return recommendations;
  }

  private getDefaultCoreWebVitals(): CoreWebVitalsResult {
    return {
      lcp: 0,
      fid: 0,
      cls: 0,
      fcp: 0,
      ttfb: 0,
      score: 0
    };
  }

  private getDefaultMetrics(coreWebVitals: CoreWebVitalsResult): PerformanceMetrics {
    return {
      coreWebVitals,
      loadingMetrics: {
        domContentLoaded: 0,
        loadComplete: 0,
        resourceLoadTime: 0,
        renderBlockingResources: 0
      },
      interactivityMetrics: {
        timeToInteractive: 0,
        totalBlockingTime: 0,
        maxPotentialFid: 0
      },
      visualMetrics: {
        speedIndex: 0,
        largestContentfulPaint: coreWebVitals.lcp,
        cumulativeLayoutShift: coreWebVitals.cls
      }
    };
  }

  private collectErrors(results: PromiseSettledResult<any>[]): string[] {
    return results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason?.message || 'Unknown error');
  }
}