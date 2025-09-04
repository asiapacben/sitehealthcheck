import { StructureAnalyzer } from '../StructureAnalyzer';
import { AnalysisConfig } from '@shared/types';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('StructureAnalyzer', () => {
  let analyzer: StructureAnalyzer;
  let mockConfig: AnalysisConfig;

  beforeEach(() => {
    analyzer = new StructureAnalyzer();
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
    mockedAxios.head.mockReset();
  });

  describe('analyzeStructure', () => {
    it('should analyze structure and accessibility factors successfully', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <title>Accessible Website Example</title>
        </head>
        <body>
          <header>
            <nav>
              <a href="#main">Skip to main content</a>
              <a href="/home">Home</a>
              <a href="/about">About</a>
              <a href="/contact">Contact</a>
            </nav>
          </header>
          <main id="main">
            <h1>Welcome to Our Website</h1>
            <section>
              <h2>Our Services</h2>
              <p>We provide excellent services with <a href="/services">detailed information</a>.</p>
              <img src="/image1.jpg" alt="Our team working together">
            </section>
            <section>
              <h2>Contact Form</h2>
              <form>
                <label for="name">Name:</label>
                <input type="text" id="name" name="name">
                <label for="email">Email:</label>
                <input type="email" id="email" name="email">
                <button type="submit">Submit</button>
              </form>
            </section>
          </main>
          <footer>
            <p>&copy; 2024 Our Company</p>
          </footer>
        </body>
        </html>
      `;

      // Mock main page request
      mockedAxios.get.mockResolvedValueOnce({
        data: mockHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      // Mock sitemap check
      mockedAxios.head.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      const url = 'https://example.com';
      const result = await analyzer.analyzeStructure(url, mockConfig);

      expect(result).toBeDefined();
      expect(result.internalLinks).toBeGreaterThan(0);
      expect(result.urlStructure.score).toBeGreaterThan(80);
      expect(result.sitemapPresent).toBe(true);
      expect(result.accessibility.score).toBeGreaterThan(80);
    });

    it('should handle missing accessibility features', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head></head>
        <body>
          <div>
            <div>Navigation</div>
            <div>
              <div>Content without proper structure</div>
              <img src="/image.jpg">
              <input type="text" placeholder="Name">
              <input type="email" placeholder="Email">
            </div>
          </div>
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

      // Mock sitemap not found
      mockedAxios.head.mockRejectedValue(new Error('Not found'));

      const url = 'https://example.com/poor-accessibility';
      const result = await analyzer.analyzeStructure(url, mockConfig);

      expect(result.accessibility.score).toBeLessThan(70);
      expect(result.accessibility.issues).toContain('1 image(s) missing alt text');
      expect(result.accessibility.issues).toContain('2 form input(s) without proper labels');
      expect(result.accessibility.issues).toContain('Missing page title');
      expect(result.accessibility.issues).toContain('Missing language declaration on HTML element');
      expect(result.sitemapPresent).toBe(false);
    });

    it('should analyze internal links correctly', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Link Analysis</title></head>
        <body>
          <nav>
            <a href="/page1">Page 1</a>
            <a href="/page2">Page 2</a>
            <a href="https://example.com/page3">Page 3</a>
            <a href="https://external.com">External Link</a>
            <a href="/bad-link">click here</a>
          </nav>
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

      mockedAxios.head.mockRejectedValue(new Error('Not found'));

      const url = 'https://example.com';
      const result = await analyzer.analyzeStructure(url, mockConfig);

      // Should count 4 internal links (3 relative + 1 absolute same domain)
      expect(result.internalLinks).toBe(4);
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
      
      await expect(analyzer.analyzeStructure(url, mockConfig))
        .rejects.toThrow('HTTP 404: Not Found');
    });
  });

  describe('URL structure analysis', () => {
    it('should detect good URL structure', async () => {
      const mockHtml = '<html><head><title>Test</title></head><body></body></html>';
      
      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
      mockedAxios.head.mockRejectedValue(new Error('Not found'));

      const url = 'https://example.com/blog/seo-tips';
      const result = await analyzer.analyzeStructure(url, mockConfig);

      expect(result.urlStructure.score).toBeGreaterThan(90);
      expect(result.urlStructure.issues).toHaveLength(0);
    });

    it('should detect poor URL structure', async () => {
      const mockHtml = '<html><head><title>Test</title></head><body></body></html>';
      
      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
      mockedAxios.head.mockRejectedValue(new Error('Not found'));

      const url = 'http://example.com/Very_Long_URL_Path/With/Many/Levels/And/UPPERCASE/Letters/page.php?param1=value1&param2=value2&param3=value3&param4=value4';
      const result = await analyzer.analyzeStructure(url, mockConfig);

      expect(result.urlStructure.score).toBeLessThan(70);
      expect(result.urlStructure.issues).toContain('URL is not using HTTPS');
      expect(result.urlStructure.issues).toContain('URL is too long (over 100 characters)');
      expect(result.urlStructure.issues).toContain('URL has too many path levels (over 5)');
      expect(result.urlStructure.issues).toContain('URL uses underscores instead of hyphens');
      expect(result.urlStructure.issues).toContain('URL contains uppercase letters');
    });

    it('should handle URLs with special characters', async () => {
      const mockHtml = '<html><head><title>Test</title></head><body></body></html>';
      
      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
      mockedAxios.head.mockRejectedValue(new Error('Not found'));

      const url = 'https://example.com/path with spaces/special@chars';
      const result = await analyzer.analyzeStructure(url, mockConfig);

      expect(result.urlStructure.score).toBeLessThan(90);
      expect(result.urlStructure.issues).toContain('URL contains special characters');
    });
  });

  describe('sitemap detection', () => {
    it('should find sitemap.xml', async () => {
      const mockHtml = '<html><head><title>Test</title></head><body></body></html>';
      
      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
      mockedAxios.head.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      const url = 'https://example.com';
      const result = await analyzer.analyzeStructure(url, mockConfig);

      expect(result.sitemapPresent).toBe(true);
    });

    it('should find sitemap from robots.txt', async () => {
      const mockHtml = '<html><head><title>Test</title></head><body></body></html>';
      const mockRobots = 'User-agent: *\nDisallow: /admin\nSitemap: https://example.com/custom-sitemap.xml';
      
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockHtml }) // Main page
        .mockResolvedValueOnce({ data: mockRobots }); // robots.txt
      
      mockedAxios.head.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      const url = 'https://example.com';
      const result = await analyzer.analyzeStructure(url, mockConfig);

      expect(result.sitemapPresent).toBe(true);
    });

    it('should handle missing sitemap', async () => {
      const mockHtml = '<html><head><title>Test</title></head><body></body></html>';
      
      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
      mockedAxios.head.mockRejectedValue(new Error('Not found'));

      const url = 'https://example.com';
      const result = await analyzer.analyzeStructure(url, mockConfig);

      expect(result.sitemapPresent).toBe(false);
    });
  });

  describe('accessibility analysis', () => {
    it('should detect proper semantic HTML', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head><title>Semantic HTML Example</title></head>
        <body>
          <header>
            <nav><a href="/">Home</a></nav>
          </header>
          <main>
            <article>
              <h1>Article Title</h1>
              <section>
                <h2>Section Title</h2>
                <p>Content</p>
              </section>
            </article>
          </main>
          <aside>
            <h2>Sidebar</h2>
          </aside>
          <footer>
            <p>Footer content</p>
          </footer>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
      mockedAxios.head.mockRejectedValue(new Error('Not found'));

      const url = 'https://example.com';
      const result = await analyzer.analyzeStructure(url, mockConfig);

      expect(result.accessibility.score).toBeGreaterThan(85);
      expect(result.accessibility.issues).not.toContain('Limited use of semantic HTML elements');
    });

    it('should detect missing form labels', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head><title>Form Example</title></head>
        <body>
          <form>
            <input type="text" placeholder="Name">
            <input type="email" id="email">
            <label for="email">Email</label>
            <input type="password" aria-label="Password">
            <textarea placeholder="Message"></textarea>
            <select>
              <option>Choose</option>
            </select>
          </form>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
      mockedAxios.head.mockRejectedValue(new Error('Not found'));

      const url = 'https://example.com';
      const result = await analyzer.analyzeStructure(url, mockConfig);

      // Should detect 3 inputs without proper labels (name, message, select)
      expect(result.accessibility.issues).toContain('3 form input(s) without proper labels');
    });

    it('should detect heading hierarchy issues', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head><title>Bad Headings</title></head>
        <body>
          <h1>Title</h1>
          <h4>Skipped to H4</h4>
          <h2>Back to H2</h2>
          <h5>Skipped to H5</h5>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
      mockedAxios.head.mockRejectedValue(new Error('Not found'));

      const url = 'https://example.com';
      const result = await analyzer.analyzeStructure(url, mockConfig);

      expect(result.accessibility.issues).toContain('Heading hierarchy is not properly structured');
    });

    it('should detect images without alt text', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head><title>Images</title></head>
        <body>
          <img src="image1.jpg" alt="Descriptive alt text">
          <img src="image2.jpg">
          <img src="image3.jpg" alt="">
          <img src="image4.jpg">
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
      mockedAxios.head.mockRejectedValue(new Error('Not found'));

      const url = 'https://example.com';
      const result = await analyzer.analyzeStructure(url, mockConfig);

      // Should detect 2 images without alt text
      expect(result.accessibility.issues).toContain('2 image(s) missing alt text');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));

      const url = 'https://unreachable.example.com';
      
      await expect(analyzer.analyzeStructure(url, mockConfig))
        .rejects.toThrow();
    });

    it('should handle malformed HTML', async () => {
      const mockHtml = `
        <html>
        <head>
          <title>Malformed HTML
        <body>
          <h1>Missing closing tags
          <img src="image.jpg"
          <a href="/link">Link without closing tag
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
      mockedAxios.head.mockRejectedValue(new Error('Not found'));

      const result = await analyzer.analyzeStructure('https://example.com', mockConfig);
      
      // Should still analyze what it can
      expect(result).toBeDefined();
      expect(result.accessibility.score).toBeGreaterThan(0);
    });

    it('should handle timeout errors', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded'
      });

      await expect(analyzer.analyzeStructure('https://slow.example.com', mockConfig))
        .rejects.toThrow();
    });
  });
});