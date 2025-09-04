import * as cheerio from 'cheerio';
import axios from 'axios';
import { URL } from 'url';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/ErrorHandler';
import { 
  StructureResult, 
  QualityScore, 
  AnalysisConfig,
  ParsingError 
} from '@shared/types';

export class StructureAnalyzer {
  private errorHandler: ErrorHandler;
  private readonly userAgent = 'SEO-GEO-Health-Checker/1.0 (compatible; analysis bot)';

  constructor() {
    this.errorHandler = new ErrorHandler();
  }

  /**
   * Analyzes website structure and accessibility factors
   */
  async analyzeStructure(url: string, config: AnalysisConfig): Promise<StructureResult> {
    logger.info('Starting structure and accessibility analysis', { url });

    try {
      // Fetch page content
      const html = await this.fetchPageContent(url);
      const $ = cheerio.load(html);

      // Run parallel structure analyses
      const [
        internalLinksResult,
        urlStructureResult,
        sitemapResult,
        accessibilityResult
      ] = await Promise.allSettled([
        this.analyzeInternalLinks($, url),
        this.analyzeUrlStructure(url),
        this.checkSitemapPresence(url),
        this.analyzeAccessibility($, url)
      ]);

      const result: StructureResult = {
        internalLinks: this.extractResult(internalLinksResult, 0),
        urlStructure: this.extractResult(urlStructureResult, {
          score: 0,
          issues: ['Analysis failed'],
          suggestions: ['Retry analysis']
        }),
        sitemapPresent: this.extractResult(sitemapResult, false),
        accessibility: this.extractResult(accessibilityResult, {
          score: 0,
          issues: ['Analysis failed'],
          suggestions: ['Retry analysis']
        })
      };

      logger.info('Structure and accessibility analysis completed', {
        url,
        internalLinks: result.internalLinks,
        urlStructureScore: result.urlStructure.score,
        sitemapPresent: result.sitemapPresent,
        accessibilityScore: result.accessibility.score
      });

      return result;

    } catch (error) {
      logger.error('Structure analysis failed', { url, error });
      throw this.errorHandler.createParsingError(
        url,
        error instanceof Error ? error : new Error('Structure analysis failed')
      );
    }
  }

