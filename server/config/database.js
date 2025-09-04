import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sippulse_analytics',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Enable multiple statements for migrations
  multipleStatements: true,
  // Convert MySQL datetime to JavaScript Date
  dateStrings: false,
  // Handle timezone properly
  timezone: '+00:00'
};

class MySQLDatabase {
  constructor() {
    this.pool = null;
    this.isInitialized = false;
  }

  async init() {
    try {
      // Create connection pool
      this.pool = mysql.createPool(dbConfig);
      
      // Test connection
      const connection = await this.pool.getConnection();
      console.log('✅ MySQL database connection established');
      connection.release();
      
      // Initialize database structure
      await this.initDatabase();
      this.isInitialized = true;
      
    } catch (error) {
      console.error('❌ MySQL connection failed:', error);
      throw error;
    }
  }

  async initDatabase() {
    try {
      console.log('🏗️  Creating database structure...');
      
      // Create database if it doesn't exist
      const tempPool = mysql.createPool({
        ...dbConfig,
        database: undefined // Connect without specifying database
      });
      
      await tempPool.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
      await tempPool.end();
      
      // Create tables
      await this.createTables();
      console.log('✅ Database structure created successfully');
      
    } catch (error) {
      console.error('❌ Error creating database structure:', error);
      throw error;
    }
  }

