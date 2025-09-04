import { TalkIntelWebhook, CallAnalysis, SentimentAnalysis, TopicDetection, WebhookSegment } from '../types';

export class WebhookProcessor {
  // Nova função para converter formato do webhook
  static convertWebhookFormat(rawWebhook: any): TalkIntelWebhook {
    try {
      // Se o webhook tem a estrutura com payload, extrair os dados
      if (rawWebhook.payload && rawWebhook.payload.transcription) {
        const payload = rawWebhook.payload;
        const transcription = payload.transcription;
        
        console.log('🔍 DEBUG convertWebhookFormat:');
        console.log('   payload.summarization:', payload.summarization);
        console.log('   rawWebhook.summarization:', rawWebhook.summarization);
        
        return {
          id: rawWebhook.id || `webhook-${Date.now()}`,
          timestamp: rawWebhook.timestamp || new Date().toISOString(),
          segments: transcription.segments || [],
          text: transcription.text || '',
          usage: transcription.usage || {
            cost: 0,
            currency: 'BRL',
            cost_details: [],
            performance: {
              delay: 0,
              execution_time: 0,
              relative_execution_time: 0,
              relative_execution_time_unit: 'seconds'
            }
          },
          summarization: payload.summarization || rawWebhook.summarization || 'Resumo não disponível',
          sentiment_analysis: payload.sentiment_analysis || [],
          topic_detection: payload.topic_detection || payload.transcription?.topic_detection || rawWebhook.topic_detection || [],
          resolution: payload.resolution || false,
          call_type: 'human-human' as const,
          duration: 0, // Será calculado a partir dos segments
          participants: [],
          agent_name: payload.agent_name || payload.transcription?.agent_name || rawWebhook.agent_name || null,
          customer_name: payload.customer_name || payload.transcription?.customer_name || rawWebhook.customer_name || null
        };
      }
      
      // Se já está no formato correto, retornar como está
      return rawWebhook;
    } catch (error) {
      console.error('Erro ao converter formato do webhook:', error);
      throw error;
    }
  }

