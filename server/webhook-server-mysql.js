import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import MySQLDatabase from './config/database.js';
import AuthService, { authenticateToken, requireRole, validateCompanyAccess } from './middleware/auth.js';
import CompanyService from './services/companyService.js';
import WebhookProcessorFixed from './services/webhookProcessorFixed.js';
import DashboardKpiProcessor from './services/dashboardKpiProcessor.js';
import WebhookKpiProcessor from './services/webhookKpiProcessor.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Debug middleware - log all requests
app.use((req, res, next) => {
  if (!req.url.includes('/events') && !req.url.includes('/health')) {
    console.log(`🌐 ${req.method} ${req.url}`);
  }
  next();
});

// Initialize database connection first
const db = new MySQLDatabase();
await db.init();

// Initialize services after database is ready
const authService = new AuthService(db);
const companyService = new CompanyService(db);
const dashboardKpiProcessor = new DashboardKpiProcessor(db);
const webhookKpiProcessor = new WebhookKpiProcessor(db.pool);
let clients = []; // For Server-Sent Events

// ==================== AUTHENTICATION ROUTES ====================

// Register company and admin user (campaign-based architecture)
app.post('/auth/register', async (req, res) => {
  try {
    console.log('📝 Registration request received:', JSON.stringify(req.body, null, 2));
    const { company, admin } = req.body;

    // Validate required fields
    if (!company?.name || !admin?.email || !admin?.password || !admin?.name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['company.name', 'admin.email', 'admin.password', 'admin.name']
      });
    }

    // Check if email already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [admin.email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered'
      });
    }

    const companyId = uuidv4();
    const userId = uuidv4();
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(admin.password, 12);

    // Insert company (no webhook endpoint at company level)
    await db.query(`
      INSERT INTO companies (id, name, domain, subscription_tier, settings)
      VALUES (?, ?, ?, ?, ?)
    `, [companyId, company.name, company.domain || '', company.subscriptionTier || 'basic', JSON.stringify(company.settings || {})]);

    // Insert admin user
    await db.query(`
      INSERT INTO users (id, email, password_hash, name, company_id, role)
      VALUES (?, ?, ?, ?, ?, 'admin')
    `, [userId, admin.email, passwordHash, admin.name, companyId]);

    res.status(201).json({
      success: true,
      message: 'Company and admin user created successfully',
      data: {
        company: {
          id: companyId,
          name: company.name,
          subscriptionTier: company.subscriptionTier || 'basic'
        },
        admin: {
          id: userId,
          email: admin.email,
          name: admin.name
        },
        note: 'Create campaigns to get unique webhook endpoints for each operation type'
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const result = await authService.login(email, password);

    res.json({
      success: true,
      message: 'Login successful',
      data: result
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      error: 'Login failed',
      message: error.message
    });
  }
});

// ==================== CAMPAIGN ROUTES ====================

// Create campaign
app.post('/api/campaigns', authenticateToken(authService), async (req, res) => {
  try {
    const { name, description, script, campaign_type, dashboard_type_id } = req.body;
    const companyId = req.user.companyId;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Campaign name is required'
      });
    }

    // Validate dashboard type if provided
    let finalCampaignType = campaign_type || 'customer_service';
    if (dashboard_type_id) {
      const dashboardType = await db.query(
        'SELECT campaign_type FROM dashboard_types WHERE id = ? AND company_id = ? AND is_active = 1',
        [dashboard_type_id, companyId]
      );
      
      if (dashboardType.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid dashboard type ID or dashboard type not found'
        });
      }
      
      // Use the dashboard type's campaign type
      finalCampaignType = dashboardType[0].campaign_type;
    } else {
      // Validate campaign type if no dashboard type provided
      const validTypes = ['sales', 'debt_collection', 'customer_service'];
      if (campaign_type && !validTypes.includes(campaign_type)) {
        return res.status(400).json({
          success: false,
          error: 'Campaign type must be one of: sales, debt_collection, customer_service'
        });
      }
    }

    // Check if campaign name already exists for this company
    const existing = await db.query('SELECT id FROM campaigns WHERE company_id = ? AND name = ?', [companyId, name.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Campaign name already exists'
      });
    }

    const campaignId = uuidv4();
    const webhookEndpoint = uuidv4();

    await db.query(`
      INSERT INTO campaigns (id, company_id, name, webhook_endpoint, description, script, campaign_type, dashboard_type_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [campaignId, companyId, name.trim(), webhookEndpoint, description || '', script || '', finalCampaignType, dashboard_type_id || null]);

    const campaign = await db.query('SELECT * FROM campaigns WHERE id = ?', [campaignId]);

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: {
        ...campaign[0],
        webhook_url: `http://localhost:${PORT}/webhook/${webhookEndpoint}`
      }
    });

  } catch (error) {
    console.error('Campaign creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get campaigns
app.get('/api/campaigns', authenticateToken(authService), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const campaigns = await db.query(`
      SELECT * FROM campaigns 
      WHERE company_id = ? 
      ORDER BY created_at DESC
    `, [companyId]);

    res.json({
      success: true,
      data: campaigns
    });

  } catch (error) {
    console.error('Campaigns fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete campaign
app.delete('/api/campaigns/:campaignId', authenticateToken(authService), async (req, res) => {
  try {
    const { campaignId } = req.params;
    const companyId = req.user.companyId;

    // Verify campaign belongs to the user's company
    const campaign = await db.query(
      'SELECT id FROM campaigns WHERE id = ? AND company_id = ?',
      [campaignId, companyId]
    );

    if (campaign.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found or unauthorized'
      });
    }

    // Delete the campaign (webhooks will be handled by CASCADE)
    await db.query('DELETE FROM campaigns WHERE id = ?', [campaignId]);

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });

  } catch (error) {
    console.error('Campaign deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Refresh token
app.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token is required'
      });
    }

    const result = await authService.refreshToken(refreshToken);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Token refresh failed',
      message: error.message
    });
  }
});

// Logout
app.post('/auth/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout error',
      message: error.message
    });
  }
});

// ==================== WEBHOOK ENDPOINTS ====================

