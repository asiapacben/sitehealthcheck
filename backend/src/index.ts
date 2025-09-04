import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { logger } from './utils/logger';
import { swaggerSpec } from './config/swagger';
import { 
  securityHeaders, 
  validateRequestSize, 
  ipFilter, 
  requestLogger,
  createRateLimit
} from './middleware/security';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // We'll handle CSP in our custom middleware
}));
app.use(securityHeaders);
app.use(ipFilter);
app.use(requestLogger);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Global rate limiting
const globalLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(globalLimiter);

// Request size validation
app.use(validateRequestSize);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Import routes
import validationRoutes from './routes/validation';
import analysisRoutes from './routes/analysis';
import exportRoutes from './routes/export';
import configRoutes from './routes/config';

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SEO & GEO Health Checker API Documentation'
}));

// API routes
app.use('/api/validation', validationRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/config', configRoutes);

app.get('/api', (req, res) => {
  res.json({ 
    message: 'SEO & GEO Health Checker API',
    version: '1.0.0',
    documentation: '/api-docs',
    endpoints: {
      health: '/health',
      validation: '/api/validation',
      analysis: '/api/analysis',
      export: '/api/export',
      config: '/api/config'
    }
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

app.listen(PORT, () => {
  logger.info(`SEO & GEO Health Checker API server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});