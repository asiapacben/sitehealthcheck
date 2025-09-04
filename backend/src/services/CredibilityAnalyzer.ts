import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';
import { 
  CredibilityResult, 
  QualityScore,
  AnalysisConfig 
} from '../../../shared/types';

export class CredibilityAnalyzer {
  
  /**
   * Analyzes content for credibility and authority signals
   */
  async analyzeCredibility(html: string, url: string, config: AnalysisConfig): Promise<CredibilityResult> {
    logger.info('Starting credibility analysis', { url });

    try {
      const $ = cheerio.load(html);
      
      // Run parallel analyses
      const [
        authorInformation,
        citations,
        expertiseIndicators,
        sourceCredibility
      ] = await Promise.all([
        this.detectAuthorInformation($),
        this.analyzeCitations($),
        this.detectExpertiseIndicators($, html),
        this.analyzeSourceCredibility($, url)
      ]);

      const result: CredibilityResult = {
        authorInformation,
        citations,
        expertiseIndicators,
        sourceCredibility
      };

      logger.info('Credibility analysis completed', {
        url,
        hasAuthorInfo: authorInformation,
        citationCount: citations,
        expertiseSignals: expertiseIndicators.length,
        credibilityScore: sourceCredibility.score
      });

      return result;

    } catch (error) {
      logger.error('Credibility analysis failed', { url, error });
      throw new Error(`Credibility analysis failed for ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detects author information including bylines, bios, and credentials
   */
  private async detectAuthorInformation($: cheerio.Root): Promise<boolean> {
    // Look for author-related elements and attributes
    const authorSelectors = [
      '[rel="author"]',
      '.author',
      '.byline',
      '.author-name',
      '.author-bio',
      '.author-info',
      '.writer',
      '.contributor',
      '[itemprop="author"]',
      '[class*="author"]',
      '[id*="author"]'
    ];

    // Check for author elements
    for (const selector of authorSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        // Verify it contains actual author information (not just empty elements)
        for (let i = 0; i < elements.length; i++) {
          const element = elements.eq(i);
          const text = element.text().trim();
          if (text.length > 2 && this.isLikelyAuthorName(text)) {
            return true;
          }
        }
      }
    }

    // Look for common author patterns in text
    const bodyText = $('body').text();
    const authorPatterns = [
      /by\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      /written\s+by\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      /author:\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      /posted\s+by\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i
    ];

    return authorPatterns.some(pattern => pattern.test(bodyText));
  }

  /**
   * Checks if text is likely an author name
   */
  private isLikelyAuthorName(text: string): boolean {
    // Basic heuristics for author names
    const trimmed = text.trim();
    
    // Should be reasonable length
    if (trimmed.length < 3 || trimmed.length > 100) return false;
    
    // Should contain letters
    if (!/[a-zA-Z]/.test(trimmed)) return false;
    
    // Should not be common non-author text
    const nonAuthorTerms = [
      'click here', 'read more', 'continue reading', 'share', 'follow',
      'subscribe', 'newsletter', 'email', 'contact', 'about us'
    ];
    
    const lowerText = trimmed.toLowerCase();
    if (nonAuthorTerms.some(term => lowerText.includes(term))) return false;
    
    // Check for credentials or titles that indicate authorship
    if (/\b(dr|doctor|prof|professor|phd|ph\.d|md|m\.d)\b/i.test(trimmed)) {
      return true;
    }
    
    // Looks like a name if it has 2-4 words with capital letters
    const words = trimmed.split(/\s+/);
    if (words.length >= 2 && words.length <= 6) {
      // Allow for names with credentials
      const nameWords = words.filter(word => !/^(dr|doctor|prof|professor|phd|ph\.d|md|m\.d)$/i.test(word));
      if (nameWords.length >= 2) {
        return nameWords.some(word => /^[A-Z][a-z]+/.test(word));
      }
    }
    
    // Single word names with titles
    if (words.length === 1 && /^[A-Z][a-z]+/.test(trimmed)) {
      return true;
    }
    
    return false;
  }

  /**
   * Analyzes citations and references in the content
   */
  private async analyzeCitations($: cheerio.Root): Promise<number> {
    let citationCount = 0;

    // Look for external links that could be citations
    const externalLinks = $('a[href^="http"]').toArray();
    
    for (const link of externalLinks) {
      const href = $(link).attr('href') || '';
      const linkText = $(link).text().trim().toLowerCase();
      const parentText = $(link).parent().text().toLowerCase();
      
      // Check if link appears to be a citation
      if (this.isLikelyCitation(href, linkText, parentText)) {
        citationCount++;
      }
    }

    // Look for citation patterns in text
    const bodyText = $('body').text();
    const citationPatterns = [
      /\[\d+\]/g, // [1], [2], etc.
      /\(\d{4}\)/g, // (2023), (2022), etc.
      /according to/gi,
      /research shows/gi,
      /study found/gi,
      /source:/gi,
      /reference:/gi
    ];

    citationPatterns.forEach(pattern => {
      const matches = bodyText.match(pattern);
      if (matches) {
        citationCount += matches.length;
      }
    });

    // Look for bibliography or references section
    const referenceSelectors = [
      '.references',
      '.bibliography',
      '#references',
      '#bibliography',
      '[class*="reference"]',
      '[id*="reference"]'
    ];

    referenceSelectors.forEach(selector => {
      const section = $(selector);
      if (section.length > 0) {
        // Count links in reference section
        const refLinks = section.find('a[href^="http"]').length;
        citationCount += refLinks;
      }
    });

    return citationCount;
  }

  /**
   * Determines if a link is likely a citation
   */
  private isLikelyCitation(href: string, linkText: string, parentText: string): boolean {
    // Check for academic or authoritative domains
    const authoritativeDomains = [
      'edu', 'gov', 'org', 'pubmed', 'scholar.google', 'researchgate',
      'arxiv', 'jstor', 'springer', 'nature', 'science', 'ieee',
      'who.int', 'cdc.gov', 'nih.gov', 'fda.gov'
    ];

    const domain = href.toLowerCase();
    if (authoritativeDomains.some(authDomain => domain.includes(authDomain))) {
      return true;
    }

    // Check for citation-like text patterns
    const citationKeywords = [
      'study', 'research', 'report', 'paper', 'article', 'journal',
      'publication', 'source', 'reference', 'data', 'statistics'
    ];

    const combinedText = (linkText + ' ' + parentText).toLowerCase();
    return citationKeywords.some(keyword => combinedText.includes(keyword));
  }

  /**
   * Detects expertise indicators like credentials and experience mentions
   */
  private async detectExpertiseIndicators($: cheerio.Root, html: string): Promise<string[]> {
    const indicators: string[] = [];
    const content = $('body').text().toLowerCase();

    // Educational credentials
    const educationPatterns = [
      /\b(phd|ph\.d|doctorate|doctor)\b/gi,
      /\b(md|m\.d|medical doctor)\b/gi,
      /\b(mba|m\.b\.a|master of business)\b/gi,
      /\b(ma|m\.a|master of arts)\b/gi,
      /\b(ms|m\.s|master of science)\b/gi,
      /\b(bs|b\.s|bachelor of science)\b/gi,
      /\b(ba|b\.a|bachelor of arts)\b/gi,
      /\buniversity\b/gi,
      /\bcollege\b/gi,
      /\bgraduate\b/gi
    ];

    educationPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        indicators.push(`Educational credentials: ${matches.length} mentions`);
      }
    });

    // Professional certifications
    const certificationPatterns = [
      /\bcertified\b/gi,
      /\blicensed\b/gi,
      /\baccredited\b/gi,
      /\bboard certified\b/gi,
      /\bfellow\b/gi,
      /\bmember of\b/gi
    ];

    certificationPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        indicators.push(`Professional certifications: ${matches.length} mentions`);
      }
    });

    // Experience indicators
    const experiencePatterns = [
      /\b(\d+)\s*years?\s*(of\s*)?(experience|practicing|working)\b/gi,
      /\bexpert\b/gi,
      /\bspecialist\b/gi,
      /\bprofessional\b/gi,
      /\bconsultant\b/gi,
      /\bauthority\b/gi
    ];

    experiencePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        indicators.push(`Experience mentions: ${matches.length} references`);
      }
    });

    // Awards and recognition
    const awardPatterns = [
      /\baward\b/gi,
      /\brecognition\b/gi,
      /\bhonor\b/gi,
      /\bprize\b/gi,
      /\bfeatured in\b/gi,
      /\bpublished in\b/gi
    ];

    awardPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        indicators.push(`Awards/Recognition: ${matches.length} mentions`);
      }
    });

    // Professional affiliations
    const affiliationPatterns = [
      /\bassociation\b/gi,
      /\binstitute\b/gi,
      /\bsociety\b/gi,
      /\borganization\b/gi,
      /\bboard member\b/gi,
      /\bcommittee\b/gi
    ];

    affiliationPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        indicators.push(`Professional affiliations: ${matches.length} mentions`);
      }
    });

    // Look for author bio sections
    const bioSelectors = [
      '.author-bio',
      '.bio',
      '.about-author',
      '.author-description',
      '[class*="bio"]'
    ];

    bioSelectors.forEach(selector => {
      const bioSection = $(selector);
      if (bioSection.length > 0) {
        const bioText = bioSection.text();
        if (bioText.length > 50) {
          indicators.push('Detailed author biography present');
        }
      }
    });

    return indicators;
  }

  /**
   * Analyzes overall source credibility based on various signals
   */
  private async analyzeSourceCredibility($: cheerio.Root, url: string): Promise<QualityScore> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Domain authority indicators
    const domainScore = this.analyzeDomainAuthority(url);
    if (domainScore < 30) {
      score -= 20;
      issues.push('Domain appears to have low authority');
      suggestions.push('Consider building domain authority through quality content and backlinks');
    } else if (domainScore >= 80) {
      score += 10; // Bonus for high authority domains
    }

    // Contact information presence
    const contactScore = this.analyzeContactInformation($);
    if (contactScore < 50) {
      score -= 15;
      issues.push('Limited contact information available');
      suggestions.push('Add clear contact information, about page, and company details');
    } else if (contactScore >= 80) {
      score += 5; // Bonus for comprehensive contact info
    }

    // Content freshness
    const freshnessScore = this.analyzeContentFreshness($);
    if (freshnessScore < 40) {
      score -= 10;
      issues.push('Content appears outdated');
      suggestions.push('Update content regularly and add publication/update dates');
    } else if (freshnessScore >= 80) {
      score += 5; // Bonus for fresh content
    }

    // Professional presentation
    const presentationScore = this.analyzeProfessionalPresentation($);
    if (presentationScore < 50) {
      score -= 10;
      issues.push('Site lacks professional presentation');
      suggestions.push('Improve site design, fix broken elements, and ensure professional appearance');
    } else if (presentationScore >= 80) {
      score += 5; // Bonus for professional presentation
    }

    // Security indicators
    const securityScore = this.analyzeSecurityIndicators(url, $);
    if (securityScore < 60) {
      score -= 15;
      issues.push('Limited security indicators');
      suggestions.push('Implement HTTPS, add privacy policy, and security badges if applicable');
    } else if (securityScore >= 90) {
      score += 5; // Bonus for strong security
    }

    // Social proof
    const socialProofScore = this.analyzeSocialProof($);
    if (socialProofScore < 30) {
      score -= 5;
      issues.push('Limited social proof or testimonials');
      suggestions.push('Add customer testimonials, reviews, or social media presence');
    } else if (socialProofScore >= 70) {
      score += 5; // Bonus for strong social proof
    }

    return {
      score: Math.max(0, Math.round(score)),
      issues,
      suggestions
    };
  }

  /**
   * Analyzes domain authority indicators
   */
  private analyzeDomainAuthority(url: string): number {
    let score = 50; // Base score
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      // Check for authoritative TLDs
      if (domain.endsWith('.edu') || domain.endsWith('.gov')) {
        score += 50; // Increased bonus for educational and government domains
      } else if (domain.endsWith('.org')) {
        score += 25;
      } else if (domain.endsWith('.com')) {
        score += 10;
      }
      
      // Check for well-known authoritative domains
      const authoritativeDomains = [
        'wikipedia.org', 'scholar.google.com', 'pubmed.ncbi.nlm.nih.gov',
        'who.int', 'cdc.gov', 'nih.gov', 'fda.gov', 'nature.com',
        'science.org', 'ieee.org', 'acm.org', 'stanford.edu', 'mit.edu',
        'harvard.edu', 'yale.edu'
      ];
      
      if (authoritativeDomains.some(authDomain => domain.includes(authDomain))) {
        score += 40; // Increased bonus for known authoritative domains
      }
      
      // Penalize suspicious patterns
      if (domain.includes('blogspot') || domain.includes('wordpress.com')) {
        score -= 20; // Increased penalty
      }
      
      // Check domain age indicators (simplified)
      if (domain.length < 5 || /\d{4}/.test(domain)) {
        score -= 5; // Reduced penalty
      }
      
    } catch (error) {
      score = 30; // Default low score for invalid URLs
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyzes contact information availability
   */
  private analyzeContactInformation($: cheerio.Root): number {
    let score = 0;
    
    // Look for contact page
    const contactLinks = $('a[href*="contact"], a[href*="about"]');
    if (contactLinks.length > 0) score += 20;
    
    // Look for email addresses
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const bodyText = $('body').text();
    if (emailPattern.test(bodyText)) score += 15;
    
    // Look for phone numbers
    const phonePattern = /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
    if (phonePattern.test(bodyText)) score += 15;
    
    // Look for physical address
    const addressKeywords = ['address', 'location', 'street', 'city', 'state', 'zip'];
    if (addressKeywords.some(keyword => bodyText.toLowerCase().includes(keyword))) {
      score += 15;
    }
    
    // Look for social media links
    const socialDomains = ['facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com'];
    const socialLinks = $('a').filter((_, el) => {
      const href = $(el).attr('href') || '';
      return socialDomains.some(domain => href.includes(domain));
    });
    if (socialLinks.length > 0) score += 10;
    
    // Look for company information
    const companyKeywords = ['company', 'corporation', 'llc', 'inc', 'ltd'];
    if (companyKeywords.some(keyword => bodyText.toLowerCase().includes(keyword))) {
      score += 10;
    }
    
    // Look for privacy policy and terms
    const legalLinks = $('a[href*="privacy"], a[href*="terms"]');
    if (legalLinks.length > 0) score += 15;
    
    return Math.min(100, score);
  }

  /**
   * Analyzes content freshness indicators
   */
  private analyzeContentFreshness($: cheerio.Root): number {
    let score = 50; // Base score
    
    // Look for date indicators
    const dateSelectors = [
      '[datetime]',
      '.date',
      '.published',
      '.updated',
      '.timestamp',
      '[class*="date"]',
      '[id*="date"]'
    ];
    
    let hasDateInfo = false;
    dateSelectors.forEach(selector => {
      const elements = $(selector);
      if (elements.length > 0) {
        hasDateInfo = true;
        // Try to extract and evaluate date
        elements.each((_, el) => {
          const dateText = $(el).text() || $(el).attr('datetime') || '';
          if (this.isRecentDate(dateText)) {
            score += 20;
          }
        });
      }
    });
    
    if (!hasDateInfo) {
      score -= 30;
    }
    
    // Look for "updated" or "revised" indicators
    const bodyText = $('body').text().toLowerCase();
    if (bodyText.includes('updated') || bodyText.includes('revised')) {
      score += 10;
    }
    
    // Look for current year mentions
    const currentYear = new Date().getFullYear();
    if (bodyText.includes(currentYear.toString())) {
      score += 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Checks if a date string represents a recent date
   */
  private isRecentDate(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      
      return date >= oneYearAgo && date <= now;
    } catch {
      return false;
    }
  }

  /**
   * Analyzes professional presentation quality
   */
  private analyzeProfessionalPresentation($: cheerio.Root): number {
    let score = 50; // Base score
    
    // Check for proper HTML structure
    if ($('title').length > 0) score += 10;
    if ($('meta[name="description"]').length > 0) score += 10;
    
    // Check for navigation
    if ($('nav, .navigation, .menu').length > 0) score += 10;
    
    // Check for header and footer
    if ($('header').length > 0) score += 5;
    if ($('footer').length > 0) score += 5;
    
    // Check for images with alt text
    const images = $('img');
    const imagesWithAlt = $('img[alt]');
    if (images.length > 0 && imagesWithAlt.length / images.length > 0.8) {
      score += 10;
    }
    
    // Check for broken elements (simplified)
    const brokenImages = $('img[src=""], img:not([src])');
    if (brokenImages.length > 0) score -= 15;
    
    // Check for proper heading structure
    if ($('h1').length === 1) score += 5; // Exactly one H1
    if ($('h2, h3, h4').length > 0) score += 5; // Has subheadings
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyzes security indicators
   */
  private analyzeSecurityIndicators(url: string, $: cheerio.Root): number {
    let score = 50; // Base score
    
    // Check for HTTPS
    if (url.startsWith('https://')) {
      score += 30;
    } else {
      score -= 20;
    }
    
    // Look for privacy policy
    const privacyLinks = $('a[href*="privacy"]');
    if (privacyLinks.length > 0) score += 15;
    
    // Look for terms of service
    const termsLinks = $('a[href*="terms"]');
    if (termsLinks.length > 0) score += 10;
    
    // Look for security badges or certifications
    const securityKeywords = ['ssl', 'secure', 'verified', 'certified', 'trusted'];
    const bodyText = $('body').text().toLowerCase();
    securityKeywords.forEach(keyword => {
      if (bodyText.includes(keyword)) score += 5;
    });
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyzes social proof indicators
   */
  private analyzeSocialProof($: cheerio.Root): number {
    let score = 0;
    
    // Look for testimonials
    const testimonialSelectors = [
      '.testimonial',
      '.review',
      '.feedback',
      '[class*="testimonial"]',
      '[class*="review"]'
    ];
    
    testimonialSelectors.forEach(selector => {
      if ($(selector).length > 0) score += 15;
    });
    
    // Look for customer logos or case studies
    const logoSelectors = [
      '.client-logo',
      '.customer-logo',
      '.partner-logo',
      '[class*="logo"]'
    ];
    
    logoSelectors.forEach(selector => {
      if ($(selector).length > 0) score += 10;
    });
    
    // Look for social media integration
    const socialWidgets = $('.social-widget, .twitter-timeline, .facebook-like');
    if (socialWidgets.length > 0) score += 10;
    
    // Look for trust indicators in text
    const trustKeywords = ['trusted by', 'used by', 'customers', 'clients', 'testimonial'];
    const bodyText = $('body').text().toLowerCase();
    trustKeywords.forEach(keyword => {
      if (bodyText.includes(keyword)) score += 5;
    });
    
    // Look for numbers/statistics
    const statsPattern = /\b\d+[,.]?\d*\s*(customers|users|clients|companies|years)\b/gi;
    const statsMatches = bodyText.match(statsPattern);
    if (statsMatches && statsMatches.length > 0) {
      score += 15;
    }
    
    return Math.min(100, score);
  }
}