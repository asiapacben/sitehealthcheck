import { CredibilityAnalyzer } from '../CredibilityAnalyzer';
import { AnalysisConfig } from '../../../../shared/types';
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
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

describe('CredibilityAnalyzer', () => {
  let analyzer: CredibilityAnalyzer;
  let mockConfig: AnalysisConfig;

  beforeEach(() => {
    analyzer = new CredibilityAnalyzer();
    mockConfig = {
      seoWeights: { technical: 0.4, content: 0.4, structure: 0.2 },
      geoWeights: { readability: 0.3, credibility: 0.3, completeness: 0.2, structuredData: 0.2 },
      thresholds: { pageSpeedMin: 3000, contentLengthMin: 300, headingLevels: 3 }
    };
  });

  describe('analyzeCredibility', () => {
    it('should analyze credibility for content with author information', async () => {
      const html = `
        <html>
          <head><title>Test Article</title></head>
          <body>
            <article>
              <h1>Expert Analysis of Market Trends</h1>
              <div class="author">Dr. Jane Smith, PhD in Economics</div>
              <p>According to recent research from Harvard University, market trends show...</p>
              <p>The author has 15 years of experience in financial analysis and is a certified financial planner.</p>
              <a href="https://scholar.google.com/citations">Research citations</a>
              <a href="https://university.edu/faculty/smith">Faculty profile</a>
            </article>
            <footer>
              <a href="/contact">Contact Us</a>
              <a href="/privacy">Privacy Policy</a>
            </footer>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeCredibility(html, 'https://example.com/article', mockConfig);

      expect(result.authorInformation).toBe(true);
      expect(result.citations).toBeGreaterThan(0);
      expect(result.expertiseIndicators.some(indicator => indicator.includes('Educational credentials'))).toBe(true);
      expect(result.expertiseIndicators.some(indicator => indicator.includes('Experience mentions'))).toBe(true);
      expect(result.sourceCredibility.score).toBeGreaterThan(70);
    });

    it('should detect lack of author information', async () => {
      const html = `
        <html>
          <head><title>Anonymous Article</title></head>
          <body>
            <article>
              <h1>Some Random Content</h1>
              <p>This is content without any author information or credibility signals.</p>
            </article>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeCredibility(html, 'http://example.com/article', mockConfig);

      expect(result.authorInformation).toBe(false);
      expect(result.citations).toBe(0);
      expect(result.expertiseIndicators).toHaveLength(0);
      expect(result.sourceCredibility.score).toBeLessThan(60);
    });

    it('should handle content with multiple credibility signals', async () => {
      const html = `
        <html>
          <head><title>Medical Research Article</title></head>
          <body>
            <article>
              <h1>Clinical Study Results</h1>
              <div class="byline">By Dr. Michael Johnson, MD, Board Certified Cardiologist</div>
              <div class="author-bio">
                Dr. Johnson is a licensed physician with 20 years of experience in cardiology.
                He is a fellow of the American College of Cardiology and has published over 50 peer-reviewed papers.
              </div>
              <p>According to a study published in the New England Journal of Medicine [1], patients showed significant improvement.</p>
              <p>Research from Johns Hopkins University demonstrates similar findings [2].</p>
              <div class="references">
                <h3>References</h3>
                <ol>
                  <li><a href="https://nejm.org/study1">NEJM Study on Treatment Efficacy</a></li>
                  <li><a href="https://hopkinsmedicine.org/research">Hopkins Research Data</a></li>
                </ol>
              </div>
            </article>
            <footer>
              <p>Contact: info@medicalcenter.org | Phone: (555) 123-4567</p>
              <p>123 Medical Drive, Healthcare City, HC 12345</p>
              <a href="/privacy">Privacy Policy</a>
              <a href="/terms">Terms of Service</a>
            </footer>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeCredibility(html, 'https://medicalcenter.org/research', mockConfig);

      expect(result.authorInformation).toBe(true);
      expect(result.citations).toBeGreaterThan(2);
      expect(result.expertiseIndicators.length).toBeGreaterThan(3);
      expect(result.sourceCredibility.score).toBeGreaterThan(80);
    });

    it('should handle educational domain with high authority', async () => {
      const html = `
        <html>
          <head><title>University Research</title></head>
          <body>
            <article>
              <h1>Academic Research Paper</h1>
              <div class="author">Professor Sarah Wilson, PhD</div>
              <p>This research was conducted at Stanford University...</p>
            </article>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeCredibility(html, 'https://stanford.edu/research/paper', mockConfig);

      expect(result.sourceCredibility.score).toBeGreaterThanOrEqual(80);
    });

    it('should penalize low-authority domains', async () => {
      const html = `
        <html>
          <head><title>Blog Post</title></head>
          <body>
            <article>
              <h1>My Opinion on Things</h1>
              <p>I think this and that about various topics...</p>
            </article>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeCredibility(html, 'http://myblog.blogspot.com/post', mockConfig);

      expect(result.sourceCredibility.score).toBeLessThan(60);
    });

    it('should detect various citation formats', async () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Research Summary</h1>
              <p>According to Smith et al. (2023), the results show significant correlation [1].</p>
              <p>Research shows that 85% of participants improved [2].</p>
              <p>A study found similar results in <a href="https://pubmed.ncbi.nlm.nih.gov/12345">PubMed research</a>.</p>
              <p>Source: <a href="https://nature.com/article">Nature Journal Article</a></p>
            </article>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeCredibility(html, 'https://example.com', mockConfig);

      expect(result.citations).toBeGreaterThan(4);
    });

    it('should detect expertise indicators correctly', async () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Professional Analysis</h1>
              <div class="author-bio">
                John Doe is a certified public accountant with an MBA from Wharton.
                He has been licensed to practice for 12 years and is a member of the
                American Institute of CPAs. He has received multiple awards for excellence
                and has been featured in Forbes magazine.
              </div>
            </article>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeCredibility(html, 'https://example.com', mockConfig);

      expect(result.expertiseIndicators.some(indicator => indicator.includes('Educational credentials'))).toBe(true);
      expect(result.expertiseIndicators.some(indicator => indicator.includes('Professional certifications'))).toBe(true);
      expect(result.expertiseIndicators.some(indicator => indicator.includes('Experience mentions'))).toBe(true);
      expect(result.expertiseIndicators.some(indicator => indicator.includes('Awards/Recognition'))).toBe(true);
      expect(result.expertiseIndicators.some(indicator => indicator.includes('Professional affiliations'))).toBe(true);
    });

    it('should handle missing or invalid HTML gracefully', async () => {
      const invalidHtml = '<html><body><p>Incomplete';

      const result = await analyzer.analyzeCredibility(invalidHtml, 'https://example.com', mockConfig);

      expect(result).toBeDefined();
      expect(result.authorInformation).toBe(false);
      expect(result.citations).toBe(0);
      expect(result.expertiseIndicators).toHaveLength(0);
      expect(typeof result.sourceCredibility.score).toBe('number');
    });

    it('should throw error for network failures', async () => {
      // Simulate a scenario that would cause an error
      const analyzer = new CredibilityAnalyzer();
      
      // Mock a method to throw an error
      jest.spyOn(analyzer as any, 'detectAuthorInformation').mockRejectedValue(new Error('Network error'));

      await expect(
        analyzer.analyzeCredibility('<html></html>', 'https://example.com', mockConfig)
      ).rejects.toThrow('Credibility analysis failed for https://example.com: Network error');
    });
  });

  describe('author detection', () => {
    it('should detect author in byline patterns', async () => {
      const html = `
        <html>
          <body>
            <p>By John Smith</p>
            <p>Written by Jane Doe</p>
            <p>Author: Bob Johnson</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeCredibility(html, 'https://example.com', mockConfig);
      expect(result.authorInformation).toBe(true);
    });

    it('should not detect non-author text as authors', async () => {
      const html = `
        <html>
          <body>
            <div class="author">Click here for more</div>
            <div class="author">Subscribe to newsletter</div>
            <div class="author">123</div>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeCredibility(html, 'https://example.com', mockConfig);
      expect(result.authorInformation).toBe(false);
    });
  });

  describe('citation analysis', () => {
    it('should count numbered citations', async () => {
      const html = `
        <html>
          <body>
            <p>Research shows [1] that results are significant [2].</p>
            <p>According to studies (2023), findings indicate [3] improvement.</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeCredibility(html, 'https://example.com', mockConfig);
      expect(result.citations).toBeGreaterThan(3);
    });

    it('should identify authoritative link citations', async () => {
      const html = `
        <html>
          <body>
            <p>See <a href="https://pubmed.ncbi.nlm.nih.gov/123">this study</a> for details.</p>
            <p>Research from <a href="https://harvard.edu/research">Harvard</a> confirms this.</p>
            <p>Government data shows <a href="https://cdc.gov/data">CDC statistics</a>.</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeCredibility(html, 'https://example.com', mockConfig);
      expect(result.citations).toBeGreaterThan(2);
    });
  });

  describe('domain authority analysis', () => {
    it('should give high scores to educational domains', async () => {
      const html = '<html><body><h1>Test</h1></body></html>';
      
      const result = await analyzer.analyzeCredibility(html, 'https://mit.edu/research', mockConfig);
      expect(result.sourceCredibility.score).toBeGreaterThanOrEqual(80);
    });

    it('should give high scores to government domains', async () => {
      const html = '<html><body><h1>Test</h1></body></html>';
      
      const result = await analyzer.analyzeCredibility(html, 'https://nih.gov/study', mockConfig);
      expect(result.sourceCredibility.score).toBeGreaterThanOrEqual(80);
    });

    it('should penalize non-secure HTTP sites', async () => {
      const html = '<html><body><h1>Test</h1></body></html>';
      
      const result = await analyzer.analyzeCredibility(html, 'http://example.com/article', mockConfig);
      expect(result.sourceCredibility.score).toBeLessThan(70);
    });
  });

  describe('contact information analysis', () => {
    it('should detect comprehensive contact information', async () => {
      const html = `
        <html>
          <body>
            <footer>
              <p>Contact us at info@company.com or call (555) 123-4567</p>
              <p>Address: 123 Main Street, City, State 12345</p>
              <a href="/contact">Contact Page</a>
              <a href="/about">About Us</a>
              <a href="/privacy">Privacy Policy</a>
              <a href="https://facebook.com/company">Facebook</a>
            </footer>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeCredibility(html, 'https://company.com', mockConfig);
      expect(result.sourceCredibility.score).toBeGreaterThan(70);
    });
  });

  describe('content freshness analysis', () => {
    it('should detect recent dates', async () => {
      const currentYear = new Date().getFullYear();
      const html = `
        <html>
          <body>
            <article>
              <div class="date">${currentYear}-01-15</div>
              <p>This content was updated recently and mentions ${currentYear} trends.</p>
            </article>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeCredibility(html, 'https://example.com', mockConfig);
      expect(result.sourceCredibility.score).toBeGreaterThan(60);
    });

    it('should penalize content without date information', async () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Undated Content</h1>
              <p>This content has no date information.</p>
            </article>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeCredibility(html, 'https://example.com', mockConfig);
      expect(result.sourceCredibility.issues.some(issue => issue.includes('outdated'))).toBe(true);
    });
  });

  describe('social proof analysis', () => {
    it('should detect testimonials and social proof', async () => {
      const html = `
        <html>
          <body>
            <div class="testimonial">
              <p>"Great service, trusted by over 10,000 customers!"</p>
            </div>
            <div class="client-logos">
              <img src="logo1.png" alt="Client 1">
              <img src="logo2.png" alt="Client 2">
            </div>
            <p>Used by 500+ companies worldwide</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeCredibility(html, 'https://example.com', mockConfig);
      expect(result.sourceCredibility.score).toBeGreaterThan(60);
    });
  });
});