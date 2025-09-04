// Core data models and interfaces for SEO & GEO Health Checker

export interface ValidationError {
  url: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  normalizedUrls: string[];
  errors: ValidationError[];
}

export interface QualityScore {
  score: number;
  issues: string[];
  suggestions: string[];
}

export interface TechnicalDetails {
  loadTime: number;
  pageSize: number;
  requests: number;
  statusCode: number;
  redirects: number;
}

export interface SEOScore {
  overall: number;
  technical: number;
  content: number;
  structure: number;
  details: {
    pageSpeed: number;
    mobileResponsive: boolean;
    titleTag: QualityScore;
    metaDescription: QualityScore;
    headingStructure: QualityScore;
    internalLinks: number;
  };
}

export interface GEOScore {
  overall: number;
  readability: number;
  credibility: number;
  completeness: number;
  structuredData: number;
  details: {
    contentClarity: QualityScore;
    questionAnswerFormat: boolean;
    authorInformation: boolean;
    citations: number;
    schemaMarkup: string[];
  };
}

export interface Recommendation {
  id: string;
  category: 'SEO' | 'GEO' | 'Technical';
  priority: 'High' | 'Medium' | 'Low';
  impact: number;
  effort: 'Easy' | 'Medium' | 'Hard';
  title: string;
  description: string;
  actionSteps: string[];
  example?: string;
}

export interface AnalysisResults {
  url: string;
  timestamp: Date;
  overallScore: number;
  seoScore: SEOScore;
  geoScore: GEOScore;
  recommendations: Recommendation[];
  technicalDetails: TechnicalDetails;
}

export interface AnalysisConfig {
  seoWeights: {
    technical: number;
    content: number;
    structure: number;
  };
  geoWeights: {
    readability: number;
    credibility: number;
    completeness: number;
    structuredData: number;
  };
  thresholds: {
    pageSpeedMin: number;
    contentLengthMin: number;
    headingLevels: number;
  };
}

export interface FeatureFlags {
  enableExperimentalGEO: boolean;
  enableAdvancedStructuredData: boolean;
  enableAIContentAnalysis: boolean;
  enablePerformanceOptimizations: boolean;
  enableBetaRecommendations: boolean;
}