  static processWebhook(webhook: TalkIntelWebhook): CallAnalysis {
    try {
      // Validar dados essenciais
      if (!webhook) {
        throw new Error('Webhook data is null or undefined');
      }

      // Garantir que campos obrigatórios existam
      const safeWebhook = {
        id: webhook.id || `webhook-${Date.now()}`,
        timestamp: webhook.timestamp || new Date().toISOString(),
        call_type: webhook.call_type || 'human-human' as const,
        duration: webhook.duration || 0,
        segments: webhook.segments || [],
        sentiment_analysis: webhook.sentiment_analysis || [],
        topic_detection: webhook.topic_detection || [],
        summarization: webhook.summarization || 'Resumo não disponível',
        resolution: webhook.resolution || 'Status não informado',
        usage: webhook.usage || {
          cost: 0,
          currency: 'BRL',
          cost_details: [],
          performance: {
            delay: 0,
            execution_time: 0,
            relative_execution_time: 0,
            relative_execution_time_unit: 'seconds'
          }
        },
        participants: webhook.participants || [],
        text: webhook.text || '',
        agent_name: webhook.agent_name || null,
        customer_name: webhook.customer_name || null
      };

      const agents = this.identifyAgents(safeWebhook.segments, safeWebhook.agent_name, safeWebhook.customer_name);
      const primaryAgent = agents.find(agent => agent.type === 'agent') || agents[0] || { 
        id: 'unknown', 
        name: 'Agente Desconhecido', 
        type: 'agent' as const 
      };
      
      return {
        id: safeWebhook.id,
        timestamp: safeWebhook.timestamp,
        duration: this.calculateDuration(safeWebhook.segments),
        callType: safeWebhook.call_type,
        agentId: primaryAgent.id,
        agentName: primaryAgent.name,
        agentType: 'human', // Assumindo que todos são humanos por enquanto
        customerSatisfaction: this.calculateSentimentScore(safeWebhook.sentiment_analysis),
        sentiment: this.extractOverallSentiment(safeWebhook.sentiment_analysis),
        resolutionRate: typeof safeWebhook.resolution === 'boolean' 
          ? (safeWebhook.resolution ? 95 : 65)
          : (safeWebhook.resolution.toLowerCase().includes('resolvido') ? 95 : 65),
        responseTime: this.calculateAverageResponseTime(safeWebhook.segments),
        callQuality: this.calculateCallQuality(safeWebhook.sentiment_analysis, safeWebhook.segments),
        tags: this.generateTags(safeWebhook.topic_detection, safeWebhook.sentiment_analysis),
        summary: safeWebhook.summarization,
        keyInsights: this.extractKeyInsights(safeWebhook.sentiment_analysis, safeWebhook.topic_detection),
        cost: safeWebhook.usage.cost,
        currency: safeWebhook.usage.currency,
        topics: this.extractTopics(safeWebhook.topic_detection),
        resolved: typeof safeWebhook.resolution === 'boolean' 
          ? safeWebhook.resolution
          : safeWebhook.resolution.toLowerCase().includes('resolvido'),
        transcription: safeWebhook.text,
        segments: safeWebhook.segments,
        sentimentAnalysis: safeWebhook.sentiment_analysis
      };
    } catch (error) {
      console.error('Erro no processamento do webhook:', error);
      
      // Retornar dados padrão em caso de erro
      return {
        id: webhook?.id || `error-${Date.now()}`,
        timestamp: webhook?.timestamp || new Date().toISOString(),
        duration: webhook?.duration || 0,
        callType: webhook?.call_type || 'human-human',
        agentId: 'error-agent',
        agentName: 'Erro no Processamento',
        agentType: 'human',
        customerSatisfaction: 0,
        sentiment: 'neutral',
        resolutionRate: 0,
        responseTime: 0,
        callQuality: 0,
        tags: ['erro'],
        summary: `Erro ao processar webhook: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        keyInsights: ['Erro no processamento dos dados'],
        cost: 0,
        currency: 'BRL',
        topics: ['erro'],
        resolved: false,
        transcription: '',
        segments: [],
        sentimentAnalysis: []
      };
    }
  }

  // Novo método para calcular score baseado na análise de sentimento (0-1)
  static calculateSentimentScore(sentimentAnalysis: SentimentAnalysis[]): number {
    try {
      if (!sentimentAnalysis || !Array.isArray(sentimentAnalysis) || sentimentAnalysis.length === 0) {
        return 0.5; // Neutro na escala 0-1
      }
      
      // Calcular média simples de todos os scores
      const validScores = sentimentAnalysis
        .filter(item => item && typeof item.score === 'number' && !isNaN(item.score))
        .map(item => item.score);
        
      if (validScores.length === 0) return 0.5; // Neutro na escala 0-1
      
      const avgScore = validScores.reduce((a, b) => a + b, 0) / validScores.length;
      
      // Manter escala 0-1 e arredondar para 2 casas decimais
      return Math.round(avgScore * 100) / 100;
    } catch (error) {
      console.error('Erro ao calcular score de sentimento:', error);
      return 0.5;
    }
  }

  static extractOverallSentiment(sentimentAnalysis: SentimentAnalysis[]): 'positive' | 'neutral' | 'negative' {
    try {
      if (!sentimentAnalysis || !Array.isArray(sentimentAnalysis) || sentimentAnalysis.length === 0) {
        return 'neutral';
      }

      // Calcular média dos scores (já processados por LLM)
      // Scores baixos = negativo, scores altos = positivo
      const validScores = sentimentAnalysis
        .filter(item => item && typeof item.score === 'number' && !isNaN(item.score))
        .map(item => item.score);
        
      if (validScores.length === 0) return 'neutral';
      
      const avgScore = validScores.reduce((a, b) => a + b, 0) / validScores.length;
      
      // Classificar baseado na média dos scores
      if (avgScore >= 0.6) {
        return 'positive';  // Score alto = positivo
      } else if (avgScore <= 0.4) {
        return 'negative';  // Score baixo = negativo
      } else {
        return 'neutral';   // Score médio = neutro
      }
    } catch (error) {
      console.error('Erro ao extrair sentimento geral:', error);
      return 'neutral';
    }
  }

  static extractTopics(topicDetection: TopicDetection[]): string[] {
    try {
      console.log('🔍 DEBUG extractTopics - Input:', topicDetection);
      if (!topicDetection || !Array.isArray(topicDetection)) {
        console.log('⚠️ extractTopics - Input inválido');
        return [];
      }

      const extractedTopics = topicDetection
        .filter(topic => 
          topic && 
          typeof topic.confidence === 'number' && 
          topic.confidence > 0.6 && // Reduzido de 0.7 para 0.6
          typeof topic.label === 'string' &&
          topic.label.trim() !== ''
        )
        .map(topic => topic.label.trim())
        .slice(0, 10); // Aumentado de 5 para 10

      console.log('✅ extractTopics - Tópicos extraídos:', extractedTopics);
      return extractedTopics;
    } catch (error) {
      console.error('❌ Erro ao extrair tópicos:', error);
      return [];
    }
  }

  static identifyAgents(
    segments: WebhookSegment[], 
    agentName?: string | null, 
    customerName?: string | null
  ): { id: string; name: string; type: 'agent' | 'customer' }[] {
    try {
      if (!segments || !Array.isArray(segments)) {
        return [];
      }

      const validSegments = segments.filter(s => s && typeof s.speaker === 'string');
      const speakers = [...new Set(validSegments.map(s => s.speaker))];
      
      const agents = speakers
        .filter(speaker => speaker && speaker !== 'NOT IDENTF')
        .map((speaker, index) => {
          let name = `Participante ${speaker}`;
          let type: 'agent' | 'customer' = 'customer';

          // Verificar se temos um nome de agente válido (não vazio, null, undefined ou "indefinido")
          const hasValidAgentName = agentName && 
            agentName.trim() !== '' && 
            agentName.toLowerCase() !== 'indefinido' && 
            agentName.toLowerCase() !== 'undefined' && 
            agentName.toLowerCase() !== 'null';

          // Verificar se temos um nome de cliente válido
          const hasValidCustomerName = customerName && 
            customerName.trim() !== '' && 
            customerName.toLowerCase() !== 'indefinido' && 
            customerName.toLowerCase() !== 'undefined' && 
            customerName.toLowerCase() !== 'null';

          // Se temos pelo menos um nome válido, usar a lógica baseada no conteúdo
          if (hasValidAgentName || hasValidCustomerName) {
            const speakerSegments = validSegments.filter(s => s.speaker === speaker);
            const speakerText = speakerSegments.map(s => s.text).join(' ').toLowerCase();
            
            console.log(`🔍 Speaker ${speaker} text:`, speakerText);
            
            // SPEAKER_01 é quem se identifica como representante da empresa (Dereck)
            if (speaker === 'SPEAKER_01' || 
                speakerText.includes('meu nome é') || 
                speakerText.includes('falo em nome') ||
                speakerText.includes('caixa') ||
                speakerText.includes('empresa') ||
                speakerText.includes('representante')) {
              name = hasValidAgentName ? agentName : 'Agente';
              type = 'agent';
              console.log(`✅ ${speaker} identificado como agente: ${name}`);
            } else if (speaker === 'SPEAKER_00') {
              name = hasValidCustomerName ? customerName : 'Cliente';
              type = 'customer';
              console.log(`✅ ${speaker} identificado como cliente: ${name}`);
            }
          } else {
            // Fallback para lógica anterior - apenas quando não há nomes específicos
            console.log('⚠️ Nomes não fornecidos, usando fallback');
            if (speaker === 'SPEAKER_00') {
              name = 'Agente Desconhecido';
              type = 'agent';
            } else if (speaker === 'SPEAKER_01') {
              name = 'Cliente Desconhecido';
              type = 'customer';
            }
          }

          return {
            id: `${type}-${index + 1}`,
            name,
            type
          };
        });

      return agents;
    } catch (error) {
      console.error('Erro ao identificar agentes:', error);
      return [];
    }
  }

  static calculateDuration(segments: WebhookSegment[]): number {
    try {
      if (!segments || !Array.isArray(segments) || segments.length === 0) {
        return 0;
      }

      const validSegments = segments.filter(s => 
        s && typeof s.end_time === 'number' && !isNaN(s.end_time)
      );

      if (validSegments.length === 0) {
        return 0;
      }

      const lastSegment = validSegments[validSegments.length - 1];
      return Math.round(lastSegment.end_time);
    } catch (error) {
      console.error('Erro ao calcular duração:', error);
      return 0;
    }
  }

  static calculateAverageResponseTime(segments: WebhookSegment[]): number {
    try {
      if (!segments || !Array.isArray(segments) || segments.length < 2) {
        return 5;
      }

      const validSegments = segments.filter(s => 
        s && 
        typeof s.initial_time === 'number' && 
        typeof s.end_time === 'number' &&
        !isNaN(s.initial_time) && 
        !isNaN(s.end_time)
      );

      if (validSegments.length < 2) {
        return 5;
      }

      const responseTimes: number[] = [];
      
      for (let i = 1; i < validSegments.length; i++) {
        const timeDiff = validSegments[i].initial_time - validSegments[i - 1].end_time;
        if (timeDiff > 0 && timeDiff < 30) { // Tempo de resposta razoável
          responseTimes.push(timeDiff);
        }
      }
      
      if (responseTimes.length === 0) return 5;
      return Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length);
    } catch (error) {
      console.error('Erro ao calcular tempo de resposta:', error);
      return 5;
    }
  }

  static calculateCallQuality(sentimentAnalysis: SentimentAnalysis[], segments: WebhookSegment[]): number {
    try {
      const sentimentScore = this.calculateSentimentScore(sentimentAnalysis);
      const segmentCount = segments && Array.isArray(segments) ? segments.length : 0;
      const segmentQuality = segmentCount > 5 ? 4.5 : 3.5; // Mais interação = melhor qualidade
      
      return Math.min(5, (sentimentScore + segmentQuality) / 2);
    } catch (error) {
      console.error('Erro ao calcular qualidade da chamada:', error);
      return 3.0;
    }
  }

  static generateTags(topicDetection: TopicDetection[], sentimentAnalysis: SentimentAnalysis[]): string[] {
    try {
      const tags: string[] = [];
      
      // Adicionar tags baseadas em tópicos
      if (topicDetection && Array.isArray(topicDetection)) {
        topicDetection.forEach(topic => {
          if (topic && typeof topic.confidence === 'number' && topic.confidence > 0.8 && topic.label) {
            tags.push(topic.label.replace(/\s+/g, '-').toLowerCase());
          }
        });
      }
      
      // Adicionar tags baseadas em sentimento
      if (sentimentAnalysis && Array.isArray(sentimentAnalysis)) {
        sentimentAnalysis.forEach(sentiment => {
          if (sentiment && typeof sentiment.score === 'number' && sentiment.score > 0.6 && sentiment.label) {
            tags.push(sentiment.label);
          }
        });
      }
      
      return [...new Set(tags)].slice(0, 5);
    } catch (error) {
      console.error('Erro ao gerar tags:', error);
      return [];
    }
  }

  static extractKeyInsights(sentimentAnalysis: SentimentAnalysis[], topicDetection: TopicDetection[]): string[] {
    try {
      const insights: string[] = [];
      
      // Insights de sentimento
      if (sentimentAnalysis && Array.isArray(sentimentAnalysis)) {
        const strongSentiments = sentimentAnalysis.filter(s => 
          s && typeof s.score === 'number' && s.score > 0.6 && s.label
        );
        strongSentiments.forEach(sentiment => {
          insights.push(`${sentiment.label} detectado com ${Math.round(sentiment.score * 100)}% de intensidade`);
        });
      }
      
      // Insights de tópicos
      if (topicDetection && Array.isArray(topicDetection)) {
        const strongTopics = topicDetection.filter(t => 
          t && typeof t.confidence === 'number' && t.confidence > 0.8 && t.label
        );
        strongTopics.forEach(topic => {
          insights.push(`Tópico identificado: ${topic.label} (${Math.round(topic.confidence * 100)}% confiança)`);
        });
      }
      
      return insights.slice(0, 3);
    } catch (error) {
      console.error('Erro ao extrair insights:', error);
      return ['Erro ao processar insights'];
    }
  }
}