// Multi-company webhook endpoint - /webhook/{company-uuid}
app.post('/webhook/:companyId', async (req, res) => {
  try {
    console.log(`📞 Received webhook for company: ${req.params.companyId}`, new Date().toISOString());

    // Validate company exists and is active
    const company = await companyService.getCompanyByWebhookEndpoint(req.params.companyId);
    if (!company) {
      console.log(`❌ Invalid company webhook endpoint: ${req.params.companyId}`);
      return res.status(404).json({
        error: 'Invalid webhook endpoint',
        message: 'Company not found or inactive'
      });
    }

    // Validate webhook structure
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'Invalid webhook payload',
        message: 'Webhook body must be a valid JSON object'
      });
    }

    // Process webhook data using TalkIntel KPI processor
    let processedWebhook;
    try {
      // Use the comprehensive KPI processing for all webhooks
      processedWebhook = WebhookProcessorFixed.processWebhook(req.body);
      
      console.log('✅ Webhook processado com KPIs TalkIntel');
    } catch (processingError) {
      console.error('Erro no processamento do webhook TalkIntel:', processingError);
      return res.status(400).json({
        error: 'Formato de webhook inválido',
        message: processingError.message
      });
    }

    // Add timestamp and ID if not present
    const webhookData = {
      id: processedWebhook.id || `webhook-${Date.now()}`,
      company_id: company.id,
      timestamp: new Date(processedWebhook.timestamp || new Date()),
      call_type: processedWebhook.call_type || 'human-human',
      agent_id: processedWebhook.participants?.[0] || null,
      agent_name: processedWebhook.agent_name || null,
      agent_type: 'human',
      customer_id: processedWebhook.participants?.[1] || null,
      customer_name: processedWebhook.customer_name || null,
      duration: processedWebhook.duration || 0,
      satisfaction_score: processedWebhook.satisfaction_score || 0,
      sentiment: processedWebhook.sentiment || 'neutral',
      topics: JSON.stringify(processedWebhook.topics || []),
      tags: JSON.stringify([]), // Can be extended later
      resolved: typeof processedWebhook.resolution === 'boolean' ? processedWebhook.resolution : null,
      response_time: null, // Can be calculated from segments
      call_quality: null, // Can be calculated from audio quality metrics
      cost: processedWebhook.usage?.cost || 0,
      currency: processedWebhook.usage?.currency || 'BRL',
      transcription: processedWebhook.text || '',
      summary: processedWebhook.summarization || '',
      key_insights: JSON.stringify([]), // Can be extracted from analysis
      raw_data: JSON.stringify(req.body)
    };

    // Save to MySQL database
    await db.query(
      `INSERT INTO webhooks (
        id, company_id, timestamp, call_type, agent_id, agent_name, agent_type,
        customer_id, customer_name, duration, satisfaction_score, sentiment_score, recovery_rate, sentiment,
        topics, tags, resolved, response_time, call_quality, cost, currency,
        transcription, summary, key_insights, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        webhookData.id, webhookData.company_id, webhookData.timestamp, webhookData.call_type,
        webhookData.agent_id, webhookData.agent_name, webhookData.agent_type,
        webhookData.customer_id, webhookData.customer_name, webhookData.duration,
        webhookData.satisfaction_score, webhookData.sentiment_score, webhookData.recovery_rate, webhookData.sentiment, webhookData.topics,
        webhookData.tags, webhookData.resolved, webhookData.response_time,
        webhookData.call_quality, webhookData.cost, webhookData.currency,
        webhookData.transcription, webhookData.summary, webhookData.key_insights,
        webhookData.raw_data
      ]
    );

    // Update agent metrics if agent_id exists (SYNCHRONOUS - blocks response until complete)
    if (webhookData.agent_id) {
      console.log(`🔄 Updating agent metrics synchronously for agent ${webhookData.agent_id}`);
      try {
        await companyService.updateAgentMetrics(company.id, webhookData.agent_id);
        console.log(`✅ Agent metrics updated successfully for agent ${webhookData.agent_id}`);
      } catch (error) {
        console.error(`❌ Failed to update agent metrics for agent ${webhookData.agent_id}:`, error);
      }
    }

    // Calculate script adherence for premium companies (async, non-blocking)
    if (company.subscription_tier === 'premium' || company.subscription_tier === 'enterprise') {
      // Use setImmediate to avoid blocking the response
      setImmediate(async () => {
        try {
          const ScriptAdherenceService = (await import('./services/scriptAdherenceService.js')).default;
          const scriptService = new ScriptAdherenceService(db);
          await scriptService.calculateScriptAdherence(webhookData.id);
          console.log(`📊 Script adherence calculated for webhook ${webhookData.id}`);
        } catch (error) {
          console.error(`⚠️ Script adherence calculation failed for webhook ${webhookData.id}:`, error.message);
        }
      });
    }

    // Calculate advanced KPIs for premium companies with transcription (async, non-blocking)
    if ((company.subscription_tier === 'premium' || company.subscription_tier === 'enterprise') && 
        webhookData.transcription && webhookData.transcription.trim() !== '') {
      // Use setImmediate to avoid blocking the response
      setImmediate(async () => {
        try {
          const AdvancedKPIService = (await import('./services/advancedKPIService.js')).default;
          const kpiService = new AdvancedKPIService(db);
          await kpiService.calculateAdvancedKPIs(webhookData.id);
          console.log(`🎯 Advanced KPIs calculated for webhook ${webhookData.id}`);
        } catch (error) {
          console.error(`⚠️ Advanced KPI calculation failed for webhook ${webhookData.id}:`, error.message);
        }
      });
    }

    // Get updated agent metrics if available
    let updatedAgentMetrics = null;
    if (webhookData.agent_id) {
      try {
        const agentMetrics = await db.query(
          'SELECT * FROM agent_metrics WHERE company_id = ? AND agent_id = ?',
          [company.id, webhookData.agent_id]
        );
        if (agentMetrics.length > 0) {
          updatedAgentMetrics = agentMetrics[0];
        }
      } catch (error) {
        console.warn('Failed to get updated agent metrics:', error.message);
      }
    }

    // Broadcast to company-specific clients via SSE
    const message = JSON.stringify({
      type: 'webhook',
      companyId: company.id,
      data: {
        ...processedWebhook,
        company_id: company.id,
        agent_metrics_updated: !!updatedAgentMetrics,
        updated_agent_metrics: updatedAgentMetrics
      }
    });

    clients
      .filter(client => client.companyId === company.id)
      .forEach(client => {
        try {
          client.res.write(`data: ${message}\n\n`);
        } catch (error) {
          console.error('Error sending SSE message:', error);
        }
      });

    console.log(`✅ Webhook saved for company: ${company.name} (${webhookData.id})`);

    // Process KPIs using configurable dashboard types (async, doesn't block response)
    dashboardKpiProcessor.processWebhookKpis(webhookData.id, company.id)
      .catch(error => console.error('❌ KPI processing error:', error));

    // Respond to webhook sender
    res.status(200).json({
      success: true,
      message: 'Webhook received and processed successfully',
      id: webhookData.id,
      company: company.name,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Helper function to get or create agent
async function getOrCreateAgent(companyId, externalId, name, type = 'human') {
  if (!externalId) return null;
  
  try {
    // Try to find existing agent
    const existingAgent = await db.query(
      'SELECT id FROM agents WHERE company_id = ? AND external_id = ?',
      [companyId, externalId]
    );
    
    if (existingAgent.length > 0) {
      return existingAgent[0].id;
    }
    
    // Create new agent
    const agentId = uuidv4();
    await db.query(
      `INSERT INTO agents (id, company_id, external_id, name, type, is_active) 
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [agentId, companyId, externalId, name || 'Unknown Agent', type]
    );
    
    console.log(`👤 Created new agent: ${name} (${externalId})`);
    return agentId;
  } catch (error) {
    console.error('Error creating agent:', error);
    return null;
  }
}

// Helper function to get or create customer
async function getOrCreateCustomer(companyId, externalId, name) {
  if (!externalId) return null;
  
  try {
    // Try to find existing customer
    const existingCustomer = await db.query(
      'SELECT id FROM customers WHERE company_id = ? AND external_id = ?',
      [companyId, externalId]
    );
    
    if (existingCustomer.length > 0) {
      return existingCustomer[0].id;
    }
    
    // Create new customer
    const customerId = uuidv4();
    await db.query(
      `INSERT INTO customers (id, company_id, external_id, name) 
       VALUES (?, ?, ?, ?)`,
      [customerId, companyId, externalId, name || 'Unknown Customer']
    );
    
    console.log(`👥 Created new customer: ${name} (${externalId})`);
    return customerId;
  } catch (error) {
    console.error('Error creating customer:', error);
    return null;
  }
}

