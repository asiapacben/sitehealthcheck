import { URL } from 'url';
import { URLValidationService, ValidationResult, ValidationError } from '@shared/types';

export class URLValidationServiceImpl implements URLValidationService {
  /**
   * Validates an array of URLs ensuring they all belong to the same domain
   */
  validateURLs(urls: string[]): ValidationResult {
    const errors: ValidationError[] = [];
    const normalizedUrls: string[] = [];
    
    if (!urls || urls.length === 0) {
      return {
        valid: false,
        normalizedUrls: [],
        errors: [{
          url: '',
          message: 'No URLs provided',
          code: 'EMPTY_URL_LIST'
        }]
      };
    }

    // First pass: normalize and validate individual URLs
    const validUrls: { original: string; normalized: string; domain: string }[] = [];
    
    for (const url of urls) {
      try {
        const normalized = this.normalizeURL(url);
        const domain = this.normalizeDomain(normalized);
        
        validUrls.push({
          original: url,
          normalized,
          domain
        });
      } catch (error) {
        errors.push({
          url,
          message: `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'INVALID_URL_FORMAT'
        });
      }
    }

    // Second pass: check domain consistency
    if (validUrls.length > 0) {
      const baseDomain = validUrls[0].domain;
      
      for (const urlInfo of validUrls) {
        if (urlInfo.domain !== baseDomain) {
          errors.push({
            url: urlInfo.original,
            message: `URL domain '${urlInfo.domain}' does not match base domain '${baseDomain}'`,
            code: 'DOMAIN_MISMATCH'
          });
        } else {
          normalizedUrls.push(urlInfo.normalized);
        }
      }
    }

    // Additional validations
    this.validateURLLimits(urls, errors);
    this.validateURLSecurity(validUrls, errors);

    return {
      valid: errors.length === 0,
      normalizedUrls,
      errors
    };
  }

  /**
   * Normalizes a URL to a standard format
   */
  private normalizeURL(url: string): string {
    let normalizedUrl = url.trim();
    
    // Add protocol if missing
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    // Parse and reconstruct URL to ensure proper format
    const parsedUrl = new URL(normalizedUrl);
    
    // Remove trailing slash from pathname unless it's the root
    if (parsedUrl.pathname !== '/' && parsedUrl.pathname.endsWith('/')) {
      parsedUrl.pathname = parsedUrl.pathname.slice(0, -1);
    }
    
    // Sort query parameters for consistency
    if (parsedUrl.search) {
      const params = new URLSearchParams(parsedUrl.search);
      params.sort();
      parsedUrl.search = params.toString();
    }
    
    return parsedUrl.toString();
  }

  /**
   * Extracts and normalizes the domain from a URL
   */
  normalizeDomain(url: string): string {
    try {
      const parsedUrl = new URL(url);
      let hostname = parsedUrl.hostname.toLowerCase();
      
      // Remove www. prefix for domain comparison
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }
      
      return hostname;
    } catch (error) {
      throw new Error(`Cannot extract domain from URL: ${url}`);
    }
  }

  /**
   * Checks if all URLs belong to the same domain
   */
  checkDomainConsistency(urls: string[]): boolean {
    if (urls.length <= 1) return true;
    
    try {
      const domains = urls.map(url => this.normalizeDomain(url));
      const baseDomain = domains[0];
      
      return domains.every(domain => domain === baseDomain);
    } catch (error) {
      return false;
    }
  }

  /**
   * Validates URL limits and constraints
   */
  private validateURLLimits(urls: string[], errors: ValidationError[]): void {
    const maxUrls = parseInt(process.env.MAX_URLS_PER_REQUEST || '10');
    
    if (urls.length > maxUrls) {
      errors.push({
        url: '',
        message: `Too many URLs provided. Maximum allowed: ${maxUrls}, provided: ${urls.length}`,
        code: 'TOO_MANY_URLS'
      });
    }

    // Check for duplicate URLs
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    
    for (const url of urls) {
      const normalized = url.trim().toLowerCase();
      if (seen.has(normalized)) {
        duplicates.add(url);
      }
      seen.add(normalized);
    }
    
    for (const duplicate of duplicates) {
      errors.push({
        url: duplicate,
        message: 'Duplicate URL provided',
        code: 'DUPLICATE_URL'
      });
    }
  }

  /**
   * Validates URL security and accessibility
   */
  private validateURLSecurity(
    validUrls: { original: string; normalized: string; domain: string }[], 
    errors: ValidationError[]
  ): void {
    for (const urlInfo of validUrls) {
      const parsedUrl = new URL(urlInfo.normalized);
      
      // Check for HTTPS (warn but don't fail)
      if (parsedUrl.protocol === 'http:') {
        errors.push({
          url: urlInfo.original,
          message: 'HTTP URLs may have limited analysis capabilities. HTTPS recommended.',
          code: 'HTTP_WARNING'
        });
      }
      
      // Check for localhost/private IPs (block for security)
      if (this.isPrivateOrLocalhost(parsedUrl.hostname)) {
        errors.push({
          url: urlInfo.original,
          message: 'Private/localhost URLs are not allowed for security reasons',
          code: 'PRIVATE_URL_BLOCKED'
        });
      }
      
      // Check for suspicious TLDs or patterns
      if (this.isSuspiciousDomain(parsedUrl.hostname)) {
        errors.push({
          url: urlInfo.original,
          message: 'Domain appears to be suspicious or blocked',
          code: 'SUSPICIOUS_DOMAIN'
        });
      }
    }
  }

  /**
   * Checks if hostname is private or localhost
   */
  private isPrivateOrLocalhost(hostname: string): boolean {
    const privatePatterns = [
      /^localhost$/i,
      /^127\./,
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^::1$/,
      /^fe80:/i
    ];
    
    return privatePatterns.some(pattern => pattern.test(hostname));
  }

  /**
   * Checks for suspicious domains (basic implementation)
   */
  private isSuspiciousDomain(hostname: string): boolean {
    const suspiciousPatterns = [
      /\.tk$/i,
      /\.ml$/i,
      /\.ga$/i,
      /\.cf$/i,
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/ // Raw IP addresses
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(hostname));
  }

  /**
   * Validates URL accessibility (basic check)
   */
  async validateURLAccessibility(url: string): Promise<{ accessible: boolean; statusCode?: number; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'SEO-GEO-Health-Checker/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      return {
        accessible: response.ok,
        statusCode: response.status
      };
    } catch (error) {
      return {
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}