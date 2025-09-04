import { CallAnalysis, AgentMetrics } from '../types';
import { WebhookProcessor } from './webhookProcessor';
import { API_CONFIG, buildUrl, createAuthHeaders } from '../config/api';

class DataStorageService {
  private static readonly STORAGE_KEY = 'sippulse_call_analyses';
  private static readonly AGENTS_KEY = 'sippulse_agents';
  private static readonly MAX_STORED_CALLS = 1000;

  // ===== DATABASE INTEGRATION =====

  // Fetch webhooks from database and convert to call analyses
  static async fetchWebhooksFromDatabase(accessToken?: string): Promise<CallAnalysis[]> {
    try {
      const response = await fetch(buildUrl(`${API_CONFIG.ENDPOINTS.WEBHOOKS}?limit=1000`), {
        headers: createAuthHeaders(accessToken)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) {
        console.warn('Resposta inválida do servidor:', result);
        return [];
      }

      // Convert webhooks to call analyses
      const callAnalyses: CallAnalysis[] = [];
      for (const webhook of result.data) {
        try {
          let webhookData;
          
          // Se tem raw_data, usar ele (dados completos do webhook)
          if (webhook.raw_data) {
            try {
              webhookData = JSON.parse(webhook.raw_data);
            } catch (parseError) {
              console.error('Erro ao fazer parse do raw_data:', webhook.id, parseError);
              continue;
            }
          } else {
            // Se não tem raw_data, usar os dados estruturados do banco
            webhookData = webhook;
          }
          
          // 🔧 CORREÇÃO: Processar tópicos do banco de dados corretamente
          let processedTopics: string[] = [];
          if (webhook.topics) {
            try {
              // Se topics é uma string JSON, fazer parse
              const topicsData = typeof webhook.topics === 'string' 
                ? JSON.parse(webhook.topics) 
                : webhook.topics;
              
              // Extrair apenas os labels dos tópicos
              if (Array.isArray(topicsData)) {
                processedTopics = topicsData
                  .filter(topic => 
                    topic && 
                    typeof topic.confidence === 'number' && 
                    topic.confidence > 0.6 &&
                    typeof topic.label === 'string' &&
                    topic.label.trim() !== ''
                  )
                  .map(topic => topic.label.trim())
                  .slice(0, 10);
              }
              
              console.log(`🔍 Webhook ${webhook.id} - Tópicos processados:`, processedTopics);
            } catch (error) {
              console.error(`❌ Erro ao processar tópicos do webhook ${webhook.id}:`, error);
            }
          }
          
          const convertedWebhook = WebhookProcessor.convertWebhookFormat(webhookData);
          const analysis = WebhookProcessor.processWebhook(convertedWebhook);
          
          // 🔧 CORREÇÃO: Usar tópicos processados do banco em vez dos do webhook original
          if (processedTopics.length > 0) {
            analysis.topics = processedTopics;
          }
          
          // Se o webhook do servidor já tem summarization processado, usar ele
          if (webhook.summarization && webhook.summarization !== 'Resumo não disponível') {
            analysis.summary = webhook.summarization;
          }
          
          // 🔧 CORREÇÃO: Usar satisfaction_score do servidor em vez de recalcular
          if (typeof webhook.satisfaction_score === 'number') {
            analysis.customerSatisfaction = webhook.satisfaction_score;
          }
          
          // 🔧 CORREÇÃO: Usar resolved do servidor (já corrigido no banco)
          if (typeof webhook.resolved === 'number') {
            analysis.resolved = webhook.resolved === 1;
          }
          
          // Debug: verificar se os tópicos estão sendo processados
          console.log(`🔍 Webhook ${webhook.id}:`, {
            agentName: analysis.agentName,
            topics: analysis.topics,
            topicsCount: analysis.topics.length
          });
          
          callAnalyses.push(analysis);
        } catch (error) {
          console.error('Erro ao processar webhook:', webhook.id, error);
        }
      }

      console.log(`✅ ${callAnalyses.length} webhooks convertidos para análises de chamada`);
      return callAnalyses;
    } catch (error) {
      console.error('❌ Erro ao buscar webhooks do banco:', error);
      return [];
    }
  }

  // Get all data directly from database
  static async getAllCallAnalysesFromDB(): Promise<CallAnalysis[]> {
    return await this.fetchWebhooksFromDatabase();
  }

  // ===== CALL ANALYSIS STORAGE =====

  // Save call analysis - now handled by server webhook endpoint
  static saveCallAnalysis(analysis: CallAnalysis): void {
    console.log('ℹ️ Análise processada (dados salvos no servidor):', analysis.id);
    // Data is now saved via webhook endpoint to MySQL database
    // No localStorage needed
  }

  // Get all call analyses (deprecated - use getAllCallAnalysesFromDB)
  static getAllCallAnalyses(): CallAnalysis[] {
    console.warn('⚠️ getAllCallAnalyses is deprecated. Use getAllCallAnalysesFromDB() instead.');
    return [];
  }

  // Get analyses by date range from database
  static async getCallAnalysesByDateRange(startDate: string, endDate: string): Promise<CallAnalysis[]> {
    try {
      const allAnalyses = await this.getAllCallAnalysesFromDB();
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end date
      
      return allAnalyses.filter(analysis => {
        const analysisDate = new Date(analysis.timestamp);
        return analysisDate >= start && analysisDate <= end;
      });
    } catch (error) {
      console.error('❌ Erro ao filtrar por data:', error);
      return [];
    }
  }

  // Get analyses by agent from database
  static async getCallAnalysesByAgent(agentId: string): Promise<CallAnalysis[]> {
    try {
      const allAnalyses = await this.getAllCallAnalysesFromDB();
      return allAnalyses.filter(analysis => analysis.agentId === agentId);
    } catch (error) {
      console.error('❌ Erro ao filtrar por agente:', error);
      return [];
    }
  }

  // ===== AGENT METRICS =====

    // Update agent metrics based on new call analysis (deprecated - now handled by server)
  private static updateAgentMetrics(analysis: CallAnalysis): void {
    console.log('ℹ️ updateAgentMetrics deprecated - metrics now calculated by server');
    // Agent metrics are now calculated by the server in database.js
  }

  // Get all agents from server
  static async getAllAgentsFromDB(accessToken?: string): Promise<AgentMetrics[]> {
    try {
      const response = await fetch(buildUrl(API_CONFIG.ENDPOINTS.AGENTS), {
        headers: createAuthHeaders(accessToken)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) {
        console.warn('Resposta inválida do servidor para agentes:', result);
        return [];
      }

      // Transform server data (snake_case) to frontend format (camelCase)
      const transformedAgents: AgentMetrics[] = result.data.map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        totalCalls: agent.total_calls || 0,
        averageDuration: agent.average_duration || 0,
        satisfactionScore: agent.satisfaction_score || 0,
        resolutionRate: agent.resolution_rate || 0,
        averageResponseTime: agent.average_response_time || 0,
        callQuality: agent.call_quality || 0,
        topTags: agent.top_tags ? JSON.parse(agent.top_tags) : [],
        topTopics: agent.top_topics ? JSON.parse(agent.top_topics) : [],
        trend: agent.trend || 'stable',
        trendValue: agent.trend_value || 0,
        sentimentDistribution: agent.sentiment_distribution || {
          positive: 0,
          neutral: 0,
          negative: 0
        },
        sentimentCounts: agent.sentiment_counts || {
          positive: 0,
          neutral: 0,
          negative: 0
        }
      }));

      console.log('🔄 Agentes transformados:', transformedAgents.length);
      return transformedAgents;
    } catch (error) {
      console.error('❌ Erro ao buscar agentes do servidor:', error);
      return [];
    }
  }

  // Get all agents (deprecated - use getAllAgentsFromDB)
  static getAllAgents(): AgentMetrics[] {
    try {
      const analyses = this.getAllCallAnalyses();
      // Agrupar por agentName
      const agentMap: Record<string, AgentMetrics & { sentimentCounts: { positive: number; neutral: number; negative: number } }> = {};
      analyses.forEach(analysis => {
        if (!analysis.agentName) return;
        if (!agentMap[analysis.agentName]) {
          agentMap[analysis.agentName] = {
            id: analysis.agentId,
            name: analysis.agentName,
            type: analysis.agentType,
            totalCalls: 0,
            averageDuration: 0,
            satisfactionScore: 0,
            resolutionRate: 0,
            averageResponseTime: 0,
            callQuality: 0,
            topTags: [],
            trend: 'stable',
            trendValue: 0,
            topTopics: [],
            sentimentCounts: { positive: 0, neutral: 0, negative: 0 }
          };
        }
        const agent = agentMap[analysis.agentName];
        agent.totalCalls++;
        agent.averageDuration += analysis.duration;
        agent.satisfactionScore += analysis.customerSatisfaction;
        agent.resolutionRate += analysis.resolved ? 1 : 0;
        agent.averageResponseTime += analysis.responseTime;
        agent.callQuality += analysis.callQuality;
        agent.topTags = [...new Set([...(agent.topTags || []), ...(analysis.tags || [])])].slice(0, 3);
        agent.topTopics = [...new Set([...(agent.topTopics || []), ...(analysis.topics || [])])].slice(0, 3);
        
        // Contar sentimentos
        agent.sentimentCounts[analysis.sentiment]++;
      });
      // Calcular médias
      Object.values(agentMap).forEach(agent => {
        if (agent.totalCalls > 0) {
          agent.averageDuration = Math.round(agent.averageDuration / agent.totalCalls);
          agent.satisfactionScore = Math.round((agent.satisfactionScore / agent.totalCalls) * 10) / 10;
          agent.resolutionRate = Math.round((agent.resolutionRate / agent.totalCalls) * 100);
          agent.averageResponseTime = Math.round(agent.averageResponseTime / agent.totalCalls);
          agent.callQuality = Math.round(agent.callQuality / agent.totalCalls * 10) / 10;
          
          // Calcular distribuição de sentimento em percentual
          agent.sentimentDistribution = {
            positive: Math.round((agent.sentimentCounts.positive / agent.totalCalls) * 100),
            neutral: Math.round((agent.sentimentCounts.neutral / agent.totalCalls) * 100),
            negative: Math.round((agent.sentimentCounts.negative / agent.totalCalls) * 100)
          };
          
          // Calcular score médio de sentimento
          agent.averageSentimentScore = agent.satisfactionScore;
        }
      });
      
      // Remover propriedade temporária e retornar
      return Object.values(agentMap).map(({ sentimentCounts, ...agent }) => agent);
    } catch (error) {
      console.error('❌ Erro ao agrupar agentes:', error);
      return [];
    }
  }

  // ===== AGGREGATED METRICS =====

  // Calculate aggregated metrics from stored data
  static calculateAggregatedMetrics(analyses: CallAnalysis[]) {
    if (!analyses.length) {
      return {
        totalCalls: 0,
        averageSentimentScore: 0,
        averageDuration: 0,
        resolutionRate: 0,
        sentimentRecoveryRate: 0,
        sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
        topTopics: [],
        topAgents: []
      };
    }

    const totalCalls = analyses.length;
    const averageSentimentScore = analyses.reduce((sum, a) => sum + a.customerSatisfaction, 0) / totalCalls;
    const averageDuration = analyses.reduce((sum, a) => sum + a.duration, 0) / totalCalls;
    const resolvedCalls = analyses.filter(a => a.resolved).length;
    const resolutionRate = (resolvedCalls / totalCalls) * 100;

    // Calculate sentiment recovery rate (calls that started negative but ended neutral/positive)
    const callsWithNegativeStart = analyses.filter(a => a.sentiment === 'negative').length;
    const recoveredCalls = analyses.filter(a => 
      a.sentiment === 'negative' && a.customerSatisfaction >= 6 // Consider 6+ as recovered from negative sentiment
    ).length;
    const sentimentRecoveryRate = callsWithNegativeStart > 0 ? (recoveredCalls / callsWithNegativeStart) * 100 : 0;

    // Sentiment distribution
    const sentimentCounts = analyses.reduce((acc, a) => {
      acc[a.sentiment]++;
      return acc;
    }, { positive: 0, neutral: 0, negative: 0 });

    const sentimentDistribution = {
      positive: Math.round((sentimentCounts.positive / totalCalls) * 100),
      neutral: Math.round((sentimentCounts.neutral / totalCalls) * 100),
      negative: Math.round((sentimentCounts.negative / totalCalls) * 100)
    };

    // Top topics
    const allTopics = analyses.flatMap(analysis => analysis.topics);
    const topTopics = this.getTopItemsWithCount(allTopics, 10);

    // Top agents
    const agentFrequency: Record<string, { name: string; count: number; avgSatisfaction: number }> = {};
    analyses.forEach(analysis => {
      if (!agentFrequency[analysis.agentId]) {
        agentFrequency[analysis.agentId] = {
          name: analysis.agentName,
          count: 0,
          avgSatisfaction: 0
        };
      }
      agentFrequency[analysis.agentId].count++;
      agentFrequency[analysis.agentId].avgSatisfaction += analysis.customerSatisfaction;
    });

    const topAgents = Object.entries(agentFrequency)
      .map(([id, data]) => ({
        id,
        name: data.name,
        count: data.count,
        avgSatisfaction: data.avgSatisfaction / data.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalCalls,
      averageSentimentScore,
      averageDuration,
      resolutionRate,
      sentimentRecoveryRate,
      sentimentDistribution,
      topTopics,
      topAgents
    };
  }

  // ===== UTILITY METHODS =====

  // Get top items by frequency
  private static getTopItems(items: string[], limit: number): string[] {
    const frequency: Record<string, number> = {};
    items.forEach(item => {
      frequency[item] = (frequency[item] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([item]) => item);
  }

  // Get top items with count
  private static getTopItemsWithCount(items: string[], limit: number): { topic: string; count: number }[] {
    const frequency: Record<string, number> = {};
    items.forEach(item => {
      frequency[item] = (frequency[item] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([topic, count]) => ({ topic, count }));
  }

  // ===== DATA MANAGEMENT =====

  // Clear old data
  static clearOldData(daysToKeep: number = 90): void {
    try {
      const allAnalyses = this.getAllCallAnalyses();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const filteredAnalyses = allAnalyses.filter(analysis => {
        const analysisDate = new Date(analysis.timestamp);
        return analysisDate >= cutoffDate;
      });
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredAnalyses));
      
      console.log(`🧹 Dados antigos removidos. Mantidas ${filteredAnalyses.length} análises dos últimos ${daysToKeep} dias.`);
    } catch (error) {
      console.error('❌ Erro ao limpar dados antigos:', error);
    }
  }

  // Export data to JSON
  static exportData(): string {
    try {
      const allAnalyses = this.getAllCallAnalyses();
      const allAgents = this.getAllAgents();
      
      const exportData = {
        analyses: allAnalyses,
        agents: allAgents,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('❌ Erro ao exportar dados:', error);
      return '{}';
    }
  }

  // Import data from JSON
  static importData(jsonData: string): boolean {
    try {
      const importedData = JSON.parse(jsonData);
      
      if (importedData.analyses && Array.isArray(importedData.analyses)) {
        const existingAnalyses = this.getAllCallAnalyses();
        const mergedAnalyses = [...importedData.analyses, ...existingAnalyses];
        
        // Remove duplicates based on ID
        const uniqueAnalyses = mergedAnalyses.filter((analysis, index, self) => 
          index === self.findIndex(a => a.id === analysis.id)
        );
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(uniqueAnalyses.slice(0, this.MAX_STORED_CALLS)));
      }
      
      if (importedData.agents && Array.isArray(importedData.agents)) {
        localStorage.setItem(this.AGENTS_KEY, JSON.stringify(importedData.agents));
      }
      
      console.log(`📥 Dados importados com sucesso.`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao importar dados:', error);
      return false;
    }
  }

  // Clear all data
  static clearAllData(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.AGENTS_KEY);
      console.log('🗑️ Todos os dados foram removidos.');
    } catch (error) {
      console.error('❌ Erro ao limpar dados:', error);
    }
  }

  // Get storage statistics
  static getStorageStats(): { 
    totalAnalyses: number; 
    totalAgents: number; 
    storageSize: string; 
    oldestRecord?: string;
    newestRecord?: string;
  } {
    try {
      const analyses = this.getAllCallAnalyses();
      const agents = this.getAllAgents();
      
      // Calculate storage size
      const analysesSize = localStorage.getItem(this.STORAGE_KEY)?.length || 0;
      const agentsSize = localStorage.getItem(this.AGENTS_KEY)?.length || 0;
      const totalSize = analysesSize + agentsSize;
      const sizeInKB = (totalSize / 1024).toFixed(2);
      
      // Find oldest and newest records
      let oldestRecord, newestRecord;
      if (analyses.length > 0) {
        const sortedByDate = [...analyses].sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        oldestRecord = sortedByDate[0].timestamp;
        newestRecord = sortedByDate[sortedByDate.length - 1].timestamp;
      }
      
      return {
        totalAnalyses: analyses.length,
        totalAgents: agents.length,
        storageSize: `${sizeInKB} KB`,
        oldestRecord,
        newestRecord
      };
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return {
        totalAnalyses: 0,
        totalAgents: 0,
        storageSize: '0 KB'
      };
    }
  }
}

export default DataStorageService;