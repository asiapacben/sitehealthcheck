import * as cheerio from 'cheerio';
import axios from 'axios';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/ErrorHandler';
import { 
  StructuredDataResult,
  StructuredDataItem,
  SchemaValidationResult,
  StructuredDataRecommendation,
  QualityScore,
  AnalysisConfig,
  ParsingError 
} from '@shared/types';

export class StructuredDataAnalyzer {
  private errorHandler: ErrorHandler;
  private readonly userAgent = 'SEO-GEO-Health-Checker/1.0 (compatible; analysis bot)';

  // Common schema types for different page types
  private readonly commonSchemaTypes = {
    article: ['Article', 'NewsArticle', 'BlogPosting'],
    product: ['Product', 'Offer'],
    organization: ['Organization', 'LocalBusiness'],
    person: ['Person'],
    website: ['WebSite', 'WebPage'],
    breadcrumb: ['BreadcrumbList'],
    faq: ['FAQPage'],
    howto: ['HowTo'],
    recipe: ['Recipe'],
    event: ['Event'],
    review: ['Review', 'AggregateRating']
  };

  constructor() {
    this.errorHandler = new ErrorHandler();
  }

  /**
   * Analyzes structured data for a given URL
   */
  async analyzeStructuredData(url: string, config: AnalysisConfig): Promise<StructuredDataResult> {
    logger.info('Starting structured data analysis', { url });

    try {
      // Fetch page content
      const html = await this.fetchPageContent(url);
      const $ = cheerio.load(html);

      // Run parallel structured data analyses
      const [
        jsonLdResult,
        microdataResult,
        rdfaResult
      ] = await Promise.allSettled([
        this.extractJSONLD($),
        this.extractMicrodata($),
        this.extractRDFa($)
      ]);

      const jsonLdData = this.extractResult(jsonLdResult, []);
      const microdataItems = this.extractResult(microdataResult, []);
      const rdfaItems = this.extractResult(rdfaResult, []);

      // Validate schemas
      const schemaValidation = await this.validateSchemas([
        ...jsonLdData,
        ...microdataItems,
        ...rdfaItems
      ]);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        jsonLdData,
        microdataItems,
        rdfaItems,
        schemaValidation,
        $
      );

      // Calculate overall score
      const overallScore = this.calculateOverallScore(
        jsonLdData,
        microdataItems,
        rdfaItems,
        schemaValidation
      );

      const result: StructuredDataResult = {
        overallScore,
        jsonLdData,
        microdataItems,
        rdfaItems,
        schemaValidation,
        recommendations
      };

      logger.info('Structured data analysis completed', {
        url,
        overallScore: overallScore.score,
        jsonLdCount: jsonLdData.length,
        microdataCount: microdataItems.length,
        rdfaCount: rdfaItems.length
      });

      return result;

    } catch (error) {
      logger.error('Structured data analysis failed', { url, error });
      throw this.errorHandler.createParsingError(
        url,
        error instanceof Error ? error : new Error('Structured data analysis failed')
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
   * Extracts JSON-LD structured data
   */
  private async extractJSONLD($: cheerio.Root): Promise<StructuredDataItem[]> {
    const jsonLdItems: StructuredDataItem[] = [];

    $('script[type="application/ld+json"]').each((index, element) => {
      try {
        const jsonText = $(element).html()?.trim();
        if (!jsonText) return;

        const jsonData = JSON.parse(jsonText);
        const items = Array.isArray(jsonData) ? jsonData : [jsonData];

        items.forEach((item, itemIndex) => {
          if (item['@type']) {
            const structuredItem: StructuredDataItem = {
              type: item['@type'],
              format: 'JSON-LD',
              properties: item,
              isValid: this.validateJSONLDItem(item),
              errors: this.getJSONLDErrors(item),
              location: `script[${index}]${items.length > 1 ? `[${itemIndex}]` : ''}`
            };

            jsonLdItems.push(structuredItem);
          }
        });

      } catch (error) {
        logger.warn('Failed to parse JSON-LD', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          index 
        });
        
        jsonLdItems.push({
          type: 'Unknown',
          format: 'JSON-LD',
          properties: {},
          isValid: false,
          errors: ['Invalid JSON syntax'],
          location: `script[${index}]`
        });
      }
    });

    return jsonLdItems;
  }

  /**
   * Extracts Microdata structured data
   */
  private async extractMicrodata($: cheerio.Root): Promise<StructuredDataItem[]> {
    const microdataItems: StructuredDataItem[] = [];

    $('[itemscope]').each((index, element) => {
      const $element = $(element);
      const itemType = $element.attr('itemtype');
      
      if (itemType) {
        const properties: Record<string, any> = {};
        
        // Extract properties from this itemscope
        $element.find('[itemprop]').each((_, propElement) => {
          const $prop = $(propElement);
          const propName = $prop.attr('itemprop');
          
          if (propName) {
            let value: string | undefined;
            
            // Get value based on element type
            if ($prop.is('meta')) {
              value = $prop.attr('content');
            } else if ($prop.is('img')) {
              value = $prop.attr('src');
            } else if ($prop.is('a')) {
              value = $prop.attr('href');
            } else if ($prop.is('time')) {
              value = $prop.attr('datetime') || $prop.text().trim();
            } else {
              value = $prop.text().trim();
            }
            
            if (value) {
              properties[propName] = value;
            }
          }
        });

        const schemaType = this.extractSchemaType(itemType);
        
        const structuredItem: StructuredDataItem = {
          type: schemaType,
          format: 'Microdata',
          properties: {
            '@type': schemaType,
            ...properties
          },
          isValid: this.validateMicrodataItem(properties, schemaType),
          errors: this.getMicrodataErrors(properties, schemaType),
          location: `element[${index}]`
        };

        microdataItems.push(structuredItem);
      }
    });

    return microdataItems;
  }

  /**
   * Extracts RDFa structured data
   */
  private async extractRDFa($: cheerio.Root): Promise<StructuredDataItem[]> {
    const rdfaItems: StructuredDataItem[] = [];

    $('[typeof]').each((index, element) => {
      const $element = $(element);
      const typeOf = $element.attr('typeof');
      
      if (typeOf) {
        const properties: Record<string, any> = {};
        
        // Extract properties from this element and its children
        $element.find('[property]').addBack('[property]').each((_, propElement) => {
          const $prop = $(propElement);
          const propName = $prop.attr('property');
          
          if (propName) {
            let value: string | undefined;
            
            // Get value based on element type and attributes
            if ($prop.attr('content')) {
              value = $prop.attr('content');
            } else if ($prop.is('img')) {
              value = $prop.attr('src');
            } else if ($prop.is('a')) {
              value = $prop.attr('href');
            } else if ($prop.attr('datetime')) {
              value = $prop.attr('datetime');
            } else {
              value = $prop.text().trim();
            }
            
            if (value) {
              properties[propName] = value;
            }
          }
        });

        const schemaType = this.extractSchemaType(typeOf);
        
        const structuredItem: StructuredDataItem = {
          type: schemaType,
          format: 'RDFa',
          properties: {
            '@type': schemaType,
            ...properties
          },
          isValid: this.validateRDFaItem(properties, schemaType),
          errors: this.getRDFaErrors(properties, schemaType),
          location: `element[${index}]`
        };

        rdfaItems.push(structuredItem);
      }
    });

    return rdfaItems;
  }

  /**
   * Validates schemas against Schema.org standards
   */
  private async validateSchemas(items: StructuredDataItem[]): Promise<SchemaValidationResult[]> {
    const validationResults: SchemaValidationResult[] = [];

    // Group items by schema type
    const itemsByType = items.reduce((acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = [];
      }
      acc[item.type].push(item);
      return acc;
    }, {} as Record<string, StructuredDataItem[]>);

    // Validate each schema type
    for (const [schemaType, schemaItems] of Object.entries(itemsByType)) {
      const validation = this.validateSchemaType(schemaType, schemaItems);
      validationResults.push(validation);
    }

    return validationResults;
  }

