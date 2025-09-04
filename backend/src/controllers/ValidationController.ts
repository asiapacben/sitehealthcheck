import { Request, Response } from 'express';
import { URLValidationServiceImpl } from '../services/URLValidationService';
import { logger } from '../utils/logger';
import Joi from 'joi';

const urlValidationService = new URLValidationServiceImpl();

// Validation schema for URL validation requests
const validateUrlsSchema = Joi.object({
  urls: Joi.array()
    .items(Joi.string().uri().required())
    .min(1)
    .max(parseInt(process.env.MAX_URLS_PER_REQUEST || '10'))
    .required()
    .messages({
      'array.min': 'At least one URL is required',
      'array.max': `Maximum ${process.env.MAX_URLS_PER_REQUEST || '10'} URLs allowed`,
      'any.required': 'URLs array is required'
    })
});

export class ValidationController {
  /**
   * Validates a list of URLs
   * POST /api/validate-urls
   */
  static async validateUrls(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = validateUrlsSchema.validate(req.body);
      
      if (error) {
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

      const { urls } = value;
      
      logger.info(`Validating ${urls.length} URLs`, { 
        urlCount: urls.length,
        firstUrl: urls[0] 
      });

      // Perform URL validation
      const validationResult = urlValidationService.validateURLs(urls);

      // Log validation results
      if (validationResult.valid) {
        logger.info('URL validation successful', {
          urlCount: validationResult.normalizedUrls.length,
          domain: urlValidationService.normalizeDomain(validationResult.normalizedUrls[0])
        });
      } else {
        logger.warn('URL validation failed', {
          errorCount: validationResult.errors.length,
          errors: validationResult.errors.map(e => e.code)
        });
      }

      // Return validation results
      res.json({
        success: validationResult.valid,
        data: {
          valid: validationResult.valid,
          normalizedUrls: validationResult.normalizedUrls,
          domain: validationResult.normalizedUrls.length > 0 
            ? urlValidationService.normalizeDomain(validationResult.normalizedUrls[0])
            : null,
          urlCount: validationResult.normalizedUrls.length
        },
        errors: validationResult.errors.length > 0 ? validationResult.errors : undefined
      });

    } catch (error) {
      logger.error('Error in URL validation:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to validate URLs'
      });
    }
  }

  /**
   * Checks domain consistency for a list of URLs
   * POST /api/check-domain-consistency
   */
  static async checkDomainConsistency(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = validateUrlsSchema.validate(req.body);
      
      if (error) {
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

      const { urls } = value;
      
      const isConsistent = urlValidationService.checkDomainConsistency(urls);
      
      let domain: string | null = null;
      if (isConsistent && urls.length > 0) {
        try {
          domain = urlValidationService.normalizeDomain(urls[0]);
        } catch (error) {
          logger.warn('Could not extract domain from first URL', { url: urls[0] });
        }
      }

      res.json({
        success: true,
        data: {
          consistent: isConsistent,
          domain,
          urlCount: urls.length
        }
      });

    } catch (error) {
      logger.error('Error checking domain consistency:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to check domain consistency'
      });
    }
  }

  /**
   * Normalizes a single URL
   * POST /api/normalize-url
   */
  static async normalizeUrl(req: Request, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        url: Joi.string().required().messages({
          'any.required': 'URL is required',
          'string.empty': 'URL cannot be empty'
        })
      });

      const { error, value } = schema.validate(req.body);
      
      if (error) {
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

      const { url } = value;
      
      // Validate single URL
      const validationResult = urlValidationService.validateURLs([url]);
      
      if (validationResult.valid) {
        const normalizedUrl = validationResult.normalizedUrls[0];
        const domain = urlValidationService.normalizeDomain(normalizedUrl);
        
        res.json({
          success: true,
          data: {
            originalUrl: url,
            normalizedUrl,
            domain
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'URL validation failed',
          details: validationResult.errors
        });
      }

    } catch (error) {
      logger.error('Error normalizing URL:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to normalize URL'
      });
    }
  }

  /**
   * Checks URL accessibility
   * POST /api/check-url-accessibility
   */
  static async checkUrlAccessibility(req: Request, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        url: Joi.string().uri().required().messages({
          'any.required': 'URL is required',
          'string.uri': 'Must be a valid URL'
        })
      });

      const { error, value } = schema.validate(req.body);
      
      if (error) {
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

      const { url } = value;
      
      // First validate the URL format
      const validationResult = urlValidationService.validateURLs([url]);
      
      if (!validationResult.valid) {
        res.status(400).json({
          success: false,
          error: 'URL validation failed',
          details: validationResult.errors
        });
        return;
      }

      // Check accessibility
      const normalizedUrl = validationResult.normalizedUrls[0];
      const accessibilityResult = await urlValidationService.validateURLAccessibility(normalizedUrl);
      
      res.json({
        success: true,
        data: {
          url: normalizedUrl,
          accessible: accessibilityResult.accessible,
          statusCode: accessibilityResult.statusCode,
          error: accessibilityResult.error
        }
      });

    } catch (error) {
      logger.error('Error checking URL accessibility:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to check URL accessibility'
      });
    }
  }
}