-- Database Normalization Migration Script
-- This script fixes 3NF violations and removes redundancies

-- ========================================
-- 1. Create Agents Table (New)
-- ========================================
CREATE TABLE IF NOT EXISTS agents (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  external_id VARCHAR(255) NOT NULL, -- The ID from the external system
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 2. Create Customers Table (New)
-- ========================================
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  external_id VARCHAR(255), -- The ID from the external system
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 3. Create Subscription Plans Table (New)
-- ========================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  plan_type ENUM('basic', 'sales', 'debt_collection', 'customer_service') NOT NULL,
  tier ENUM('basic', 'premium', 'enterprise') NOT NULL,
  features JSON,
  kpi_calculations JSON, -- Store specific KPI calculation rules per plan
  languages JSON, -- Store supported languages (e.g., ["en", "pt"])
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (plan_type),
  INDEX idx_tier (tier),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 4. Modify Companies Table
-- ========================================
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS subscription_plan_id VARCHAR(36) AFTER subscription_tier,
ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'pt' AFTER subscription_plan_id,
ADD CONSTRAINT fk_subscription_plan 
  FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id) 
  ON DELETE SET NULL,
ADD INDEX idx_subscription_plan (subscription_plan_id);

-- ========================================
-- 5. Create New Webhooks Table (Normalized)
-- ========================================
CREATE TABLE IF NOT EXISTS webhooks_normalized (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  campaign_id VARCHAR(36) NOT NULL, -- Make campaign required
  agent_id VARCHAR(36), -- Reference to agents table
  customer_id VARCHAR(36), -- Reference to customers table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 6. Update Agent Metrics Table
-- ========================================
ALTER TABLE agent_metrics
DROP COLUMN IF EXISTS name, -- Remove redundant name field
ADD COLUMN IF NOT EXISTS agent_table_id VARCHAR(36) AFTER agent_id,
ADD CONSTRAINT fk_agent_table 
  FOREIGN KEY (agent_table_id) REFERENCES agents(id) 
  ON DELETE CASCADE;

-- ========================================
-- 7. Insert Default Subscription Plans
-- ========================================
INSERT INTO subscription_plans (id, name, plan_type, tier, features, kpi_calculations, languages, price_monthly, price_yearly, is_active)
VALUES 
  (UUID(), 'Basic Plan', 'basic', 'basic', 
   '{"max_webhooks": 1000, "max_agents": 10, "basic_kpis": true}',
   '{"sentiment": true, "satisfaction": true}',
   '["pt", "en"]',
   0.00, 0.00, TRUE),
   
  (UUID(), 'Sales Premium', 'sales', 'premium',
   '{"max_webhooks": 10000, "max_agents": 50, "advanced_kpis": true}',
   '{"conversion_rate": true, "lead_quality": true, "objection_handling": true}',
   '["pt", "en"]',
   99.00, 990.00, TRUE),
   
  (UUID(), 'Debt Collection Premium', 'debt_collection', 'premium',
   '{"max_webhooks": 10000, "max_agents": 50, "advanced_kpis": true}',
   '{"promise_to_pay": true, "collection_effectiveness": true, "compliance_score": true}',
   '["pt", "en"]',
   149.00, 1490.00, TRUE),
   
  (UUID(), 'Customer Service Enterprise', 'customer_service', 'enterprise',
   '{"max_webhooks": 100000, "max_agents": 500, "all_kpis": true}',
   '{"fcr": true, "csat": true, "nps": true, "agent_empathy": true, "script_adherence": true}',
   '["pt", "en"]',
   499.00, 4990.00, TRUE)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- 8. Data Migration Script (Run separately)
-- ========================================
-- This would need to be run as a separate migration to move existing data:
-- 1. Migrate existing agent data from webhooks to agents table
-- 2. Migrate existing customer data from webhooks to customers table
-- 3. Update webhook records to reference new agent/customer IDs
-- 4. Drop redundant columns from webhooks table