  /**
   * Validates a specific schema type
   */
  private validateSchemaType(schemaType: string, items: StructuredDataItem[]): SchemaValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let completeness = 0;

    // Get required and recommended properties for this schema type
    const requiredProps = this.getRequiredProperties(schemaType);
    const recommendedProps = this.getRecommendedProperties(schemaType);

    // Check each item of this schema type
    items.forEach((item, index) => {
      const props = Object.keys(item.properties);
      
      // Check required properties
      requiredProps.forEach(reqProp => {
        if (!props.includes(reqProp)) {
          errors.push(`Missing required property "${reqProp}" in ${schemaType} item ${index + 1}`);
        }
      });

      // Check recommended properties
      recommendedProps.forEach(recProp => {
        if (!props.includes(recProp)) {
          warnings.push(`Missing recommended property "${recProp}" in ${schemaType} item ${index + 1}`);
        }
      });
    });

    // Calculate completeness score
    if (items.length > 0) {
      const totalProps = requiredProps.length + recommendedProps.length;
      if (totalProps > 0) {
        const avgProps = items.reduce((sum, item) => {
          const hasRequired = requiredProps.filter(prop => 
            Object.keys(item.properties).includes(prop)
          ).length;
          const hasRecommended = recommendedProps.filter(prop => 
            Object.keys(item.properties).includes(prop)
          ).length;
          // Weight required properties more heavily (1.0) vs recommended (0.3)
          const score = (hasRequired * 1.0 + hasRecommended * 0.3) / (requiredProps.length * 1.0 + recommendedProps.length * 0.3);
          return sum + score;
        }, 0) / items.length;
        
        completeness = Math.round(avgProps * 100);
      }
    }

