import * as cheerio from 'cheerio';
import axios from 'axios';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/ErrorHandler';
import { 
  ContentSEOResult, 
  QualityScore, 
  AnalysisConfig,
  ParsingError 
} from '@shared/types';

export class ContentSEOAnalyzer {
  private errorHandler: ErrorHandler;
  private readonly userAgent = 'SEO-GEO-Health-Checker/1.0 (compatible; analysis bot)';

  constructor() {
    this.errorHandler = new ErrorHandler();
  }

  /**
   * Analyzes content SEO factors for a given URL
   */
  async analyzeContentSEO(url: string, config: AnalysisConfig): Promise<ContentSEOResult> {
    logger.info('Starting content SEO analysis', { url });

    try {
      // Fetch page content
      const html = await this.fetchPageContent(url);
      const $ = cheerio.load(html);

      // Run parallel content analyses
      const [
        titleTagResult,
        metaDescriptionResult,
        headingStructureResult,
        keywordOptimizationResult,
        contentLengthResult
      ] = await Promise.allSettled([
        this.analyzeTitleTag($, url),
        this.analyzeMetaDescription($, url),
        this.analyzeHeadingStructure($, url),
        this.analyzeKeywordOptimization($, url, config),
        this.analyzeContentLength($, config)
      ]);

      const result: ContentSEOResult = {
        titleTag: this.extractResult(titleTagResult, {
          score: 0,
          issues: ['Analysis failed'],
          suggestions: ['Retry analysis']
        }),
        metaDescription: this.extractResult(metaDescriptionResult, {
          score: 0,
          issues: ['Analysis failed'],
          suggestions: ['Retry analysis']
        }),
        headingStructure: this.extractResult(headingStructureResult, {
          score: 0,
          issues: ['Analysis failed'],
          suggestions: ['Retry analysis']
        }),
        keywordOptimization: this.extractResult(keywordOptimizationResult, {
          score: 0,
          issues: ['Analysis failed'],
          suggestions: ['Retry analysis']
        }),
        contentLength: this.extractResult(contentLengthResult, 0)
      };

      logger.info('Content SEO analysis completed', {
        url,
        titleScore: result.titleTag.score,
        metaScore: result.metaDescription.score,
        headingScore: result.headingStructure.score,
        contentLength: result.contentLength
      });

      return result;

    } catch (error) {
      logger.error('Content SEO analysis failed', { url, error });
      throw this.errorHandler.createParsingError(
        url,
        error instanceof Error ? error : new Error('Content SEO analysis failed')
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
   * Analyzes title tag optimization
   */
  private async analyzeTitleTag($: cheerio.CheerioAPI, url: string): Promise<QualityScore> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Get title tag
    const titleElement = $('title').first();
    const title = titleElement.text().trim();

    // Check if title exists
    if (!title) {
      score = 0;
      issues.push('Missing title tag');
      suggestions.push('Add a descriptive title tag to your page');
      return { score, issues, suggestions };
    }

    // Check title length
    if (title.length < 30) {
      score -= 20;
      issues.push('Title tag is too short (less than 30 characters)');
      suggestions.push('Expand your title to 50-60 characters for better SEO');
    } else if (title.length > 60) {
      score -= 15;
      issues.push('Title tag is too long (more than 60 characters)');
      suggestions.push('Shorten your title to 50-60 characters to prevent truncation');
    }

    // Check for duplicate words
    const words = title.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    if (words.length - uniqueWords.size > 2) {
      score -= 10;
      issues.push('Title contains too many duplicate words');
      suggestions.push('Remove duplicate words to make the title more concise');
    }

    // Check for keyword stuffing (basic detection)
    const wordCounts = words.reduce((acc, word) => {
      if (word.length > 3) { // Only count meaningful words
        acc[word] = (acc[word] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const maxWordCount = Math.max(...Object.values(wordCounts));
    if (maxWordCount > 3) {
      score -= 15;
      issues.push('Possible keyword stuffing detected in title');
      suggestions.push('Use keywords naturally and avoid repetition');
    }

    // Check for brand name (heuristic)
    const domain = new URL(url).hostname.replace('www.', '');
    const brandName = domain.split('.')[0];
    const hasBrand = title.toLowerCase().includes(brandName.toLowerCase());
    
    if (!hasBrand && title.length < 50) {
      score -= 5;
      suggestions.push(`Consider including your brand name "${brandName}" in the title`);
    }

    // Check for action words or emotional triggers
    const actionWords = ['buy', 'get', 'learn', 'discover', 'find', 'best', 'top', 'guide', 'how', 'why', 'what'];
    const hasActionWord = actionWords.some(word => 
      title.toLowerCase().includes(word)
    );

    if (!hasActionWord) {
      score -= 5;
      suggestions.push('Consider adding action words or emotional triggers to make the title more compelling');
    }

    // Check for special characters that might cause issues
    const problematicChars = /[<>"|{}]/;
    if (problematicChars.test(title)) {
      score -= 10;
      issues.push('Title contains problematic characters');
      suggestions.push('Remove special characters like <, >, ", |, {, } from the title');
    }

    return {
      score: Math.max(0, Math.round(score)),
      issues,
      suggestions
    };
  }

  /**
   * Analyzes meta description optimization
   */
  private async analyzeMetaDescription($: cheerio.CheerioAPI, url: string): Promise<QualityScore> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Get meta description
    const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';

    // Check if meta description exists
    if (!metaDesc) {
      score = 0;
      issues.push('Missing meta description');
      suggestions.push('Add a compelling meta description to improve click-through rates');
      return { score, issues, suggestions };
    }

    // Check meta description length
    if (metaDesc.length < 120) {
      score -= 15;
      issues.push('Meta description is too short (less than 120 characters)');
      suggestions.push('Expand your meta description to 150-160 characters');
    } else if (metaDesc.length > 160) {
      score -= 10;
      issues.push('Meta description is too long (more than 160 characters)');
      suggestions.push('Shorten your meta description to 150-160 characters to prevent truncation');
    }

    // Check for duplicate meta descriptions (basic check against title)
    const title = $('title').text().trim().toLowerCase();
    if (title && metaDesc.toLowerCase() === title) {
      score -= 20;
      issues.push('Meta description is identical to title tag');
      suggestions.push('Create a unique meta description that complements the title');
    }

    // Check for call-to-action
    const ctaWords = ['learn', 'discover', 'find', 'get', 'buy', 'download', 'try', 'start', 'join', 'sign up'];
    const hasCTA = ctaWords.some(word => 
      metaDesc.toLowerCase().includes(word)
    );

    if (!hasCTA) {
      score -= 5;
      suggestions.push('Consider adding a call-to-action to encourage clicks');
    }

    // Check for keyword stuffing
    const words = metaDesc.toLowerCase().split(/\s+/);
    const wordCounts = words.reduce((acc, word) => {
      if (word.length > 3) {
        acc[word] = (acc[word] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const maxWordCount = Math.max(...Object.values(wordCounts));
    if (maxWordCount > 3) {
      score -= 15;
      issues.push('Possible keyword stuffing in meta description');
      suggestions.push('Use keywords naturally in the meta description');
    }

    // Check for compelling language
    const compellingWords = ['amazing', 'best', 'top', 'ultimate', 'complete', 'comprehensive', 'expert', 'proven'];
    const hasCompellingWord = compellingWords.some(word => 
      metaDesc.toLowerCase().includes(word)
    );

    if (!hasCompellingWord) {
      score -= 3;
      suggestions.push('Consider using compelling adjectives to make the description more attractive');
    }

    // Check for proper sentence structure
    const sentences = metaDesc.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 1 && metaDesc.length > 100) {
      score -= 5;
      suggestions.push('Consider breaking long descriptions into multiple sentences for better readability');
    }

    return {
      score: Math.max(0, Math.round(score)),
      issues,
      suggestions
    };
  }

  /**
   * Analyzes heading structure (H1-H6)
   */
  private async analyzeHeadingStructure($: cheerio.CheerioAPI, url: string): Promise<QualityScore> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Get all headings
    const headings = {
      h1: $('h1'),
      h2: $('h2'),
      h3: $('h3'),
      h4: $('h4'),
      h5: $('h5'),
      h6: $('h6')
    };

    // Check H1 tag
    if (headings.h1.length === 0) {
      score -= 30;
      issues.push('Missing H1 tag');
      suggestions.push('Add an H1 tag that describes the main topic of the page');
    } else if (headings.h1.length > 1) {
      score -= 20;
      issues.push(`Multiple H1 tags found (${headings.h1.length})`);
      suggestions.push('Use only one H1 tag per page for better SEO');
    } else {
      // Analyze H1 content
      const h1Text = headings.h1.first().text().trim();
      
      if (h1Text.length < 20) {
        score -= 10;
        issues.push('H1 tag is too short');
        suggestions.push('Make your H1 more descriptive (20-70 characters recommended)');
      } else if (h1Text.length > 70) {
        score -= 5;
        issues.push('H1 tag is quite long');
        suggestions.push('Consider shortening your H1 for better readability');
      }

      // Check if H1 is similar to title
      const title = $('title').text().trim();
      if (title && this.calculateSimilarity(h1Text.toLowerCase(), title.toLowerCase()) > 0.8) {
        score -= 5;
        suggestions.push('Consider making H1 slightly different from the title tag');
      }
    }

    // Check heading hierarchy
    const headingLevels = [1, 2, 3, 4, 5, 6];
    let previousLevel = 0;
    let hierarchyIssues = 0;

    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const tagName = element.tagName.toLowerCase();
      const currentLevel = parseInt(tagName.charAt(1));
      
      if (previousLevel > 0 && currentLevel > previousLevel + 1) {
        hierarchyIssues++;
      }
      
      previousLevel = currentLevel;
    });

    if (hierarchyIssues > 0) {
      score -= Math.min(15, hierarchyIssues * 5);
      issues.push('Heading hierarchy is not properly structured');
      suggestions.push('Use headings in sequential order (H1 → H2 → H3, etc.)');
    }

    // Check for empty headings
    let emptyHeadings = 0;
    Object.entries(headings).forEach(([level, elements]) => {
      elements.each((_, element) => {
        if (!$(element).text().trim()) {
          emptyHeadings++;
        }
      });
    });

    if (emptyHeadings > 0) {
      score -= emptyHeadings * 10;
      issues.push(`${emptyHeadings} empty heading(s) found`);
      suggestions.push('Remove empty headings or add descriptive text');
    }

    // Check heading distribution
    const totalHeadings = Object.values(headings).reduce((sum, h) => sum + h.length, 0);
    const contentLength = $('body').text().length;
    
    if (contentLength > 1000 && totalHeadings < 3) {
      score -= 10;
      issues.push('Long content with few headings');
      suggestions.push('Add more headings to break up long content and improve readability');
    }

    // Check for keyword usage in headings (basic analysis)
    const title = $('title').text().trim().toLowerCase();
    const titleWords = title.split(/\s+/).filter(word => word.length > 3);
    
    if (titleWords.length > 0) {
      const headingTexts = Object.values(headings)
        .map(h => h.map((_, el) => $(el).text().toLowerCase()).get())
        .flat();
      
      const keywordUsage = titleWords.some(word => 
        headingTexts.some(heading => heading.includes(word))
      );
      
      if (!keywordUsage) {
        score -= 5;
        suggestions.push('Consider using relevant keywords from your title in headings');
      }
    }

    return {
      score: Math.max(0, Math.round(score)),
      issues,
      suggestions
    };
  }

  /**
   * Analyzes keyword optimization
   */
  private async analyzeKeywordOptimization($: cheerio.CheerioAPI, url: string, config: AnalysisConfig): Promise<QualityScore> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Extract main content (excluding navigation, footer, etc.)
    const mainContent = this.extractMainContent($);
    const title = $('title').text().trim();
    const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';

    // Extract potential keywords from title
    const titleKeywords = this.extractKeywords(title);
    
    if (titleKeywords.length === 0) {
      score -= 20;
      issues.push('No clear keywords identified in title');
      suggestions.push('Include relevant keywords in your title tag');
      return { score, issues, suggestions };
    }

    // Analyze keyword density
    const keywordAnalysis = this.analyzeKeywordDensity(mainContent, titleKeywords);
    
    // Check keyword density (2-4% is generally good)
    Object.entries(keywordAnalysis).forEach(([keyword, data]) => {
      if (data.density < 0.5) {
        score -= 5;
        suggestions.push(`Consider using "${keyword}" more frequently in your content`);
      } else if (data.density > 5) {
        score -= 15;
        issues.push(`Keyword "${keyword}" may be over-optimized (${data.density.toFixed(1)}% density)`);
        suggestions.push(`Reduce usage of "${keyword}" to avoid keyword stuffing`);
      }
    });

    // Check keyword placement
    const h1Text = $('h1').first().text().toLowerCase();
    const hasKeywordInH1 = titleKeywords.some(keyword => 
      h1Text.includes(keyword.toLowerCase())
    );
    
    if (!hasKeywordInH1) {
      score -= 10;
      suggestions.push('Include your main keyword in the H1 tag');
    }

    // Check keyword in meta description
    const hasKeywordInMeta = titleKeywords.some(keyword => 
      metaDesc.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (!hasKeywordInMeta && metaDesc) {
      score -= 5;
      suggestions.push('Include your main keyword in the meta description');
    }

    // Check for keyword variations and synonyms
    const hasVariations = this.checkKeywordVariations(mainContent, titleKeywords);
    if (!hasVariations) {
      score -= 5;
      suggestions.push('Use keyword variations and synonyms to improve content richness');
    }

    // Check content length vs keyword optimization
    const wordCount = mainContent.split(/\s+/).length;
    if (wordCount < config.thresholds.contentLengthMin) {
      score -= 15;
      issues.push(`Content is too short (${wordCount} words)`);
      suggestions.push(`Expand content to at least ${config.thresholds.contentLengthMin} words for better keyword optimization`);
    }

    // Check for LSI (Latent Semantic Indexing) keywords
    const hasLSIKeywords = this.checkLSIKeywords(mainContent, titleKeywords);
    if (!hasLSIKeywords) {
      score -= 5;
      suggestions.push('Include related terms and concepts to improve topical relevance');
    }

    return {
      score: Math.max(0, Math.round(score)),
      issues,
      suggestions
    };
  }

  /**
   * Analyzes content length
   */
  private async analyzeContentLength($: cheerio.CheerioAPI, config: AnalysisConfig): Promise<number> {
    const mainContent = this.extractMainContent($);
    const wordCount = mainContent.split(/\s+/).filter(word => word.length > 0).length;
    
    logger.debug('Content length analysis', { wordCount });
    
    return wordCount;
  }

  /**
   * Extracts main content from the page (excluding navigation, footer, etc.)
   */
  private extractMainContent($: cheerio.CheerioAPI): string {
    // Remove unwanted elements
    $('script, style, nav, footer, header, aside, .navigation, .menu, .sidebar').remove();
    
    // Try to find main content area
    const mainSelectors = ['main', 'article', '.content', '.main-content', '#content', '#main'];
    
    for (const selector of mainSelectors) {
      const element = $(selector);
      if (element.length > 0 && element.text().trim().length > 100) {
        return element.text().trim();
      }
    }
    
    // Fallback to body content
    return $('body').text().trim();
  }

  /**
   * Extracts keywords from text
   */
  private extractKeywords(text: string): string[] {
    if (!text) return [];
    
    // Simple keyword extraction (remove stop words and short words)
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
    ]);
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    // Return most frequent words as potential keywords
    const wordCounts = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Analyzes keyword density in content
   */
  private analyzeKeywordDensity(content: string, keywords: string[]): Record<string, { count: number; density: number }> {
    const words = content.toLowerCase().split(/\s+/);
    const totalWords = words.length;
    
    return keywords.reduce((acc, keyword) => {
      const count = words.filter(word => word.includes(keyword)).length;
      const density = totalWords > 0 ? (count / totalWords) * 100 : 0;
      
      acc[keyword] = { count, density };
      return acc;
    }, {} as Record<string, { count: number; density: number }>);
  }

  /**
   * Checks for keyword variations
   */
  private checkKeywordVariations(content: string, keywords: string[]): boolean {
    const contentLower = content.toLowerCase();
    
    // Simple check for plural forms and common variations
    return keywords.some(keyword => {
      const variations = [
        keyword + 's',
        keyword + 'es',
        keyword + 'ing',
        keyword + 'ed',
        keyword.replace(/y$/, 'ies')
      ];
      
      return variations.some(variation => contentLower.includes(variation));
    });
  }

  /**
   * Checks for LSI (related) keywords
   */
  private checkLSIKeywords(content: string, keywords: string[]): boolean {
    const contentLower = content.toLowerCase();
    
    // Simple LSI keyword detection based on common related terms
    const lsiPatterns = [
      /how to/,
      /what is/,
      /why/,
      /when/,
      /where/,
      /benefits/,
      /advantages/,
      /tips/,
      /guide/,
      /tutorial/
    ];
    
    return lsiPatterns.some(pattern => pattern.test(contentLower));
  }

  /**
   * Calculates similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Extracts result from Promise.allSettled result
   */
  private extractResult<T>(result: PromiseSettledResult<T>, fallback: T): T {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      logger.warn('Content analysis step failed, using fallback', { 
        error: result.reason?.message || 'Unknown error' 
      });
      return fallback;
    }
  }
}