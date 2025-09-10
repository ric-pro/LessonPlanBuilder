/**
 * Document Management Routes for Lesson Plan Builder API
 * Handles document upload, processing, and management operations
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { config } = require('../../config');
const logger = require('../../utils/logger');
const { schemas, middleware, helpers } = require('../../utils/validation');
const DocumentProcessor = require('../../services/documentProcessor');
const InformationExtractor = require('../../services/informationExtractor');
const VectorDatabase = require('../../services/vectorDatabase');

const router = express.Router();

// Initialize services
const documentProcessor = new DocumentProcessor();
const informationExtractor = new InformationExtractor();
const vectorDatabase = new VectorDatabase();

/**
 * Configure multer for file uploads
 */
const storage = multer.memoryStorage(); // Store files in memory for processing

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
  }
});

/**
 * Upload and process document endpoint
 * POST /api/documents/upload
 */
router.post('/upload',
  upload.single('document'),
  middleware.validateRequest(schemas.fileUpload),
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { subject, documentType } = req.body;
      const file = req.file;

      logger.info('Document upload requested', {
        filename: file?.originalname,
        subject,
        documentType,
        size: file?.size
      });

      // Validate file
      const fileValidation = helpers.validateFile(file);
      if (!fileValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'File validation failed',
          errors: fileValidation.errors
        });
      }

      // Process document
      const processingResult = await documentProcessor.processDocument(file, subject);
      
      if (!processingResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Document processing failed',
          error: 'Failed to extract text from document'
        });
      }

      // Extract structured information
      const extractedInfo = await informationExtractor.extractInformation(
        processingResult.extractedText,
        subject,
        processingResult.documentId
      );

      // Add to vector database
      let vectorResult = null;
      try {
        vectorResult = await vectorDatabase.addDocument(extractedInfo, subject);
      } catch (vectorError) {
        logger.warn('Failed to add document to vector database', {
          documentId: processingResult.documentId,
          error: vectorError.message
        });
        // Continue without vector database - it's not critical for basic functionality
      }

      const responseTime = Date.now() - startTime;

      logger.logOperation('document_uploaded_and_processed', {
        documentId: processingResult.documentId,
        filename: file.originalname,
        subject,
        documentType,
        textLength: processingResult.extractedText.length,
        sectionsExtracted: Object.keys(extractedInfo.sections).length,
        vectorized: !!vectorResult?.success
      }, responseTime);

      res.status(201).json({
        success: true,
        message: 'Document uploaded and processed successfully',
        data: {
          documentId: processingResult.documentId,
          filename: file.originalname,
          subject,
          documentType,
          processing: {
            textLength: processingResult.extractedText.length,
            wordCount: processingResult.metadata.wordCount,
            processingTime: processingResult.metadata.processingTime
          },
          extraction: {
            sectionsFound: Object.keys(extractedInfo.sections).length,
            learningOutcomes: extractedInfo.sections.learningOutcomes.outcomes.length,
            keyTopics: extractedInfo.analysis.keyTopics.length,
            aqfLevel: extractedInfo.analysis.aqfLevel,
            complexity: extractedInfo.analysis.complexity.level
          },
          vectorization: vectorResult ? {
            success: vectorResult.success,
            chunksAdded: vectorResult.chunksAdded
          } : null
        },
        meta: {
          responseTime,
          version: config.app.version
        }
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;

      logger.error('Document upload failed', {
        filename: req.file?.originalname,
        subject: req.body?.subject,
        error: error.message,
        stack: error.stack,
        responseTime
      });

      res.status(500).json({
        success: false,
        message: 'Document upload and processing failed',
        error: config.server.environment === 'development' ? error.message : 'Internal server error',
        meta: {
          responseTime,
          version: config.app.version
        }
      });
    }
  }
);

/**
 * Get document information endpoint
 * GET /api/documents/:documentId
 */
router.get('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { includeText = false } = req.query;

    logger.info('Document information requested', {
      documentId,
      includeText: includeText === 'true'
    });

    // Get processed document
    const processedDoc = await documentProcessor.getProcessedDocument(documentId);

    // Prepare response data
    const responseData = {
      documentId: processedDoc.documentId,
      originalFilename: processedDoc.originalFilename,
      subject: processedDoc.subject,
      mimetype: processedDoc.mimetype,
      size: processedDoc.size,
      metadata: processedDoc.metadata
    };

    // Include extracted text if requested
    if (includeText === 'true') {
      responseData.extractedText = processedDoc.extractedText;
    }

    res.status(200).json({
      success: true,
      message: 'Document information retrieved successfully',
      data: responseData
    });

  } catch (error) {
    logger.error('Failed to retrieve document information', {
      documentId: req.params.documentId,
      error: error.message
    });

    if (error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        message: 'Document not found',
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve document information',
        error: config.server.environment === 'development' ? error.message : 'Internal server error'
      });
    }
  }
});

/**
 * List documents endpoint
 * GET /api/documents
 */
