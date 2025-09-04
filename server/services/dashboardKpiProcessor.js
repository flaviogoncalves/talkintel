/**
 * Dashboard KPI Processor
 * Processes webhooks using configurable dashboard types and LLM profiles
 * This service runs after webhook processing to generate KPI scores
 */

import fetch from 'node-fetch';

class DashboardKpiProcessor {
  constructor(db) {
    this.db = db;
  }

  /**
   * Process a webhook using all applicable dashboard types
   * @param {string} webhookId - The webhook ID
   * @param {string} companyId - The company ID
   */
  async processWebhookKpis(webhookId, companyId) {
    console.log(`🔄 Processing KPIs for webhook ${webhookId}`);
    
    try {
      // Get webhook data
      const [webhooks] = await this.db.pool.execute(`
        SELECT * FROM webhooks 
        WHERE id = ? AND company_id = ?
      `, [webhookId, companyId]);
      
      if (webhooks.length === 0) {
        console.log(`❌ Webhook ${webhookId} not found`);
        return;
      }
      
      const webhook = webhooks[0];
      
      // Get applicable dashboard types for this company
      const [dashboardTypes] = await this.db.pool.execute(`
        SELECT dt.*, lp.id as llm_profile_id, lp.system_prompt, lp.user_prompt_template, 
               lp.output_format, lp.model_name, lp.temperature, lp.max_tokens
        FROM dashboard_types dt
        INNER JOIN llm_profiles lp ON dt.id = lp.dashboard_type_id
        WHERE dt.company_id = ? AND dt.is_active = true AND lp.is_active = true
        AND (dt.campaign_type IS NULL OR dt.campaign_type = ? OR dt.campaign_type = '')
        ORDER BY dt.is_default DESC
      `, [companyId, webhook.campaign_type || '']);
      
      console.log(`📊 Found ${dashboardTypes.length} dashboard types for company ${companyId}`);
      
      // Process each applicable dashboard type
      for (const dashboardType of dashboardTypes) {
        await this.processDashboardTypeKpis(webhook, dashboardType);
      }
      
      console.log(`✅ Completed KPI processing for webhook ${webhookId}`);
      
    } catch (error) {
      console.error(`❌ Error processing webhook KPIs:`, error);
    }
  }

  /**
   * Process KPIs for a specific dashboard type
   * @param {Object} webhook - The webhook data
   * @param {Object} dashboardType - The dashboard type configuration
   */
  async processDashboardTypeKpis(webhook, dashboardType) {
    const startTime = Date.now();
    
    try {
      console.log(`🎯 Processing dashboard type: ${dashboardType.display_name}`);
      
      // Check if already processed
      const [existing] = await this.db.pool.execute(`
        SELECT id FROM webhook_kpi_scores 
        WHERE webhook_id = ? AND dashboard_type_id = ?
      `, [webhook.id, dashboardType.id]);
      
      if (existing.length > 0) {
        console.log(`⏭️ KPIs already processed for ${dashboardType.display_name}`);
        return;
      }
      
      // Get KPI definitions
      const [kpis] = await this.db.pool.execute(`
        SELECT * FROM dashboard_kpis 
        WHERE dashboard_type_id = ? 
        ORDER BY display_order ASC
      `, [dashboardType.id]);
      
      // Generate LLM prompt
      const prompt = this.buildLlmPrompt(webhook, dashboardType, kpis);
      
      // Call LLM to get KPI scores
      const kpiScores = await this.callLlmForKpis(prompt, dashboardType);
      
      if (!kpiScores) {
        console.log(`❌ Failed to get KPI scores from LLM for ${dashboardType.display_name}`);
        return;
      }
      
      // Calculate overall weighted score
      const overallScore = this.calculateOverallScore(kpiScores, kpis);
      
      // Save to database
      await this.db.pool.execute(`
        INSERT INTO webhook_kpi_scores (
          id, webhook_id, dashboard_type_id, kpi_scores, overall_score,
          llm_profile_id, processing_time_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        this.generateUuid(),
        webhook.id,
        dashboardType.id,
        JSON.stringify(kpiScores),
        overallScore,
        dashboardType.llm_profile_id,
        Date.now() - startTime
      ]);
      
      console.log(`✅ Saved KPIs for ${dashboardType.display_name} - Overall Score: ${overallScore}/10`);
      
    } catch (error) {
      console.error(`❌ Error processing dashboard type ${dashboardType.display_name}:`, error);
      
      // Save error record
      await this.db.pool.execute(`
        INSERT INTO webhook_kpi_scores (
          id, webhook_id, dashboard_type_id, kpi_scores, 
          llm_profile_id, processing_time_ms, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        this.generateUuid(),
        webhook.id,
        dashboardType.id,
        JSON.stringify({}),
        dashboardType.llm_profile_id,
        Date.now() - startTime,
        error.message
      ]);
    }
  }

