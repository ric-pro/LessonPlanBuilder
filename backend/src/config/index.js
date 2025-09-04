/**
 * Configuration Management for Lesson Plan Builder API
 * Centralizes all environment variables and application settings
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

/**
 * Validates required environment variables
 * @param {string} varName - Environment variable name
 * @param {*} defaultValue - Default value if not set
 * @returns {*} Environment variable value or default
 */
function getEnvVar(varName, defaultValue = null) {
  const value = process.env[varName];
  if (value === undefined && defaultValue === null) {
    throw new Error(`Required environment variable ${varName} is not set`);
  }
  return value || defaultValue;
}

/**
 * Application Configuration Object
 * Contains all configuration settings organized by category
 */
const config = {
  // Server Configuration
  server: {
    port: parseInt(getEnvVar('PORT', '3000'), 10),
    environment: getEnvVar('NODE_ENV', 'development'),
    corsOrigin: getEnvVar('CORS_ORIGIN', '*')
  },

  // Hugging Face API Configuration
  huggingface: {
    apiKey: getEnvVar('HUGGINGFACE_API_KEY'),
    modelEndpoint: getEnvVar('HUGGINGFACE_MODEL_ENDPOINT', 'https://api-inference.huggingface.co/models/meta-llama/Llama-2-7b-chat-hf'),
    timeout: 120000, // 2 minutes timeout for LLM requests
    maxRetries: 3
  },

  // ChromaDB Configuration
  chroma: {
    host: getEnvVar('CHROMA_HOST', 'localhost'),
    port: parseInt(getEnvVar('CHROMA_PORT', '8000'), 10),
    persistDirectory: getEnvVar('CHROMA_PERSIST_DIRECTORY', './data/chroma_db')
  },

  // Logging Configuration
  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
    file: getEnvVar('LOG_FILE', './logs/app.log'),
    enableConsole: getEnvVar('NODE_ENV', 'development') === 'development'
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: parseInt(getEnvVar('RATE_LIMIT_WINDOW_MS', '900000'), 10), // 15 minutes
    maxRequests: parseInt(getEnvVar('RATE_LIMIT_MAX_REQUESTS', '100'), 10)
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(getEnvVar('MAX_FILE_SIZE', '10485760'), 10), // 10MB
    uploadDirectory: getEnvVar('UPLOAD_DIRECTORY', './data/uploads'),
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ]
  },

  // Application Metadata
  app: {
    name: getEnvVar('APP_NAME', 'Lesson Plan Builder API'),
    version: getEnvVar('APP_VERSION', '1.0.0'),
    description: 'LLM-Powered Lesson Plan Builder for University of Canberra MITS Program'
  },

  // Subject Configuration
  subjects: {
    'intro-it': {
      name: 'Introduction to Information Technology',
      code: 'INTRO-IT',
      description: 'Foundational concepts in information technology'
    },
    'intro-data-science': {
      name: 'Introduction to Data Science',
      code: 'INTRO-DS',
      description: 'Fundamentals of data science and analytics'
    },
    'intro-statistics': {
      name: 'Introduction to Statistics',
      code: 'INTRO-STAT',
      description: 'Statistical methods and analysis techniques'
    }
  },

  // Bloom's Taxonomy Levels
  bloomsLevels: {
    remember: {
      level: 1,
      description: 'Recall facts and basic concepts',
      keywords: ['define', 'list', 'recall', 'recognize', 'retrieve']
    },
    understand: {
      level: 2,
      description: 'Explain ideas or concepts',
      keywords: ['classify', 'describe', 'discuss', 'explain', 'identify']
    },
    apply: {
      level: 3,
      description: 'Use information in new situations',
      keywords: ['execute', 'implement', 'solve', 'use', 'demonstrate']
    },
    analyze: {
      level: 4,
      description: 'Draw connections among ideas',
      keywords: ['differentiate', 'organize', 'relate', 'compare', 'contrast']
    },
    evaluate: {
      level: 5,
      description: 'Justify a stand or decision',
      keywords: ['appraise', 'argue', 'defend', 'judge', 'select']
    },
    create: {
      level: 6,
      description: 'Produce new or original work',
      keywords: ['design', 'assemble', 'construct', 'conjecture', 'develop']
    }
  },

  // AQF Levels
  aqfLevels: {
    aqf7: {
      level: 7,
      name: 'Bachelor Degree',
      description: 'Broad and coherent knowledge and skills for professional work'
    },
    aqf8: {
      level: 8,
      name: 'Graduate Certificate/Diploma',
      description: 'Advanced knowledge and skills for professional/highly skilled work'
    },
    aqf9: {
      level: 9,
      name: 'Masters Degree',
      description: 'Specialised knowledge and skills for research, professional practice'
    }
  }
};

/**
 * Validates the configuration on startup
 * Ensures all required settings are properly configured
 */
function validateConfig() {
  const requiredKeys = [
    'huggingface.apiKey'
  ];

  for (const key of requiredKeys) {
    const keys = key.split('.');
    let value = config;
    
    for (const k of keys) {
      value = value[k];
      if (value === undefined) {
        throw new Error(`Configuration validation failed: ${key} is required`);
      }
    }
  }

  console.log('Configuration validation passed');
}

module.exports = {
  config,
  validateConfig
};