export interface EnvironmentConfig {
  environment: 'development' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableMetrics: boolean;
  enableCaching: boolean;
  cacheTimeout: number;
  maxConcurrentAnalyses: number;
  analysisTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface ExtendedAnalysisConfig extends AnalysisConfig {
  featureFlags: FeatureFlags;
  environment: EnvironmentConfig;
  customThresholds: {
    [key: string]: number | boolean | string;
  };
  analysisPreferences: {
    skipMobileAnalysis: boolean;
    skipPerformanceAnalysis: boolean;
    skipAccessibilityAnalysis: boolean;
    skipStructuredDataAnalysis: boolean;
    enableDeepContentAnalysis: boolean;
    enableCompetitorComparison: boolean;
  };
}

export interface TestScenarios {
  perfectSEOSite: string;
  poorSEOSite: string;
  mixedContentSite: string;
  technicalIssuesSite: string;
  geoOptimizedSite: string;
}

// Analysis Engine Interfaces
export interface TechnicalSEOResult {
  pageSpeed: number;
  mobileResponsive: boolean;
  crawlability: QualityScore;
  coreWebVitals: CoreWebVitalsResult;
}

export interface ContentSEOResult {
  titleTag: QualityScore;
  metaDescription: QualityScore;
  headingStructure: QualityScore;
  keywordOptimization: QualityScore;
  contentLength: number;
}

export interface StructureResult {
  internalLinks: number;
  urlStructure: QualityScore;
  sitemapPresent: boolean;
  accessibility: QualityScore;
}

export interface ReadabilityResult {
  contentClarity: QualityScore;
  questionAnswerFormat: boolean;
  informationHierarchy: QualityScore;
  topicCoverage: QualityScore;
}

export interface CredibilityResult {
  authorInformation: boolean;
  citations: number;
  expertiseIndicators: string[];
  sourceCredibility: QualityScore;
}

export interface CompletenessResult {
  topicCoverage: QualityScore;
  informationGaps: string[];
  comprehensiveness: number;
}

export interface StructuredDataResult {
  overallScore: QualityScore;
  jsonLdData: StructuredDataItem[];
  microdataItems: StructuredDataItem[];
  rdfaItems: StructuredDataItem[];
  schemaValidation: SchemaValidationResult[];
  recommendations: StructuredDataRecommendation[];
}

export interface StructuredDataItem {
  type: string;
  format: 'JSON-LD' | 'Microdata' | 'RDFa';
  properties: Record<string, any>;
  isValid: boolean;
  errors: string[];
  location: string;
}

export interface SchemaValidationResult {
  schemaType: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completeness: number;
}

export interface StructuredDataRecommendation {
  schemaType: string;
  priority: 'High' | 'Medium' | 'Low';
  description: string;
  implementation: string;
  example: string;
}

// Service Interfaces
export interface URLValidationService {
  validateURLs(urls: string[]): ValidationResult;
  normalizeDomain(url: string): string;
  checkDomainConsistency(urls: string[]): boolean;
}

export interface SEOAnalysisEngine {
  analyzeTechnicalSEO(url: string): Promise<TechnicalSEOResult>;
  analyzeContentSEO(url: string): Promise<ContentSEOResult>;
  analyzeStructure(url: string): Promise<StructureResult>;
}

export interface GEOAnalysisEngine {
  analyzeAIReadability(content: string): Promise<ReadabilityResult>;
  analyzeCredibility(url: string): Promise<CredibilityResult>;
  analyzeCompleteness(content: string, topic: string): Promise<CompletenessResult>;
}

export interface ScoringEngine {
  calculateOverallScore(results: AnalysisResults): number;
  generateRecommendations(results: AnalysisResults): Recommendation[];
  prioritizeRecommendations(recommendations: Recommendation[]): Recommendation[];
}

// Error Handling
export interface NetworkError extends Error {
  code: string;
  url: string;
  statusCode?: number;
}

export interface ParsingError extends Error {
  code: string;
  url: string;
  element?: string;
}

export interface APIError extends Error {
  code: string;
  service: string;
  statusCode?: number;
  retryAfter?: number;
}

export interface PartialResults {
  completedChecks: string[];
  failedChecks: string[];
  results: Partial<AnalysisResults>;
  errors: Error[];
}

export interface ErrorContext {
  jobId?: string;
  url?: string;
  userId?: string;
  userAgent?: string;
  timestamp: Date;
  retryAttempt?: number;
  operationType?: string;
}

export interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  lastErrorTime: Date;
  errorsByType: Record<string, number>;
  errorsByService: Record<string, number>;
}

export interface TroubleshootingGuide {
  errorType: string;
  userMessage: string;
  technicalDetails: string;
  possibleCauses: string[];
  suggestedActions: string[];
  preventionTips: string[];
}

export interface ErrorHandler {
  handleNetworkError(error: NetworkError, context?: ErrorContext): PartialResults;
  handleParsingError(error: ParsingError, context?: ErrorContext): PartialResults;
  handleAPIError(error: APIError, context?: ErrorContext): PartialResults;
  retryWithBackoff(operation: () => Promise<any>, maxRetries: number): Promise<any>;
  retryWithCircuitBreaker(operation: () => Promise<any>, maxRetries?: number, baseDelay?: number, circuitBreakerThreshold?: number): Promise<any>;
  getTroubleshootingGuide(errorCode: string): TroubleshootingGuide | null;
  getUserFriendlyErrorMessage(error: Error): string;
  getErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical';
  shouldTriggerAlert(error: Error): boolean;
  logError(error: Error, context?: ErrorContext): void;
  getErrorMetrics(): ErrorMetrics;
  resetErrorMetrics(): void;
  logErrorSummary(errors: Error[], context?: { jobId?: string; url?: string }): void;
  validateRecoveryStrategy(error: Error, recoveryFn: () => Promise<any>): Promise<boolean>;
}