    return {
      schemaType,
      isValid: errors.length === 0,
      errors,
      warnings,
      completeness
    };
  }

  /**
   * Generates recommendations for missing structured data
   */
  private generateRecommendations(
    jsonLdData: StructuredDataItem[],
    microdataItems: StructuredDataItem[],
    rdfaItems: StructuredDataItem[],
    schemaValidation: SchemaValidationResult[],
    $: cheerio.Root
  ): StructuredDataRecommendation[] {
    const recommendations: StructuredDataRecommendation[] = [];
    const allItems = [...jsonLdData, ...microdataItems, ...rdfaItems];
    const existingTypes = new Set(allItems.map(item => item.type));

    // Analyze page content to suggest relevant schema types
    const pageType = this.detectPageType($);
    const suggestedSchemas = this.getSuggestedSchemas(pageType, existingTypes);

    // Add recommendations for missing schema types
    suggestedSchemas.forEach(schema => {
      recommendations.push({
        schemaType: schema.type,
        priority: schema.priority,
        description: schema.description,
        implementation: schema.implementation,
        example: schema.example
      });
    });

    // Add recommendations based on validation results
    schemaValidation.forEach(validation => {
      if (!validation.isValid || validation.completeness < 80) {
        recommendations.push({
          schemaType: validation.schemaType,
          priority: validation.errors.length > 0 ? 'High' : 'Medium',
          description: `Improve ${validation.schemaType} schema implementation`,
          implementation: `Add missing required properties: ${validation.errors.join(', ')}`,
          example: this.getSchemaExample(validation.schemaType)
        });
      }
    });

    // Prioritize recommendations
    return recommendations.sort((a, b) => {
      const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Calculates overall structured data score
   */
  private calculateOverallScore(
    jsonLdData: StructuredDataItem[],
    microdataItems: StructuredDataItem[],
    rdfaItems: StructuredDataItem[],
    schemaValidation: SchemaValidationResult[]
  ): QualityScore {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    const allItems = [...jsonLdData, ...microdataItems, ...rdfaItems];

    // Check if any structured data exists
    if (allItems.length === 0) {
      score = 0;
      issues.push('No structured data found on the page');
      suggestions.push('Add JSON-LD structured data to help search engines understand your content');
      return { score, issues, suggestions };
    }

    // Prefer JSON-LD format
    if (jsonLdData.length === 0 && (microdataItems.length > 0 || rdfaItems.length > 0)) {
      score -= 10;
      suggestions.push('Consider using JSON-LD format for better compatibility and easier maintenance');
    }

    // Check for validation errors
    const totalErrors = schemaValidation.reduce((sum, v) => sum + v.errors.length, 0);
    if (totalErrors > 0) {
      score -= Math.min(30, totalErrors * 5);
      issues.push(`${totalErrors} schema validation error(s) found`);
      suggestions.push('Fix schema validation errors to ensure proper search engine understanding');
    }

    // Check completeness
    const avgCompleteness = schemaValidation.length > 0 
      ? schemaValidation.reduce((sum, v) => sum + v.completeness, 0) / schemaValidation.length
      : 0;
    
    if (avgCompleteness < 70) {
      score -= 20;
      issues.push('Structured data is incomplete');
      suggestions.push('Add recommended properties to improve schema completeness');
    }

    // Check for multiple formats (can cause confusion)
    const formats = new Set(allItems.map(item => item.format));
    if (formats.size > 1) {
      score -= 5;
      suggestions.push('Consider using a single structured data format for consistency');
    }

    // Check for duplicate schema types
    const types = allItems.map(item => item.type);
    const uniqueTypes = new Set(types);
    if (types.length > uniqueTypes.size) {
      score -= 10;
      issues.push('Duplicate schema types found');
      suggestions.push('Remove or consolidate duplicate structured data');
    }

    return {
      score: Math.max(0, Math.round(score)),
      issues,
      suggestions
    };
  }

  /**
   * Detects the type of page based on content
   */
  private detectPageType($: cheerio.Root): string {
    // Check for article indicators
    if ($('article').length > 0 || $('[role="article"]').length > 0) {
      return 'article';
    }

    // Check for product indicators
    if ($('.price, .product, [data-price]').length > 0) {
      return 'product';
    }

    // Check for organization/business indicators
    if ($('.contact, .address, .phone').length > 0) {
      return 'organization';
    }

    // Check for FAQ indicators
    if ($('.faq, .question, .answer').length > 0 || 
        $('h1, h2, h3').text().toLowerCase().includes('faq')) {
      return 'faq';
    }

    // Check for recipe indicators
    if ($('.recipe, .ingredients, .instructions').length > 0) {
      return 'recipe';
    }

    // Check for event indicators
    if ($('.event, .date, .time, .location').length > 0) {
      return 'event';
    }

    // Default to website/webpage
    return 'website';
  }

  /**
   * Gets suggested schemas based on page type
   */
  private getSuggestedSchemas(pageType: string, existingTypes: Set<string>) {
    const suggestions = [];

    // Always suggest WebSite and WebPage if not present
    if (!existingTypes.has('WebSite')) {
      suggestions.push({
        type: 'WebSite',
        priority: 'Medium' as const,
        description: 'Add WebSite schema to help search engines understand your site structure',
        implementation: 'Add JSON-LD with WebSite schema including name, url, and potentialAction for search',
        example: this.getSchemaExample('WebSite')
      });
    }

    if (!existingTypes.has('WebPage')) {
      suggestions.push({
        type: 'WebPage',
        priority: 'Medium' as const,
        description: 'Add WebPage schema to provide page-specific information',
        implementation: 'Add JSON-LD with WebPage schema including name, description, and url',
        example: this.getSchemaExample('WebPage')
      });
    }

    // Page-specific suggestions
    switch (pageType) {
      case 'article':
        if (!existingTypes.has('Article')) {
          suggestions.push({
            type: 'Article',
            priority: 'High' as const,
            description: 'Add Article schema for better content understanding',
            implementation: 'Include headline, author, datePublished, and articleBody properties',
            example: this.getSchemaExample('Article')
          });
        }
        break;

      case 'product':
        if (!existingTypes.has('Product')) {
          suggestions.push({
            type: 'Product',
            priority: 'High' as const,
            description: 'Add Product schema to enhance product visibility in search results',
            implementation: 'Include name, description, price, and availability properties',
            example: this.getSchemaExample('Product')
          });
        }
        break;

      case 'organization':
        if (!existingTypes.has('Organization')) {
          suggestions.push({
            type: 'Organization',
            priority: 'High' as const,
            description: 'Add Organization schema for business information',
            implementation: 'Include name, address, telephone, and url properties',
            example: this.getSchemaExample('Organization')
          });
        }
        break;

      case 'faq':
        if (!existingTypes.has('FAQPage')) {
          suggestions.push({
            type: 'FAQPage',
            priority: 'High' as const,
            description: 'Add FAQPage schema to enable rich snippets for FAQ content',
            implementation: 'Include mainEntity with Question and Answer schemas',
            example: this.getSchemaExample('FAQPage')
          });
        }
        break;
    }

    return suggestions;
  }

  /**
   * Gets example schema markup for a given type
   */
  private getSchemaExample(schemaType: string): string {
    const examples: Record<string, string> = {
      WebSite: `{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Your Website Name",
  "url": "https://yourwebsite.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://yourwebsite.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}`,
      WebPage: `{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Page Title",
  "description": "Page description",
  "url": "https://yourwebsite.com/page"
}`,
      Article: `{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "author": {
    "@type": "Person",
    "name": "Author Name"
  },
  "datePublished": "2024-01-01",
  "dateModified": "2024-01-01",
  "description": "Article description"
}`,
      Product: `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "description": "Product description",
  "offers": {
    "@type": "Offer",
    "price": "29.99",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  }
}`,
      Organization: `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Organization Name",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St",
    "addressLocality": "City",
    "addressRegion": "State",
    "postalCode": "12345"
  },
  "telephone": "+1-555-123-4567"
}`,
      FAQPage: `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What is your return policy?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "We accept returns within 30 days of purchase."
    }
  }]
}`
    };

    return examples[schemaType] || `// Add ${schemaType} schema markup here`;
  }

  /**
   * Gets required properties for a schema type
   */
  private getRequiredProperties(schemaType: string): string[] {
    const requiredProps: Record<string, string[]> = {
      Article: ['headline', 'author', 'datePublished'],
      Product: ['name', 'offers'],
      Organization: ['name'],
      Person: ['name'],
      WebSite: ['name', 'url'],
      WebPage: ['name'],
      FAQPage: ['mainEntity'],
      Recipe: ['name', 'recipeIngredient', 'recipeInstructions'],
      Event: ['name', 'startDate', 'location']
    };

    return requiredProps[schemaType] || [];
  }

  /**
   * Gets recommended properties for a schema type
   */
  private getRecommendedProperties(schemaType: string): string[] {
    const recommendedProps: Record<string, string[]> = {
      Article: ['description', 'image', 'dateModified'],
      Product: ['description', 'image', 'brand', 'sku'],
      Organization: ['address', 'telephone', 'url', 'logo'],
      Person: ['jobTitle', 'worksFor', 'image'],
      WebSite: ['description', 'potentialAction'],
      WebPage: ['description', 'url', 'breadcrumb'],
      FAQPage: ['description'],
      Recipe: ['description', 'image', 'cookTime', 'prepTime'],
      Event: ['description', 'endDate', 'organizer']
    };

    return recommendedProps[schemaType] || [];
  }

  /**
   * Validates JSON-LD item
   */
  private validateJSONLDItem(item: any): boolean {
    return !!(item['@context'] && item['@type']);
  }

  /**
   * Gets JSON-LD validation errors
   */
  private getJSONLDErrors(item: any): string[] {
    const errors: string[] = [];
    
    if (!item['@context']) {
      errors.push('Missing @context property');
    }
    
    if (!item['@type']) {
      errors.push('Missing @type property');
    }
    
    return errors;
  }

  /**
   * Validates Microdata item
   */
  private validateMicrodataItem(properties: Record<string, any>, schemaType: string): boolean {
    const required = this.getRequiredProperties(schemaType);
    return required.every(prop => properties[prop]);
  }

  /**
   * Gets Microdata validation errors
   */
  private getMicrodataErrors(properties: Record<string, any>, schemaType: string): string[] {
    const errors: string[] = [];
    const required = this.getRequiredProperties(schemaType);
    
    required.forEach(prop => {
      if (!properties[prop]) {
        errors.push(`Missing required property: ${prop}`);
      }
    });
    
    return errors;
  }

  /**
   * Validates RDFa item
   */
  private validateRDFaItem(properties: Record<string, any>, schemaType: string): boolean {
    const required = this.getRequiredProperties(schemaType);
    return required.every(prop => properties[prop]);
  }

  /**
   * Gets RDFa validation errors
   */
  private getRDFaErrors(properties: Record<string, any>, schemaType: string): string[] {
    const errors: string[] = [];
    const required = this.getRequiredProperties(schemaType);
    
    required.forEach(prop => {
      if (!properties[prop]) {
        errors.push(`Missing required property: ${prop}`);
      }
    });
    
    return errors;
  }

  /**
   * Extracts schema type from full URI
   */
  private extractSchemaType(typeUri: string): string {
    // Handle full Schema.org URIs
    if (typeUri.includes('schema.org/')) {
      return typeUri.split('/').pop() || typeUri;
    }
    
    // Handle prefixed types
    if (typeUri.includes(':')) {
      return typeUri.split(':').pop() || typeUri;
    }
    
    return typeUri;
  }

  /**
   * Extracts result from Promise.allSettled result
   */
  private extractResult<T>(result: PromiseSettledResult<T>, fallback: T): T {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      logger.warn('Structured data analysis step failed, using fallback', { 
        error: result.reason?.message || 'Unknown error' 
      });
      return fallback;
    }
  }
}