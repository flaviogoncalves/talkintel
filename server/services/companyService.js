import { v4 as uuidv4 } from 'uuid';

class CompanyService {
  constructor(database) {
    this.db = database;
  }

  safeJsonParse(jsonString, defaultValue) {
    // Handle null/undefined/empty values
    if (!jsonString || jsonString === 'null' || jsonString === 'undefined') {
      return defaultValue;
    }
    
    // If it's already an object/array (MySQL driver auto-parsed JSON), return as-is
    if (typeof jsonString === 'object') {
      return jsonString;
    }
    
    // If it's a string, try to parse it
    if (typeof jsonString === 'string') {
      try {
        return JSON.parse(jsonString);
      } catch (error) {
        console.warn('⚠️ Failed to parse JSON string:', jsonString.substring(0, 100));
        return defaultValue;
      }
    }
    
    // For any other type, return default
    console.warn('⚠️ Unexpected data type for JSON parsing:', typeof jsonString, jsonString);
    return defaultValue;
  }

  // Get company by webhook endpoint (UUID)
  async getCompanyByWebhookEndpoint(webhookEndpoint) {
    try {
      const results = await this.db.query(
        `SELECT * FROM companies WHERE id = ? AND is_active = TRUE`,
        [webhookEndpoint]
      );

      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('Error getting company by webhook endpoint:', error);
      throw error;
    }
  }

  // Get company by ID
  async getCompanyById(companyId) {
    try {
      const results = await this.db.query(
        `SELECT * FROM companies WHERE id = ? AND is_active = TRUE`,
        [companyId]
      );

      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('Error getting company by ID:', error);
      throw error;
    }
  }