// API Request/Response Types
export interface AnalysisRequest {
  urls: string[];
  config?: Partial<AnalysisConfig>;
}

export interface AnalysisResponse {
  success: boolean;
  results: AnalysisResults[];
  errors?: ValidationError[];
  jobId?: string;
}

export interface AnalysisStatus {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  completedUrls: number;
  totalUrls: number;
  results?: AnalysisResults[];
  error?: string;
}

export interface ExportRequest {
  format: 'pdf' | 'csv' | 'json';
  results: AnalysisResults[];
  includeDetails: boolean;
  customNotes?: string;
  branding?: {
    companyName?: string;
    logo?: string;
    colors?: {
      primary?: string;
      secondary?: string;
    };
  };
}

export interface ExportResponse {
  success: boolean;
  downloadUrl?: string;
  filePath?: string;
  error?: string;
  metadata?: {
    format: string;
    fileSize: number;
    generatedAt: Date;
  };
}

// Performance Analysis Types
export interface CoreWebVitalsResult {
  lcp: number; // Largest Contentful Paint in milliseconds
  fid: number; // First Input Delay in milliseconds
  cls: number; // Cumulative Layout Shift (unitless)
  fcp: number; // First Contentful Paint in milliseconds
  ttfb: number; // Time to First Byte in milliseconds
  score: number; // Overall performance score (0-100)
}

export interface PerformanceMetrics {
  coreWebVitals: CoreWebVitalsResult;
  loadingMetrics: {
    domContentLoaded: number;
    loadComplete: number;
    resourceLoadTime: number;
    renderBlockingResources: number;
  };
  interactivityMetrics: {
    timeToInteractive: number;
    totalBlockingTime: number;
    maxPotentialFid: number;
  };
  visualMetrics: {
    speedIndex: number;
    largestContentfulPaint: number;
    cumulativeLayoutShift: number;
  };
}

export interface PerformanceAnalysisResult {
  url: string;
  timestamp: Date;
  metrics: PerformanceMetrics;
  recommendations: PerformanceRecommendation[];
  lighthouseScore?: number;
  errors?: string[];
}

export interface PerformanceRecommendation {
  metric: string;
  currentValue: number;
  targetValue: number;
  impact: 'High' | 'Medium' | 'Low';
  suggestions: string[];
}

// Results Storage and Aggregation Types
export interface StoredAnalysisResults extends AnalysisResults {
  id: string;
  domain: string;
  analysisVersion: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface AnalysisSession {
  id: string;
  domain: string;
  urls: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  results: StoredAnalysisResults[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface ResultsFilter {
  domain?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minScore?: number;
  maxScore?: number;
  categories?: ('SEO' | 'GEO' | 'Technical')[];
  limit?: number;
  offset?: number;
}

export interface ResultsQuery {
  filter?: ResultsFilter;
  sortBy?: 'timestamp' | 'overallScore' | 'domain';
  sortOrder?: 'asc' | 'desc';
}

export interface AggregatedResults {
  totalResults: number;
  results: StoredAnalysisResults[];
  summary: {
    averageScore: number;
    scoreDistribution: Record<string, number>;
    commonIssues: string[];
    topRecommendations: Recommendation[];
  };
}

export interface ResultsAggregator {
  aggregateResults(results: AnalysisResults[]): Promise<StoredAnalysisResults[]>;
  storeResults(results: StoredAnalysisResults[]): Promise<void>;
  retrieveResults(query: ResultsQuery): Promise<AggregatedResults>;
  getResultById(id: string): Promise<StoredAnalysisResults | null>;
  deleteResults(ids: string[]): Promise<void>;
  getSessionResults(sessionId: string): Promise<AnalysisSession | null>;
}