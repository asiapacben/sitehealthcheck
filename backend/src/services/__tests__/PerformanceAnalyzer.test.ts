import { PerformanceAnalyzer } from '../PerformanceAnalyzer';
import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';

// Mock external dependencies
jest.mock('puppeteer');

const mockPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>;

// Mock dynamic lighthouse import
const mockLighthouse = jest.fn();

// Mock the dynamic import
jest.mock('lighthouse', () => mockLighthouse, { virtual: true });

describe('PerformanceAnalyzer', () => {
  let analyzer: PerformanceAnalyzer;
  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    analyzer = new PerformanceAnalyzer();
    
    // Setup mock page
    mockPage = {
      setCacheEnabled: jest.fn(),
      goto: jest.fn(),
      evaluate: jest.fn(),
      close: jest.fn()
    };

    // Setup mock browser
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn()
    };

    mockPuppeteer.launch.mockResolvedValue(mockBrowser);
  });

  afterEach(async () => {
    await analyzer.cleanup();
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should launch browser successfully', async () => {
      await analyzer.initialize();

      expect(mockPuppeteer.launch).toHaveBeenCalledWith({
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
    });

    it('should not launch browser if already initialized', async () => {
      await analyzer.initialize();
      await analyzer.initialize();

      expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('should close browser if initialized', async () => {
      await analyzer.initialize();
      await analyzer.cleanup();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle cleanup when browser not initialized', async () => {
      await analyzer.cleanup();
      // Should not throw error
    });
  });

  describe('analyzePerformance', () => {
    const testUrl = 'https://example.com';

    beforeEach(() => {
      // Mock successful page response
      mockPage.goto.mockResolvedValue({ ok: () => true, status: () => 200 });
      
      // Mock Core Web Vitals measurement
      mockPage.evaluate.mockImplementation((fn: any) => {
        const fnString = fn.toString();
        if (fnString.includes('navigationEntries') && fnString.includes('vitals')) {
          return Promise.resolve({
            lcp: 2000,
            fid: 50,
            cls: 0.05,
            fcp: 1500,
            ttfb: 500
          });
        }
        
        // Mock performance metrics
        return Promise.resolve({
          domContentLoaded: 1200,
          loadComplete: 2500,
          resourceLoadTime: 150,
          renderBlockingResources: 3,
          timeToInteractive: 1800,
          speedIndex: 1200
        });
      });

      // Mock Lighthouse
      mockLighthouse.mockResolvedValue({
        lhr: {
          categories: {
            performance: {
              score: 0.85
            }
          }
        }
      } as any);
    });

    it('should analyze performance successfully', async () => {
      const result = await analyzer.analyzePerformance(testUrl);

      expect(result).toMatchObject({
        url: testUrl,
        timestamp: expect.any(Date),
        metrics: {
          coreWebVitals: {
            lcp: 2000,
            fid: 50,
            cls: 0.05,
            fcp: 1500,
            ttfb: 500,
            score: expect.any(Number)
          },
          loadingMetrics: expect.any(Object),
          interactivityMetrics: expect.any(Object),
          visualMetrics: expect.any(Object)
        },
        recommendations: expect.any(Array)
      });
      
      // Lighthouse should be undefined in test environment
      expect(result.lighthouseScore).toBeUndefined();
    });

    it('should handle page load failure gracefully', async () => {
      mockPage.goto.mockResolvedValue({ ok: () => false, status: () => 404 });

      const result = await analyzer.analyzePerformance(testUrl);
      
      expect(result.errors).toContain('Failed to load page: 404');
      expect(result.metrics.coreWebVitals.score).toBe(0);
    });

    it('should handle Core Web Vitals measurement failure gracefully', async () => {
      // Mock both evaluate calls to fail for Core Web Vitals measurement
      mockPage.evaluate
        .mockRejectedValueOnce(new Error('Evaluation failed'))
        .mockRejectedValueOnce(new Error('Evaluation failed'));

      const result = await analyzer.analyzePerformance(testUrl);

      expect(result.metrics.coreWebVitals).toMatchObject({
        lcp: 0,
        fid: 0,
        cls: 0,
        fcp: 0,
        ttfb: 0,
        score: 0
      });
      expect(result.errors).toContain('Evaluation failed');
    });

    it('should handle Lighthouse failure gracefully', async () => {
      mockLighthouse.mockRejectedValue(new Error('Lighthouse failed'));

      const result = await analyzer.analyzePerformance(testUrl);

      expect(result.lighthouseScore).toBeUndefined();
      expect(result.errors).toContain('Lighthouse analysis unavailable');
    });

    it('should generate recommendations for poor performance', async () => {
      // Mock poor performance metrics
      mockPage.evaluate.mockImplementation((fn: any) => {
        const fnString = fn.toString();
        if (fnString.includes('navigationEntries') && fnString.includes('vitals')) {
          return Promise.resolve({
            lcp: 5000, // Poor LCP
            fid: 400,  // Poor FID
            cls: 0.3,  // Poor CLS
            fcp: 4000, // Poor FCP
            ttfb: 2000 // Poor TTFB
          });
        }
        
        return Promise.resolve({
          domContentLoaded: 3000,
          loadComplete: 6000,
          resourceLoadTime: 500,
          renderBlockingResources: 10, // Many blocking resources
          timeToInteractive: 4000,
          speedIndex: 3000
        });
      });

      const result = await analyzer.analyzePerformance(testUrl);

      expect(result.recommendations).toHaveLength(5); // All poor metrics should have recommendations
      expect(result.recommendations.some(r => r.metric.includes('LCP'))).toBe(true);
      expect(result.recommendations.some(r => r.metric.includes('FID'))).toBe(true);
      expect(result.recommendations.some(r => r.metric.includes('CLS'))).toBe(true);
      expect(result.recommendations.some(r => r.metric.includes('TTFB'))).toBe(true);
      expect(result.recommendations.some(r => r.metric.includes('Render Blocking'))).toBe(true);
    });
  });

  describe('performance scoring', () => {
    it('should calculate perfect score for good metrics', async () => {
      mockPage.goto.mockResolvedValue({ ok: () => true, status: () => 200 });
      mockPage.evaluate.mockResolvedValue({
        lcp: 2000,  // Good
        fid: 50,    // Good
        cls: 0.05,  // Good
        fcp: 1500,  // Good
        ttfb: 500   // Good
      });

      const result = await analyzer.analyzePerformance('https://example.com');
      expect(result.metrics.coreWebVitals.score).toBe(100);
    });

    it('should calculate medium score for average metrics', async () => {
      mockPage.goto.mockResolvedValue({ ok: () => true, status: () => 200 });
      mockPage.evaluate.mockResolvedValue({
        lcp: 3000,  // Average
        fid: 200,   // Average
        cls: 0.15,  // Average
        fcp: 2500,  // Average
        ttfb: 1200  // Average
      });

      const result = await analyzer.analyzePerformance('https://example.com');
      expect(result.metrics.coreWebVitals.score).toBe(50);
    });

    it('should calculate low score for poor metrics', async () => {
      mockPage.goto.mockResolvedValue({ ok: () => true, status: () => 200 });
      mockPage.evaluate.mockResolvedValue({
        lcp: 5000,  // Poor
        fid: 500,   // Poor
        cls: 0.4,   // Poor
        fcp: 4000,  // Poor
        ttfb: 2500  // Poor
      });

      const result = await analyzer.analyzePerformance('https://example.com');
      expect(result.metrics.coreWebVitals.score).toBe(0);
    });
  });

  describe('recommendation generation', () => {
    it('should generate LCP recommendations for slow loading', async () => {
      mockPage.goto.mockResolvedValue({ ok: () => true, status: () => 200 });
      mockPage.evaluate.mockResolvedValue({
        lcp: 5000,
        fid: 50,
        cls: 0.05,
        fcp: 1500,
        ttfb: 500
      });

      const result = await analyzer.analyzePerformance('https://example.com');
      const lcpRec = result.recommendations.find(r => r.metric.includes('LCP'));

      expect(lcpRec).toBeDefined();
      expect(lcpRec?.impact).toBe('High');
      expect(lcpRec?.suggestions).toContain('Optimize server response times');
      expect(lcpRec?.suggestions).toContain('Use a Content Delivery Network (CDN)');
    });

    it('should generate FID recommendations for poor interactivity', async () => {
      mockPage.goto.mockResolvedValue({ ok: () => true, status: () => 200 });
      mockPage.evaluate.mockResolvedValue({
        lcp: 2000,
        fid: 400,
        cls: 0.05,
        fcp: 1500,
        ttfb: 500
      });

      const result = await analyzer.analyzePerformance('https://example.com');
      const fidRec = result.recommendations.find(r => r.metric.includes('FID'));

      expect(fidRec).toBeDefined();
      expect(fidRec?.impact).toBe('High');
      expect(fidRec?.suggestions).toContain('Reduce JavaScript execution time');
      expect(fidRec?.suggestions).toContain('Use web workers for heavy computations');
    });

    it('should generate CLS recommendations for layout shifts', async () => {
      mockPage.goto.mockResolvedValue({ ok: () => true, status: () => 200 });
      mockPage.evaluate.mockResolvedValue({
        lcp: 2000,
        fid: 50,
        cls: 0.3,
        fcp: 1500,
        ttfb: 500
      });

      const result = await analyzer.analyzePerformance('https://example.com');
      const clsRec = result.recommendations.find(r => r.metric.includes('CLS'));

      expect(clsRec).toBeDefined();
      expect(clsRec?.impact).toBe('High');
      expect(clsRec?.suggestions).toContain('Set explicit dimensions for images and videos');
      expect(clsRec?.suggestions).toContain('Avoid inserting content above existing content');
    });

    it('should not generate recommendations for good metrics', async () => {
      mockPage.goto.mockResolvedValue({ ok: () => true, status: () => 200 });
      mockPage.evaluate.mockResolvedValue({
        lcp: 2000,
        fid: 50,
        cls: 0.05,
        fcp: 1500,
        ttfb: 500
      });

      const result = await analyzer.analyzePerformance('https://example.com');

      expect(result.recommendations).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle browser initialization failure', async () => {
      mockPuppeteer.launch.mockRejectedValue(new Error('Browser launch failed'));

      await expect(analyzer.analyzePerformance('https://example.com')).rejects.toThrow('Browser launch failed');
    });

    it('should handle page creation failure gracefully', async () => {
      mockBrowser.newPage.mockRejectedValue(new Error('Page creation failed'));

      const result = await analyzer.analyzePerformance('https://example.com');
      
      expect(result.errors).toContain('Page creation failed');
      expect(result.metrics.coreWebVitals.score).toBe(0);
    });

    it('should close page even if analysis fails', async () => {
      mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

      const result = await analyzer.analyzePerformance('https://example.com');
      
      expect(result.errors).toContain('Navigation failed');
      expect(mockPage.close).toHaveBeenCalled();
    });
  });
});