router.get('/', async (req, res) => {
  try {
    const { subject, page = 1, limit = 10 } = req.query;

    logger.info('Documents list requested', {
      subject,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    // Get processed documents
    const documents = await documentProcessor.listProcessedDocuments(subject);

    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedDocuments = documents.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      message: 'Documents retrieved successfully',
      data: {
        documents: paginatedDocuments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: documents.length,
          pages: Math.ceil(documents.length / parseInt(limit))
        },
        filters: {
          subject
        }
      }
    });

  } catch (error) {
    logger.error('Failed to list documents', {
      subject: req.query.subject,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve documents',
      error: config.server.environment === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get document extracted information endpoint
 * GET /api/documents/:documentId/extraction
 */
router.get('/:documentId/extraction', async (req, res) => {
  try {
    const { documentId } = req.params;

    logger.info('Document extraction information requested', { documentId });

    // Get processed document
    const processedDoc = await documentProcessor.getProcessedDocument(documentId);

    // Extract information (this will be cached in a real implementation)
    const extractedInfo = await informationExtractor.extractInformation(
      processedDoc.extractedText,
      processedDoc.subject,
      documentId
    );

    res.status(200).json({
      success: true,
      message: 'Document extraction information retrieved successfully',
      data: extractedInfo
    });

  } catch (error) {
    logger.error('Failed to retrieve document extraction information', {
      documentId: req.params.documentId,
      error: error.message
    });

    if (error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        message: 'Document not found',
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve extraction information',
        error: config.server.environment === 'development' ? error.message : 'Internal server error'
      });
    }
  }
});

/**
 * Search documents endpoint
 * POST /api/documents/search
 */
router.post('/search', async (req, res) => {
  const startTime = Date.now();

  try {
    const { query, subject, options = {} } = req.body;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Query must be at least 3 characters long',
        error: 'Invalid query parameter'
      });
    }

    if (!helpers.isValidSubject(subject)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject',
        error: `Subject must be one of: ${Object.keys(config.subjects).join(', ')}`
      });
    }

    logger.info('Document search requested', {
      query: query.substring(0, 100),
      subject,
      options
    });

    // Perform vector search
    const searchResults = await vectorDatabase.search(query, subject, options);

    const responseTime = Date.now() - startTime;

    logger.logOperation('document_search_completed', {
      query: query.substring(0, 50),
      subject,
      resultsCount: searchResults.totalResults,
      avgSimilarity: searchResults.results.length > 0 
        ? searchResults.results.reduce((sum, r) => sum + r.similarity, 0) / searchResults.results.length 
        : 0
    }, responseTime);

    res.status(200).json({
      success: true,
      message: 'Document search completed successfully',
      data: searchResults,
      meta: {
        responseTime,
        version: config.app.version
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Document search failed', {
      query: req.body?.query?.substring(0, 100),
      subject: req.body?.subject,
      error: error.message,
      responseTime
    });

    res.status(500).json({
      success: false,
      message: 'Document search failed',
      error: config.server.environment === 'development' ? error.message : 'Internal server error',
      meta: {
        responseTime,
        version: config.app.version
      }
    });
  }
});

/**
 * Delete document endpoint
 * DELETE /api/documents/:documentId
 */
router.delete('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    logger.info('Document deletion requested', { documentId });

    // Get document info before deletion
    const processedDoc = await documentProcessor.getProcessedDocument(documentId);

    // Delete from vector database
    try {
      await vectorDatabase.deleteDocument(documentId, processedDoc.subject);
    } catch (vectorError) {
      logger.warn('Failed to delete document from vector database', {
        documentId,
        error: vectorError.message
      });
    }

    // Delete processed document
    await documentProcessor.deleteProcessedDocument(documentId);

    logger.logOperation('document_deleted', {
      documentId,
      filename: processedDoc.originalFilename,
      subject: processedDoc.subject
    });

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
      data: {
        documentId,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to delete document', {
      documentId: req.params.documentId,
      error: error.message
    });

    if (error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        message: 'Document not found',
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to delete document',
        error: config.server.environment === 'development' ? error.message : 'Internal server error'
      });
    }
  }
});

/**
 * Get processing statistics endpoint
 * GET /api/documents/stats
 */
router.get('/stats', async (req, res) => {
  try {
    logger.info('Processing statistics requested');

    // Get document processing stats
    const processingStats = await documentProcessor.getProcessingStats();

    // Get vector database stats
    const vectorStats = {};
    for (const subject of Object.keys(config.subjects)) {
      try {
        vectorStats[subject] = await vectorDatabase.getCollectionStats(subject);
      } catch (error) {
        vectorStats[subject] = { error: error.message };
      }
    }

    res.status(200).json({
      success: true,
      message: 'Processing statistics retrieved successfully',
      data: {
        processing: processingStats,
        vectorDatabase: vectorStats,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to retrieve processing statistics', error);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve processing statistics',
      error: config.server.environment === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

