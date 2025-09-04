/**
 * Test data sets with known SEO/GEO characteristics for end-to-end testing
 */

export interface TestSite {
  name: string;
  urls: string[];
  expectedScores: {
    overall: { min: number; max: number };
    seo: { min: number; max: number };
    geo: { min: number; max: number };
  };
  expectedIssues: string[];
  description: string;
}

export const testSites: TestSite[] = [
  {
    name: 'Perfect SEO Site',
    urls: [
      'https://example-perfect-seo.com/',
      'https://example-perfect-seo.com/about',
      'https://example-perfect-seo.com/services'
    ],
    expectedScores: {
      overall: { min: 85, max: 100 },
      seo: { min: 90, max: 100 },
      geo: { min: 80, max: 100 }
    },
    expectedIssues: [],
    description: 'High-scoring reference site with excellent SEO and GEO optimization'
  },
  {
    name: 'Poor SEO Site',
    urls: [
      'https://example-poor-seo.com/',
      'https://example-poor-seo.com/page1',
      'https://example-poor-seo.com/page2'
    ],
    expectedScores: {
      overall: { min: 0, max: 40 },
      seo: { min: 0, max: 30 },
      geo: { min: 0, max: 50 }
    },
    expectedIssues: [
      'Missing title tags',
      'No meta descriptions',
      'Poor page speed',
      'Missing structured data'
    ],
    description: 'Low-scoring reference site with multiple SEO issues'
  },
  {
    name: 'Mixed Content Site',
    urls: [
      'https://example-mixed.com/',
      'https://example-mixed.com/good-page',
      'https://example-mixed.com/bad-page'
    ],
    expectedScores: {
      overall: { min: 40, max: 75 },
      seo: { min: 35, max: 80 },
      geo: { min: 45, max: 70 }
    },
    expectedIssues: [
      'Inconsistent content quality',
      'Some missing meta tags'
    ],
    description: 'Site with varied quality content across pages'
  },
  {
    name: 'Technical Issues Site',
    urls: [
      'https://example-technical-issues.com/',
      'https://example-technical-issues.com/slow-page'
    ],
    expectedScores: {
      overall: { min: 20, max: 60 },
      seo: { min: 15, max: 50 },
      geo: { min: 25, max: 70 }
    },
    expectedIssues: [
      'Slow page load times',
      'Mobile responsiveness issues',
      'Crawlability problems'
    ],
    description: 'Site with technical SEO problems'
  },
  {
    name: 'GEO Optimized Site',
    urls: [
      'https://example-geo-optimized.com/',
      'https://example-geo-optimized.com/ai-content',
      'https://example-geo-optimized.com/structured-data'
    ],
    expectedScores: {
      overall: { min: 70, max: 95 },
      seo: { min: 60, max: 85 },
      geo: { min: 80, max: 100 }
    },
    expectedIssues: [],
    description: 'AI-optimized content with excellent GEO factors'
  }
];

export const mockAnalysisResults = {
  'https://example-perfect-seo.com/': {
    url: 'https://example-perfect-seo.com/',
    timestamp: new Date(),
    overallScore: 95,
    seoScore: {
      overall: 98,
      technical: 95,
      content: 100,
      structure: 98,
      details: {
        pageSpeed: 95,
        mobileResponsive: true,
        titleTag: { score: 100, issues: [] },
        metaDescription: { score: 95, issues: [] },
        headingStructure: { score: 100, issues: [] },
        internalLinks: 15
      }
    },
    geoScore: {
      overall: 92,
      readability: 95,
      credibility: 90,
      completeness: 88,
      structuredData: 95,
      details: {
        contentClarity: { score: 95, issues: [] },
        questionAnswerFormat: true,
        authorInformation: true,
        citations: 8,
        schemaMarkup: ['Article', 'Organization', 'BreadcrumbList']
      }
    },
    recommendations: [],
    technicalDetails: {
      loadTime: 1.2,
      firstContentfulPaint: 0.8,
      largestContentfulPaint: 1.5,
      cumulativeLayoutShift: 0.05
    }
  }
};

export const testUrls = {
  validSameDomain: [
    'https://example.com/',
    'https://example.com/about',
    'https://example.com/services',
    'https://www.example.com/contact'
  ],
  invalidMixedDomains: [
    'https://example.com/',
    'https://different-domain.com/',
    'https://another-site.org/'
  ],
  invalidUrls: [
    'not-a-url',
    'ftp://example.com/',
    'javascript:alert("test")'
  ]
};