  // Update company settings
  async updateCompanySettings(companyId, settings) {
    try {
      await this.db.query(
        `UPDATE companies SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [JSON.stringify(settings), companyId]
      );

      return await this.getCompanyById(companyId);
    } catch (error) {
      console.error('Error updating company settings:', error);
      throw error;
    }
  }

  // Get company dashboard stats
  async getCompanyDashboardStats(companyId, dateRange = null) {
    try {
      let dateFilter = '';
      let params = [companyId];

      if (dateRange && dateRange.start && dateRange.end) {
        dateFilter = 'AND timestamp BETWEEN ? AND ?';
        params.push(dateRange.start, dateRange.end);
      }

      // Get basic stats including sentiment recovery rate
      const [statsResult] = await this.db.query(
        `SELECT 
          COUNT(*) as total_calls,
          AVG(w.satisfaction_score) as average_satisfaction,
          AVG(CASE WHEN w.resolved = TRUE THEN 100 ELSE 0 END) as resolution_rate,
          AVG(w.duration) as average_call_duration,
          SUM(w.cost) as total_cost,
          COUNT(DISTINCT w.agent_id) as total_agents
         FROM webhooks_normalized w
         LEFT JOIN agents a ON w.agent_id = a.id
         WHERE w.company_id = ? ${dateFilter}`,
        params
      );

      // Calculate sentiment recovery rate (separate query for better performance)
      const sentimentRecoveryResult = await this.db.query(
        `SELECT 
          COUNT(*) as total_with_sentiment,
          AVG(w.sentiment_score) as average_sentiment_score,
          AVG(w.recovery_rate) as sentiment_recovery_rate
         FROM webhooks_normalized w
         WHERE w.company_id = ? ${dateFilter} AND w.sentiment_score IS NOT NULL`,
        params
      );

      // Get agent type counts
      const agentTypeCounts = await this.db.query(
        `SELECT 
          a.type as agent_type,
          COUNT(*) as count 
         FROM webhooks_normalized w 
         LEFT JOIN agents a ON w.agent_id = a.id
         WHERE w.company_id = ? ${dateFilter} AND a.type IS NOT NULL
         GROUP BY a.type`,
        params
      );

      // Get sentiment distribution
      const sentimentCounts = await this.db.query(
        `SELECT 
          sentiment,
          COUNT(*) as count 
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${dateFilter} AND sentiment IS NOT NULL
         GROUP BY sentiment`,
        params
      );

      // Get top topics with trending analysis
      const topicsResult = await this.db.query(
        `SELECT w.topics, w.timestamp FROM webhooks_normalized w WHERE w.company_id = ? ${dateFilter} AND w.topics IS NOT NULL ORDER BY w.timestamp DESC`,
        params
      );

      // Get previous period topics for comparison (same duration, previous period)
      let previousPeriodParams = [companyId];
      let previousDateFilter = '';
      
      if (dateRange && dateRange.start && dateRange.end) {
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        const periodLength = endDate.getTime() - startDate.getTime();
        const previousStart = new Date(startDate.getTime() - periodLength);
        const previousEnd = new Date(startDate);
        
        previousDateFilter = 'AND timestamp BETWEEN ? AND ?';
        previousPeriodParams.push(previousStart.toISOString(), previousEnd.toISOString());
      } else {
        // Default: compare with previous 7 days
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        
        previousDateFilter = 'AND timestamp BETWEEN ? AND ?';
        previousPeriodParams.push(twoWeeksAgo.toISOString(), weekAgo.toISOString());
      }

      const previousTopicsResult = await this.db.query(
        `SELECT w.topics FROM webhooks_normalized w WHERE w.company_id = ? ${previousDateFilter} AND w.topics IS NOT NULL`,
        previousPeriodParams
      );

      // Process current period topics
      const currentTopicsMap = new Map();
      topicsResult.forEach(row => {
        try {
          const topics = JSON.parse(row.topics);
          if (Array.isArray(topics)) {
            topics.forEach(topic => {
              currentTopicsMap.set(topic, (currentTopicsMap.get(topic) || 0) + 1);
            });
          }
        } catch (e) {
          // Skip invalid JSON
        }
      });

      // Process previous period topics
      const previousTopicsMap = new Map();
      previousTopicsResult.forEach(row => {
        try {
          const topics = JSON.parse(row.topics);
          if (Array.isArray(topics)) {
            topics.forEach(topic => {
              previousTopicsMap.set(topic, (previousTopicsMap.get(topic) || 0) + 1);
            });
          }
        } catch (e) {
          // Skip invalid JSON
        }
      });

      // Calculate trending topics with change indicators
      const topTopicsWithTrends = Array.from(currentTopicsMap.entries())
        .map(([topic, currentCount]) => {
          const previousCount = previousTopicsMap.get(topic) || 0;
          const change = previousCount > 0 ? ((currentCount - previousCount) / previousCount * 100) : (currentCount > 0 ? 100 : 0);
          
          return {
            topic,
            count: currentCount,
            previousCount,
            change: Math.round(change),
            isNew: previousCount === 0 && currentCount > 0,
            isRising: change > 20,
            isFalling: change < -20
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const topTopics = topTopicsWithTrends.map(item => item.topic);

      // Get calls for different time periods
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const [callsToday] = await this.db.query(
        `SELECT COUNT(*) as count FROM webhooks_normalized w WHERE w.company_id = ? AND w.timestamp >= ?`,
        [companyId, today]
      );

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const [callsThisWeek] = await this.db.query(
        `SELECT COUNT(*) as count FROM webhooks_normalized w WHERE w.company_id = ? AND w.timestamp >= ?`,
        [companyId, weekAgo]
      );

      // Process results
      const stats = statsResult || {};
      const recoveryStats = sentimentRecoveryResult[0] || {};
      const humanAgentCount = agentTypeCounts.find(a => a.agent_type === 'human')?.count || 0;
      const aiAgentCount = agentTypeCounts.find(a => a.agent_type === 'ai')?.count || 0;

      // Enhanced sentiment distribution with percentages
      const totalSentimentCalls = sentimentCounts.reduce((sum, s) => sum + (s.count || 0), 0);
      const sentimentDistribution = {
        positive: sentimentCounts.find(s => s.sentiment === 'positive')?.count || 0,
        neutral: sentimentCounts.find(s => s.sentiment === 'neutral')?.count || 0,
        negative: sentimentCounts.find(s => s.sentiment === 'negative')?.count || 0,
        totalCalls: totalSentimentCalls,
        positivePercentage: totalSentimentCalls > 0 ? Math.round((sentimentCounts.find(s => s.sentiment === 'positive')?.count || 0) / totalSentimentCalls * 100) : 0,
        neutralPercentage: totalSentimentCalls > 0 ? Math.round((sentimentCounts.find(s => s.sentiment === 'neutral')?.count || 0) / totalSentimentCalls * 100) : 0,
        negativePercentage: totalSentimentCalls > 0 ? Math.round((sentimentCounts.find(s => s.sentiment === 'negative')?.count || 0) / totalSentimentCalls * 100) : 0
      };

      return {
        totalCalls: parseInt(stats.total_calls) || 0,
        averageSatisfaction: stats.average_satisfaction ? (parseFloat(stats.average_satisfaction) * 10) : 0,
        // Replace resolutionRate with sentimentRecoveryRate for general dashboard
        sentimentRecoveryRate: parseFloat(recoveryStats.sentiment_recovery_rate) || 0,
        resolutionRate: parseFloat(stats.resolution_rate) || 0, // Keep for customer service dashboard
        averageCallDuration: parseFloat(stats.average_call_duration) || 0,
        totalCost: parseFloat(stats.total_cost) || 0,
        totalAgents: parseInt(stats.total_agents) || 0,
        humanAgentCount,
        aiAgentCount,
        callsToday: callsToday?.count || 0,
        callsThisWeek: callsThisWeek?.count || 0,
        topTopics,
        topTopicsWithTrends, // Enhanced topic data with change indicators
        sentimentDistribution,
        // Enhanced sentiment metrics
        averageSentimentScore: parseFloat(recoveryStats.average_sentiment_score) || 0,
        sentimentCallsCount: parseInt(recoveryStats.total_with_sentiment) || 0
      };

    } catch (error) {
      console.error('Error getting company dashboard stats:', error);
      throw error;
    }
  }

  // Get company agents with metrics
  async getCompanyAgents(companyId) {
    try {
      const results = await this.db.query(
        `SELECT * FROM agent_metrics WHERE company_id = ? ORDER BY satisfaction_score DESC`,
        [companyId]
      );

      return results.map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        total_calls: agent.total_calls || 0,
        satisfaction_score: agent.satisfaction_score ? parseFloat(agent.satisfaction_score) : 0, // Average sentiment score (already 0-10 scale)
        resolution_rate: agent.resolution_rate ? parseFloat(agent.resolution_rate) : 0, // Resolution rate (0-100 scale) 
        call_quality: agent.call_quality ? parseFloat(agent.call_quality) : 0, // Call quality (recovery rate scaled to 0-5)
        total_cost: agent.total_cost || 0,
        composite_performance_index: agent.composite_performance_index ? parseFloat(agent.composite_performance_index) : 0,
        performance_grade: agent.performance_grade || 'C',
        // Legacy fields for backward compatibility
        totalCalls: agent.total_calls || 0,
        averageDuration: agent.average_duration || 0,
        satisfactionScore: agent.satisfaction_score ? parseFloat(agent.satisfaction_score) : 0,
        resolutionRate: agent.resolution_rate ? parseFloat(agent.resolution_rate) : 0, 
        averageResponseTime: agent.average_response_time || 0,
        callQuality: agent.call_quality ? parseFloat(agent.call_quality) : 0,
        totalCost: agent.total_cost || 0,
        averageCost: agent.average_cost || 0,
        topTags: this.safeJsonParse(agent.top_tags, []),
        topTopics: this.safeJsonParse(agent.top_topics, []),
        sentimentDistribution: this.safeJsonParse(agent.sentiment_distribution, null),
        compositePerformanceIndex: agent.composite_performance_index || 0,
        performanceGrade: agent.performance_grade || 'C',
        scriptAdherence: agent.average_script_adherence || 0,
        trend: agent.trend || 'stable',
        trendValue: agent.trend_value || 0,
        lastUpdated: agent.last_updated
      }));

    } catch (error) {
      console.error('Error getting company agents:', error);
      throw error;
    }
  }

  // Calculate recovery rate by analyzing sentiment progression throughout calls
  async calculateRecoveryRateFromSentimentProgression(companyId, agentId) {
    try {
      console.log(`🔍 Calculating recovery rate for agent ${agentId}`);
      
      // Get all webhooks with raw sentiment analysis data for this agent
      const webhooks = await this.db.query(
        `SELECT raw_data FROM webhooks_normalized 
         WHERE company_id = ? AND agent_id = ? AND raw_data IS NOT NULL`,
        [companyId, agentId]
      );

      if (webhooks.length === 0) {
        console.log('📊 No webhook data with sentiment analysis found');
        return 0;
      }
      
      console.log(`📋 Found ${webhooks.length} webhooks with raw_data`);

      let totalCalls = 0;
      let recoveredCalls = 0;

      for (const webhook of webhooks) {
        try {
          // Parse raw_data JSON
          let rawData = webhook.raw_data;
          if (typeof rawData === 'string') {
            rawData = JSON.parse(rawData);
          }
          
          // Extract sentiment analysis - try multiple possible paths
          let sentimentAnalysis = rawData.payload?.sentiment_analysis || [];
          
          // If not found, try transcription.sentiment_analysis path (TalkIntel format)
          if (sentimentAnalysis.length === 0) {
            sentimentAnalysis = rawData.payload?.transcription?.sentiment_analysis || [];
          }
          
          // If still not found, try direct property access
          if (sentimentAnalysis.length === 0) {
            sentimentAnalysis = rawData.sentiment_analysis || [];
          }
          
          // If still empty, look for insights or analysis sections
          if (sentimentAnalysis.length === 0 && rawData.payload) {
            // Check all properties for sentiment data
            Object.keys(rawData.payload).forEach(key => {
              if (key.includes('sentiment') && Array.isArray(rawData.payload[key])) {
                sentimentAnalysis = rawData.payload[key];
              }
            });
          }
          
          console.log(`📊 Found ${sentimentAnalysis.length} sentiment analysis points`);
          if (sentimentAnalysis.length > 0) {
            console.log(`📝 Sample sentiment:`, sentimentAnalysis[0]);
          }
          
          if (sentimentAnalysis.length < 2) {
            console.log(`⏭️ Skipping call: only ${sentimentAnalysis.length} sentiment points`);
            continue; // Need at least 2 sentiment points to measure progression
          }

          totalCalls++;
          console.log(`📞 Analyzing call ${totalCalls} with ${sentimentAnalysis.length} sentiment points`);

          // Proper recovery analysis: sentiment progression from negative to positive/neutral
          // Sort by timestamp to ensure chronological order
          const chronologicalSentiments = sentimentAnalysis.sort((a, b) => {
            // Parse timestamps like "00:32-00:36" to get start time
            const aTime = parseFloat(a.timestamp?.split('-')[0]?.replace(':', '.') || '0');
            const bTime = parseFloat(b.timestamp?.split('-')[0]?.replace(':', '.') || '0');
            return aTime - bTime;
          });

          // Analyze sentiment trajectory throughout the call
          const firstSentiment = chronologicalSentiments[0];
          const lastSentiment = chronologicalSentiments[chronologicalSentiments.length - 1];
          
          console.log(`📈 Sentiment progression: ${firstSentiment.score} (${firstSentiment.label}) → ${lastSentiment.score} (${lastSentiment.label})`);

          // Recovery definition: Call started negative/frustrated and ended neutral or better
          const startedNegative = firstSentiment.score < 0.4; // Below 0.4 = negative/frustrated
          const endedNeutralOrBetter = lastSentiment.score >= 0.4; // 0.4+ = neutral or positive
          
          // Additional check: overall sentiment improvement (not just endpoint comparison)
          const sentimentImprovement = lastSentiment.score - firstSentiment.score;
          const significantImprovement = sentimentImprovement >= 0.2; // Minimum 0.2 point improvement
          
          if (startedNegative && (endedNeutralOrBetter || significantImprovement)) {
            recoveredCalls++;
            console.log(`✅ RECOVERY DETECTED: ${firstSentiment.score} → ${lastSentiment.score} (Δ +${sentimentImprovement.toFixed(2)})`);
          } else {
            console.log(`❌ No recovery: started ${startedNegative ? 'negative' : 'positive'}, ended ${endedNeutralOrBetter ? 'neutral+' : 'negative'}`);
          }

        } catch (parseError) {
          console.log('⚠️ Error processing call data:', parseError.message);
        }
      }

      const recoveryRate = totalCalls > 0 ? (recoveredCalls / totalCalls) * 100 : 0;
      console.log(`📈 Recovery rate: ${recoveredCalls}/${totalCalls} = ${recoveryRate.toFixed(2)}%`);
      
      return recoveryRate;

    } catch (error) {
      console.error('Error calculating recovery rate:', error);
      return 0;
    }
  }

  // Get company webhooks with pagination
  async getCompanyWebhooks(companyId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        startDate = null,
        endDate = null,
        agentId = null,
        sentiment = null,
        campaignType = null
      } = options;

      let whereClause = 'WHERE w.company_id = ?';
      let params = [companyId];

      if (startDate && endDate) {
        whereClause += ' AND w.timestamp BETWEEN ? AND ?';
        params.push(startDate, endDate);
      }

      if (agentId) {
        whereClause += ' AND w.agent_id = ?';
        params.push(agentId);
      }

      if (sentiment) {
        whereClause += ' AND w.sentiment = ?';
        params.push(sentiment);
      }

      if (campaignType) {
        whereClause += ' AND cam.campaign_type = ?';
        params.push(campaignType);
      }

      // Get total count
      const [countResult] = await this.db.query(
        `SELECT COUNT(*) as total FROM webhooks_normalized w 
         LEFT JOIN campaigns cam ON w.campaign_id = cam.id
         ${whereClause}`,
        params
      );

      // Get webhooks with proper parameter binding fix
      const webhooks = await this.db.query(
        `SELECT 
           w.id, w.company_id, w.campaign_id, w.agent_id, w.customer_id,
           w.timestamp, w.call_type, w.duration, w.satisfaction_score,
           w.sentiment, w.topics, w.tags, w.resolved, w.response_time,
           w.call_quality, w.cost, w.currency, w.transcription, w.summary,
           w.key_insights, w.kpi_data, w.raw_data, w.created_at,
           w.customer_service_score, w.kpi_scores,
           a.name as agent_name, a.external_id as agent_external_id, a.type as agent_type,
           c.name as customer_name, c.external_id as customer_external_id,
           cam.name as campaign_name
         FROM webhooks_normalized w 
         LEFT JOIN agents a ON w.agent_id = a.id
         LEFT JOIN customers c ON w.customer_id = c.id
         LEFT JOIN campaigns cam ON w.campaign_id = cam.id
         ${whereClause} 
         ORDER BY w.timestamp DESC 
         LIMIT ${parseInt(limit) || 50} OFFSET ${parseInt(offset) || 0}`,
        params
      );

      return {
        webhooks: webhooks.map(webhook => {
          const rawData = this.safeJsonParse(webhook.raw_data, null);
          const segments = rawData?.payload?.transcription?.segments || [];
          const sentimentAnalysis = rawData?.payload?.transcription?.sentiment_analysis || [];
          
          return {
            ...webhook,
            // Transform database fields to CallAnalysis format
            agentName: webhook.agent_name || 'Unknown Agent',
            customerName: webhook.customer_name || 'Unknown Customer', 
            agentType: webhook.agent_type || 'human',
            callType: webhook.call_type || 'human-human',
            customerSatisfaction: webhook.satisfaction_score ? (webhook.satisfaction_score * 10) : 0,
            resolutionRate: webhook.resolved ? 100 : 0,
            responseTime: webhook.response_time || 0,
            callQuality: webhook.call_quality || 0,
            // Parse JSON fields
            topics: this.safeJsonParse(webhook.topics, []),
            tags: this.safeJsonParse(webhook.tags, []),
            keyInsights: this.safeJsonParse(webhook.key_insights, []),
            kpiData: this.safeJsonParse(webhook.kpi_data, {}),
            // Add missing fields from raw data
            segments: segments,
            sentimentAnalysis: sentimentAnalysis,
            rawData: rawData
          };
        }),
        total: countResult?.total || 0,
        hasMore: (offset + limit) < (countResult?.total || 0)
      };

    } catch (error) {
      console.error('Error getting company webhooks:', error);
      throw error;
    }
  }

  // Update agent metrics (called after webhook processing)
  async updateAgentMetrics(companyId, agentId) {
    const startTime = Date.now();
    console.log(`🔧 Starting metrics update for company ${companyId}, agent ${agentId}`);
    
    try {
      // Validate inputs
      if (!companyId || !agentId) {
        throw new Error(`Invalid parameters: companyId=${companyId}, agentId=${agentId}`);
      }

      // First check if agent exists
      const agentExists = await this.db.query(
        'SELECT id, external_id, name FROM agents WHERE id = ? AND company_id = ?',
        [agentId, companyId]
      );
      
      if (!agentExists || agentExists.length === 0) {
        console.warn(`⚠️ Agent ${agentId} not found in company ${companyId}. Skipping metrics update.`);
        return;
      }
      
      console.log(`👤 Agent found: ${agentExists[0].name} (${agentExists[0].external_id})`);
      
      // Calculate enhanced metrics including composite performance index
      const metrics = await this.db.query(
        `SELECT 
          a.name as agent_name,
          a.type as agent_type,
          COUNT(*) as total_calls,
          AVG(w.duration) as average_duration,
          AVG(w.sentiment_score) as satisfaction_score,
          AVG(CASE WHEN w.resolved = TRUE THEN 100 ELSE 0 END) as resolution_rate,
          AVG(w.response_time) as average_response_time,
          AVG(w.call_quality) as call_quality,
          SUM(w.cost) as total_cost,
          AVG(w.cost) as average_cost,
          AVG(w.recovery_rate) as sentiment_recovery_rate,
          AVG(w.sentiment_score) as average_sentiment_score,
          COUNT(CASE WHEN w.sentiment = 'positive' THEN 1 END) / COUNT(*) * 100 as positive_sentiment_rate,
          COUNT(CASE WHEN w.sentiment = 'negative' THEN 1 END) / COUNT(*) * 100 as negative_sentiment_rate
         FROM webhooks_normalized w 
         INNER JOIN agents a ON w.agent_id = a.id 
         WHERE w.company_id = ? AND a.id = ?
         GROUP BY a.name, a.type`,
        [companyId, agentId]
      );

      console.log(`📊 Found ${metrics.length} metric results for agent ${agentId}`);
      if (metrics.length > 0) {
        console.log('📈 Metrics data:', {
          total_calls: metrics[0].total_calls,
          satisfaction_score: metrics[0].satisfaction_score,
          resolution_rate: metrics[0].resolution_rate,
          sentiment_recovery_rate: metrics[0].sentiment_recovery_rate
        });
      }

      if (!metrics || metrics.length === 0) {
        console.warn(`⚠️ No webhook data found for agent ${agentId}. Cannot calculate metrics.`);
        return;
      }

      // Get tags and topics
      const tagsResult = await this.db.query(
        `SELECT w.tags FROM webhooks_normalized w LEFT JOIN agents a ON w.agent_id = a.id WHERE w.company_id = ? AND w.agent_id = ? AND w.tags IS NOT NULL`,
        [companyId, agentId]
      );

      const topicsResult = await this.db.query(
        `SELECT w.topics FROM webhooks_normalized w LEFT JOIN agents a ON w.agent_id = a.id WHERE w.company_id = ? AND w.agent_id = ? AND w.topics IS NOT NULL`,
        [companyId, agentId]
      );

      const sentimentResult = await this.db.query(
        `SELECT w.sentiment, COUNT(*) as count FROM webhooks_normalized w 
         LEFT JOIN agents a ON w.agent_id = a.id WHERE w.company_id = ? AND w.agent_id = ? AND sentiment IS NOT NULL 
         GROUP BY sentiment`,
        [companyId, agentId]
      );

      // Process tags and topics
      const tagsMap = new Map();
      const topicsMap = new Map();

      tagsResult.forEach(row => {
        try {
          const tags = JSON.parse(row.tags);
          if (Array.isArray(tags)) {
            tags.forEach(tag => tagsMap.set(tag, (tagsMap.get(tag) || 0) + 1));
          }
        } catch (e) { }
      });

      topicsResult.forEach(row => {
        try {
          const topics = JSON.parse(row.topics);
          if (Array.isArray(topics)) {
            topics.forEach(topic => topicsMap.set(topic, (topicsMap.get(topic) || 0) + 1));
          }
        } catch (e) { }
      });

      const topTags = Array.from(tagsMap.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([tag]) => tag);

      const topTopics = Array.from(topicsMap.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([topic]) => topic);

      const sentimentDistribution = {
        positive: sentimentResult.find(s => s.sentiment === 'positive')?.count || 0,
        neutral: sentimentResult.find(s => s.sentiment === 'neutral')?.count || 0,
        negative: sentimentResult.find(s => s.sentiment === 'negative')?.count || 0
      };

      // Extract real metrics data (only use data we actually have)
      const totalCalls = parseInt(metrics[0]?.total_calls) || 0;
      const averageSentimentScore = parseFloat(metrics[0]?.average_sentiment_score) || 0; // Real sentiment score from webhooks
      let sentimentRecoveryRate = parseFloat(metrics[0]?.sentiment_recovery_rate) || 0; // Real recovery rate from webhooks
      
      // If no recovery rate data, calculate proper recovery rate from sentiment progression
      if (sentimentRecoveryRate === 0) {
        sentimentRecoveryRate = await this.calculateRecoveryRateFromSentimentProgression(companyId, agentId);
      }
      
      // Calculate CSAT using standard formula: (Satisfied Customers / Total Respondents) × 100
      // Satisfied Customers = those with positive sentiment (equivalent to 4-5 star ratings)
      const totalSentimentCalls = sentimentDistribution.positive + sentimentDistribution.neutral + sentimentDistribution.negative;
      const satisfiedCustomers = sentimentDistribution.positive; // Positive sentiment = satisfied (4-5 stars)
      const csatScore = totalSentimentCalls > 0 ? (satisfiedCustomers / totalSentimentCalls) * 100 : 0;
      
      // Calculate positivity rate (same as CSAT in this case, but keeping for clarity)
      const positivityRate = totalSentimentCalls > 0 ? (sentimentDistribution.positive / totalSentimentCalls) * 100 : 0;
      
      // Performance Index based on real webhook data:
      // - 50% CSAT Score (standard satisfied customers formula)
      // - 35% Recovery rate (ability to turn negative calls positive) 
      // - 15% Average sentiment score (overall sentiment quality)
      const compositePerformanceIndex = (
        (csatScore * 0.50) +
        (sentimentRecoveryRate * 0.35) +
        (averageSentimentScore * 10 * 0.15) // Convert 0-10 to 0-100 scale
      );

      // Convert to letter grade
      const getPerformanceGrade = (score) => {
        if (score >= 90) return 'A+';
        if (score >= 85) return 'A';
        if (score >= 80) return 'A-';
        if (score >= 75) return 'B+';
        if (score >= 70) return 'B';
        if (score >= 65) return 'B-';
        if (score >= 60) return 'C+';
        if (score >= 55) return 'C';
        if (score >= 50) return 'C-';
        return 'D';
      };

      const performanceGrade = getPerformanceGrade(compositePerformanceIndex);

      // Check if agent metrics already exists
      const existingMetrics = await this.db.query(
        'SELECT id FROM agent_metrics WHERE company_id = ? AND agent_id = ?',
        [companyId, agentId]
      );

      if (existingMetrics.length > 0) {
        // Update existing agent metrics
        await this.db.query(
          `UPDATE agent_metrics SET
            name = ?, type = ?, total_calls = ?, average_duration = ?,
            satisfaction_score = ?, resolution_rate = ?, average_response_time = ?, call_quality = ?,
            total_cost = ?, average_cost = ?, top_tags = ?, top_topics = ?, sentiment_distribution = ?,
            composite_performance_index = ?, performance_grade = ?,
            last_updated = CURRENT_TIMESTAMP
          WHERE company_id = ? AND agent_id = ?`,
          [
            metrics[0].agent_name || 'Unknown Agent',
            metrics[0].agent_type || 'human',
            totalCalls,
            metrics[0].average_duration || 0,
            metrics[0].average_sentiment_score || 0, // Average sentiment score (0-10 scale)
            sentimentRecoveryRate, // Recovery rate (0-100 scale in DB)
            0, // No response time data
            csatScore / 100, // Store CSAT as call quality for compatibility
            metrics[0].total_cost || 0,
            metrics[0].average_cost || 0,
            JSON.stringify(topTags),
            JSON.stringify(topTopics),
            JSON.stringify(sentimentDistribution),
            compositePerformanceIndex,
            performanceGrade,
            companyId,
            agentId
          ]
        );
      } else {
        // Insert new agent metrics
        await this.db.query(
          `INSERT INTO agent_metrics (
            id, company_id, agent_id, name, type, total_calls, average_duration,
            satisfaction_score, resolution_rate, average_response_time, call_quality,
            total_cost, average_cost, top_tags, top_topics, sentiment_distribution,
            composite_performance_index, performance_grade
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            companyId,
            agentId,
            metrics[0].agent_name || 'Unknown Agent',
            metrics[0].agent_type || 'human',
            totalCalls,
            metrics[0].average_duration || 0,
            metrics[0].average_sentiment_score || 0, // Average sentiment score (0-10 scale)
            sentimentRecoveryRate, // Recovery rate (0-100 scale in DB)
            0, // No response time data
            csatScore / 100, // Store CSAT as call quality for compatibility
            metrics[0].total_cost || 0,
            metrics[0].average_cost || 0,
            JSON.stringify(topTags),
            JSON.stringify(topTopics),
            JSON.stringify(sentimentDistribution),
            compositePerformanceIndex,
            performanceGrade
          ]
        );
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Agent metrics updated successfully in ${duration}ms for agent ${agentExists[0].name} (${agentId})`);
      console.log(`📊 Final metrics: CPI=${compositePerformanceIndex.toFixed(2)}, Grade=${performanceGrade}, Calls=${totalCalls}`);

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Error updating agent metrics after ${duration}ms:`, error);
      console.error(`🔍 Error details - Company: ${companyId}, Agent: ${agentId}`);
      throw error;
    }
  }

  // Recalculate ALL agent metrics for a company (useful for fixing existing data)
  async recalculateAllAgentMetrics(companyId) {
    try {
      console.log(`🔄 Recalculating all agent metrics for company ${companyId}`);
      
      // Get all agents that have webhook data
      const agentsWithWebhooks = await this.db.query(
        `SELECT DISTINCT a.id, a.external_id, a.name 
         FROM agents a 
         INNER JOIN webhooks_normalized w ON w.agent_id = a.id 
         WHERE a.company_id = ?`,
        [companyId]
      );

      console.log(`👥 Found ${agentsWithWebhooks.length} agents with webhook data`);

      for (const agent of agentsWithWebhooks) {
        console.log(`🔧 Recalculating metrics for agent: ${agent.name} (${agent.id})`);
        await this.updateAgentMetrics(companyId, agent.id);
      }

      console.log(`✅ Finished recalculating metrics for ${agentsWithWebhooks.length} agents`);
      return agentsWithWebhooks.length;
    } catch (error) {
      console.error('Error recalculating all agent metrics:', error);
      throw error;
    }
  }

  // Get debt collection specific metrics for a company
  async getDebtCollectionMetrics(companyId, period = '7d') {
    try {
      const periodCondition = this.getPeriodWhereClause(period);
      const params = [companyId];

      // Total calls
      const totalCallsResult = await this.db.query(
        `SELECT COUNT(*) as total_calls 
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition}`,
        params
      );
      const totalCalls = totalCallsResult[0]?.total_calls || 0;

      // Promise-to-Pay Rate (generated_promise_to_pay field)
      const promiseToPayResult = await this.db.query(
        `SELECT 
          COUNT(*) as total_analyzed,
          SUM(CASE WHEN LOWER(w.custom_analysis) LIKE '%promise%pay%' OR LOWER(w.custom_analysis) LIKE '%ptp%' THEN 1 ELSE 0 END) as promise_to_pay_count
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.custom_analysis IS NOT NULL`,
        params
      );
      const ptpRate = promiseToPayResult[0]?.total_analyzed > 0 
        ? (promiseToPayResult[0]?.promise_to_pay_count / promiseToPayResult[0]?.total_analyzed) * 100 
        : 0;

      // Compliance Rate - check for Mini-Miranda and prohibited language
      const complianceResult = await this.db.query(
        `SELECT 
          COUNT(*) as total_compliance_calls,
          SUM(CASE 
            WHEN (LOWER(w.transcription) LIKE '%attempt to collect%debt%' OR 
                  LOWER(w.transcription) LIKE '%mini miranda%') 
            AND LOWER(w.transcription) NOT LIKE '%sue%you%'
            AND LOWER(w.transcription) NOT LIKE '%arrest%'
            AND LOWER(w.transcription) NOT LIKE '%garnish%'
            THEN 1 ELSE 0 END) as compliant_calls
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.transcription IS NOT NULL`,
        params
      );
      const complianceRate = complianceResult[0]?.total_compliance_calls > 0 
        ? (complianceResult[0]?.compliant_calls / complianceResult[0]?.total_compliance_calls) * 100 
        : 100;

      // Payment Discussion Rate
      const paymentDiscussionResult = await this.db.query(
        `SELECT 
          COUNT(*) as total_calls,
          SUM(CASE 
            WHEN (LOWER(w.transcription) LIKE '%payment%' OR 
                  LOWER(w.transcription) LIKE '%pay%' OR
                  LOWER(w.transcription) LIKE '%money%' OR
                  LOWER(w.transcription) LIKE '%amount%')
            THEN 1 ELSE 0 END) as payment_discussed
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.transcription IS NOT NULL`,
        params
      );
      const paymentDiscussionRate = paymentDiscussionResult[0]?.total_calls > 0 
        ? (paymentDiscussionResult[0]?.payment_discussed / paymentDiscussionResult[0]?.total_calls) * 100 
        : 0;

      // Objection Handling Rate
      const objectionHandlingResult = await this.db.query(
        `SELECT 
          COUNT(*) as calls_with_objections,
          SUM(CASE 
            WHEN (LOWER(w.transcription) LIKE '%can\\'t afford%' OR 
                  LOWER(w.transcription) LIKE '%don\\'t have%' OR
                  LOWER(w.transcription) LIKE '%hardship%' OR
                  LOWER(w.transcription) LIKE '%financial%difficult%')
            AND (LOWER(w.transcription) LIKE '%understand%' OR
                 LOWER(w.transcription) LIKE '%payment plan%' OR
                 LOWER(w.transcription) LIKE '%arrangement%')
            THEN 1 ELSE 0 END) as objections_handled
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} 
         AND w.transcription IS NOT NULL
         AND (LOWER(w.transcription) LIKE '%can\\'t afford%' OR 
              LOWER(w.transcription) LIKE '%don\\'t have%' OR
              LOWER(w.transcription) LIKE '%hardship%' OR
              LOWER(w.transcription) LIKE '%financial%difficult%')`,
        params
      );
      const objectionHandlingRate = objectionHandlingResult[0]?.calls_with_objections > 0 
        ? (objectionHandlingResult[0]?.objections_handled / objectionHandlingResult[0]?.calls_with_objections) * 100 
        : 0;

      // Empathy Score (based on empathy keywords in transcription)
      const empathyResult = await this.db.query(
        `SELECT AVG(
          (CASE WHEN LOWER(w.transcription) LIKE '%understand%' THEN 1 ELSE 0 END) +
          (CASE WHEN LOWER(w.transcription) LIKE '%sorry%' THEN 1 ELSE 0 END) +
          (CASE WHEN LOWER(w.transcription) LIKE '%help%you%' THEN 1 ELSE 0 END) +
          (CASE WHEN LOWER(w.transcription) LIKE '%frustrating%' THEN 1 ELSE 0 END) +
          (CASE WHEN LOWER(w.transcription) LIKE '%difficult%' THEN 1 ELSE 0 END)
         ) * 2 as empathy_score
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.transcription IS NOT NULL`,
        params
      );
      const empathyScore = empathyResult[0]?.empathy_score || 0;

      // Right Party Contact Rate
      const rightPartyResult = await this.db.query(
        `SELECT 
          COUNT(*) as total_calls,
          SUM(CASE 
            WHEN (LOWER(w.transcription) LIKE '%verify%identity%' OR 
                  LOWER(w.transcription) LIKE '%confirm%name%' OR
                  LOWER(w.transcription) LIKE '%speak%with%' OR
                  w.customer_id IS NOT NULL)
            THEN 1 ELSE 0 END) as right_party_contacts
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition}`,
        params
      );
      const rightPartyContactRate = rightPartyResult[0]?.total_calls > 0 
        ? (rightPartyResult[0]?.right_party_contacts / rightPartyResult[0]?.total_calls) * 100 
        : 0;

      // Average Recovery Amount (if available in custom analysis)
      const recoveryResult = await this.db.query(
        `SELECT AVG(
          CASE 
            WHEN w.custom_analysis REGEXP '\\$[0-9]+\\.?[0-9]*' 
            THEN CAST(REGEXP_REPLACE(REGEXP_SUBSTR(w.custom_analysis, '\\$[0-9]+\\.?[0-9]*'), '[^0-9.]', '') AS DECIMAL(10,2))
            ELSE 0
          END
         ) as avg_recovery
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.custom_analysis IS NOT NULL`,
        params
      );
      const averageRecoveryAmount = recoveryResult[0]?.avg_recovery || 0;

      // Violation Count
      const violationResult = await this.db.query(
        `SELECT COUNT(*) as violation_count
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition}
         AND w.transcription IS NOT NULL
         AND (LOWER(w.transcription) LIKE '%sue%you%' OR
              LOWER(w.transcription) LIKE '%arrest%' OR
              LOWER(w.transcription) LIKE '%garnish%' OR
              LOWER(w.transcription) LIKE '%threaten%' OR
              LOWER(w.transcription) LIKE '%jail%')`,
        params
      );
      const violationCount = violationResult[0]?.violation_count || 0;

      // Customer Hardship Rate
      const hardshipResult = await this.db.query(
        `SELECT 
          COUNT(*) as total_calls,
          SUM(CASE 
            WHEN (LOWER(w.transcription) LIKE '%can\\'t afford%' OR 
                  LOWER(w.transcription) LIKE '%financial%difficult%' OR
                  LOWER(w.transcription) LIKE '%hardship%' OR
                  LOWER(w.transcription) LIKE '%unemployment%' OR
                  LOWER(w.transcription) LIKE '%lost%job%')
            THEN 1 ELSE 0 END) as hardship_calls
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.transcription IS NOT NULL`,
        params
      );
      const customerHardshipRate = hardshipResult[0]?.total_calls > 0 
        ? (hardshipResult[0]?.hardship_calls / hardshipResult[0]?.total_calls) * 100 
        : 0;

      return {
        totalCalls,
        promiseToPayRate: Math.min(ptpRate, 100),
        complianceRate: Math.min(complianceRate, 100),
        paymentDiscussionRate: Math.min(paymentDiscussionRate, 100),
        objectionHandlingRate: Math.min(objectionHandlingRate, 100),
        empathyScore: Math.min(empathyScore, 10),
        rightPartyContactRate: Math.min(rightPartyContactRate, 100),
        averageRecoveryAmount,
        violationCount,
        customerHardshipRate: Math.min(customerHardshipRate, 100)
      };

    } catch (error) {
      console.error('Error getting debt collection metrics:', error);
      throw error;
    }
  }

  // Get sales specific metrics for a company
  async getSalesMetrics(companyId, period = '7d') {
    try {
      const periodCondition = this.getPeriodWhereClause(period);
      const params = [companyId];

      // Total calls
      const totalCallsResult = await this.db.query(
        `SELECT COUNT(*) as total_calls 
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition}`,
        params
      );
      const totalCalls = totalCallsResult[0]?.total_calls || 0;

      // Talk-to-Listen Ratio (estimate from duration and agent activity)
      const talkToListenResult = await this.db.query(
        `SELECT AVG(
          CASE 
            WHEN w.transcription IS NOT NULL 
            THEN (LENGTH(w.transcription) - LENGTH(REPLACE(LOWER(w.transcription), 'agent:', ''))) / LENGTH(w.transcription) * 100
            ELSE 50
          END
         ) as agent_talk_percentage
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.transcription IS NOT NULL`,
        params
      );
      const talkToListenRatio = Math.min(Math.max(talkToListenResult[0]?.agent_talk_percentage || 45, 20), 80);

      // Discovery Question Rate (questions per call)
      const discoveryResult = await this.db.query(
        `SELECT AVG(
          (LENGTH(w.transcription) - LENGTH(REPLACE(LOWER(w.transcription), '?', ''))) / 
          GREATEST(LENGTH(w.transcription) / 1000, 1)
         ) as avg_questions_per_call
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.transcription IS NOT NULL`,
        params
      );
      const discoveryQuestionRate = Math.round((discoveryResult[0]?.avg_questions_per_call || 0) * 2); // Scale for hourly rate

      // Longest Customer Monologue (estimate from customer responses)
      const monologueResult = await this.db.query(
        `SELECT AVG(
          CASE 
            WHEN w.transcription LIKE '%customer:%' 
            THEN GREATEST(
              LENGTH(SUBSTRING_INDEX(SUBSTRING_INDEX(w.transcription, 'customer:', -1), 'agent:', 1)) / 3,
              30
            )
            ELSE 45
          END
         ) as avg_customer_monologue
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.transcription IS NOT NULL`,
        params
      );
      const longestCustomerMonologue = monologueResult[0]?.avg_customer_monologue || 45;

      // Conversation Switch Frequency (agent/customer transitions)
      const switchResult = await this.db.query(
        `SELECT AVG(
          (LENGTH(w.transcription) - LENGTH(REPLACE(LOWER(w.transcription), 'agent:', ''))) +
          (LENGTH(w.transcription) - LENGTH(REPLACE(LOWER(w.transcription), 'customer:', '')))
         ) as conversation_switches
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.transcription IS NOT NULL`,
        params
      );
      const conversationSwitchFrequency = Math.round(switchResult[0]?.conversation_switches || 25);

      // Customer Sentiment Progression
      const sentimentProgression = await this.db.query(
        `SELECT 
          COUNT(*) as total_calls,
          SUM(CASE WHEN w.sentiment_score > 0.1 THEN 1 ELSE 0 END) as positive_calls
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.sentiment_score IS NOT NULL`,
        params
      );
      const customerSentimentProgression = sentimentProgression[0]?.total_calls > 0 
        ? (sentimentProgression[0]?.positive_calls / sentimentProgression[0]?.total_calls) * 100 
        : 0;

      // Value Proposition Rate (benefit mentions per segment)
      const valuePropositionResult = await this.db.query(
        `SELECT AVG(
          (CASE WHEN LOWER(w.transcription) LIKE '%benefit%' THEN 1 ELSE 0 END) +
          (CASE WHEN LOWER(w.transcription) LIKE '%help%you%' THEN 1 ELSE 0 END) +
          (CASE WHEN LOWER(w.transcription) LIKE '%save%' THEN 1 ELSE 0 END) +
          (CASE WHEN LOWER(w.transcription) LIKE '%improve%' THEN 1 ELSE 0 END) +
          (CASE WHEN LOWER(w.transcription) LIKE '%solution%' THEN 1 ELSE 0 END)
         ) * 2 as value_propositions_per_10min
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.transcription IS NOT NULL`,
        params
      );
      const valuePropositionRate = valuePropositionResult[0]?.value_propositions_per_10min || 0;

      // Competitive Handling Rate
      const competitiveResult = await this.db.query(
        `SELECT 
          COUNT(*) as competitive_mentions,
          SUM(CASE 
            WHEN (LOWER(w.transcription) LIKE '%competitor%' OR 
                  LOWER(w.transcription) LIKE '%other%company%')
            AND (LOWER(w.transcription) LIKE '%understand%' OR
                 LOWER(w.transcription) LIKE '%difference%' OR
                 LOWER(w.transcription) LIKE '%advantage%')
            THEN 1 ELSE 0 END) as proper_competitive_handling
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} 
         AND w.transcription IS NOT NULL
         AND (LOWER(w.transcription) LIKE '%competitor%' OR 
              LOWER(w.transcription) LIKE '%other%company%')`,
        params
      );
      const competitiveHandlingRate = competitiveResult[0]?.competitive_mentions > 0 
        ? (competitiveResult[0]?.proper_competitive_handling / competitiveResult[0]?.competitive_mentions) * 100 
        : 95; // Default high if no competitive mentions

      // Average Deal Value (if available in custom analysis)
      const dealValueResult = await this.db.query(
        `SELECT AVG(
          CASE 
            WHEN w.custom_analysis REGEXP '\\$[0-9,]+' 
            THEN CAST(REGEXP_REPLACE(REGEXP_SUBSTR(w.custom_analysis, '\\$[0-9,]+'), '[^0-9]', '') AS DECIMAL(10,2))
            ELSE 5000
          END
         ) as avg_deal_value
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.custom_analysis IS NOT NULL`,
        params
      );
      const averageDealValue = dealValueResult[0]?.avg_deal_value || 5000;

      // Conversion Rate (successful outcomes)
      const conversionResult = await this.db.query(
        `SELECT 
          COUNT(*) as total_sales_calls,
          SUM(CASE 
            WHEN (LOWER(w.custom_analysis) LIKE '%closed%' OR 
                  LOWER(w.custom_analysis) LIKE '%sale%' OR
                  LOWER(w.custom_analysis) LIKE '%purchase%' OR
                  w.sentiment_score > 0.5)
            THEN 1 ELSE 0 END) as successful_conversions
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.transcription IS NOT NULL`,
        params
      );
      const conversionRate = conversionResult[0]?.total_sales_calls > 0 
        ? (conversionResult[0]?.successful_conversions / conversionResult[0]?.total_sales_calls) * 100 
        : 0;

      // Methodology Adherence (SPIN/MEDDIC coverage)
      const methodologyResult = await this.db.query(
        `SELECT AVG(
          (CASE WHEN LOWER(w.transcription) LIKE '%situation%' OR LOWER(w.transcription) LIKE '%tell%me%about%' THEN 20 ELSE 0 END) +
          (CASE WHEN LOWER(w.transcription) LIKE '%problem%' OR LOWER(w.transcription) LIKE '%challenge%' THEN 20 ELSE 0 END) +
          (CASE WHEN LOWER(w.transcription) LIKE '%impact%' OR LOWER(w.transcription) LIKE '%affect%' THEN 20 ELSE 0 END) +
          (CASE WHEN LOWER(w.transcription) LIKE '%need%' OR LOWER(w.transcription) LIKE '%important%' THEN 20 ELSE 0 END) +
          (CASE WHEN LOWER(w.transcription) LIKE '%decision%' OR LOWER(w.transcription) LIKE '%process%' THEN 20 ELSE 0 END)
         ) as methodology_score
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.transcription IS NOT NULL`,
        params
      );
      const methodologyAdherence = methodologyResult[0]?.methodology_score || 60;

      // Account Knowledge Score
      const accountKnowledgeResult = await this.db.query(
        `SELECT AVG(
          (CASE WHEN LOWER(w.transcription) LIKE '%your%company%' THEN 2 ELSE 0 END) +
          (CASE WHEN LOWER(w.transcription) LIKE '%research%' THEN 2 ELSE 0 END) +
          (CASE WHEN LOWER(w.transcription) LIKE '%understand%business%' THEN 2 ELSE 0 END) +
          (CASE WHEN LOWER(w.transcription) LIKE '%industry%' THEN 2 ELSE 0 END) +
          (CASE WHEN w.customer_id IS NOT NULL THEN 2 ELSE 0 END)
         ) as account_knowledge
         FROM webhooks_normalized w 
         WHERE w.company_id = ? ${periodCondition} AND w.transcription IS NOT NULL`,
        params
      );
      const accountKnowledgeScore = accountKnowledgeResult[0]?.account_knowledge || 5;

      return {
        totalCalls,
        talkToListenRatio: Math.round(talkToListenRatio * 10) / 10,
        discoveryQuestionRate: Math.max(discoveryQuestionRate, 0),
        longestCustomerMonologue: Math.round(longestCustomerMonologue),
        conversationSwitchFrequency: Math.max(conversationSwitchFrequency, 0),
        customerSentimentProgression: Math.min(customerSentimentProgression, 100),
        valuePropositionRate: Math.min(valuePropositionRate, 10),
        competitiveHandlingRate: Math.min(competitiveHandlingRate, 100),
        averageDealValue: Math.round(averageDealValue),
        conversionRate: Math.min(conversionRate, 100),
        methodologyAdherence: Math.min(methodologyAdherence, 100),
        accountKnowledgeScore: Math.min(accountKnowledgeScore, 10)
      };

    } catch (error) {
      console.error('Error getting sales metrics:', error);
      throw error;
    }
  }
}

export default CompanyService;