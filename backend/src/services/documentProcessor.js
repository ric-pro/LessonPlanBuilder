/**
 * Document Processing Service for Lesson Plan Builder
 * Handles PDF and Word document text extraction and processing
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { config } = require('../config');

/**
 * Document Processing Service Class
 */
class DocumentProcessor {
  constructor() {
    this.supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];
  }

  /**
   * Process uploaded document and extract text content
   * @param {Object} file - Multer file object
   * @param {string} subject - Subject identifier
   * @returns {Object} Processing result with extracted text and metadata
   */
  async processDocument(file, subject) {
    const startTime = Date.now();
    
    try {
      logger.info('Starting document processing', {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        subject
      });

      // Validate file type
      if (!this.supportedTypes.includes(file.mimetype)) {
        throw new Error(`Unsupported file type: ${file.mimetype}`);
      }

      // Generate unique document ID
      const documentId = uuidv4();
      
      // Extract text based on file type
      let extractedText = '';
      let metadata = {};

      switch (file.mimetype) {
        case 'application/pdf':
          const pdfResult = await this.extractFromPDF(file.buffer);
          extractedText = pdfResult.text;
          metadata = pdfResult.metadata;
          break;
          
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          const wordResult = await this.extractFromWord(file.buffer);
          extractedText = wordResult.text;
          metadata = wordResult.metadata;
          break;
          
        case 'text/plain':
          extractedText = file.buffer.toString('utf-8');
          metadata = { pages: 1, wordCount: extractedText.split(/\s+/).length };
          break;
          
        default:
          throw new Error(`Processing not implemented for ${file.mimetype}`);
      }

      // Clean and normalize text
      const cleanedText = this.cleanText(extractedText);
      
      // Generate processing metadata
      const processingResult = {
        documentId,
        originalFilename: file.originalname,
        subject,
        mimetype: file.mimetype,
        size: file.size,
        extractedText: cleanedText,
        metadata: {
          ...metadata,
          extractedAt: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          textLength: cleanedText.length,
          wordCount: cleanedText.split(/\s+/).filter(word => word.length > 0).length
        }
      };

      // Save processed document
      await this.saveProcessedDocument(processingResult);

      logger.logOperation('document_processed', {
        documentId,
        filename: file.originalname,
        subject,
        textLength: cleanedText.length,
        wordCount: processingResult.metadata.wordCount
      }, Date.now() - startTime);

      return {
        success: true,
        documentId,
        extractedText: cleanedText,
        metadata: processingResult.metadata
      };

    } catch (error) {
      logger.error('Document processing failed', {
        filename: file.originalname,
        subject,
        error: error.message,
        processingTime: Date.now() - startTime
      });

      throw new Error(`Document processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF file
   * @param {Buffer} buffer - PDF file buffer
   * @returns {Object} Extracted text and metadata
   */
  async extractFromPDF(buffer) {
    try {
      const data = await pdfParse(buffer);
      
      return {
        text: data.text,
        metadata: {
          pages: data.numpages,
          info: data.info || {},
          version: data.version || 'unknown'
        }
      };
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from Word document
   * @param {Buffer} buffer - Word document buffer
   * @returns {Object} Extracted text and metadata
   */
  async extractFromWord(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      
      return {
        text: result.value,
        metadata: {
          messages: result.messages || [],
          wordCount: result.value.split(/\s+/).filter(word => word.length > 0).length
        }
      };
    } catch (error) {
      throw new Error(`Word document extraction failed: ${error.message}`);
    }
  }

  /**
   * Clean and normalize extracted text
   * @param {string} text - Raw extracted text
   * @returns {string} Cleaned text
   */
  cleanText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove special characters but keep punctuation
      .replace(/[^\w\s.,;:!?()-]/g, ' ')
      // Remove multiple spaces
      .replace(/\s+/g, ' ')
      // Trim whitespace
      .trim();
  }

  /**
   * Save processed document to file system
   * @param {Object} processingResult - Document processing result
   */
  async saveProcessedDocument(processingResult) {
    try {
      const processedDir = path.join(process.cwd(), 'data', 'processed');
      
      // Ensure directory exists
      if (!fs.existsSync(processedDir)) {
        fs.mkdirSync(processedDir, { recursive: true });
      }

      const filename = `${processingResult.documentId}.json`;
      const filepath = path.join(processedDir, filename);

      // Save processing result as JSON
      fs.writeFileSync(filepath, JSON.stringify(processingResult, null, 2));

      logger.info('Processed document saved', {
        documentId: processingResult.documentId,
        filepath,
        size: processingResult.size
      });

    } catch (error) {
      logger.error('Failed to save processed document', {
        documentId: processingResult.documentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get processed document by ID
   * @param {string} documentId - Document identifier
   * @returns {Object} Processed document data
   */
  async getProcessedDocument(documentId) {
    try {
      const processedDir = path.join(process.cwd(), 'data', 'processed');
      const filepath = path.join(processedDir, `${documentId}.json`);

      if (!fs.existsSync(filepath)) {
        throw new Error(`Document not found: ${documentId}`);
      }

      const data = fs.readFileSync(filepath, 'utf-8');
      return JSON.parse(data);

    } catch (error) {
      logger.error('Failed to retrieve processed document', {
        documentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * List all processed documents for a subject
   * @param {string} subject - Subject identifier
   * @returns {Array} List of processed documents
   */
  async listProcessedDocuments(subject = null) {
    try {
      const processedDir = path.join(process.cwd(), 'data', 'processed');
      
      if (!fs.existsSync(processedDir)) {
        return [];
      }

      const files = fs.readdirSync(processedDir)
        .filter(file => file.endsWith('.json'));

      const documents = [];

      for (const file of files) {
        try {
          const filepath = path.join(processedDir, file);
          const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
          
          // Filter by subject if specified
          if (!subject || data.subject === subject) {
            documents.push({
              documentId: data.documentId,
              originalFilename: data.originalFilename,
              subject: data.subject,
              mimetype: data.mimetype,
              size: data.size,
              extractedAt: data.metadata.extractedAt,
              textLength: data.metadata.textLength,
              wordCount: data.metadata.wordCount
            });
          }
        } catch (error) {
          logger.warn('Failed to parse processed document', {
            file,
            error: error.message
          });
        }
      }

      return documents.sort((a, b) => 
        new Date(b.extractedAt) - new Date(a.extractedAt)
      );

    } catch (error) {
      logger.error('Failed to list processed documents', {
        subject,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete processed document
   * @param {string} documentId - Document identifier
   */
  async deleteProcessedDocument(documentId) {
    try {
      const processedDir = path.join(process.cwd(), 'data', 'processed');
      const filepath = path.join(processedDir, `${documentId}.json`);

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        logger.info('Processed document deleted', { documentId });
      } else {
        throw new Error(`Document not found: ${documentId}`);
      }

    } catch (error) {
      logger.error('Failed to delete processed document', {
        documentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get document processing statistics
   * @returns {Object} Processing statistics
   */
  async getProcessingStats() {
    try {
      const documents = await this.listProcessedDocuments();
      
      const stats = {
        totalDocuments: documents.length,
        bySubject: {},
        byMimeType: {},
        totalTextLength: 0,
        totalWordCount: 0,
        averageProcessingTime: 0
      };

      documents.forEach(doc => {
        // Count by subject
        stats.bySubject[doc.subject] = (stats.bySubject[doc.subject] || 0) + 1;
        
        // Count by mime type
        stats.byMimeType[doc.mimetype] = (stats.byMimeType[doc.mimetype] || 0) + 1;
        
        // Accumulate text statistics
        stats.totalTextLength += doc.textLength || 0;
        stats.totalWordCount += doc.wordCount || 0;
      });

      return stats;

    } catch (error) {
      logger.error('Failed to get processing statistics', error);
      throw error;
    }
  }
}

module.exports = DocumentProcessor;

