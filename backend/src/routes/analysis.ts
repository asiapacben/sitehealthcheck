import { Router } from 'express';
import { AnalysisController } from '../controllers/AnalysisController';
import { validateRequest } from '../middleware/validation';
import { analysisRateLimit } from '../middleware/security';
import Joi from 'joi';

const router = Router();

// Apply analysis-specific rate limiting to all routes
router.use(analysisRateLimit);

// Validation schemas
const startAnalysisSchema = Joi.object({
  urls: Joi.array()
    .items(Joi.string().required())
    .min(1)
    .max(parseInt(process.env.MAX_URLS_PER_REQUEST || '10'))
    .required()
    .messages({
      'array.min': 'At least one URL is required',
      'array.max': `Maximum ${process.env.MAX_URLS_PER_REQUEST || '10'} URLs allowed`,
      'any.required': 'URLs array is required'
    }),
  config: Joi.object({
    seoWeights: Joi.object({
      technical: Joi.number().min(0).max(1),
      content: Joi.number().min(0).max(1),
      structure: Joi.number().min(0).max(1)
    }),
    geoWeights: Joi.object({
      readability: Joi.number().min(0).max(1),
      credibility: Joi.number().min(0).max(1),
      completeness: Joi.number().min(0).max(1),
      structuredData: Joi.number().min(0).max(1)
    }),
    thresholds: Joi.object({
      pageSpeedMin: Joi.number().min(0).max(100),
      contentLengthMin: Joi.number().min(0),
      headingLevels: Joi.number().min(1).max(6)
    })
  }).optional()
});

const jobIdSchema = Joi.object({
  jobId: Joi.string().uuid().required().messages({
    'string.uuid': 'Job ID must be a valid UUID',
    'any.required': 'Job ID is required'
  })
});

/**
 * @swagger
 * /api/analysis/start:
 *   post:
 *     summary: Start a new website analysis job
 *     description: Initiates a comprehensive SEO and GEO analysis for the provided URLs
 *     tags: [Analysis]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - urls
 *             properties:
 *               urls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 minItems: 1
 *                 maxItems: 10
 *                 example: ["https://example.com", "https://example.com/about"]
 *               config:
 *                 type: object
 *                 properties:
 *                   seoWeights:
 *                     type: object
 *                     properties:
 *                       technical:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 1
 *                       content:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 1
 *                       structure:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 1
 *                   geoWeights:
 *                     type: object
 *                     properties:
 *                       readability:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 1
 *                       credibility:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 1
 *                       completeness:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 1
 *                       structuredData:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 1
 *     responses:
 *       200:
 *         description: Analysis job started successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalysisJob'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/start',
  validateRequest(startAnalysisSchema),
  AnalysisController.startAnalysis
);

/**
 * @swagger
 * /api/analysis/status/{jobId}:
 *   get:
 *     summary: Get analysis job status
 *     description: Retrieve the current status and progress of an analysis job
 *     tags: [Analysis]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique identifier of the analysis job
 *     responses:
 *       200:
 *         description: Job status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalysisStatus'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/status/:jobId',
  AnalysisController.getAnalysisStatus
);

/**
 * @swagger
 * /api/analysis/results/{jobId}:
 *   get:
 *     summary: Get analysis results
 *     description: Retrieve the complete results of a finished analysis job
 *     tags: [Analysis]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique identifier of the analysis job
 *     responses:
 *       200:
 *         description: Analysis results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalysisResults'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/results/:jobId',
  AnalysisController.getAnalysisResults
);

/**
 * @swagger
 * /api/analysis/cancel/{jobId}:
 *   post:
 *     summary: Cancel analysis job
 *     description: Cancel a running or pending analysis job
 *     tags: [Analysis]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique identifier of the analysis job
 *     responses:
 *       200:
 *         description: Job cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Analysis job cancelled successfully"
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/cancel/:jobId',
  AnalysisController.cancelAnalysis
);

/**
 * @swagger
 * /api/analysis/stats:
 *   get:
 *     summary: Get analysis statistics
 *     description: Retrieve system statistics and performance metrics
 *     tags: [Analysis]
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalJobs:
 *                       type: number
 *                     activeJobs:
 *                       type: number
 *                     completedJobs:
 *                       type: number
 *                     failedJobs:
 *                       type: number
 *                     averageProcessingTime:
 *                       type: number
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/stats',
  AnalysisController.getStats
);

export default router;