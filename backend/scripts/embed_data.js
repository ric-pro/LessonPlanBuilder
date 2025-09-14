/**
 * Data Embedding Script for Lesson Plan Builder
 * Processes existing documents and adds them to the vector database
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { config } = require('../src/config');
const logger = require('../src/utils/logger');
const DocumentProcessor = require('../src/services/documentProcessor');
const InformationExtractor = require('../src/services/informationExtractor');
const VectorDatabase = require('../src/services/vectorDatabase');

/**
 * Data Embedding Class
 */
class DataEmbedder {
  constructor() {
    this.documentProcessor = new DocumentProcessor();
    this.informationExtractor = new InformationExtractor();
    this.vectorDb = new VectorDatabase();
    this.stats = {
      processed: 0,
      embedded: 0,
      failed: 0,
      skipped: 0
    };
  }

  /**
   * Main embedding function
   */
  async embedData() {
    try {
      console.log('🚀 Starting data embedding process...\n');

      // Initialize vector database
      await this.initializeDatabase();

      // Process existing documents
      await this.processExistingDocuments();

      // Display results
      this.displayResults();

      console.log('\n✅ Data embedding completed successfully!');

    } catch (error) {
      console.error('\n❌ Data embedding failed:', error.message);
      console.error('\nTroubleshooting:');
      console.error('1. Ensure vector database is properly initialized');
      console.error('2. Check your Hugging Face API key');
      console.error('3. Verify processed documents exist in data/processed/');
      console.error('4. Check network connectivity\n');
      process.exit(1);
    }
  }

  /**
   * Initialize vector database
   */
  async initializeDatabase() {
    console.log('🧠 Initializing vector database...');

    try {
      await this.vectorDb.initialize();
      console.log('   ✅ Vector database initialized');

      // Display collection status
      for (const [subjectKey, subjectConfig] of Object.entries(config.subjects)) {
        try {
          const stats = await this.vectorDb.getCollectionStats(subjectKey);
          console.log(`   ✓  ${subjectConfig.name}: ${stats.documentCount} documents`);
        } catch (error) {
          console.log(`   ⚠️  ${subjectConfig.name}: ${error.message}`);
        }
      }

      console.log('   ✅ Vector database ready\n');

    } catch (error) {
      throw new Error(`Vector database initialization failed: ${error.message}`);
    }
  }

  /**
   * Process existing documents
   */
  async processExistingDocuments() {
    console.log('📄 Processing existing documents...');

    const processedDir = path.join(process.cwd(), 'data', 'processed');
    
    if (!fs.existsSync(processedDir)) {
      console.log('   ℹ️  No processed documents directory found');
      console.log('   ℹ️  Upload documents first using: POST /api/documents/upload\n');
      return;
    }

    const files = fs.readdirSync(processedDir)
      .filter(file => file.endsWith('.json'));

    if (files.length === 0) {
      console.log('   ℹ️  No processed documents found');
      console.log('   ℹ️  Upload documents first using: POST /api/documents/upload\n');
      return;
    }

    console.log(`   📊 Found ${files.length} processed documents\n`);

    // Process each document
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const documentId = path.basename(file, '.json');
      
      console.log(`📄 Processing document ${i + 1}/${files.length}: ${documentId}`);
      
      try {
        await this.processDocument(file, documentId);
        this.stats.processed++;
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        this.stats.failed++;
      }
    }

