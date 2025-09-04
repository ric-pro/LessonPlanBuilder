/**
 * Logging Utility for Lesson Plan Builder API
 * Provides structured logging with different levels and outputs
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { config } = require('../config');

// Ensure logs directory exists
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Custom log format for better readability
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\nMetadata: ${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

/**
 * Create transports array based on configuration
 */
const transports = [
  // File transport for all logs
  new winston.transports.File({
    filename: config.logging.file,
    level: config.logging.level,
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true
  }),
  
  // Separate file for errors
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true
  })
];

// Add console transport for development
if (config.logging.enableConsole) {
  transports.push(
    new winston.transports.Console({
      level: config.logging.level,
      format: consoleFormat
    })
  );
}

/**
 * Create the logger instance
 */
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: logFormat
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: logFormat
    })
  ]
});

/**
 * Enhanced logging methods with context
 */
const enhancedLogger = {
  /**
   * Log info message
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  info: (message, meta = {}) => {
    logger.info(message, meta);
  },

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Error|object} error - Error object or metadata
   */
  error: (message, error = {}) => {
    if (error instanceof Error) {
      logger.error(message, { 
        error: error.message, 
        stack: error.stack,
        name: error.name
      });
    } else {
      logger.error(message, error);
    }
  },

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {object} meta - Additional metadata
   */
  warn: (message, meta = {}) => {
    logger.warn(message, meta);
  },

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {object} meta - Additional metadata
   */
  debug: (message, meta = {}) => {
    logger.debug(message, meta);
  },

  /**
   * Log HTTP request
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {number} duration - Request duration in ms
   */
  logRequest: (req, res, duration) => {
    const meta = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };

    if (res.statusCode >= 400) {
      logger.warn(`HTTP ${res.statusCode} - ${req.method} ${req.url}`, meta);
    } else {
      logger.info(`HTTP ${res.statusCode} - ${req.method} ${req.url}`, meta);
    }
  },

  /**
   * Log API operation
   * @param {string} operation - Operation name
   * @param {object} data - Operation data
   * @param {number} duration - Operation duration in ms
   */
  logOperation: (operation, data = {}, duration = null) => {
    const meta = { operation, ...data };
    if (duration) {
      meta.duration = `${duration}ms`;
    }
    logger.info(`Operation: ${operation}`, meta);
  },

  /**
   * Log system event
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  logEvent: (event, data = {}) => {
    logger.info(`System Event: ${event}`, { event, ...data });
  }
};

module.exports = enhancedLogger;

