import { ContentSEOAnalyzer } from '../ContentSEOAnalyzer';
import { AnalysisConfig } from '@shared/types';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ContentSEOAnalyzer', () => {
  let analyzer: ContentSEOAnalyzer;
  let mockConfig: AnalysisConfig;

  beforeEach(() => {
    analyzer = new ContentSEOAnalyzer();
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

    // Reset axios mock
    mockedAxios.get.mockReset();
  });

  describe('analyzeContentSEO', () => {
    it('should analyze content SEO factors successfully', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Best SEO Guide for Beginners - Complete Tutorial</title>
          <meta name="description" content="Learn SEO with our comprehensive guide for beginners. Discover proven strategies and techniques to improve your website rankings.">
        </head>
        <body>
          <h1>Complete SEO Guide for Beginners</h1>
          <h2>What is SEO?</h2>
          <p>Search Engine Optimization (SEO) is the practice of optimizing your website to improve its visibility in search engine results. This comprehensive guide will teach you everything you need to know about SEO, from basic concepts to advanced strategies.</p>
          <h2>SEO Fundamentals</h2>
          <p>Understanding SEO fundamentals is crucial for success. We'll cover keyword research, on-page optimization, and technical SEO aspects that matter most for beginners.</p>
          <h3>Keyword Research</h3>
          <p>Keyword research is the foundation of any successful SEO strategy. Learn how to find the right keywords for your content and optimize your pages effectively.</p>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      const url = 'https://example.com/seo-guide';
      const result = await analyzer.analyzeContentSEO(url, mockConfig);

      expect(result).toBeDefined();
      expect(result.titleTag.score).toBeGreaterThan(70);
      expect(result.metaDescription.score).toBeGreaterThan(70);
      expect(result.headingStructure.score).toBeGreaterThan(80);
      expect(result.keywordOptimization.score).toBeGreaterThan(60);
      expect(result.contentLength).toBeGreaterThan(100);
    });

    it('should handle missing title tag', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="description" content="A page without a title">
        </head>
        <body>
          <h1>Content without title</h1>
          <p>This page is missing a title tag.</p>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      const url = 'https://example.com/no-title';
      const result = await analyzer.analyzeContentSEO(url, mockConfig);

      expect(result.titleTag.score).toBe(0);
      expect(result.titleTag.issues).toContain('Missing title tag');
      expect(result.titleTag.suggestions).toContain('Add a descriptive title tag to your page');
    });

    it('should handle missing meta description', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Page with no meta description</title>
        </head>
        <body>
          <h1>Content</h1>
          <p>This page has no meta description.</p>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      const url = 'https://example.com/no-meta';
      const result = await analyzer.analyzeContentSEO(url, mockConfig);

      expect(result.metaDescription.score).toBe(0);
      expect(result.metaDescription.issues).toContain('Missing meta description');
    });

    it('should detect poor heading structure', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Poor Heading Structure Example</title>
        </head>
        <body>
          <h3>Starting with H3 (bad)</h3>
          <h1>H1 after H3 (bad)</h1>
          <h1>Multiple H1 tags (bad)</h1>
          <h5>Skipping to H5 (bad)</h5>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      const url = 'https://example.com/bad-headings';
      const result = await analyzer.analyzeContentSEO(url, mockConfig);

      expect(result.headingStructure.score).toBeLessThan(70);
      expect(result.headingStructure.issues).toContain('Multiple H1 tags found (2)');
      expect(result.headingStructure.issues).toContain('Heading hierarchy is not properly structured');
    });

    it('should analyze keyword optimization', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>JavaScript Tutorial for Beginners</title>
          <meta name="description" content="Learn JavaScript programming with our beginner-friendly tutorial">
        </head>
        <body>
          <h1>JavaScript Tutorial</h1>
          <h2>Learning JavaScript</h2>
          <p>JavaScript is a programming language. This JavaScript tutorial covers JavaScript basics. JavaScript programming is essential for web development. Learn JavaScript step by step.</p>
          <h2>JavaScript Examples</h2>
          <p>Here are some JavaScript examples to help you understand JavaScript better.</p>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      const url = 'https://example.com/js-tutorial';
      const result = await analyzer.analyzeContentSEO(url, mockConfig);

      // Should detect keyword stuffing
      expect(result.keywordOptimization.issues.some(issue => 
        issue.includes('over-optimized') || issue.includes('stuffing')
      )).toBe(true);
    });

    it('should handle HTTP errors', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 404,
          statusText: 'Not Found'
        }
      });

      const url = 'https://example.com/404';
      
      await expect(analyzer.analyzeContentSEO(url, mockConfig))
        .rejects.toThrow('HTTP 404: Not Found');
    });

    it('should handle network errors', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));

      const url = 'https://unreachable.example.com';
      
      await expect(analyzer.analyzeContentSEO(url, mockConfig))
        .rejects.toThrow();
    });
  });

  describe('title tag analysis', () => {
    it('should detect optimal title length', async () => {
      const mockHtml = `
        <html>
        <head>
          <title>Perfect Length Title for SEO Optimization Guide</title>
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

      const result = await analyzer.analyzeContentSEO('https://example.com', mockConfig);
      
      // Title is 50 characters, which is optimal
      expect(result.titleTag.score).toBeGreaterThan(90);
      expect(result.titleTag.issues).not.toContain('Title tag is too short');
      expect(result.titleTag.issues).not.toContain('Title tag is too long');
    });

    it('should detect title that is too short', async () => {
      const mockHtml = `
        <html>
        <head>
          <title>Short</title>
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

      const result = await analyzer.analyzeContentSEO('https://example.com', mockConfig);
      
      expect(result.titleTag.issues).toContain('Title tag is too short (less than 30 characters)');
    });

    it('should detect title that is too long', async () => {
      const mockHtml = `
        <html>
        <head>
          <title>This is a very long title tag that exceeds the recommended length for SEO optimization and will likely be truncated in search results</title>
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

      const result = await analyzer.analyzeContentSEO('https://example.com', mockConfig);
      
      expect(result.titleTag.issues).toContain('Title tag is too long (more than 60 characters)');
    });
  });

  describe('meta description analysis', () => {
    it('should detect optimal meta description', async () => {
      const mockHtml = `
        <html>
        <head>
          <title>SEO Guide</title>
          <meta name="description" content="Learn SEO with our comprehensive guide. Discover proven strategies, tips, and techniques to improve your website rankings and drive more traffic.">
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

      const result = await analyzer.analyzeContentSEO('https://example.com', mockConfig);
      
      expect(result.metaDescription.score).toBeGreaterThan(85);
    });

    it('should detect meta description that is too short', async () => {
      const mockHtml = `
        <html>
        <head>
          <title>SEO Guide</title>
          <meta name="description" content="Short description">
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

      const result = await analyzer.analyzeContentSEO('https://example.com', mockConfig);
      
      expect(result.metaDescription.issues).toContain('Meta description is too short (less than 120 characters)');
    });
  });

  describe('heading structure analysis', () => {
    it('should detect proper heading hierarchy', async () => {
      const mockHtml = `
        <html>
        <head><title>Good Structure</title></head>
        <body>
          <h1>Main Title</h1>
          <h2>Section 1</h2>
          <h3>Subsection 1.1</h3>
          <h3>Subsection 1.2</h3>
          <h2>Section 2</h2>
          <h3>Subsection 2.1</h3>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

      const result = await analyzer.analyzeContentSEO('https://example.com', mockConfig);
      
      expect(result.headingStructure.score).toBeGreaterThan(90);
      expect(result.headingStructure.issues).not.toContain('Heading hierarchy is not properly structured');
    });

    it('should detect empty headings', async () => {
      const mockHtml = `
        <html>
        <head><title>Empty Headings</title></head>
        <body>
          <h1>Good Heading</h1>
          <h2></h2>
          <h3>   </h3>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

      const result = await analyzer.analyzeContentSEO('https://example.com', mockConfig);
      
      expect(result.headingStructure.issues).toContain('2 empty heading(s) found');
    });
  });

  describe('content length analysis', () => {
    it('should count words correctly', async () => {
      const mockHtml = `
        <html>
        <head><title>Content Length Test</title></head>
        <body>
          <nav>Navigation content should be ignored</nav>
          <main>
            <p>This is the main content that should be counted. It has multiple sentences and words that we want to analyze for content length.</p>
            <p>Another paragraph with more content to increase the word count for testing purposes.</p>
          </main>
          <footer>Footer content should be ignored</footer>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

      const result = await analyzer.analyzeContentSEO('https://example.com', mockConfig);
      
      // Should count only main content, not navigation or footer
      expect(result.contentLength).toBeGreaterThan(20);
      expect(result.contentLength).toBeLessThan(50);
    });
  });

  describe('error handling', () => {
    it('should handle malformed HTML gracefully', async () => {
      const mockHtml = `
        <html>
        <head>
          <title>Malformed HTML
        <body>
          <h1>Missing closing tags
          <p>Content without proper structure
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

      const result = await analyzer.analyzeContentSEO('https://example.com', mockConfig);
      
      // Should still analyze what it can
      expect(result).toBeDefined();
      expect(result.titleTag.score).toBeGreaterThan(0);
    });

    it('should handle timeout errors', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded'
      });

      await expect(analyzer.analyzeContentSEO('https://slow.example.com', mockConfig))
        .rejects.toThrow();
    });
  });
});