  /**
   * Build the LLM prompt using the template and webhook data
   * @param {Object} webhook - The webhook data
   * @param {Object} dashboardType - The dashboard type
   * @param {Array} kpis - The KPI definitions
   * @returns {Object} The prompt object for LLM
   */
  buildLlmPrompt(webhook, dashboardType, kpis) {
    // Parse the user prompt template and replace placeholders
    let userPrompt = dashboardType.user_prompt_template;
    
    // Replace standard placeholders
    const replacements = {
      '{transcription}': webhook.transcription || webhook.text || 'No transcription available',
      '{agent_name}': webhook.agent_name || 'Unknown Agent',
      '{customer_name}': webhook.customer_name || 'Unknown Customer',
      '{duration}': webhook.duration || 0,
      '{summary}': webhook.summary || webhook.summarization || '',
      '{topics}': this.formatTopics(webhook.topics),
      '{sentiment}': webhook.sentiment || 'neutral',
      '{satisfaction_score}': webhook.satisfaction_score || 'unknown'
    };
    
    // Replace all placeholders
    Object.entries(replacements).forEach(([placeholder, value]) => {
      userPrompt = userPrompt.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return {
      system: dashboardType.system_prompt,
      user: userPrompt,
      temperature: dashboardType.temperature || 0.7,
      max_tokens: dashboardType.max_tokens || 500,
      model: dashboardType.model_name || 'gpt-4'
    };
  }

  /**
   * Format topics array for display in prompt
   * @param {string|Array} topics - Topics data
   * @returns {string} Formatted topics string
   */
  formatTopics(topics) {
    if (!topics) return 'No topics identified';
    
    try {
      const topicsArray = typeof topics === 'string' ? JSON.parse(topics) : topics;
      if (Array.isArray(topicsArray)) {
        return topicsArray.join(', ');
      }
    } catch (error) {
      // If parsing fails, return as string
    }
    
    return String(topics);
  }

  /**
   * Call LLM service to generate KPI scores
   * @param {Object} prompt - The prompt configuration
   * @param {Object} dashboardType - Dashboard type config
   * @returns {Object|null} KPI scores object
   */
  async callLlmForKpis(prompt, dashboardType) {
    try {
      // For now, simulate LLM call since we don't have actual LLM integration
      // In production, this would call your LLM API (OpenAI, Claude, etc.)
      
      console.log(`🤖 Simulating LLM call for ${dashboardType.display_name}...`);
      
      // Get expected output format
      const outputFormat = typeof dashboardType.output_format === 'string' 
        ? JSON.parse(dashboardType.output_format) 
        : dashboardType.output_format;
      
      // Generate realistic KPI scores based on webhook content
      const simulatedScores = this.generateSimulatedKpiScores(prompt, outputFormat);
      
      console.log(`🎯 Generated KPI scores:`, simulatedScores);
      
      return simulatedScores;
      
      // TODO: Replace simulation with actual LLM call
      /*
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: prompt.model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          temperature: prompt.temperature,
          max_tokens: prompt.max_tokens
        })
      });
      
      const result = await response.json();
      const content = result.choices[0].message.content;
      
      // Parse JSON response
      return JSON.parse(content);
      */
      
    } catch (error) {
      console.error('❌ LLM call failed:', error);
      return null;
    }
  }

  /**
   * Generate simulated KPI scores for testing
   * @param {Object} prompt - The prompt object
   * @param {Object} outputFormat - Expected output format
   * @returns {Object} Simulated KPI scores
   */
  generateSimulatedKpiScores(prompt, outputFormat) {
    const scores = {};
    
    // Extract KPI keys from output format
    if (outputFormat && outputFormat.properties) {
      Object.keys(outputFormat.properties).forEach(kpiKey => {
        // Generate scores based on content analysis
        let baseScore = 7; // Default good score
        
        // Analyze transcription for sentiment indicators
        const transcription = prompt.user.toLowerCase();
        
        if (transcription.includes('frustrated') || transcription.includes('angry') || transcription.includes('problem')) {
          baseScore -= 2;
        }
        
        if (transcription.includes('thank') || transcription.includes('helpful') || transcription.includes('resolved')) {
          baseScore += 1;
        }
        
        if (transcription.includes('understand') || transcription.includes('sorry')) {
          if (kpiKey.includes('empathy')) baseScore += 1;
        }
        
        if (transcription.includes('solution') || transcription.includes('fix') || transcription.includes('resolve')) {
          if (kpiKey.includes('resolution')) baseScore += 1;
        }
        
        // Add some randomness for variety
        const randomVariation = (Math.random() - 0.5) * 2; // -1 to +1
        baseScore += randomVariation;
        
        // Ensure score is within bounds
        scores[kpiKey] = Math.max(0, Math.min(10, Math.round(baseScore * 10) / 10));
      });
    }
    
    return scores;
  }

  /**
   * Calculate weighted overall score from individual KPI scores
   * @param {Object} kpiScores - Individual KPI scores
   * @param {Array} kpis - KPI definitions with weights
   * @returns {number} Overall weighted score
   */
  calculateOverallScore(kpiScores, kpis) {
    let weightedSum = 0;
    let totalWeight = 0;
    
    kpis.forEach(kpi => {
      if (kpiScores[kpi.kpi_key] !== undefined) {
        weightedSum += kpiScores[kpi.kpi_key] * kpi.weight;
        totalWeight += kpi.weight;
      }
    });
    
    if (totalWeight === 0) return 0;
    
    const overallScore = weightedSum / totalWeight;
    return Math.round(overallScore * 10) / 10;
  }

  /**
   * Generate UUID for database records
   * @returns {string} UUID
   */
  generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Process all pending webhooks for KPI analysis
   * @param {string} companyId - Company ID to process
   * @param {number} limit - Maximum number of webhooks to process
   */
  async processPendingWebhooks(companyId, limit = 100) {
    console.log(`🔄 Processing pending webhooks for company ${companyId}`);
    
    try {
      // Get webhooks that haven't been processed yet
      const [pendingWebhooks] = await this.db.pool.execute(`
        SELECT w.id, w.company_id
        FROM webhooks w
        LEFT JOIN webhook_kpi_scores wks ON w.id = wks.webhook_id
        WHERE w.company_id = ? AND wks.id IS NULL
        ORDER BY w.timestamp DESC
        LIMIT ?
      `, [companyId, limit]);
      
      console.log(`📋 Found ${pendingWebhooks.length} pending webhooks`);
      
      for (const webhook of pendingWebhooks) {
        await this.processWebhookKpis(webhook.id, webhook.company_id);
      }
      
      console.log(`✅ Completed processing ${pendingWebhooks.length} webhooks`);
      
    } catch (error) {
      console.error('❌ Error processing pending webhooks:', error);
    }
  }
}

export default DashboardKpiProcessor;