/**
 * Validation Utilities for Lesson Plan Builder API
 * Provides input validation schemas and helper functions
 */

const Joi = require('joi');
const { config } = require('../config');

/**
 * Common validation schemas
 */
const commonSchemas = {
  // Subject validation
  subject: Joi.string()
    .valid(...Object.keys(config.subjects))
    .required()
    .messages({
      'any.only': 'Subject must be one of: intro-it, intro-data-science, intro-statistics',
      'any.required': 'Subject is required'
    }),

  // Focus topic validation
  focusTopic: Joi.string()
    .min(3)
    .max(200)
    .trim()
    .required()
    .messages({
      'string.min': 'Focus topic must be at least 3 characters long',
      'string.max': 'Focus topic must not exceed 200 characters',
      'any.required': 'Focus topic is required'
    }),

  // Bloom's taxonomy level validation
  bloomsLevel: Joi.string()
    .valid(...Object.keys(config.bloomsLevels))
    .required()
    .messages({
      'any.only': 'Bloom\'s level must be one of: remember, understand, apply, analyze, evaluate, create',
      'any.required': 'Bloom\'s taxonomy level is required'
    }),

  // AQF level validation
  aqfLevel: Joi.string()
    .valid(...Object.keys(config.aqfLevels))
    .required()
    .messages({
      'any.only': 'AQF level must be one of: aqf7, aqf8, aqf9',
      'any.required': 'AQF level is required'
    }),

  // Duration validation (in minutes)
  duration: Joi.number()
    .integer()
    .min(30)
    .max(300)
    .required()
    .messages({
      'number.base': 'Duration must be a number',
      'number.integer': 'Duration must be a whole number',
      'number.min': 'Duration must be at least 30 minutes',
      'number.max': 'Duration must not exceed 300 minutes (5 hours)',
      'any.required': 'Duration is required'
    }),

  // Assessment type validation
  assessmentType: Joi.string()
    .valid('formative', 'summative', 'peer', 'self', 'mixed')
    .required()
    .messages({
      'any.only': 'Assessment type must be one of: formative, summative, peer, self, mixed',
      'any.required': 'Assessment type is required'
    }),

  // Additional requirements validation
  additionalRequirements: Joi.string()
    .max(1000)
    .trim()
    .allow('')
    .optional()
    .messages({
      'string.max': 'Additional requirements must not exceed 1000 characters'
    })
};

/**
 * Lesson plan generation request validation schema
 */
const lessonPlanGenerationSchema = Joi.object({
  subject: commonSchemas.subject,
  focusTopic: commonSchemas.focusTopic,
  bloomsLevel: commonSchemas.bloomsLevel,
  aqfLevel: commonSchemas.aqfLevel,
  duration: commonSchemas.duration,
  assessmentType: commonSchemas.assessmentType,
  additionalRequirements: commonSchemas.additionalRequirements
});

/**
 * File upload validation schema
 */
const fileUploadSchema = Joi.object({
  subject: commonSchemas.subject,
  documentType: Joi.string()
    .valid('unit_outline', 'curriculum_guide', 'assessment_rubric', 'learning_resource')
    .default('unit_outline')
    .messages({
      'any.only': 'Document type must be one of: unit_outline, curriculum_guide, assessment_rubric, learning_resource'
    }),
  description: Joi.string()
    .max(500)
    .trim()
    .allow('')
    .optional()
    .messages({
      'string.max': 'Description must not exceed 500 characters'
    })
});

/**
 * Document search validation schema
 */
const documentSearchSchema = Joi.object({
  query: Joi.string()
    .min(3)
    .max(500)
    .trim()
    .required()
    .messages({
      'string.min': 'Search query must be at least 3 characters long',
      'string.max': 'Search query must not exceed 500 characters',
      'any.required': 'Search query is required'
    }),
  subject: commonSchemas.subject,
  options: Joi.object({
    limit: Joi.number()
      .integer()
      .min(1)
      .max(50)
      .default(10)
      .messages({
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit must not exceed 50'
      }),
    threshold: Joi.number()
      .min(0)
      .max(1)
      .default(0.7)
      .messages({
        'number.min': 'Threshold must be between 0 and 1',
        'number.max': 'Threshold must be between 0 and 1'
      }),
    sections: Joi.array()
      .items(Joi.string().valid(
        'introduction', 'learningOutcomes', 'accreditation', 
        'timetable', 'resources', 'assessment'
      ))
      .optional()
      .messages({
        'array.includes': 'Sections must be valid section names'
      }),
    includeMetadata: Joi.boolean()
      .default(true)
  }).optional().default({})
});

/**
 * Health check response schema
 */
