import { Router } from 'express';
import { ValidationController } from '../controllers/ValidationController';
import { validateRequest, validationSchemas } from '../middleware/validation';
import { validationRateLimit } from '../middleware/security';

const router = Router();

// Apply validation-specific rate limiting to all routes
router.use(validationRateLimit);

/**
 * @swagger
 * /api/validation/urls:
 *   post:
 *     summary: Validate multiple URLs
 *     description: Validate multiple URLs for same-domain consistency and format correctness
 *     tags: [Validation]
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
 *                 minItems: 1
 *                 maxItems: 10
 *                 example: ["https://example.com", "https://example.com/about"]
 *     responses:
 *       200:
 *         description: URLs validated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationResult'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/urls',
    validateRequest(validationSchemas.urlList),
    ValidationController.validateUrls
);

/**
 * @swagger
 * /api/validation/domain-consistency:
 *   post:
 *     summary: Check domain consistency
 *     description: Verify that all provided URLs belong to the same domain
 *     tags: [Validation]
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
 *                 minItems: 1
 *                 example: ["https://example.com", "https://example.com/about"]
 *     responses:
 *       200:
 *         description: Domain consistency check completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 consistent:
 *                   type: boolean
 *                 domain:
 *                   type: string
 *                 inconsistentUrls:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/domain-consistency',
    validateRequest(validationSchemas.urlList),
    ValidationController.checkDomainConsistency
);

/**
 * @swagger
 * /api/validation/normalize-url:
 *   post:
 *     summary: Normalize URL
 *     description: Convert a URL to its normalized standard format
 *     tags: [Validation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 example: "example.com/page"
 *     responses:
 *       200:
 *         description: URL normalized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 originalUrl:
 *                   type: string
 *                 normalizedUrl:
 *                   type: string
 *                 domain:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/normalize-url',
    validateRequest(validationSchemas.singleUrl),
    ValidationController.normalizeUrl
);

/**
 * @swagger
 * /api/validation/check-accessibility:
 *   post:
 *     summary: Check URL accessibility
 *     description: Verify if a URL is accessible and returns valid response
 *     tags: [Validation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: "https://example.com"
 *     responses:
 *       200:
 *         description: Accessibility check completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 accessible:
 *                   type: boolean
 *                 statusCode:
 *                   type: number
 *                 responseTime:
 *                   type: number
 *                 error:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/check-accessibility',
    validateRequest(validationSchemas.accessibilityCheck),
    ValidationController.checkUrlAccessibility
);

export default router;