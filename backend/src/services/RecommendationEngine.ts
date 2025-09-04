import {
  AnalysisResults,
  Recommendation,
  SEOScore,
  GEOScore,
  QualityScore,
  TechnicalDetails
} from '../../../shared/types';

export interface RecommendationTemplate {
  id: string;
  category: 'SEO' | 'GEO' | 'Technical';
  condition: (results: AnalysisResults) => boolean;
  priority: 'High' | 'Medium' | 'Low';
  impact: number;
  effort: 'Easy' | 'Medium' | 'Hard';
  title: string;
  description: (results: AnalysisResults) => string;
  actionSteps: string[];
  example?: string;
  beforeAfterExample?: {
    before: string;
    after: string;
    explanation: string;
  };
}

export interface RecommendationContext {
  url: string;
  analysisType: string;
  timestamp: Date;
  userPreferences?: {
    prioritizeEasyWins?: boolean;
    focusArea?: 'SEO' | 'GEO' | 'Technical' | 'All';
    maxRecommendations?: number;
  };
}

export class RecommendationEngine {
  private templates: RecommendationTemplate[] = [];

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Generate actionable recommendations based on analysis results
   */
  generateRecommendations(
    results: AnalysisResults,
    context?: RecommendationContext
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Apply each template to generate recommendations
    for (const template of this.templates) {
      if (template.condition(results)) {
        const recommendation = this.createRecommendationFromTemplate(template, results);
        recommendations.push(recommendation);
      }
    }

    // Apply context-based filtering if provided
    let filteredRecommendations = recommendations;
    if (context?.userPreferences) {
      filteredRecommendations = this.applyUserPreferences(recommendations, context.userPreferences);
    }

    return this.prioritizeRecommendations(filteredRecommendations);
  }

  /**
   * Prioritize recommendations based on impact, effort, and priority
   */
  prioritizeRecommendations(recommendations: Recommendation[]): Recommendation[] {
    return recommendations.sort((a, b) => {
      // Calculate priority score combining multiple factors
      const scoreA = this.calculatePriorityScore(a);
      const scoreB = this.calculatePriorityScore(b);
      
      return scoreB - scoreA; // Higher score first
    });
  }

  /**
   * Get recommendations by category
   */
  getRecommendationsByCategory(
    recommendations: Recommendation[],
    category: 'SEO' | 'GEO' | 'Technical'
  ): Recommendation[] {
    return recommendations.filter(rec => rec.category === category);
  }

  /**
   * Get high-impact, easy-to-implement recommendations (quick wins)
   */
  getQuickWins(recommendations: Recommendation[]): Recommendation[] {
    return recommendations.filter(rec => 
      rec.impact >= 70 && rec.effort === 'Easy' && rec.priority === 'High'
    );
  }

  /**
   * Add custom recommendation template
   */
  addTemplate(template: RecommendationTemplate): void {
    this.templates.push(template);
  }

  /**
   * Remove recommendation template by ID
   */
  removeTemplate(templateId: string): void {
    this.templates = this.templates.filter(t => t.id !== templateId);
  }

  /**
   * Get all available templates
   */
  getTemplates(): RecommendationTemplate[] {
    return [...this.templates];
  }

  // Private helper methods

  private initializeTemplates(): void {
    // SEO Templates
    this.templates.push(...this.createSEOTemplates());
    
    // GEO Templates
    this.templates.push(...this.createGEOTemplates());
    
    // Technical Templates
    this.templates.push(...this.createTechnicalTemplates());
  }

