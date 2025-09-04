import { Router } from 'express';
import { ConfigController } from '../controllers/ConfigController';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();

// Validation schemas
const scoringWeightsValidation = [
  body('seoWeights.technical').optional().isFloat({ min: 0, max: 1 }),
  body('seoWeights.content').optional().isFloat({ min: 0, max: 1 }),
  body('seoWeights.structure').optional().isFloat({ min: 0, max: 1 }),
  body('geoWeights.readability').optional().isFloat({ min: 0, max: 1 }),
  body('geoWeights.credibility').optional().isFloat({ min: 0, max: 1 }),
  body('geoWeights.completeness').optional().isFloat({ min: 0, max: 1 }),
  body('geoWeights.structuredData').optional().isFloat({ min: 0, max: 1 })
];

const thresholdsValidation = [
  body('pageSpeedMin').optional().isInt({ min: 0, max: 100 }),
  body('contentLengthMin').optional().isInt({ min: 0 }),
  body('headingLevels').optional().isInt({ min: 1, max: 6 })
];

const featureFlagsValidation = [
  body('enableExperimentalGEO').optional().isBoolean(),
  body('enableAdvancedStructuredData').optional().isBoolean(),
  body('enableAIContentAnalysis').optional().isBoolean(),
  body('enablePerformanceOptimizations').optional().isBoolean(),
  body('enableBetaRecommendations').optional().isBoolean()
];

const environmentConfigValidation = [
  body('environment').optional().isIn(['development', 'staging', 'production']),
  body('logLevel').optional().isIn(['debug', 'info', 'warn', 'error']),
  body('enableMetrics').optional().isBoolean(),
  body('enableCaching').optional().isBoolean(),
  body('cacheTimeout').optional().isInt({ min: 0 }),
  body('maxConcurrentAnalyses').optional().isInt({ min: 1 }),
  body('analysisTimeout').optional().isInt({ min: 1000 }),
  body('retryAttempts').optional().isInt({ min: 0 }),
  body('retryDelay').optional().isInt({ min: 0 })
];

/**
 * @swagger
 * /api/config:
 *   get:
 *     summary: Get current configuration
 *     tags: [Configuration]
 *     responses:
 *       200:
 *         description: Current configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 config:
 *                   $ref: '#/components/schemas/ExtendedAnalysisConfig'
 */
router.get('/', ConfigController.getConfig);

/**
 * @swagger
 * /api/config/scoring-weights:
 *   put:
 *     summary: Update scoring weights
 *     tags: [Configuration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               seoWeights:
 *                 type: object
 *                 properties:
 *                   technical:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                   content:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                   structure:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *               geoWeights:
 *                 type: object
 *                 properties:
 *                   readability:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                   credibility:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                   completeness:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                   structuredData:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *     responses:
 *       200:
 *         description: Scoring weights updated successfully
 */
router.put('/scoring-weights', scoringWeightsValidation, validateRequest, ConfigController.updateScoringWeights);

/**
 * @swagger
 * /api/config/thresholds:
 *   put:
 *     summary: Update analysis thresholds
 *     tags: [Configuration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pageSpeedMin:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *               contentLengthMin:
 *                 type: integer
 *                 minimum: 0
 *               headingLevels:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 6
 *     responses:
 *       200:
 *         description: Thresholds updated successfully
 */
router.put('/thresholds', thresholdsValidation, validateRequest, ConfigController.updateThresholds);

/**
 * @swagger
 * /api/config/feature-flags:
 *   put:
 *     summary: Update feature flags
 *     tags: [Configuration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enableExperimentalGEO:
 *                 type: boolean
 *               enableAdvancedStructuredData:
 *                 type: boolean
 *               enableAIContentAnalysis:
 *                 type: boolean
 *               enablePerformanceOptimizations:
 *                 type: boolean
 *               enableBetaRecommendations:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Feature flags updated successfully
 */
router.put('/feature-flags', featureFlagsValidation, validateRequest, ConfigController.updateFeatureFlags);

/**
 * @swagger
 * /api/config/environment:
 *   put:
 *     summary: Update environment configuration
 *     tags: [Configuration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               environment:
 *                 type: string
 *                 enum: [development, staging, production]
 *               logLevel:
 *                 type: string
 *                 enum: [debug, info, warn, error]
 *               enableMetrics:
 *                 type: boolean
 *               enableCaching:
 *                 type: boolean
 *               cacheTimeout:
 *                 type: integer
 *                 minimum: 0
 *               maxConcurrentAnalyses:
 *                 type: integer
 *                 minimum: 1
 *               analysisTimeout:
 *                 type: integer
 *                 minimum: 1000
 *               retryAttempts:
 *                 type: integer
 *                 minimum: 0
 *               retryDelay:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Environment configuration updated successfully
 */
router.put('/environment', environmentConfigValidation, validateRequest, ConfigController.updateEnvironmentConfig);

/**
 * @swagger
 * /api/config/presets:
 *   get:
 *     summary: Get available configuration presets
 *     tags: [Configuration]
 *     responses:
 *       200:
 *         description: Available configuration presets
 */
router.get('/presets', ConfigController.getPresets);

/**
 * @swagger
 * /api/config/presets/{presetName}:
 *   post:
 *     summary: Apply configuration preset
 *     tags: [Configuration]
 *     parameters:
 *       - in: path
 *         name: presetName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the preset to apply
 *     responses:
 *       200:
 *         description: Preset applied successfully
 */
router.post('/presets/:presetName', 
  param('presetName').isString().notEmpty(),
  validateRequest,
  ConfigController.applyPreset
);

/**
 * @swagger
 * /api/config/reset:
 *   post:
 *     summary: Reset configuration to defaults
 *     tags: [Configuration]
 *     responses:
 *       200:
 *         description: Configuration reset to defaults
 */
router.post('/reset', ConfigController.resetToDefaults);

/**
 * @swagger
 * /api/config/validate:
 *   post:
 *     summary: Validate configuration
 *     tags: [Configuration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExtendedAnalysisConfig'
 *     responses:
 *       200:
 *         description: Configuration validation result
 */
router.post('/validate', ConfigController.validateConfig);

/**
 * @swagger
 * /api/config/threshold/{key}:
 *   get:
 *     summary: Get specific threshold value
 *     tags: [Configuration]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Threshold key name
 *     responses:
 *       200:
 *         description: Threshold value
 */
router.get('/threshold/:key',
  param('key').isString().notEmpty(),
  validateRequest,
  ConfigController.getThreshold
);

/**
 * @swagger
 * /api/config/feature/{feature}:
 *   get:
 *     summary: Check if feature is enabled
 *     tags: [Configuration]
 *     parameters:
 *       - in: path
 *         name: feature
 *         required: true
 *         schema:
 *           type: string
 *         description: Feature flag name
 *     responses:
 *       200:
 *         description: Feature status
 */
router.get('/feature/:feature',
  param('feature').isString().notEmpty(),
  validateRequest,
  ConfigController.checkFeature
);

/**
 * @swagger
 * /api/config/export:
 *   get:
 *     summary: Export configuration
 *     tags: [Configuration]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json]
 *           default: json
 *         description: Export format
 *     responses:
 *       200:
 *         description: Configuration exported successfully
 */
router.get('/export',
  query('format').optional().isIn(['json']),
  validateRequest,
  ConfigController.exportConfig
);

/**
 * @swagger
 * /api/config/import:
 *   post:
 *     summary: Import configuration
 *     tags: [Configuration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExtendedAnalysisConfig'
 *     responses:
 *       200:
 *         description: Configuration imported successfully
 */
router.post('/import', ConfigController.importConfig);

export default router;