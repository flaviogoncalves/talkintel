-- Dashboard Types and Configuration Tables
-- This creates the structure for generic, configurable dashboards

-- Dashboard type definitions
CREATE TABLE IF NOT EXISTS dashboard_types (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  company_id VARCHAR(36) NOT NULL,
  internal_name VARCHAR(100) NOT NULL, -- e.g., 'customer_service_v2'
  display_name VARCHAR(200) NOT NULL, -- e.g., 'Customer Service Excellence'
  description TEXT,
  campaign_type VARCHAR(50), -- Maps to webhook campaign types for filtering
  
  -- UI Configuration
  theme_color VARCHAR(7) DEFAULT '#8B5CF6', -- Hex color
  icon_name VARCHAR(50) DEFAULT 'layout-dashboard', -- Lucide icon name
  
  -- Recording configuration
  recording_url_prefix VARCHAR(500), -- e.g., 'https://recordings.example.com/audio/'
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- One default per company
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_internal_name (company_id, internal_name),
  INDEX idx_campaign_type (campaign_type),
  INDEX idx_company_active (company_id, is_active)
);

-- KPI definitions for each dashboard type
CREATE TABLE IF NOT EXISTS dashboard_kpis (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  dashboard_type_id VARCHAR(36) NOT NULL,
  
  -- KPI Definition
  kpi_key VARCHAR(50) NOT NULL, -- e.g., 'customer_sentiment'
  display_name VARCHAR(100) NOT NULL, -- e.g., 'Customer Sentiment'
  description TEXT,
  
  -- Display Configuration
  icon_name VARCHAR(50) DEFAULT 'activity', -- Lucide icon name
  display_order INT DEFAULT 0,
  
  -- Scoring
  weight DECIMAL(5,2) DEFAULT 10.00, -- Weight percentage (sum should = 100)
  min_value DECIMAL(5,2) DEFAULT 0,
  max_value DECIMAL(5,2) DEFAULT 10,
  
  -- LLM Calculation Hints
  calculation_hint TEXT, -- Instructions for LLM on how to calculate this KPI
  example_good TEXT, -- Example of good performance
  example_bad TEXT, -- Example of poor performance
  
  -- Thresholds for coloring
  threshold_poor DECIMAL(5,2) DEFAULT 4,
  threshold_fair DECIMAL(5,2) DEFAULT 6,
  threshold_good DECIMAL(5,2) DEFAULT 8,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (dashboard_type_id) REFERENCES dashboard_types(id) ON DELETE CASCADE,
  UNIQUE KEY unique_kpi (dashboard_type_id, kpi_key),
  INDEX idx_dashboard_order (dashboard_type_id, display_order)
);

-- LLM prompt profiles for generating KPI scores
CREATE TABLE IF NOT EXISTS llm_profiles (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  dashboard_type_id VARCHAR(36) NOT NULL,
  
  -- Profile settings
  profile_name VARCHAR(100) NOT NULL,
  model_name VARCHAR(50) DEFAULT 'gpt-4', -- or 'claude-3', etc.
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INT DEFAULT 500,
  
  -- Prompt templates
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL, -- Uses placeholders like {transcription}, {agent_name}, etc.
  
  -- Expected output format
  output_format JSON, -- JSON schema for expected output
  
  -- Versioning
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (dashboard_type_id) REFERENCES dashboard_types(id) ON DELETE CASCADE,
  INDEX idx_dashboard_active (dashboard_type_id, is_active)
);

-- Processed KPI scores from webhooks
CREATE TABLE IF NOT EXISTS webhook_kpi_scores (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  webhook_id VARCHAR(36) NOT NULL,
  dashboard_type_id VARCHAR(36) NOT NULL,
  
  -- KPI scores (JSON object with kpi_key -> score mapping)
  kpi_scores JSON NOT NULL,
  overall_score DECIMAL(5,2), -- Weighted average
  
  -- Processing metadata
  llm_profile_id VARCHAR(36),
  processing_time_ms INT,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
  FOREIGN KEY (dashboard_type_id) REFERENCES dashboard_types(id) ON DELETE CASCADE,
  FOREIGN KEY (llm_profile_id) REFERENCES llm_profiles(id) ON DELETE SET NULL,
  UNIQUE KEY unique_webhook_dashboard (webhook_id, dashboard_type_id),
  INDEX idx_webhook (webhook_id),
  INDEX idx_dashboard_scores (dashboard_type_id, created_at)
);

