import { URLValidationServiceImpl } from '../URLValidationService';

describe('URLValidationService', () => {
  let service: URLValidationServiceImpl;

  beforeEach(() => {
    service = new URLValidationServiceImpl();
  });

  describe('validateURLs', () => {
    it('should validate URLs from the same domain', () => {
      const urls = [
        'https://example.com',
        'https://example.com/page1',
        'https://www.example.com/page2'
      ];

      const result = service.validateURLs(urls);

      expect(result.valid).toBe(true);
      expect(result.normalizedUrls).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject URLs from different domains', () => {
      const urls = [
        'https://example.com',
        'https://different.com/page1'
      ];

      const result = service.validateURLs(urls);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('DOMAIN_MISMATCH');
    });

    it('should handle empty URL list', () => {
      const result = service.validateURLs([]);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('EMPTY_URL_LIST');
    });

    it('should handle invalid URL formats', () => {
      const urls = ['not-a-url', 'https://valid.com'];

      const result = service.validateURLs(urls);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_URL_FORMAT')).toBe(true);
    });

    it('should detect duplicate URLs', () => {
      const urls = [
        'https://example.com',
        'https://example.com',
        'https://example.com/page'
      ];

      const result = service.validateURLs(urls);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DUPLICATE_URL')).toBe(true);
    });

    it('should warn about HTTP URLs', () => {
      const urls = ['http://example.com'];

      const result = service.validateURLs(urls);

      expect(result.errors.some(e => e.code === 'HTTP_WARNING')).toBe(true);
    });

    it('should block private/localhost URLs', () => {
      const urls = [
        'https://localhost:3000',
        'https://192.168.1.1',
        'https://127.0.0.1'
      ];

      const result = service.validateURLs(urls);

      expect(result.valid).toBe(false);
      expect(result.errors.every(e => e.code === 'PRIVATE_URL_BLOCKED')).toBe(true);
    });
  });

  describe('normalizeDomain', () => {
    it('should normalize domains correctly', () => {
      expect(service.normalizeDomain('https://www.example.com')).toBe('example.com');
      expect(service.normalizeDomain('https://EXAMPLE.COM')).toBe('example.com');
      expect(service.normalizeDomain('http://subdomain.example.com')).toBe('subdomain.example.com');
    });

    it('should throw error for invalid URLs', () => {
      expect(() => service.normalizeDomain('not-a-url')).toThrow();
    });
  });

  describe('checkDomainConsistency', () => {
    it('should return true for same domain URLs', () => {
      const urls = [
        'https://example.com',
        'https://www.example.com/page',
        'http://example.com/another'
      ];

      expect(service.checkDomainConsistency(urls)).toBe(true);
    });

    it('should return false for different domain URLs', () => {
      const urls = [
        'https://example.com',
        'https://different.com'
      ];

      expect(service.checkDomainConsistency(urls)).toBe(false);
    });

    it('should return true for single URL', () => {
      expect(service.checkDomainConsistency(['https://example.com'])).toBe(true);
    });

    it('should return true for empty array', () => {
      expect(service.checkDomainConsistency([])).toBe(true);
    });
  });

  describe('URL normalization edge cases', () => {
    it('should add HTTPS protocol when missing', () => {
      const urls = ['example.com'];
      const result = service.validateURLs(urls);
      
      expect(result.normalizedUrls[0]).toBe('https://example.com/');
    });

    it('should handle URLs with query parameters', () => {
      const urls = ['https://example.com?param=value&other=test'];
      const result = service.validateURLs(urls);
      
      expect(result.normalizedUrls[0]).toContain('param=value');
      expect(result.normalizedUrls[0]).toContain('other=test');
    });

    it('should remove trailing slashes from paths', () => {
      const urls = ['https://example.com/page/'];
      const result = service.validateURLs(urls);
      
      expect(result.normalizedUrls[0]).toBe('https://example.com/page');
    });

    it('should preserve root path trailing slash', () => {
      const urls = ['https://example.com/'];
      const result = service.validateURLs(urls);
      
      expect(result.normalizedUrls[0]).toBe('https://example.com/');
    });
  });

  describe('security validations', () => {
    it('should detect suspicious TLD domains', () => {
      const urls = ['https://suspicious.tk'];
      const result = service.validateURLs(urls);
      
      expect(result.errors.some(e => e.code === 'SUSPICIOUS_DOMAIN')).toBe(true);
    });

    it('should detect IP address URLs', () => {
      const urls = ['https://192.168.1.100'];
      const result = service.validateURLs(urls);
      
      expect(result.errors.some(e => 
        e.code === 'SUSPICIOUS_DOMAIN' || e.code === 'PRIVATE_URL_BLOCKED'
      )).toBe(true);
    });
  });

  describe('URL limits', () => {
    it('should enforce maximum URL limits', () => {
      // Mock environment variable
      process.env.MAX_URLS_PER_REQUEST = '2';
      
      const urls = [
        'https://example.com/1',
        'https://example.com/2',
        'https://example.com/3'
      ];
      
      const result = service.validateURLs(urls);
      
      expect(result.errors.some(e => e.code === 'TOO_MANY_URLS')).toBe(true);
      
      // Clean up
      delete process.env.MAX_URLS_PER_REQUEST;
    });
  });
});