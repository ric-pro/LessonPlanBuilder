/**
 * Vector Database Service for Lesson Plan Builder
 * Manages ChromaDB operations for document embeddings and similarity search
 */

const { ChromaClient } = require('chromadb');
const axios = require('axios');
const logger = require('../utils/logger');
const { config } = require('../config');

/**
 * Vector Database Service Class
 * Handles document embeddings, storage, and retrieval using ChromaDB
 */
class VectorDatabase {
  constructor() {
    this.client = null;
    this.collections = {};
    this.embeddingModel = 'sentence-transformers/all-MiniLM-L6-v2';
    this.isInitialized = false;
  }

  /**
   * Initialize ChromaDB client and collections
   */
  async initialize() {
    try {
      logger.info('Initializing vector database', {
        host: config.chroma.host,
        port: config.chroma.port
      });

      // Initialize ChromaDB client
      this.client = new ChromaClient({
        path: `http://${config.chroma.host}:${config.chroma.port}`
      });

      // Test connection
      await this.client.heartbeat();
      logger.info('ChromaDB connection established');

      // Initialize collections for each subject
      for (const subjectKey of Object.keys(config.subjects)) {
        await this.initializeCollection(subjectKey);
      }

      this.isInitialized = true;
      logger.info('Vector database initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize vector database', error);
      
      // For development, create a mock client if ChromaDB is not available
      if (config.server.environment === 'development') {
        logger.warn('Using mock vector database for development');
        this.client = new MockChromaClient();
        this.isInitialized = true;
      } else {
        throw error;
      }
    }
  }