-- Dashboard filters configuration
CREATE TABLE IF NOT EXISTS dashboard_filters (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  dashboard_type_id VARCHAR(36) NOT NULL,
  
  -- Filter configuration
  filter_type VARCHAR(50) NOT NULL, -- 'kpi_range', 'overall_score', 'agent', 'period', 'custom'
  filter_key VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  
  -- Filter parameters
  config JSON, -- e.g., {"min": 0, "max": 10, "step": 0.5} for range filters
  
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (dashboard_type_id) REFERENCES dashboard_types(id) ON DELETE CASCADE,
  INDEX idx_dashboard_filters (dashboard_type_id, is_active, display_order)
);

-- Insert default dashboard types for backward compatibility
INSERT INTO dashboard_types (company_id, internal_name, display_name, description, campaign_type, theme_color, icon_name)
SELECT 
  id as company_id,
  'customer_service' as internal_name,
  'Customer Service Excellence' as display_name,
  'Comprehensive customer service quality analysis with 8 key performance indicators' as description,
  'customer_service' as campaign_type,
  '#8B5CF6' as theme_color,
  'headphones' as icon_name
FROM companies
WHERE NOT EXISTS (
  SELECT 1 FROM dashboard_types WHERE company_id = companies.id AND internal_name = 'customer_service'
);

-- Create default KPIs for customer service dashboard
INSERT INTO dashboard_kpis (dashboard_type_id, kpi_key, display_name, description, icon_name, display_order, weight, calculation_hint)
SELECT 
  dt.id,
  kpi.kpi_key,
  kpi.display_name,
  kpi.description,
  kpi.icon_name,
  kpi.display_order,
  kpi.weight,
  kpi.calculation_hint
FROM dashboard_types dt
CROSS JOIN (
  SELECT 'customer_sentiment_score' as kpi_key, 'Customer Sentiment' as display_name, 
         'Overall customer emotional state throughout the call' as description,
         'heart' as icon_name, 1 as display_order, 20 as weight,
         'Rate from 0-10 based on customer emotional expressions, tone, and satisfaction indicators' as calculation_hint
  UNION ALL
  SELECT 'agent_empathy_score', 'Agent Empathy', 
         'How well the agent demonstrated understanding and compassion',
         'users', 2, 15,
         'Look for empathy markers like "I understand", "I can see why that\'s frustrating", emotional acknowledgment'
  UNION ALL
  SELECT 'first_contact_resolution', 'First Contact Resolution', 
         'Likelihood that the customer\'s issue was resolved in this call',
         'check-circle', 3, 25,
         '10 = completely resolved, 0 = no progress made. Look for resolution language and customer acknowledgment'
  UNION ALL
  SELECT 'customer_effort_score', 'Customer Effort', 
         'How easy was it for the customer to get their issue resolved',
         'activity', 4, 15,
         '10 = very easy/effortless, 0 = very difficult/high effort. Detect friction and complexity'
  UNION ALL
  SELECT 'conversation_flow_quality', 'Conversation Flow', 
         'Natural dialogue progression and turn-taking quality',
         'message-circle', 5, 10,
         'Rate based on interruptions, awkward silences, and natural conversation patterns'
  UNION ALL
  SELECT 'agent_knowledge_assessment', 'Agent Knowledge', 
         'Agent\'s demonstrated expertise and information accuracy',
         'brain', 6, 5,
         'Assess confidence, accuracy of information, and ability to answer without uncertainty'
  UNION ALL
  SELECT 'call_wrap_up_quality', 'Call Wrap-up', 
         'Quality of call conclusion with next steps and confirmation',
         'check-square', 7, 5,
         'Evaluate if agent provided clear next steps, confirmation, and professional closure'
  UNION ALL
  SELECT 'behavioral_standards_compliance', 'Behavioral Standards', 
         'Adherence to professional standards and company protocols',
         'shield', 8, 5,
         'Check for politeness, proper greetings, company protocol adherence'
) as kpi
WHERE dt.internal_name = 'customer_service'
AND NOT EXISTS (
  SELECT 1 FROM dashboard_kpis WHERE dashboard_type_id = dt.id AND kpi_key = kpi.kpi_key
);

