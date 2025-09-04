/**
 * SipPulse KPI Processor - Customer Service Dashboard
 * Processa webhooks no formato SipPulse com análises avançadas de KPIs
 */

import fetch from 'node-fetch';

class SipPulseKpiProcessor {
  constructor(apiKey, apiBaseUrl = 'https://api.sippulse.ai') {
    this.apiKey = apiKey;
    this.apiBaseUrl = apiBaseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
  }

  /**
   * Processa webhook no formato SipPulse e extrai KPIs de Customer Service
   */
  async processWebhook(webhookData, campaignType = 'customer_service', campaignScript = null) {
    try {
      console.log('🎯 Processando webhook SipPulse para Customer Service KPIs...');
      
      // Extrair informações básicas
      const basicInfo = this.extractBasicInfo(webhookData);
      
      // Processar transcrição para análises
      const transcriptionAnalysis = this.processTranscription(webhookData);
      
      // Calcular KPIs principais usando SipPulse AI
      const [
        customerSentiment,
        agentEmpathy,
        firstContactResolution,
        conversationFlow,
        emotionalJourney,
        scriptAdherence
      ] = await Promise.all([
        this.calculateCustomerSentiment(transcriptionAnalysis),
        this.calculateAgentEmpathy(transcriptionAnalysis),
        this.calculateFirstContactResolution(transcriptionAnalysis),
        this.analyzeConversationFlow(webhookData.segments),
        this.mapEmotionalJourney(webhookData.sentiment_analysis),
        this.calculateScriptAdherence(transcriptionAnalysis, campaignScript)
      ]);

      // Compilar resultado final
      const kpiResults = {
        call_info: basicInfo,
        customer_service_kpis: {
          customer_sentiment_score: customerSentiment,
          agent_empathy_score: agentEmpathy,
          first_contact_resolution: firstContactResolution,
          conversation_flow_quality: conversationFlow,
          emotional_journey: emotionalJourney,
          script_adherence: scriptAdherence,
          overall_quality_score: this.calculateOverallQuality({
            customerSentiment: customerSentiment.score,
            agentEmpathy: agentEmpathy.score,
            fcr: firstContactResolution.fcr_binary,
            scriptAdherence: scriptAdherence.adherence_score
          })
        },
        processing_metadata: {
          processed_at: new Date().toISOString(),
          processor_version: '1.0.0',
          confidence_level: this.calculateOverallConfidence([
            customerSentiment.confidence,
            agentEmpathy.confidence,
            firstContactResolution.confidence,
            scriptAdherence.confidence
          ])
        }
      };

      console.log(`✅ KPIs processados com sucesso - Score geral: ${kpiResults.customer_service_kpis.overall_quality_score}`);
      return kpiResults;

    } catch (error) {
      console.error('❌ Erro no processamento de KPIs:', error);
      throw error;
    }
  }

  /**
   * Extrai informações básicas do webhook
   */
  extractBasicInfo(webhookData) {
    return {
      agent_name: webhookData.agent || 'Não identificado',
      customer_name: webhookData.client || 'Não identificado',
      duration_seconds: this.calculateCallDuration(webhookData.segments),
      total_cost: webhookData.usage?.cost || 0,
      currency: webhookData.usage?.currency || 'BRL',
      summary: webhookData.summarization || '',
      topics: webhookData.topic_detection?.map(topic => topic.label) || []
    };
  }

  /**
   * Processa transcrição separando falas do agente e cliente
   */
  processTranscription(webhookData) {
    const segments = webhookData.segments || [];
    const agentName = webhookData.agent;
    
    let agentSegments = [];
    let customerSegments = [];
    let allText = webhookData.text || '';

    segments.forEach(segment => {
      // Identificar se é agente ou cliente
      if (this.isAgentSpeaker(segment.speaker, agentName)) {
        agentSegments.push(segment);
      } else if (this.isCustomerSpeaker(segment.speaker)) {
        customerSegments.push(segment);
      }
    });

    return {
      full_transcript: allText,
      agent_transcript: agentSegments.map(s => s.text).join(' '),
      customer_transcript: customerSegments.map(s => s.text).join(' '),
      segments: segments,
      agent_segments: agentSegments,
      customer_segments: customerSegments
    };
  }

