// Enhanced webhook processor with campaign-specific KPI extraction
import { KPIExtractor } from './kpiExtractor.js';
import { LLMKpiExtractor } from './llmKpiExtractor.js';
import { TalkIntelKpiProcessor } from './talkintelKpiProcessor.js';

export class WebhookProcessor {
  static talkintelProcessor = null;

  // Initialize TalkIntel processor
  static initializeTalkIntel(apiKey) {
    if (!this.talkintelProcessor) {
      this.talkintelProcessor = new TalkIntelKpiProcessor(apiKey);
    }
  }

  // Process webhook using TalkIntel format and KPI analysis
  static async processWebhookWithTalkIntel(rawWebhook, campaignType = 'customer_service', campaignScript = null) {
    try {
      console.log('🎯 Processando webhook no formato TalkIntel...');
      
      // Validate TalkIntel format
      if (!rawWebhook.segments || !rawWebhook.text) {
        throw new Error('Formato TalkIntel inválido - segments e text são obrigatórios');
      }

      // Initialize TalkIntel processor if needed
      if (!this.talkintelProcessor) {
        const apiKey = process.env.SIPPULSE_API_KEY;
        if (!apiKey) {
          console.warn('⚠️ SIPPULSE_API_KEY não configurada - usando análise básica');
          return this.processBasicTalkIntel(rawWebhook);
        }
        this.initializeTalkIntel(apiKey);
      }

      // Process with full KPI analysis
      const kpiResults = await this.talkintelProcessor.processWebhook(rawWebhook, campaignType, campaignScript);
      
      // Convert to format compatible with existing system
      return this.convertTalkIntelToStandardFormat(rawWebhook, kpiResults);

    } catch (error) {
      console.error('❌ Erro no processamento TalkIntel:', error);
      // Fallback to basic processing
      return this.processBasicTalkIntel(rawWebhook);
    }
  }

  // Convert TalkIntel format to standard format for existing system compatibility
  static convertTalkIntelToStandardFormat(rawWebhook, kpiResults) {
    const callInfo = kpiResults.call_info;
    const kpis = kpiResults.customer_service_kpis;
    
    return {
      id: rawWebhook.id || `sippulse-${Date.now()}`,
      timestamp: new Date().toISOString(),
      call_type: 'customer-service',
      agent_id: this.extractAgentId(callInfo.agent_name),
      agent_name: callInfo.agent_name,
      agent_type: 'human',
      customer_id: this.extractCustomerId(callInfo.customer_name),
      customer_name: callInfo.customer_name,
      duration: callInfo.duration_seconds,
      
      // Map KPI results to existing format
      satisfaction_score: this.mapSentimentToSatisfaction(kpis.customer_sentiment_score.score),
      sentiment: this.mapSentimentLabel(kpis.customer_sentiment_score.score),
      resolved: kpis.first_contact_resolution.fcr_binary === 1,
      response_time: 0, // Not available in TalkIntel format
      call_quality: kpis.overall_quality_score / 20, // Convert 0-100 to 0-5
      cost: callInfo.total_cost,
      currency: callInfo.currency,
      
      // Enhanced fields with TalkIntel data
      transcription: rawWebhook.text,
      summary: callInfo.summary,
      key_insights: JSON.stringify([
        `Customer Sentiment: ${kpis.customer_sentiment_score.score.toFixed(2)}`,
        `Agent Empathy: ${kpis.agent_empathy_score.score}/100`,
        `FCR: ${kpis.first_contact_resolution.fcr_binary ? 'Sim' : 'Não'}`,
        `Overall Quality: ${kpis.overall_quality_score}/100`
      ]),
      
      // Store complete TalkIntel analysis
      sippulse_kpis: JSON.stringify(kpis),
      topics: JSON.stringify(callInfo.topics),
      tags: JSON.stringify([
        kpis.first_contact_resolution.status,
        kpis.conversation_flow_quality.quality_level,
        kpis.emotional_journey.journey_type
      ]),
      
      raw_data: JSON.stringify(rawWebhook)
    };
  }

