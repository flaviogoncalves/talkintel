import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, Star, CheckCircle, TrendingUp, MessageSquare, Filter, Calendar, Clock, Trash2, Database, Users, RefreshCw, Award, AlertTriangle } from 'lucide-react';
import StatCard from './StatCard';
import AgentCard from './AgentCard';
import CallAnalysisTable from './CallAnalysisTable';
import WordCloudComponent from './WordCloud';

import DataStorageService from '../services/dataStorage';
import { CallAnalysis } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG, buildUrl, createAuthHeaders } from '../config/api';
import { fetchWithAuth } from '../utils/apiUtils';

interface DashboardProps {
  onDataUpdate?: (newAnalysis?: CallAnalysis) => void;
  onCampaignTypeChange?: (campaignType: string | null) => void;
}

// Default dashboard stats with enhanced sentiment metrics
const defaultDashboardStats = {
  totalCalls: 0,
  averageSatisfaction: 0,
  sentimentRecoveryRate: 0, // Replaced resolutionRate with sentimentRecoveryRate
  resolutionRate: 0, // Keep for customer service dashboard
  averageCallDuration: 0,
  humanAgentCount: 0,
  aiAgentCount: 0,
  callsToday: 0,
  callsThisWeek: 0,
  topTopics: [] as string[],
  topTopicsWithTrends: [] as any[],
  sentimentDistribution: { 
    positive: 0, 
    neutral: 0, 
    negative: 0,
    totalCalls: 0,
    positivePercentage: 0,
    neutralPercentage: 0,
    negativePercentage: 0
  },
  averageSentimentScore: 0,
  sentimentCallsCount: 0
};

interface Campaign {
  id: string;
  name: string;
  description: string;
  webhook_endpoint: string;
  campaign_type: 'sales' | 'debt_collection' | 'customer_service';
  created_at: string;
  company_id: string;
}

interface AgentPerformance {
  id: string;
  name: string; // Database has 'name', not 'agent_name'
  satisfaction_score: number;
  total_calls: number; // Database has 'total_calls', not 'call_count'
  total_cost: number;
  composite_performance_index: number;
  performance_grade: string;
  resolution_rate: number;
}

