import { StructuredDataAnalyzer } from '../StructuredDataAnalyzer';
import { AnalysisConfig } from '@shared/types';
import axios from 'axios';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('StructuredDataAnalyzer', () => {
  let analyzer: StructuredDataAnalyzer;
  let mockConfig: AnalysisConfig;

  beforeEach(() => {
    analyzer = new StructuredDataAnalyzer();
    mockConfig = {
      seoWeights: { technical: 0.4, content: 0.4, structure: 0.2 },
      geoWeights: { readability: 0.3, credibility: 0.3, completeness: 0.2, structuredData: 0.2 },
      thresholds: { pageSpeedMin: 3000, contentLengthMin: 300, headingLevels: 3 }
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('analyzeStructuredData', () => {
    it('should analyze page with JSON-LD structured data', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Article</title>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Test Article Title",
            "author": {
              "@type": "Person",
              "name": "John Doe"
            },
            "datePublished": "2024-01-01",
            "description": "Test article description"
          }
          </script>
        </head>
        <body>
          <article>
            <h1>Test Article Title</h1>
            <p>Article content here...</p>
          </article>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/article', mockConfig);

      expect(result.jsonLdData).toHaveLength(1);
      expect(result.jsonLdData[0].type).toBe('Article');
      expect(result.jsonLdData[0].format).toBe('JSON-LD');
      expect(result.jsonLdData[0].isValid).toBe(true);
      expect(result.overallScore.score).toBeGreaterThan(70);
    });

    it('should analyze page with Microdata structured data', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Product</title>
        </head>
        <body>
          <div itemscope itemtype="https://schema.org/Product">
            <h1 itemprop="name">Test Product</h1>
            <p itemprop="description">Product description</p>
            <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
              <span itemprop="price">29.99</span>
              <span itemprop="priceCurrency">USD</span>
            </div>
          </div>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/product', mockConfig);

      expect(result.microdataItems).toHaveLength(2); // Product and Offer
      expect(result.microdataItems[0].type).toBe('Product');
      expect(result.microdataItems[0].format).toBe('Microdata');
      expect(result.overallScore.score).toBeGreaterThan(60);
    });

    it('should analyze page with RDFa structured data', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Organization</title>
        </head>
        <body>
          <div typeof="Organization">
            <h1 property="name">Test Company</h1>
            <div property="address" typeof="PostalAddress">
              <span property="streetAddress">123 Main St</span>
              <span property="addressLocality">City</span>
            </div>
            <span property="telephone">555-123-4567</span>
          </div>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/about', mockConfig);

      expect(result.rdfaItems).toHaveLength(2); // Organization and PostalAddress
      expect(result.rdfaItems[0].type).toBe('Organization');
      expect(result.rdfaItems[0].format).toBe('RDFa');
      expect(result.overallScore.score).toBeGreaterThan(60);
    });

    it('should handle page with no structured data', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Page</title>
        </head>
        <body>
          <h1>Test Page</h1>
          <p>Some content without structured data</p>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/page', mockConfig);

      expect(result.jsonLdData).toHaveLength(0);
      expect(result.microdataItems).toHaveLength(0);
      expect(result.rdfaItems).toHaveLength(0);
      expect(result.overallScore.score).toBe(0);
      expect(result.overallScore.issues).toContain('No structured data found on the page');
      expect(result.recommendations).toHaveLength(2); // WebSite and WebPage recommendations
    });

    it('should handle invalid JSON-LD syntax', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Test Article"
            // Invalid JSON - missing comma
            "author": "John Doe"
          }
          </script>
        </head>
        <body>
          <h1>Test Article</h1>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/invalid', mockConfig);

      expect(result.jsonLdData).toHaveLength(1);
      expect(result.jsonLdData[0].isValid).toBe(false);
      expect(result.jsonLdData[0].errors).toContain('Invalid JSON syntax');
    });

    it('should generate appropriate recommendations for article pages', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Article</title>
        </head>
        <body>
          <article>
            <h1>Test Article Title</h1>
            <p>Article content here...</p>
          </article>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/article', mockConfig);

      const articleRec = result.recommendations.find(r => r.schemaType === 'Article');
      expect(articleRec).toBeDefined();
      expect(articleRec?.priority).toBe('High');
      expect(articleRec?.description).toContain('Article schema');
    });

    it('should generate appropriate recommendations for product pages', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Product</title>
        </head>
        <body>
          <div class="product">
            <h1>Test Product</h1>
            <div class="price">$29.99</div>
            <p>Product description</p>
          </div>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/product', mockConfig);

      const productRec = result.recommendations.find(r => r.schemaType === 'Product');
      expect(productRec).toBeDefined();
      expect(productRec?.priority).toBe('High');
      expect(productRec?.description).toContain('Product schema');
    });

    it('should validate schema completeness', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Test Article"
          }
          </script>
        </head>
        <body>
          <article>
            <h1>Test Article</h1>
          </article>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/incomplete', mockConfig);

      const articleValidation = result.schemaValidation.find(v => v.schemaType === 'Article');
      expect(articleValidation).toBeDefined();
      expect(articleValidation?.isValid).toBe(false);
      expect(articleValidation?.errors.length).toBeGreaterThan(0);
      expect(articleValidation?.completeness).toBeLessThan(100);
    });

    it('should handle multiple schema formats and suggest consistency', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Test Site",
            "url": "https://example.com"
          }
          </script>
        </head>
        <body>
          <div itemscope itemtype="https://schema.org/Organization">
            <h1 itemprop="name">Test Company</h1>
          </div>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/mixed', mockConfig);

      expect(result.jsonLdData).toHaveLength(1);
      expect(result.microdataItems).toHaveLength(1);
      expect(result.overallScore.suggestions).toContain(
        'Consider using a single structured data format for consistency'
      );
    });

    it('should detect and report duplicate schema types', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Test Company 1"
          }
          </script>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Test Company 2"
          }
          </script>
        </head>
        <body>
          <h1>Test Page</h1>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/duplicate', mockConfig);

      expect(result.jsonLdData).toHaveLength(2);
      expect(result.overallScore.issues).toContain('Duplicate schema types found');
      expect(result.overallScore.suggestions).toContain(
        'Remove or consolidate duplicate structured data'
      );
    });

    it('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(
        analyzer.analyzeStructuredData('https://example.com/error', mockConfig)
      ).rejects.toThrow();
    });

    it('should handle HTTP errors with status codes', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 404,
          statusText: 'Not Found'
        }
      };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(axiosError);

      await expect(
        analyzer.analyzeStructuredData('https://example.com/404', mockConfig)
      ).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should prefer JSON-LD format in scoring', async () => {
      const jsonLdHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Test Article",
            "author": {"@type": "Person", "name": "John Doe"},
            "datePublished": "2024-01-01"
          }
          </script>
        </head>
        <body><article><h1>Test</h1></article></body>
        </html>
      `;

      const microdataHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <div itemscope itemtype="https://schema.org/Article">
            <h1 itemprop="headline">Test Article</h1>
            <span itemprop="author">John Doe</span>
            <time itemprop="datePublished">2024-01-01</time>
          </div>
        </body>
        </html>
      `;

      // Test JSON-LD
      mockedAxios.get.mockResolvedValueOnce({ data: jsonLdHtml });
      const jsonLdResult = await analyzer.analyzeStructuredData('https://example.com/jsonld', mockConfig);

      // Test Microdata
      mockedAxios.get.mockResolvedValueOnce({ data: microdataHtml });
      const microdataResult = await analyzer.analyzeStructuredData('https://example.com/microdata', mockConfig);

      expect(jsonLdResult.overallScore.score).toBeGreaterThanOrEqual(microdataResult.overallScore.score);
    });

    it('should generate FAQ page recommendations correctly', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Frequently Asked Questions</title>
        </head>
        <body>
          <h1>FAQ</h1>
          <div class="faq">
            <div class="question">What is your return policy?</div>
            <div class="answer">We accept returns within 30 days.</div>
          </div>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/faq', mockConfig);

      const faqRec = result.recommendations.find(r => r.schemaType === 'FAQPage');
      expect(faqRec).toBeDefined();
      expect(faqRec?.priority).toBe('High');
      expect(faqRec?.description).toContain('FAQPage schema');
    });

    it('should extract schema types from full URIs correctly', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <div itemscope itemtype="https://schema.org/LocalBusiness">
            <h1 itemprop="name">Local Business</h1>
          </div>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/business', mockConfig);

      expect(result.microdataItems).toHaveLength(1);
      expect(result.microdataItems[0].type).toBe('LocalBusiness');
    });

    it('should handle array of JSON-LD objects', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
          [
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Test Site",
              "url": "https://example.com"
            },
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Test Company"
            }
          ]
          </script>
        </head>
        <body><h1>Test</h1></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/array', mockConfig);

      expect(result.jsonLdData).toHaveLength(2);
      expect(result.jsonLdData[0].type).toBe('WebSite');
      expect(result.jsonLdData[1].type).toBe('Organization');
    });
  });

  describe('Schema validation', () => {
    it('should validate required properties for Article schema', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Complete Article",
            "author": {"@type": "Person", "name": "John Doe"},
            "datePublished": "2024-01-01",
            "description": "Article description",
            "image": "https://example.com/image.jpg"
          }
          </script>
        </head>
        <body><article><h1>Test</h1></article></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/complete', mockConfig);

      const articleValidation = result.schemaValidation.find(v => v.schemaType === 'Article');
      expect(articleValidation?.isValid).toBe(true);
      expect(articleValidation?.completeness).toBeGreaterThan(60);
    });

    it('should validate required properties for Product schema', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Test Product",
            "offers": {
              "@type": "Offer",
              "price": "29.99",
              "priceCurrency": "USD"
            },
            "description": "Product description",
            "image": "https://example.com/product.jpg"
          }
          </script>
        </head>
        <body><div class="product"><h1>Test</h1></div></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/product-complete', mockConfig);

      const productValidation = result.schemaValidation.find(v => v.schemaType === 'Product');
      expect(productValidation?.isValid).toBe(true);
      expect(productValidation?.completeness).toBeGreaterThan(50);
    });
  });

  describe('Error handling', () => {
    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded');
      mockedAxios.get.mockRejectedValue(timeoutError);

      await expect(
        analyzer.analyzeStructuredData('https://slow-site.com', mockConfig)
      ).rejects.toThrow('timeout of 30000ms exceeded');
    });

    it('should handle malformed HTML gracefully', async () => {
      const malformedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org"
            // Missing closing brace
        </head>
        <body><h1>Test</h1></body>
      `;

      mockedAxios.get.mockResolvedValue({ data: malformedHtml });

      const result = await analyzer.analyzeStructuredData('https://example.com/malformed', mockConfig);

      // Should still process what it can
      expect(result).toBeDefined();
      expect(result.overallScore).toBeDefined();
    });
  });
});