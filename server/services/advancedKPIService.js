import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import encryptionService from './encryptionService.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

class AdvancedKPIService {
  constructor(database) {
    this.db = database;
  }

  /**
   * Calculate all advanced KPIs for a specific webhook
   * @param {string} webhookId - The webhook ID to analyze
   * @returns {object} - Complete KPI analysis results
   */
  async calculateAdvancedKPIs(webhookId) {
    try {
      console.log(`🎯 Calculating advanced KPIs for webhook ${webhookId}`);

      // Get webhook data with campaign and company info
      const [webhook] = await this.db.query(`
        SELECT 
          w.*,
          c.campaign_type,
          c.call_script,
          c.script_required_elements,
          c.script_adherence_enabled,
          comp.subscription_tier,
          comp.llm_api_key_encrypted,
          comp.llm_api_url,
          comp.llm_model,
          comp.encryption_iv,
          comp.id as company_id
        FROM webhooks_normalized w
        JOIN campaigns c ON w.campaign_id = c.id
        JOIN companies comp ON w.company_id = comp.id
        WHERE w.id = ?
      `, [webhookId]);

      if (!webhook) {
        throw new Error('Webhook not found');
      }

      // Check if company has premium subscription
      if (webhook.subscription_tier === 'basic') {
        console.log('⚠️ Advanced KPIs require premium subscription');
        return null;
      }

      if (!webhook.transcription) {
        console.log('⚠️ No transcription available for KPI analysis');
        return null;
      }

      // Get LLM configuration
      const llmConfig = await this.getLLMConfig(webhook);
      if (!llmConfig) {
        console.log('⚠️ LLM configuration not available');
        return null;
      }

      // Calculate KPIs based on campaign type
      let kpiResults;
      switch (webhook.campaign_type) {
        case 'sales':
          kpiResults = await this.calculateSalesKPIs(webhook, llmConfig);
          break;
        case 'customer_service':
          kpiResults = await this.calculateCustomerServiceKPIs(webhook, llmConfig);
          break;
        case 'debt_collection':
          kpiResults = await this.calculateDebtCollectionKPIs(webhook, llmConfig);
          break;
        default:
          throw new Error(`Unsupported campaign type: ${webhook.campaign_type}`);
      }

      // Store results in database
      await this.storeKPIResults(webhookId, webhook, kpiResults);

      console.log(`✅ Advanced KPIs calculated successfully for webhook ${webhookId}`);
      return kpiResults;

    } catch (error) {
      console.error(`❌ Error calculating advanced KPIs for webhook ${webhookId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get LLM configuration for a company
   */
  async getLLMConfig(webhook) {
    if (!webhook.llm_api_key_encrypted) {
      return null;
    }

    try {
      const decryptedApiKey = encryptionService.decryptApiKey(
        webhook.llm_api_key_encrypted,
        webhook.encryption_iv,
        webhook.company_id
      );

      return {
        apiKey: decryptedApiKey,
        apiUrl: webhook.llm_api_url || process.env.DEFAULT_LLM_API_URL || 'http://api.sippulse.ai',
        model: webhook.llm_model || process.env.DEFAULT_LLM_MODEL || 'gpt-3.5-turbo'
      };
    } catch (error) {
      console.error('Error decrypting LLM API key:', error.message);
      return null;
    }
  }

  /**
   * Calculate Sales KPIs
   */
  async calculateSalesKPIs(webhook, llmConfig) {
    const prompt = this.getSalesKPIPrompt(webhook.transcription);
    const analysis = await this.callLLMAPI(llmConfig, prompt);
    
    if (!analysis) {
      throw new Error('Failed to get LLM analysis for sales KPIs');
    }

    // Parse and validate the analysis results
    const kpis = this.parseSalesKPIs(analysis);
    return {
      type: 'sales',
      calculated_at: new Date().toISOString(),
      kpis: kpis,
      raw_analysis: analysis
    };
  }

  /**
   * Calculate Customer Service KPIs
   */
  async calculateCustomerServiceKPIs(webhook, llmConfig) {
    const prompt = this.getCustomerServiceKPIPrompt(webhook);
    const analysis = await this.callLLMAPI(llmConfig, prompt);
    
    if (!analysis) {
      throw new Error('Failed to get LLM analysis for customer service KPIs');
    }

    // Parse and validate the analysis results
    const kpis = this.parseCustomerServiceKPIs(analysis);
    return {
      type: 'customer_service',
      calculated_at: new Date().toISOString(),
      kpis: kpis,
      raw_analysis: analysis
    };
  }

  /**
   * Calculate Debt Collection KPIs (existing functionality)
   */
  async calculateDebtCollectionKPIs(webhook, llmConfig) {
    // This would use the existing script adherence logic for debt collection
    // For now, return a placeholder structure
    return {
      type: 'debt_collection',
      calculated_at: new Date().toISOString(),
      kpis: {},
      raw_analysis: null
    };
  }

  /**
   * Generate Sales KPI analysis prompt
   */
  getSalesKPIPrompt(transcription) {
    return `Analyze this sales call transcription and extract the following KPIs. Return your response in JSON format with exact numeric values where specified:

TRANSCRIPTION:
${transcription}

Please analyze and return JSON with these exact fields:

{
  "talk_to_listen_ratio": {
    "agent_talk_percentage": <number 0-100>,
    "customer_talk_percentage": <number 0-100>,
    "optimal_range": "40-45% agent talk time",
    "performance": "<excellent|good|needs_improvement>"
  },
  "discovery_question_rate": {
    "total_questions": <number>,
    "questions_per_hour": <number>,
    "question_types": {
      "situation": <number>,
      "problem": <number>,
      "implication": <number>,
      "need_payoff": <number>
    },
    "performance": "<excellent|good|needs_improvement>"
  },
  "conversation_engagement": {
    "switch_frequency": <number per 5-minute interval>,
    "longest_customer_monologue_seconds": <number>,
    "longest_agent_monologue_seconds": <number>,
    "engagement_level": "<high|medium|low>"
  },
  "value_proposition": {
    "articulation_rate": <number per 10 minutes>,
    "benefit_connections": <number>,
    "feature_to_benefit_ratio": <number>,
    "effectiveness": "<excellent|good|needs_improvement>"
  },
  "methodology_adherence": {
    "spin_coverage": {
      "situation_covered": <boolean>,
      "problem_covered": <boolean>,
      "implication_covered": <boolean>,
      "need_payoff_covered": <boolean>,
      "completion_percentage": <number 0-100>
    },
    "meddic_coverage": {
      "metrics_identified": <boolean>,
      "economic_buyer_identified": <boolean>,
      "decision_criteria_covered": <boolean>,
      "decision_process_covered": <boolean>,
      "pain_points_identified": <boolean>,
      "champions_identified": <boolean>,
      "completion_percentage": <number 0-100>
    }
  },
  "customer_insights": {
    "sentiment_progression": "<positive|neutral|negative>",
    "pain_points_discovered": <number>,
    "pain_points_quantified": <number>,
    "engagement_indicators": ["<list of indicators>"]
  },
  "competitive_handling": {
    "competitors_mentioned": <number>,
    "responses_provided": <number>,
    "response_quality": "<excellent|good|poor>",
    "differentiation_clear": <boolean>
  },
  "call_preparation": {
    "account_knowledge_demonstrated": <boolean>,
    "preparation_score": <number 1-10>,
    "personalization_evident": <boolean>
  },
  "next_steps": {
    "urgency_created": <boolean>,
    "time_bound_commitments": <boolean>,
    "clear_next_steps": <boolean>,
    "conversion_likelihood": "<high|medium|low>"
  }
}

Focus on extracting precise metrics and providing realistic assessments based on the conversation content.`;
  }

  /**
   * Generate Customer Service KPI analysis prompt
   */
  getCustomerServiceKPIPrompt(webhook) {
    try {
      // Read the prompt template from file
      const promptPath = path.join(process.cwd(), 'prompts', 'customer-service-kpis.txt');
      let promptTemplate = fs.readFileSync(promptPath, 'utf8');
      
      // Replace placeholders with actual values
      const transcription = webhook.transcription || 'No transcription available';
      const agentName = webhook.agent_name || 'Unknown Agent';
      const customerName = webhook.customer_name || 'Unknown Customer';
      const duration = webhook.call_duration || 0;
      
      promptTemplate = promptTemplate.replace('{transcription}', transcription);
      promptTemplate = promptTemplate.replace('{agentName}', agentName);
      promptTemplate = promptTemplate.replace('{customerName}', customerName);
      promptTemplate = promptTemplate.replace('{duration}', duration);
      
      return promptTemplate;
      
    } catch (error) {
      console.error('Error reading customer service KPI prompt file:', error.message);
      // Fallback to a simple prompt if file reading fails
      return `Analyze this customer service call and rate the following 8 KPIs from 0-10:

TRANSCRIPTION: ${webhook.transcription}

Please respond with JSON:
{
  "customer_sentiment_score": 0,
  "agent_empathy_score": 0,
  "first_contact_resolution": 0,
  "customer_effort_score": 0,
  "conversation_flow_quality": 0,
  "agent_knowledge_assessment": 0,
  "call_wrap_up_quality": 0,
  "behavioral_standards_compliance": 0
}`;
    }
  }

  /**
   * Parse Sales KPI results from LLM response
   */
  parseSalesKPIs(analysis) {
    try {
      // Remove markdown code blocks if present
      let cleanedAnalysis = analysis.trim();
      if (cleanedAnalysis.startsWith('```json')) {
        cleanedAnalysis = cleanedAnalysis.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedAnalysis.startsWith('```')) {
        cleanedAnalysis = cleanedAnalysis.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      return JSON.parse(cleanedAnalysis);
    } catch (error) {
      console.error('Error parsing sales KPI analysis:', error.message);
      return {};
    }
  }

  /**
   * Parse Customer Service KPI results from LLM response
   */
  parseCustomerServiceKPIs(analysis) {
    try {
      // Remove markdown code blocks if present
      let cleanedAnalysis = analysis.trim();
      if (cleanedAnalysis.startsWith('```json')) {
        cleanedAnalysis = cleanedAnalysis.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedAnalysis.startsWith('```')) {
        cleanedAnalysis = cleanedAnalysis.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const kpis = JSON.parse(cleanedAnalysis);
      
      // Calculate Customer Service Score using weighted average
      const customerServiceScore = this.calculateCustomerServiceScore(kpis);
      
      return {
        simplified_kpis: kpis,
        customer_service_score: customerServiceScore,
        calculation_metadata: {
          weights: this.getKPIWeights(),
          calculated_at: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error parsing customer service KPI analysis:', error.message);
      return {};
    }
  }

  /**
   * Calculate Customer Service Score using weighted average of 8 KPIs
   */
  calculateCustomerServiceScore(kpis) {
    const weights = this.getKPIWeights();
    
    // Ensure all KPIs have values, default to 0 if missing
    const kpiValues = {
      customer_sentiment_score: kpis.customer_sentiment_score || 0,
      agent_empathy_score: kpis.agent_empathy_score || 0,
      first_contact_resolution: kpis.first_contact_resolution || 0,
      customer_effort_score: kpis.customer_effort_score || 0,
      conversation_flow_quality: kpis.conversation_flow_quality || 0,
      agent_knowledge_assessment: kpis.agent_knowledge_assessment || 0,
      call_wrap_up_quality: kpis.call_wrap_up_quality || 0,
      behavioral_standards_compliance: kpis.behavioral_standards_compliance || 0
    };
    
    // Calculate weighted sum
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const [kpiName, weight] of Object.entries(weights)) {
      if (kpiValues[kpiName] !== undefined) {
        weightedSum += kpiValues[kpiName] * weight;
        totalWeight += weight;
      }
    }
    
    // Return weighted average (0-10 scale)
    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
    return Math.round(score * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Get industry-standard KPI weights for Customer Service Score calculation
   */
  getKPIWeights() {
    return {
      customer_sentiment_score: 0.20,    // 20%
      agent_empathy_score: 0.15,         // 15%
      first_contact_resolution: 0.25,    // 25%
      customer_effort_score: 0.15,       // 15%
      conversation_flow_quality: 0.10,   // 10%
      agent_knowledge_assessment: 0.05,  // 5%
      call_wrap_up_quality: 0.05,        // 5%
      behavioral_standards_compliance: 0.05 // 5%
    };
  }

  /**
   * Call LLM API for analysis
   */
  async callLLMAPI(llmConfig, prompt) {
    try {
      const response = await fetch(`${llmConfig.apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmConfig.apiKey}`
        },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert conversation analytics specialist. Analyze call transcripts and extract precise KPIs with accurate numerical measurements. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} - ${response.statusText}`);
      }

      const result = await response.json();
      return result.choices[0]?.message?.content;

    } catch (error) {
      console.error('LLM API call error:', error.message);
      return null;
    }
  }

  /**
   * Store KPI results in database
   */
  async storeKPIResults(webhookId, webhook, kpiResults) {
    try {
      // Extract customer service score for easier querying
      const customerServiceScore = kpiResults.customer_service_score || null;
      const simplifiedKpis = kpiResults.simplified_kpis || {};
      
      // Update the webhook with advanced KPIs and Customer Service Score
      await this.db.query(`
        UPDATE webhooks_normalized 
        SET advanced_kpis = ?, 
            advanced_kpis_calculated_at = NOW(),
            customer_service_score = ?,
            kpi_scores = ?
        WHERE id = ?
      `, [
        JSON.stringify(kpiResults), 
        customerServiceScore,
        JSON.stringify(simplifiedKpis),
        webhookId
      ]);

      // Store individual KPI calculations in history table
      if (simplifiedKpis) {
        for (const [kpiName, kpiValue] of Object.entries(simplifiedKpis)) {
          await this.storeIndividualKPI(
            webhookId, 
            webhook, 
            kpiName, 
            kpiValue, 
            kpiResults.type
          );
        }
        
        // Store the overall Customer Service Score as a KPI as well
        if (customerServiceScore !== null) {
          await this.storeIndividualKPI(
            webhookId, 
            webhook, 
            'customer_service_score', 
            customerServiceScore, 
            kpiResults.type
          );
        }
      }

    } catch (error) {
      console.error('Error storing KPI results:', error.message);
      throw error;
    }
  }

  /**
   * Store individual KPI calculation
   */
  async storeIndividualKPI(webhookId, webhook, kpiName, kpiData, campaignType) {
    try {
      // Extract numeric value from KPI data
      let kpiValue = null;
      if (typeof kpiData === 'number') {
        kpiValue = kpiData;
      } else if (typeof kpiData === 'object' && kpiData.score) {
        kpiValue = kpiData.score;
      } else if (typeof kpiData === 'object' && kpiData.percentage) {
        kpiValue = kpiData.percentage;
      }

      await this.db.query(`
        INSERT INTO kpi_calculations (
          id, webhook_id, company_id, campaign_id, campaign_type,
          kpi_name, kpi_value, kpi_details, calculation_metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        uuidv4(),
        webhookId,
        webhook.company_id,
        webhook.campaign_id,
        campaignType,
        kpiName,
        kpiValue,
        JSON.stringify(kpiData),
        JSON.stringify({
          calculated_at: new Date().toISOString(),
          llm_model: webhook.llm_model,
          version: '1.0'
        })
      ]);

    } catch (error) {
      console.error(`Error storing individual KPI ${kpiName}:`, error.message);
    }
  }

  /**
   * Get aggregated KPIs for a company/campaign
   */
  async getAggregatedKPIs(companyId, campaignId = null, campaignType = null, dateRange = '7d') {
    try {
      let dateCondition = '';
      const params = [companyId];

      // Add date range condition
      switch (dateRange) {
        case '7d':
          dateCondition = 'AND w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
          break;
        case '30d':
          dateCondition = 'AND w.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
          break;
        case '90d':
          dateCondition = 'AND w.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
          break;
      }

      let campaignCondition = '';
      if (campaignId) {
        campaignCondition = 'AND w.campaign_id = ?';
        params.push(campaignId);
      } else if (campaignType) {
        campaignCondition = 'AND c.campaign_type = ?';
        params.push(campaignType);
      }

      const results = await this.db.query(`
        SELECT 
          w.advanced_kpis,
          c.campaign_type
        FROM webhooks_normalized w
        JOIN campaigns c ON w.campaign_id = c.id
        WHERE w.company_id = ?
          AND w.advanced_kpis IS NOT NULL
          ${dateCondition}
          ${campaignCondition}
      `, params);

      return this.aggregateKPIResults(results);

    } catch (error) {
      console.error('Error getting aggregated KPIs:', error.message);
      throw error;
    }
  }

  /**
   * Aggregate KPI results for dashboard display
   */
  aggregateKPIResults(results) {
    if (!results.length) {
      return null;
    }

    console.log(`🔍 Aggregating ${results.length} results for KPI analysis`);
    
    // Parse and aggregate all KPI data
    const allKpis = [];
    const validResults = [];

    for (const result of results) {
      try {
        if (result.advanced_kpis) {
          let kpiData;
          
          // Handle both string and object formats
          if (typeof result.advanced_kpis === 'string') {
            kpiData = JSON.parse(result.advanced_kpis);
          } else if (typeof result.advanced_kpis === 'object') {
            kpiData = result.advanced_kpis;
          }
          
          if (kpiData && kpiData.kpis) {
            console.log(`✅ Found valid KPI data for result ${result.id || 'unknown'}`);
            allKpis.push(kpiData.kpis);
            validResults.push({...result, parsedKpis: kpiData.kpis});
          } else {
            console.log(`⚠️ KPI data structure invalid for result ${result.id || 'unknown'}:`, Object.keys(kpiData || {}));
          }
        }
      } catch (error) {
        console.error('Error parsing KPI data:', error.message, 'for result:', result.id || 'unknown');
      }
    }

    if (allKpis.length === 0) {
      console.log('⚠️ No valid KPI data found in results');
      return {
        totalCalls: results.length,
        kpis: {},
        trends: {},
        benchmarks: {}
      };
    }

    console.log(`✅ Found ${allKpis.length} valid KPI datasets`);

    // Aggregate customer service KPIs
    const aggregated = {
      totalCalls: results.length,
      validKpiCalls: allKpis.length,
      kpis: {
        // Customer Sentiment Analytics
        customer_sentiment: this.aggregateCustomerSentiment(allKpis),
        
        // Agent Performance
        agent_empathy: this.aggregateAgentEmpathy(allKpis),
        
        // Resolution Quality
        resolution_quality: this.aggregateResolutionQuality(allKpis),
        
        // Customer Effort
        customer_effort: this.aggregateCustomerEffort(allKpis),
        
        // Conversation Flow
        conversation_flow: this.aggregateConversationFlow(allKpis),
        
        // Agent Knowledge
        agent_knowledge: this.aggregateAgentKnowledge(allKpis),
        
        // Call Quality
        call_wrap_up: this.aggregateCallWrapUp(allKpis),
        
        // Behavioral Compliance
        behavioral_compliance: this.aggregateBehavioralCompliance(allKpis),
        
        // Script Adherence
        script_adherence: this.aggregateScriptAdherence(allKpis)
      },
      trends: {
        sentiment_improvement_rate: this.calculateSentimentTrend(validResults),
        resolution_rate_trend: this.calculateResolutionTrend(validResults)
      },
      benchmarks: {
        industry_comparison: this.getIndustryBenchmarks()
      }
    };

    console.log('📊 KPI aggregation completed:', {
      totalCalls: aggregated.totalCalls,
      validKpis: aggregated.validKpiCalls,
      kpiCount: Object.keys(aggregated.kpis).length
    });

    return aggregated;
  }

  // Customer Sentiment aggregation
  aggregateCustomerSentiment(allKpis) {
    const sentiments = allKpis.map(kpi => kpi.customer_sentiment).filter(Boolean);
    if (!sentiments.length) return null;

    const avgInitial = this.average(sentiments.map(s => s.initial_sentiment || 0));
    const avgFinal = this.average(sentiments.map(s => s.final_sentiment || 0));
    const avgCsat = this.average(sentiments.map(s => s.csat_prediction || 0));
    
    const progressionCounts = this.countValues(sentiments.map(s => s.sentiment_progression));

    return {
      average_initial_sentiment: Math.round(avgInitial * 100) / 100,
      average_final_sentiment: Math.round(avgFinal * 100) / 100,
      sentiment_improvement: Math.round((avgFinal - avgInitial) * 100) / 100,
      average_csat_prediction: Math.round(avgCsat * 10) / 10,
      progression_breakdown: progressionCounts,
      sample_size: sentiments.length
    };
  }

  // Agent Empathy aggregation
  aggregateAgentEmpathy(allKpis) {
    const empathy = allKpis.map(kpi => kpi.agent_empathy).filter(Boolean);
    if (!empathy.length) return null;

    const avgMarkers = this.average(empathy.map(e => e.empathy_markers_detected || 0));
    const avgScore = this.average(empathy.map(e => e.empathy_score || 0));
    const emotionalAck = this.percentage(empathy.map(e => e.emotional_acknowledgment));

    return {
      average_empathy_markers: Math.round(avgMarkers * 10) / 10,
      average_empathy_score: Math.round(avgScore),
      emotional_acknowledgment_rate: Math.round(emotionalAck),
      performance_distribution: this.countValues(empathy.map(e => e.performance)),
      sample_size: empathy.length
    };
  }

  // Resolution Quality aggregation
  aggregateResolutionQuality(allKpis) {
    const resolution = allKpis.map(kpi => kpi.resolution_quality).filter(Boolean);
    if (!resolution.length) return null;

    const fcrRate = this.percentage(resolution.map(r => r.first_contact_resolution));
    const resolutionRate = this.percentage(resolution.map(r => r.resolution_language_detected));
    const avgConfidence = this.average(resolution.map(r => r.resolution_confidence || 0));

    return {
      first_contact_resolution_rate: Math.round(fcrRate),
      resolution_language_rate: Math.round(resolutionRate),
      average_resolution_confidence: Math.round(avgConfidence),
      sample_size: resolution.length
    };
  }

  // Customer Effort aggregation  
  aggregateCustomerEffort(allKpis) {
    const effort = allKpis.map(kpi => kpi.customer_effort).filter(Boolean);
    if (!effort.length) return null;

    const avgIndicators = this.average(effort.map(e => e.effort_indicators_detected || 0));
    const avgScore = this.average(effort.map(e => e.effort_score || 0));

    return {
      average_effort_indicators: Math.round(avgIndicators * 10) / 10,
      average_effort_score: Math.round(avgScore * 10) / 10,
      ease_distribution: this.countValues(effort.map(e => e.ease_of_interaction)),
      sample_size: effort.length
    };
  }

  // Conversation Flow aggregation
  aggregateConversationFlow(allKpis) {
    const flow = allKpis.map(kpi => kpi.conversation_flow).filter(Boolean);
    if (!flow.length) return null;

    const avgInterruptions = this.average(flow.map(f => f.inappropriate_interruptions || 0));
    const avgSilences = this.average(flow.map(f => f.awkward_silences || 0));
    const avgQuality = this.average(flow.map(f => f.flow_quality_score || 0));

    return {
      average_interruptions: Math.round(avgInterruptions * 10) / 10,
      average_awkward_silences: Math.round(avgSilences * 10) / 10,
      average_flow_quality: Math.round(avgQuality),
      turn_taking_distribution: this.countValues(flow.map(f => f.turn_taking_quality)),
      sample_size: flow.length
    };
  }

  // Agent Knowledge aggregation
  aggregateAgentKnowledge(allKpis) {
    const knowledge = allKpis.map(kpi => kpi.agent_knowledge).filter(Boolean);
    if (!knowledge.length) return null;

    const avgUncertainty = this.average(knowledge.map(k => k.uncertainty_indicators || 0));
    const avgAccuracy = this.average(knowledge.map(k => k.accuracy_score || 0));
    const expertiseRate = this.percentage(knowledge.map(k => k.expertise_demonstrated));

    return {
      average_uncertainty_indicators: Math.round(avgUncertainty * 10) / 10,
      average_accuracy_score: Math.round(avgAccuracy),
      expertise_demonstration_rate: Math.round(expertiseRate),
      sample_size: knowledge.length
    };
  }

  // Call Wrap-up aggregation
  aggregateCallWrapUp(allKpis) {
    const wrapup = allKpis.map(kpi => kpi.call_wrap_up).filter(Boolean);
    if (!wrapup.length) return null;

    const nextStepsRate = this.percentage(wrapup.map(w => w.clear_next_steps));
    const confirmationRate = this.percentage(wrapup.map(w => w.confirmation_provided));
    const contactInfoRate = this.percentage(wrapup.map(w => w.contact_information_shared));

    return {
      clear_next_steps_rate: Math.round(nextStepsRate),
      confirmation_rate: Math.round(confirmationRate),
      contact_info_rate: Math.round(contactInfoRate),
      quality_distribution: this.countValues(wrapup.map(w => w.wrap_up_quality)),
      sample_size: wrapup.length
    };
  }

  // Behavioral Compliance aggregation
  aggregateBehavioralCompliance(allKpis) {
    const compliance = allKpis.map(kpi => kpi.behavioral_compliance).filter(Boolean);
    if (!compliance.length) return null;

    const professionalRate = this.percentage(compliance.map(c => c.professional_tone));
    const listeningRate = this.percentage(compliance.map(c => c.active_listening));
    const patienceRate = this.percentage(compliance.map(c => c.patience_demonstrated));
    const avgScore = this.average(compliance.map(c => c.compliance_score || 0));

    return {
      professional_tone_rate: Math.round(professionalRate),
      active_listening_rate: Math.round(listeningRate),
      patience_rate: Math.round(patienceRate),
      average_compliance_score: Math.round(avgScore),
      sample_size: compliance.length
    };
  }

  // Script Adherence aggregation
  aggregateScriptAdherence(allKpis) {
    const scriptAdherence = allKpis.map(kpi => kpi.script_adherence).filter(Boolean);
    if (!scriptAdherence.length) return null;

    const greetingRate = this.percentage(scriptAdherence.map(s => s.greeting_compliance));
    const introRate = this.percentage(scriptAdherence.map(s => s.introduction_compliance));
    const avgAdherence = this.average(scriptAdherence.map(s => s.adherence_percentage || 0));
    const avgElementsCovered = this.average(scriptAdherence.map(s => s.required_elements_mentioned || 0));
    const avgTotalElements = this.average(scriptAdherence.map(s => s.total_required_elements || 0));

    return {
      greeting_compliance_rate: Math.round(greetingRate),
      introduction_compliance_rate: Math.round(introRate),
      average_adherence_percentage: Math.round(avgAdherence),
      average_elements_covered: Math.round(avgElementsCovered * 10) / 10,
      average_total_elements: Math.round(avgTotalElements * 10) / 10,
      script_compliance_distribution: this.countValues(scriptAdherence.map(s => s.overall_script_compliance)),
      sample_size: scriptAdherence.length
    };
  }

  // Trend calculations
  calculateSentimentTrend(validResults) {
    // Simple trend calculation - could be enhanced with time series analysis
    const improvements = validResults.filter(r => {
      const sentiment = r.parsedKpis.customer_sentiment;
      return sentiment && (sentiment.final_sentiment > sentiment.initial_sentiment);
    });
    
    return validResults.length > 0 ? Math.round((improvements.length / validResults.length) * 100) : 0;
  }

  calculateResolutionTrend(validResults) {
    const resolved = validResults.filter(r => {
      const resolution = r.parsedKpis.resolution_quality;
      return resolution && resolution.first_contact_resolution;
    });
    
    return validResults.length > 0 ? Math.round((resolved.length / validResults.length) * 100) : 0;
  }

  // Industry benchmarks (static for now, could be made dynamic)
  getIndustryBenchmarks() {
    return {
      csat_prediction: 7.5,
      empathy_score: 75,
      fcr_rate: 85,
      effort_score: 3.5,
      flow_quality: 80
    };
  }

  // Helper methods
  average(values) {
    const filtered = values.filter(v => v !== null && v !== undefined && !isNaN(v));
    return filtered.length > 0 ? filtered.reduce((a, b) => a + b, 0) / filtered.length : 0;
  }

  percentage(booleanValues) {
    const filtered = booleanValues.filter(v => v !== null && v !== undefined);
    const trueCount = filtered.filter(v => v === true || v === 1 || v === '1' || v === 'true').length;
    return filtered.length > 0 ? (trueCount / filtered.length) * 100 : 0;
  }

  countValues(values) {
    const counts = {};
    values.filter(v => v !== null && v !== undefined).forEach(v => {
      counts[v] = (counts[v] || 0) + 1;
    });
    return counts;
  }
}

export default AdvancedKPIService;