const healthCheckSchema = Joi.object({
  status: Joi.string().valid('healthy', 'unhealthy').required(),
  timestamp: Joi.date().iso().required(),
  version: Joi.string().required(),
  services: Joi.object({
    database: Joi.string().valid('connected', 'disconnected').required(),
    huggingface: Joi.string().valid('available', 'unavailable').required()
  }).required()
});

/**
 * Validation helper functions
 */
const validationHelpers = {
  /**
   * Validate request body against schema
   * @param {object} data - Data to validate
   * @param {Joi.Schema} schema - Joi validation schema
   * @returns {object} Validation result
   */
  validateRequest: (data, schema) => {
    const { error, value } = schema.validate(data, {
      abortEarly: false, // Return all validation errors
      stripUnknown: true, // Remove unknown fields
      convert: true // Convert types when possible
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return {
        isValid: false,
        errors,
        data: null
      };
    }

    return {
      isValid: true,
      errors: null,
      data: value
    };
  },

  /**
   * Validate file upload
   * @param {object} file - Multer file object
   * @returns {object} Validation result
   */
  validateFile: (file) => {
    const errors = [];

    // Check if file exists
    if (!file) {
      errors.push({
        field: 'file',
        message: 'File is required',
        value: null
      });
      return { isValid: false, errors, data: null };
    }

    // Check file size
    if (file.size > config.upload.maxFileSize) {
      errors.push({
        field: 'file.size',
        message: `File size must not exceed ${config.upload.maxFileSize / 1024 / 1024}MB`,
        value: file.size
      });
    }

    // Check MIME type
    if (!config.upload.allowedMimeTypes.includes(file.mimetype)) {
      errors.push({
        field: 'file.type',
        message: `File type must be one of: ${config.upload.allowedMimeTypes.join(', ')}`,
        value: file.mimetype
      });
    }

    // Check filename
    if (!file.originalname || file.originalname.length > 255) {
      errors.push({
        field: 'file.name',
        message: 'File name is required and must not exceed 255 characters',
        value: file.originalname
      });
    }

    // Check for dangerous filename patterns
    const dangerousPatterns = [
      /\.\./,  // Directory traversal
      /[<>:"|?*]/,  // Invalid filename characters
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i  // Windows reserved names
    ];

    if (dangerousPatterns.some(pattern => pattern.test(file.originalname))) {
      errors.push({
        field: 'file.name',
        message: 'Filename contains invalid characters or patterns',
        value: file.originalname
      });
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : null,
      data: errors.length === 0 ? file : null
    };
  },

  /**
   * Validate document ID format
   * @param {string} documentId - Document identifier
   * @returns {boolean} Whether document ID is valid
   */
  isValidDocumentId: (documentId) => {
    // UUID v4 format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(documentId);
  },

  /**
   * Validate and sanitize search query
   * @param {string} query - Search query
   * @returns {object} Validation result
   */
  validateSearchQuery: (query) => {
    if (!query || typeof query !== 'string') {
      return {
        isValid: false,
        error: 'Query must be a non-empty string'
      };
    }

    const sanitized = validationHelpers.sanitizeText(query);
    
    if (sanitized.length < 3) {
      return {
        isValid: false,
        error: 'Query must be at least 3 characters long after sanitization'
      };
    }

    return {
      isValid: true,
      sanitized
    };
  },

  /**
   * Sanitize text input
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeText: (text) => {
    if (typeof text !== 'string') return '';
    
    return text
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 1000); // Limit length
  },

  /**
   * Validate subject configuration
   * @param {string} subject - Subject key
   * @returns {boolean} Whether subject is valid
   */
  isValidSubject: (subject) => {
    return Object.keys(config.subjects).includes(subject);
  },

  /**
   * Validate Bloom's taxonomy level
   * @param {string} level - Bloom's level
   * @returns {boolean} Whether level is valid
   */
  isValidBloomsLevel: (level) => {
    return Object.keys(config.bloomsLevels).includes(level);
  },

  /**
   * Validate AQF level
   * @param {string} level - AQF level
   * @returns {boolean} Whether level is valid
   */
  isValidAQFLevel: (level) => {
    return Object.keys(config.aqfLevels).includes(level);
  }
};

/**
 * Express middleware for request validation
 * @param {Joi.Schema} schema - Validation schema
 * @returns {Function} Express middleware function
 */
function validateRequestMiddleware(schema) {
  return (req, res, next) => {
    const { isValid, errors, data } = validationHelpers.validateRequest(req.body, schema);
    
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    // Replace request body with validated and sanitized data
    req.body = data;
    next();
  };
}

module.exports = {
  schemas: {
    lessonPlanGeneration: lessonPlanGenerationSchema,
    fileUpload: fileUploadSchema,
    documentSearch: documentSearchSchema,
    healthCheck: healthCheckSchema
  },
  helpers: validationHelpers,
  middleware: {
    validateRequest: validateRequestMiddleware
  }
};

