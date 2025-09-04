import fetch from 'node-fetch';
import encryptionService from './encryptionService.js';
import dotenv from 'dotenv';

dotenv.config();

class ScriptAdherenceService {
  constructor(database) {
    this.db = database;
  }

  /**
   * Calculate script adherence for a specific webhook
   * @param {string} webhookId - The webhook ID to analyze
   * @returns {object} - Adherence score and details
   */
  async calculateScriptAdherence(webhookId) {
    try {
      console.log(`📊 Calculating script adherence for webhook ${webhookId}`);

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

      // Check if script adherence is enabled and company has premium
      if (!webhook.script_adherence_enabled) {
        console.log('⚠️ Script adherence not enabled for this campaign');
        return null;
      }

      if (webhook.subscription_tier !== 'premium' && webhook.subscription_tier !== 'enterprise') {
        console.log('⚠️ Script adherence requires premium or enterprise subscription');
        return null;
      }

      // Check if campaign type supports script adherence
      const supportedTypes = ['sales', 'debt_collection', 'customer_service'];
      if (!supportedTypes.includes(webhook.campaign_type)) {
        console.log(`⚠️ Script adherence not supported for campaign type: ${webhook.campaign_type}`);
        return null;
      }

      // Check if LLM is configured
      if (!webhook.llm_api_key_encrypted || !webhook.encryption_iv) {
        console.log('⚠️ LLM API key not configured for this company');
        return null;
      }

      // Extract transcription from raw data
      const transcription = this.extractTranscription(webhook.raw_data);
      if (!transcription) {
        console.log('⚠️ No transcription found in webhook data');
        return null;
      }

      // Decrypt API key
      const apiKey = encryptionService.decryptApiKey(
        webhook.llm_api_key_encrypted,
        webhook.encryption_iv,
        webhook.company_id
      );

      // Prepare the prompt based on campaign type
      const prompt = this.buildAdherencePrompt(
        webhook.campaign_type,
        webhook.call_script,
        webhook.script_required_elements,
        transcription
      );

      // Call LLM API
      const adherenceResult = await this.callLLMAPI(
        webhook.llm_api_url || process.env.DEFAULT_LLM_API_URL,
        webhook.llm_model || process.env.DEFAULT_LLM_MODEL,
        apiKey,
        prompt
      );

      // Save results to database
      await this.saveAdherenceResults(webhookId, adherenceResult);

      // Update agent metrics if applicable
      if (webhook.agent_id) {
        await this.updateAgentAdherenceMetrics(webhook.company_id, webhook.agent_id);
      }

      return adherenceResult;
    } catch (error) {
      console.error('Error calculating script adherence:', error);
      throw error;
    }
  }