  private createSEOTemplates(): RecommendationTemplate[] {
    return [
      {
        id: 'seo-page-speed-critical',
        category: 'SEO',
        condition: (results) => (results.seoScore?.details?.pageSpeed || 0) < 50,
        priority: 'High',
        impact: 95,
        effort: 'Medium',
        title: 'Critical Page Speed Issues',
        description: (results) => 
          `Page speed score is critically low at ${results.seoScore?.details?.pageSpeed || 0}/100. This severely impacts SEO rankings and user experience.`,
        actionSteps: [
          'Compress and optimize all images (aim for 80% size reduction)',
          'Minify CSS, JavaScript, and HTML files',
          'Enable Gzip compression on your server',
          'Implement browser caching with long expiry times',
          'Remove unused CSS and JavaScript',
          'Use a Content Delivery Network (CDN)',
          'Optimize server response time (aim for <200ms)'
        ],
        example: 'Use tools like TinyPNG for image compression and UglifyJS for JavaScript minification',
        beforeAfterExample: {
          before: 'Large 2MB JPEG image loading in 3 seconds',
          after: 'Optimized 200KB WebP image loading in 0.3 seconds',
          explanation: 'Image optimization can reduce load times by 90% while maintaining visual quality'
        }
      },
      {
        id: 'seo-page-speed-moderate',
        category: 'SEO',
        condition: (results) => {
          const speed = results.seoScore?.details?.pageSpeed || 0;
          return speed >= 50 && speed < 80;
        },
        priority: 'Medium',
        impact: 75,
        effort: 'Easy',
        title: 'Improve Page Loading Speed',
        description: (results) => 
          `Page speed score is ${results.seoScore?.details?.pageSpeed || 0}/100. There's room for improvement to enhance user experience and SEO.`,
        actionSteps: [
          'Optimize images by using modern formats (WebP, AVIF)',
          'Lazy load images below the fold',
          'Preload critical resources',
          'Minimize HTTP requests by combining files',
          'Use efficient CSS selectors'
        ],
        example: 'Implement lazy loading: <img loading="lazy" src="image.jpg" alt="Description">',
        beforeAfterExample: {
          before: 'All images load immediately on page load',
          after: 'Images load only when user scrolls to them',
          explanation: 'Lazy loading reduces initial page load time by 40-60%'
        }
      },
      {
        id: 'seo-mobile-responsive',
        category: 'SEO',
        condition: (results) => !results.seoScore?.details?.mobileResponsive,
        priority: 'High',
        impact: 90,
        effort: 'Hard',
        title: 'Implement Mobile Responsiveness',
        description: () => 
          'Your website is not mobile-friendly. With mobile-first indexing, this severely impacts SEO rankings.',
        actionSteps: [
          'Add viewport meta tag: <meta name="viewport" content="width=device-width, initial-scale=1">',
          'Use CSS media queries for different screen sizes',
          'Implement flexible grid layouts (CSS Grid or Flexbox)',
          'Make touch targets at least 44px in size',
          'Test on multiple devices and screen sizes',
          'Optimize font sizes for mobile readability'
        ],
        example: 'CSS media query: @media (max-width: 768px) { .container { width: 100%; } }',
        beforeAfterExample: {
          before: 'Desktop-only layout that requires horizontal scrolling on mobile',
          after: 'Responsive layout that adapts to any screen size',
          explanation: 'Responsive design improves mobile user experience and SEO rankings'
        }
      },
      {
        id: 'seo-title-optimization',
        category: 'SEO',
        condition: (results) => (results.seoScore?.details?.titleTag?.score || 0) < 80,
        priority: 'High',
        impact: 85,
        effort: 'Easy',
        title: 'Optimize Title Tags',
        description: (results) => {
          const issues = results.seoScore?.details?.titleTag?.issues || [];
          return `Title tag optimization needed. Issues found: ${issues.join(', ')}`;
        },
        actionSteps: [
          'Keep titles between 50-60 characters for optimal display',
          'Include primary keyword near the beginning',
          'Make each title unique across your website',
          'Write compelling, descriptive titles that encourage clicks',
          'Avoid keyword stuffing and repetitive phrases',
          'Include your brand name at the end (if space allows)'
        ],
        example: 'Good: "Best SEO Tools 2024: Complete Guide | YourBrand"',
        beforeAfterExample: {
          before: 'SEO Tools SEO Software SEO Analysis SEO Tips SEO Guide',
          after: 'Best SEO Tools 2024: Complete Guide for Beginners',
          explanation: 'Clear, descriptive titles perform better than keyword-stuffed ones'
        }
      },
      {
        id: 'seo-meta-description',
        category: 'SEO',
        condition: (results) => (results.seoScore?.details?.metaDescription?.score || 0) < 80,
        priority: 'Medium',
        impact: 70,
        effort: 'Easy',
        title: 'Improve Meta Descriptions',
        description: (results) => {
          const issues = results.seoScore?.details?.metaDescription?.issues || [];
          return `Meta description needs improvement. Issues: ${issues.join(', ')}`;
        },
        actionSteps: [
          'Keep descriptions between 150-160 characters',
          'Include primary and secondary keywords naturally',
          'Write compelling copy that encourages clicks',
          'Make each description unique',
          'Include a clear call-to-action when appropriate',
          'Accurately summarize the page content'
        ],
        example: 'Discover the top 10 SEO tools for 2024. Compare features, pricing, and user reviews to find the perfect solution for your website optimization needs.',
        beforeAfterExample: {
          before: 'This page is about SEO tools and software for websites.',
          after: 'Discover 10 powerful SEO tools that boost rankings. Compare features, pricing & reviews to find your perfect optimization solution.',
          explanation: 'Compelling meta descriptions can increase click-through rates by 30%'
        }
      }
    ];
  }

