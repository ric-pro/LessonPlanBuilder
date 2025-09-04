/**
 * Health Check Routes for Lesson Plan Builder API
 * Provides system health monitoring and status endpoints
 */

const express = require('express');
const { config } = require('../../config');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * Basic health check endpoint
 * GET /api/health
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Basic health check response
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: config.app.version,
      name: config.app.name,
      environment: config.server.environment,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      responseTime: Date.now() - startTime
    };

    logger.info('Health check requested', {
      endpoint: '/health',
      status: 'healthy',
      responseTime: healthData.responseTime
    });

    res.status(200).json({
      success: true,
      data: healthData
    });

  } catch (error) {
    logger.error('Health check failed', error);
    
    res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      }
    });
  }
});

/**
 * Detailed health check endpoint
 * GET /api/health/detailed
 */
router.get('/detailed', async (req, res) => {
  try {
    const startTime = Date.now();
    const services = {};
    let overallStatus = 'healthy';

    // Check ChromaDB connection (placeholder for now)
    try {
      // TODO: Implement actual ChromaDB health check in Phase 2
      services.chromadb = {
        status: 'unknown',
        message: 'ChromaDB health check not implemented yet',
        responseTime: null
      };
    } catch (error) {
      services.chromadb = {
        status: 'unhealthy',
        message: error.message,
        responseTime: null
      };
      overallStatus = 'degraded';
    }

    // Check Hugging Face API availability (placeholder for now)
    try {
      // TODO: Implement actual Hugging Face API health check in Phase 4
      services.huggingface = {
        status: 'unknown',
        message: 'Hugging Face API health check not implemented yet',
        responseTime: null
      };
    } catch (error) {
      services.huggingface = {
        status: 'unhealthy',
        message: error.message,
        responseTime: null
      };
      overallStatus = 'degraded';
    }

    // File system check
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Check if data directories exist and are writable
      const dataDir = path.join(process.cwd(), 'data');
      const uploadsDir = path.join(dataDir, 'uploads');
      
      fs.accessSync(dataDir, fs.constants.F_OK | fs.constants.W_OK);
      fs.accessSync(uploadsDir, fs.constants.F_OK | fs.constants.W_OK);
      
      services.filesystem = {
        status: 'healthy',
        message: 'File system accessible and writable',
        responseTime: null
      };
    } catch (error) {
      services.filesystem = {
        status: 'unhealthy',
        message: `File system error: ${error.message}`,
        responseTime: null
      };
      overallStatus = 'degraded';
    }

    const healthData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: config.app.version,
      name: config.app.name,
      environment: config.server.environment,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      cpu: {
        usage: process.cpuUsage()
      },
      services,
      responseTime: Date.now() - startTime
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    logger.info('Detailed health check requested', {
      endpoint: '/health/detailed',
      status: overallStatus,
      responseTime: healthData.responseTime,
      services: Object.keys(services).reduce((acc, key) => {
        acc[key] = services[key].status;
        return acc;
      }, {})
    });

    res.status(statusCode).json({
      success: true,
      data: healthData
    });

  } catch (error) {
    logger.error('Detailed health check failed', error);
    
    res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      }
    });
  }
});

/**
 * Readiness probe endpoint
 * GET /api/health/ready
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if all required services are ready
    // This is a simplified check - will be enhanced in later phases
    
    const isReady = true; // TODO: Implement actual readiness checks
    
    if (isReady) {
      res.status(200).json({
        success: true,
        data: {
          status: 'ready',
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(503).json({
        success: false,
        data: {
          status: 'not_ready',
          timestamp: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    logger.error('Readiness check failed', error);
    
    res.status(503).json({
      success: false,
      message: 'Service not ready',
      data: {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: error.message
      }
    });
  }
});

/**
 * Liveness probe endpoint
 * GET /api/health/live
 */
router.get('/live', (req, res) => {
  // Simple liveness check - if this endpoint responds, the service is alive
  res.status(200).json({
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
      pid: process.pid
    }
  });
});

module.exports = router;