  /**
   * Extract transcription from webhook raw data
   */
  extractTranscription(rawData) {
    try {
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      
      // Try different paths where transcription might be
      if (data.payload?.transcription?.text) {
        return data.payload.transcription.text;
      }
      if (data.payload?.transcription) {
        return data.payload.transcription;
      }
      if (data.transcription) {
        return data.transcription;
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting transcription:', error);
      return null;
    }
  }

  /**
   * Build adherence prompt based on campaign type
   */
  buildAdherencePrompt(campaignType, callScript, requiredElements, transcription) {
    const basePrompt = `Analyze the following call transcription for adherence to the provided script and requirements.

CAMPAIGN TYPE: ${campaignType}

EXPECTED SCRIPT:
${callScript || 'No specific script provided'}

REQUIRED ELEMENTS:
${JSON.stringify(requiredElements || [], null, 2)}

TRANSCRIPTION:
${transcription}

Please analyze and return a JSON response with the following structure:
{
  "adherence_score": <number between 0-100>,
  "missing_elements": [<list of missing required elements>],
  "deviations": [
    {
      "type": "<deviation type>",
      "description": "<what deviated from script>",
      "impact": "<low|medium|high>"
    }
  ],
  "strengths": [<list of things done well>],
  "recommendations": [<list of improvement suggestions>],`;

    // Add campaign-specific analysis
    const campaignSpecific = {
      'debt_collection': `
  "compliance_issues": [<any FDCPA or regulatory compliance issues>],
  "mini_miranda_present": <true|false>,
  "payment_discussion": <true|false>,`,
      
      'sales': `
  "methodology_adherence": {
    "discovery_questions_asked": <number>,
    "pain_points_identified": [<list>],
    "value_propositions_presented": <number>,
    "next_steps_defined": <true|false>
  },
  "talk_listen_ratio": "<estimated ratio>",`,
      
      'customer_service': `
  "empathy_demonstrated": <true|false>,
  "issue_resolved": <true|false>,
  "first_contact_resolution": <true|false>,
  "customer_satisfaction_indicators": [<list of positive/negative indicators>],`
    };

    const specificAnalysis = campaignSpecific[campaignType] || '';
    
    return basePrompt + specificAnalysis + `
  "overall_assessment": "<brief qualitative assessment>"
}

Return ONLY valid JSON, no additional text.`;
  }

  /**
   * Call LLM API (OpenAI-compatible)
   */
  async callLLMAPI(apiUrl, model, apiKey, prompt) {
    try {
      const response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a call center quality analyst. Analyze call transcriptions for script adherence and provide detailed, actionable feedback in JSON format.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3, // Lower temperature for more consistent analysis
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${error}`);
      }

      const result = await response.json();
      const content = result.choices[0].message.content;
      
      // Parse JSON response
      try {
        return JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse LLM response as JSON:', content);
        // Attempt to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('LLM response is not valid JSON');
      }
    } catch (error) {
      console.error('LLM API call failed:', error);
      throw error;
    }
  }

  /**
   * Save adherence results to database
   */
  async saveAdherenceResults(webhookId, adherenceResult) {
    try {
      await this.db.query(`
        UPDATE webhooks_normalized 
        SET 
          script_adherence_score = ?,
          script_adherence_details = ?,
          script_adherence_calculated_at = NOW()
        WHERE id = ?
      `, [
        adherenceResult.adherence_score,
        JSON.stringify(adherenceResult),
        webhookId
      ]);

      console.log(`✅ Script adherence saved for webhook ${webhookId}: ${adherenceResult.adherence_score}%`);
    } catch (error) {
      console.error('Error saving adherence results:', error);
      throw error;
    }
  }

  /**
   * Update agent's average script adherence metrics
   */
  async updateAgentAdherenceMetrics(companyId, agentId) {
    try {
      // Calculate average adherence for this agent
      const [result] = await this.db.query(`
        SELECT AVG(script_adherence_score) as avg_adherence
        FROM webhooks_normalized
        WHERE company_id = ? AND agent_id = ? AND script_adherence_score IS NOT NULL
      `, [companyId, agentId]);

      const avgAdherence = result?.avg_adherence || 0;

      // Update agent metrics
      await this.db.query(`
        UPDATE agent_metrics
        SET average_script_adherence = ?
        WHERE company_id = ? AND agent_id = ?
      `, [avgAdherence, companyId, agentId]);

      console.log(`✅ Updated agent ${agentId} average adherence: ${avgAdherence.toFixed(2)}%`);
    } catch (error) {
      console.error('Error updating agent adherence metrics:', error);
    }
  }

  /**
   * Test LLM connection with a simple prompt
   */
  async testLLMConnection(companyId) {
    try {
      // Get company LLM configuration
      const [company] = await this.db.query(`
        SELECT 
          llm_api_key_encrypted,
          llm_api_url,
          llm_model,
          encryption_iv,
          id
        FROM companies
        WHERE id = ?
      `, [companyId]);

      if (!company.llm_api_key_encrypted) {
        return {
          success: false,
          error: 'LLM API key not configured'
        };
      }

      // Decrypt API key
      const apiKey = encryptionService.decryptApiKey(
        company.llm_api_key_encrypted,
        company.encryption_iv,
        company.id
      );

      // Test with simple prompt
      const testPrompt = 'Return a JSON object with a single field "status" set to "ok"';
      const result = await this.callLLMAPI(
        company.llm_api_url || process.env.DEFAULT_LLM_API_URL,
        company.llm_model || process.env.DEFAULT_LLM_MODEL,
        apiKey,
        testPrompt
      );

      return {
        success: true,
        message: 'LLM connection successful',
        model: company.llm_model || process.env.DEFAULT_LLM_MODEL
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default ScriptAdherenceService;