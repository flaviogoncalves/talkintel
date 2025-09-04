import MySQLDatabase from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Database Normalization Migration
 * Fixes 3NF violations and removes redundancies
 */
class DatabaseNormalizationMigration {
  constructor() {
    this.db = new MySQLDatabase();
  }

  async run() {
    console.log('🔧 Starting database normalization migration...');
    
    try {
      await this.db.init();
      
      // Start transaction
      const connection = await this.db.pool.getConnection();
      await connection.beginTransaction();
      
      try {
        // 1. Create new tables
        await this.createAgentsTable(connection);
        await this.createCustomersTable(connection);
        await this.createSubscriptionPlansTable(connection);
        
        // 2. Modify existing tables
        await this.modifyCompaniesTable(connection);
        await this.createNormalizedWebhooksTable(connection);
        
        // 3. Insert default subscription plans
        await this.insertDefaultPlans(connection);
        
        // 4. Migrate existing data
        await this.migrateExistingData(connection);
        
        // Commit transaction
        await connection.commit();
        console.log('✅ Database normalization completed successfully');
        
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async createAgentsTable(connection) {
    console.log('📊 Creating agents table...');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) NOT NULL,
        external_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        type ENUM('human', 'ai') DEFAULT 'human',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        UNIQUE KEY unique_company_external_id (company_id, external_id),
        INDEX idx_company (company_id),
        INDEX idx_external_id (external_id),
        INDEX idx_type (type),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async createCustomersTable(connection) {
    console.log('📊 Creating customers table...');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) NOT NULL,
        external_id VARCHAR(255),
        name VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        INDEX idx_company (company_id),
        INDEX idx_external_id (external_id),
        INDEX idx_phone (phone),
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async createSubscriptionPlansTable(connection) {
    console.log('📊 Creating subscription plans table...');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        plan_type ENUM('basic', 'sales', 'debt_collection', 'customer_service') NOT NULL,
        tier ENUM('basic', 'premium', 'enterprise') NOT NULL,
        features JSON,
        kpi_calculations JSON,
        languages JSON,
        price_monthly DECIMAL(10,2),
        price_yearly DECIMAL(10,2),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_type (plan_type),
        INDEX idx_tier (tier),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async modifyCompaniesTable(connection) {
    console.log('📊 Modifying companies table...');
    
    // Check if columns already exist
    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM companies
    `);
    
    const columnNames = columns.map(col => col.Field);
    
    if (!columnNames.includes('subscription_plan_id')) {
      await connection.execute(`
        ALTER TABLE companies 
        ADD COLUMN subscription_plan_id VARCHAR(36) AFTER subscription_tier,
        ADD COLUMN language VARCHAR(5) DEFAULT 'pt' AFTER subscription_plan_id
      `);
    }
  }

  async createNormalizedWebhooksTable(connection) {
    console.log('📊 Creating normalized webhooks table...');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS webhooks_normalized (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) NOT NULL,
        campaign_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36),
        customer_id VARCHAR(36),
        timestamp TIMESTAMP NOT NULL,
        call_type VARCHAR(50),
        duration INT,
        satisfaction_score DECIMAL(3,2),
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
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
        INDEX idx_company_timestamp (company_id, timestamp),
        INDEX idx_campaign (campaign_id),
        INDEX idx_agent (agent_id),
        INDEX idx_customer (customer_id),
        INDEX idx_sentiment (sentiment),
        INDEX idx_resolved (resolved),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async insertDefaultPlans(connection) {
    console.log('📊 Inserting default subscription plans...');
    
    const plans = [
      {
        id: uuidv4(),
        name: 'Basic Plan',
        plan_type: 'basic',
        tier: 'basic',
        features: JSON.stringify({
          max_webhooks: 1000,
          max_agents: 10,
          basic_kpis: true,
          script_adherence: false,
          real_time_alerts: false
        }),
        kpi_calculations: JSON.stringify({
          sentiment: true,
          satisfaction: true,
          basic_metrics: true
        }),
        languages: JSON.stringify(['pt', 'en']),
        price_monthly: 0.00,
        price_yearly: 0.00
      },
      {
        id: uuidv4(),
        name: 'Sales Premium',
        plan_type: 'sales',
        tier: 'premium',
        features: JSON.stringify({
          max_webhooks: 10000,
          max_agents: 50,
          advanced_kpis: true,
          script_adherence: true,
          real_time_alerts: true,
          custom_scripts: true
        }),
        kpi_calculations: JSON.stringify({
          conversion_rate: true,
          lead_quality: true,
          objection_handling: true,
          closing_effectiveness: true,
          upsell_detection: true
        }),
        languages: JSON.stringify(['pt', 'en']),
        price_monthly: 99.00,
        price_yearly: 990.00
      },
      {
        id: uuidv4(),
        name: 'Debt Collection Premium',
        plan_type: 'debt_collection',
        tier: 'premium',
        features: JSON.stringify({
          max_webhooks: 10000,
          max_agents: 50,
          advanced_kpis: true,
          script_adherence: true,
          compliance_monitoring: true,
          legal_compliance_check: true
        }),
        kpi_calculations: JSON.stringify({
          promise_to_pay: true,
          collection_effectiveness: true,
          compliance_score: true,
          negotiation_success: true,
          payment_arrangement_quality: true
        }),
        languages: JSON.stringify(['pt', 'en']),
        price_monthly: 149.00,
        price_yearly: 1490.00
      },
      {
        id: uuidv4(),
        name: 'Customer Service Enterprise',
        plan_type: 'customer_service',
        tier: 'enterprise',
        features: JSON.stringify({
          max_webhooks: 100000,
          max_agents: 500,
          all_kpis: true,
          script_adherence: true,
          real_time_alerts: true,
          custom_dashboards: true,
          api_access: true,
          white_label: true
        }),
        kpi_calculations: JSON.stringify({
          fcr: true,
          csat: true,
          nps: true,
          agent_empathy: true,
          script_adherence: true,
          conversation_quality: true,
          emotional_journey: true,
          resolution_quality: true
        }),
        languages: JSON.stringify(['pt', 'en', 'es']),
        price_monthly: 499.00,
        price_yearly: 4990.00
      }
    ];

    for (const plan of plans) {
      await connection.execute(`
        INSERT INTO subscription_plans (
          id, name, plan_type, tier, features, kpi_calculations,
          languages, price_monthly, price_yearly, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
      `, [
        plan.id, plan.name, plan.plan_type, plan.tier,
        plan.features, plan.kpi_calculations, plan.languages,
        plan.price_monthly, plan.price_yearly
      ]);
    }
  }

  async migrateExistingData(connection) {
    console.log('📊 Migrating existing data...');
    
    // 1. Migrate unique agents from webhooks table
    const [existingAgents] = await connection.execute(`
      SELECT DISTINCT 
        company_id,
        agent_id as external_id,
        agent_name as name,
        agent_type as type
      FROM webhooks
      WHERE agent_id IS NOT NULL
    `);
    
    for (const agent of existingAgents) {
      const agentId = uuidv4();
      
      try {
        await connection.execute(`
          INSERT INTO agents (id, company_id, external_id, name, type)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type)
        `, [agentId, agent.company_id, agent.external_id, agent.name || 'Unknown Agent', agent.type || 'human']);
      } catch (error) {
        console.warn(`⚠️ Could not migrate agent ${agent.external_id}:`, error.message);
      }
    }
    
    // 2. Migrate unique customers from webhooks table
    const [existingCustomers] = await connection.execute(`
      SELECT DISTINCT 
        company_id,
        customer_id as external_id,
        customer_name as name
      FROM webhooks
      WHERE customer_id IS NOT NULL
    `);
    
    for (const customer of existingCustomers) {
      const customerId = uuidv4();
      
      try {
        await connection.execute(`
          INSERT INTO customers (id, company_id, external_id, name)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE name = VALUES(name)
        `, [customerId, customer.company_id, customer.external_id, customer.name || 'Unknown Customer']);
      } catch (error) {
        console.warn(`⚠️ Could not migrate customer ${customer.external_id}:`, error.message);
      }
    }
    
    // 3. Create normalized webhook records
    console.log('📊 Creating normalized webhook records...');
    
    await connection.execute(`
      INSERT INTO webhooks_normalized (
        id, company_id, campaign_id, agent_id, customer_id,
        timestamp, call_type, duration, satisfaction_score,
        sentiment, topics, tags, resolved, response_time,
        call_quality, cost, currency, transcription, summary,
        key_insights, kpi_data, raw_data, created_at
      )
      SELECT 
        w.id,
        w.company_id,
        COALESCE(w.campaign_id, (SELECT id FROM campaigns WHERE company_id = w.company_id LIMIT 1)),
        a.id as agent_id,
        c.id as customer_id,
        w.timestamp,
        w.call_type,
        w.duration,
        w.satisfaction_score,
        w.sentiment,
        w.topics,
        w.tags,
        w.resolved,
        w.response_time,
        w.call_quality,
        w.cost,
        w.currency,
        w.transcription,
        w.summary,
        w.key_insights,
        w.kpi_data,
        w.raw_data,
        w.created_at
      FROM webhooks w
      LEFT JOIN agents a ON a.company_id = w.company_id AND a.external_id = w.agent_id
      LEFT JOIN customers c ON c.company_id = w.company_id AND c.external_id = w.customer_id
      WHERE NOT EXISTS (
        SELECT 1 FROM webhooks_normalized wn WHERE wn.id = w.id
      )
    `);
    
    console.log('✅ Data migration completed');
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new DatabaseNormalizationMigration();
  migration.run()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export default DatabaseNormalizationMigration;