  /**
   * Identifica se o speaker é o agente
   */
  isAgentSpeaker(speaker, agentName) {
    if (!speaker) return false;
    
    // Heurísticas para identificar agente
    const agentIndicators = ['SPEAKER_00', 'SPEAKER_0']; // Normalmente primeiro a falar
    
    if (agentName && speaker.toLowerCase().includes(agentName.toLowerCase())) {
      return true;
    }
    
    return agentIndicators.includes(speaker);
  }

  /**
   * Identifica se o speaker é o cliente
   */
  isCustomerSpeaker(speaker) {
    if (!speaker || speaker === 'NOT IDENTF') return false;
    
    const customerIndicators = ['SPEAKER_01', 'SPEAKER_1', 'CUSTOMER', 'CLIENT'];
    return customerIndicators.some(indicator => speaker.includes(indicator));
  }

  /**
   * Calcula Customer Sentiment Score usando SipPulse AI
   */
  async calculateCustomerSentiment(transcriptionAnalysis) {
    const prompt = {
      system: "Você é um especialista em análise de sentimento do cliente em contact centers. Analise o sentimento do cliente e forneça saída estruturada.",
      prompt: `Analise o sentimento do cliente nesta transcrição de atendimento. Foque APENAS no estado emocional e tom do cliente.

Transcrição do Cliente:
${transcriptionAnalysis.customer_transcript}

Contexto da chamada:
${transcriptionAnalysis.full_transcript}

Forneça análise no formato JSON:`,
      response_format: {
        overall_sentiment_score: "float entre -1.0 e +1.0",
        sentiment_progression: [
          {
            segment: "abertura (0-20%)",
            score: "float",
            key_phrases: ["frases do cliente que indicam sentimento"]
          },
          {
            segment: "desenvolvimento (20-80%)",
            score: "float",
            key_phrases: ["frases do cliente"]
          },
          {
            segment: "fechamento (80-100%)",
            score: "float", 
            key_phrases: ["frases do cliente"]
          }
        ],
        sentiment_drivers: {
          positive_indicators: ["indicadores específicos"],
          negative_indicators: ["indicadores específicos"]
        },
        emotional_journey: "descrição de como o sentimento mudou",
        csat_prediction: {
          predicted_score: "1-5",
          confidence: "float 0-1"
        },
        confidence_level: "float 0-1"
      }
    };

    try {
      const response = await this.callSipPulseAI(prompt);
      
      return {
        score: response.overall_sentiment_score,
        progression: response.sentiment_progression,
        drivers: response.sentiment_drivers,
        journey: response.emotional_journey,
        csat_prediction: response.csat_prediction,
        confidence: response.confidence_level
      };
    } catch (error) {
      console.error('Erro no cálculo de Customer Sentiment:', error);
      return this.getFallbackSentiment();
    }
  }

  /**
   * Calcula Agent Empathy Score usando SipPulse AI
   */
  async calculateAgentEmpathy(transcriptionAnalysis) {
    const prompt = {
      system: "Você é um especialista em análise de empatia de agentes em contact centers. Analise a empatia demonstrada pelo agente.",
      prompt: `Analise o nível de empatia do agente nesta transcrição. Foque APENAS no comportamento e linguagem do agente.

Transcrição do Agente:
${transcriptionAnalysis.agent_transcript}

Contexto completo:
${transcriptionAnalysis.full_transcript}

Forneça análise no formato JSON:`,
      response_format: {
        empathy_score: "número inteiro de 0 a 100",
        empathy_indicators: {
          acknowledgment_phrases: ["frases onde o agente reconhece sentimentos"],
          validation_statements: ["declarações que validam a experiência do cliente"],
          personalized_responses: ["respostas adaptadas à situação específica"],
          emotional_language: ["uso de linguagem empática"]
        },
        empathy_gaps: {
          missed_opportunities: ["momentos onde empatia deveria ter sido demonstrada"],
          robotic_responses: ["respostas muito mecânicas"],
          dismissive_language: ["linguagem que minimiza preocupações"]
        },
        empathy_progression: [
          {
            segment: "abertura",
            score: "0-100",
            examples: ["exemplos específicos"]
          },
          {
            segment: "desenvolvimento",
            score: "0-100", 
            examples: ["exemplos específicos"]
          },
          {
            segment: "fechamento",
            score: "0-100",
            examples: ["exemplos específicos"]
          }
        ],
        coaching_recommendations: ["recomendações específicas"],
        confidence_level: "float 0-1"
      }
    };

    try {
      const response = await this.callSipPulseAI(prompt);
      
      return {
        score: response.empathy_score,
        indicators: response.empathy_indicators,
        gaps: response.empathy_gaps,
        progression: response.empathy_progression,
        coaching_recommendations: response.coaching_recommendations,
        confidence: response.confidence_level
      };
    } catch (error) {
      console.error('Erro no cálculo de Agent Empathy:', error);
      return this.getFallbackEmpathy();
    }
  }

