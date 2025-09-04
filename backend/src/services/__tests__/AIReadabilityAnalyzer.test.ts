import { AIReadabilityAnalyzer } from '../AIReadabilityAnalyzer';
import { AnalysisConfig } from '../../../../shared/types';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

describe('AIReadabilityAnalyzer', () => {
  let analyzer: AIReadabilityAnalyzer;
  let mockConfig: AnalysisConfig;

  beforeEach(() => {
    analyzer = new AIReadabilityAnalyzer();
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

  describe('analyzeAIReadability', () => {
    it('should analyze well-structured content successfully', async () => {
      const html = `
        <html>
          <head><title>Complete Guide to Web Development</title></head>
          <body>
            <main>
              <h1>Complete Guide to Web Development</h1>
              <p>This comprehensive guide covers everything you need to know about web development. 
                 We'll explore the fundamentals, best practices, and advanced techniques.</p>
              
              <h2>What is Web Development?</h2>
              <p>Web development is the process of creating websites and web applications. 
                 It involves multiple disciplines including design, programming, and user experience.</p>
              
              <h3>Frontend Development</h3>
              <p>Frontend development focuses on the user interface. For example, HTML provides structure, 
                 CSS handles styling, and JavaScript adds interactivity.</p>
              
              <h3>Backend Development</h3>
              <p>Backend development manages server-side logic. This includes database management, 
                 API development, and server configuration.</p>
              
              <h2>How to Get Started</h2>
              <ol>
                <li>Learn HTML and CSS fundamentals</li>
                <li>Practice with JavaScript</li>
                <li>Build your first project</li>
              </ol>
              
              <p>In conclusion, web development offers many opportunities for creative and technical growth.</p>
            </main>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result).toBeDefined();
      expect(result.contentClarity.score).toBeGreaterThan(60);
      expect(result.questionAnswerFormat).toBe(true);
      expect(result.informationHierarchy.score).toBeGreaterThan(80);
      expect(result.topicCoverage.score).toBeGreaterThan(30);
    });

    it('should detect poor content structure', async () => {
      const html = `
        <html>
          <body>
            <p>Short content without proper structure or headings. No clear organization.</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result.contentClarity.score).toBeLessThan(60);
      expect(result.informationHierarchy.score).toBeLessThan(50);
      expect(result.contentClarity.issues).toContain('Content is too short for meaningful analysis');
      expect(result.informationHierarchy.issues).toContain('Missing main heading (H1)');
    });

    it('should identify question-answer format', async () => {
      const html = `
        <html>
          <body>
            <h1>Frequently Asked Questions</h1>
            <h2>What is machine learning?</h2>
            <p>Machine learning is a subset of artificial intelligence that enables computers to learn.</p>
            
            <h2>How does it work?</h2>
            <p>It works by training algorithms on data to make predictions or decisions.</p>
            
            <h2>Why is it important?</h2>
            <p>It's important because it can automate complex decision-making processes.</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result.questionAnswerFormat).toBe(true);
    });

    it('should detect content without Q&A format', async () => {
      const html = `
        <html>
          <body>
            <h1>Introduction to Programming</h1>
            <p>Programming is the process of creating computer software. It involves writing code
               in various programming languages to solve problems and create applications.</p>
            
            <h2>Programming Languages</h2>
            <p>There are many programming languages available, each with its own strengths and use cases.</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result.questionAnswerFormat).toBe(false);
    });
  });  
describe('content clarity analysis', () => {
    it('should score high for clear, well-written content', async () => {
      const html = `
        <html>
          <body>
            <main>
              <h1>Simple Guide to Cooking</h1>
              <p>Cooking is easy when you follow simple steps. Start with basic ingredients. 
                 Use fresh vegetables and quality meat. Season your food well.</p>
              
              <p>First, prepare your ingredients. Wash vegetables thoroughly. 
                 Cut them into even pieces. This ensures even cooking.</p>
              
              <p>Next, heat your pan. Add oil when the pan is warm. 
                 Cook ingredients in the right order. Vegetables take longer than meat.</p>
              
              <p>Finally, taste and adjust seasoning. Serve immediately for best results.</p>
            </main>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result.contentClarity.score).toBeGreaterThan(80);
      expect(result.contentClarity.issues.length).toBeLessThanOrEqual(1);
    });

    it('should identify complex, difficult-to-read content', async () => {
      const html = `
        <html>
          <body>
            <p>The implementation of sophisticated algorithmic methodologies necessitates comprehensive 
               understanding of multidimensional computational paradigms, particularly when considering 
               the intricate relationships between heterogeneous data structures and their corresponding 
               optimization strategies within distributed computing environments that leverage advanced 
               machine learning techniques for predictive analytics and automated decision-making processes.</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result.contentClarity.score).toBeLessThan(60);
      expect(result.contentClarity.issues).toContain('Content is very difficult to read');
      expect(result.contentClarity.issues).toContain('Sentences are too long on average');
    });

    it('should detect short content', async () => {
      const html = `
        <html>
          <body>
            <p>Short content.</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result.contentClarity.score).toBeLessThan(70);
      expect(result.contentClarity.issues).toContain('Content is too short for meaningful analysis');
    });
  });

  describe('information hierarchy analysis', () => {
    it('should score high for proper heading hierarchy', async () => {
      const html = `
        <html>
          <body>
            <h1>Main Topic</h1>
            <p>Introduction paragraph with clear topic introduction.</p>
            
            <h2>First Subtopic</h2>
            <p>Content for first subtopic with detailed explanation.</p>
            
            <h3>Detailed Section</h3>
            <p>More specific information about the subtopic.</p>
            
            <h2>Second Subtopic</h2>
            <p>Content for second subtopic with examples and details.</p>
            
            <p>In conclusion, this content follows a logical structure.</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result.informationHierarchy.score).toBeGreaterThan(80);
      expect(result.informationHierarchy.issues.length).toBeLessThanOrEqual(1);
    });

    it('should detect hierarchy problems', async () => {
      const html = `
        <html>
          <body>
            <h1>First Title</h1>
            <h1>Second Title</h1>
            <h4>Skipped H2 and H3</h4>
            <p>Content without proper structure.</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result.informationHierarchy.score).toBeLessThan(70);
      expect(result.informationHierarchy.issues).toContain('Multiple H1 headings found');
      expect(result.informationHierarchy.issues).toContain('Heading hierarchy has gaps (e.g., H2 followed by H4)');
    });

    it('should detect missing headings', async () => {
      const html = `
        <html>
          <body>
            <p>Content without any headings at all. This makes it hard to understand the structure.</p>
            <p>More content that continues without clear organization or hierarchy.</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result.informationHierarchy.score).toBeLessThan(50);
      expect(result.informationHierarchy.issues).toContain('Missing main heading (H1)');
      expect(result.informationHierarchy.issues).toContain('No headings found');
    });
  });

  describe('topic coverage analysis', () => {
    it('should score high for comprehensive topic coverage', async () => {
      const html = `
        <html>
          <head><title>Complete Guide to Digital Marketing</title></head>
          <body>
            <h1>Complete Guide to Digital Marketing</h1>
            <p>Digital marketing encompasses various strategies and techniques for promoting 
               products and services online. This comprehensive guide covers all aspects 
               of digital marketing, including best practices, common mistakes, and proven methods.</p>
            
            <h2>Types of Digital Marketing</h2>
            <p>There are several types of digital marketing approaches. For example, 
               social media marketing focuses on platforms like Facebook and Instagram. 
               According to recent studies, 73% of marketers use social media effectively.</p>
            
            <h2>How to Get Started</h2>
            <ol>
              <li>Define your target audience</li>
              <li>Create a content strategy</li>
              <li>Choose the right platforms</li>
              <li>Implement tracking and analytics</li>
            </ol>
            
            <h2>Best Practices and Tips</h2>
            <p>Follow these recommendations to improve your digital marketing results. 
               Consider testing different approaches and measuring their effectiveness.</p>
            
            <h2>Common Mistakes to Avoid</h2>
            <p>Many businesses make these pitfalls when starting digital marketing campaigns.</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result.topicCoverage.score).toBeGreaterThan(60);
      expect(result.topicCoverage.issues.length).toBeLessThanOrEqual(2);
    });

    it('should detect incomplete topic coverage', async () => {
      const html = `
        <html>
          <head><title>Marketing</title></head>
          <body>
            <h1>Marketing</h1>
            <p>Marketing is important for businesses. It helps promote products.</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result.topicCoverage.score).toBeLessThan(50);
      expect(result.topicCoverage.issues).toContain('Content is too brief for comprehensive topic coverage');
      expect(result.topicCoverage.issues).toContain('Lacks concrete examples or case studies');
    });

    it('should detect actionable content', async () => {
      const html = `
        <html>
          <body>
            <h1>How to Build a Website</h1>
            <p>Follow these steps to create your first website:</p>
            
            <ol>
              <li>Choose a domain name</li>
              <li>Select a hosting provider</li>
              <li>Install a content management system</li>
              <li>Design your layout</li>
              <li>Add content and images</li>
            </ol>
            
            <p>You should start by planning your website structure. 
               Consider your target audience and their needs.</p>
            
            <p>Next, you need to implement these features step by step. 
               Make sure to test each component before moving forward.</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result.topicCoverage.score).toBeGreaterThan(20);
    });
  });

  describe('question-answer format detection', () => {
    it('should detect FAQ sections', async () => {
      const html = `
        <html>
          <body>
            <div class="faq-section">
              <h2>Frequently Asked Questions</h2>
              <h3>What is our return policy?</h3>
              <p>We offer a 30-day return policy for all items.</p>
              
              <h3>How do I track my order?</h3>
              <p>You can track your order using the tracking number provided.</p>
            </div>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result.questionAnswerFormat).toBe(true);
    });

    it('should detect question patterns in headings', async () => {
      const html = `
        <html>
          <body>
            <h1>Programming Guide</h1>
            <h2>What is Python?</h2>
            <p>Python is a programming language.</p>
            
            <h2>How do you install Python?</h2>
            <p>Download it from the official website.</p>
            
            <h2>Why choose Python?</h2>
            <p>Python is easy to learn and versatile.</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result.questionAnswerFormat).toBe(true);
    });

    it('should not detect Q&A format in regular content', async () => {
      const html = `
        <html>
          <body>
            <h1>About Our Company</h1>
            <p>We are a leading provider of software solutions.</p>
            
            <h2>Our Services</h2>
            <p>We offer web development and consulting services.</p>
            
            <h2>Our Team</h2>
            <p>Our team consists of experienced developers and designers.</p>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result.questionAnswerFormat).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle malformed HTML gracefully', async () => {
      const html = '<html><body><p>Incomplete HTML';

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result).toBeDefined();
      expect(result.contentClarity).toBeDefined();
      expect(result.informationHierarchy).toBeDefined();
      expect(result.topicCoverage).toBeDefined();
    });

    it('should handle empty content', async () => {
      const html = '<html><body></body></html>';

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result).toBeDefined();
      expect(result.contentClarity.score).toBe(0);
      expect(result.questionAnswerFormat).toBe(false);
    });

    it('should handle content with only scripts and styles', async () => {
      const html = `
        <html>
          <head>
            <style>body { color: red; }</style>
            <script>console.log('test');</script>
          </head>
          <body>
            <script>alert('hello');</script>
            <style>.hidden { display: none; }</style>
          </body>
        </html>
      `;

      const result = await analyzer.analyzeAIReadability(html, 'https://example.com', mockConfig);

      expect(result).toBeDefined();
      expect(result.contentClarity.score).toBe(0);
    });
  });
});