  /**
   * Initialize collection for a specific subject
   * @param {string} subject - Subject identifier
   */
  async initializeCollection(subject) {
    try {
      const collectionName = `lesson_plans_${subject}`;
      
      // Create or get collection
      const collection = await this.client.getOrCreateCollection({
        name: collectionName,
        metadata: {
          subject,
          description: `Document embeddings for ${config.subjects[subject].name}`,
          embeddingModel: this.embeddingModel
        }
      });

      this.collections[subject] = collection;
      
      logger.info('Collection initialized', {
        subject,
        collectionName,
        embeddingModel: this.embeddingModel
      });

    } catch (error) {
      logger.error('Failed to initialize collection', {
        subject,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate embeddings for text using Hugging Face API
   * @param {string|Array} texts - Text or array of texts to embed
   * @returns {Array} Embeddings array
   */
  async generateEmbeddings(texts) {
    try {
      const textArray = Array.isArray(texts) ? texts : [texts];
      
      logger.debug('Generating embeddings', {
        textCount: textArray.length,
        model: this.embeddingModel
      });

      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${this.embeddingModel}`,
        {
          inputs: textArray,
          options: {
            wait_for_model: true
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${config.huggingface.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response from embedding API');
      }

      // Handle single text input
      if (!Array.isArray(texts)) {
        return response.data[0];
      }

      return response.data;

    } catch (error) {
      logger.error('Failed to generate embeddings', {
        error: error.message,
        textCount: Array.isArray(texts) ? texts.length : 1
      });

      // Fallback to mock embeddings for development
      if (config.server.environment === 'development') {
        logger.warn('Using mock embeddings for development');
        const textArray = Array.isArray(texts) ? texts : [texts];
        return textArray.map(() => Array(384).fill(0).map(() => Math.random() - 0.5));
      }

      throw error;
    }
  }

  /**
   * Add document to vector database
   * @param {Object} document - Document with extracted information
   * @param {string} subject - Subject identifier
   * @returns {string} Document ID in vector database
   */
  async addDocument(document, subject) {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const collection = this.collections[subject];
      if (!collection) {
        throw new Error(`Collection not found for subject: ${subject}`);
      }

      logger.info('Adding document to vector database', {
        documentId: document.documentId,
        subject
      });

      // Prepare text chunks for embedding
      const chunks = this.createTextChunks(document);
      
      // Generate embeddings for all chunks
      const embeddings = await this.generateEmbeddings(chunks.map(chunk => chunk.text));

      // Prepare data for ChromaDB
      const ids = chunks.map((chunk, index) => `${document.documentId}_chunk_${index}`);
      const metadatas = chunks.map((chunk, index) => ({
        documentId: document.documentId,
        subject,
        chunkIndex: index,
        section: chunk.section,
        chunkType: chunk.type,
        textLength: chunk.text.length,
        addedAt: new Date().toISOString()
      }));
      const documents = chunks.map(chunk => chunk.text);

      // Add to collection
      await collection.add({
        ids,
        embeddings,
        metadatas,
        documents
      });

      const processingTime = Date.now() - startTime;

      logger.logOperation('document_added_to_vector_db', {
        documentId: document.documentId,
        subject,
        chunksCount: chunks.length,
        embeddingDimension: embeddings[0]?.length || 0
      }, processingTime);

      return {
        success: true,
        documentId: document.documentId,
        chunksAdded: chunks.length,
        processingTime
      };

    } catch (error) {
      logger.error('Failed to add document to vector database', {
        documentId: document.documentId,
        subject,
        error: error.message,
        processingTime: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Create text chunks from document for embedding
   * @param {Object} document - Document with extracted information
   * @returns {Array} Array of text chunks
   */
  createTextChunks(document) {
    const chunks = [];
    const maxChunkSize = 500; // Maximum characters per chunk

    // Process each section
    Object.entries(document.sections).forEach(([sectionName, sectionData]) => {
      if (sectionData.content && sectionData.content.trim()) {
        // Split long content into smaller chunks
        const content = sectionData.content.trim();
        
        if (content.length <= maxChunkSize) {
          chunks.push({
            text: content,
            section: sectionName,
            type: 'full_section'
          });
        } else {
          // Split into smaller chunks
          const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
          let currentChunk = '';
          
          sentences.forEach(sentence => {
            const trimmedSentence = sentence.trim();
            if (currentChunk.length + trimmedSentence.length + 1 <= maxChunkSize) {
              currentChunk += trimmedSentence + '. ';
            } else {
              if (currentChunk.trim()) {
                chunks.push({
                  text: currentChunk.trim(),
                  section: sectionName,
                  type: 'partial_section'
                });
              }
              currentChunk = trimmedSentence + '. ';
            }
          });
          
          if (currentChunk.trim()) {
            chunks.push({
              text: currentChunk.trim(),
              section: sectionName,
              type: 'partial_section'
            });
          }
        }
      }

      // Add specific data chunks
      if (sectionName === 'learningOutcomes' && sectionData.outcomes) {
        sectionData.outcomes.forEach((outcome, index) => {
          if (outcome.trim().length > 10) {
            chunks.push({
              text: outcome.trim(),
              section: 'learningOutcomes',
              type: 'individual_outcome',
              outcomeIndex: index
            });
          }
        });
      }

      if (sectionName === 'timetable' && sectionData.weeklyStructure) {
        sectionData.weeklyStructure.forEach(week => {
          if (week.topic && week.topic.trim().length > 5) {
            chunks.push({
              text: `Week ${week.week}: ${week.topic}`,
              section: 'timetable',
              type: 'weekly_topic',
              week: week.week
            });
          }
        });
      }
    });

    // Add analysis chunks
    if (document.analysis && document.analysis.keyTopics) {
      const topicsText = document.analysis.keyTopics.join(', ');
      if (topicsText.length > 0) {
        chunks.push({
          text: `Key topics: ${topicsText}`,
          section: 'analysis',
          type: 'key_topics'
        });
      }
    }

    return chunks;
  }

  /**
   * Search for similar documents/chunks
   * @param {string} query - Search query
   * @param {string} subject - Subject identifier
   * @param {Object} options - Search options
   * @returns {Array} Search results
   */
  async search(query, subject, options = {}) {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const collection = this.collections[subject];
      if (!collection) {
        throw new Error(`Collection not found for subject: ${subject}`);
      }

      const {
        limit = 10,
        threshold = 0.7,
        sections = null,
        includeMetadata = true
      } = options;

      logger.info('Searching vector database', {
        query: query.substring(0, 100),
        subject,
        limit,
        threshold
      });

      // Generate query embedding
      const queryEmbedding = await this.generateEmbeddings(query);

      // Prepare where clause for filtering
      let whereClause = { subject };
      if (sections && sections.length > 0) {
        whereClause.section = { $in: sections };
      }

      // Perform similarity search
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        where: whereClause,
        include: ['documents', 'metadatas', 'distances']
      });

      // Process results
      const processedResults = [];
      if (results.documents && results.documents[0]) {
        results.documents[0].forEach((document, index) => {
          const distance = results.distances[0][index];
          const similarity = 1 - distance; // Convert distance to similarity

          if (similarity >= threshold) {
            processedResults.push({
              text: document,
              similarity,
              metadata: includeMetadata ? results.metadatas[0][index] : null,
              chunkId: results.ids[0][index]
            });
          }
        });
      }

      const processingTime = Date.now() - startTime;

      logger.logOperation('vector_search_completed', {
        query: query.substring(0, 50),
        subject,
        resultsCount: processedResults.length,
        avgSimilarity: processedResults.length > 0 
          ? processedResults.reduce((sum, r) => sum + r.similarity, 0) / processedResults.length 
          : 0
      }, processingTime);

      return {
        results: processedResults,
        query,
        subject,
        totalResults: processedResults.length,
        processingTime
      };

    } catch (error) {
      logger.error('Vector search failed', {
        query: query.substring(0, 100),
        subject,
        error: error.message,
        processingTime: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Get collection statistics
   * @param {string} subject - Subject identifier
   * @returns {Object} Collection statistics
   */
  async getCollectionStats(subject) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const collection = this.collections[subject];
      if (!collection) {
        throw new Error(`Collection not found for subject: ${subject}`);
      }

      const count = await collection.count();
      
      return {
        subject,
        documentCount: count,
        collectionName: `lesson_plans_${subject}`,
        embeddingModel: this.embeddingModel
      };

    } catch (error) {
      logger.error('Failed to get collection statistics', {
        subject,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete document from vector database
   * @param {string} documentId - Document identifier
   * @param {string} subject - Subject identifier
   */
  async deleteDocument(documentId, subject) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const collection = this.collections[subject];
      if (!collection) {
        throw new Error(`Collection not found for subject: ${subject}`);
      }

      // Find all chunks for this document
      const results = await collection.get({
        where: { documentId }
      });

      if (results.ids && results.ids.length > 0) {
        await collection.delete({
          ids: results.ids
        });

        logger.info('Document deleted from vector database', {
          documentId,
          subject,
          chunksDeleted: results.ids.length
        });
      }

    } catch (error) {
      logger.error('Failed to delete document from vector database', {
        documentId,
        subject,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get health status of vector database
   * @returns {Object} Health status
   */
  async getHealthStatus() {
    try {
      if (!this.client) {
        return {
          status: 'disconnected',
          message: 'Client not initialized'
        };
      }

      await this.client.heartbeat();
      
      const stats = {};
      for (const subject of Object.keys(config.subjects)) {
        try {
          stats[subject] = await this.getCollectionStats(subject);
        } catch (error) {
          stats[subject] = { error: error.message };
        }
      }

      return {
        status: 'healthy',
        message: 'ChromaDB connection active',
        collections: stats,
        embeddingModel: this.embeddingModel
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        embeddingModel: this.embeddingModel
      };
    }
  }
}

/**
 * Mock ChromaDB Client for development when ChromaDB is not available
 */
class MockChromaClient {
  constructor() {
    this.collections = new Map();
  }

  async heartbeat() {
    return { status: 'ok' };
  }

  async getOrCreateCollection({ name, metadata }) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockCollection(name, metadata));
    }
    return this.collections.get(name);
  }
}

class MockCollection {
  constructor(name, metadata) {
    this.name = name;
    this.metadata = metadata;
    this.data = [];
  }

  async add({ ids, embeddings, metadatas, documents }) {
    ids.forEach((id, index) => {
      this.data.push({
        id,
        embedding: embeddings[index],
        metadata: metadatas[index],
        document: documents[index]
      });
    });
  }

  async query({ queryEmbeddings, nResults, where, include }) {
    // Mock similarity search - return random results
    const filtered = this.data.filter(item => {
      if (where) {
        return Object.entries(where).every(([key, value]) => {
          if (typeof value === 'object' && value.$in) {
            return value.$in.includes(item.metadata[key]);
          }
          return item.metadata[key] === value;
        });
      }
      return true;
    });

    const results = filtered.slice(0, nResults);
    
    return {
      ids: [results.map(r => r.id)],
      documents: include.includes('documents') ? [results.map(r => r.document)] : null,
      metadatas: include.includes('metadatas') ? [results.map(r => r.metadata)] : null,
      distances: include.includes('distances') ? [results.map(() => Math.random() * 0.5)] : null
    };
  }

  async count() {
    return this.data.length;
  }

  async get({ where }) {
    const filtered = this.data.filter(item => {
      return Object.entries(where).every(([key, value]) => 
        item.metadata[key] === value
      );
    });

    return {
      ids: filtered.map(r => r.id),
      documents: filtered.map(r => r.document),
      metadatas: filtered.map(r => r.metadata)
    };
  }

  async delete({ ids }) {
    this.data = this.data.filter(item => !ids.includes(item.id));
  }
}

module.exports = VectorDatabase;