-- Create default LLM profile for customer service
INSERT INTO llm_profiles (dashboard_type_id, profile_name, system_prompt, user_prompt_template, output_format)
SELECT 
  dt.id,
  'Customer Service KPI Analyzer v1' as profile_name,
  'You are a contact center quality analyst. Analyze customer service call transcriptions and evaluate them against 8 key performance indicators. Rate each KPI from 0 to 10 based on the conversation.' as system_prompt,
  'Call Transcription:
{transcription}

Agent Name: {agent_name}
Customer Name: {customer_name}
Call Duration: {duration} seconds

Evaluate the following 8 KPIs and provide a score from 0-10 for each:

1. Customer Sentiment Score (0-10): Overall customer emotional state throughout the call
2. Agent Empathy Score (0-10): How well the agent demonstrated understanding and compassion
3. First Contact Resolution (0-10): Likelihood that the issue was resolved in this call
4. Customer Effort Score (0-10): How easy was it for the customer to get their issue resolved
5. Conversation Flow Quality (0-10): Natural dialogue progression and turn-taking
6. Agent Knowledge Assessment (0-10): Agent expertise and information accuracy
7. Call Wrap-up Quality (0-10): Quality of call conclusion with next steps
8. Behavioral Standards Compliance (0-10): Adherence to professional standards

Provide your evaluation in the following JSON structure:
{
  "customer_sentiment_score": 0,
  "agent_empathy_score": 0,
  "first_contact_resolution": 0,
  "customer_effort_score": 0,
  "conversation_flow_quality": 0,
  "agent_knowledge_assessment": 0,
  "call_wrap_up_quality": 0,
  "behavioral_standards_compliance": 0
}' as user_prompt_template,
  JSON_OBJECT(
    'type', 'object',
    'properties', JSON_OBJECT(
      'customer_sentiment_score', JSON_OBJECT('type', 'number', 'minimum', 0, 'maximum', 10),
      'agent_empathy_score', JSON_OBJECT('type', 'number', 'minimum', 0, 'maximum', 10),
      'first_contact_resolution', JSON_OBJECT('type', 'number', 'minimum', 0, 'maximum', 10),
      'customer_effort_score', JSON_OBJECT('type', 'number', 'minimum', 0, 'maximum', 10),
      'conversation_flow_quality', JSON_OBJECT('type', 'number', 'minimum', 0, 'maximum', 10),
      'agent_knowledge_assessment', JSON_OBJECT('type', 'number', 'minimum', 0, 'maximum', 10),
      'call_wrap_up_quality', JSON_OBJECT('type', 'number', 'minimum', 0, 'maximum', 10),
      'behavioral_standards_compliance', JSON_OBJECT('type', 'number', 'minimum', 0, 'maximum', 10)
    ),
    'required', JSON_ARRAY(
      'customer_sentiment_score',
      'agent_empathy_score',
      'first_contact_resolution',
      'customer_effort_score',
      'conversation_flow_quality',
      'agent_knowledge_assessment',
      'call_wrap_up_quality',
      'behavioral_standards_compliance'
    )
  ) as output_format
FROM dashboard_types dt
WHERE dt.internal_name = 'customer_service'
AND NOT EXISTS (
  SELECT 1 FROM llm_profiles WHERE dashboard_type_id = dt.id
);