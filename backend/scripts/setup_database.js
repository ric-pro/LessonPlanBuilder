/**
 * Database Setup Script for Lesson Plan Builder
 * Initializes ChromaDB collections and prepares the vector database
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { config, validateConfig } = require('../src/config');
const logger = require('../src/utils/logger');
const VectorDatabase = require('../src/services/vectorDatabase');

/**
 * Database Setup Class
 */
class DatabaseSetup {
  constructor() {
    this.vectorDb = new VectorDatabase();
  }

  /**
   * Main setup function
   */
  async setup() {
    try {
      console.log('Starting database setup...\n');

      // Validate configuration
      await this.validateConfiguration();

      // Create required directories
      await this.createDirectories();

      // Initialize vector database
      await this.initializeVectorDatabase();

      // Verify setup
      await this.verifySetup();

      console.log('\nDatabase setup completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Upload unit outline documents using: POST /api/documents/upload');
      console.log('2. Test document search using: POST /api/documents/search');
      console.log('3. Check vector database health: GET /api/health/detailed\n');

    } catch (error) {
      console.error('\n Database setup failed:', error.message);
      console.error('\nTroubleshooting:');
      console.error('1. Ensure ChromaDB is running (if using external instance)');
      console.error('2. Check your Hugging Face API key in .env file');
      console.error('3. Verify network connectivity');
      console.error('4. Check file system permissions\n');
      process.exit(1);
    }
  }

  /**
   * Validate configuration
   */
  async validateConfiguration() {
    console.log(' Validating configuration...');

    try {
      validateConfig();
      console.log('    Configuration validation passed');
    } catch (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }

    // Check Hugging Face API key
    if (!config.huggingface.apiKey || config.huggingface.apiKey === 'test_key_for_phase1') {
      throw new Error('Please set a valid HUGGINGFACE_API_KEY in your .env file');
    }
    console.log('    Hugging Face API key configured');

    // Check required directories
    const requiredDirs = ['data', 'data/uploads', 'data/processed', 'data/chroma_db', 'logs'];
    for (const dir of requiredDirs) {
      const fullPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(fullPath)) {
        console.log(`   ⚠️  Directory missing: ${dir} (will be created)`);
      }
    }

    console.log('    Configuration validated\n');
  }

  /**
   * Create required directories
   */
  async createDirectories() {
    console.log('📁 Creating required directories...');

    const directories = [
      'data',
      'data/uploads',
      'data/processed',
      'data/chroma_db',
      'logs'
    ];

    for (const dir of directories) {
      const fullPath = path.join(process.cwd(), dir);
      
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`   ✅ Created: ${dir}`);
      } else {
        console.log(`   ✓  Exists: ${dir}`);
      }
    }

    // Create .gitkeep files to preserve empty directories
    const gitkeepDirs = ['data/uploads', 'data/processed', 'data/chroma_db'];
    for (const dir of gitkeepDirs) {
      const gitkeepPath = path.join(process.cwd(), dir, '.gitkeep');
      if (!fs.existsSync(gitkeepPath)) {
        fs.writeFileSync(gitkeepPath, '');
        console.log(`   ✅ Created .gitkeep in ${dir}`);
      }
    }

    console.log('   ✅ Directory structure ready\n');
  }

  /**
   * Initialize vector database
   */
  async initializeVectorDatabase() {
    console.log('🧠 Initializing vector database...');

    try {
      // Initialize the vector database
      await this.vectorDb.initialize();
      console.log('   ✅ Vector database initialized');

      // Check collections for each subject
      for (const [subjectKey, subjectConfig] of Object.entries(config.subjects)) {
        try {
          const stats = await this.vectorDb.getCollectionStats(subjectKey);
          console.log(`   ✅ Collection ready: ${subjectConfig.name} (${stats.documentCount} documents)`);
        } catch (error) {
          console.log(`   ⚠️  Collection issue for ${subjectConfig.name}: ${error.message}`);
        }
      }

      console.log('   ✅ Vector database ready\n');

    } catch (error) {
      console.log('   ⚠️  Vector database initialization failed, using mock mode');
      console.log(`   ℹ️  Error: ${error.message}`);
      console.log('   ℹ️  This is normal for development without ChromaDB server\n');
    }
  }

  /**
   * Verify setup
   */
  async verifySetup() {
    console.log('🔍 Verifying setup...');

    // Check vector database health
    try {
      const health = await this.vectorDb.getHealthStatus();
      console.log(`   ✅ Vector database status: ${health.status}`);
      
      if (health.collections) {
        Object.entries(health.collections).forEach(([subject, stats]) => {
          if (stats.error) {
            console.log(`   ⚠️  ${subject}: ${stats.error}`);
          } else {
            console.log(`   ✓  ${subject}: ${stats.documentCount || 0} documents`);
          }
        });
      }
    } catch (error) {
      console.log(`   ⚠️  Vector database health check failed: ${error.message}`);
    }

    // Check file system permissions
    try {
      const testFile = path.join(process.cwd(), 'data', 'test_write.tmp');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log('   ✅ File system write permissions OK');
    } catch (error) {
      console.log(`   ❌ File system write permissions failed: ${error.message}`);
    }

    // Test embedding generation (if possible)
    try {
      const testEmbedding = await this.vectorDb.generateEmbeddings('test text');
      if (testEmbedding && testEmbedding.length > 0) {
        console.log(`   ✅ Embedding generation working (dimension: ${testEmbedding.length})`);
      } else {
        console.log('   ⚠️  Embedding generation returned empty result');
      }
    } catch (error) {
      console.log(`   ⚠️  Embedding generation test failed: ${error.message}`);
      console.log('   ℹ️  This may be due to API rate limits or network issues');
    }

    console.log('   ✅ Setup verification completed\n');
  }

  /**
   * Display configuration summary
   */
  displayConfigSummary() {
    console.log('📊 Configuration Summary:');
    console.log(`   • Environment: ${config.server.environment}`);
    console.log(`   • Port: ${config.server.port}`);
    console.log(`   • Embedding Model: sentence-transformers/all-MiniLM-L6-v2`);
    console.log(`   • Supported Subjects: ${Object.keys(config.subjects).join(', ')}`);
    console.log(`   • Max File Size: ${config.upload.maxFileSize / 1024 / 1024}MB`);
    console.log(`   • ChromaDB Host: ${config.chroma.host}:${config.chroma.port}`);
    console.log(`   • Log Level: ${config.logging.level}\n`);
  }
}

/**
 * Run setup if called directly
 */
if (require.main === module) {
  const setup = new DatabaseSetup();
  
  console.log('🎯 Lesson Plan Builder - Database Setup');
  console.log('=====================================\n');
  
  setup.displayConfigSummary();
  setup.setup().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

module.exports = DatabaseSetup;

