import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { TechnicalSEOAnalyzer } from '../TechnicalSEOAnalyzer';
import { AnalysisConfig } from '@shared/types';

// Mock PerformanceAnalyzer
jest.mock('../PerformanceAnalyzer', () => ({
  PerformanceAnalyzer: jest.fn().mockImplementation(() => ({
    analyzePerformance: jest.fn().mockResolvedValue({
      url: 'https://example.com',
      timestamp: new Date(),
      metrics: {
        coreWebVitals: {
          lcp: 2500,
          fid: 100,
          cls: 0.1,
          fcp: 1800,
          ttfb: 800,
          score: 85
        },
        loadingMetrics: {
          domContentLoaded: 1200,
          loadComplete: 2500,
          resourceLoadTime: 150,
          renderBlockingResources: 3
        },
        interactivityMetrics: {
          timeToInteractive: 1800,
          totalBlockingTime: 50,
          maxPotentialFid: 130
        },
        visualMetrics: {
          speedIndex: 1200,
          largestContentfulPaint: 2500,
          cumulativeLayoutShift: 0.1
        }
      },
      recommendations: [],
      lighthouseScore: 85
    }),
    cleanup: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Mock Puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(() => Promise.resolve({
    newPage: jest.fn(() => Promise.resolve({
      setCacheEnabled: jest.fn(),
      setViewport: jest.fn(),
      goto: jest.fn(() => Promise.resolve({
        ok: () => true,
        status: () => 200,
        statusText: () => 'OK'
      })),
      evaluate: jest.fn(() => Promise.resolve({
        domContentLoaded: 100,
        loadComplete: 200,
        firstPaint: 150,
        firstContentfulPaint: 180
      })),
      close: jest.fn()
    })),
    close: jest.fn()
  }))
}));

// Mock Chrome Launcher
jest.mock('chrome-launcher', () => ({
  launch: jest.fn(() => Promise.resolve({
    port: 9222,
    kill: jest.fn()
  }))
}));

// Mock Lighthouse
jest.mock('lighthouse', () => jest.fn(() => Promise.resolve({
  lhr: {
    audits: {
      'largest-contentful-paint': { numericValue: 2500 },
      'max-potential-fid': { numericValue: 100 },
      'cumulative-layout-shift': { numericValue: 0.1 }
    }
  }
})));

describe('TechnicalSEOAnalyzer', () => {
  let analyzer: TechnicalSEOAnalyzer;
  let mockConfig: AnalysisConfig;

  beforeEach(() => {
    analyzer = new TechnicalSEOAnalyzer();
    mockConfig = {
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
  });

  afterEach(async () => {
    await analyzer.cleanup();
  });

  describe('analyzeTechnicalSEO', () => {
    it('should analyze technical SEO factors successfully', async () => {
      const url = 'https://example.com';
      
      const result = await analyzer.analyzeTechnicalSEO(url, mockConfig);
      
      expect(result).toBeDefined();
      expect(result.pageSpeed).toBeGreaterThanOrEqual(0);
      expect(result.pageSpeed).toBeLessThanOrEqual(100);
      expect(typeof result.mobileResponsive).toBe('boolean');
      expect(result.crawlability).toBeDefined();
      expect(result.crawlability.score).toBeGreaterThanOrEqual(0);
      expect(result.crawlability.score).toBeLessThanOrEqual(100);
      expect(result.coreWebVitals).toBeDefined();
      expect(result.coreWebVitals.lcp).toBeGreaterThanOrEqual(0);
      expect(result.coreWebVitals.fid).toBeGreaterThanOrEqual(0);
      expect(result.coreWebVitals.cls).toBeGreaterThanOrEqual(0);
      expect(result.coreWebVitals.fcp).toBeGreaterThanOrEqual(0);
      expect(result.coreWebVitals.ttfb).toBeGreaterThanOrEqual(0);
      expect(result.coreWebVitals.score).toBeGreaterThanOrEqual(0);
    });

    it('should handle network errors gracefully', async () => {
      const puppeteer = require('puppeteer');
      puppeteer.launch.mockImplementationOnce(() => 
        Promise.resolve({
          newPage: () => Promise.resolve({
            setCacheEnabled: jest.fn(),
            goto: () => Promise.reject(new Error('Network error')),
            close: jest.fn()
          }),
          close: jest.fn()
        })
      );

      const url = 'https://unreachable.example.com';
      
      const result = await analyzer.analyzeTechnicalSEO(url, mockConfig);
      
      // Should return degraded results instead of throwing
      expect(result.pageSpeed).toBe(0);
      expect(result.crawlability.score).toBe(0);
      expect(result.crawlability.issues).toContain('Analysis failed');
    });

    it('should handle HTTP error responses', async () => {
      const puppeteer = require('puppeteer');
      puppeteer.launch.mockImplementationOnce(() => 
        Promise.resolve({
          newPage: () => Promise.resolve({
            setCacheEnabled: jest.fn(),
            goto: () => Promise.resolve({
              ok: () => false,
              status: () => 404,
              statusText: () => 'Not Found'
            }),
            close: jest.fn()
          }),
          close: jest.fn()
        })
      );

      const url = 'https://example.com/404';
      
      const result = await analyzer.analyzeTechnicalSEO(url, mockConfig);
      
      // Should return degraded results instead of throwing
      expect(result.pageSpeed).toBe(0);
      expect(result.crawlability.score).toBe(0);
      expect(result.crawlability.issues).toContain('Analysis failed');
    });
  });

  describe('page speed analysis', () => {
    it('should calculate page speed score based on load time', async () => {
      const puppeteer = require('puppeteer');
      
      // Mock fast loading page
      puppeteer.launch.mockImplementationOnce(() => 
        Promise.resolve({
          newPage: () => Promise.resolve({
            setCacheEnabled: jest.fn(),
            goto: jest.fn().mockImplementation(() => {
              // Simulate fast load (500ms)
              return new Promise(resolve => {
                setTimeout(() => resolve({
                  ok: () => true,
                  status: () => 200,
                  statusText: () => 'OK'
                }), 500);
              });
            }),
            evaluate: jest.fn(() => Promise.resolve({
              domContentLoaded: 100,
              loadComplete: 200,
              firstPaint: 150,
              firstContentfulPaint: 180
            })),
            close: jest.fn()
          }),
          close: jest.fn()
        })
      );

      const url = 'https://fast-site.example.com';
      const result = await analyzer.analyzeTechnicalSEO(url, mockConfig);
      
      // Fast site should have high page speed score
      expect(result.pageSpeed).toBeGreaterThan(90);
    });
  });

  describe('mobile responsiveness analysis', () => {
    it('should detect mobile responsive features', async () => {
      const puppeteer = require('puppeteer');
      
      puppeteer.launch.mockImplementationOnce(() => 
        Promise.resolve({
          newPage: () => Promise.resolve({
            setCacheEnabled: jest.fn(),
            setViewport: jest.fn(),
            goto: () => Promise.resolve({
              ok: () => true,
              status: () => 200
            }),
            evaluate: jest.fn(() => Promise.resolve({
              hasViewportMeta: true,
              fitsInViewport: true,
              hasMediaQueries: true,
              hasFlexbox: true,
              hasGrid: false,
              bodyWidth: 375,
              viewportWidth: 375
            })),
            close: jest.fn()
          }),
          close: jest.fn()
        })
      );

      const url = 'https://mobile-friendly.example.com';
      const result = await analyzer.analyzeTechnicalSEO(url, mockConfig);
      
      expect(result.mobileResponsive).toBe(true);
    });

    it('should detect non-mobile responsive sites', async () => {
      const puppeteer = require('puppeteer');
      
      puppeteer.launch.mockImplementationOnce(() => 
        Promise.resolve({
          newPage: () => Promise.resolve({
            setCacheEnabled: jest.fn(),
            setViewport: jest.fn(),
            goto: () => Promise.resolve({
              ok: () => true,
              status: () => 200
            }),
            evaluate: jest.fn(() => Promise.resolve({
              hasViewportMeta: false,
              fitsInViewport: false,
              hasMediaQueries: false,
              hasFlexbox: false,
              hasGrid: false,
              bodyWidth: 1200,
              viewportWidth: 375
            })),
            close: jest.fn()
          }),
          close: jest.fn()
        })
      );

      const url = 'https://desktop-only.example.com';
      const result = await analyzer.analyzeTechnicalSEO(url, mockConfig);
      
      expect(result.mobileResponsive).toBe(false);
    });
  });

  describe('crawlability analysis', () => {
    it('should analyze crawlability factors', async () => {
      const puppeteer = require('puppeteer');
      
      puppeteer.launch.mockImplementationOnce(() => 
        Promise.resolve({
          newPage: () => Promise.resolve({
            setCacheEnabled: jest.fn(),
            goto: () => Promise.resolve({
              ok: () => true,
              status: () => 200
            }),
            evaluate: jest.fn(() => Promise.resolve({
              hasNoIndex: false,
              hasNoFollow: false,
              canonicalUrl: 'https://example.com',
              currentUrl: 'https://example.com',
              isHttps: true,
              hasH1: true,
              h1Count: 1,
              hasSitemapLink: true,
              robotsContent: ''
            })),
            content: () => Promise.resolve('<html></html>'),
            close: jest.fn()
          }),
          close: jest.fn()
        })
      );

      const url = 'https://well-optimized.example.com';
      const result = await analyzer.analyzeTechnicalSEO(url, mockConfig);
      
      expect(result.crawlability.score).toBeGreaterThan(80);
      expect(result.crawlability.issues).toHaveLength(0);
    });

    it('should detect crawlability issues', async () => {
      const puppeteer = require('puppeteer');
      
      puppeteer.launch.mockImplementationOnce(() => 
        Promise.resolve({
          newPage: () => Promise.resolve({
            setCacheEnabled: jest.fn(),
            goto: () => Promise.resolve({
              ok: () => true,
              status: () => 200
            }),
            evaluate: jest.fn(() => Promise.resolve({
              hasNoIndex: true,
              hasNoFollow: false,
              canonicalUrl: null,
              currentUrl: 'http://example.com',
              isHttps: false,
              hasH1: false,
              h1Count: 0,
              hasSitemapLink: false,
              robotsContent: 'noindex'
            })),
            content: () => Promise.resolve('<html></html>'),
            close: jest.fn()
          }),
          close: jest.fn()
        })
      );

      const url = 'http://poorly-optimized.example.com';
      const result = await analyzer.analyzeTechnicalSEO(url, mockConfig);
      
      expect(result.crawlability.score).toBeLessThan(50);
      expect(result.crawlability.issues.length).toBeGreaterThan(0);
      expect(result.crawlability.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Core Web Vitals analysis', () => {
    it('should analyze Core Web Vitals using PerformanceAnalyzer', async () => {
      const url = 'https://example.com';
      const result = await analyzer.analyzeTechnicalSEO(url, mockConfig);
      
      expect(result.coreWebVitals.lcp).toBe(2500);
      expect(result.coreWebVitals.fid).toBe(100);
      expect(result.coreWebVitals.cls).toBe(0.1);
      expect(result.coreWebVitals.fcp).toBe(1800);
      expect(result.coreWebVitals.ttfb).toBe(800);
      expect(result.coreWebVitals.score).toBe(85);
    });

    it('should handle PerformanceAnalyzer failures gracefully', async () => {
      const { PerformanceAnalyzer } = require('../PerformanceAnalyzer');
      PerformanceAnalyzer.mockImplementationOnce(() => ({
        analyzePerformance: jest.fn().mockRejectedValue(new Error('Performance analysis failed')),
        cleanup: jest.fn().mockResolvedValue(undefined)
      }));

      const newAnalyzer = new TechnicalSEOAnalyzer();
      const url = 'https://example.com';
      const result = await newAnalyzer.analyzeTechnicalSEO(url, mockConfig);
      
      // Should still have default Core Web Vitals data
      expect(result.coreWebVitals).toBeDefined();
      expect(result.coreWebVitals.lcp).toBe(0);
      expect(result.coreWebVitals.fid).toBe(0);
      expect(result.coreWebVitals.cls).toBe(0);
      expect(result.coreWebVitals.fcp).toBe(0);
      expect(result.coreWebVitals.ttfb).toBe(0);
      expect(result.coreWebVitals.score).toBe(0);
      
      await newAnalyzer.cleanup();
    });
  });

  describe('robots.txt analysis', () => {
    it('should handle missing robots.txt', async () => {
      const puppeteer = require('puppeteer');
      
      // Mock robots.txt 404 response
      const mockPage = {
        setCacheEnabled: jest.fn(),
        goto: jest.fn()
          .mockImplementationOnce(() => Promise.resolve({ // Main page
            ok: () => true,
            status: () => 200
          }))
          .mockImplementationOnce(() => Promise.resolve({ // robots.txt
            ok: () => false,
            status: () => 404
          })),
        evaluate: jest.fn(() => Promise.resolve({
          hasNoIndex: false,
          hasNoFollow: false,
          canonicalUrl: 'https://example.com',
          currentUrl: 'https://example.com',
          isHttps: true,
          hasH1: true,
          h1Count: 1,
          hasSitemapLink: false,
          robotsContent: ''
        })),
        content: () => Promise.resolve('<html></html>'),
        close: jest.fn()
      };

      puppeteer.launch.mockImplementationOnce(() => 
        Promise.resolve({
          newPage: () => Promise.resolve(mockPage),
          close: jest.fn()
        })
      );

      const url = 'https://no-robots.example.com';
      const result = await analyzer.analyzeTechnicalSEO(url, mockConfig);
      
      // Should not penalize for missing robots.txt
      expect(result.crawlability.score).toBeGreaterThan(70);
    });
  });

  describe('cleanup', () => {
    it('should close browser on cleanup', async () => {
      const mockBrowser = {
        newPage: jest.fn(),
        close: jest.fn()
      };

      const puppeteer = require('puppeteer');
      puppeteer.launch.mockResolvedValueOnce(mockBrowser);

      // Initialize browser
      await analyzer.analyzeTechnicalSEO('https://example.com', mockConfig);
      
      // Cleanup
      await analyzer.cleanup();
      
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });
});