const Dashboard: React.FC<DashboardProps> = ({ onDataUpdate, onCampaignTypeChange }) => {
  const [callAnalyses, setCallAnalyses] = useState<CallAnalysis[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [recalculating, setRecalculating] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [dashboardMetrics, setDashboardMetrics] = useState(defaultDashboardStats);
  const [isClearing, setIsClearing] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  
  const { user, tokens } = useAuth();
  const token = tokens?.accessToken;
  const { t } = useTranslation(['dashboard', 'common']);

  
  // Load campaigns
  const loadCampaigns = async () => {
    if (!token) return;
    
    setIsLoadingCampaigns(true);
    try {
      const response = await fetch(buildUrl('/api/campaigns'), {
        headers: createAuthHeaders(token)
      });

      const result = await response.json();
      if (response.ok && result.data) {
        setCampaigns(result.data);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar campanhas:', error);
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  // Fetch agent performance data with proper sorting for top/bottom performers
  const fetchAgentPerformance = async () => {
    if (!token) {
      console.log('❌ No access token available for agent performance');
      return;
    }

    try {
      console.log('🔍 Fetching agent performance data...');
      const url = buildUrl('/api/agents');
      console.log(`🔗 Agent performance URL: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: createAuthHeaders(token)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📊 Agent performance API response:', result);

      // Handle different response formats
      let agentData = [];
      if (result && Array.isArray(result.data)) {
        agentData = result.data;
      } else if (result && Array.isArray(result.agents)) {
        agentData = result.agents;
      } else if (Array.isArray(result)) {
        agentData = result;
      }

      if (agentData.length > 0) {
        // Transform agent data to include composite performance index for ranking
        const performanceData = agentData.map((agent: any) => ({
          ...agent,
          composite_performance_index: parseFloat(agent.compositePerformanceIndex || agent.composite_performance_index || 0),
          performance_grade: agent.performanceGrade || agent.performance_grade || 'C',
          total_calls: parseInt(agent.totalCalls || agent.total_calls || 0)
        }));

        setAgentPerformance(performanceData);
        console.log(`✅ Loaded ${performanceData.length} agents performance data`);
        console.log('🎯 Sample agent performance:', performanceData[0]);
      } else {
        console.log('⚠️ No agent performance data received');
        setAgentPerformance([]);
      }
    } catch (error) {
      console.error('❌ Error fetching agent performance:', error);
      setAgentPerformance([]);
    }
  };

  // Recalculate agent metrics
  const recalculateMetrics = async () => {
    if (!token) {
      console.log('❌ No access token available for recalculation');
      return;
    }

    try {
      setRecalculating(true);
      console.log('🔄 Recalculating agent metrics...');
      
      const response = await fetch(buildUrl('/api/agents/recalculate-metrics'), {
        method: 'POST',
        headers: createAuthHeaders(token)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Recalculation response:', result);

      // Refresh both datasets after recalculation
      await Promise.all([
        loadData(),
        fetchAgentPerformance()
      ]);

    } catch (error) {
      console.error('❌ Error recalculating metrics:', error);
    } finally {
      setRecalculating(false);
    }
  };

  // Get top 3 and bottom 3 performers
  const getTopPerformers = () => {
    if (agentPerformance.length === 0) {
      return [];
    }
    return [...agentPerformance]
      .filter(agent => typeof agent.composite_performance_index === 'number')
      .sort((a, b) => b.composite_performance_index - a.composite_performance_index)
      .slice(0, 3);
  };

  const getBottomPerformers = () => {
    if (agentPerformance.length === 0) {
      return [];
    }
    return [...agentPerformance]
      .filter(agent => typeof agent.composite_performance_index === 'number')
      .sort((a, b) => a.composite_performance_index - b.composite_performance_index)
      .slice(0, 3);
  };

  // Create performance score tooltip
  const createPerformanceTooltip = (agent: AgentPerformance) => {
    // CORRECT mappings based on what's actually in the database:
    const sentimentScore = Number((agent.satisfaction_score || 0).toFixed(1)); // Contains sentiment data (4.95-8.50 range)
    const resolutionRate = Number((agent.resolution_rate || 0).toFixed(0));    // Contains resolution rate (0-100%)
    const recoveryRate = Number((agent.call_quality * 20 || 0).toFixed(0));    // Recovery rate stored in call_quality (scaled from 0-5 to 0-100)
    
    return `Performance Score Calculation:
• Sentiment Score: ${sentimentScore}/10.0 (50% weight) 
• Recovery Rate: ${recoveryRate}% (30% weight)
• Resolution Rate: ${resolutionRate}% (20% weight)

Final Score: ${((agent.composite_performance_index || 0) * 2).toFixed(1)}/10.0
Grade: ${agent.performance_grade || 'C'}
Total Calls: ${agent.total_calls || 0}

Formula: (${sentimentScore}/10 × 0.5) + (${recoveryRate}/100 × 0.3) + (${resolutionRate}/100 × 0.2)`;
  };

  // Handle agent click to filter calls
  const handleAgentClick = (agentId: string, agentName: string) => {
    if (selectedAgentId === agentId) {
      // Deselect if already selected
      setSelectedAgentId(null);
      console.log('🔍 Deselected agent filter');
    } else {
      // Select new agent
      setSelectedAgentId(agentId);
      console.log(`🔍 Filtering calls by agent: ${agentName} (${agentId})`);
    }
  };

  // Load data from multi-company API
  const loadData = async () => {
    if (!token) return;
    
    console.log('🔄 Loading data from multi-company API...');
    
    try {
      // Load webhooks with optional campaign filter
      const webhooksUrl = selectedCampaign !== 'all' 
        ? buildUrl(`/api/webhooks?campaign=${selectedCampaign}`)
        : buildUrl('/api/webhooks');
        
      const response = await fetchWithAuth(webhooksUrl, token);

      const result = await response.json();
      const webhookData = result.data || result.webhooks || [];
      
      console.log('🔍 DEBUG - Webhooks carregados:', webhookData.length);
      
      setCallAnalyses(webhookData);
      
      // Load agents (using the same campaign filter)
      const agentsUrl = selectedCampaign !== 'all' 
        ? buildUrl(`/api/agents?campaign=${selectedCampaign}`)
        : buildUrl('/api/agents');
        
      const agentsResponse = await fetchWithAuth(agentsUrl, token);

      
      if (webhookData.length > 0) {
        updateDashboardMetrics(webhookData);
      }
      
      console.log(`📊 Loaded ${webhookData.length} analyses from API`);
    } catch (error: any) {
      console.error('❌ Erro ao carregar dados da API:', error);
      
      if (error.message?.includes('Authentication expired')) {
        // Show user-friendly message for expired tokens
        console.log('🔐 Authentication expired - user should log in again');
      }
      
      setCallAnalyses([]);
      setDashboardMetrics(defaultDashboardStats);
    }
  };







  // Clear database
  const handleClearDatabase = async () => {
    if (!token) return;
    
    const confirmation = window.confirm(
      '🗑️ ATENÇÃO: Limpar Dados da Empresa\n\n' +
      'Esta ação irá REMOVER PERMANENTEMENTE:\n' +
      '• Todas as análises de chamadas da sua empresa\n' +
      '• Todos os dados de agentes\n' +
      '• Todas as métricas e estatísticas\n' +
      '• Todos os webhooks salvos\n\n' +
      '⚠️ ESTA AÇÃO NÃO PODE SER DESFEITA!\n\n' +
      'Tem certeza que deseja continuar?'
    );

    if (!confirmation) {
      return;
    }

    setIsClearing(true);

    try {
      const response = await fetch(buildUrl('/api/data/all'), {
        method: 'DELETE',
        headers: createAuthHeaders(token)
      });
      
      if (!response.ok) {
        console.warn('⚠️ Não foi possível limpar o banco de dados:', response.status);
        alert('❌ Erro ao limpar banco de dados. Verifique se o servidor está rodando.');
      } else {
        console.log('✅ Banco de dados limpo');
        alert('✅ Dados da empresa limpos com sucesso!');
        
        // Reset state and reload data
        setCallAnalyses([]);
        setDashboardMetrics(defaultDashboardStats);
        
        // Reload fresh data
        await loadData();
      }
    } catch (error) {
      console.error('❌ Erro ao limpar banco de dados:', error);
      alert('❌ Erro de conexão. Verifique se o servidor está rodando.');
    } finally {
      setIsClearing(false);
    }
  };

  // Delete single webhook
  const handleDeleteWebhook = async (webhookId: string) => {
    if (!token) return;
    
    const confirmation = window.confirm(
      '🗑️ Deletar Webhook\n\n' +
      'Tem certeza que deseja remover esta análise de chamada?\n\n' +
      '⚠️ Esta ação não pode ser desfeita!'
    );

    if (!confirmation) {
      return;
    }

    try {
      const response = await fetch(buildUrl(`/api/webhooks/${webhookId}`), {
        method: 'DELETE',
        headers: createAuthHeaders(token)
      });
      
      if (response.ok) {
        console.log(`✅ Webhook ${webhookId} deleted successfully`);
        // Remove the deleted webhook from the local state
        setCallAnalyses(prev => prev.filter(call => call.id !== webhookId));
        
        // Refresh the data to ensure consistency
        await loadData();
      } else {
        console.error('❌ Error deleting webhook:', response.status);
        alert('❌ Erro ao deletar webhook. Verifique se o servidor está rodando.');
      }
    } catch (error) {
      console.error('❌ Erro ao deletar webhook:', error);
      alert('❌ Erro de conexão. Verifique se o servidor está rodando.');
    }
  };

  // Topic filtering handlers
  const handleTopicClick = (topic: string) => {
    console.log('🏷️ Topic clicked:', topic);
    setSelectedTopic(selectedTopic === topic ? null : topic); // Toggle topic filter
  };

  const clearTopicFilter = () => {
    setSelectedTopic(null);
  };

  useEffect(() => {
    if (token) {
      loadCampaigns();
      loadData();
      fetchAgentPerformance();
    }
  }, [token]); // Load on mount and when token changes

  // Listen for real-time agent metrics updates
  useEffect(() => {
    const handleAgentMetricsUpdated = (event: CustomEvent) => {
      console.log('🎯 Received agent metrics update event:', event.detail);
      // Refresh agent performance data when metrics are updated
      setTimeout(() => {
        fetchAgentPerformance();
      }, 500); // Short delay to ensure database is updated
    };

    window.addEventListener('agentMetricsUpdated', handleAgentMetricsUpdated as EventListener);

    return () => {
      window.removeEventListener('agentMetricsUpdated', handleAgentMetricsUpdated as EventListener);
    };
  }, [fetchAgentPerformance]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [selectedCampaign, token]); // Reload data when campaign selection changes

  // Update metrics when period changes
  useEffect(() => {
    let filteredAnalyses = callAnalyses;
    
    if (selectedPeriod !== 'custom') {
      const today = new Date();
      const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
      const startDate = new Date(today.getTime() - (days * 24 * 60 * 60 * 1000));
      
      filteredAnalyses = callAnalyses.filter(analysis => {
        const analysisDate = new Date(analysis.timestamp);
        return analysisDate >= startDate;
      });
    } else if (dateRange.start && dateRange.end) {
      filteredAnalyses = callAnalyses.filter(analysis => {
        const analysisDate = new Date(analysis.timestamp);
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
        return analysisDate >= start && analysisDate <= end;
      });
    }
    
    updateDashboardMetrics(filteredAnalyses);
  }, [selectedPeriod, dateRange, callAnalyses]);

  const updateDashboardMetrics = (analyses: CallAnalysis[]) => {
    if (analyses.length === 0) {
      setDashboardMetrics(defaultDashboardStats);
      return;
    }

    const metrics = DataStorageService.calculateAggregatedMetrics(analyses);
    
    setDashboardMetrics({
      totalCalls: metrics.totalCalls,
      averageSatisfaction: Number(metrics.averageSentimentScore.toFixed(1)),
      sentimentRecoveryRate: Math.round(metrics.sentimentRecoveryRate),
      resolutionRate: Math.round(metrics.resolutionRate),
      averageCallDuration: Math.round(metrics.averageDuration),
      humanAgentCount: defaultDashboardStats.humanAgentCount,
      aiAgentCount: defaultDashboardStats.aiAgentCount,
      callsToday: analyses.filter(a => {
        const today = new Date();
        const analysisDate = new Date(a.timestamp);
        return analysisDate.toDateString() === today.toDateString();
      }).length,
      callsThisWeek: analyses.filter(a => {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const analysisDate = new Date(a.timestamp);
        return analysisDate >= weekAgo;
      }).length,
      topTopics: metrics.topTopics.map(t => t.topic),
      topTopicsWithTrends: metrics.topTopics.map((t, index) => ({
        topic: t.topic,
        count: t.count,
        position: index + 1,
        isNew: false,
        isRising: false,
        changePercent: 0,
        changeDirection: 'stable' as 'up' | 'down' | 'stable'
      })),
      sentimentDistribution: metrics.sentimentDistribution
    });
  };
  


  // Filter calls by topic and/or agent
  const recentCalls = callAnalyses.filter(call => {
    // Topic filter
    const topicMatch = !selectedTopic || (
      call.topics && Array.isArray(call.topics) && 
      call.topics.some(topic => 
        typeof topic === 'string' && topic.toLowerCase().includes(selectedTopic.toLowerCase())
      )
    );
    
    // Agent filter - need to match by agent name since we don't have agent_id in CallAnalysis
    const agentMatch = !selectedAgentId || (
      call.agentName && agentPerformance.some(agent => 
        agent.id === selectedAgentId && agent.name === call.agentName
      )
    );
    
    return topicMatch && agentMatch;
  });

  const handleWebhookProcessed = (analysis: CallAnalysis) => {
    console.log('📞 Webhook processado no Dashboard:', analysis.id);
    
    // Add a small delay to ensure server has finished processing
    setTimeout(async () => {
      console.log('🔄 Recarregando dados após processamento do webhook...');
      await Promise.all([
        loadData(),
        fetchAgentPerformance() // Also refresh agent metrics for top/bottom performers
      ]);
    }, 1500); // 1.5 second delay
    
    // Notify parent if callback provided
    if (onDataUpdate) {
      onDataUpdate(analysis);
    }
  };

  // Get word cloud data from real data
  const getWordCloudData = () => {
    console.log('🔍 DEBUG getWordCloudData - Iniciando...');
    console.log('🔍 DEBUG - callAnalyses.length:', callAnalyses.length);
    console.log('🔍 DEBUG - selectedPeriod:', selectedPeriod);
    
    let filteredAnalyses: CallAnalysis[] = [];
    
    if (selectedPeriod !== 'custom') {
      filteredAnalyses = callAnalyses.filter(analysis => {
        const today = new Date();
        const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
        const startDate = new Date(today.getTime() - (days * 24 * 60 * 60 * 1000));
        const analysisDate = new Date(analysis.timestamp);
        return analysisDate >= startDate;
      });
    } else if (dateRange.start && dateRange.end) {
      const rangeAnalyses = DataStorageService.getCallAnalysesByDateRange(dateRange.start, dateRange.end);
      if (Array.isArray(rangeAnalyses)) {
        filteredAnalyses = rangeAnalyses;
      } else {
        // If it's a Promise, use current callAnalyses as fallback
        filteredAnalyses = callAnalyses;
      }
    } else {
      filteredAnalyses = callAnalyses;
    }

    console.log('🔍 DEBUG - filteredAnalyses.length:', filteredAnalyses.length);

    if (filteredAnalyses.length === 0) {
      console.log('⚠️ DEBUG - Nenhuma análise filtrada encontrada');
      return [];
    }

    // Debug: verificar os primeiros 3 registros
    filteredAnalyses.slice(0, 3).forEach((analysis, index) => {
      console.log(`🔍 DEBUG - Análise ${index + 1}:`, {
        id: analysis.id,
        topics: analysis.topics,
        topicsType: typeof analysis.topics,
        isArray: Array.isArray(analysis.topics),
        topicsLength: analysis.topics?.length
      });
    });

    // Processar tópicos corretamente - eles já são strings vindos do WebhookProcessor
    const allTopics = filteredAnalyses.flatMap((call: CallAnalysis) => {
      if (!call.topics || !Array.isArray(call.topics)) {
        console.log(`⚠️ DEBUG - Análise ${call.id} sem tópicos válidos:`, call.topics);
        return [];
      }
      
      // Os tópicos já são strings (processados pelo WebhookProcessor.extractTopics)
      const validTopics = call.topics.filter(topic => typeof topic === 'string' && topic.trim() !== '');
      console.log(`✅ DEBUG - Análise ${call.id} com ${validTopics.length} tópicos válidos:`, validTopics);
      return validTopics;
    });

    console.log('🎨 WordCloud - Tópicos extraídos:', allTopics);
    console.log('🎨 WordCloud - Total de tópicos:', allTopics.length);

    if (allTopics.length === 0) {
      console.log('⚠️ DEBUG - Nenhum tópico extraído de todas as análises');
      return [];
    }

    const topicFrequency = allTopics.reduce((acc: Record<string, number>, topic: string) => {
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('🎨 WordCloud - Frequência dos tópicos:', topicFrequency);

    const wordCloudData = Object.entries(topicFrequency)
      .map(([text, value]) => ({ text, value: Number(value) }))
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, 20);

    console.log('🎨 WordCloud - Dados finais:', wordCloudData);

    return wordCloudData;
  };

  const wordCloudData = getWordCloudData();

  const selectedCampaignData = campaigns.find(c => c.id === selectedCampaign);

  return (
    <div className="space-y-6">
      {/* Selected Campaign Indicator */}
      {selectedCampaign !== 'all' && selectedCampaignData && (
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedCampaignData.name}</h3>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-gray-400">
                    {t('common:campaign.type')}: 
                    <span className="ml-1 capitalize text-purple-300">
                      {selectedCampaignData.campaign_type.replace('_', ' ')}
                    </span>
                  </span>
                  {selectedCampaignData.description && (
                    <span className="text-gray-400">
                      {selectedCampaignData.description}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 bg-gray-800/50 px-2 py-1 rounded">
              {t('common:campaign.filtered')}
            </div>
          </div>
        </div>
      )}

      {/* Key Performance Metrics */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <TrendingUp className="w-6 h-6 mr-3 text-purple-400" />
            {t('dashboard:metrics.title')}
          </h2>
          
          {/* Right side controls */}
          <div className="flex items-center space-x-3">
            {/* Recalculate Button */}
            <button
              onClick={recalculateMetrics}
              disabled={recalculating}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
                recalculating 
                  ? 'bg-gray-700/50 border-gray-600/50 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-500/20 border-purple-500/30 text-purple-300 hover:bg-purple-500/30 hover:border-purple-400/50'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
              <span>{recalculating ? 'Recalculating...' : 'Recalculate Metrics'}</span>
            </button>
            
            {/* Campaign Selector */}
            <div className="relative group">
              <button className="flex items-center space-x-2 px-3 py-0 h-10 rounded-lg text-base font-medium transition-all duration-300 border bg-gray-700/50 text-gray-300 border-gray-600/50 hover:bg-gray-600/50 hover:text-white hover:border-gray-500/50">
                <Users className="w-4 h-4 text-blue-400" />
                <span>
                  {selectedCampaign === 'all' 
                    ? t('dashboard:metrics.allCampaigns')
                    : campaigns.find(c => c.id === selectedCampaign)?.name || 'Campanha'
                  }
                </span>
                <svg className="w-3 h-3 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Campaign Dropdown Menu */}
              <div className="absolute right-0 bottom-full mb-1 w-64 bg-gray-800/95 backdrop-blur-sm border border-gray-700/50 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999]">
                <div className="p-1">
                  <button
                    onClick={() => {
                      setSelectedCampaign('all');
                      if (onCampaignTypeChange) {
                        onCampaignTypeChange(null);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded transition-all duration-200 flex items-center space-x-2 ${
                      selectedCampaign === 'all'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                    }`}
                  >
                    <Users className={`w-3 h-3 ${selectedCampaign === 'all' ? 'text-blue-400' : ''}`} />
                    <span>{t('dashboard:metrics.allCampaigns')}</span>
                  </button>
                  
                  {campaigns.map((campaign) => (
                    <button
                      key={campaign.id}
                      onClick={() => {
                        setSelectedCampaign(campaign.id);
                        if (onCampaignTypeChange) {
                          onCampaignTypeChange(campaign.campaign_type);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 text-sm rounded transition-all duration-200 flex items-center space-x-2 ${
                        selectedCampaign === campaign.id
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                      }`}
                    >
                      <div className="w-3 h-3 bg-purple-500 rounded-full flex-shrink-0" />
                      <div className="flex-1 truncate">
                        <div className="font-medium">{campaign.name}</div>
                        {campaign.description && (
                          <div className="text-xs text-gray-500 truncate">{campaign.description}</div>
                        )}
                      </div>
                    </button>
                  ))}
                  
                  {campaigns.length === 0 && !isLoadingCampaigns && (
                    <div className="px-3 py-2 text-xs text-gray-500 text-center">
                      {t('common:status.noCampaignsFound', 'No campaigns found')}
                    </div>
                  )}
                  
                  {isLoadingCampaigns && (
                    <div className="px-3 py-2 text-xs text-gray-500 text-center">
                      {t('common:status.loadingCampaigns', 'Loading campaigns...')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Database Stats Indicator */}
            {callAnalyses.length > 0 && (
              <div className="flex items-center space-x-1 text-xs text-gray-400 bg-gray-800/50 px-2 py-2 h-10 rounded-lg border border-gray-700">
                <Database className="w-3 h-3" />
                <span>{callAnalyses.length} registros</span>
              </div>
            )}

            {/* Clear Database Button */}
            <button
              onClick={handleClearDatabase}
              disabled={isClearing}
              className={`group relative flex items-center justify-center w-10 h-10 rounded-lg border transition-all duration-300 hover:shadow-lg ${
                isClearing 
                  ? 'bg-gray-500/20 border-gray-500/30 cursor-not-allowed' 
                  : 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30 hover:border-red-400/50 hover:shadow-red-500/20'
              }`}
              title={isClearing ? t('common:status.clearingDatabase', 'Clearing database...') : t('dashboard:metrics.clearDatabase')}
            >
              {isClearing ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 text-red-400 group-hover:text-red-300 transition-colors duration-300" />
              )}
            </button>

            {/* Filters Dropdown - Aligned Right */}
            <div className="relative group">
              <button className="flex items-center space-x-2 px-3 py-0 h-10 rounded-lg text-base font-medium transition-all duration-300 border bg-gray-700/50 text-gray-300 border-gray-600/50 hover:bg-gray-600/50 hover:text-white hover:border-gray-500/50">
                <Filter className="w-4 h-4 text-purple-400" />
                <span>
                  {selectedPeriod === '7d' ? t('dashboard:metrics.last7Days') : 
                   selectedPeriod === '30d' ? t('dashboard:metrics.last30Days') : 
                   selectedPeriod === '90d' ? t('dashboard:metrics.last90Days') : 
                   t('dashboard:metrics.customRange', 'Custom Range')}
                </span>
                <svg className="w-3 h-3 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Dropdown Menu */}
              <div className="absolute right-0 bottom-full mb-1 w-48 bg-gray-800/95 backdrop-blur-sm border border-gray-700/50 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999]">
                <div className="p-1">
                  <button
                    onClick={() => setSelectedPeriod('7d')}
                    className={`w-full text-left px-3 py-2 text-sm rounded transition-all duration-200 flex items-center space-x-2 ${
                      selectedPeriod === '7d'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                    }`}
                  >
                    <Clock className={`w-3 h-3 ${selectedPeriod === '7d' ? 'text-purple-400' : ''}`} />
                    <span>{t('dashboard:metrics.last7Days')}</span>
                  </button>
                  <button
                    onClick={() => setSelectedPeriod('30d')}
                    className={`w-full text-left px-3 py-2 text-sm rounded transition-all duration-200 flex items-center space-x-2 ${
                      selectedPeriod === '30d'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                    }`}
                  >
                    <Calendar className={`w-3 h-3 ${selectedPeriod === '30d' ? 'text-purple-400' : ''}`} />
                    <span>{t('dashboard:metrics.last30Days')}</span>
                  </button>
                  <button
                    onClick={() => setSelectedPeriod('90d')}
                    className={`w-full text-left px-3 py-2 text-sm rounded transition-all duration-200 flex items-center space-x-2 ${
                      selectedPeriod === '90d'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                    }`}
                  >
                    <Calendar className={`w-3 h-3 ${selectedPeriod === '90d' ? 'text-purple-400' : ''}`} />
                    <span>{t('dashboard:metrics.last90Days')}</span>
                  </button>
                  <button
                    onClick={() => setSelectedPeriod('custom')}
                    className={`w-full text-left px-3 py-2 text-sm rounded transition-all duration-200 flex items-center space-x-2 ${
                      selectedPeriod === 'custom'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                    }`}
                  >
                    <Filter className={`w-3 h-3 ${selectedPeriod === 'custom' ? 'text-purple-400' : ''}`} />
                    <span>Personalizado</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title={t('dashboard:metrics.totalCalls')}
            value={dashboardMetrics.totalCalls.toLocaleString()}
            icon={Phone}
            tooltip={t('dashboard:tooltips.totalCalls')}
            className="bg-gradient-to-br from-blue-500/10 via-blue-600/5 to-purple-500/10 border-blue-500/20 hover:border-blue-400/40 transition-all duration-300"
          />
          <StatCard
            title={t('dashboard:metrics.averageSatisfaction')}
            value={dashboardMetrics.averageSatisfaction.toFixed(1) + "%"}
            icon={Star}
            tooltip={t('dashboard:tooltips.averageSentiment')}
            className="bg-gradient-to-br from-yellow-500/10 via-orange-500/5 to-red-500/10 border-yellow-500/20 hover:border-yellow-400/40 transition-all duration-300"
          />
          <StatCard
            title={t('dashboard:metrics.sentimentRecoveryRate')}
            value={dashboardMetrics.sentimentRecoveryRate.toFixed(1) + "%"}
            icon={TrendingUp}
            tooltip={t('dashboard:tooltips.sentimentRecoveryRate')}
            className="bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-teal-500/10 border-green-500/20 hover:border-green-400/40 transition-all duration-300"
          />
          <StatCard
            title={t('dashboard:metrics.averageCallDuration')}
            value={Math.round(dashboardMetrics.averageCallDuration) + "s"}
            icon={Clock}
            tooltip={t('dashboard:tooltips.averageCallDuration')}
            className="bg-gradient-to-br from-purple-500/10 via-violet-500/5 to-indigo-500/10 border-purple-500/20 hover:border-purple-400/40 transition-all duration-300"
          />
        </div>
      </div>

      {/* Agent Performance Sections */}
      {agentPerformance.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 3 Performers */}
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-green-500/30">
            <div className="flex items-center mb-4">
              <Award className="w-6 h-6 text-green-400 mr-2" />
              <h2 className="text-xl font-semibold text-white">Top 3 Performers</h2>
            </div>
            <div className="space-y-3">
              {getTopPerformers().map((agent, index) => (
                <div 
                  key={agent.id} 
                  onClick={() => handleAgentClick(agent.id, agent.name)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-300 hover:shadow-lg ${
                    selectedAgentId === agent.id 
                      ? 'bg-green-500/20 border-green-400/50 shadow-green-500/20' 
                      : 'bg-green-500/10 border-green-500/20 hover:bg-green-500/15 hover:border-green-400/30'
                  }`}
                  title={createPerformanceTooltip(agent)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-white font-semibold">{agent.name}</div>
                      <div className="text-green-400 text-sm">Grade: {agent.performance_grade}</div>
                      <div className="text-gray-400 text-xs">
                        Sentiment: {(agent.satisfaction_score || 0).toFixed(1)}/10.0 | Resolution: {(agent.resolution_rate || 0).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold text-lg">
                      {typeof agent.composite_performance_index === 'number' ? ((agent.composite_performance_index * 2).toFixed(1)) : '0.0'}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {agent.total_calls} calls
                    </div>
                    {selectedAgentId === agent.id && (
                      <div className="text-green-300 text-xs mt-1">
                        ✓ Filtering calls
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom 3 Performers */}
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-red-500/30">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400 mr-2" />
              <h2 className="text-xl font-semibold text-white">Bottom 3 Performers</h2>
            </div>
            <div className="space-y-3">
              {getBottomPerformers().map((agent, index) => (
                <div 
                  key={agent.id} 
                  onClick={() => handleAgentClick(agent.id, agent.name)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-300 hover:shadow-lg ${
                    selectedAgentId === agent.id 
                      ? 'bg-red-500/20 border-red-400/50 shadow-red-500/20' 
                      : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/15 hover:border-red-400/30'
                  }`}
                  title={createPerformanceTooltip(agent)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center font-bold text-white">
                      {agentPerformance.length - 2 + index}
                    </div>
                    <div>
                      <div className="text-white font-semibold">{agent.name}</div>
                      <div className="text-red-400 text-sm">Grade: {agent.performance_grade}</div>
                      <div className="text-gray-400 text-xs">
                        Sentiment: {(agent.satisfaction_score || 0).toFixed(1)}/10.0 | Resolution: {(agent.resolution_rate || 0).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-red-400 font-bold text-lg">
                      {typeof agent.composite_performance_index === 'number' ? ((agent.composite_performance_index * 2).toFixed(1)) : '0.0'}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {agent.total_calls} calls
                    </div>
                    {selectedAgentId === agent.id && (
                      <div className="text-red-300 text-xs mt-1">
                        ✓ Filtering calls
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Word Cloud Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <MessageSquare className="w-6 h-6 mr-3 text-purple-400" />
          {t('dashboard:topics.title')}
        </h2>
        <WordCloudComponent data={wordCloudData} onTopicClick={handleTopicClick} />
      </div>


      {/* Recent Call Analysis - Only show if we have data */}
      {recentCalls.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <TrendingUp className="w-6 h-6 mr-3 text-green-400" />
              {selectedTopic 
                ? t('dashboard:topics.filteredByTopic', { 
                    topic: selectedTopic, 
                    filtered: recentCalls.length, 
                    total: callAnalyses.length 
                  })
                : `Análise de Chamadas (${callAnalyses.length} total)`
              }
            </h2>
            <div className="flex items-center space-x-2">
              {selectedTopic && (
                <button
                  onClick={clearTopicFilter}
                  className="flex items-center space-x-2 px-3 py-1 text-sm bg-purple-500/20 text-purple-300 rounded-lg border border-purple-500/30 hover:bg-purple-500/30 hover:text-purple-200 transition-all"
                >
                  <span>Topic: {selectedTopic}</span>
                  <span className="text-lg">×</span>
                </button>
              )}
              {selectedAgentId && (
                <button
                  onClick={() => setSelectedAgentId(null)}
                  className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:bg-blue-500/30 hover:text-blue-200 transition-all"
                >
                  <span>Agent: {agentPerformance.find(a => a.id === selectedAgentId)?.name || 'Unknown'}</span>
                  <span className="text-lg">×</span>
                </button>
              )}
            </div>
          </div>
          <CallAnalysisTable calls={recentCalls} onDelete={handleDeleteWebhook} />
        </div>
      )}

      {/* No Results for Topic Filter */}
      {selectedTopic && callAnalyses.length > 0 && recentCalls.length === 0 && (
        <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center mx-auto border border-purple-500/30">
              <MessageSquare className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Nenhuma chamada encontrada com o tópico "{selectedTopic}"
              </h3>
              <p className="text-gray-400 mb-4">
                Tente selecionar outro tópico ou limpe o filtro para ver todas as chamadas.
              </p>
              <button
                onClick={clearTopicFilter}
                className="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg border border-purple-500/30 hover:bg-purple-500/30 hover:text-purple-200 transition-all"
              >
                {t('dashboard:topics.clearTopicFilter')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State - Show when no data */}
      {callAnalyses.length === 0 && (
        <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-2xl p-12 border border-gray-700/50 text-center">
          <div className="space-y-6">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center mx-auto border border-purple-500/30">
              <Database className="w-10 h-10 text-purple-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">{t('dashboard:noData.title')}</h3>
              <p className="text-gray-400 mb-6">
                {t('dashboard:noData.description')}
              </p>
              <div className="flex flex-col items-center space-y-2 text-sm text-gray-500">
                {selectedCampaign !== 'all' && campaigns.find(c => c.id === selectedCampaign) && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="break-all">
                      Webhook: {campaigns.find(c => c.id === selectedCampaign)?.webhook_endpoint}
                    </span>
                  </div>
                )}
                {selectedCampaign === 'all' && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>{t('dashboard:noData.selectCampaign')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Date Range Modal */}
      {selectedPeriod === 'custom' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">Período Personalizado</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-purple-400" />
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-purple-400" />
                  Data Final
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setSelectedPeriod('7d')}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {}}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;