  // Basic processing when TalkIntel AI is not available
  static processBasicTalkIntel(rawWebhook) {
    console.log('📊 Processando webhook TalkIntel com análise básica...');
    
    // Handle nested TalkIntel format (event -> payload -> transcription)
    let actualData = rawWebhook;
    if (rawWebhook.event === 'stt.transcription' && rawWebhook.payload?.transcription) {
      console.log('📦 PATH A: Extracting data from nested TalkIntel format');
      actualData = rawWebhook.payload.transcription;
    }
    
    // Handle different webhook formats
    const isLegacyTalkIntelFormat = actualData.segments && actualData.text;
    const isSimpleTestFormat = actualData.agent_name || actualData.kpi_data;
    
    if (isSimpleTestFormat) {
      // Handle simple test webhook format
      return {
        id: actualData.id || rawWebhook.id || `basic-sippulse-${Date.now()}`,
        timestamp: new Date(actualData.timestamp || rawWebhook.timestamp || new Date()).toISOString(),
        call_type: actualData.call_type || rawWebhook.call_type || 'customer-service',
        
        // Extract agent info
        participants: actualData.agent_name ? [actualData.agent_name] : [],
        agent_name: actualData.agent_name || 'Não identificado',
        customer_name: actualData.customer_name || 'Não identificado',
        
        duration: actualData.duration || 0,
        
        // Extract satisfaction score from kpi_data or sentiment_analysis
        satisfaction_score: actualData.kpi_data?.satisfaction_score || 
                          this.calculateSatisfactionScore(actualData.sentiment_analysis) || 50,
        
        // Extract sentiment
        sentiment: this.extractSentiment(actualData.sentiment_analysis) || 'neutral',
        
        // Extract resolution status
        resolved: actualData.kpi_data?.resolution_status === 'resolved' || 
                 this.inferResolution(actualData.summary, actualData.transcription),
        
        response_time: 0,
        call_quality: actualData.kpi_data?.call_quality || 3,
        cost: actualData.usage?.cost || 0,
        currency: actualData.usage?.currency || 'BRL',
        
        text: actualData.transcription || actualData.text || '',
        transcription: actualData.transcription || actualData.text || '',
        summary: actualData.summary || actualData.summarization || '',
        summarization: actualData.summary || actualData.summarization || '',
        
        // Extract topics from topics array or topic_detection
        topics: actualData.topics?.map(t => typeof t === 'string' ? t.toLowerCase() : t.label?.toLowerCase()) || actualData.topic_detection?.map(t => t.label?.toLowerCase()) || [],
        topic_detection: actualData.topic_detection || [],
        
        tags: ['basic_analysis', 'test_format'],
        
        key_insights: [
          `Duração: ${actualData.duration || 0}s`,
          `Satisfação: ${actualData.kpi_data?.satisfaction_score || 'N/A'}`,
          `Tópicos: ${(actualData.topics || []).length}`
        ],
        
        sippulse_kpis: actualData.kpi_data || {},
        raw_data: rawWebhook,
        
        // For compatibility with agent creation
        segments: actualData.segments || []
      };
    }
    
    // Handle legacy TalkIntel format
    console.log('📦 PATH C: Processing legacy TalkIntel format with segments and text');
    console.log('🔍 Available data fields:', Object.keys(actualData));
    const duration = this.calculateDuration(actualData.segments);
    const satisfaction = this.calculateBasicSatisfaction(actualData.sentiment_analysis);
    const sentiment = this.getBasicSentiment(actualData.sentiment_analysis);
    const topics = actualData.topic_detection?.map(t => t.label?.toLowerCase()) || [];
    
    return {
      id: actualData.id || rawWebhook.id || `basic-sippulse-${Date.now()}`,
      timestamp: new Date(actualData.timestamp || rawWebhook.timestamp || new Date()).toISOString(),
      call_type: 'customer-service',
      
      participants: this.extractParticipants(actualData.segments || []),
      agent_name: actualData.agent || this.extractAgentFromSegments(actualData.segments) || 'Não identificado',
      customer_name: actualData.client || this.extractCustomerFromSegments(actualData.segments) || 'Não identificado',
      
      duration: duration,
      
      // TalkIntel analysis
      satisfaction_score: satisfaction,
      sentiment: sentiment,
      resolved: actualData.solution || this.inferResolution(actualData.summarization, actualData.text),
      response_time: 0,
      call_quality: actualData.quality || 3,
      cost: actualData.usage?.cost || 0,
      currency: actualData.usage?.currency || 'BRL',
      
      text: actualData.text || '',
      transcription: actualData.text || '',
      summary: actualData.summarization || '',
      summarization: actualData.summarization || '',
      
      // Debug logging for missing fields
      _debug_text: !!actualData.text,
      _debug_summarization: !!actualData.summarization,
      _debug_agent: actualData.agent || 'not found',
      _debug_solution: actualData.solution,
      
      key_insights: [
        `Duração: ${duration}s`,
        `Satisfação: ${satisfaction}%`,
        `Qualidade: ${actualData.quality || 'N/A'}`,
        `Tópicos: ${topics.length}`
      ],
      
      topics: topics,
      topic_detection: actualData.topic_detection || [],
      tags: ['basic_analysis', 'sippulse_format'],
      
      sippulse_kpis: {
        quality_score: actualData.quality || 0,
        satisfaction_score: satisfaction,
        sentiment_score: sentiment,
        duration_seconds: duration,
        solution_provided: actualData.solution || false
      },
      
      raw_data: rawWebhook,
      segments: actualData.segments || []
    };
  }