  private createGEOTemplates(): RecommendationTemplate[] {
    return [
      {
        id: 'geo-content-clarity',
        category: 'GEO',
        condition: (results) => (results.geoScore?.details?.contentClarity?.score || 0) < 70,
        priority: 'High',
        impact: 80,
        effort: 'Medium',
        title: 'Improve Content Clarity for AI Understanding',
        description: (results) => 
          `Content clarity score is ${results.geoScore?.details?.contentClarity?.score || 0}/100. AI systems prefer clear, well-structured information.`,
        actionSteps: [
          'Use clear, concise sentences (aim for 15-20 words per sentence)',
          'Define technical terms and acronyms on first use',
          'Structure information with logical headings (H1, H2, H3)',
          'Use bullet points and numbered lists for complex information',
          'Write in active voice rather than passive voice',
          'Use transition words to connect ideas clearly'
        ],
        example: 'Instead of: "The utilization of SEO methodologies facilitates enhanced visibility" use: "SEO methods help improve website visibility"',
        beforeAfterExample: {
          before: 'The implementation of search engine optimization techniques necessitates comprehensive understanding of algorithmic parameters.',
          after: 'To use SEO effectively, you need to understand how search algorithms work.',
          explanation: 'Simple, clear language helps both humans and AI understand your content better'
        }
      },
      {
        id: 'geo-qa-format',
        category: 'GEO',
        condition: (results) => !results.geoScore?.details?.questionAnswerFormat,
        priority: 'Medium',
        impact: 65,
        effort: 'Easy',
        title: 'Add Question-Answer Format Content',
        description: () => 
          'No Q&A format detected. AI systems favor content structured as questions and answers for better understanding and retrieval.',
        actionSteps: [
          'Identify common questions your audience asks about your topic',
          'Use questions as H2 or H3 headings',
          'Provide direct, comprehensive answers immediately after each question',
          'Create a dedicated FAQ section',
          'Use natural language that matches how people actually ask questions',
          'Include follow-up questions and related topics'
        ],
        example: 'Structure: "What is SEO?" followed by a clear, direct answer',
        beforeAfterExample: {
          before: 'SEO involves various techniques for improving website visibility in search results.',
          after: 'What is SEO? SEO (Search Engine Optimization) is the practice of improving your website to increase its visibility in search engine results.',
          explanation: 'Q&A format makes content more accessible to AI systems and voice search'
        }
      },
      {
        id: 'geo-author-credibility',
        category: 'GEO',
        condition: (results) => !results.geoScore?.details?.authorInformation,
        priority: 'Medium',
        impact: 70,
        effort: 'Easy',
        title: 'Add Author Information and Credentials',
        description: () => 
          'No author information found. Author credentials help establish expertise and trustworthiness for AI systems.',
        actionSteps: [
          'Add clear author bylines to all content',
          'Include author bio with relevant credentials and experience',
          'Link to author social profiles or professional pages',
          'Mention specific expertise and qualifications',
          'Add author photos for personal connection',
          'Include publication date and last updated information'
        ],
        example: 'By Sarah Johnson, Digital Marketing Specialist with 8+ years in SEO and content strategy',
        beforeAfterExample: {
          before: 'Anonymous article with no author information',
          after: 'By Dr. Sarah Johnson, PhD in Computer Science, 10+ years in SEO research at Google',
          explanation: 'Clear author credentials increase content trustworthiness and authority'
        }
      },
      {
        id: 'geo-citations-references',
        category: 'GEO',
        condition: (results) => (results.geoScore?.details?.citations || 0) < 3,
        priority: 'Medium',
        impact: 60,
        effort: 'Medium',
        title: 'Add Citations and References',
        description: (results) => 
          `Only ${results.geoScore?.details?.citations || 0} citations found. More references improve content credibility for AI systems.`,
        actionSteps: [
          'Link to authoritative sources and recent studies',
          'Reference industry reports and statistics with dates',
          'Cite expert opinions and quotes with proper attribution',
          'Use reputable sources (.edu, .gov, established industry sites)',
          'Include publication dates for all references',
          'Add "Sources" or "References" section at the end of content'
        ],
        example: 'According to Google\'s 2024 Search Quality Guidelines (link to official document)...',
        beforeAfterExample: {
          before: 'Unsupported claims without any references or sources',
          after: 'According to a 2024 study by Moz (link), 75% of users never scroll past the first page of search results.',
          explanation: 'Proper citations increase content credibility and help AI verify information'
        }
      }
    ];
  }