    console.log('\n   ✅ Document processing completed\n');
  }

  /**
   * Process individual document
   */
  async processDocument(filename, documentId) {
    try {
      const processedDir = path.join(process.cwd(), 'data', 'processed');
      const filepath = path.join(processedDir, filename);

      // Load processed document
      const processedDoc = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      
      console.log(`   📋 Subject: ${processedDoc.subject}`);
      console.log(`   📝 File: ${processedDoc.originalFilename}`);
      console.log(`   📊 Text length: ${processedDoc.extractedText?.length || 0} characters`);

      // Check if already embedded
      try {
        const existingStats = await this.vectorDb.getCollectionStats(processedDoc.subject);
        // Simple check - in production, you'd want more sophisticated duplicate detection
        console.log(`   ℹ️  Collection has ${existingStats.documentCount} documents`);
      } catch (error) {
        console.log(`   ⚠️  Could not check existing documents: ${error.message}`);
      }

      // Extract information if not already done
      let extractedInfo;
      if (processedDoc.sections) {
        // Information already extracted
        extractedInfo = processedDoc;
        console.log('   ✓  Using existing extraction');
      } else {
        // Extract information
        console.log('   🔍 Extracting information...');
        extractedInfo = await this.informationExtractor.extractInformation(
          processedDoc.extractedText,
          processedDoc.subject,
          documentId
        );
        
        // Save updated document with extraction
        fs.writeFileSync(filepath, JSON.stringify({
          ...processedDoc,
          ...extractedInfo
        }, null, 2));
        
        console.log('   ✅ Information extracted and saved');
      }

      // Add to vector database
      console.log('   🧠 Adding to vector database...');
      const vectorResult = await this.vectorDb.addDocument(extractedInfo, processedDoc.subject);
      
      if (vectorResult.success) {
        console.log(`   ✅ Added ${vectorResult.chunksAdded} chunks to vector database`);
        this.stats.embedded++;
      } else {
        throw new Error('Vector database addition failed');
      }

    } catch (error) {
      throw new Error(`Document processing failed: ${error.message}`);
    }
  }

  /**
   * Display embedding results
   */
  displayResults() {
    console.log('📊 Embedding Results:');
    console.log('=====================');
    console.log(`   📄 Documents processed: ${this.stats.processed}`);
    console.log(`   🧠 Documents embedded: ${this.stats.embedded}`);
    console.log(`   ❌ Failed: ${this.stats.failed}`);
    console.log(`   ⏭️  Skipped: ${this.stats.skipped}`);
    
    if (this.stats.processed > 0) {
      const successRate = ((this.stats.embedded / this.stats.processed) * 100).toFixed(1);
      console.log(`   📈 Success rate: ${successRate}%`);
    }
  }

  /**
   * Test embedding functionality
   */
  async testEmbedding() {
    console.log('\n🧪 Testing embedding functionality...');

    try {
      // Test embedding generation
      const testText = 'This is a test document about database design principles in information technology.';
      const embedding = await this.vectorDb.generateEmbeddings(testText);
      
      if (embedding && embedding.length > 0) {
        console.log(`   ✅ Embedding generation working (dimension: ${embedding.length})`);
      } else {
        console.log('   ❌ Embedding generation failed');
      }

      // Test search functionality
      for (const subject of Object.keys(config.subjects)) {
        try {
          const searchResults = await this.vectorDb.search(
            'database design principles',
            subject,
            { limit: 3 }
          );
          
          console.log(`   ✓  Search test for ${subject}: ${searchResults.totalResults} results`);
          
          if (searchResults.results.length > 0) {
            const avgSimilarity = searchResults.results.reduce((sum, r) => sum + r.similarity, 0) / searchResults.results.length;
            console.log(`      Average similarity: ${(avgSimilarity * 100).toFixed(1)}%`);
          }
        } catch (error) {
          console.log(`   ⚠️  Search test failed for ${subject}: ${error.message}`);
        }
      }

    } catch (error) {
      console.log(`   ❌ Embedding test failed: ${error.message}`);
    }
  }

  /**
   * Display vector database statistics
   */
  async displayVectorStats() {
    console.log('\n📊 Vector Database Statistics:');
    console.log('==============================');

    try {
      const health = await this.vectorDb.getHealthStatus();
      console.log(`   Status: ${health.status}`);
      console.log(`   Embedding Model: ${health.embeddingModel}`);

      if (health.collections) {
        console.log('\n   Collections:');
        Object.entries(health.collections).forEach(([subject, stats]) => {
          const subjectName = config.subjects[subject]?.name || subject;
          if (stats.error) {
            console.log(`     ❌ ${subjectName}: ${stats.error}`);
          } else {
            console.log(`     ✓  ${subjectName}: ${stats.documentCount || 0} documents`);
          }
        });
      }

    } catch (error) {
      console.log(`   ❌ Failed to get vector database statistics: ${error.message}`);
    }
  }
}

/**
 * Command line interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'embed';

  const embedder = new DataEmbedder();

  console.log('🎯 Lesson Plan Builder - Data Embedding');
  console.log('========================================\n');

  switch (command) {
    case 'embed':
      await embedder.embedData();
      await embedder.testEmbedding();
      await embedder.displayVectorStats();
      break;

    case 'test':
      await embedder.initializeDatabase();
      await embedder.testEmbedding();
      break;

    case 'stats':
      await embedder.initializeDatabase();
      await embedder.displayVectorStats();
      break;

    case 'help':
      console.log('Available commands:');
      console.log('  embed (default) - Process and embed all documents');
      console.log('  test           - Test embedding functionality');
      console.log('  stats          - Display vector database statistics');
      console.log('  help           - Show this help message');
      break;

    default:
      console.log(`Unknown command: ${command}`);
      console.log('Use "help" to see available commands');
      process.exit(1);
  }
}

/**
 * Run if called directly
 */
if (require.main === module) {
  main().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = DataEmbedder;

