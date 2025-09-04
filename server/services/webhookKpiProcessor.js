/**
 * Webhook KPI Processing Pipeline
 * Processes incoming webhooks and generates KPI scores using LLM analysis
 */

class WebhookKpiProcessor {
  constructor(databasePool) {
    this.db = databasePool;
    this.processing = false;
  }

  /**
   * Process all unprocessed webhooks
   */
  async processUnprocessedWebhooks() {
    if (this.processing) {
      console.log('🔄 KPI processing already in progress, skipping...');
      return;
    }

    this.processing = true;
    console.log('🚀 Starting webhook KPI processing pipeline...');

    try {
      // Find unprocessed webhooks
      const unprocessedWebhooks = await this.getUnprocessedWebhooks();
      console.log(`📊 Found ${unprocessedWebhooks.length} unprocessed webhooks`);

      for (const webhook of unprocessedWebhooks) {
        await this.processWebhook(webhook);
      }

      console.log('✅ Webhook KPI processing completed successfully');
    } catch (error) {
      console.error('❌ Error in webhook KPI processing:', error);
      throw error;
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get webhooks that haven't been processed for KPI scores yet
   */
  async getUnprocessedWebhooks() {
    const sql = `
      SELECT DISTINCT w.* 
      FROM webhooks w
      WHERE NOT EXISTS (
        SELECT 1 FROM webhook_kpi_scores wks 
        WHERE wks.webhook_id = w.id
      )
      AND w.transcription IS NOT NULL 
      AND w.transcription != ''
      ORDER BY w.timestamp DESC
      LIMIT 50
    `;

    const [rows] = await this.db.execute(sql);
    return rows;
  }

  /**
   * Process a single webhook through all applicable dashboard types
   */
  async processWebhook(webhook) {
    console.log(`🔍 Processing webhook ${webhook.id} for company ${webhook.company_id}`);

    try {
      // Get applicable dashboard types for this webhook's company
      const dashboardTypes = await this.getDashboardTypesForWebhook(webhook);
      
      console.log(`📊 Found ${dashboardTypes.length} applicable dashboard types for webhook ${webhook.id}`);

      for (const dashboardType of dashboardTypes) {
        await this.processWebhookForDashboardType(webhook, dashboardType);
      }
    } catch (error) {
      console.error(`❌ Error processing webhook ${webhook.id}:`, error);
      // Continue processing other webhooks even if one fails
    }
  }

  /**
   * Get dashboard types that should process this webhook
   */
  async getDashboardTypesForWebhook(webhook) {
    const sql = `
      SELECT dt.*, 
             GROUP_CONCAT(
               JSON_OBJECT(
                 'id', dk.id,
                 'kpi_key', dk.kpi_key,
                 'display_name', dk.display_name,
                 'weight', dk.weight,
                 'min_value', dk.min_value,
                 'max_value', dk.max_value,
                 'calculation_hint', dk.calculation_hint
               )
             ) as kpis_json,
             lp.id as llm_profile_id,
             lp.profile_name,
             lp.model_name,
             lp.temperature,
             lp.max_tokens,
             lp.system_prompt,
             lp.user_prompt_template,
             lp.output_format
      FROM dashboard_types dt
      LEFT JOIN dashboard_kpis dk ON dt.id = dk.dashboard_type_id
      LEFT JOIN llm_profiles lp ON dt.id = lp.dashboard_type_id AND lp.is_active = 1
      WHERE dt.company_id = ? 
        AND dt.is_active = 1
        AND (dt.campaign_type IS NULL OR dt.campaign_type = ? OR dt.campaign_type = '')
      GROUP BY dt.id, lp.id
      HAVING COUNT(dk.id) > 0 AND lp.id IS NOT NULL
    `;

    const [rows] = await this.db.execute(sql, [
      webhook.company_id,
      webhook.call_type || 'customer_service'
    ]);

    // Parse the KPIs JSON for each dashboard type
    return rows.map(row => ({
      ...row,
      kpis: JSON.parse(`[${row.kpis_json}]`).filter(kpi => kpi.id) // Remove null entries
    }));
  }

  /**
   * Process webhook for a specific dashboard type using its LLM profile
   */
  async processWebhookForDashboardType(webhook, dashboardType) {
    console.log(`🧠 Processing webhook ${webhook.id} for dashboard type "${dashboardType.display_name}"`);

    try {
      // Check if already processed
      const existingScore = await this.getExistingKpiScore(webhook.id, dashboardType.id);
      if (existingScore) {
        console.log(`⏭️  Webhook ${webhook.id} already processed for dashboard ${dashboardType.display_name}`);
        return;
      }

      const startTime = Date.now();

      // Generate KPI scores using mock LLM (replace with real LLM call)
      const kpiScores = await this.generateKpiScores(webhook, dashboardType);
      
      // Calculate overall weighted score
      const overallScore = this.calculateOverallScore(kpiScores, dashboardType.kpis);

      const processingTime = Date.now() - startTime;

      // Store the results
      await this.storeKpiScores({
        webhook_id: webhook.id,
        dashboard_type_id: dashboardType.id,
        kpi_scores: kpiScores,
        overall_score: overallScore,
        llm_profile_id: dashboardType.llm_profile_id,
        processing_time_ms: processingTime
      });

      console.log(`✅ Generated KPI scores for webhook ${webhook.id} (${dashboardType.display_name}): ${overallScore.toFixed(1)}/10`);
    } catch (error) {
      console.error(`❌ Error processing webhook ${webhook.id} for dashboard ${dashboardType.display_name}:`, error);
      
      // Store error information
      await this.storeKpiScores({
        webhook_id: webhook.id,
        dashboard_type_id: dashboardType.id,
        kpi_scores: {},
        overall_score: 0,
        llm_profile_id: dashboardType.llm_profile_id,
        processing_time_ms: 0,
        error_message: error.message
      });
    }
  }

  /**
   * Check if KPI score already exists
   */
  async getExistingKpiScore(webhookId, dashboardTypeId) {
    const sql = `
      SELECT id FROM webhook_kpi_scores 
      WHERE webhook_id = ? AND dashboard_type_id = ?
    `;
    const [rows] = await this.db.execute(sql, [webhookId, dashboardTypeId]);
    return rows[0];
  }

  /**
   * Generate KPI scores using LLM analysis (mock implementation)
   * TODO: Replace with actual OpenAI/Claude API calls
   */
  async generateKpiScores(webhook, dashboardType) {
    console.log(`🤖 Generating KPI scores using ${dashboardType.model_name || 'mock-llm'}...`);

    // For now, generate realistic mock scores
    // TODO: Replace this with actual LLM API calls using the dashboardType.system_prompt 
    // and dashboardType.user_prompt_template with webhook data substitution

    const kpiScores = {};
    
    for (const kpi of dashboardType.kpis) {
      // Generate realistic scores based on KPI type and webhook data
      let score;
      
      if (kpi.kpi_key.includes('sentiment')) {
        // Base score on existing sentiment if available
        score = webhook.sentiment_score 
          ? Math.max(0, Math.min(10, webhook.sentiment_score * 2)) // Convert -1 to 1 scale to 0-10
          : this.generateRandomScore(kpi.min_value, kpi.max_value, 7); // Slightly positive bias
      } else if (kpi.kpi_key.includes('resolution')) {
        // Base on resolved status if available
        score = webhook.resolved === 1 
          ? this.generateRandomScore(7, 10, 8.5)
          : this.generateRandomScore(2, 6, 4);
      } else if (kpi.kpi_key.includes('effort')) {
        // Base on call duration (shorter = less effort = higher score)
        const duration = webhook.duration || 300; // Default 5 minutes
        const effortScore = Math.max(1, Math.min(10, 10 - (duration / 60))); // Longer calls = more effort = lower score
        score = this.addRandomVariation(effortScore, 1.5);
      } else {
        // Generate random score with slight positive bias for other KPIs
        score = this.generateRandomScore(kpi.min_value, kpi.max_value, 6.5);
      }

      kpiScores[kpi.kpi_key] = Math.round(score * 10) / 10; // Round to 1 decimal
    }

    // Add small delay to simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log(`📊 Generated scores:`, Object.keys(kpiScores).map(key => `${key}: ${kpiScores[key]}`).join(', '));
    
    return kpiScores;
  }

  /**
   * Generate a realistic random score with bias toward a target
   */
  generateRandomScore(min, max, target = null) {
    if (!target) target = (min + max) / 2;
    
    // Generate score with bias toward target
    const random1 = Math.random();
    const random2 = Math.random();
    const biased = (random1 + random2) / 2; // Slightly more centered distribution
    
    const range = max - min;
    const score = min + (biased * range);
    
    // Bias toward target
    const biasStrength = 0.3;
    const biasedScore = score + (target - score) * biasStrength;
    
    return Math.max(min, Math.min(max, biasedScore));
  }

  /**
   * Add random variation to a score
   */
  addRandomVariation(baseScore, variation) {
    const randomFactor = (Math.random() - 0.5) * 2; // -1 to 1
    return Math.max(0, Math.min(10, baseScore + (randomFactor * variation)));
  }

  /**
   * Calculate overall weighted score from individual KPI scores
   */
  calculateOverallScore(kpiScores, kpis) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const kpi of kpis) {
      const score = kpiScores[kpi.kpi_key];
      if (score !== undefined && score !== null) {
        weightedSum += score * (kpi.weight / 100);
        totalWeight += (kpi.weight / 100);
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Store KPI scores in database
   */
  async storeKpiScores(scoreData) {
    const sql = `
      INSERT INTO webhook_kpi_scores (
        webhook_id, dashboard_type_id, kpi_scores, overall_score,
        llm_profile_id, processing_time_ms, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        kpi_scores = VALUES(kpi_scores),
        overall_score = VALUES(overall_score),
        llm_profile_id = VALUES(llm_profile_id),
        processing_time_ms = VALUES(processing_time_ms),
        error_message = VALUES(error_message),
        created_at = CURRENT_TIMESTAMP
    `;

    await this.db.execute(sql, [
      scoreData.webhook_id,
      scoreData.dashboard_type_id,
      JSON.stringify(scoreData.kpi_scores),
      scoreData.overall_score,
      scoreData.llm_profile_id,
      scoreData.processing_time_ms,
      scoreData.error_message || null
    ]);
  }

  /**
   * Process a specific webhook by ID (useful for testing)
   */
  async processWebhookById(webhookId) {
    const sql = `SELECT * FROM webhooks WHERE id = ?`;
    const [rows] = await this.db.execute(sql, [webhookId]);
    
    if (rows.length === 0) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    await this.processWebhook(rows[0]);
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats() {
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT w.id) as total_webhooks,
        COUNT(DISTINCT wks.webhook_id) as processed_webhooks,
        COUNT(DISTINCT w.id) - COUNT(DISTINCT wks.webhook_id) as unprocessed_webhooks,
        AVG(wks.processing_time_ms) as avg_processing_time,
        AVG(wks.overall_score) as avg_overall_score,
        COUNT(CASE WHEN wks.error_message IS NOT NULL THEN 1 END) as error_count
      FROM webhooks w
      LEFT JOIN webhook_kpi_scores wks ON w.id = wks.webhook_id
      WHERE w.transcription IS NOT NULL AND w.transcription != ''
    `;

    const [rows] = await this.db.execute(statsQuery);
    return rows[0];
  }
}

export default WebhookKpiProcessor;