// Campaign-based webhook endpoint - /webhook/campaign/{campaign-webhook-uuid}
app.post('/webhook/campaign/:campaignEndpoint', async (req, res) => {
  try {
    console.log(`📞 Received webhook for campaign: ${req.params.campaignEndpoint}`, new Date().toISOString());

    // Get campaign by webhook endpoint
    const campaign = await db.query(
      'SELECT c.*, comp.name as company_name FROM campaigns c JOIN companies comp ON c.company_id = comp.id WHERE c.webhook_endpoint = ? AND c.is_active = TRUE AND comp.is_active = TRUE',
      [req.params.campaignEndpoint]
    );

    if (campaign.length === 0) {
      console.log(`❌ Invalid campaign webhook endpoint: ${req.params.campaignEndpoint}`);
      return res.status(404).json({
        error: 'Invalid webhook endpoint',
        message: 'Campaign not found or inactive'
      });
    }

    const campaignData = campaign[0];
    console.log(`📋 Processing webhook for campaign: ${campaignData.name} (${campaignData.campaign_type})`);

    // Validate webhook structure
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'Invalid webhook payload',
        message: 'Webhook body must be a valid JSON object'
      });
    }

    // Process webhook data using TalkIntel KPI processor with campaign script
    let processedWebhook;
    try {
      processedWebhook = WebhookProcessorFixed.processWebhook(req.body);
      
      console.log('✅ Webhook processado com KPIs TalkIntel e Script Adherence');
    } catch (processingError) {
      console.error('Erro no processamento do webhook TalkIntel:', processingError);
      return res.status(400).json({
        error: 'Formato de webhook inválido',
        message: processingError.message
      });
    }

    // Get or create agent and customer records using normalized structure
    const agentExternalId = processedWebhook.agent_name || null;
    const customerExternalId = processedWebhook.customer_name || null;
    const agentType = 'human';
    
    let agentTableId = null;
    let customerTableId = null;
    
    if (agentExternalId) {
      agentTableId = await getOrCreateAgent(
        campaignData.company_id,
        agentExternalId,
        processedWebhook.agent_name || 'Unknown Agent',
        agentType
      );
    }
    
    if (customerExternalId) {
      customerTableId = await getOrCreateCustomer(
        campaignData.company_id,
        customerExternalId,
        processedWebhook.customer_name || 'Unknown Customer'
      );
    }

    // Debug: Log processed webhook data for troubleshooting
    console.log('🔍 Processed webhook data:', {
      id: processedWebhook.id,
      duration: processedWebhook.duration,
      satisfaction_score: processedWebhook.satisfaction_score,
      sentiment: processedWebhook.sentiment,
      topics: processedWebhook.topics,
      sippulse_kpis: processedWebhook.sippulse_kpis
    });

    // Prepare normalized webhook data
    const webhookData = {
      id: processedWebhook.id || `webhook-${Date.now()}`,
      company_id: campaignData.company_id,
      campaign_id: campaignData.id,
      agent_id: agentTableId,
      customer_id: customerTableId,
      timestamp: new Date(processedWebhook.timestamp || new Date()),
      call_type: processedWebhook.call_type || 'human-human',
      duration: processedWebhook.duration || 0,
      satisfaction_score: processedWebhook.satisfaction_score ? (processedWebhook.satisfaction_score / 10) : null,
      sentiment_score: processedWebhook.sentiment_score ? (processedWebhook.sentiment_score / 10) : null,
      recovery_rate: processedWebhook.recovery_rate || null,
      sentiment: processedWebhook.sentiment || 'neutral',
      topics: JSON.stringify(processedWebhook.topics || []),
      tags: JSON.stringify([]),
      resolved: processedWebhook.resolved || null,
      response_time: null,
      call_quality: null,
      cost: processedWebhook.cost || 0,
      currency: processedWebhook.currency || 'BRL',
      transcription: processedWebhook.transcription || '',
      summary: processedWebhook.summary || '',
      key_insights: JSON.stringify([]),
      kpi_data: JSON.stringify(processedWebhook.sippulse_kpis || {}),
      raw_data: JSON.stringify(req.body)
    };
    
    console.log('📝 Final webhook data for DB:', {
      duration: webhookData.duration,
      satisfaction_score: webhookData.satisfaction_score,
      sentiment: webhookData.sentiment,
      topics: webhookData.topics
    });

    // Save to normalized webhooks table
    await db.query(
      `INSERT INTO webhooks (
        id, company_id, campaign_id, agent_id, customer_id, timestamp, call_type,
        duration, satisfaction_score, sentiment_score, recovery_rate, sentiment, topics, tags, resolved,
        response_time, call_quality, cost, currency, transcription, summary,
        key_insights, kpi_data, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        webhookData.id, webhookData.company_id, webhookData.campaign_id, webhookData.agent_id,
        webhookData.customer_id, webhookData.timestamp, webhookData.call_type, webhookData.duration,
        webhookData.satisfaction_score, webhookData.sentiment_score, webhookData.recovery_rate, webhookData.sentiment, webhookData.topics, webhookData.tags,
        webhookData.resolved, webhookData.response_time, webhookData.call_quality, webhookData.cost,
        webhookData.currency, webhookData.transcription, webhookData.summary, webhookData.key_insights,
        webhookData.kpi_data, webhookData.raw_data
      ]
    );

    // Update agent metrics if agent_id exists (SYNCHRONOUS - blocks response until complete)
    if (webhookData.agent_id) {
      console.log(`🔄 Updating agent metrics synchronously for agent ${webhookData.agent_id}`);
      try {
        await companyService.updateAgentMetrics(campaignData.company_id, webhookData.agent_id);
        console.log(`✅ Agent metrics updated successfully for agent ${webhookData.agent_id}`);
      } catch (error) {
        console.error(`❌ Failed to update agent metrics for agent ${webhookData.agent_id}:`, error);
      }
    }

    // Calculate script adherence for premium companies with script adherence enabled (async, non-blocking)
    if ((campaignData.subscription_tier === 'premium' || campaignData.subscription_tier === 'enterprise') &&
        campaignData.script_adherence_enabled) {
      // Use setImmediate to avoid blocking the response
      setImmediate(async () => {
        try {
          const ScriptAdherenceService = (await import('./services/scriptAdherenceService.js')).default;
          const scriptService = new ScriptAdherenceService(db);
          await scriptService.calculateScriptAdherence(webhookData.id);
          console.log(`📊 Script adherence calculated for campaign webhook ${webhookData.id}`);
        } catch (error) {
          console.error(`⚠️ Script adherence calculation failed for webhook ${webhookData.id}:`, error.message);
        }
      });
    }

    // Calculate advanced KPIs for premium companies with transcription (async, non-blocking)
    if ((campaignData.subscription_tier === 'premium' || campaignData.subscription_tier === 'enterprise') && 
        webhookData.transcription && webhookData.transcription.trim() !== '') {
      // Use setImmediate to avoid blocking the response
      setImmediate(async () => {
        try {
          const AdvancedKPIService = (await import('./services/advancedKPIService.js')).default;
          const kpiService = new AdvancedKPIService(db);
          await kpiService.calculateAdvancedKPIs(webhookData.id);
          console.log(`🎯 Advanced KPIs calculated for campaign webhook ${webhookData.id}`);
        } catch (error) {
          console.error(`⚠️ Advanced KPI calculation failed for webhook ${webhookData.id}:`, error.message);
        }
      });
    }

    // Get updated agent metrics if available
    let updatedAgentMetrics = null;
    if (webhookData.agent_id) {
      try {
        const agentMetrics = await db.query(
          'SELECT * FROM agent_metrics WHERE company_id = ? AND agent_id = ?',
          [campaignData.company_id, webhookData.agent_id]
        );
        if (agentMetrics.length > 0) {
          updatedAgentMetrics = agentMetrics[0];
        }
      } catch (error) {
        console.warn('Failed to get updated agent metrics:', error.message);
      }
    }

    // Broadcast to company-specific clients via SSE
    const message = JSON.stringify({
      type: 'webhook',
      companyId: campaignData.company_id,
      campaignId: campaignData.id,
      campaignName: campaignData.name,
      data: {
        ...processedWebhook,
        company_id: campaignData.company_id,
        campaign_id: campaignData.id,
        campaign_name: campaignData.name,
        agent_metrics_updated: !!updatedAgentMetrics,
        updated_agent_metrics: updatedAgentMetrics
      }
    });

    clients
      .filter(client => client.companyId === campaignData.company_id)
      .forEach(client => {
        try {
          client.res.write(`data: ${message}\n\n`);
        } catch (error) {
          console.error('Error sending SSE message:', error);
        }
      });

    console.log(`✅ Webhook saved for campaign: ${campaignData.name} (${webhookData.id})`);

    // Process KPIs using configurable dashboard types (async, doesn't block response)
    dashboardKpiProcessor.processWebhookKpis(webhookData.id, campaignData.company_id)
      .catch(error => console.error('❌ KPI processing error:', error));

    // Respond to webhook sender
    res.status(200).json({
      success: true,
      message: 'Webhook received and processed successfully',
      id: webhookData.id,
      campaign: campaignData.name,
      company: campaignData.company_name,
      script_adherence_calculated: !!campaignData.script,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing campaign webhook:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ==================== PROTECTED API ROUTES ====================

// Server-Sent Events endpoint for real-time updates (company-specific)
app.get('/events', async (req, res) => {
  // Handle authentication via query parameter for EventSource compatibility
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  try {
    // Verify the token
    const decoded = await authService.verifyToken(token);
    req.user = decoded;
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Add client to the company-specific list
  const client = {
    res,
    companyId: req.user.companyId,
    userId: req.user.userId
  };
  clients.push(client);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ 
    type: 'connected', 
    message: 'Connected to company webhook stream',
    companyId: req.user.companyId 
  })}\n\n`);

  // Remove client when connection closes
  req.on('close', () => {
    clients = clients.filter(c => c !== client);
  });
});

