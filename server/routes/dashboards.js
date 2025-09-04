import express from 'express';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sippulse_analytics',
  port: process.env.DB_PORT || 3306,
  ssl: false,
  connectionLimit: 10,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

/**
 * Dashboard Types API Routes
 * Provides CRUD operations for configurable dashboard types
 */

// Get all dashboard types for company
router.get('/types', auth, validateCompanyAccess, async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    const [dashboardTypes] = await connection.execute(`
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
  } finally {
    await connection.end();
  }
});

// Get specific dashboard type with full configuration
router.get('/types/:id', auth, validateCompanyAccess, async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    const [dashboardTypes] = await connection.execute(`
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
    const [kpis] = await connection.execute(`
      SELECT * FROM dashboard_kpis 
      WHERE dashboard_type_id = ? 
      ORDER BY display_order ASC
    `, [dashboardType.id]);
    
    // Get active LLM profile
    const [llmProfiles] = await connection.execute(`
      SELECT * FROM llm_profiles 
      WHERE dashboard_type_id = ? AND is_active = true 
      ORDER BY version DESC 
      LIMIT 1
    `, [dashboardType.id]);
    
    // Get filters
    const [filters] = await connection.execute(`
      SELECT * FROM dashboard_filters 
      WHERE dashboard_type_id = ? AND is_active = true 
      ORDER BY display_order ASC
    `, [dashboardType.id]);
    
    res.json({
      success: true,
      dashboard_type: {
        ...dashboardType,
        kpis: kpis,
        llm_profile: llmProfiles[0] || null,
        filters: filters
      }
    });
  } catch (error) {
    console.error('❌ Error fetching dashboard type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard type'
    });
  } finally {
    await connection.end();
  }
});

// Create new dashboard type
router.post('/types', auth, validateCompanyAccess, async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);
  
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
          calculation_hint, example_good, example_bad,
          threshold_poor, threshold_fair, threshold_good
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        kpi.example_good || '',
        kpi.example_bad || '',
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
    await connection.end();
  }
});

// Update dashboard type
router.put('/types/:id', auth, validateCompanyAccess, async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    await connection.beginTransaction();
    
    const {
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
      SELECT id FROM dashboard_types 
      WHERE id = ? AND company_id = ?
    `, [req.params.id, req.user.companyId]);
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dashboard type not found'
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
        display_name = ?, description = ?, campaign_type = ?,
        theme_color = ?, icon_name = ?, recording_url_prefix = ?,
        is_default = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      display_name,
      description,
      campaign_type,
      theme_color,
      icon_name,
      recording_url_prefix,
      is_default || false,
      req.params.id
    ]);
    
    // Update KPIs if provided
    if (kpis && kpis.length === 8) {
      // Validate weights sum to 100
      const totalWeight = kpis.reduce((sum, kpi) => sum + (kpi.weight || 0), 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        return res.status(400).json({
          success: false,
          error: `KPI weights must sum to 100, currently: ${totalWeight}`
        });
      }
      
      // Delete existing KPIs
      await connection.execute(`
        DELETE FROM dashboard_kpis WHERE dashboard_type_id = ?
      `, [req.params.id]);
      
      // Create new KPIs
      for (let i = 0; i < kpis.length; i++) {
        const kpi = kpis[i];
        await connection.execute(`
          INSERT INTO dashboard_kpis (
            id, dashboard_type_id, kpi_key, display_name, description,
            icon_name, display_order, weight, min_value, max_value,
            calculation_hint, example_good, example_bad,
            threshold_poor, threshold_fair, threshold_good
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          kpi.example_good || '',
          kpi.example_bad || '',
          kpi.threshold_poor || 4,
          kpi.threshold_fair || 6,
          kpi.threshold_good || 8
        ]);
      }
    }
    
    // Update LLM profile if provided
    if (llm_profile) {
      // Deactivate old profiles
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
    res.status(500).json({
      success: false,
      error: 'Failed to update dashboard type'
    });
  } finally {
    await connection.end();
  }
});

// Delete dashboard type
router.delete('/types/:id', auth, validateCompanyAccess, async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // Verify dashboard belongs to company and get info
    const [dashboards] = await connection.execute(`
      SELECT internal_name, is_default FROM dashboard_types 
      WHERE id = ? AND company_id = ?
    `, [req.params.id, req.user.companyId]);
    
    if (dashboards.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dashboard type not found'
      });
    }
    
    // Don't allow deletion of default customer service dashboard
    if (dashboards[0].internal_name === 'customer_service') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the default customer service dashboard'
      });
    }
    
    // Check if there are processed webhooks using this dashboard
    const [webhookCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM webhook_kpi_scores 
      WHERE dashboard_type_id = ?
    `, [req.params.id]);
    
    if (webhookCount[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete dashboard type with ${webhookCount[0].count} processed webhooks. Archive it instead.`
      });
    }
    
    // Delete (CASCADE will handle related records)
    await connection.execute(`
      DELETE FROM dashboard_types WHERE id = ?
    `, [req.params.id]);
    
    res.json({
      success: true,
      message: 'Dashboard type deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error deleting dashboard type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete dashboard type'
    });
  } finally {
    await connection.end();
  }
});

// Get processed KPI data for a dashboard type
router.get('/types/:id/data', auth, validateCompanyAccess, async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    const { limit = 1000, agent, period, min_score, max_score } = req.query;
    
    // Verify dashboard belongs to company
    const [dashboards] = await connection.execute(`
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
    const [webhookData] = await connection.execute(`
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
  } finally {
    await connection.end();
  }
});

export default router;