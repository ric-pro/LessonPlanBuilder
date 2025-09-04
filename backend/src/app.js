/**
 * Main Express Application for Lesson Plan Builder API
 * University of Canberra - Master of Information Technology and Systems Program
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Import configuration and utilities
const { config, validateConfig } = require('./config');
const logger = require('./utils/logger');

// Import routes
const healthRoutes = require('./api/routes/health');
const lessonRoutes = require('./api/routes/lesson');

/**
 * Initialize Express application
 */
const app = express();

/**
 * Validate configuration on startup
 */
try {
  validateConfig();
  logger.info('Application starting', {
    name: config.app.name,
    version: config.app.version,
    environment: config.server.environment,
    port: config.server.port
  });
} catch (error) {
  logger.error('Configuration validation failed', error);
  process.exit(1);
}

/**
 * Create required directories
 */
function createRequiredDirectories() {
  const directories = [
    'data/uploads',
    'data/processed',
    'data/chroma_db',
    'logs'
  ];

  directories.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      logger.info(`Created directory: ${fullPath}`);
    }
  });
}

createRequiredDirectories();

/**
 * Security middleware
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

/**
 * CORS configuration
 */
app.use(cors({
  origin: config.server.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

/**
 * Rate limiting
 */
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
    });
  }
});

app.use('/api/', limiter);

/**
 * Body parsing middleware
 */
app.use(express.json({ 
  limit: '10mb',
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

/**
 * Request logging middleware
 */
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    logger.logRequest(req, res, duration);
    originalEnd.apply(this, args);
  };

  next();
});

/**
 * API Routes
 */
app.use('/api/health', healthRoutes);
app.use('/api/lesson', lessonRoutes);

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Lesson Plan Builder API',
    data: {
      name: config.app.name,
      version: config.app.version,
      description: config.app.description,
      environment: config.server.environment,
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/api/health',
        lessonGeneration: '/api/lesson/generate',
        documentation: '/api/docs'
      }
    }
  });
});

/**
 * API documentation endpoint
 */
app.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    message: 'API Documentation',
    data: {
      version: config.app.version,
      baseUrl: `${req.protocol}://${req.get('host')}/api`,
      endpoints: {
        health: {
          basic: 'GET /health',
          detailed: 'GET /health/detailed',
          ready: 'GET /health/ready',
          live: 'GET /health/live'
        },
        lesson: {
          generate: 'POST /lesson/generate',
          get: 'GET /lesson/:id',
          list: 'GET /lesson',
          delete: 'DELETE /lesson/:id'
        }
      },
      schemas: {
        lessonGeneration: {
          subject: 'string (intro-it, intro-data-science, intro-statistics)',
          focusTopic: 'string (3-200 chars)',
          bloomsLevel: 'string (remember, understand, apply, analyze, evaluate, create)',
          aqfLevel: 'string (aqf7, aqf8, aqf9)',
          duration: 'number (30-300 minutes)',
          assessmentType: 'string (formative, summative, peer, self, mixed)',
          additionalRequirements: 'string (optional, max 1000 chars)'
        }
      }
    }
  });
});

/**
 * 404 handler
 */
app.use('*', (req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.url,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    message: 'Route not found',
    data: {
      method: req.method,
      url: req.url,
      availableEndpoints: [
        'GET /',
        'GET /api/health',
        'POST /api/lesson/generate',
        'GET /api/docs'
      ]
    }
  });
});

/**
 * Global error handler
 */
app.use((error, req, res, next) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: config.server.environment === 'development' ? error.message : 'Something went wrong'
  });
});

/**
 * Graceful shutdown handling
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', {
    reason: reason.toString(),
    promise: promise.toString()
  });
  process.exit(1);
});

/**
 * Start server
 */
const server = app.listen(config.server.port, '0.0.0.0', () => {
  logger.info('Server started successfully', {
    port: config.server.port,
    environment: config.server.environment,
    pid: process.pid
  });
});

// Set server timeout
server.timeout = 120000; // 2 minutes

module.exports = app;

