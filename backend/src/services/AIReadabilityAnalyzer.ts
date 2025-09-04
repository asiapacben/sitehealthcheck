import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';
import { 
  ReadabilityResult, 
  QualityScore,
  AnalysisConfig 
} from '../../../shared/types';

export class AIReadabilityAnalyzer {
  
  /**
   * Analyzes content for AI readability and optimization
   */
  async analyzeAIReadability(html: string, url: string, config: AnalysisConfig): Promise<ReadabilityResult> {
    logger.info('Starting AI readability analysis', { url });

    try {
      const $ = cheerio.load(html);
      
      // Extract main content text
      const content = this.extractMainContent($);
      
      // Run parallel analyses
      const [
        contentClarity,
        questionAnswerFormat,
        informationHierarchy,
        topicCoverage
      ] = await Promise.all([
        this.analyzeContentClarity(content, $),
        this.detectQuestionAnswerFormat(content, $),
        this.analyzeInformationHierarchy($),
        this.analyzeTopicCoverage(content, $)
      ]);

      const result: ReadabilityResult = {
        contentClarity,
        questionAnswerFormat,
        informationHierarchy,
        topicCoverage
      };

      logger.info('AI readability analysis completed', {
        url,
        contentClarityScore: contentClarity.score,
        hasQAFormat: questionAnswerFormat,
        hierarchyScore: informationHierarchy.score,
        topicScore: topicCoverage.score
      });

      return result;

    } catch (error) {
      logger.error('AI readability analysis failed', { url, error });
      throw new Error(`AI readability analysis failed for ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } 
 /**
   * Extracts main content from HTML, filtering out navigation, ads, etc.
   */
  private extractMainContent($: cheerio.Root): string {
    // Remove non-content elements
    $('script, style, nav, header, footer, aside, .advertisement, .ads, .sidebar').remove();
    
    // Try to find main content area
    let content = '';
    
    // Look for semantic main content
    const mainSelectors = [
      'main',
      'article', 
      '[role="main"]',
      '.content',
      '.main-content',
      '.post-content',
      '.entry-content',
      '#content',
      '#main'
    ];

    for (const selector of mainSelectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > 200) {
        content = element.text().trim();
        break;
      }
    }

    // Fallback to body content if no main content found
    if (!content) {
      content = $('body').text().trim();
    }

    return content;
  }

  /**
   * Analyzes content clarity using readability formulas and NLP techniques
   */
  private async analyzeContentClarity(content: string, $: cheerio.Root): Promise<QualityScore> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Basic content length check
    if (content.length < 50) {
      return {
        score: 0,
        issues: ['Content is too short for meaningful analysis'],
        suggestions: ['Add more detailed content (aim for at least 300 words)']
      };
    }
    
    if (content.length < 300) {
      score -= 20;
      issues.push('Content is too short for meaningful analysis');
      suggestions.push('Add more detailed content (aim for at least 300 words)');
    }

    // Calculate readability metrics
    const readabilityMetrics = this.calculateReadabilityMetrics(content);
    
    // Flesch Reading Ease Score (0-100, higher is better)
    if (readabilityMetrics.fleschScore < 30) {
      score -= 25;
      issues.push('Content is very difficult to read');
      suggestions.push('Simplify sentence structure and use shorter words');
    } else if (readabilityMetrics.fleschScore < 50) {
      score -= 15;
      issues.push('Content is somewhat difficult to read');
      suggestions.push('Consider simplifying complex sentences');
    }

    // Average sentence length
    if (readabilityMetrics.avgSentenceLength > 25) {
      score -= 15;
      issues.push('Sentences are too long on average');
      suggestions.push('Break down long sentences into shorter, clearer ones');
    }

    // Paragraph structure analysis
    const paragraphAnalysis = this.analyzeParagraphStructure($);
    if (paragraphAnalysis.avgParagraphLength > 150) {
      score -= 10;
      issues.push('Paragraphs are too long');
      suggestions.push('Break long paragraphs into smaller, focused sections');
    }

    // Check for clear structure indicators
    const structureScore = this.analyzeContentStructure($);
    if (structureScore < 50) {
      score -= 15;
      issues.push('Content lacks clear structure');
      suggestions.push('Add more headings, bullet points, and clear sections');
    } else if (structureScore >= 80) {
      score += 5; // Bonus for excellent structure
    }

    // Vocabulary complexity
    if (readabilityMetrics.complexWordRatio > 0.15) {
      score -= 10;
      issues.push('High ratio of complex words');
      suggestions.push('Replace complex words with simpler alternatives where possible');
    }

    return {
      score: Math.max(0, Math.round(score)),
      issues,
      suggestions
    };
  }  /**

   * Calculates various readability metrics
   */
  private calculateReadabilityMetrics(content: string) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.trim().length > 0);
    const syllables = words.reduce((total, word) => total + this.countSyllables(word), 0);
    
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;
    
    // Flesch Reading Ease Score
    const fleschScore = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    
    // Complex words (3+ syllables)
    const complexWords = words.filter(word => this.countSyllables(word) >= 3);
    const complexWordRatio = complexWords.length / words.length;

    return {
      fleschScore: Math.max(0, Math.min(100, fleschScore)),
      avgSentenceLength,
      avgSyllablesPerWord,
      complexWordRatio,
      totalWords: words.length,
      totalSentences: sentences.length
    };
  }

  /**
   * Counts syllables in a word (simplified algorithm)
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    // Remove common endings that don't add syllables
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    
    // Count vowel groups
    const matches = word.match(/[aeiouy]{1,2}/g);
    const syllables = matches ? matches.length : 1;
    
    return Math.max(1, syllables);
  }

  /**
   * Analyzes paragraph structure
   */
  private analyzeParagraphStructure($: cheerio.Root) {
    const paragraphs = $('p').toArray();
    const paragraphLengths = paragraphs.map(p => $(p).text().trim().length).filter(len => len > 0);
    
    const avgParagraphLength = paragraphLengths.length > 0 
      ? paragraphLengths.reduce((sum, len) => sum + len, 0) / paragraphLengths.length 
      : 0;

    return {
      paragraphCount: paragraphLengths.length,
      avgParagraphLength,
      maxParagraphLength: Math.max(...paragraphLengths, 0),
      minParagraphLength: Math.min(...paragraphLengths, 0)
    };
  }

  /**
   * Analyzes content structure for clarity
   */
  private analyzeContentStructure($: cheerio.Root): number {
    let score = 0;
    
    // Check for headings
    const headings = $('h1, h2, h3, h4, h5, h6').length;
    if (headings > 0) score += 30;
    if (headings >= 3) score += 20;
    
    // Check for lists
    const lists = $('ul, ol').length;
    if (lists > 0) score += 20;
    
    // Check for emphasis and formatting
    const emphasis = $('strong, b, em, i').length;
    if (emphasis > 0) score += 15;
    
    // Check for logical structure indicators
    const structureWords = ['first', 'second', 'third', 'finally', 'conclusion', 'summary', 'introduction'];
    const content = $('body').text().toLowerCase();
    const structureWordCount = structureWords.filter(word => content.includes(word)).length;
    score += Math.min(15, structureWordCount * 3);
    
    return Math.min(100, score);
  }  
/**
   * Detects question-answer format usage
   */
  private async detectQuestionAnswerFormat(content: string, $: cheerio.Root): Promise<boolean> {
    // Look for question patterns
    const questionPatterns = [
      /\?/g, // Direct questions
      /^(what|how|why|when|where|who|which|can|could|should|would|will|is|are|do|does|did)/im,
      /\b(faq|frequently asked|common questions|q&a|question|answer)\b/i
    ];

    let questionCount = 0;
    
    // Count questions in content
    const questionMarks = (content.match(/\?/g) || []).length;
    questionCount += questionMarks;
    
    // Look for FAQ sections
    const faqElements = $('*').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('faq') || text.includes('frequently asked') || text.includes('questions');
    });
    
    if (faqElements.length > 0) questionCount += 10;
    
    // Look for structured Q&A patterns
    const headings = $('h1, h2, h3, h4, h5, h6').toArray();
    let qaPatternCount = 0;
    
    headings.forEach(heading => {
      const headingText = $(heading).text().toLowerCase();
      if (headingText.includes('?') || 
          headingText.match(/^(what|how|why|when|where|who|which)/)) {
        qaPatternCount++;
      }
    });
    
    // Check for definition lists or structured answers
    const definitionLists = $('dl, dt, dd').length;
    if (definitionLists > 0) qaPatternCount += 5;
    
    // Consider it Q&A format if there are enough indicators
    return questionCount >= 3 || qaPatternCount >= 2;
  }

  /**
   * Analyzes information hierarchy and logical flow
   */
  private async analyzeInformationHierarchy($: cheerio.Root): Promise<QualityScore> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Analyze heading structure
    const headingAnalysis = this.analyzeHeadingHierarchy($);
    
    if (headingAnalysis.hasH1 === false) {
      score -= 25;
      issues.push('Missing main heading (H1)');
      suggestions.push('Add a clear main heading (H1) to establish the page topic');
    }
    
    if (headingAnalysis.multipleH1 > 1) {
      score -= 15;
      issues.push('Multiple H1 headings found');
      suggestions.push('Use only one H1 heading per page');
    }
    
    if (headingAnalysis.hierarchyBreaks > 0) {
      score -= 20;
      issues.push('Heading hierarchy has gaps (e.g., H2 followed by H4)');
      suggestions.push('Maintain proper heading hierarchy (H1 → H2 → H3, etc.)');
    }
    
    if (headingAnalysis.totalHeadings === 0) {
      score -= 30;
      issues.push('No headings found');
      suggestions.push('Add headings to structure your content clearly');
    } else if (headingAnalysis.totalHeadings < 3) {
      score -= 10;
      issues.push('Very few headings for content structure');
      suggestions.push('Add more headings to break up content into logical sections');
    } else if (headingAnalysis.totalHeadings >= 4) {
      score += 5; // Bonus for good heading structure
    }

    // Analyze content organization
    const organizationScore = this.analyzeContentOrganization($);
    if (organizationScore < 50) {
      score -= 10;
      issues.push('Content lacks clear organization');
      suggestions.push('Organize content with clear introduction, body, and conclusion');
    } else if (organizationScore >= 80) {
      score += 5; // Bonus for excellent organization
    }

    // Check for logical flow indicators
    const flowScore = this.analyzeLogicalFlow($);
    if (flowScore < 40) {
      score -= 5;
      issues.push('Content lacks logical flow indicators');
      suggestions.push('Use transition words and logical connectors between sections');
    } else if (flowScore >= 70) {
      score += 5; // Bonus for excellent flow
    }

    return {
      score: Math.max(0, Math.round(score)),
      issues,
      suggestions
    };
  }  /**

   * Analyzes heading hierarchy structure
   */
  private analyzeHeadingHierarchy($: cheerio.Root) {
    const headings = $('h1, h2, h3, h4, h5, h6').toArray();
    const headingLevels = headings.map(h => {
      const element = h as any;
      return parseInt(element.name ? element.name.charAt(1) : '1');
    });
    
    const h1Count = headingLevels.filter(level => level === 1).length;
    let hierarchyBreaks = 0;
    
    // Check for hierarchy breaks
    for (let i = 1; i < headingLevels.length; i++) {
      const current = headingLevels[i];
      const previous = headingLevels[i - 1];
      
      // If jumping more than one level (e.g., H2 to H4)
      if (current > previous + 1) {
        hierarchyBreaks++;
      }
    }

    return {
      hasH1: h1Count > 0,
      multipleH1: h1Count,
      totalHeadings: headings.length,
      hierarchyBreaks,
      headingLevels
    };
  }

  /**
   * Analyzes content organization patterns
   */
  private analyzeContentOrganization($: cheerio.Root): number {
    let score = 0;
    const content = $('body').text().toLowerCase();
    
    // Look for introduction patterns
    const introPatterns = ['introduction', 'overview', 'summary', 'in this article', 'this guide'];
    if (introPatterns.some(pattern => content.includes(pattern))) {
      score += 25;
    }
    
    // Look for conclusion patterns
    const conclusionPatterns = ['conclusion', 'summary', 'in conclusion', 'to summarize', 'finally'];
    if (conclusionPatterns.some(pattern => content.includes(pattern))) {
      score += 25;
    }
    
    // Check for numbered or bulleted lists
    const lists = $('ul, ol, li').length;
    if (lists > 0) score += 20;
    
    // Check for clear sections
    const sections = $('section, div.section, .content-section').length;
    if (sections > 0) score += 15;
    
    // Check for table of contents or navigation
    const tocElements = $('*').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('table of contents') || text.includes('contents') || $(el).hasClass('toc');
    });
    if (tocElements.length > 0) score += 15;
    
    return Math.min(100, score);
  }

  /**
   * Analyzes logical flow and transitions
   */
  private analyzeLogicalFlow($: cheerio.Root): number {
    const content = $('body').text().toLowerCase();
    
    // Transition words and phrases that indicate logical flow
    const transitionWords = [
      'however', 'therefore', 'furthermore', 'moreover', 'additionally',
      'consequently', 'meanwhile', 'subsequently', 'nevertheless', 'nonetheless',
      'first', 'second', 'third', 'next', 'then', 'finally',
      'for example', 'for instance', 'in contrast', 'on the other hand',
      'as a result', 'in conclusion', 'to summarize'
    ];
    
    const foundTransitions = transitionWords.filter(word => content.includes(word));
    const transitionScore = Math.min(60, foundTransitions.length * 5);
    
    // Look for numbered steps or processes
    const stepPatterns = /step \d+|phase \d+|\d+\./g;
    const stepMatches = content.match(stepPatterns) || [];
    const stepScore = Math.min(40, stepMatches.length * 10);
    
    return transitionScore + stepScore;
  }  /**

   * Analyzes topic coverage and completeness
   */
  private async analyzeTopicCoverage(content: string, $: cheerio.Root): Promise<QualityScore> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Extract potential topic from title and headings
    const title = $('title').text() || $('h1').first().text() || '';
    const topic = this.extractMainTopic(title, content);
    
    // Analyze content depth
    const depthAnalysis = this.analyzeContentDepth(content, topic);
    
    if (depthAnalysis.wordCount < 200) {
      score -= 30;
      issues.push('Content is too brief for comprehensive topic coverage');
      suggestions.push('Expand content to provide more comprehensive coverage of the topic');
    } else if (depthAnalysis.wordCount < 500) {
      score -= 15;
      issues.push('Content could be more comprehensive');
      suggestions.push('Consider expanding content to provide more detailed coverage');
    }
    
    if (depthAnalysis.topicMentions < 2) {
      score -= 15;
      issues.push('Main topic is not sufficiently reinforced throughout content');
      suggestions.push('Ensure the main topic is mentioned and developed throughout the content');
    }
    
    // Check for supporting details
    const supportingElements = this.analyzeSupportingElements($);
    
    if (supportingElements.examples < 1) {
      score -= 10;
      issues.push('Lacks concrete examples or case studies');
      suggestions.push('Add specific examples to illustrate key points');
    }
    
    if (supportingElements.statistics < 1) {
      score -= 5;
      issues.push('No supporting data or statistics found');
      suggestions.push('Include relevant data, statistics, or research to support claims');
    }
    
    // Check for comprehensive coverage indicators
    const coverageScore = this.analyzeCoverageCompleteness(content, $);
    if (coverageScore < 40) {
      score -= 15;
      issues.push('Topic coverage appears incomplete');
      suggestions.push('Consider adding sections on related subtopics or common questions');
    } else if (coverageScore >= 80) {
      score += 10; // Bonus for comprehensive coverage
    }
    
    // Check for actionable information
    const actionabilityScore = this.analyzeActionability(content, $);
    if (actionabilityScore < 30) {
      score -= 5;
      issues.push('Content lacks actionable information');
      suggestions.push('Include practical steps, tips, or actionable advice');
    } else if (actionabilityScore >= 70) {
      score += 10; // Bonus for highly actionable content
    }

    return {
      score: Math.max(0, Math.round(score)),
      issues,
      suggestions
    };
  }

  /**
   * Extracts the main topic from title and content
   */
  private extractMainTopic(title: string, content: string): string {
    // Simple topic extraction - in a real implementation, this could use NLP
    const words = title.toLowerCase().split(/\s+/).filter(word => 
      word.length > 3 && 
      !['the', 'and', 'for', 'with', 'how', 'what', 'why', 'when', 'where'].includes(word)
    );
    
    return words[0] || 'topic';
  }

  /**
   * Analyzes content depth and topic reinforcement
   */
  private analyzeContentDepth(content: string, topic: string) {
    const words = content.split(/\s+/).filter(w => w.trim().length > 0);
    const topicMentions = content.toLowerCase().split(topic.toLowerCase()).length - 1;
    
    return {
      wordCount: words.length,
      topicMentions,
      uniqueWords: new Set(words.map(w => w.toLowerCase())).size
    };
  }

  /**
   * Analyzes supporting elements like examples and statistics
   */
  private analyzeSupportingElements($: cheerio.Root) {
    const content = $('body').text().toLowerCase();
    
    // Look for example indicators
    const examplePatterns = ['for example', 'for instance', 'such as', 'including', 'case study'];
    const examples = examplePatterns.filter(pattern => content.includes(pattern)).length;
    
    // Look for statistical indicators
    const statisticPatterns = [/\d+%/, /\d+\.\d+%/, /\$\d+/, /\d+ million/, /\d+ billion/, /according to/];
    const statistics = statisticPatterns.filter(pattern => content.match(pattern)).length;
    
    return { examples, statistics };
  }

  /**
   * Analyzes coverage completeness
   */
  private analyzeCoverageCompleteness(content: string, $: cheerio.Root): number {
    let score = 0;
    const contentLower = content.toLowerCase();
    
    // Look for comprehensive coverage indicators
    const coverageIndicators = [
      'benefits', 'advantages', 'disadvantages', 'pros', 'cons',
      'how to', 'steps', 'process', 'method', 'approach',
      'types', 'kinds', 'categories', 'examples',
      'best practices', 'tips', 'recommendations',
      'common mistakes', 'pitfalls', 'challenges'
    ];
    
    const foundIndicators = coverageIndicators.filter(indicator => 
      contentLower.includes(indicator)
    );
    
    score = Math.min(100, foundIndicators.length * 10);
    
    return score;
  }

  /**
   * Analyzes actionability of content
   */
  private analyzeActionability(content: string, $: cheerio.Root): number {
    let score = 0;
    const contentLower = content.toLowerCase();
    
    // Look for actionable language
    const actionWords = [
      'how to', 'step', 'follow', 'implement', 'apply', 'use',
      'create', 'build', 'make', 'do', 'start', 'begin',
      'try', 'consider', 'should', 'must', 'need to'
    ];
    
    const foundActions = actionWords.filter(word => contentLower.includes(word));
    score += Math.min(50, foundActions.length * 5);
    
    // Check for numbered lists or step-by-step content
    const numberedLists = $('ol').length;
    score += Math.min(30, numberedLists * 10);
    
    // Check for imperative sentences (commands/instructions)
    const sentences = content.split(/[.!?]+/);
    const imperativeSentences = sentences.filter(sentence => {
      const trimmed = sentence.trim().toLowerCase();
      return actionWords.some(word => trimmed.startsWith(word));
    });
    
    score += Math.min(20, imperativeSentences.length * 2);
    
    return Math.min(100, score);
  }
}