  async createTables() {
    // Only drop tables if explicitly requested via environment variable
    if (process.env.DROP_TABLES === 'true') {
      try {
        await this.pool.execute('SET FOREIGN_KEY_CHECKS = 0');
        await this.pool.execute('DROP TABLE IF EXISTS refresh_tokens');
        await this.pool.execute('DROP TABLE IF EXISTS agent_metrics');
        await this.pool.execute('DROP TABLE IF EXISTS webhooks');
        await this.pool.execute('DROP TABLE IF EXISTS campaigns');
        await this.pool.execute('DROP TABLE IF EXISTS users');
        await this.pool.execute('DROP TABLE IF EXISTS companies');
        await this.pool.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('📦 Dropped existing tables for schema update');
      } catch (error) {
        console.log('No existing tables to drop or error:', error.message);
      }
    }

    const tables = [
      // Companies table (campaign-based architecture)
      `CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        subscription_tier ENUM('basic', 'premium', 'enterprise') DEFAULT 'basic',
        is_active BOOLEAN DEFAULT TRUE,
        settings JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        company_id VARCHAR(36) NOT NULL,
        role ENUM('admin', 'manager', 'viewer') DEFAULT 'viewer',
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        INDEX idx_company (company_id),
        INDEX idx_email (email),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Campaigns table
      `CREATE TABLE IF NOT EXISTS campaigns (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        webhook_endpoint VARCHAR(36) UNIQUE NOT NULL,
        description TEXT,
        script TEXT,
        campaign_type ENUM('sales', 'debt_collection', 'customer_service') DEFAULT 'customer_service',
        dashboard_type_id VARCHAR(36) NULL,
        is_active BOOLEAN DEFAULT TRUE,
        settings JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        UNIQUE KEY unique_company_name (company_id, name),
        INDEX idx_company (company_id),
        INDEX idx_webhook_endpoint (webhook_endpoint),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Agents table
      `CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) NOT NULL,
        external_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type ENUM('human', 'ai') DEFAULT 'human',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        UNIQUE KEY unique_company_external_id (company_id, external_id),
        INDEX idx_company (company_id),
        INDEX idx_external_id (external_id),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Customers table
      `CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) NOT NULL,
        external_id VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        UNIQUE KEY unique_company_external_id (company_id, external_id),
        INDEX idx_company (company_id),
        INDEX idx_external_id (external_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Webhooks normalized table (primary table for webhook data)
      `CREATE TABLE IF NOT EXISTS webhooks_normalized (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) NOT NULL,
        campaign_id VARCHAR(36),
        agent_id VARCHAR(36),
        customer_id VARCHAR(36),
        timestamp TIMESTAMP NOT NULL,
        call_type VARCHAR(50),
        duration INT,
        satisfaction_score DECIMAL(3,2),
        sentiment_score DECIMAL(3,2),
        recovery_rate DECIMAL(5,2),
        sentiment ENUM('positive', 'neutral', 'negative'),
        topics JSON,
        tags JSON,
        resolved BOOLEAN,
        response_time INT,
        call_quality DECIMAL(3,2),
        cost DECIMAL(10,4),
        currency VARCHAR(3) DEFAULT 'BRL',
        transcription TEXT,
        summary TEXT,
        key_insights JSON,
        kpi_data JSON,
        raw_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
        INDEX idx_company_timestamp (company_id, timestamp),
        INDEX idx_campaign (campaign_id),
        INDEX idx_agent (agent_id),
        INDEX idx_customer (customer_id),
        INDEX idx_sentiment (sentiment),
        INDEX idx_resolved (resolved),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Webhooks table (legacy - kept for compatibility)
      `CREATE TABLE IF NOT EXISTS webhooks (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) NOT NULL,
        campaign_id VARCHAR(36),
        campaign_name VARCHAR(255),
        timestamp TIMESTAMP NOT NULL,
        call_type VARCHAR(50),
        agent_id VARCHAR(255),
        agent_name VARCHAR(255),
        agent_type ENUM('human', 'ai'),
        customer_id VARCHAR(255),
        customer_name VARCHAR(255),
        duration INT,
        satisfaction_score DECIMAL(3,2),
        sentiment_score DECIMAL(3,2),
        recovery_rate DECIMAL(5,2),
        sentiment ENUM('positive', 'neutral', 'negative'),
        topics JSON,
        tags JSON,
        resolved BOOLEAN,
        response_time INT,
        call_quality DECIMAL(3,2),
        cost DECIMAL(10,4),
        currency VARCHAR(3) DEFAULT 'BRL',
        transcription TEXT,
        summary TEXT,
        key_insights JSON,
        kpi_data JSON,
        raw_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
        INDEX idx_company_timestamp (company_id, timestamp),
        INDEX idx_campaign (campaign_id),
        INDEX idx_agent (agent_id),
        INDEX idx_sentiment (sentiment),
        INDEX idx_resolved (resolved),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Agent metrics table (updated for multi-company)
      `CREATE TABLE IF NOT EXISTS agent_metrics (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) NOT NULL,
        campaign_id VARCHAR(36),
        agent_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type ENUM('human', 'ai') NOT NULL,
        total_calls INT DEFAULT 0,
        average_duration DECIMAL(8,2) DEFAULT 0,
        satisfaction_score DECIMAL(3,2) DEFAULT 0,
        resolution_rate DECIMAL(5,2) DEFAULT 0,
        average_response_time DECIMAL(8,2) DEFAULT 0,
        call_quality DECIMAL(3,2) DEFAULT 0,
        total_cost DECIMAL(10,4) DEFAULT 0,
        average_cost DECIMAL(10,4) DEFAULT 0,
        top_tags JSON,
        top_topics JSON,
        sentiment_distribution JSON,
        composite_performance_index DECIMAL(5,2) DEFAULT 0,
        performance_grade VARCHAR(3) DEFAULT 'C',
        trend ENUM('up', 'down', 'stable') DEFAULT 'stable',
        trend_value DECIMAL(5,2) DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
        UNIQUE KEY unique_company_agent (company_id, agent_id),
        INDEX idx_company (company_id),
        INDEX idx_campaign (campaign_id),
        INDEX idx_type (type),
        INDEX idx_satisfaction (satisfaction_score),
        INDEX idx_updated (last_updated)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Refresh tokens table for JWT management
      `CREATE TABLE IF NOT EXISTS refresh_tokens (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user (user_id),
        INDEX idx_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // KPI calculation history table
      `CREATE TABLE IF NOT EXISTS kpi_calculations (
        id VARCHAR(36) PRIMARY KEY,
        webhook_id VARCHAR(36) NOT NULL,
        company_id VARCHAR(36) NOT NULL,
        campaign_id VARCHAR(36),
        campaign_type ENUM('sales', 'customer_service', 'debt_collection'),
        kpi_name VARCHAR(100) NOT NULL,
        kpi_value DECIMAL(10,4),
        kpi_details JSON,
        calculation_metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (webhook_id) REFERENCES webhooks_normalized(id) ON DELETE CASCADE,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
        INDEX idx_webhook_kpi (webhook_id, kpi_name),
        INDEX idx_company_campaign (company_id, campaign_id),
        INDEX idx_campaign_type_kpi (campaign_type, kpi_name),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ];

    for (const table of tables) {
      await this.pool.execute(table);
    }
    
    // Migration: Add script column to existing campaigns table
    await this.runMigrations();
  }

  async runMigrations() {
    try {
      // Check if script column exists in campaigns table
      const [columns] = await this.pool.execute(`
        SHOW COLUMNS FROM campaigns LIKE 'script'
      `);
      
      if (columns.length === 0) {
        console.log('🔧 Adding script column to campaigns table...');
        await this.pool.execute(`
          ALTER TABLE campaigns ADD COLUMN script TEXT AFTER description
        `);
        console.log('✅ Script column added successfully');
      }

      // Check if sentiment_score column exists in webhooks_normalized table
      const [sentimentColumns] = await this.pool.execute(`
        SHOW COLUMNS FROM webhooks_normalized LIKE 'sentiment_score'
      `);
      
      if (sentimentColumns.length === 0) {
        console.log('🔧 Adding sentiment_score column to webhooks_normalized table...');
        await this.pool.execute(`
          ALTER TABLE webhooks_normalized ADD COLUMN sentiment_score DECIMAL(3,2) AFTER satisfaction_score
        `);
        console.log('✅ Sentiment_score column added successfully');
      }

      // Check if recovery_rate column exists in webhooks_normalized table
      const [recoveryColumns] = await this.pool.execute(`
        SHOW COLUMNS FROM webhooks_normalized LIKE 'recovery_rate'
      `);
      
      if (recoveryColumns.length === 0) {
        console.log('🔧 Adding recovery_rate column to webhooks_normalized table...');
        await this.pool.execute(`
          ALTER TABLE webhooks_normalized ADD COLUMN recovery_rate DECIMAL(5,2) AFTER sentiment_score
        `);
        console.log('✅ Recovery_rate column added successfully');
      }

      // Check if composite_performance_index column exists in agent_metrics table
      const [compositeColumns] = await this.pool.execute(`
        SHOW COLUMNS FROM agent_metrics LIKE 'composite_performance_index'
      `);
      
      if (compositeColumns.length === 0) {
        console.log('🔧 Adding composite_performance_index column to agent_metrics table...');
        await this.pool.execute(`
          ALTER TABLE agent_metrics ADD COLUMN composite_performance_index DECIMAL(5,2) DEFAULT 0
        `);
        console.log('✅ Composite_performance_index column added successfully');
      }

      // Check if performance_grade column exists in agent_metrics table
      const [gradeColumns] = await this.pool.execute(`
        SHOW COLUMNS FROM agent_metrics LIKE 'performance_grade'
      `);
      
      if (gradeColumns.length === 0) {
        console.log('🔧 Adding performance_grade column to agent_metrics table...');
        await this.pool.execute(`
          ALTER TABLE agent_metrics ADD COLUMN performance_grade VARCHAR(3) DEFAULT 'C'
        `);
        console.log('✅ Performance_grade column added successfully');
      }
    } catch (error) {
      console.error('⚠️ Migration error (non-critical):', error.message);
    }

    // Add LLM configuration columns to companies table
    try {
      const [columns] = await this.pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'llm_api_key_encrypted'`,
        [dbConfig.database]
      );
      
      if (columns.length === 0) {
        console.log('🔧 Adding LLM configuration columns to companies table...');
        
        await this.pool.execute(`
          ALTER TABLE companies 
          ADD COLUMN llm_api_key_encrypted TEXT,
          ADD COLUMN llm_api_url VARCHAR(255) DEFAULT 'http://api.sippulse.ai',
          ADD COLUMN llm_model VARCHAR(100) DEFAULT 'gpt-3.5-turbo',
          ADD COLUMN encryption_iv VARCHAR(32)
        `);
        console.log('✅ LLM configuration columns added successfully');
      }
    } catch (error) {
      console.error('⚠️ LLM configuration migration error:', error.message);
    }

    // Add script columns to campaigns table
    try {
      const [columns] = await this.pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'call_script'`,
        [dbConfig.database]
      );
      
      if (columns.length === 0) {
        console.log('🔧 Adding script columns to campaigns table...');
        
        await this.pool.execute(`
          ALTER TABLE campaigns 
          ADD COLUMN call_script TEXT,
          ADD COLUMN script_required_elements JSON,
          ADD COLUMN script_adherence_enabled BOOLEAN DEFAULT FALSE
        `);
        console.log('✅ Script columns added successfully');
      }
    } catch (error) {
      console.error('⚠️ Script columns migration error:', error.message);
    }

    // Add script adherence columns to webhooks_normalized table
    try {
      const [columns] = await this.pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'webhooks_normalized' AND COLUMN_NAME = 'script_adherence_score'`,
        [dbConfig.database]
      );
      
      if (columns.length === 0) {
        console.log('🔧 Adding script adherence columns to webhooks_normalized table...');
        
        await this.pool.execute(`
          ALTER TABLE webhooks_normalized 
          ADD COLUMN script_adherence_score DECIMAL(5,2),
          ADD COLUMN script_adherence_details JSON,
          ADD COLUMN script_adherence_calculated_at TIMESTAMP NULL
        `);
        console.log('✅ Script adherence columns added successfully');
      }
    } catch (error) {
      console.error('⚠️ Script adherence migration error:', error.message);
    }

    // Add advanced KPIs column to webhooks_normalized table
    try {
      const [advancedKpiColumns] = await this.pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'webhooks_normalized' AND COLUMN_NAME = 'advanced_kpis'`,
        [dbConfig.database]
      );
      
      if (advancedKpiColumns.length === 0) {
        console.log('🔧 Adding advanced_kpis column to webhooks_normalized table...');
        
        await this.pool.execute(`
          ALTER TABLE webhooks_normalized 
          ADD COLUMN advanced_kpis JSON,
          ADD COLUMN advanced_kpis_calculated_at TIMESTAMP NULL
        `);
        
        // Add index for efficient querying by calculation timestamp
        await this.pool.execute(`
          CREATE INDEX idx_advanced_kpis_calculated 
          ON webhooks_normalized ((JSON_EXTRACT(advanced_kpis, '$.calculated_at')))
        `);
        
        console.log('✅ Advanced KPIs column added successfully');
      }
    } catch (error) {
      console.error('⚠️ Advanced KPIs migration error:', error.message);
    }

    // Add Customer Service Score and simplified KPI columns
    try {
      const [customerServiceScoreColumns] = await this.pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'webhooks_normalized' AND COLUMN_NAME = 'customer_service_score'`,
        [dbConfig.database]
      );
      
      if (customerServiceScoreColumns.length === 0) {
        console.log('🔧 Adding Customer Service Score and KPI columns to webhooks_normalized table...');
        
        await this.pool.execute(`
          ALTER TABLE webhooks_normalized 
          ADD COLUMN customer_service_score DECIMAL(3,1) NULL,
          ADD COLUMN kpi_scores JSON
        `);
        
        // Add index for efficient querying by Customer Service Score
        await this.pool.execute(`
          CREATE INDEX idx_customer_service_score 
          ON webhooks_normalized (customer_service_score)
        `);
        
        console.log('✅ Customer Service Score columns added successfully');
      }
    } catch (error) {
      console.error('⚠️ Customer Service Score migration error:', error.message);
    }

    // Add average script adherence to agent_metrics table
    try {
      const [columns] = await this.pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'agent_metrics' AND COLUMN_NAME = 'average_script_adherence'`,
        [dbConfig.database]
      );
      
      if (columns.length === 0) {
        console.log('🔧 Adding average_script_adherence column to agent_metrics table...');
        
        await this.pool.execute(`
          ALTER TABLE agent_metrics 
          ADD COLUMN average_script_adherence DECIMAL(5,2)
        `);
        console.log('✅ Average script adherence column added successfully');
      }
    } catch (error) {
      console.error('⚠️ Agent metrics migration error:', error.message);
    }
  }

  async query(sql, params = []) {
    if (!this.isInitialized) {
      await this.init();
    }
    
    try {
      const [results] = await this.pool.execute(sql, params);
      return results;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async transaction(callback) {
    if (!this.isInitialized) {
      await this.init();
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔌 MySQL connection pool closed');
    }
  }

  // Health check method
  async healthCheck() {
    try {
      await this.query('SELECT 1 as health');
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date() };
    }
  }
}

export default MySQLDatabase;