  private createTechnicalTemplates(): RecommendationTemplate[] {
    return [
      {
        id: 'tech-structured-data',
        category: 'Technical',
        condition: (results) => (results.geoScore?.details?.schemaMarkup?.length || 0) === 0,
        priority: 'Medium',
        impact: 75,
        effort: 'Medium',
        title: 'Implement Structured Data Markup',
        description: () => 
          'No structured data found. Schema markup helps search engines and AI systems understand your content better.',
        actionSteps: [
          'Add JSON-LD structured data to your pages',
          'Implement relevant schema types (Article, Organization, Person, etc.)',
          'Include key properties like headline, author, datePublished',
          'Validate markup using Google\'s Rich Results Test',
          'Monitor structured data in Google Search Console',
          'Update schema when content changes'
        ],
        example: 'Add JSON-LD script with Article schema including headline, author, and datePublished',
        beforeAfterExample: {
          before: 'Plain HTML with no structured data markup',
          after: 'HTML enhanced with JSON-LD schema providing clear content structure',
          explanation: 'Structured data helps search engines display rich snippets and improves AI understanding'
        }
      },
      {
        id: 'tech-internal-linking',
        category: 'Technical',
        condition: (results) => (results.seoScore?.details?.internalLinks || 0) < 3,
        priority: 'Medium',
        impact: 65,
        effort: 'Easy',
        title: 'Improve Internal Linking Structure',
        description: (results) => 
          `Only ${results.seoScore?.details?.internalLinks || 0} internal links found. Better internal linking improves SEO and user navigation.`,
        actionSteps: [
          'Add 5-10 relevant internal links per page',
          'Use descriptive anchor text (avoid "click here")',
          'Link to related content and important pages',
          'Create topic clusters with pillar pages',
          'Ensure links are contextually relevant',
          'Use a logical site hierarchy'
        ],
        example: 'Link to related articles: "Learn more about <a href="/seo-basics">SEO fundamentals</a>"',
        beforeAfterExample: {
          before: 'Isolated page with no internal links',
          after: 'Well-connected page linking to 8 related articles and key pages',
          explanation: 'Good internal linking distributes page authority and improves user engagement'
        }
      }
    ];
  }

  private createRecommendationFromTemplate(
    template: RecommendationTemplate,
    results: AnalysisResults
  ): Recommendation {
    return {
      id: template.id,
      category: template.category,
      priority: template.priority,
      impact: template.impact,
      effort: template.effort,
      title: template.title,
      description: template.description(results),
      actionSteps: template.actionSteps,
      example: template.example
    };
  }

  private calculatePriorityScore(recommendation: Recommendation): number {
    // Priority weights
    const priorityWeights = { 'High': 100, 'Medium': 60, 'Low': 30 };
    
    // Effort weights (easier tasks get higher priority)
    const effortWeights = { 'Easy': 30, 'Medium': 20, 'Hard': 10 };
    
    // Calculate composite score
    const priorityScore = priorityWeights[recommendation.priority];
    const impactScore = recommendation.impact;
    const effortScore = effortWeights[recommendation.effort];
    
    // Weighted combination: 40% priority, 40% impact, 20% effort
    return (priorityScore * 0.4) + (impactScore * 0.4) + (effortScore * 0.2);
  }

  private applyUserPreferences(
    recommendations: Recommendation[],
    preferences: NonNullable<RecommendationContext['userPreferences']>
  ): Recommendation[] {
    let filtered = recommendations;

    // Filter by focus area
    if (preferences.focusArea && preferences.focusArea !== 'All') {
      filtered = filtered.filter(rec => rec.category === preferences.focusArea);
    }

    // Prioritize easy wins if requested
    if (preferences.prioritizeEasyWins) {
      const easyWins = filtered.filter(rec => rec.effort === 'Easy');
      const others = filtered.filter(rec => rec.effort !== 'Easy');
      filtered = [...easyWins, ...others];
    }

    // Limit number of recommendations
    if (preferences.maxRecommendations) {
      filtered = filtered.slice(0, preferences.maxRecommendations);
    }

    return filtered;
  }
}