  // Legacy method - kept for backward compatibility but now uses TalkIntel processing
  static convertWebhookFormat(rawWebhook) {
    console.log('⚠️ convertWebhookFormat is deprecated - use processWebhookWithTalkIntel instead');
    return this.processBasicTalkIntel(rawWebhook);
  }

  // Extract client and campaign info from webhook ID
  static extractIdComponents(webhookId) {
    try {
      // Assuming format: campaignId_clientId_timestamp or similar
      // Adjust this logic based on your actual ID format
      if (!webhookId || typeof webhookId !== 'string') {
        return {
          campaignId: null,
          clientId: null,
          timestamp: Date.now()
        };
      }

      const parts = webhookId.split('_');
      
      if (parts.length >= 2) {
        return {
          campaignId: parts[0],
          clientId: parts[1],
          timestamp: parts[2] ? parseInt(parts[2]) : Date.now()
        };
      }

      // If no clear pattern, use the full ID as clientId
      return {
        campaignId: null,
        clientId: webhookId,
        timestamp: Date.now()
      };
    } catch (error) {
      console.warn('Erro ao extrair componentes do ID:', error);
      return {
        campaignId: null,
        clientId: webhookId,
        timestamp: Date.now()
      };
    }
  }

  // Helper methods
  static extractAgentId(agentName) {
    if (!agentName) return 'unknown';
    return agentName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  static extractCustomerId(customerName) {
    if (!customerName) return 'unknown';
    return customerName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  static mapSentimentToSatisfaction(sentimentScore) {
    // Convert sentiment (-1 to 1) to satisfaction (1 to 5)
    const normalized = (sentimentScore + 1) / 2; // 0 to 1
    return Math.max(1, Math.min(5, Math.round(normalized * 4 + 1)));
  }

  static mapSentimentLabel(sentimentScore) {
    if (sentimentScore > 0.2) return 'positive';
    if (sentimentScore < -0.2) return 'negative';
    return 'neutral';
  }

  static calculateDuration(segments) {
    if (!segments || segments.length === 0) return 0;
    const lastSegment = segments[segments.length - 1];
    // Handle both TalkIntel format (end_time) and other formats
    return Math.round(lastSegment.end_time || lastSegment.end || 0);
  }

  static calculateBasicSatisfaction(sentimentAnalysis) {
    console.log('🔍 DEBUG satisfaction calculation:', sentimentAnalysis?.length, 'items');
    if (!sentimentAnalysis || sentimentAnalysis.length === 0) return 50; // Return 0-100 scale
    
    // Handle TalkIntel format where sentiment_analysis has 'score' field (0-1 scale)
    const scores = sentimentAnalysis.map(item => {
      if (typeof item.score === 'number') {
        console.log('📊 Using score:', item.score);
        // Convert 0-1 scale to 0-100 scale
        return item.score * 100;
      }
      if (typeof item.sentiment_score === 'number') {
        console.log('📊 Using sentiment_score:', item.sentiment_score);
        // Convert -1 to +1 scale to 0-100 scale
        return ((item.sentiment_score + 1) / 2) * 100;
      }
      console.log('⚠️ No score found in item:', item.label || 'unknown');
      return 50; // Default neutral
    });
    
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return Math.round(Math.max(0, Math.min(100, avgScore)));
  }

  static getBasicSentiment(sentimentAnalysis) {
    if (!sentimentAnalysis || sentimentAnalysis.length === 0) return 'neutral';
    
    // Handle TalkIntel format with 'score' field (0-1 scale) or sentiment_score (-1 to +1)
    const scores = sentimentAnalysis.map(item => {
      if (typeof item.score === 'number') {
        return item.score; // Already 0-1 scale
      }
      if (typeof item.sentiment_score === 'number') {
        return (item.sentiment_score + 1) / 2; // Convert -1,+1 to 0-1 scale
      }
      return 0.5; // Default neutral
    });
    
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    if (avgScore > 0.6) return 'positive';
    if (avgScore < 0.4) return 'negative';
    return 'neutral';
  }

  static inferResolution(summary, text) {
    if (!summary && !text) return false;
    
    const content = (summary || '') + ' ' + (text || '');
    const resolvedIndicators = [
      'resolvido', 'solucionado', 'concluído', 'finalizado',
      'problema resolvido', 'questão resolvida', 'tudo certo',
      'funcionou', 'está funcionando'
    ];
    
    return resolvedIndicators.some(indicator => 
      content.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  // Updated conversion with ID component extraction
  static convertTalkIntelToStandardFormatWithId(rawWebhook, kpiResults) {
    const callInfo = kpiResults.call_info;
    const kpis = kpiResults.customer_service_kpis;
    const idComponents = this.extractIdComponents(rawWebhook.id);
    
    return {
      id: rawWebhook.id || `sippulse-${Date.now()}`,
      timestamp: new Date().toISOString(),
      call_type: 'customer-service',
      
      // Use extracted information from ID
      campaign_id: idComponents.campaignId,
      customer_id: idComponents.clientId,
      
      agent_id: this.extractAgentId(callInfo.agent_name),
      agent_name: callInfo.agent_name,
      agent_type: 'human',
      customer_name: callInfo.customer_name,
      duration: callInfo.duration_seconds,
      
      // Map KPI results to existing format
      satisfaction_score: this.mapSentimentToSatisfaction(kpis.customer_sentiment_score.score),
      sentiment: this.mapSentimentLabel(kpis.customer_sentiment_score.score),
      resolved: kpis.first_contact_resolution.fcr_binary === 1,
      response_time: 0,
      call_quality: kpis.overall_quality_score / 20, // Convert 0-100 to 0-5
      cost: callInfo.total_cost,
      currency: callInfo.currency,
      
      // Enhanced fields with TalkIntel data
      transcription: rawWebhook.text,
      summary: callInfo.summary,
      key_insights: JSON.stringify([
        `Customer Sentiment: ${kpis.customer_sentiment_score.score.toFixed(2)}`,
        `Agent Empathy: ${kpis.agent_empathy_score.score}/100`,
        `FCR: ${kpis.first_contact_resolution.fcr_binary ? 'Sim' : 'Não'}`,
        `Overall Quality: ${kpis.overall_quality_score}/100`
      ]),
      
      // Store complete TalkIntel analysis
      sippulse_kpis: JSON.stringify(kpis),
      topics: JSON.stringify(callInfo.topics),
      tags: JSON.stringify([
        kpis.first_contact_resolution.status,
        kpis.conversation_flow_quality.quality_level,
        kpis.emotional_journey.journey_type,
        `campaign_${idComponents.campaignId}`,
        `client_${idComponents.clientId}`
      ]),
      
      raw_data: JSON.stringify(rawWebhook)
    };
  }

  // Main processing method - use this instead of convertWebhookFormat
  static async processWebhookWithKPIs(rawWebhook, campaignType = 'customer_service', campaignScript = null, useTalkIntelAI = true) {
    if (useTalkIntelAI) {
      return await this.processWebhookWithTalkIntel(rawWebhook, campaignType, campaignScript);
    } else {
      return this.processBasicTalkIntel(rawWebhook);
    }
  }

  static extractTopics(topicDetection) {
    if (!Array.isArray(topicDetection)) {
      return [];
    }

    return topicDetection
      .filter(topic => topic.confidence && topic.confidence > 0.5)
      .map(topic => topic.label)
      .slice(0, 10); // limit to top 10 topics
  }

  // Determine agent type from segments
  static determineAgentType(segments) {
    if (!Array.isArray(segments) || segments.length === 0) {
      return 'human';
    }

    // Simple heuristic: if there are very regular patterns or specific keywords
    // that suggest automated responses, classify as AI
    const aiIndicators = ['assistente virtual', 'bot', 'sistema automatizado'];
    const text = segments.map(s => s.text || '').join(' ').toLowerCase();
    
    const hasAiIndicators = aiIndicators.some(indicator => text.includes(indicator));
    return hasAiIndicators ? 'ai' : 'human';
  }

  // Calculate satisfaction score from sentiment analysis
  static calculateSatisfactionScore(sentimentAnalysis) {
    if (!sentimentAnalysis || !Array.isArray(sentimentAnalysis)) {
      return 50; // Default neutral satisfaction
    }

    // Average sentiment scores and convert to 0-100 scale
    const sentiments = sentimentAnalysis
      .filter(s => s.sentiment_score !== undefined)
      .map(s => s.sentiment_score);

    if (sentiments.length === 0) {
      return 50;
    }

    const avgSentiment = sentiments.reduce((sum, score) => sum + score, 0) / sentiments.length;
    // Convert from -1 to +1 range to 0-100 range
    return Math.round(((avgSentiment + 1) / 2) * 100);
  }

  // Extract participants from segments
  static extractParticipants(segments) {
    if (!Array.isArray(segments)) return [];
    
    const speakers = new Set();
    segments.forEach(segment => {
      if (segment.speaker) {
        speakers.add(segment.speaker);
      }
    });
    
    return Array.from(speakers);
  }
  
  // Extract agent name from segments
  static extractAgentFromSegments(segments) {
    if (!Array.isArray(segments) || segments.length === 0) return null;
    
    // Look for the first speaker that might be an agent
    const firstSpeaker = segments.find(s => s.speaker && s.speaker !== 'NOT IDENTF');
    return firstSpeaker?.speaker || null;
  }
  
  // Extract customer name from segments
  static extractCustomerFromSegments(segments) {
    if (!Array.isArray(segments) || segments.length === 0) return null;
    
    // Look for the second unique speaker
    const speakers = this.extractParticipants(segments);
    return speakers.length > 1 ? speakers[1] : null;
  }

  // Extract overall sentiment from sentiment analysis
  static extractSentiment(sentimentAnalysis) {
    if (!sentimentAnalysis || !Array.isArray(sentimentAnalysis)) {
      return 'neutral';
    }

    // Get the most recent sentiment or aggregate
    const recentSentiments = sentimentAnalysis
      .filter(s => s.sentiment)
      .map(s => s.sentiment.toLowerCase());

    if (recentSentiments.length === 0) {
      return 'neutral';
    }

    // Count sentiment occurrences
    const sentimentCounts = recentSentiments.reduce((counts, sentiment) => {
      counts[sentiment] = (counts[sentiment] || 0) + 1;
      return counts;
    }, {});

    // Return the most frequent sentiment
    const mostFrequent = Object.entries(sentimentCounts)
      .sort(([,a], [,b]) => b - a)[0];

    return mostFrequent ? mostFrequent[0] : 'neutral';
  }

  // Extract participants from segments
  static extractParticipants(segments) {
    if (!Array.isArray(segments)) {
      return [];
    }

    const speakers = [...new Set(segments.map(s => s.speaker).filter(Boolean))];
    return speakers;
  }

  // Extract agent name (first speaker usually)
  static extractAgentName(segments) {
    if (!Array.isArray(segments) || segments.length === 0) {
      return null;
    }

    // Look for speaker identification in the first few segments
    for (let i = 0; i < Math.min(3, segments.length); i++) {
      const text = segments[i].text || '';
      const speaker = segments[i].speaker || '';
      
      // Look for patterns like "Olá, meu nome é João"
      const namePattern = /(?:meu nome é|eu sou|me chamo)\s+([A-Za-zÀ-ÿ\s]+)/i;
      const match = text.match(namePattern);
      
      if (match) {
        return match[1].trim();
      }
      
      // If speaker has a name format
      if (speaker && speaker !== 'speaker_0' && speaker !== 'speaker_1') {
        return speaker;
      }
    }

    return null;
  }

  // Extract customer name
  static extractCustomerName(segments) {
    if (!Array.isArray(segments) || segments.length === 0) {
      return null;
    }

    // Look for customer identification in middle segments
    for (const segment of segments) {
      const text = segment.text || '';
      
      // Look for patterns where agent asks for name
      const customerNamePattern = /(?:seu nome é|você é|senhor|senhora)\s+([A-Za-zÀ-ÿ\s]+)/i;
      const match = text.match(customerNamePattern);
      
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  // Process webhook with campaign-specific KPI extraction
  static async processWebhookWithKPIs(webhook, campaignType = 'customer_service', enableLLM = false) {
    const converted = this.convertWebhookFormat(webhook);
    
    // Extract base data
    const baseData = this.processWebhook(webhook);
    
    // Extract campaign-specific KPIs using rule-based extraction
    const ruleBasedKPIs = KPIExtractor.extractKPIs(converted, campaignType);
    
    // Optional: Extract KPIs using LLM structured output
    let llmKPIs = null;
    let llmPrompt = null;
    
    if (enableLLM && converted.text) {
      try {
        llmPrompt = LLMKpiExtractor.generateExtractionPrompt(
          converted.text, 
          campaignType, 
          {
            duration: converted.duration,
            participants: converted.participants,
            call_type: converted.call_type
          }
        );
        
        // Note: In a real implementation, you would send llmPrompt to your LLM service
        // For now, we'll store the prompt for external processing
        console.log(`📋 Generated LLM extraction prompt for ${campaignType} campaign`);
      } catch (error) {
        console.error('LLM prompt generation error:', error);
      }
    }
    
    return {
      ...baseData,
      campaign_type: campaignType,
      kpis: {
        rule_based: ruleBasedKPIs,
        llm_based: llmKPIs,
        extraction_metadata: {
          campaign_type: campaignType,
          rule_based_extracted: true,
          llm_based_extracted: enableLLM && llmKPIs !== null,
          extracted_at: new Date().toISOString()
        }
      },
      llm_extraction_prompt: enableLLM ? llmPrompt : null
    };
  }

  // Process complete webhook (legacy compatibility)
  static processWebhook(webhook) {
    const converted = this.convertWebhookFormat(webhook);
    
    return {
      id: converted.id,
      timestamp: converted.timestamp,
      duration: converted.duration,
      callType: converted.call_type,
      agentId: converted.participants?.[0] || 'unknown',
      agentName: converted.agent_name || 'Unknown Agent',
      agentType: this.determineAgentType(converted.segments),
      customerSatisfaction: this.calculateSatisfactionScore(converted.sentiment_analysis),
      sentiment: this.extractSentiment(converted.sentiment_analysis),
      resolutionRate: converted.resolution ? 100 : 0,
      responseTime: 0, // Calculate from segments if needed
      callQuality: 4.0, // Default value
      tags: [],
      summary: converted.summarization,
      keyInsights: [],
      cost: converted.usage?.cost || 0,
      currency: converted.usage?.currency || 'BRL',
      topics: this.extractTopics(converted.topic_detection),
      resolved: Boolean(converted.resolution),
      transcription: converted.text,
      segments: converted.segments,
      sentimentAnalysis: converted.sentiment_analysis
    };
  }
}