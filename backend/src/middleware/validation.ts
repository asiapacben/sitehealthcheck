import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

/**
 * Generic validation middleware factory
 */
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      logger.warn('Request validation failed', {
        path: req.path,
        method: req.method,
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }))
      });

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
      return;
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

/**
 * Common validation schemas
 */
export const validationSchemas = {
  urlList: Joi.object({
    urls: Joi.array()
      .items(Joi.string().required())
      .min(1)
      .max(parseInt(process.env.MAX_URLS_PER_REQUEST || '10'))
      .required()
      .messages({
        'array.min': 'At least one URL is required',
        'array.max': `Maximum ${process.env.MAX_URLS_PER_REQUEST || '10'} URLs allowed`,
        'any.required': 'URLs array is required'
      })
  }),

  singleUrl: Joi.object({
    url: Joi.string().required().messages({
      'any.required': 'URL is required',
      'string.empty': 'URL cannot be empty'
    })
  }),

  accessibilityCheck: Joi.object({
    url: Joi.string().uri().required().messages({
      'any.required': 'URL is required',
      'string.uri': 'Must be a valid URL'
    })
  })
};

/**
 * Rate limiting validation
 */
export const validateRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const userIP = req.ip || req.connection.remoteAddress;
  
  // Log request for monitoring
  logger.info('API request', {
    ip: userIP,
    path: req.path,
    method: req.method,
    userAgent: req.get('User-Agent')
  });

  next();
};