  /**
   * Fetches page content with proper headers
   */
  private async fetchPageContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        },
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400
      });

      return response.data;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`HTTP ${error.response?.status}: ${error.response?.statusText || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Analyzes internal linking structure
   */
  private async analyzeInternalLinks($: cheerio.CheerioAPI, url: string): Promise<number> {
    const baseUrl = new URL(url);
    const baseDomain = baseUrl.hostname.replace(/^www\./, '');
    
    // Get all links on the page
    const allLinks = $('a[href]');
    let internalLinkCount = 0;
    let externalLinkCount = 0;
    const uniqueInternalLinks = new Set<string>();
    const linkIssues: string[] = [];

    allLinks.each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      try {
        // Handle relative URLs
        const linkUrl = new URL(href, url);
        const linkDomain = linkUrl.hostname.replace(/^www\./, '');
        
        if (linkDomain === baseDomain) {
          internalLinkCount++;
          uniqueInternalLinks.add(linkUrl.pathname);
        } else {
          externalLinkCount++;
        }

        // Check for link issues
        const linkText = $(element).text().trim();
        if (!linkText || linkText.toLowerCase() === 'click here' || linkText.toLowerCase() === 'read more') {
          linkIssues.push(`Poor link text: "${linkText}"`);
        }

        // Check for nofollow on internal links
        const rel = $(element).attr('rel');
        if (linkDomain === baseDomain && rel && rel.includes('nofollow')) {
          linkIssues.push('Internal link has nofollow attribute');
        }

      } catch (error) {
        // Invalid URL, skip
        logger.debug('Invalid link URL found', { href, error });
      }
    });

    logger.debug('Internal links analysis', {
      url,
      internalLinks: internalLinkCount,
      uniqueInternalLinks: uniqueInternalLinks.size,
      externalLinks: externalLinkCount,
      issues: linkIssues.length
    });

    return internalLinkCount;
  }

  /**
   * Analyzes URL structure quality
   */
  private async analyzeUrlStructure(url: string): Promise<QualityScore> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const searchParams = parsedUrl.searchParams;

      // Check URL length
      if (url.length > 100) {
        score -= 15;
        issues.push('URL is too long (over 100 characters)');
        suggestions.push('Shorten URL by removing unnecessary parameters or path segments');
      }

      // Check for HTTPS
      if (parsedUrl.protocol !== 'https:') {
        score -= 20;
        issues.push('URL is not using HTTPS');
        suggestions.push('Implement SSL certificate and use HTTPS');
      }

      // Check for www consistency
      const hasWww = parsedUrl.hostname.startsWith('www.');
      // This is informational - not necessarily bad

      // Check path structure
      const pathSegments = pathname.split('/').filter(segment => segment.length > 0);
      
      // Check for too many path levels
      if (pathSegments.length > 5) {
        score -= 10;
        issues.push('URL has too many path levels (over 5)');
        suggestions.push('Simplify URL structure by reducing nesting levels');
      }

      // Check for descriptive path segments
      const hasDescriptiveSegments = pathSegments.every(segment => {
        // Check if segment is descriptive (not just numbers or single characters)
        return segment.length > 2 && !/^\d+$/.test(segment) && !/^[a-z]$/.test(segment);
      });

      if (!hasDescriptiveSegments && pathSegments.length > 0) {
        score -= 10;
        issues.push('URL contains non-descriptive path segments');
        suggestions.push('Use descriptive, keyword-rich path segments');
      }

      // Check for hyphens vs underscores
      const hasUnderscores = pathname.includes('_');
      if (hasUnderscores) {
        score -= 5;
        issues.push('URL uses underscores instead of hyphens');
        suggestions.push('Replace underscores with hyphens in URLs');
      }

      // Check for uppercase letters
      const hasUppercase = /[A-Z]/.test(pathname);
      if (hasUppercase) {
        score -= 5;
        issues.push('URL contains uppercase letters');
        suggestions.push('Use lowercase letters in URLs for consistency');
      }

      // Check for special characters
      const hasSpecialChars = /[^a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]/.test(pathname);
      if (hasSpecialChars) {
        score -= 10;
        issues.push('URL contains special characters');
        suggestions.push('Remove or encode special characters in URLs');
      }

      // Check for query parameters
      if (searchParams.toString()) {
        const paramCount = Array.from(searchParams.keys()).length;
        if (paramCount > 3) {
          score -= 5;
          issues.push('URL has many query parameters');
          suggestions.push('Minimize query parameters or use URL rewriting');
        }

        // Check for session IDs or tracking parameters
        const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'sessionid', 'sid'];
        const hasTrackingParams = trackingParams.some(param => searchParams.has(param));
        if (hasTrackingParams) {
          suggestions.push('Consider using canonical URLs to handle tracking parameters');
        }
      }

      // Check for file extensions
      const hasFileExtension = /\.(html?|php|asp|jsp)$/i.test(pathname);
      if (hasFileExtension) {
        score -= 3;
        suggestions.push('Consider removing file extensions from URLs for cleaner structure');
      }

      // Check for breadcrumb-friendly structure
      if (pathSegments.length > 1) {
        const hasLogicalHierarchy = this.checkLogicalHierarchy(pathSegments);
        if (!hasLogicalHierarchy) {
          score -= 5;
          suggestions.push('Ensure URL structure reflects logical content hierarchy');
        }
      }

    } catch (error) {
      score = 0;
      issues.push('Invalid URL structure');
      suggestions.push('Fix URL format and structure');
    }

    return {
      score: Math.max(0, Math.round(score)),
      issues,
      suggestions
    };
  }

  /**
   * Checks for sitemap presence
   */
  private async checkSitemapPresence(url: string): Promise<boolean> {
    try {
      const baseUrl = new URL(url);
      const sitemapUrls = [
        `${baseUrl.protocol}//${baseUrl.host}/sitemap.xml`,
        `${baseUrl.protocol}//${baseUrl.host}/sitemap_index.xml`,
        `${baseUrl.protocol}//${baseUrl.host}/sitemaps.xml`
      ];

      // Check robots.txt for sitemap reference
      try {
        const robotsUrl = `${baseUrl.protocol}//${baseUrl.host}/robots.txt`;
        const robotsResponse = await axios.get(robotsUrl, {
          timeout: 10000,
          validateStatus: (status) => status === 200
        });

        const robotsContent = robotsResponse.data;
        const sitemapMatch = robotsContent.match(/sitemap:\s*(.+)/i);
        if (sitemapMatch) {
          sitemapUrls.unshift(sitemapMatch[1].trim());
        }
      } catch (error) {
        // Robots.txt not found or inaccessible, continue with default sitemap URLs
        logger.debug('Could not fetch robots.txt', { url, error });
      }

      // Check each potential sitemap URL
      for (const sitemapUrl of sitemapUrls) {
        try {
          const response = await axios.head(sitemapUrl, {
            timeout: 10000,
            validateStatus: (status) => status === 200
          });

          if (response.status === 200) {
            logger.debug('Sitemap found', { sitemapUrl });
            return true;
          }
        } catch (error) {
          // Continue to next sitemap URL
          continue;
        }
      }

      return false;

    } catch (error) {
      logger.debug('Error checking sitemap presence', { url, error });
      return false;
    }
  }

  /**
   * Analyzes accessibility factors
   */
  private async analyzeAccessibility($: cheerio.CheerioAPI, url: string): Promise<QualityScore> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check for alt text on images
    const images = $('img');
    let imagesWithoutAlt = 0;
    let decorativeImages = 0;

    images.each((_, element) => {
      const alt = $(element).attr('alt');
      const src = $(element).attr('src');
      
      if (alt === undefined) {
        imagesWithoutAlt++;
      } else if (alt === '') {
        decorativeImages++;
      }
    });

    if (imagesWithoutAlt > 0) {
      score -= Math.min(30, imagesWithoutAlt * 5);
      issues.push(`${imagesWithoutAlt} image(s) missing alt text`);
      suggestions.push('Add descriptive alt text to all images');
    }

    // Check for proper heading hierarchy
    const headings = $('h1, h2, h3, h4, h5, h6');
    let headingIssues = 0;
    let previousLevel = 0;

    headings.each((_, element) => {
      const tagName = element.tagName.toLowerCase();
      const currentLevel = parseInt(tagName.charAt(1));
      
      if (previousLevel > 0 && currentLevel > previousLevel + 1) {
        headingIssues++;
      }
      
      previousLevel = currentLevel;
    });

    if (headingIssues > 0) {
      score -= Math.min(15, headingIssues * 3);
      issues.push('Heading hierarchy is not properly structured');
      suggestions.push('Use headings in sequential order (H1 → H2 → H3, etc.)');
    }

    // Check for form labels
    const inputs = $('input[type="text"], input[type="email"], input[type="password"], input[type="tel"], textarea, select');
    let inputsWithoutLabels = 0;

    inputs.each((_, element) => {
      const id = $(element).attr('id');
      const ariaLabel = $(element).attr('aria-label');
      const ariaLabelledby = $(element).attr('aria-labelledby');
      
      // Check if there's a label for this input
      const hasLabel = id && $(`label[for="${id}"]`).length > 0;
      const hasAriaLabel = ariaLabel || ariaLabelledby;
      
      if (!hasLabel && !hasAriaLabel) {
        inputsWithoutLabels++;
      }
    });

    if (inputsWithoutLabels > 0) {
      score -= Math.min(20, inputsWithoutLabels * 4);
      issues.push(`${inputsWithoutLabels} form input(s) without proper labels`);
      suggestions.push('Add labels or aria-label attributes to all form inputs');
    }

    // Check for semantic HTML elements
    const semanticElements = ['main', 'nav', 'header', 'footer', 'article', 'section', 'aside'];
    const usedSemanticElements = semanticElements.filter(element => $(element).length > 0);
    
    if (usedSemanticElements.length < 3) {
      score -= 10;
      issues.push('Limited use of semantic HTML elements');
      suggestions.push('Use semantic HTML5 elements (main, nav, header, footer, article, section)');
    }

    // Check for ARIA landmarks
    const ariaLandmarks = $('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]');
    if (ariaLandmarks.length === 0 && usedSemanticElements.length < 2) {
      score -= 8;
      suggestions.push('Add ARIA landmarks or use semantic HTML elements for better navigation');
    }

    // Check for color contrast indicators (basic check)
    const hasColorOnlyInfo = this.checkColorOnlyInformation($);
    if (hasColorOnlyInfo) {
      score -= 5;
      issues.push('Content may rely on color alone to convey information');
      suggestions.push('Ensure information is not conveyed by color alone');
    }

    // Check for keyboard navigation support
    const focusableElements = $('a, button, input, select, textarea, [tabindex]');
    let elementsWithoutFocus = 0;

    focusableElements.each((_, element) => {
      const tabindex = $(element).attr('tabindex');
      if (tabindex === '-1') {
        elementsWithoutFocus++;
      }
    });

    if (elementsWithoutFocus > focusableElements.length * 0.5) {
      score -= 10;
      issues.push('Many interactive elements may not be keyboard accessible');
      suggestions.push('Ensure all interactive elements are keyboard accessible');
    }

    // Check for skip links
    const skipLinks = $('a[href^="#"]').filter((_, element) => {
      const text = $(element).text().toLowerCase();
      return text.includes('skip') && (text.includes('content') || text.includes('main'));
    });

    if (skipLinks.length === 0) {
      score -= 5;
      suggestions.push('Add skip links for better keyboard navigation');
    }

    // Check for language declaration
    const htmlLang = $('html').attr('lang');
    if (!htmlLang) {
      score -= 8;
      issues.push('Missing language declaration on HTML element');
      suggestions.push('Add lang attribute to HTML element (e.g., <html lang="en">)');
    }

    // Check for page title
    const title = $('title').text().trim();
    if (!title) {
      score -= 15;
      issues.push('Missing page title');
      suggestions.push('Add a descriptive page title');
    }

    return {
      score: Math.max(0, Math.round(score)),
      issues,
      suggestions
    };
  }

  /**
   * Checks if content relies on color alone to convey information
   */
  private checkColorOnlyInformation($: cheerio.CheerioAPI): boolean {
    // Basic heuristic check for color-only information
    const colorWords = ['red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown', 'gray', 'grey'];
    const bodyText = $('body').text().toLowerCase();
    
    // Look for phrases that might indicate color-only information
    const colorOnlyPatterns = [
      /click.*red.*button/,
      /green.*indicates/,
      /red.*means/,
      /see.*blue.*link/
    ];

    return colorOnlyPatterns.some(pattern => pattern.test(bodyText));
  }

  /**
   * Checks if URL path segments follow logical hierarchy
   */
  private checkLogicalHierarchy(pathSegments: string[]): boolean {
    // Basic check for logical hierarchy
    // This is a simplified heuristic - in practice, this would need domain-specific logic
    
    // Check if segments get more specific (longer or more detailed)
    for (let i = 1; i < pathSegments.length; i++) {
      const current = pathSegments[i];
      const previous = pathSegments[i - 1];
      
      // Very basic check - this could be enhanced with more sophisticated logic
      if (current.length < previous.length - 5) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Extracts result from Promise.allSettled result
   */
  private extractResult<T>(result: PromiseSettledResult<T>, fallback: T): T {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      logger.warn('Structure analysis step failed, using fallback', { 
        error: result.reason?.message || 'Unknown error' 
      });
      return fallback;
    }
  }
}