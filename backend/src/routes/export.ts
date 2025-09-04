import { Router } from 'express';
import { ExportController } from '../controllers/ExportController';
import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { exportRateLimit } from '../middleware/security';

const router = Router();
const exportController = new ExportController();

// Apply export-specific rate limiting to all routes
router.use(exportRateLimit);

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
    return;
  }
  next();
};

// Validation rules
const exportValidation = [
  body('format')
    .isIn(['pdf', 'csv', 'json'])
    .withMessage('Format must be pdf, csv, or json'),
  body('results')
    .isArray({ min: 1 })
    .withMessage('Results must be a non-empty array'),
  body('results.*.url')
    .isURL()
    .withMessage('Each result must have a valid URL'),
  body('results.*.overallScore')
    .isNumeric()
    .custom((value) => {
      if (value < 0 || value > 100) {
        throw new Error('Overall score must be between 0 and 100');
      }
      return true;
    }),
  body('includeDetails')
    .optional()
    .isBoolean()
    .withMessage('includeDetails must be a boolean'),
  body('customNotes')
    .optional()
    .isString()
    .isLength({ max: 5000 })
    .withMessage('Custom notes must be a string with max 5000 characters'),
  body('branding.companyName')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('Company name must be a string with max 100 characters'),
  body('branding.colors.primary')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Primary color must be a valid hex color'),
  body('branding.colors.secondary')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Secondary color must be a valid hex color')
];

const multiFormatValidation = [
  body('formats')
    .isArray({ min: 1 })
    .withMessage('Formats must be a non-empty array'),
  body('formats.*')
    .isIn(['pdf', 'csv', 'json'])
    .withMessage('Each format must be pdf, csv, or json'),
  body('results')
    .isArray({ min: 1 })
    .withMessage('Results must be a non-empty array'),
  body('results.*.url')
    .isURL()
    .withMessage('Each result must have a valid URL'),
  body('results.*.overallScore')
    .isNumeric()
    .custom((value) => {
      if (value < 0 || value > 100) {
        throw new Error('Overall score must be between 0 and 100');
      }
      return true;
    }),
  body('includeDetails')
    .optional()
    .isBoolean()
    .withMessage('includeDetails must be a boolean')
];

const exportByIdsValidation = [
  body('ids')
    .isArray({ min: 1 })
    .withMessage('IDs must be a non-empty array'),
  body('ids.*')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Each ID must be a non-empty string'),
  body('format')
    .isIn(['pdf', 'csv', 'json'])
    .withMessage('Format must be pdf, csv, or json'),
  body('includeDetails')
    .optional()
    .isBoolean()
    .withMessage('includeDetails must be a boolean')
];

const downloadValidation = [
  param('filename')
    .matches(/^[a-zA-Z0-9_-]+\.(pdf|csv|json)$/)
    .withMessage('Filename must be valid and have pdf, csv, or json extension')
];

const cleanupValidation = [
  query('daysOld')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('daysOld must be an integer between 1 and 365')
];

/**
 * @route POST /api/export
 * @desc Generate a report in specified format
 * @access Public
 * @body {format, results, includeDetails?, customNotes?, branding?}
 */
router.post(
  '/',
  exportValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    await exportController.generateReport(req, res);
  }
);

/**
 * @route POST /api/export/multi
 * @desc Generate reports in multiple formats
 * @access Public
 * @body {formats, results, includeDetails?, customNotes?, branding?}
 */
router.post(
  '/multi',
  multiFormatValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    await exportController.generateMultiFormatReport(req, res);
  }
);

/**
 * @route POST /api/export/by-ids
 * @desc Export results by their IDs
 * @access Public
 * @body {ids, format, includeDetails?, customNotes?, branding?}
 */
router.post(
  '/by-ids',
  exportByIdsValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    await exportController.exportByIds(req, res);
  }
);

/**
 * @route GET /api/export/download/:filename
 * @desc Download a generated report file
 * @access Public
 * @param {string} filename - Name of the file to download
 */
router.get(
  '/download/:filename',
  downloadValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    await exportController.downloadReport(req, res);
  }
);

/**
 * @route GET /api/export/list
 * @desc List all available report files
 * @access Public
 */
router.get('/list', async (req: Request, res: Response) => {
  await exportController.listReports(req, res);
});

/**
 * @route DELETE /api/export/cleanup
 * @desc Clean up old report files
 * @access Public
 * @query {number} daysOld - Number of days old files to delete (default: 30)
 */
router.delete(
  '/cleanup',
  cleanupValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    await exportController.cleanupReports(req, res);
  }
);

export default router;