  /**
   * Calcula First Contact Resolution usando SipPulse AI
   */
  async calculateFirstContactResolution(transcriptionAnalysis) {
    const prompt = {
      system: "Você é um especialista em análise de resolução de problemas em contact centers. Determine se houve First Contact Resolution (FCR).",
      prompt: `Analise esta transcrição e determine se o problema do cliente foi completamente resolvido na primeira chamada.

Transcrição completa:
${transcriptionAnalysis.full_transcript}

FCR = O problema principal foi COMPLETAMENTE resolvido nesta chamada, sem necessidade de contato adicional.

Forneça análise no formato JSON:`,
      response_format: {
        fcr_score: "float entre 0.0 e 1.0",
        fcr_binary: "1 se resolvido, 0 se não resolvido",
        resolution_status: "resolved|partially_resolved|unresolved|transferred|escalated",
        problem_identification: {
          main_issue: "descrição do problema principal",
          issue_complexity: "simple|moderate|complex"
        },
        resolution_indicators: {
          solution_provided: "true/false",
          customer_confirmation: ["frases de confirmação do cliente"],
          agent_confirmation: ["frases de confirmação do agente"], 
          no_followup_needed: "true/false"
        },
        unresolved_indicators: {
          pending_actions: ["ações pendentes"],
          customer_concerns: ["preocupações não endereçadas"],
          promised_callbacks: ["callbacks prometidos"],
          transferred_escalated: "true/false"
        },
        confidence_level: "float 0-1"
      }
    };

    try {
      const response = await this.callSipPulseAI(prompt);
      
      return {
        fcr_score: response.fcr_score,
        fcr_binary: response.fcr_binary,
        status: response.resolution_status,
        problem: response.problem_identification,
        resolved_indicators: response.resolution_indicators,
        unresolved_indicators: response.unresolved_indicators,
        confidence: response.confidence_level
      };
    } catch (error) {
      console.error('Erro no cálculo de FCR:', error);
      return this.getFallbackFCR();
    }
  }

  /**
   * Analisa qualidade do fluxo de conversa
   */
  analyzeConversationFlow(segments) {
    const totalSegments = segments.length;
    const speakers = new Set(segments.map(s => s.speaker));
    
    // Calcular interruptions
    let interruptions = 0;
    let speakerSwitches = 0;
    let previousSpeaker = null;
    
    segments.forEach(segment => {
      if (previousSpeaker && previousSpeaker !== segment.speaker) {
        speakerSwitches++;
      }
      previousSpeaker = segment.speaker;
    });

    // Calcular períodos de silêncio
    let silencePeriods = 0;
    for (let i = 1; i < segments.length; i++) {
      const gap = segments[i].initial_time - segments[i-1].end_time;
      if (gap > 3.0) { // Mais de 3 segundos de silêncio
        silencePeriods++;
      }
    }

    const flowScore = this.calculateFlowScore({
      totalSegments,
      speakerSwitches,
      interruptions,
      silencePeriods
    });

    return {
      flow_score: flowScore,
      metrics: {
        total_segments: totalSegments,
        speaker_switches: speakerSwitches,
        interruptions: interruptions,
        silence_periods: silencePeriods,
        unique_speakers: speakers.size
      },
      quality_level: this.getFlowQualityLevel(flowScore)
    };
  }