// Get company dashboard stats
app.get('/api/dashboard/stats', 
  authenticateToken(authService),
  validateCompanyAccess(authService),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const dateRange = startDate && endDate ? { start: startDate, end: endDate } : null;
      
      const stats = await companyService.getCompanyDashboardStats(req.user.companyId, dateRange);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Get debt collection metrics
app.get('/api/companies/:companyId/debt-collection-metrics',
  authenticateToken(authService),
  validateCompanyAccess(authService),
  async (req, res) => {
    try {
      const { period = '7d' } = req.query;
      const companyId = req.params.companyId === 'current' ? req.user.companyId : (req.params.companyId || req.user.companyId);
      
      // Validate company access
      if (companyId !== req.user.companyId) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only access your own company data'
        });
      }
      
      const metrics = await companyService.getDebtCollectionMetrics(companyId, period);
      
      res.json(metrics);
    } catch (error) {
      console.error('Error getting debt collection metrics:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Get sales metrics
app.get('/api/companies/:companyId/sales-metrics',
  authenticateToken(authService),
  validateCompanyAccess(authService),
  async (req, res) => {
    try {
      const { period = '7d' } = req.query;
      const companyId = req.params.companyId === 'current' ? req.user.companyId : (req.params.companyId || req.user.companyId);
      
      // Validate company access
      if (companyId !== req.user.companyId) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only access your own company data'
        });
      }
      
      const metrics = await companyService.getSalesMetrics(companyId, period);
      
      res.json(metrics);
    } catch (error) {
      console.error('Error getting sales metrics:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Get company agents (temporarily without auth for debugging)
app.get('/api/agents', 
  async (req, res) => {
    try {
      // Temporarily hardcode company ID for testing
      const companyId = '4a1a9020-bff6-42e8-b1c5-79fafb36d2ce'; // Nicolas company
      const agents = await companyService.getCompanyAgents(companyId);
      
      res.json({
        success: true,
        count: agents.length,
        data: agents
      });
    } catch (error) {
      console.error('Error getting agents:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Get company webhooks with pagination and filters
app.get('/api/webhooks', 
  authenticateToken(authService),
  validateCompanyAccess(authService),
  async (req, res) => {
    try {
      const {
        limit = 50,
        offset = 0,
        startDate,
        endDate,
        agentId,
        sentiment,
        campaign_type
      } = req.query;

      const options = {
        limit: parseInt(limit),
        offset: parseInt(offset),
        startDate: startDate || null,
        endDate: endDate || null,
        agentId: agentId || null,
        sentiment: sentiment || null,
        campaignType: campaign_type || null
      };

      const result = await companyService.getCompanyWebhooks(req.user.companyId, options);
      
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error getting webhooks:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Get specific webhook by ID (company-scoped)
app.get('/api/webhooks/:id', 
  authenticateToken(authService),
  validateCompanyAccess(authService),
  async (req, res) => {
    try {
      const results = await db.query(
        `SELECT 
          w.*,
          c.name as campaign_name,
          a.name as agent_name,
          a.external_id as agent_external_id,
          a.type as agent_type,
          cust.name as customer_name,
          cust.external_id as customer_external_id
        FROM webhooks w
        LEFT JOIN campaigns c ON w.campaign_id = c.id
        LEFT JOIN agents a ON w.agent_id = a.id
        LEFT JOIN customers cust ON w.customer_id = cust.id
        WHERE w.id = ? AND w.company_id = ?`,
        [req.params.id, req.user.companyId]
      );

      if (results.length === 0) {
        return res.status(404).json({
          error: 'Webhook not found'
        });
      }

      const webhook = results[0];
      res.json({
        success: true,
        data: {
          ...webhook,
          topics: webhook.topics ? JSON.parse(webhook.topics) : [],
          tags: webhook.tags ? JSON.parse(webhook.tags) : [],
          key_insights: webhook.key_insights ? JSON.parse(webhook.key_insights) : [],
          raw_data: webhook.raw_data ? JSON.parse(webhook.raw_data) : null
        }
      });
    } catch (error) {
      console.error('Error getting webhook by ID:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Get webhook KPI scores with filtering
app.get('/api/webhooks/kpi-scores', 
  authenticateToken(authService),
  validateCompanyAccess(authService),
  async (req, res) => {
    try {
      const companyId = req.user.companyId;
      const {
        dashboard_type_id,
        days_ago_from = '7',
        days_ago_to = '0',
        overall_score_min = '0',
        overall_score_max = '10',
        limit = '100'
      } = req.query;

      // Build the WHERE clause
      let whereConditions = [`wks.dashboard_type_id IN (
        SELECT id FROM dashboard_types WHERE company_id = ? AND id = COALESCE(?, id)
      )`];
      let params = [companyId, dashboard_type_id || null];

      // Date range filter
      if (days_ago_from && days_ago_to) {
        whereConditions.push(`w.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`);
        whereConditions.push(`w.created_at <= DATE_SUB(NOW(), INTERVAL ? DAY)`);
        params.push(parseInt(days_ago_from), parseInt(days_ago_to));
      }

      // Overall score filter
      if (overall_score_min && overall_score_max) {
        whereConditions.push(`wks.overall_score >= ? AND wks.overall_score <= ?`);
        params.push(parseFloat(overall_score_min), parseFloat(overall_score_max));
      }

      // KPI-specific filters
      Object.keys(req.query).forEach(key => {
        if (key.startsWith('kpi_') && key.endsWith('_min')) {
          const kpiKey = key.replace('kpi_', '').replace('_min', '');
          const minValue = req.query[key];
          const maxValue = req.query[`kpi_${kpiKey}_max`];
          
          if (minValue && maxValue) {
            whereConditions.push(`JSON_EXTRACT(wks.kpi_scores, ?) >= ? AND JSON_EXTRACT(wks.kpi_scores, ?) <= ?`);
            params.push(`$.${kpiKey}`, parseFloat(minValue), `$.${kpiKey}`, parseFloat(maxValue));
          }
        }
      });

      const sql = `
        SELECT 
          wks.*,
          w.agent_name,
          w.customer_name,
          w.call_duration,
          w.recording_filename as recording_url,
          dt.display_name as dashboard_name,
          dt.recording_url_prefix
        FROM webhook_kpi_scores wks
        JOIN webhooks w ON wks.webhook_id = w.id
        JOIN dashboard_types dt ON wks.dashboard_type_id = dt.id
        WHERE w.company_id = ? AND ${whereConditions.join(' AND ')}
        ORDER BY wks.created_at DESC
        LIMIT ?
      `;

      const [results] = await db.pool.execute(sql, [companyId, ...params, parseInt(limit)]);

      // Parse JSON fields
      const kpiScores = results.map(row => ({
        ...row,
        kpi_scores: typeof row.kpi_scores === 'string' ? JSON.parse(row.kpi_scores) : row.kpi_scores
      }));

      res.json({
        success: true,
        kpi_scores: kpiScores,
        total: kpiScores.length,
        filters_applied: {
          dashboard_type_id,
          days_ago_from,
          days_ago_to,
          overall_score_range: [overall_score_min, overall_score_max]
        }
      });

    } catch (error) {
      console.error('Error fetching KPI scores:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Recalculate agent metrics endpoint (with authentication)
app.post('/api/agents/recalculate-metrics', 
  authenticateToken(authService),
  async (req, res) => {
    try {
      const companyId = req.user.companyId;
      const { agent_id } = req.body; // Optional: recalculate specific agent
      
      console.log(`🔄 Metrics recalculation requested for company ${companyId}${agent_id ? `, agent ${agent_id}` : ' (all agents)'}`);
      
      let agentsUpdated = 0;
      let message = '';
      
      if (agent_id) {
        // Recalculate specific agent
        await companyService.updateAgentMetrics(companyId, agent_id);
        agentsUpdated = 1;
        message = `Successfully recalculated metrics for agent ${agent_id}`;
      } else {
        // Recalculate all agents
        agentsUpdated = await companyService.recalculateAllAgentMetrics(companyId);
        message = `Successfully recalculated metrics for ${agentsUpdated} agents`;
      }
      
      // Broadcast update to connected clients
      const notification = JSON.stringify({
        type: 'metrics_updated',
        companyId: companyId,
        agents_updated: agentsUpdated,
        timestamp: new Date().toISOString()
      });

      clients
        .filter(client => client.companyId === companyId)
        .forEach(client => {
          try {
            client.res.write(`data: ${notification}\n\n`);
          } catch (error) {
            console.error('Error sending SSE metrics update:', error);
          }
        });
      
      res.json({
        success: true,
        message,
        agents_updated: agentsUpdated,
        company_id: companyId
      });
    } catch (error) {
      console.error('Error recalculating agent metrics:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Company settings management
app.get('/api/company/settings', 
  authenticateToken(authService),
  requireRole('admin', 'manager'),
  async (req, res) => {
    try {
      const company = await companyService.getCompanyById(req.user.companyId);
      
      if (!company) {
        return res.status(404).json({
          error: 'Company not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: company.id,
          name: company.name,
          domain: company.domain,
          subscription_tier: company.subscription_tier,
          settings: company.settings ? (typeof company.settings === 'string' ? JSON.parse(company.settings) : company.settings) : {},
          webhook_endpoint: `${req.protocol}://${req.get('host')}/webhook/${company.webhook_endpoint}`
        }
      });
    } catch (error) {
      console.error('Error getting company settings:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

app.put('/api/company/settings', 
  authenticateToken(authService),
  requireRole('admin'),
  async (req, res) => {
    try {
      const { settings } = req.body;
      
      const updatedCompany = await companyService.updateCompanySettings(
        req.user.companyId, 
        settings
      );
      
      res.json({
        success: true,
        message: 'Company settings updated successfully',
        data: updatedCompany
      });
    } catch (error) {
      console.error('Error updating company settings:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Upgrade subscription endpoint
app.post('/api/company/upgrade-subscription', 
  authenticateToken(authService),
  requireRole('admin'),
  async (req, res) => {
    try {
      const { targetTier } = req.body;
      console.log('🔍 Full user object:', req.user);
      
      if (!req.user || !req.user.companyId) {
        return res.status(400).json({
          error: 'Missing company ID',
          message: 'User session does not contain valid company information'
        });
      }
      
      const companyId = req.user.companyId;
      
      console.log('🔄 Upgrade request:', { companyId, targetTier, user: req.user.email });
      
      // Validate target tier
      const validTiers = ['premium', 'enterprise'];
      if (!validTiers.includes(targetTier)) {
        return res.status(400).json({
          error: 'Invalid subscription tier',
          message: 'Valid tiers are: premium, enterprise'
        });
      }
      
      // Get current company info
      const companies = await db.query(
        'SELECT subscription_tier FROM companies WHERE id = ?',
        [companyId]
      );
      
      console.log('📊 Database query result:', { 
        companiesLength: companies ? companies.length : 0, 
        companies,
        isArray: Array.isArray(companies),
        typeOf: typeof companies
      });
      
      // The query should return an array of rows
      if (!Array.isArray(companies) || companies.length === 0) {
        console.log('❌ No company found for ID:', companyId);
        return res.status(404).json({
          error: 'Company not found'
        });
      }
      
      const company = companies[0];
      if (!company) {
        return res.status(404).json({
          error: 'Company data not found'
        });
      }
      
      console.log('🏢 Company data:', company);
      const currentTier = (company && company.subscription_tier) ? company.subscription_tier : 'basic';
      console.log('📈 Current tier:', currentTier);
      
      // Check if already at target tier or higher
      const tierOrder = { basic: 0, premium: 1, enterprise: 2 };
      if (tierOrder[currentTier] >= tierOrder[targetTier]) {
        return res.status(400).json({
          error: 'Invalid upgrade',
          message: `Already at ${currentTier} tier or higher`
        });
      }
      
      // Update subscription tier
      await db.query(
        'UPDATE companies SET subscription_tier = ?, updated_at = NOW() WHERE id = ?',
        [targetTier, companyId]
      );
      
      console.log(`🎉 Company ${companyId} upgraded from ${currentTier} to ${targetTier} by ${req.user.email}`);
      
      // Get updated company info to return
      const updatedCompanies = await db.query(
        'SELECT id, name, domain, subscription_tier, settings FROM companies WHERE id = ?',
        [companyId]
      );
      
      // The query should return an array of rows
      if (!Array.isArray(updatedCompanies) || updatedCompanies.length === 0) {
        return res.status(500).json({
          error: 'Failed to retrieve updated company information'
        });
      }
      
      const updatedCompany = updatedCompanies[0];
      
      if (!updatedCompany) {
        return res.status(500).json({
          error: 'Updated company data not found'
        });
      }
      
      res.json({
        success: true,
        message: `Successfully upgraded to ${targetTier}!`,
        data: {
          id: updatedCompany.id,
          name: updatedCompany.name,
          domain: updatedCompany.domain,
          subscription_tier: updatedCompany.subscription_tier,
          settings: updatedCompany.settings ? (typeof updatedCompany.settings === 'string' ? JSON.parse(updatedCompany.settings) : updatedCompany.settings) : {},
          previous_tier: currentTier,
          new_tier: targetTier
        }
      });
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Delete webhook endpoint
app.delete('/api/webhooks/:webhookId', 
  authenticateToken(authService),
  async (req, res) => {
    try {
      const { webhookId } = req.params;
      const companyId = req.user.companyId;
      
      // Check if webhook exists and belongs to the user's company
      const webhook = await db.query(
        'SELECT id FROM webhooks WHERE id = ? AND company_id = ?',
        [webhookId, companyId]
      );
      
      if (webhook.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Webhook not found'
        });
      }
      
      // Delete the webhook
      await db.query('DELETE FROM webhooks WHERE id = ? AND company_id = ?', [webhookId, companyId]);
      
      console.log(`🗑️ Webhook ${webhookId} deleted by user ${req.user.email}`);
      
      // Notify connected clients about the webhook deletion
      const notification = {
        type: 'webhook_deleted',
        webhook_id: webhookId,
        timestamp: new Date().toISOString()
      };
      
      clients.forEach(client => {
        if (client.companyId === companyId) {
          client.res.write(`data: ${JSON.stringify(notification)}\n\n`);
        }
      });
      
      res.json({
        success: true,
        message: 'Webhook deleted successfully'
      });
      
    } catch (error) {
      console.error('Error deleting webhook:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// ==================== ADVANCED KPI ROUTES ====================

// Calculate advanced KPIs for a specific webhook
app.post('/api/webhooks/:webhookId/calculate-kpis',
  authenticateToken(authService),
  requireRole('admin', 'manager'),
  async (req, res) => {
    try {
      const { webhookId } = req.params;
      const companyId = req.user.companyId;
      
      // Verify webhook belongs to company
      const [webhook] = await db.query(
        'SELECT id FROM webhooks WHERE id = ? AND company_id = ?',
        [webhookId, companyId]
      );
      
      if (!webhook) {
        return res.status(404).json({
          success: false,
          error: 'Webhook not found'
        });
      }
      
      const AdvancedKPIService = (await import('./services/advancedKPIService.js')).default;
      const kpiService = new AdvancedKPIService(db);
      
      const result = await kpiService.calculateAdvancedKPIs(webhookId);
      
      if (!result) {
        return res.json({
          success: false,
          message: 'Advanced KPI calculation not available for this webhook (requires premium subscription and transcription)'
        });
      }
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error calculating advanced KPIs:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Get aggregated KPIs for company/campaign
app.get('/api/companies/:companyId/advanced-kpis',
  authenticateToken(authService),
  validateCompanyAccess(authService),
  async (req, res) => {
    try {
      const { campaignId, campaignType, dateRange = '7d' } = req.query;
      const companyId = req.params.companyId === 'current' ? req.user.companyId : (req.params.companyId || req.user.companyId);
      
      // Validate company access
      if (companyId !== req.user.companyId) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only access your own company data'
        });
      }
      
      const AdvancedKPIService = (await import('./services/advancedKPIService.js')).default;
      const kpiService = new AdvancedKPIService(db);
      
      const result = await kpiService.getAggregatedKPIs(
        companyId, 
        campaignId || null, 
        campaignType || null, 
        dateRange
      );
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error getting aggregated KPIs:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Get sales-specific KPIs (enhanced metrics)
app.get('/api/companies/:companyId/sales-kpis',
  authenticateToken(authService),
  validateCompanyAccess(authService),
  async (req, res) => {
    try {
      const { campaignId, dateRange = '7d' } = req.query;
      const companyId = req.params.companyId === 'current' ? req.user.companyId : (req.params.companyId || req.user.companyId);
      
      // Validate company access
      if (companyId !== req.user.companyId) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only access your own company data'
        });
      }
      
      const AdvancedKPIService = (await import('./services/advancedKPIService.js')).default;
      const kpiService = new AdvancedKPIService(db);
      
      // Get aggregated Sales KPIs
      const salesKPIs = await kpiService.getAggregatedKPIs(
        companyId, 
        campaignId, 
        'sales', 
        dateRange
      );
      
      // Enhance with traditional sales metrics
      const traditionalMetrics = await companyService.getSalesMetrics(companyId, dateRange);
      
      const enhancedData = salesKPIs ? {
        ...salesKPIs,
        traditional_metrics: traditionalMetrics
      } : traditionalMetrics;
      
      res.json({
        success: true,
        data: enhancedData
      });
    } catch (error) {
      console.error('Error getting sales KPIs:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Get customer service-specific KPIs (enhanced metrics)
app.get('/api/companies/:companyId/customer-service-kpis',
  authenticateToken(authService),
  validateCompanyAccess(authService),
  async (req, res) => {
    try {
      const { campaignId, dateRange = '7d' } = req.query;
      const companyId = req.params.companyId === 'current' ? req.user.companyId : (req.params.companyId || req.user.companyId);
      
      console.log('🔍 Company ID debugging:');
      console.log('  req.params.companyId:', req.params.companyId);
      console.log('  req.user.companyId:', req.user.companyId);
      console.log('  extracted companyId:', companyId);
      console.log('  comparison result:', companyId !== req.user.companyId);
      
      // Validate company access
      if (companyId !== req.user.companyId) {
        console.log('❌ Company access denied - IDs do not match');
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only access your own company data'
        });
      }
      
      console.log('✅ Company access granted');
      
      // Check company subscription tier for premium features
      console.log('🔍 Checking subscription for company:', companyId);
      const queryResult = await db.query(
        'SELECT subscription_tier FROM companies WHERE id = ?',
        [companyId]
      );
      console.log('🔍 Raw DB query result:', queryResult);
      
      // Handle mysql2/promise result format: [rows, fields]
      const companies = Array.isArray(queryResult[0]) ? queryResult[0] : queryResult;
      console.log('🔍 Processed companies:', companies);
      
      if (!companies || companies.length === 0) {
        console.log('❌ Company not found for ID:', companyId);
        return res.status(404).json({
          error: 'Company not found'
        });
      }
      
      const company = companies[0];
      console.log('🔍 Company subscription tier:', company.subscription_tier);
      
      if (company.subscription_tier === 'basic') {
        console.log('❌ Basic subscription, denying access');
        return res.status(403).json({
          error: 'Premium subscription required',
          message: 'Advanced Customer Service Analytics require a premium or enterprise subscription'
        });
      }
      
      console.log('✅ Premium subscription confirmed, proceeding...');
      
      const AdvancedKPIService = (await import('./services/advancedKPIService.js')).default;
      const kpiService = new AdvancedKPIService(db);
      
      // Get aggregated Customer Service KPIs
      const customerServiceKPIs = await kpiService.getAggregatedKPIs(
        companyId, 
        campaignId, 
        'customer_service', 
        dateRange
      );
      
      // Enhance with traditional customer service metrics (if available)
      // This would be similar to getSalesMetrics but for customer service
      
      res.json({
        success: true,
        data: customerServiceKPIs
      });
    } catch (error) {
      console.error('Error getting customer service KPIs:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Bulk calculate advanced KPIs for multiple webhooks
app.post('/api/companies/:companyId/bulk-calculate-kpis',
  authenticateToken(authService),
  requireRole('admin'),
  async (req, res) => {
    try {
      const { campaignId, dateRange = '7d', force = false } = req.body;
      const companyId = req.params.companyId === 'current' ? req.user.companyId : (req.params.companyId || req.user.companyId);
      
      // Validate company access
      if (companyId !== req.user.companyId) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only access your own company data'
        });
      }
      
      // Get webhooks that need KPI calculation
      let dateCondition = '';
      const params = [companyId];
      
      // Add date range condition
      switch (dateRange) {
        case '7d':
          dateCondition = 'AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
          break;
        case '30d':
          dateCondition = 'AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
          break;
        case '90d':
          dateCondition = 'AND timestamp >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
          break;
      }
      
      let campaignCondition = '';
      if (campaignId) {
        campaignCondition = 'AND campaign_id = ?';
        params.push(campaignId);
      }
      
      const kpiCondition = force ? '' : 'AND advanced_kpis IS NULL';
      
      const webhooks = await db.query(`
        SELECT w.id, w.transcription, c.campaign_type
        FROM webhooks w
        JOIN campaigns c ON w.campaign_id = c.id
        WHERE w.company_id = ? 
          AND w.transcription IS NOT NULL 
          AND w.transcription != ''
          ${dateCondition}
          ${campaignCondition}
          ${kpiCondition}
        ORDER BY w.timestamp DESC
        LIMIT 100
      `, params);
      
      if (webhooks.length === 0) {
        return res.json({
          success: true,
          message: 'No webhooks found that require KPI calculation',
          processed: 0
        });
      }
      
      const AdvancedKPIService = (await import('./services/advancedKPIService.js')).default;
      const kpiService = new AdvancedKPIService(db);
      
      let processed = 0;
      let failed = 0;
      
      // Process webhooks in batches to avoid overwhelming the system
      for (const webhook of webhooks) {
        try {
          await kpiService.calculateAdvancedKPIs(webhook.id);
          processed++;
          console.log(`✅ Processed KPIs for webhook ${webhook.id} (${processed}/${webhooks.length})`);
        } catch (error) {
          failed++;
          console.error(`❌ Failed to process KPIs for webhook ${webhook.id}:`, error.message);
        }
        
        // Small delay to prevent overwhelming the LLM API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      res.json({
        success: true,
        message: `Bulk KPI calculation completed`,
        processed: processed,
        failed: failed,
        total_found: webhooks.length
      });
    } catch (error) {
      console.error('Error in bulk KPI calculation:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// ==================== LLM CONFIGURATION ROUTES ====================

// Get company LLM settings (without exposing the actual API key)
app.get('/api/company/llm-settings',
  authenticateToken(authService),
  requireRole('admin', 'manager'),
  async (req, res) => {
    try {
      const companyId = req.user.companyId;
      
      const [company] = await db.query(
        `SELECT 
          llm_api_url,
          llm_model,
          CASE WHEN llm_api_key_encrypted IS NOT NULL THEN 1 ELSE 0 END as has_api_key,
          CASE WHEN llm_api_key_encrypted IS NOT NULL 
               THEN CONCAT('****', SUBSTRING(llm_api_key_encrypted, -4))
               ELSE NULL 
          END as api_key_masked
        FROM companies WHERE id = ?`,
        [companyId]
      );
      
      res.json({
        success: true,
        data: {
          api_url: company.llm_api_url || process.env.DEFAULT_LLM_API_URL || 'http://api.sippulse.ai',
          model: company.llm_model || process.env.DEFAULT_LLM_MODEL || 'gpt-3.5-turbo',
          has_api_key: company.has_api_key === 1,
          api_key_masked: company.api_key_masked
        }
      });
    } catch (error) {
      console.error('Error getting LLM settings:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Update company LLM settings
app.put('/api/company/llm-settings',
  authenticateToken(authService),
  requireRole('admin'),
  async (req, res) => {
    try {
      const companyId = req.user.companyId;
      const { api_key, api_url, model } = req.body;
      
      const updates = [];
      const params = [];
      
      // Only update API key if provided
      if (api_key) {
        const encryptionService = (await import('./services/encryptionService.js')).default;
        const { encrypted, iv } = encryptionService.encryptApiKey(api_key, companyId);
        updates.push('llm_api_key_encrypted = ?', 'encryption_iv = ?');
        params.push(encrypted, iv);
      }
      
      if (api_url !== undefined) {
        updates.push('llm_api_url = ?');
        params.push(api_url);
      }
      
      if (model !== undefined) {
        updates.push('llm_model = ?');
        params.push(model);
      }
      
      if (updates.length > 0) {
        params.push(companyId);
        await db.query(
          `UPDATE companies SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      }
      
      res.json({
        success: true,
        message: 'LLM settings updated successfully'
      });
    } catch (error) {
      console.error('Error updating LLM settings:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Test LLM connection
app.post('/api/company/test-llm',
  authenticateToken(authService),
  requireRole('admin', 'manager'),
  async (req, res) => {
    try {
      const companyId = req.user.companyId;
      const ScriptAdherenceService = (await import('./services/scriptAdherenceService.js')).default;
      const scriptService = new ScriptAdherenceService(db);
      
      const result = await scriptService.testLLMConnection(companyId);
      
      res.json(result);
    } catch (error) {
      console.error('Error testing LLM connection:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ==================== DASHBOARD CONFIGURATION ROUTES ====================

// Get all dashboard types for company
app.get('/api/dashboards/types',
  authenticateToken(authService),
  validateCompanyAccess(companyService),
  async (req, res) => {
    try {
      const [dashboardTypes] = await db.pool.execute(`
        SELECT 
          dt.*,
          COUNT(dk.id) as kpi_count,
          COUNT(lp.id) as llm_profile_count
        FROM dashboard_types dt
        LEFT JOIN dashboard_kpis dk ON dt.id = dk.dashboard_type_id
        LEFT JOIN llm_profiles lp ON dt.id = lp.dashboard_type_id AND lp.is_active = true
        WHERE dt.company_id = ? 
        GROUP BY dt.id
        ORDER BY dt.is_default DESC, dt.display_name ASC
      `, [req.user.companyId]);
      
      res.json({
        success: true,
        dashboard_types: dashboardTypes
      });
    } catch (error) {
      console.error('❌ Error fetching dashboard types:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard types'
      });
    }
  }
);

// Get specific dashboard type with full configuration
app.get('/api/dashboards/types/:id',
  authenticateToken(authService),
  validateCompanyAccess(companyService),
  async (req, res) => {
    try {
      const [dashboardTypes] = await db.pool.execute(`
        SELECT * FROM dashboard_types 
        WHERE id = ? AND company_id = ?
      `, [req.params.id, req.user.companyId]);
      
      if (dashboardTypes.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Dashboard type not found'
        });
      }
      
      const dashboardType = dashboardTypes[0];
      
      // Get KPIs
      const [kpis] = await db.pool.execute(`
        SELECT * FROM dashboard_kpis 
        WHERE dashboard_type_id = ? 
        ORDER BY display_order ASC
      `, [dashboardType.id]);
      
      // Get active LLM profile
      const [llmProfiles] = await db.pool.execute(`
        SELECT * FROM llm_profiles 
        WHERE dashboard_type_id = ? AND is_active = true 
        ORDER BY version DESC 
        LIMIT 1
      `, [dashboardType.id]);
      
      res.json({
        success: true,
        dashboard_type: {
          ...dashboardType,
          kpis: kpis,
          llm_profile: llmProfiles[0] || null
        }
      });
    } catch (error) {
      console.error('❌ Error fetching dashboard type:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard type'
      });
    }
  }
);

// Create new dashboard type
app.post('/api/dashboards/types',
  authenticateToken(authService),
  validateCompanyAccess(companyService),
  async (req, res) => {
    const connection = await db.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const {
        internal_name,
        display_name,
        description,
        campaign_type,
        theme_color,
        icon_name,
        recording_url_prefix,
        is_default,
        kpis,
        llm_profile
      } = req.body;
      
      // Validate required fields
      if (!internal_name || !display_name || !kpis || kpis.length !== 8) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields or invalid KPI count (must be exactly 8)'
        });
      }
      
      // Validate KPI weights sum to 100
      const totalWeight = kpis.reduce((sum, kpi) => sum + (kpi.weight || 0), 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        return res.status(400).json({
          success: false,
          error: `KPI weights must sum to 100, currently: ${totalWeight}`
        });
      }
      
      const dashboardTypeId = uuidv4();
      
      // If this is set as default, unset other defaults
      if (is_default) {
        await connection.execute(`
          UPDATE dashboard_types 
          SET is_default = false 
          WHERE company_id = ?
        `, [req.user.companyId]);
      }
      
      // Create dashboard type
      await connection.execute(`
        INSERT INTO dashboard_types (
          id, company_id, internal_name, display_name, description, 
          campaign_type, theme_color, icon_name, recording_url_prefix,
          is_default, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dashboardTypeId,
        req.user.companyId,
        internal_name,
        display_name,
        description,
        campaign_type,
        theme_color || '#8B5CF6',
        icon_name || 'layout-dashboard',
        recording_url_prefix,
        is_default || false,
        req.user.userId
      ]);
      
      // Create KPIs
      for (let i = 0; i < kpis.length; i++) {
        const kpi = kpis[i];
        await connection.execute(`
          INSERT INTO dashboard_kpis (
            id, dashboard_type_id, kpi_key, display_name, description,
            icon_name, display_order, weight, min_value, max_value,
            calculation_hint, threshold_poor, threshold_fair, threshold_good
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          uuidv4(),
          dashboardTypeId,
          kpi.kpi_key,
          kpi.display_name,
          kpi.description || '',
          kpi.icon_name || 'activity',
          i + 1,
          kpi.weight,
          kpi.min_value || 0,
          kpi.max_value || 10,
          kpi.calculation_hint || '',
          kpi.threshold_poor || 4,
          kpi.threshold_fair || 6,
          kpi.threshold_good || 8
        ]);
      }
      
      // Create LLM profile if provided
      if (llm_profile) {
        await connection.execute(`
          INSERT INTO llm_profiles (
            id, dashboard_type_id, profile_name, model_name, 
            temperature, max_tokens, system_prompt, 
            user_prompt_template, output_format
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          uuidv4(),
          dashboardTypeId,
          llm_profile.profile_name || `${display_name} Analyzer`,
          llm_profile.model_name || 'gpt-4',
          llm_profile.temperature || 0.7,
          llm_profile.max_tokens || 500,
          llm_profile.system_prompt,
          llm_profile.user_prompt_template,
          JSON.stringify(llm_profile.output_format)
        ]);
      }
      
      await connection.commit();
      
      res.json({
        success: true,
        dashboard_type_id: dashboardTypeId,
        message: 'Dashboard type created successfully'
      });
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error creating dashboard type:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(400).json({
          success: false,
          error: 'Dashboard type with this internal name already exists'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create dashboard type'
        });
      }
    } finally {
      connection.release();
    }
  }
);

// Update dashboard type
app.put('/api/dashboards/types/:id',
  authenticateToken(authService),
  validateCompanyAccess(companyService),
  async (req, res) => {
    const connection = await db.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const {
        internal_name,
        display_name,
        description,
        campaign_type,
        theme_color,
        icon_name,
        recording_url_prefix,
        is_default,
        kpis,
        llm_profile
      } = req.body;
      
      // Verify dashboard belongs to company
      const [existing] = await connection.execute(`
        SELECT * FROM dashboard_types 
        WHERE id = ? AND company_id = ?
      `, [req.params.id, req.user.companyId]);
      
      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Dashboard type not found'
        });
      }
      
      // Validate required fields
      if (!internal_name || !display_name || !kpis || kpis.length !== 8) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields or invalid KPI count (must be exactly 8)'
        });
      }
      
      // Validate KPI weights sum to 100
      const totalWeight = kpis.reduce((sum, kpi) => sum + (kpi.weight || 0), 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        return res.status(400).json({
          success: false,
          error: `KPI weights must sum to 100, currently: ${totalWeight}`
        });
      }
      
      // If this is set as default, unset other defaults
      if (is_default) {
        await connection.execute(`
          UPDATE dashboard_types 
          SET is_default = false 
          WHERE company_id = ? AND id != ?
        `, [req.user.companyId, req.params.id]);
      }
      
      // Update dashboard type
      await connection.execute(`
        UPDATE dashboard_types SET
          internal_name = ?, display_name = ?, description = ?,
          campaign_type = ?, theme_color = ?, icon_name = ?,
          recording_url_prefix = ?, is_default = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `, [
        internal_name,
        display_name,
        description,
        campaign_type,
        theme_color || '#8B5CF6',
        icon_name || 'layout-dashboard',
        recording_url_prefix,
        is_default || false,
        req.params.id,
        req.user.companyId
      ]);
      
      // Delete existing KPIs and recreate them
      await connection.execute(`
        DELETE FROM dashboard_kpis WHERE dashboard_type_id = ?
      `, [req.params.id]);
      
      // Create updated KPIs
      for (let i = 0; i < kpis.length; i++) {
        const kpi = kpis[i];
        await connection.execute(`
          INSERT INTO dashboard_kpis (
            id, dashboard_type_id, kpi_key, display_name, description,
            icon_name, display_order, weight, min_value, max_value,
            calculation_hint, threshold_poor, threshold_fair, threshold_good
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          uuidv4(),
          req.params.id,
          kpi.kpi_key,
          kpi.display_name,
          kpi.description || '',
          kpi.icon_name || 'activity',
          i + 1,
          kpi.weight,
          kpi.min_value || 0,
          kpi.max_value || 10,
          kpi.calculation_hint || '',
          kpi.threshold_poor || 4,
          kpi.threshold_fair || 6,
          kpi.threshold_good || 8
        ]);
      }
      
      // Update LLM profile if provided
      if (llm_profile) {
        // Deactivate existing profiles
        await connection.execute(`
          UPDATE llm_profiles 
          SET is_active = false 
          WHERE dashboard_type_id = ?
        `, [req.params.id]);
        
        // Create new profile
        await connection.execute(`
          INSERT INTO llm_profiles (
            id, dashboard_type_id, profile_name, model_name, 
            temperature, max_tokens, system_prompt, 
            user_prompt_template, output_format
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          uuidv4(),
          req.params.id,
          llm_profile.profile_name || `${display_name} Analyzer`,
          llm_profile.model_name || 'gpt-4',
          llm_profile.temperature || 0.7,
          llm_profile.max_tokens || 500,
          llm_profile.system_prompt,
          llm_profile.user_prompt_template,
          JSON.stringify(llm_profile.output_format)
        ]);
      }
      
      await connection.commit();
      
      res.json({
        success: true,
        message: 'Dashboard type updated successfully'
      });
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error updating dashboard type:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(400).json({
          success: false,
          error: 'Dashboard type with this internal name already exists'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update dashboard type'
        });
      }
    } finally {
      connection.release();
    }
  }
);

// Delete dashboard type
app.delete('/api/dashboards/types/:id',
  authenticateToken(authService),
  validateCompanyAccess(companyService),
  async (req, res) => {
    const connection = await db.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Verify dashboard belongs to company
      const [existing] = await connection.execute(`
        SELECT * FROM dashboard_types 
        WHERE id = ? AND company_id = ?
      `, [req.params.id, req.user.companyId]);
      
      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Dashboard type not found'
        });
      }
      
      // Check if this dashboard has associated KPI scores
      const [kpiScores] = await connection.execute(`
        SELECT COUNT(*) as score_count 
        FROM webhook_kpi_scores 
        WHERE dashboard_type_id = ?
      `, [req.params.id]);
      
      const hasKpiScores = kpiScores[0].score_count > 0;
      
      if (hasKpiScores) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete dashboard type with existing KPI scores. Archive it instead.'
        });
      }
      
      // Delete in correct order due to foreign key constraints
      // 1. Delete LLM profiles
      await connection.execute(`
        DELETE FROM llm_profiles 
        WHERE dashboard_type_id = ?
      `, [req.params.id]);
      
      // 2. Delete KPIs
      await connection.execute(`
        DELETE FROM dashboard_kpis 
        WHERE dashboard_type_id = ?
      `, [req.params.id]);
      
      // 3. Delete dashboard filters
      await connection.execute(`
        DELETE FROM dashboard_filters 
        WHERE dashboard_type_id = ?
      `, [req.params.id]);
      
      // 4. Delete dashboard type
      await connection.execute(`
        DELETE FROM dashboard_types 
        WHERE id = ? AND company_id = ?
      `, [req.params.id, req.user.companyId]);
      
      await connection.commit();
      
      res.json({
        success: true,
        message: 'Dashboard type deleted successfully'
      });
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error deleting dashboard type:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete dashboard type'
      });
    } finally {
      connection.release();
    }
  }
);

// Get processed KPI data for a dashboard type
app.get('/api/dashboards/types/:id/data',
  authenticateToken(authService),
  validateCompanyAccess(companyService),
  async (req, res) => {
    try {
      const { limit = 1000, agent, period, min_score, max_score } = req.query;
      
      // Verify dashboard belongs to company
      const [dashboards] = await db.pool.execute(`
        SELECT * FROM dashboard_types 
        WHERE id = ? AND company_id = ?
      `, [req.params.id, req.user.companyId]);
      
      if (dashboards.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Dashboard type not found'
        });
      }
      
      const dashboard = dashboards[0];
      
      // Build WHERE clause for filtering
      let whereClause = 'w.company_id = ? AND wks.dashboard_type_id = ?';
      let params = [req.user.companyId, req.params.id];
      
      // Campaign type filter
      if (dashboard.campaign_type) {
        whereClause += ' AND w.campaign_type = ?';
        params.push(dashboard.campaign_type);
      }
      
      // Agent filter
      if (agent && agent !== 'all') {
        whereClause += ' AND w.agent_name = ?';
        params.push(agent);
      }
      
      // Overall score filter
      if (min_score) {
        whereClause += ' AND wks.overall_score >= ?';
        params.push(parseFloat(min_score));
      }
      
      if (max_score) {
        whereClause += ' AND wks.overall_score <= ?';
        params.push(parseFloat(max_score));
      }
      
      // Period filter
      if (period && period !== 'all') {
        const now = new Date();
        if (period === 'today') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          whereClause += ' AND w.timestamp >= ?';
          params.push(startOfToday.toISOString());
        } else if (period === 'yesterday') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const startOfYesterday = new Date(startOfToday);
          startOfYesterday.setDate(startOfYesterday.getDate() - 1);
          whereClause += ' AND w.timestamp >= ? AND w.timestamp < ?';
          params.push(startOfYesterday.toISOString(), startOfToday.toISOString());
        } else if (period === 'week') {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          whereClause += ' AND w.timestamp >= ?';
          params.push(weekAgo.toISOString());
        }
      }
      
      params.push(parseInt(limit));
      
      // Get webhook data with KPI scores
      const [webhookData] = await db.pool.execute(`
        SELECT 
          w.id,
          w.timestamp,
          w.agent_name,
          w.customer_name,
          w.duration,
          w.satisfaction_score,
          w.sentiment,
          w.resolved,
          w.topics,
          w.transcription,
          wks.kpi_scores,
          wks.overall_score,
          wks.processing_time_ms
        FROM webhooks w
        INNER JOIN webhook_kpi_scores wks ON w.id = wks.webhook_id
        WHERE ${whereClause}
        ORDER BY w.timestamp DESC
        LIMIT ?
      `, params);
      
      // Parse JSON kpi_scores
      const processedData = webhookData.map(row => ({
        ...row,
        kpi_scores: typeof row.kpi_scores === 'string' ? JSON.parse(row.kpi_scores) : row.kpi_scores,
        topics: typeof row.topics === 'string' ? JSON.parse(row.topics) : row.topics
      }));
      
      res.json({
        success: true,
        dashboard_type: dashboard,
        webhook_data: processedData,
        total_count: processedData.length
      });
      
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard data'
      });
    }
  }
);

// ==================== CAMPAIGN SCRIPT MANAGEMENT ROUTES ====================

// Get campaign script
app.get('/api/campaigns/:campaignId/script',
  authenticateToken(authService),
  async (req, res) => {
    try {
      const { campaignId } = req.params;
      const companyId = req.user.companyId;
      
      const [campaign] = await db.query(
        `SELECT 
          call_script,
          script_required_elements,
          script_adherence_enabled,
          campaign_type
        FROM campaigns 
        WHERE id = ? AND company_id = ?`,
        [campaignId, companyId]
      );
      
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          call_script: campaign.call_script,
          script_required_elements: campaign.script_required_elements,
          script_adherence_enabled: campaign.script_adherence_enabled === 1,
          campaign_type: campaign.campaign_type
        }
      });
    } catch (error) {
      console.error('Error getting campaign script:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Update campaign script
app.put('/api/campaigns/:campaignId/script',
  authenticateToken(authService),
  requireRole('admin', 'manager'),
  async (req, res) => {
    try {
      const { campaignId } = req.params;
      const companyId = req.user.companyId;
      const { call_script, script_required_elements, script_adherence_enabled } = req.body;
      
      // Verify campaign belongs to company
      const [campaign] = await db.query(
        'SELECT id FROM campaigns WHERE id = ? AND company_id = ?',
        [campaignId, companyId]
      );
      
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found'
        });
      }
      
      const updates = [];
      const params = [];
      
      if (call_script !== undefined) {
        updates.push('call_script = ?');
        params.push(call_script);
      }
      
      if (script_required_elements !== undefined) {
        updates.push('script_required_elements = ?');
        params.push(JSON.stringify(script_required_elements));
      }
      
      if (script_adherence_enabled !== undefined) {
        updates.push('script_adherence_enabled = ?');
        params.push(script_adherence_enabled ? 1 : 0);
      }
      
      if (updates.length > 0) {
        params.push(campaignId, companyId);
        await db.query(
          `UPDATE campaigns SET ${updates.join(', ')} WHERE id = ? AND company_id = ?`,
          params
        );
      }
      
      res.json({
        success: true,
        message: 'Campaign script updated successfully'
      });
    } catch (error) {
      console.error('Error updating campaign script:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Calculate script adherence for a specific webhook
app.post('/api/webhooks/:webhookId/calculate-adherence',
  authenticateToken(authService),
  requireRole('admin', 'manager'),
  async (req, res) => {
    try {
      const { webhookId } = req.params;
      const companyId = req.user.companyId;
      
      // Verify webhook belongs to company
      const [webhook] = await db.query(
        'SELECT id FROM webhooks WHERE id = ? AND company_id = ?',
        [webhookId, companyId]
      );
      
      if (!webhook) {
        return res.status(404).json({
          success: false,
          error: 'Webhook not found'
        });
      }
      
      const ScriptAdherenceService = (await import('./services/scriptAdherenceService.js')).default;
      const scriptService = new ScriptAdherenceService(db);
      
      const result = await scriptService.calculateScriptAdherence(webhookId);
      
      if (!result) {
        return res.json({
          success: false,
          message: 'Script adherence calculation not available for this webhook'
        });
      }
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error calculating script adherence:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// Get campaign adherence report
app.get('/api/campaigns/:campaignId/adherence-report',
  authenticateToken(authService),
  async (req, res) => {
    try {
      const { campaignId } = req.params;
      const companyId = req.user.companyId;
      
      // Verify campaign belongs to company
      const [campaign] = await db.query(
        'SELECT id, name FROM campaigns WHERE id = ? AND company_id = ?',
        [campaignId, companyId]
      );
      
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found'
        });
      }
      
      // Get adherence statistics
      const [stats] = await db.query(
        `SELECT 
          COUNT(*) as total_calls,
          COUNT(script_adherence_score) as analyzed_calls,
          AVG(script_adherence_score) as average_adherence,
          MIN(script_adherence_score) as min_adherence,
          MAX(script_adherence_score) as max_adherence
        FROM webhooks
        WHERE campaign_id = ? AND company_id = ?`,
        [campaignId, companyId]
      );
      
      // Get adherence by agent
      const agentStats = await db.query(
        `SELECT 
          w.agent_id,
          a.name as agent_name,
          COUNT(*) as total_calls,
          AVG(w.script_adherence_score) as average_adherence
        FROM webhooks w
        LEFT JOIN agents a ON w.agent_id = a.id
        WHERE w.campaign_id = ? AND w.company_id = ? AND w.script_adherence_score IS NOT NULL
        GROUP BY w.agent_id, a.name
        ORDER BY average_adherence DESC`,
        [campaignId, companyId]
      );
      
      res.json({
        success: true,
        data: {
          campaign_name: campaign.name,
          statistics: stats,
          agent_performance: agentStats
        }
      });
    } catch (error) {
      console.error('Error getting adherence report:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

// ==================== SYSTEM ROUTES ====================

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await db.healthCheck();
    
    res.json({
      status: dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth,
      active_connections: clients.length,
      version: '2.0.0-mysql'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// ==================== KPI PROCESSING ROUTES ====================

// Process unprocessed webhooks
app.post('/api/kpi/process', 
  authenticateToken(authService),
  validateCompanyAccess(companyService),
  async (req, res) => {
    try {
      console.log('🚀 Manual KPI processing triggered by user');
      await webhookKpiProcessor.processUnprocessedWebhooks();
      const stats = await webhookKpiProcessor.getProcessingStats();
      
      res.json({
        success: true,
        message: 'KPI processing completed successfully',
        stats
      });
    } catch (error) {
      console.error('❌ KPI processing error:', error);
      res.status(500).json({
        error: 'Failed to process KPIs',
        details: error.message
      });
    }
  }
);

// Process specific webhook by ID
app.post('/api/kpi/process/:webhookId', 
  authenticateToken(authService),
  validateCompanyAccess(companyService),
  async (req, res) => {
    try {
      const { webhookId } = req.params;
      console.log(`🎯 Processing specific webhook: ${webhookId}`);
      
      await webhookKpiProcessor.processWebhookById(webhookId);
      
      res.json({
        success: true,
        message: `Webhook ${webhookId} processed successfully`
      });
    } catch (error) {
      console.error(`❌ Error processing webhook ${req.params.webhookId}:`, error);
      res.status(500).json({
        error: 'Failed to process webhook',
        details: error.message
      });
    }
  }
);

// Get KPI processing statistics
app.get('/api/kpi/stats', 
  authenticateToken(authService),
  validateCompanyAccess(companyService),
  async (req, res) => {
    try {
      const stats = await webhookKpiProcessor.getProcessingStats();
      
      res.json({
        success: true,
        stats: {
          ...stats,
          processing_coverage: stats.total_webhooks > 0 
            ? ((stats.processed_webhooks / stats.total_webhooks) * 100).toFixed(1) + '%'
            : '0%',
          avg_processing_time_seconds: stats.avg_processing_time 
            ? (stats.avg_processing_time / 1000).toFixed(2) + 's'
            : 'N/A'
        }
      });
    } catch (error) {
      console.error('❌ Error getting KPI processing stats:', error);
      res.status(500).json({
        error: 'Failed to get processing statistics',
        details: error.message
      });
    }
  }
);

// Auto-process KPIs when new webhooks arrive (add to webhook processing)
const originalProcessWebhook = async (webhookData) => {
  try {
    // Process webhook normally first
    // ... existing webhook processing logic ...
    
    // Then trigger KPI processing asynchronously
    setTimeout(async () => {
      try {
        console.log(`🧠 Auto-processing KPIs for webhook ${webhookData.id}`);
        await webhookKpiProcessor.processWebhookById(webhookData.id);
      } catch (error) {
        console.error(`❌ Auto KPI processing failed for webhook ${webhookData.id}:`, error);
      }
    }, 1000); // Small delay to ensure webhook is fully stored
    
  } catch (error) {
    console.error('Error in webhook processing with auto KPI:', error);
    throw error;
  }
};

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

app.listen(PORT, () => {
  console.log(`🚀 TalkIntel Multi-Company Server running on port ${PORT}`);
  console.log(`🏢 Company registration: http://localhost:${PORT}/auth/register`);
  console.log(`🔐 Login endpoint: http://localhost:${PORT}/auth/login`);
  console.log(`📡 Webhook pattern: http://localhost:${PORT}/webhook/{company-uuid}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`💾 Database: MySQL (${process.env.DB_NAME})`);
  console.log(`🔄 Real-time events: http://localhost:${PORT}/events (authenticated)`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully');
  await db.close();
  process.exit(0);
});