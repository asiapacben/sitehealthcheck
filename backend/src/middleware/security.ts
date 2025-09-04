import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

/**
 * Enhanced rate limiting for different endpoint types
 */
export const createRateLimit = (options: {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      error: 'Rate limit exceeded',
      message: options.message,
      retryAfter: Math.ceil(options.windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });

      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: options.message,
        retryAfter: Math.ceil(options.windowMs / 1000)
      });
    }
  });
};

/**
 * Analysis-specific rate limiting (more restrictive)
 */
export const analysisRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 analysis requests per 15 minutes
  message: 'Too many analysis requests. Please wait before starting another analysis.',
  skipSuccessfulRequests: true
});

/**
 * Validation rate limiting (less restrictive)
 */
export const validationRateLimit = createRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 validation requests per 5 minutes
  message: 'Too many validation requests. Please slow down.'
});

/**
 * Export rate limiting
 */
export const exportRateLimit = createRateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // 20 export requests per 10 minutes
  message: 'Too many export requests. Please wait before generating more reports.'
});

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none';"
  );

  next();
};

/**
 * Request size validation
 */
export const validateRequestSize = (req: Request, res: Response, next: NextFunction): void => {
  const contentLength = req.get('content-length');
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength && parseInt(contentLength) > maxSize) {
    logger.warn('Request size too large', {
      ip: req.ip,
      path: req.path,
      contentLength: contentLength,
      maxSize: maxSize
    });

    res.status(413).json({
      success: false,
      error: 'Payload too large',
      message: `Request size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
    });
    return;
  }

  next();
};

/**
 * IP whitelist/blacklist middleware
 */
export const ipFilter = (req: Request, res: Response, next: NextFunction): void => {
  const clientIP = req.ip || req.connection.remoteAddress || '';
  
  // Blacklisted IPs (could be loaded from database or config)
  const blacklistedIPs = process.env.BLACKLISTED_IPS?.split(',') || [];
  
  if (blacklistedIPs.includes(clientIP)) {
    logger.warn('Blocked request from blacklisted IP', {
      ip: clientIP,
      path: req.path,
      method: req.method
    });

    res.status(403).json({
      success: false,
      error: 'Access denied',
      message: 'Your IP address has been blocked'
    });
    return;
  }

  next();
};

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length')
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: duration,
      ip: req.ip
    });
  });

  next();
};

/**
 * API key validation (if API keys are required)
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  // Skip API key validation in development
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return next();
  }

  const apiKey = req.get('X-API-Key') || req.query.apiKey as string;
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

  if (validApiKeys.length > 0 && !apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'API key is required'
    });
  }

  if (validApiKeys.length > 0 && !validApiKeys.includes(apiKey)) {
    logger.warn('Invalid API key used', {
      ip: req.ip,
      path: req.path,
      apiKey: apiKey?.substring(0, 8) + '...' // Log partial key for debugging
    });

    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: 'Invalid API key'
    });
  }

  next();
};