  /**
   * Mapeia jornada emocional do cliente
   */
  mapEmotionalJourney(sentimentAnalysis) {
    if (!sentimentAnalysis || !Array.isArray(sentimentAnalysis)) {
      return {
        journey_type: 'unknown',
        sentiment_changes: [],
        dominant_emotion: 'neutral'
      };
    }

    const emotions = sentimentAnalysis.map(item => ({
      emotion: item.label,
      score: item.score,
      timestamp: item.timestamp
    }));

    // Determinar tipo de jornada
    const journeyType = this.determineJourneyType(emotions);
    const dominantEmotion = this.findDominantEmotion(emotions);

    return {
      journey_type: journeyType,
      sentiment_changes: emotions,
      dominant_emotion: dominantEmotion,
      emotional_volatility: this.calculateEmotionalVolatility(emotions)
    };
  }

  /**
   * Chama a API SipPulse AI
   */
  async callSipPulseAI(prompt) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.prompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`SipPulse AI API error: ${response.status}`);
      }

      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
      
    } catch (error) {
      console.error('Erro na chamada SipPulse AI:', error);
      throw error;
    }
  }

  /**
   * Calcula Script Adherence usando SipPulse AI
   */
  async calculateScriptAdherence(transcriptionAnalysis, campaignScript) {
    if (!campaignScript || campaignScript.trim() === '') {
      return {
        adherence_score: null,
        reason: 'No script provided for campaign',
        script_coverage: 0,
        deviations: [],
        key_points_covered: [],
        key_points_missed: []
      };
    }

    try {
      const prompt = {
        system: "Você é um especialista em análise de aderência a scripts de contact centers. Analise o quanto o agente seguiu o script fornecido.",
        prompt: `Analise a aderência ao script nesta transcrição. Compare APENAS o comportamento do agente com o script fornecido.

Script da Campanha:
${campaignScript}

Transcrição do Agente:
${transcriptionAnalysis.agent_transcript}

Contexto completo da conversa:
${transcriptionAnalysis.full_transcript}

Forneça análise no formato JSON:`,
        response_format: {
          adherence_score: "porcentagem de 0 a 100 de aderência ao script",
          script_coverage: "porcentagem de 0 a 100 do script que foi coberto",
          key_points_covered: ["pontos essenciais do script que foram abordados"],
          key_points_missed: ["pontos essenciais do script que foram perdidos"],
          script_deviations: [
            {
              type: "tipo de desvio (omissão, adição, modificação)",
              description: "descrição do desvio",
              impact: "impacto (baixo, médio, alto)",
              agent_said: "o que o agente disse",
              should_have_said: "o que deveria ter dito conforme script"
            }
          ],
          positive_adaptations: ["adaptações positivas que melhoraram o script"],
          script_effectiveness: {
            appropriate: "se o script era apropriado para a situação",
            suggestions: ["sugestões de melhoria do script"]
          },
          adherence_quality: "qualidade da aderência (excelente, boa, regular, ruim)",
          confidence_level: "nível de confiança da análise (0-100)"
        }
      };

      const response = await this.callSipPulseAI(prompt);
      
      return {
        adherence_score: response.adherence_score,
        script_coverage: response.script_coverage,
        deviations: response.script_deviations,
        key_points_covered: response.key_points_covered,
        key_points_missed: response.key_points_missed,
        positive_adaptations: response.positive_adaptations,
        script_effectiveness: response.script_effectiveness,
        adherence_quality: response.adherence_quality,
        confidence: response.confidence_level
      };
    } catch (error) {
      console.error('Erro no cálculo de Script Adherence:', error);
      return this.getFallbackScriptAdherence();
    }
  }

  // Métodos auxiliares

  calculateCallDuration(segments) {
    if (!segments || segments.length === 0) return 0;
    const lastSegment = segments[segments.length - 1];
    return Math.round(lastSegment.end_time);
  }

  calculateOverallQuality({ customerSentiment, agentEmpathy, fcr, scriptAdherence }) {
    // Score de 0 a 100
    const sentimentScore = ((customerSentiment + 1) / 2) * 100; // Normalizar de -1,1 para 0-100
    const empathyScore = agentEmpathy;
    const fcrScore = fcr * 100;
    const adherenceScore = scriptAdherence || 0; // Se não há script, não afeta negativamente
    
    // Pesos: FCR é mais importante, depois script adherence, empatia, e sentimento
    // Se não há script adherence, distribui o peso entre os outros KPIs
    if (scriptAdherence === null || scriptAdherence === undefined) {
      const weightedScore = (fcrScore * 0.45) + (empathyScore * 0.35) + (sentimentScore * 0.20);
      return Math.round(weightedScore);
    } else {
      const weightedScore = (fcrScore * 0.35) + (adherenceScore * 0.30) + (empathyScore * 0.25) + (sentimentScore * 0.10);
      return Math.round(weightedScore);
    }
  }

  calculateOverallConfidence(confidences) {
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  calculateFlowScore({ totalSegments, speakerSwitches, interruptions, silencePeriods }) {
    let score = 100;
    
    // Penalizar muitas interrupções
    score -= interruptions * 5;
    
    // Penalizar muitos períodos de silêncio
    score -= silencePeriods * 10;
    
    // Penalizar fluxo muito fragmentado ou muito monótono
    const switchRate = speakerSwitches / totalSegments;
    if (switchRate > 0.8) score -= 15; // Muito fragmentado
    if (switchRate < 0.2) score -= 10; // Muito monótono
    
    return Math.max(0, Math.min(100, score));
  }

  getFlowQualityLevel(score) {
    if (score >= 85) return 'excelente';
    if (score >= 70) return 'bom';
    if (score >= 55) return 'regular';
    return 'precisa_melhoria';
  }

  determineJourneyType(emotions) {
    if (emotions.length < 2) return 'stable';
    
    const first = emotions[0].score;
    const last = emotions[emotions.length - 1].score;
    
    if (last > first + 0.2) return 'improving';
    if (last < first - 0.2) return 'declining'; 
    return 'stable';
  }

  findDominantEmotion(emotions) {
    if (!emotions || emotions.length === 0) return 'neutral';
    
    const emotionCounts = {};
    emotions.forEach(e => {
      emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1;
    });
    
    return Object.keys(emotionCounts).reduce((a, b) => 
      emotionCounts[a] > emotionCounts[b] ? a : b
    );
  }

  calculateEmotionalVolatility(emotions) {
    if (emotions.length < 2) return 0;
    
    let volatility = 0;
    for (let i = 1; i < emotions.length; i++) {
      volatility += Math.abs(emotions[i].score - emotions[i-1].score);
    }
    
    return volatility / (emotions.length - 1);
  }

  // Fallbacks para quando a API falha

  getFallbackSentiment() {
    return {
      score: 0,
      progression: [],
      drivers: { positive_indicators: [], negative_indicators: [] },
      journey: 'Análise indisponível',
      csat_prediction: { predicted_score: 3, confidence: 0 },
      confidence: 0
    };
  }

  getFallbackEmpathy() {
    return {
      score: 50,
      indicators: {},
      gaps: {},
      progression: [],
      coaching_recommendations: [],
      confidence: 0
    };
  }

  getFallbackFCR() {
    return {
      fcr_score: 0.5,
      fcr_binary: 0,
      status: 'unknown',
      problem: { main_issue: 'Não identificado', issue_complexity: 'moderate' },
      resolved_indicators: {},
      unresolved_indicators: {},
      confidence: 0
    };
  }

  getFallbackScriptAdherence() {
    return {
      adherence_score: null,
      script_coverage: 0,
      deviations: [],
      key_points_covered: [],
      key_points_missed: [],
      positive_adaptations: [],
      script_effectiveness: { appropriate: false, suggestions: [] },
      adherence_quality: 'indisponível',
      confidence: 0
    };
  }
}

export { SipPulseKpiProcessor };