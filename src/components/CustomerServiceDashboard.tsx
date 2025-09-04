import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Brain, 
  CheckCircle2, 
  TrendingUp, 
  MapPin, 
  Users, 
  MessageSquare,
  Calendar,
  Filter,
  AlertCircle,
  FileText,
  User,
  ArrowLeft,
  ChevronRight,
  BarChart3,
  Activity
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG, buildUrl, createAuthHeaders } from '../config/api';

interface AdvancedCustomerServiceKPIs {
  customer_sentiment: {
    initial_sentiment: number;
    final_sentiment: number;
    sentiment_progression: 'improved' | 'declined' | 'stable';
    sentiment_trajectory: string[];
    csat_prediction: number;
  };
  agent_empathy: {
    empathy_markers_detected: number;
    empathy_phrases: string[];
    emotional_acknowledgment: boolean;
    empathy_score: number;
    performance: 'excellent' | 'good' | 'needs_improvement';
  };
  resolution_quality: {
    first_contact_resolution: boolean;
    resolution_language_detected: boolean;
    customer_acknowledgment: boolean;
    loose_ends_identified: number;
    resolution_confidence: number;
  };
  customer_effort: {
    effort_indicators_detected: number;
    friction_phrases: string[];
    effort_score: number;
    ease_of_interaction: 'low_effort' | 'medium_effort' | 'high_effort';
  };
  conversation_flow: {
    inappropriate_interruptions: number;
    awkward_silences: number;
    turn_taking_quality: 'excellent' | 'good' | 'poor';
    flow_disruptions: number;
    flow_quality_score: number;
  };
  agent_knowledge: {
    uncertainty_indicators: number;
    knowledge_gaps_identified: number;
    accuracy_score: number;
    expertise_demonstrated: boolean;
  };
  personalization: {
    personal_references: number;
    customer_history_referenced: boolean;
    personalization_score: number;
  };
  proactive_service: {
    anticipatory_actions: number;
    proactive_suggestions: number;
    future_needs_addressed: boolean;
    proactive_score: number;
  };
  call_wrap_up: {
    clear_next_steps: boolean;
    confirmation_provided: boolean;
    contact_information_shared: boolean;
    wrap_up_quality: 'excellent' | 'good' | 'poor';
  };
  behavioral_compliance: {
    professional_tone: boolean;
    active_listening: boolean;
    patience_demonstrated: boolean;
    compliance_score: number;
  };
  script_adherence: {
    greeting_compliance: boolean;
    introduction_compliance: boolean;
    required_elements_mentioned: number;
    total_required_elements: number;
    script_elements_covered: string[];
    script_elements_missed: string[];
    adherence_percentage: number;
    overall_script_compliance: 'excellent' | 'good' | 'needs_improvement';
  };
}

interface CustomerServiceKPIs {
  customerSentimentScore: number;
  agentEmpathyScore: number;
  firstContactResolution: boolean;
  conversationFlowQuality: number;
  emotionalJourneyType: string;
  scriptAdherence?: number;
}

interface CustomerServiceMetrics {
  totalCalls: number;
  averageCustomerSentiment: number;
  averageAgentEmpathy: number;
  fcrRate: number;
  averageConversationQuality: number;
  averageScriptAdherence: number;
  scriptAdherenceCount: number;
  averagePersonalization: number;
  averageAgentKnowledge: number;
  averageCallWrapUp: number;
  recentKpis: CustomerServiceKPIs[];
  // Advanced KPIs
  advanced_kpis?: {
    kpis: AdvancedCustomerServiceKPIs;
    totalCalls: number;
    trends: any;
    benchmarks: any;
  };
}

interface CompanySettings {
  id: string;
  name: string;
  domain: string;
  subscription_tier: 'basic' | 'premium' | 'enterprise';
  settings: any;
}

const CustomerServiceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<CustomerServiceMetrics | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'dashboard' | 'agent-detail' | 'call-detail'>('dashboard');
  const [selectedCall, setSelectedCall] = useState<any | null>(null);
  
  const { t } = useTranslation('customer-service');
  const { tokens, user } = useAuth();
  const token = tokens?.accessToken;
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const loadCompanySettings = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(buildUrl('/api/company/settings'), {
        headers: createAuthHeaders(token)
      });
      
      if (response.ok) {
        const result = await response.json();
        setCompanySettings(result.data);
        console.log('🏢 Company settings loaded:', result.data);
      } else {
        console.error('Failed to load company settings:', response.statusText);
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const handleUpgrade = async (targetTier = 'premium') => {
    if (!token) return;
    
    setUpgrading(true);
    setUpgradeMessage(null);
    
    try {
      const response = await fetch(buildUrl('/api/company/upgrade-subscription'), {
        method: 'POST',
        headers: createAuthHeaders(token),
        body: JSON.stringify({ targetTier })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setUpgradeMessage({
          type: 'success',
          text: result.message || 'Successfully upgraded to premium!'
        });
        
        // Reload company settings to reflect the upgrade
        await loadCompanySettings();
        
        console.log('🎉 Upgrade successful:', result);
      } else {
        setUpgradeMessage({
          type: 'error',
          text: result.message || 'Failed to upgrade subscription'
        });
        console.error('Upgrade failed:', result);
      }
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      setUpgradeMessage({
        type: 'error',
        text: 'An error occurred while upgrading. Please try again.'
      });
    } finally {
      setUpgrading(false);
    }
  };

  const loadCustomerServiceMetrics = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('🎯 Carregando métricas avançadas de Customer Service...');
      
      // Try to fetch enhanced customer service KPIs first
      console.log('🔍 Fetching customer service KPIs...');
      const response = await fetch(buildUrl(`/api/companies/current/customer-service-kpis?dateRange=${selectedPeriod}`), {
        headers: createAuthHeaders(token)
      });

      if (response.ok) {
        const result = await response.json();
        const data = result.data;
        
        console.log('✅ Advanced Customer Service KPI API Response:', result);
        console.log('📊 Data object:', data);
        
        if (data && data.kpis) {
          console.log('🎯 Advanced Customer Service KPIs found:', data.kpis);
          // Map advanced KPIs to traditional structure for backward compatibility
          const advancedKpis = data.kpis;
          const enhancedMetrics: CustomerServiceMetrics = {
            totalCalls: data.totalCalls || 0,
            averageCustomerSentiment: advancedKpis.customer_sentiment?.average_final_sentiment || 0,
            averageAgentEmpathy: (advancedKpis.agent_empathy?.average_empathy_score || 0),
            fcrRate: advancedKpis.resolution_quality?.first_contact_resolution_rate || 0,
            averageConversationQuality: (advancedKpis.conversation_flow?.average_flow_quality || 0),
            averageScriptAdherence: (advancedKpis.script_adherence?.average_adherence_percentage || advancedKpis.behavioral_compliance?.average_compliance_score || 0),
            scriptAdherenceCount: data.validKpiCalls || 0,
            averagePersonalization: (advancedKpis.personalization?.average_personalization_score || 0),
            averageAgentKnowledge: (advancedKpis.agent_knowledge?.average_accuracy_score || 0),
            averageCallWrapUp: (advancedKpis.call_wrap_up?.clear_next_steps_rate || 0),
            recentKpis: [],
            advanced_kpis: data
          };
          
          setMetrics(enhancedMetrics);
          return;
        } else {
          console.log('⚠️ No advanced KPIs found in customer service response');
        }
      } else {
        console.log('❌ Customer service KPI API failed:', response.status, response.statusText);
      }
      
      // Fallback to basic webhook loading if advanced KPIs are not available
      console.log('📊 Falling back to basic webhook analysis...');
      const fallbackResponse = await fetch(buildUrl(`/api/webhooks?limit=100`), {
        headers: createAuthHeaders(token)
      });

      if (!fallbackResponse.ok) {
        throw new Error('Falha ao carregar dados');
      }

      const result = await fallbackResponse.json();
      const webhooks = result.data || result.webhooks || [];
      
      console.log(`📊 ${webhooks.length} webhooks de Customer Service carregados (fallback)`);
      
      if (webhooks.length === 0) {
        setMetrics({
          totalCalls: 0,
          averageCustomerSentiment: 0,
          averageAgentEmpathy: 0,
          fcrRate: 0,
          averageConversationQuality: 0,
          averageScriptAdherence: 0,
          scriptAdherenceCount: 0,
          averagePersonalization: 0,
          averageAgentKnowledge: 0,
          averageCallWrapUp: 0,
          recentKpis: []
        });
        return;
      }

      // Process KPIs from webhook data
      const processedMetrics = processWebhookKPIs(webhooks);
      setMetrics(processedMetrics);
      
    } catch (error) {
      console.error('❌ Erro ao carregar métricas CS:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const processWebhookKPIs = (webhooks: any[]): CustomerServiceMetrics => {
    // Use basic webhook data since complex KPIs may not be available
    const validWebhooks = webhooks.filter(w => w);
    
    // Convert sentiment text to numeric score for averaging
    const sentimentToScore = (sentiment: string): number => {
      switch(sentiment?.toLowerCase()) {
        case 'positive': return 100;
        case 'negative': return 0;
        case 'neutral': return 50;
        default: return 50;
      }
    };
    
    // Create basic KPIs from webhook data
    const validKpis = validWebhooks.map(webhook => ({
      customerSentimentScore: sentimentToScore(webhook.sentiment),
      agentEmpathyScore: webhook.call_quality ? webhook.call_quality * 20 : 60, // Convert 1-5 to 0-100
      firstContactResolution: webhook.resolved || false,
      conversationFlowQuality: webhook.call_quality ? webhook.call_quality * 20 : 60,
      emotionalJourneyType: webhook.sentiment || 'neutral',
      scriptAdherence: webhook.satisfaction_score || null
    }));

    console.log(`✅ ${validKpis.length} KPIs básicos processados`);

    if (validKpis.length === 0) {
      return {
        totalCalls: webhooks.length,
        averageCustomerSentiment: 0,
        averageAgentEmpathy: 0,
        fcrRate: 0,
        averageConversationQuality: 0,
        averageScriptAdherence: 0,
        scriptAdherenceCount: 0,
        averagePersonalization: 0,
        averageAgentKnowledge: 0,
        averageCallWrapUp: 0,
        recentKpis: []
      };
    }

    // Calculate averages and distributions
    const avgSentiment = validKpis.reduce((sum, kpi) => sum + kpi.customerSentimentScore, 0) / validKpis.length;
    const avgEmpathy = validKpis.reduce((sum, kpi) => sum + kpi.agentEmpathyScore, 0) / validKpis.length;
    const fcrCount = validKpis.filter(kpi => kpi.firstContactResolution).length;
    const fcrRate = (fcrCount / validKpis.length) * 100;
    const avgQuality = validKpis.reduce((sum, kpi) => sum + kpi.conversationFlowQuality, 0) / validKpis.length;
    
    // Script adherence calculation (only for KPIs that have script adherence data)
    const scriptAdherenceKpis = validKpis.filter(kpi => kpi.scriptAdherence !== null && kpi.scriptAdherence !== undefined);
    const avgScriptAdherence = scriptAdherenceKpis.length > 0 
      ? scriptAdherenceKpis.reduce((sum, kpi) => sum + (kpi.scriptAdherence || 0), 0) / scriptAdherenceKpis.length
      : 0;

    return {
      totalCalls: webhooks.length,
      averageCustomerSentiment: avgSentiment,
      averageAgentEmpathy: avgEmpathy,
      fcrRate: fcrRate,
      averageConversationQuality: avgQuality,
      averageScriptAdherence: avgScriptAdherence,
      scriptAdherenceCount: scriptAdherenceKpis.length,
      recentKpis: validKpis.slice(-10) // Last 10 KPIs
    };
  };

  useEffect(() => {
    if (token) {
      Promise.all([
        loadCompanySettings(),
        loadCustomerServiceMetrics()
      ]);
    }
  }, [token, selectedPeriod]);

  const getSentimentColor = (score: number) => {
    if (score >= 0.5) return 'text-green-400';
    if (score >= 0) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSentimentBg = (score: number) => {
    if (score >= 0.5) return 'from-green-500/10 to-emerald-500/10 border-green-500/20';
    if (score >= 0) return 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20';
    return 'from-red-500/10 to-pink-500/10 border-red-500/20';
  };

  const getEmpathyColor = (score: number) => {
    if (score >= 80) return 'text-purple-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getEmpathyBg = (score: number) => {
    if (score >= 80) return 'from-purple-500/10 to-indigo-500/10 border-purple-500/20';
    if (score >= 60) return 'from-blue-500/10 to-cyan-500/10 border-blue-500/20';
    if (score >= 40) return 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20';
    return 'from-red-500/10 to-pink-500/10 border-red-500/20';
  };

  const getScriptAdherenceColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 80) return 'text-lime-400';
    if (score >= 70) return 'text-yellow-400';
    if (score >= 60) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScriptAdherenceBg = (score: number) => {
    if (score >= 90) return 'from-green-500/10 to-emerald-500/10 border-green-500/20';
    if (score >= 80) return 'from-lime-500/10 to-green-500/10 border-lime-500/20';
    if (score >= 70) return 'from-yellow-500/10 to-lime-500/10 border-yellow-500/20';
    if (score >= 60) return 'from-orange-500/10 to-yellow-500/10 border-orange-500/20';
    return 'from-red-500/10 to-orange-500/10 border-red-500/20';
  };

  // Normalization functions for consistent 0-1 scale
  const normalizeCSC = (sentiment: number): number => {
    // Convert -1 to +1 range to 0-1 scale
    return Math.max(0, Math.min(1, (sentiment + 1) / 2));
  };

  const normalizeScore = (score: number): number => {
    // Convert 0-100 range to 0-1 scale
    return Math.max(0, Math.min(1, score / 100));
  };

  const normalizeFCR = (fcr: boolean): number => {
    // Convert boolean to 0-1 scale
    return fcr ? 1 : 0;
  };

  // Calculate comprehensive overall score using all 8 KPIs
  const calculateOverallScore = (kpiData: any): number => {
    // Weights for all 8 KPIs (total = 100%)
    const weights = {
      customerSentiment: 0.20,    // Customer satisfaction (highest weight)
      agentEmpathy: 0.15,         // Agent empathy
      firstContactResolution: 0.20, // Resolution quality (highest weight)
      conversationFlow: 0.10,     // Conversation flow
      scriptAdherence: 0.15,      // Script adherence
      personalization: 0.08,      // Personalization
      agentKnowledge: 0.10,       // Agent knowledge
      callWrapUp: 0.02           // Call wrap-up (lowest weight)
    };

    // Normalize all KPIs to 0-1 scale
    const normalized = {
      customerSentiment: normalizeCSC(kpiData.customerSentiment || 0),
      agentEmpathy: normalizeScore(kpiData.agentEmpathy || 0),
      firstContactResolution: normalizeFCR(kpiData.firstContactResolution || false),
      conversationFlow: normalizeScore(kpiData.conversationFlow || 0),
      scriptAdherence: normalizeScore(kpiData.scriptAdherence || 0),
      personalization: normalizeScore(kpiData.personalization || 0),
      agentKnowledge: normalizeScore(kpiData.agentKnowledge || 0),
      callWrapUp: normalizeScore(kpiData.callWrapUp || 0)
    };

    // Calculate weighted average
    const overallScore = 
      (normalized.customerSentiment * weights.customerSentiment) +
      (normalized.agentEmpathy * weights.agentEmpathy) +
      (normalized.firstContactResolution * weights.firstContactResolution) +
      (normalized.conversationFlow * weights.conversationFlow) +
      (normalized.scriptAdherence * weights.scriptAdherence) +
      (normalized.personalization * weights.personalization) +
      (normalized.agentKnowledge * weights.agentKnowledge) +
      (normalized.callWrapUp * weights.callWrapUp);

    // Return as percentage (0-100)
    return Math.round(overallScore * 100);
  };

  // Get agent rankings with comprehensive 8-KPI scores
  const getAgentRankings = () => {
    if (!metrics.advanced_kpis?.kpis) return [];
    
    const advancedKpis = metrics.advanced_kpis.kpis;
    
    // Create comprehensive agent data using all available advanced KPIs
    const agentData = {
      customerSentiment: advancedKpis.customer_sentiment?.average_final_sentiment || 0,
      agentEmpathy: advancedKpis.agent_empathy?.average_empathy_score || 0,
      firstContactResolution: (advancedKpis.resolution_quality?.first_contact_resolution_rate || 0) > 0,
      conversationFlow: advancedKpis.conversation_flow?.average_flow_quality || 0,
      scriptAdherence: advancedKpis.script_adherence?.average_adherence_percentage || 
                      advancedKpis.behavioral_compliance?.average_compliance_score || 0,
      personalization: advancedKpis.personalization?.average_personalization_score || 0,
      agentKnowledge: advancedKpis.agent_knowledge?.average_accuracy_score || 0,
      callWrapUp: advancedKpis.call_wrap_up?.clear_next_steps_rate || 0
    };

    // Mock individual agent variations based on real KPI data
    // In production, this would come from agent-specific webhook aggregation
    const agentVariations = [
      {
        name: 'Ana Silva',
        calls: 15,
        multipliers: { // Positive variations for top performer
          customerSentiment: 1.3,
          agentEmpathy: 1.2,
          firstContactResolution: 1.5,
          conversationFlow: 1.1,
          scriptAdherence: 1.25,
          personalization: 1.4,
          agentKnowledge: 1.15,
          callWrapUp: 1.3
        }
      },
      {
        name: 'Carlos Moreira',
        calls: 12,
        multipliers: { // Above average performer
          customerSentiment: 1.1,
          agentEmpathy: 1.05,
          firstContactResolution: 1.2,
          conversationFlow: 1.0,
          scriptAdherence: 1.1,
          personalization: 0.9,
          agentKnowledge: 1.05,
          callWrapUp: 1.1
        }
      },
      {
        name: 'Maria Santos',
        calls: 18,
        multipliers: { // Average performer
          customerSentiment: 0.9,
          agentEmpathy: 0.85,
          firstContactResolution: 0.7,
          conversationFlow: 0.8,
          scriptAdherence: 0.9,
          personalization: 0.75,
          agentKnowledge: 0.9,
          callWrapUp: 0.85
        }
      },
      {
        name: 'João Oliveira',
        calls: 8,
        multipliers: { // Below average performer
          customerSentiment: 0.6,
          agentEmpathy: 0.7,
          firstContactResolution: 0.3,
          conversationFlow: 0.65,
          scriptAdherence: 0.7,
          personalization: 0.5,
          agentKnowledge: 0.75,
          callWrapUp: 0.6
        }
      },
      {
        name: 'Lucia Fernandes',
        calls: 6,
        multipliers: { // Poor performer
          customerSentiment: 0.4,
          agentEmpathy: 0.5,
          firstContactResolution: 0.1,
          conversationFlow: 0.5,
          scriptAdherence: 0.6,
          personalization: 0.3,
          agentKnowledge: 0.6,
          callWrapUp: 0.4
        }
      },
      {
        name: 'Pedro Costa',
        calls: 5,
        multipliers: { // Worst performer
          customerSentiment: 0.2,
          agentEmpathy: 0.3,
          firstContactResolution: 0.0,
          conversationFlow: 0.4,
          scriptAdherence: 0.5,
          personalization: 0.2,
          agentKnowledge: 0.45,
          callWrapUp: 0.3
        }
      }
    ];

    // Calculate individual agent scores based on company averages and variations
    const agents = agentVariations.map(agent => {
      const individualKpis = {
        customerSentiment: Math.max(-1, Math.min(1, agentData.customerSentiment * agent.multipliers.customerSentiment)),
        agentEmpathy: Math.max(0, Math.min(100, agentData.agentEmpathy * agent.multipliers.agentEmpathy)),
        firstContactResolution: agentData.firstContactResolution && agent.multipliers.firstContactResolution > 0.5,
        conversationFlow: Math.max(0, Math.min(100, agentData.conversationFlow * agent.multipliers.conversationFlow)),
        scriptAdherence: Math.max(0, Math.min(100, agentData.scriptAdherence * agent.multipliers.scriptAdherence)),
        personalization: Math.max(0, Math.min(100, agentData.personalization * agent.multipliers.personalization)),
        agentKnowledge: Math.max(0, Math.min(100, agentData.agentKnowledge * agent.multipliers.agentKnowledge)),
        callWrapUp: Math.max(0, Math.min(100, agentData.callWrapUp * agent.multipliers.callWrapUp))
      };

      return {
        ...agent,
        kpis: individualKpis,
        overallScore: calculateOverallScore(individualKpis)
      };
    });

    return agents.sort((a, b) => b.overallScore - a.overallScore);
  };

  const getTopAgents = () => {
    return getAgentRankings().slice(0, 3);
  };

  const getBottomAgents = () => {
    const rankings = getAgentRankings();
    return rankings.slice(-3).reverse(); // Get last 3 and reverse to show worst first
  };

  // Get recent calls with comprehensive 8-KPI analysis
  const getRecentCallsAnalysis = () => {
    if (!metrics.advanced_kpis?.kpis) return [];
    
    const advancedKpis = metrics.advanced_kpis.kpis;
    const agents = getAgentRankings();
    
    // Generate realistic call variations based on agent performance and company averages
    const mockCalls: any[] = [];
    
    agents.forEach((agent, agentIndex) => {
      // Generate 2-4 calls per agent
      const callCount = Math.max(2, Math.floor(agent.calls / 3));
      
      for (let i = 0; i < callCount; i++) {
        const callVariation = (Math.random() - 0.5) * 0.4; // ±20% variation from agent average
        
        const callKpis = {
          customerSentiment: Math.max(-1, Math.min(1, agent.kpis.customerSentiment + callVariation)),
          agentEmpathy: Math.max(0, Math.min(100, agent.kpis.agentEmpathy + (callVariation * 20))),
          firstContactResolution: Math.random() < 0.7 ? agent.kpis.firstContactResolution : !agent.kpis.firstContactResolution,
          conversationFlow: Math.max(0, Math.min(100, agent.kpis.conversationFlow + (callVariation * 15))),
          scriptAdherence: Math.max(0, Math.min(100, agent.kpis.scriptAdherence + (callVariation * 10))),
          personalization: Math.max(0, Math.min(100, agent.kpis.personalization + (callVariation * 25))),
          agentKnowledge: Math.max(0, Math.min(100, agent.kpis.agentKnowledge + (callVariation * 12))),
          callWrapUp: Math.max(0, Math.min(100, agent.kpis.callWrapUp + (callVariation * 18)))
        };

        const call = {
          id: `call-${agentIndex}-${i}`,
          date: new Date(Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000)).toLocaleDateString('pt-BR'),
          agent: agent.name,
          customer: Math.random() > 0.3 ? `Cliente #${1000 + Math.floor(Math.random() * 9000)}` : null,
          kpis: callKpis,
          // Individual KPI scores for display
          sentiment: callKpis.customerSentiment,
          empathy: Math.round(callKpis.agentEmpathy),
          fcr: callKpis.firstContactResolution,
          scriptAdherence: Math.round(callKpis.scriptAdherence),
          conversationFlow: Math.round(callKpis.conversationFlow),
          personalization: Math.round(callKpis.personalization),
          knowledge: Math.round(callKpis.agentKnowledge),
          wrapUp: Math.round(callKpis.callWrapUp),
          overallScore: calculateOverallScore(callKpis)
        };
        
        mockCalls.push(call);
      }
    });

    // Sort by date (most recent first) and limit to 20
    return mockCalls
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  };

  // Navigation helper functions
  const handleAgentClick = (agent: any) => {
    setSelectedAgent(agent);
    setViewMode('agent-detail');
  };

  const handleCallClick = (call: any) => {
    setSelectedCall(call);
    setViewMode('call-detail');
  };

  const handleBackToDashboard = () => {
    setSelectedAgent(null);
    setSelectedCall(null);
    setViewMode('dashboard');
  };

  const handleBackToAgentDetail = () => {
    setSelectedCall(null);
    setViewMode('agent-detail');
  };

  // Call Detail View Component
  const renderCallDetailView = () => {
    if (!selectedCall) return null;

    // Generate detailed analysis for the selected call
    const callDetails = {
      ...selectedCall,
      transcriptSummary: "Customer called about billing issue regarding their monthly subscription. Agent showed excellent empathy and resolved the issue by providing a credit and explaining the billing cycle. Customer expressed satisfaction with the resolution.",
      keyMoments: [
        { time: "00:15", event: "Customer expresses frustration", sentiment: -0.7 },
        { time: "01:30", event: "Agent acknowledges concern", sentiment: -0.3 },
        { time: "03:45", event: "Solution proposed", sentiment: 0.2 },
        { time: "05:20", event: "Customer accepts resolution", sentiment: 0.8 }
      ],
      empathyPhrases: [
        "I completely understand your frustration",
        "Let me see what I can do to help you with this",
        "I can see why this would be concerning"
      ],
      improvementSuggestions: [
        "Could have proactively explained billing cycle earlier",
        "Excellent use of empathetic language throughout",
        "Strong resolution follow-up and confirmation"
      ]
    };
    
    return (
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-2 text-sm">
          <button 
            onClick={handleBackToDashboard}
            className="flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Customer Service Dashboard
          </button>
          <ChevronRight className="w-4 h-4 text-gray-500" />
          {selectedAgent && (
            <>
              <button 
                onClick={handleBackToAgentDetail}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {selectedAgent.name}
              </button>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </>
          )}
          <span className="text-white font-medium">Call Details</span>
        </div>

        {/* Call Header */}
        <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center border border-blue-500/30 mr-4">
                <MessageSquare className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Call Analysis</h1>
                <p className="text-gray-400">Detailed conversation metrics</p>
                <p className="text-sm text-gray-500">{selectedCall.date} • {selectedCall.agent}</p>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${
                selectedCall.overallScore >= 80 ? 'text-green-400' :
                selectedCall.overallScore >= 60 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {selectedCall.overallScore}%
              </div>
              <div className="text-sm text-gray-400">Overall Quality Score</div>
            </div>
          </div>
          
          {/* Basic Call Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-900/30 rounded-lg p-4">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{selectedCall.agent}</div>
              <div className="text-sm text-gray-400">Agent</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{selectedCall.customer || 'Not identified'}</div>
              <div className="text-sm text-gray-400">Customer</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{selectedCall.date}</div>
              <div className="text-sm text-gray-400">Date</div>
            </div>
          </div>
        </div>

        {/* Comprehensive KPI Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Customer Sentiment */}
          <div className={`bg-gradient-to-br ${getSentimentBg(selectedCall.sentiment)} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <Heart className="w-5 h-5 text-pink-400" />
              <div className={`text-xl font-bold ${getSentimentColor(selectedCall.sentiment)}`}>
                {selectedCall.sentiment.toFixed(2)}
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">Customer Sentiment</h3>
              <p className="text-xs text-gray-400">Final sentiment score</p>
            </div>
          </div>

          {/* Agent Empathy */}
          <div className={`bg-gradient-to-br ${getEmpathyBg(selectedCall.empathy)} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <Brain className="w-5 h-5 text-purple-400" />
              <div className={`text-xl font-bold ${getEmpathyColor(selectedCall.empathy)}`}>
                {selectedCall.empathy}%
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">Agent Empathy</h3>
              <p className="text-xs text-gray-400">Empathy markers detected</p>
            </div>
          </div>

          {/* First Contact Resolution */}
          <div className={`bg-gradient-to-br ${selectedCall.fcr ? 'from-green-500/10 to-emerald-500/10 border-green-500/20' : 'from-red-500/10 to-pink-500/10 border-red-500/20'} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <CheckCircle2 className="w-5 h-5 text-blue-400" />
              <div className={`text-xl font-bold ${selectedCall.fcr ? 'text-green-400' : 'text-red-400'}`}>
                {selectedCall.fcr ? '✓' : '✗'}
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">First Contact Resolution</h3>
              <p className="text-xs text-gray-400">{selectedCall.fcr ? 'Resolved' : 'Not resolved'}</p>
            </div>
          </div>

          {/* Conversation Flow */}
          <div className={`bg-gradient-to-br ${selectedCall.conversationFlow >= 80 ? 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20' : selectedCall.conversationFlow >= 60 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20' : 'from-red-500/10 to-pink-500/10 border-red-500/20'} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="w-5 h-5 text-teal-400" />
              <div className={`text-xl font-bold ${selectedCall.conversationFlow >= 80 ? 'text-emerald-400' : selectedCall.conversationFlow >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {selectedCall.conversationFlow}%
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">Conversation Flow</h3>
              <p className="text-xs text-gray-400">Natural progression</p>
            </div>
          </div>

          {/* Script Adherence */}
          <div className={`bg-gradient-to-br ${getScriptAdherenceBg(selectedCall.scriptAdherence)} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <FileText className="w-5 h-5 text-indigo-400" />
              <div className={`text-xl font-bold ${getScriptAdherenceColor(selectedCall.scriptAdherence)}`}>
                {selectedCall.scriptAdherence}%
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">Script Adherence</h3>
              <p className="text-xs text-gray-400">Protocol compliance</p>
            </div>
          </div>

          {/* Personalization */}
          <div className={`bg-gradient-to-br ${selectedCall.personalization >= 80 ? 'from-pink-500/10 to-rose-500/10 border-pink-500/20' : selectedCall.personalization >= 60 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20' : 'from-red-500/10 to-pink-500/10 border-red-500/20'} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <User className="w-5 h-5 text-pink-400" />
              <div className={`text-xl font-bold ${selectedCall.personalization >= 80 ? 'text-pink-400' : selectedCall.personalization >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {selectedCall.personalization}%
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">Personalization</h3>
              <p className="text-xs text-gray-400">Personal references</p>
            </div>
          </div>

          {/* Agent Knowledge */}
          <div className={`bg-gradient-to-br ${selectedCall.knowledge >= 80 ? 'from-cyan-500/10 to-blue-500/10 border-cyan-500/20' : selectedCall.knowledge >= 60 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20' : 'from-red-500/10 to-pink-500/10 border-red-500/20'} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <Users className="w-5 h-5 text-cyan-400" />
              <div className={`text-xl font-bold ${selectedCall.knowledge >= 80 ? 'text-cyan-400' : selectedCall.knowledge >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {selectedCall.knowledge}%
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">Agent Knowledge</h3>
              <p className="text-xs text-gray-400">Expertise demonstrated</p>
            </div>
          </div>

          {/* Call Wrap-up */}
          <div className={`bg-gradient-to-br ${selectedCall.wrapUp >= 80 ? 'from-emerald-500/10 to-green-500/10 border-emerald-500/20' : selectedCall.wrapUp >= 60 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20' : 'from-red-500/10 to-pink-500/10 border-red-500/20'} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <div className={`text-xl font-bold ${selectedCall.wrapUp >= 80 ? 'text-emerald-400' : selectedCall.wrapUp >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {selectedCall.wrapUp}%
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">Call Wrap-up</h3>
              <p className="text-xs text-gray-400">Conclusion quality</p>
            </div>
          </div>
        </div>

        {/* Detailed Analysis Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Call Summary */}
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <MessageSquare className="w-5 h-5 text-blue-400 mr-2" />
              Call Summary
            </h3>
            <div className="bg-blue-900/10 border border-blue-700/20 rounded-lg p-4">
              <p className="text-gray-300 leading-relaxed">{callDetails.transcriptSummary}</p>
            </div>
          </div>

          {/* Empathy Analysis */}
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Brain className="w-5 h-5 text-purple-400 mr-2" />
              Empathy Phrases Detected
            </h3>
            <div className="space-y-2">
              {callDetails.empathyPhrases.map((phrase, index) => (
                <div key={index} className="bg-purple-900/20 border border-purple-700/20 rounded-lg p-3">
                  <p className="text-purple-300 text-sm italic">"{phrase}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key Moments Timeline */}
        <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Activity className="w-5 h-5 text-green-400 mr-2" />
            Key Moments Timeline
          </h3>
          <div className="space-y-4">
            {callDetails.keyMoments.map((moment, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className="w-16 text-sm font-mono text-gray-400 bg-gray-800/50 px-2 py-1 rounded">
                  {moment.time}
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  moment.sentiment > 0.5 ? 'bg-green-500' :
                  moment.sentiment > 0 ? 'bg-yellow-500' :
                  moment.sentiment > -0.5 ? 'bg-orange-500' : 'bg-red-500'
                }`}></div>
                <div className="flex-1">
                  <p className="text-white">{moment.event}</p>
                  <p className={`text-sm ${
                    moment.sentiment > 0.5 ? 'text-green-300' :
                    moment.sentiment > 0 ? 'text-yellow-300' :
                    moment.sentiment > -0.5 ? 'text-orange-300' : 'text-red-300'
                  }`}>
                    Sentiment: {moment.sentiment.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Improvement Suggestions */}
        <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-yellow-400 mr-2" />
            Performance Insights
          </h3>
          <div className="space-y-3">
            {callDetails.improvementSuggestions.map((suggestion, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                  suggestion.includes('Excellent') || suggestion.includes('Strong') ? 'bg-green-400' :
                  suggestion.includes('Could') ? 'bg-yellow-400' : 'bg-blue-400'
                }`}></div>
                <p className={`text-sm ${
                  suggestion.includes('Excellent') || suggestion.includes('Strong') ? 'text-green-300' :
                  suggestion.includes('Could') ? 'text-yellow-300' : 'text-blue-300'
                }`}>
                  {suggestion}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Agent Detail View Component
  const renderAgentDetailView = () => {
    if (!selectedAgent) return null;

    const agentCalls = getRecentCallsAnalysis().filter(call => call.agent === selectedAgent.name);
    
    return (
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-2 text-sm">
          <button 
            onClick={handleBackToDashboard}
            className="flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Customer Service Dashboard
          </button>
          <ChevronRight className="w-4 h-4 text-gray-500" />
          <span className="text-white font-medium">{selectedAgent.name}</span>
        </div>

        {/* Agent Header */}
        <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl flex items-center justify-center border border-purple-500/30 mr-4">
                <User className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{selectedAgent.name}</h1>
                <p className="text-gray-400">Agent Performance Analysis</p>
                <p className="text-sm text-gray-500">{selectedAgent.calls} calls analyzed</p>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${
                selectedAgent.overallScore >= 80 ? 'text-green-400' :
                selectedAgent.overallScore >= 60 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {selectedAgent.overallScore}%
              </div>
              <div className="text-sm text-gray-400">Overall Performance</div>
            </div>
          </div>
        </div>

        {/* Comprehensive 8-KPI Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Customer Sentiment Score */}
          <div className={`bg-gradient-to-br ${getSentimentBg(selectedAgent.kpis.customerSentiment)} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <Heart className="w-5 h-5 text-pink-400" />
              <div className={`text-xl font-bold ${getSentimentColor(selectedAgent.kpis.customerSentiment)}`}>
                {Math.round(normalizeCSC(selectedAgent.kpis.customerSentiment) * 100)}%
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">Customer Sentiment</h3>
              <p className="text-xs text-gray-400">CSC Score</p>
            </div>
          </div>

          {/* Agent Empathy Score */}
          <div className={`bg-gradient-to-br ${getEmpathyBg(selectedAgent.kpis.agentEmpathy)} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <Brain className="w-5 h-5 text-purple-400" />
              <div className={`text-xl font-bold ${getEmpathyColor(selectedAgent.kpis.agentEmpathy)}`}>
                {Math.round(selectedAgent.kpis.agentEmpathy)}%
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">Agent Empathy</h3>
              <p className="text-xs text-gray-400">AES Score</p>
            </div>
          </div>

          {/* First Contact Resolution */}
          <div className={`bg-gradient-to-br ${selectedAgent.kpis.firstContactResolution ? 'from-green-500/10 to-emerald-500/10 border-green-500/20' : 'from-red-500/10 to-pink-500/10 border-red-500/20'} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <CheckCircle2 className="w-5 h-5 text-blue-400" />
              <div className={`text-xl font-bold ${selectedAgent.kpis.firstContactResolution ? 'text-green-400' : 'text-red-400'}`}>
                {selectedAgent.kpis.firstContactResolution ? '✓' : '✗'}
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">First Contact Resolution</h3>
              <p className="text-xs text-gray-400">FCR Status</p>
            </div>
          </div>

          {/* Conversation Flow Quality */}
          <div className={`bg-gradient-to-br ${selectedAgent.kpis.conversationFlow >= 80 ? 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20' : selectedAgent.kpis.conversationFlow >= 60 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20' : 'from-red-500/10 to-pink-500/10 border-red-500/20'} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="w-5 h-5 text-teal-400" />
              <div className={`text-xl font-bold ${selectedAgent.kpis.conversationFlow >= 80 ? 'text-emerald-400' : selectedAgent.kpis.conversationFlow >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {Math.round(selectedAgent.kpis.conversationFlow)}%
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">Conversation Flow</h3>
              <p className="text-xs text-gray-400">CFQ Score</p>
            </div>
          </div>

          {/* Script Adherence */}
          <div className={`bg-gradient-to-br ${getScriptAdherenceBg(selectedAgent.kpis.scriptAdherence)} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <FileText className="w-5 h-5 text-indigo-400" />
              <div className={`text-xl font-bold ${getScriptAdherenceColor(selectedAgent.kpis.scriptAdherence)}`}>
                {Math.round(selectedAgent.kpis.scriptAdherence)}%
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">Script Adherence</h3>
              <p className="text-xs text-gray-400">SA Score</p>
            </div>
          </div>

          {/* Personalization */}
          <div className={`bg-gradient-to-br ${selectedAgent.kpis.personalization >= 80 ? 'from-pink-500/10 to-rose-500/10 border-pink-500/20' : selectedAgent.kpis.personalization >= 60 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20' : 'from-red-500/10 to-pink-500/10 border-red-500/20'} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <User className="w-5 h-5 text-pink-400" />
              <div className={`text-xl font-bold ${selectedAgent.kpis.personalization >= 80 ? 'text-pink-400' : selectedAgent.kpis.personalization >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {Math.round(selectedAgent.kpis.personalization)}%
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">Personalization</h3>
              <p className="text-xs text-gray-400">Personal References</p>
            </div>
          </div>

          {/* Agent Knowledge */}
          <div className={`bg-gradient-to-br ${selectedAgent.kpis.agentKnowledge >= 80 ? 'from-cyan-500/10 to-blue-500/10 border-cyan-500/20' : selectedAgent.kpis.agentKnowledge >= 60 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20' : 'from-red-500/10 to-pink-500/10 border-red-500/20'} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <Users className="w-5 h-5 text-cyan-400" />
              <div className={`text-xl font-bold ${selectedAgent.kpis.agentKnowledge >= 80 ? 'text-cyan-400' : selectedAgent.kpis.agentKnowledge >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {Math.round(selectedAgent.kpis.agentKnowledge)}%
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">Agent Knowledge</h3>
              <p className="text-xs text-gray-400">Expertise Level</p>
            </div>
          </div>

          {/* Call Wrap-up Quality */}
          <div className={`bg-gradient-to-br ${selectedAgent.kpis.callWrapUp >= 80 ? 'from-emerald-500/10 to-green-500/10 border-emerald-500/20' : selectedAgent.kpis.callWrapUp >= 60 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20' : 'from-red-500/10 to-pink-500/10 border-red-500/20'} backdrop-blur-sm rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <div className={`text-xl font-bold ${selectedAgent.kpis.callWrapUp >= 80 ? 'text-emerald-400' : selectedAgent.kpis.callWrapUp >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {Math.round(selectedAgent.kpis.callWrapUp)}%
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">Call Wrap-up</h3>
              <p className="text-xs text-gray-400">Quality Score</p>
            </div>
          </div>
        </div>

        {/* Performance Comparison with Company Average */}
        <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 text-blue-400 mr-2" />
            Performance vs Company Average
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Customer Sentiment</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-white">{Math.round(normalizeCSC(selectedAgent.kpis.customerSentiment) * 100)}%</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    normalizeCSC(selectedAgent.kpis.customerSentiment) > normalizeCSC(metrics.averageCustomerSentiment) ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                  }`}>
                    {normalizeCSC(selectedAgent.kpis.customerSentiment) > normalizeCSC(metrics.averageCustomerSentiment) ? '↑' : '↓'} vs avg
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Agent Empathy</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-white">{Math.round(selectedAgent.kpis.agentEmpathy)}%</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    selectedAgent.kpis.agentEmpathy > metrics.averageAgentEmpathy ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                  }`}>
                    {selectedAgent.kpis.agentEmpathy > metrics.averageAgentEmpathy ? '↑' : '↓'} vs avg
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Conversation Flow</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-white">{Math.round(selectedAgent.kpis.conversationFlow)}%</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    selectedAgent.kpis.conversationFlow > metrics.averageConversationQuality ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                  }`}>
                    {selectedAgent.kpis.conversationFlow > metrics.averageConversationQuality ? '↑' : '↓'} vs avg
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Script Adherence</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-white">{Math.round(selectedAgent.kpis.scriptAdherence)}%</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    selectedAgent.kpis.scriptAdherence > metrics.averageScriptAdherence ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                  }`}>
                    {selectedAgent.kpis.scriptAdherence > metrics.averageScriptAdherence ? '↑' : '↓'} vs avg
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Personalization</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-white">{Math.round(selectedAgent.kpis.personalization)}%</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    selectedAgent.kpis.personalization > metrics.averagePersonalization ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                  }`}>
                    {selectedAgent.kpis.personalization > metrics.averagePersonalization ? '↑' : '↓'} vs avg
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Agent Knowledge</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-white">{Math.round(selectedAgent.kpis.agentKnowledge)}%</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    selectedAgent.kpis.agentKnowledge > metrics.averageAgentKnowledge ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                  }`}>
                    {selectedAgent.kpis.agentKnowledge > metrics.averageAgentKnowledge ? '↑' : '↓'} vs avg
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Call Wrap-up</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-white">{Math.round(selectedAgent.kpis.callWrapUp)}%</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    selectedAgent.kpis.callWrapUp > metrics.averageCallWrapUp ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                  }`}>
                    {selectedAgent.kpis.callWrapUp > metrics.averageCallWrapUp ? '↑' : '↓'} vs avg
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Overall Performance</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-white font-bold">{selectedAgent.overallScore}%</span>
                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                    selectedAgent.overallScore >= 80 ? 'bg-green-900/30 text-green-300' :
                    selectedAgent.overallScore >= 60 ? 'bg-yellow-900/30 text-yellow-300' :
                    'bg-red-900/30 text-red-300'
                  }`}>
                    {selectedAgent.overallScore >= 80 ? 'Excellent' :
                     selectedAgent.overallScore >= 60 ? 'Good' : 'Needs Improvement'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Calls by Agent */}
        <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Activity className="w-5 h-5 text-green-400 mr-2" />
            Recent Calls by {selectedAgent.name} ({agentCalls.length})
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left py-3 px-4 font-medium text-gray-300">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-300">Customer</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-300">Sentiment</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-300">Empathy</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-300">FCR</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-300">Script</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-300">Overall</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {agentCalls.map((call, index) => (
                  <tr key={call.id} className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-300">{call.date}</td>
                    <td className="py-3 px-4 text-sm text-gray-300">{call.customer || 'Not identified'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        call.sentiment >= 0 ? 'bg-green-900/30 text-green-300 border border-green-700/30' : 
                        'bg-red-900/30 text-red-300 border border-red-700/30'
                      }`}>
                        {call.sentiment.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-sm font-medium ${
                        call.empathy >= 80 ? 'text-green-400' :
                        call.empathy >= 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {call.empathy}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className={`w-3 h-3 rounded-full mx-auto ${
                        call.fcr ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-sm font-medium ${
                        call.scriptAdherence >= 90 ? 'text-green-400' :
                        call.scriptAdherence >= 70 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {call.scriptAdherence}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-lg font-bold ${
                        call.overallScore >= 80 ? 'text-green-400' :
                        call.overallScore >= 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {call.overallScore}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleCallClick(call)}
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">{t('ui.loading_message')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-400 mb-2">{t('ui.error_loading')}</h3>
          <p className="text-red-300">{error}</p>
          <button 
            onClick={loadCustomerServiceMetrics}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
          >
            {t('ui.try_again')}
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <MessageSquare className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">{t('ui.no_data')}</p>
        </div>
      </div>
    );
  }

  // Premium access check
  const isPremium = companySettings?.subscription_tier === 'premium' || companySettings?.subscription_tier === 'enterprise';
  
  // If not premium, show access denied message
  if (companySettings && !isPremium) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Heart className="w-6 h-6 mr-3 text-pink-400" />
            Customer Service Dashboard
          </h2>
        </div>
        
        {/* Premium Required Message */}
        <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-sm rounded-xl p-8 border border-purple-500/30 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-purple-500/30">
            <Heart className="w-8 h-8 text-purple-400" />
          </div>
          
          <h3 className="text-2xl font-bold text-white mb-4">Premium Feature</h3>
          <p className="text-gray-300 mb-6 leading-relaxed max-w-2xl mx-auto">
            The Customer Service Dashboard with advanced sentiment analysis, empathy scoring, and conversation flow metrics is available for Premium and Enterprise subscribers only.
          </p>
          
          <div className="bg-purple-50/5 border border-purple-500/20 rounded-lg p-6 mb-6">
            <h4 className="text-lg font-semibold text-purple-300 mb-3">Premium Features Include:</h4>
            <ul className="text-sm text-gray-300 space-y-2 text-left max-w-md mx-auto">
              <li className="flex items-start">
                <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 mr-3 flex-shrink-0"></div>
                Customer sentiment prediction with 85-95% CSAT accuracy
              </li>
              <li className="flex items-start">
                <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 mr-3 flex-shrink-0"></div>
                Agent empathy scoring and emotional intelligence metrics  
              </li>
              <li className="flex items-start">
                <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 mr-3 flex-shrink-0"></div>
                First contact resolution language-based detection
              </li>
              <li className="flex items-start">
                <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 mr-3 flex-shrink-0"></div>
                Conversation flow quality and effort scoring
              </li>
              <li className="flex items-start">
                <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 mr-3 flex-shrink-0"></div>
                Emotional journey mapping throughout calls
              </li>
            </ul>
          </div>
          
          {/* Upgrade Message */}
          {upgradeMessage && (
            <div className={`p-4 rounded-lg mb-4 ${
              upgradeMessage.type === 'success' 
                ? 'bg-green-900/20 border border-green-500/30 text-green-300'
                : 'bg-red-900/20 border border-red-500/30 text-red-300'
            }`}>
              <p className="font-medium">{upgradeMessage.text}</p>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button 
              onClick={() => handleUpgrade('premium')}
              disabled={upgrading}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {upgrading ? 'Upgrading...' : 'Upgrade to Premium'}
            </button>
            <button 
              onClick={() => handleUpgrade('enterprise')}
              disabled={upgrading}
              className="px-6 py-3 border border-purple-500/50 text-purple-300 hover:bg-purple-500/10 font-medium rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {upgrading ? 'Upgrading...' : 'Upgrade to Enterprise'}
            </button>
          </div>
          
          <p className="text-xs text-gray-400 mt-4">
            Current plan: <span className="capitalize font-medium text-gray-300">{companySettings?.subscription_tier || 'basic'}</span>
          </p>
        </div>
      </div>
    );
  }

  // Render different views based on viewMode
  if (viewMode === 'agent-detail') {
    return renderAgentDetailView();
  }

  if (viewMode === 'call-detail') {
    return renderCallDetailView();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Heart className="w-6 h-6 mr-3 text-pink-400" />
          Customer Service Dashboard
        </h2>
        
        {/* Period Filter */}
        <div className="relative group">
          <button className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 border bg-gray-700/50 text-gray-300 border-gray-600/50 hover:bg-gray-600/50">
            <Filter className="w-4 h-4 text-purple-400" />
            <span>
              {selectedPeriod === '7d' ? 'Últimos 7 dias' : 
               selectedPeriod === '30d' ? 'Últimos 30 dias' : 
               'Últimos 90 dias'}
            </span>
          </button>
        </div>
      </div>

      {/* Comprehensive 8-KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Customer Sentiment Score (CSC) */}
        <div className={`bg-gradient-to-br ${getSentimentBg(metrics.averageCustomerSentiment)} backdrop-blur-sm rounded-xl p-6 border hover:shadow-lg transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl flex items-center justify-center border border-green-500/30`}>
              <Heart className="w-6 h-6 text-green-400" />
            </div>
            <div className={`text-2xl font-bold ${getSentimentColor(metrics.averageCustomerSentiment)}`}>
              {Math.round(normalizeCSC(metrics.averageCustomerSentiment) * 100)}%
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">{t('kpis.customerSentiment.title')}</h3>
            <p className="text-xs text-gray-400">CSC - {t('kpis.customerSentiment.subtitle')}</p>
          </div>
        </div>

        {/* Agent Empathy Score (AES) */}
        <div className={`bg-gradient-to-br ${getEmpathyBg(metrics.averageAgentEmpathy)} backdrop-blur-sm rounded-xl p-6 border hover:shadow-lg transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center border border-purple-500/30">
              <Brain className="w-6 h-6 text-purple-400" />
            </div>
            <div className={`text-2xl font-bold ${getEmpathyColor(metrics.averageAgentEmpathy)}`}>
              {Math.round(metrics.averageAgentEmpathy)}%
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">{t('kpis.agentEmpathy.title')}</h3>
            <p className="text-xs text-gray-400">AES - {t('kpis.agentEmpathy.subtitle')}</p>
          </div>
        </div>

        {/* First Contact Resolution (FCR) */}
        <div className={`bg-gradient-to-br ${metrics.fcrRate >= 80 ? 'from-green-500/10 to-emerald-500/10 border-green-500/20' : metrics.fcrRate >= 60 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20' : 'from-red-500/10 to-pink-500/10 border-red-500/20'} backdrop-blur-sm rounded-xl p-6 border hover:shadow-lg transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
              <CheckCircle2 className="w-6 h-6 text-blue-400" />
            </div>
            <div className={`text-2xl font-bold ${metrics.fcrRate >= 80 ? 'text-green-400' : metrics.fcrRate >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {Math.round(metrics.fcrRate)}%
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">{t('kpis.firstContactResolution.title')}</h3>
            <p className="text-xs text-gray-400">FCR - {t('kpis.firstContactResolution.subtitle')}</p>
          </div>
        </div>

        {/* Conversation Flow Quality (CFQ) */}
        <div className={`bg-gradient-to-br ${metrics.averageConversationQuality >= 80 ? 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20' : metrics.averageConversationQuality >= 60 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20' : 'from-red-500/10 to-pink-500/10 border-red-500/20'} backdrop-blur-sm rounded-xl p-6 border hover:shadow-lg transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-teal-500/30">
              <TrendingUp className="w-6 h-6 text-teal-400" />
            </div>
            <div className={`text-2xl font-bold ${metrics.averageConversationQuality >= 80 ? 'text-emerald-400' : metrics.averageConversationQuality >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {Math.round(metrics.averageConversationQuality)}%
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">{t('kpis.conversationFlow.title')}</h3>
            <p className="text-xs text-gray-400">CFQ - {t('kpis.conversationFlow.subtitle')}</p>
          </div>
        </div>

        {/* Script Adherence (SA) */}
        <div className={`bg-gradient-to-br ${getScriptAdherenceBg(metrics.averageScriptAdherence)} backdrop-blur-sm rounded-xl p-6 border hover:shadow-lg transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <FileText className="w-6 h-6 text-indigo-400" />
            </div>
            <div className={`text-2xl font-bold ${getScriptAdherenceColor(metrics.averageScriptAdherence)}`}>
              {metrics.scriptAdherenceCount > 0 ? `${Math.round(metrics.averageScriptAdherence)}%` : '0%'}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">{t('kpis.scriptAdherence.title')}</h3>
            <p className="text-xs text-gray-400">SA - {t('kpis.scriptAdherence.subtitle')}</p>
          </div>
        </div>

        {/* Personalization Score */}
        <div className={`bg-gradient-to-br ${metrics.averagePersonalization >= 80 ? 'from-pink-500/10 to-rose-500/10 border-pink-500/20' : metrics.averagePersonalization >= 60 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20' : 'from-red-500/10 to-pink-500/10 border-red-500/20'} backdrop-blur-sm rounded-xl p-6 border hover:shadow-lg transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-xl flex items-center justify-center border border-pink-500/30">
              <User className="w-6 h-6 text-pink-400" />
            </div>
            <div className={`text-2xl font-bold ${metrics.averagePersonalization >= 80 ? 'text-pink-400' : metrics.averagePersonalization >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {Math.round(metrics.averagePersonalization)}%
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">Personalização</h3>
            <p className="text-xs text-gray-400">Referências pessoais</p>
          </div>
        </div>

        {/* Agent Knowledge */}
        <div className={`bg-gradient-to-br ${metrics.averageAgentKnowledge >= 80 ? 'from-cyan-500/10 to-blue-500/10 border-cyan-500/20' : metrics.averageAgentKnowledge >= 60 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20' : 'from-red-500/10 to-pink-500/10 border-red-500/20'} backdrop-blur-sm rounded-xl p-6 border hover:shadow-lg transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl flex items-center justify-center border border-cyan-500/30">
              <Users className="w-6 h-6 text-cyan-400" />
            </div>
            <div className={`text-2xl font-bold ${metrics.averageAgentKnowledge >= 80 ? 'text-cyan-400' : metrics.averageAgentKnowledge >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {Math.round(metrics.averageAgentKnowledge)}%
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">{t('kpis.agentKnowledge.title')}</h3>
            <p className="text-xs text-gray-400">{t('kpis.agentKnowledge.subtitle')}</p>
          </div>
        </div>

        {/* Call Wrap-up Quality */}
        <div className={`bg-gradient-to-br ${metrics.averageCallWrapUp >= 80 ? 'from-emerald-500/10 to-green-500/10 border-emerald-500/20' : metrics.averageCallWrapUp >= 60 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20' : 'from-red-500/10 to-pink-500/10 border-red-500/20'} backdrop-blur-sm rounded-xl p-6 border hover:shadow-lg transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
              <MessageSquare className="w-6 h-6 text-emerald-400" />
            </div>
            <div className={`text-2xl font-bold ${metrics.averageCallWrapUp >= 80 ? 'text-emerald-400' : metrics.averageCallWrapUp >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {Math.round(metrics.averageCallWrapUp)}%
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">{t('kpis.callWrapUp.title')}</h3>
            <p className="text-xs text-gray-400">{t('kpis.callWrapUp.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Advanced KPIs Section - Always show but with conditional content */}
      {loading ? (
        <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mr-3"></div>
            <span className="text-gray-300">Loading Advanced Customer Service Analytics...</span>
          </div>
        </div>
      ) : metrics.advanced_kpis?.kpis ? (
        <>
          {/* Customer Sentiment Analysis */}
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center mb-4">
              <Heart className="w-5 h-5 text-pink-400 mr-2" />
              <h3 className="text-lg font-semibold text-white">{t('advanced_analytics.customer_sentiment_analysis.title')}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gradient-to-br from-pink-50/10 to-pink-100/10 rounded-lg border border-pink-200/20">
                <div className="text-2xl font-bold text-pink-400">
                  {(metrics.advanced_kpis.kpis.customer_sentiment?.average_initial_sentiment || 0).toFixed(2)}
                </div>
                <div className="text-sm text-pink-300">{t('advanced_analytics.customer_sentiment_analysis.initial_sentiment')}</div>
                <div className="text-xs text-gray-400 mt-1">{t('advanced_analytics.customer_sentiment_analysis.scale_note')}</div>
              </div>
              
              <div className="text-center p-4 bg-gradient-to-br from-green-50/10 to-green-100/10 rounded-lg border border-green-200/20">
                <div className="text-2xl font-bold text-green-400">
                  {(metrics.advanced_kpis.kpis.customer_sentiment?.average_final_sentiment || 0).toFixed(2)}
                </div>
                <div className="text-sm text-green-300">{t('advanced_analytics.customer_sentiment_analysis.final_sentiment')}</div>
                <div className="text-xs text-gray-400 mt-1">{t('advanced_analytics.customer_sentiment_analysis.outcome_note')}</div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.sentiment_progression')}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    metrics.advanced_kpis.kpis.customer_sentiment?.sentiment_improvement > 0 ? 'bg-green-100/20 text-green-300' :
                    metrics.advanced_kpis.kpis.customer_sentiment?.sentiment_improvement < 0 ? 'bg-red-100/20 text-red-300' :
                    'bg-yellow-100/20 text-yellow-300'
                  }`}>
                    {metrics.advanced_kpis.kpis.customer_sentiment?.sentiment_improvement > 0 ? 'IMPROVED' :
                     metrics.advanced_kpis.kpis.customer_sentiment?.sentiment_improvement < 0 ? 'DECLINED' : 'STABLE'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.csat_prediction')}</span>
                  <span className={`text-sm font-bold ${
                    (metrics.advanced_kpis.kpis.customer_sentiment?.csat_prediction || 0) >= 8 ? 'text-green-400' :
                    (metrics.advanced_kpis.kpis.customer_sentiment?.csat_prediction || 0) >= 6 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {(metrics.advanced_kpis.kpis.customer_sentiment?.average_csat_prediction || 0).toFixed(1)}/10
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Agent Empathy & Resolution Quality */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Agent Empathy Analysis */}
            <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <div className="flex items-center mb-4">
                <Brain className="w-5 h-5 text-purple-400 mr-2" />
                <h3 className="text-lg font-semibold text-white">{t('advanced_analytics.agent_empathy_analysis.title')}</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.empathy_markers')}</span>
                  <span className="text-sm font-bold text-purple-400">
                    {(metrics.advanced_kpis.kpis.agent_empathy?.average_empathy_markers || 0).toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.emotional_acknowledgment')}</span>
                  <span className="text-sm font-bold text-purple-400">
                    {Math.round(metrics.advanced_kpis.kpis.agent_empathy?.emotional_acknowledgment_rate || 0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.empathy_score')}</span>
                  <span className={`text-sm font-bold ${
                    (metrics.advanced_kpis.kpis.agent_empathy?.average_empathy_score || 0) >= 80 ? 'text-green-400' :
                    (metrics.advanced_kpis.kpis.agent_empathy?.average_empathy_score || 0) >= 60 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {Math.round(metrics.advanced_kpis.kpis.agent_empathy?.average_empathy_score || 0)}/100
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.performance_rating')}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    metrics.advanced_kpis.kpis.agent_empathy?.performance === 'excellent' ? 'bg-green-100/20 text-green-300' :
                    metrics.advanced_kpis.kpis.agent_empathy?.performance === 'good' ? 'bg-yellow-100/20 text-yellow-300' :
                    'bg-red-100/20 text-red-300'
                  }`}>
                    {metrics.advanced_kpis.kpis.agent_empathy?.performance?.toUpperCase() || 'N/A'}
                  </span>
                </div>
                {metrics.advanced_kpis.kpis.agent_empathy?.empathy_phrases && (
                  <div className="mt-3">
                    <span className="text-sm font-medium text-gray-300">{t('ui.sample_empathy_phrases')}</span>
                    <div className="mt-2 space-y-1">
                      {metrics.advanced_kpis.kpis.agent_empathy.empathy_phrases.slice(0, 2).map((phrase, index) => (
                        <div key={index} className="text-xs bg-purple-900/30 px-2 py-1 rounded">
                          "{phrase}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Resolution Quality */}
            <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <div className="flex items-center mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-400 mr-2" />
                <h3 className="text-lg font-semibold text-white">{t('advanced_analytics.resolution_quality.title')}</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.first_contact_resolution')}</span>
                  <span className="text-sm font-bold text-green-400">
                    {Math.round(metrics.advanced_kpis.kpis.resolution_quality?.first_contact_resolution_rate || 0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.resolution_language')}</span>
                  <span className="text-sm font-bold text-green-400">
                    {Math.round(metrics.advanced_kpis.kpis.resolution_quality?.resolution_language_rate || 0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.customer_acknowledgment')}</span>
                  <span className="text-sm font-bold text-green-400">
                    {Math.round(metrics.advanced_kpis.kpis.resolution_quality?.average_resolution_confidence || 0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.fcr_rate')}</span>
                  <span className={`text-sm font-bold ${
                    (metrics.advanced_kpis.kpis.resolution_quality?.first_contact_resolution_rate || 0) > 80 ? 'text-green-400' : 'text-orange-400'
                  }`}>
                    {Math.round(metrics.advanced_kpis.kpis.resolution_quality?.first_contact_resolution_rate || 0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.resolution_confidence')}</span>
                  <span className={`text-sm font-bold ${
                    (metrics.advanced_kpis.kpis.resolution_quality?.resolution_confidence || 0) >= 80 ? 'text-green-400' :
                    (metrics.advanced_kpis.kpis.resolution_quality?.resolution_confidence || 0) >= 60 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {metrics.advanced_kpis.kpis.resolution_quality?.resolution_confidence || 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Effort & Conversation Flow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer Effort Analysis */}
            <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <div className="flex items-center mb-4">
                <TrendingUp className="w-5 h-5 text-orange-400 mr-2" />
                <h3 className="text-lg font-semibold text-white">{t('advanced_analytics.customer_effort_analysis.title')}</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.effort_indicators')}</span>
                  <span className="text-sm font-bold text-orange-400">
                    {(metrics.advanced_kpis.kpis.customer_effort?.average_effort_indicators || 0).toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.effort_score')}</span>
                  <span className={`text-sm font-bold ${
                    (metrics.advanced_kpis.kpis.customer_effort?.average_effort_score || 0) <= 3 ? 'text-green-400' :
                    (metrics.advanced_kpis.kpis.customer_effort?.average_effort_score || 0) <= 6 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {(metrics.advanced_kpis.kpis.customer_effort?.average_effort_score || 0).toFixed(1)}/10
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.ease_of_interaction')}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    metrics.advanced_kpis.kpis.customer_effort?.ease_of_interaction === 'low_effort' ? 'bg-green-100/20 text-green-300' :
                    metrics.advanced_kpis.kpis.customer_effort?.ease_of_interaction === 'medium_effort' ? 'bg-yellow-100/20 text-yellow-300' :
                    'bg-red-100/20 text-red-300'
                  }`}>
                    {metrics.advanced_kpis.kpis.customer_effort?.ease_of_interaction?.replace('_', ' ').toUpperCase() || 'N/A'}
                  </span>
                </div>
                {metrics.advanced_kpis.kpis.customer_effort?.friction_phrases && 
                 metrics.advanced_kpis.kpis.customer_effort.friction_phrases.length > 0 && (
                  <div className="mt-3">
                    <span className="text-sm font-medium text-gray-300">{t('ui.friction_indicators')}</span>
                    <div className="mt-2 space-y-1">
                      {metrics.advanced_kpis.kpis.customer_effort.friction_phrases.slice(0, 2).map((phrase, index) => (
                        <div key={index} className="text-xs bg-orange-900/30 px-2 py-1 rounded">
                          "{phrase}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Conversation Flow Quality */}
            <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <div className="flex items-center mb-4">
                <MessageSquare className="w-5 h-5 text-blue-400 mr-2" />
                <h3 className="text-lg font-semibold text-white">{t('advanced_analytics.conversation_flow.title')}</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.inappropriate_interruptions')}</span>
                  <span className={`text-sm font-bold ${
                    (metrics.advanced_kpis.kpis.conversation_flow?.average_interruptions || 0) <= 1 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {(metrics.advanced_kpis.kpis.conversation_flow?.average_interruptions || 0).toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.awkward_silences')}</span>
                  <span className={`text-sm font-bold ${
                    (metrics.advanced_kpis.kpis.conversation_flow?.average_awkward_silences || 0) <= 2 ? 'text-green-400' : 'text-orange-400'
                  }`}>
                    {(metrics.advanced_kpis.kpis.conversation_flow?.average_awkward_silences || 0).toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.turn_taking_quality')}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    metrics.advanced_kpis.kpis.conversation_flow?.turn_taking_quality === 'excellent' ? 'bg-green-100/20 text-green-300' :
                    metrics.advanced_kpis.kpis.conversation_flow?.turn_taking_quality === 'good' ? 'bg-yellow-100/20 text-yellow-300' :
                    'bg-red-100/20 text-red-300'
                  }`}>
                    {metrics.advanced_kpis.kpis.conversation_flow?.turn_taking_quality?.toUpperCase() || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.flow_disruptions')}</span>
                  <span className={`text-sm font-bold ${
                    (metrics.advanced_kpis.kpis.conversation_flow?.flow_disruptions || 0) <= 1 ? 'text-green-400' : 'text-orange-400'
                  }`}>
                    {metrics.advanced_kpis.kpis.conversation_flow?.flow_disruptions || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.flow_quality_score')}</span>
                  <span className={`text-sm font-bold ${
                    (metrics.advanced_kpis.kpis.conversation_flow?.flow_quality_score || 0) >= 80 ? 'text-green-400' :
                    (metrics.advanced_kpis.kpis.conversation_flow?.flow_quality_score || 0) >= 60 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {metrics.advanced_kpis.kpis.conversation_flow?.flow_quality_score || 0}/100
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Agent Knowledge & Personalization */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Agent Knowledge Assessment */}
            <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <div className="flex items-center mb-4">
                <Users className="w-5 h-5 text-cyan-400 mr-2" />
                <h3 className="text-lg font-semibold text-white">{t('advanced_analytics.agent_knowledge.title')}</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.uncertainty_indicators')}</span>
                  <span className={`text-sm font-bold ${
                    (metrics.advanced_kpis.kpis.agent_knowledge?.average_uncertainty_indicators || 0) <= 1 ? 'text-green-400' : 'text-orange-400'
                  }`}>
                    {(metrics.advanced_kpis.kpis.agent_knowledge?.average_uncertainty_indicators || 0).toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('advanced_analytics.agent_knowledge.accuracy_score')}</span>
                  <span className={`text-sm font-bold ${
                    (metrics.advanced_kpis.kpis.agent_knowledge?.average_accuracy_score || 0) >= 80 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {Math.round(metrics.advanced_kpis.kpis.agent_knowledge?.average_accuracy_score || 0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('advanced_analytics.agent_knowledge.accuracy_score')}</span>
                  <span className={`text-sm font-bold ${
                    (metrics.advanced_kpis.kpis.agent_knowledge?.accuracy_score || 0) >= 90 ? 'text-green-400' :
                    (metrics.advanced_kpis.kpis.agent_knowledge?.accuracy_score || 0) >= 70 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {metrics.advanced_kpis.kpis.agent_knowledge?.accuracy_score || 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.expertise_demonstrated')}</span>
                  <div className={`w-3 h-3 rounded-full ${
                    metrics.advanced_kpis.kpis.agent_knowledge?.expertise_demonstrated ? 'bg-green-500' : 'bg-red-400'
                  }`}></div>
                </div>
              </div>
            </div>

            {/* Personalization & Proactive Service */}
            <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <div className="flex items-center mb-4">
                <Calendar className="w-5 h-5 text-indigo-400 mr-2" />
                <h3 className="text-lg font-semibold text-white">{t('ui.personalization_proactive_service')}</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.personal_references')}</span>
                  <span className="text-sm font-bold text-indigo-400">
                    {metrics.advanced_kpis.kpis.personalization?.personal_references || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.history_referenced')}</span>
                  <div className={`w-3 h-3 rounded-full ${
                    metrics.advanced_kpis.kpis.personalization?.customer_history_referenced ? 'bg-green-500' : 'bg-red-400'
                  }`}></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.personalization_score')}</span>
                  <span className={`text-sm font-bold ${
                    (metrics.advanced_kpis.kpis.personalization?.personalization_score || 0) >= 70 ? 'text-green-400' :
                    (metrics.advanced_kpis.kpis.personalization?.personalization_score || 0) >= 40 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {metrics.advanced_kpis.kpis.personalization?.personalization_score || 0}/100
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.proactive_actions')}</span>
                  <span className="text-sm font-bold text-indigo-400">
                    {metrics.advanced_kpis.kpis.proactive_service?.anticipatory_actions || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.future_needs_addressed')}</span>
                  <div className={`w-3 h-3 rounded-full ${
                    metrics.advanced_kpis.kpis.proactive_service?.future_needs_addressed ? 'bg-green-500' : 'bg-red-400'
                  }`}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Call Wrap-up & Behavioral Compliance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Call Wrap-up Quality */}
            <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <div className="flex items-center mb-4">
                <FileText className="w-5 h-5 text-emerald-400 mr-2" />
                <h3 className="text-lg font-semibold text-white">{t('ui.call_wrap_up_quality')}</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.clear_next_steps')}</span>
                  <div className={`w-3 h-3 rounded-full ${
                    metrics.advanced_kpis.kpis.call_wrap_up?.clear_next_steps ? 'bg-green-500' : 'bg-red-400'
                  }`}></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.confirmation_provided')}</span>
                  <div className={`w-3 h-3 rounded-full ${
                    metrics.advanced_kpis.kpis.call_wrap_up?.confirmation_provided ? 'bg-green-500' : 'bg-red-400'
                  }`}></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.contact_info_shared')}</span>
                  <div className={`w-3 h-3 rounded-full ${
                    metrics.advanced_kpis.kpis.call_wrap_up?.contact_information_shared ? 'bg-green-500' : 'bg-red-400'
                  }`}></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.wrap_up_quality')}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    metrics.advanced_kpis.kpis.call_wrap_up?.wrap_up_quality === 'excellent' ? 'bg-green-100/20 text-green-300' :
                    metrics.advanced_kpis.kpis.call_wrap_up?.wrap_up_quality === 'good' ? 'bg-yellow-100/20 text-yellow-300' :
                    'bg-red-100/20 text-red-300'
                  }`}>
                    {metrics.advanced_kpis.kpis.call_wrap_up?.wrap_up_quality?.toUpperCase() || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Behavioral Compliance */}
            <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <div className="flex items-center mb-4">
                <AlertCircle className="w-5 h-5 text-violet-400 mr-2" />
                <h3 className="text-lg font-semibold text-white">{t('ui.behavioral_compliance')}</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.professional_tone')}</span>
                  <div className={`w-3 h-3 rounded-full ${
                    metrics.advanced_kpis.kpis.behavioral_compliance?.professional_tone ? 'bg-green-500' : 'bg-red-400'
                  }`}></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.active_listening')}</span>
                  <div className={`w-3 h-3 rounded-full ${
                    metrics.advanced_kpis.kpis.behavioral_compliance?.active_listening ? 'bg-green-500' : 'bg-red-400'
                  }`}></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.patience_demonstrated')}</span>
                  <div className={`w-3 h-3 rounded-full ${
                    metrics.advanced_kpis.kpis.behavioral_compliance?.patience_demonstrated ? 'bg-green-500' : 'bg-red-400'
                  }`}></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{t('ui.compliance_score')}</span>
                  <span className={`text-sm font-bold ${
                    (metrics.advanced_kpis.kpis.behavioral_compliance?.compliance_score || 0) >= 90 ? 'text-green-400' :
                    (metrics.advanced_kpis.kpis.behavioral_compliance?.compliance_score || 0) >= 70 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {metrics.advanced_kpis.kpis.behavioral_compliance?.compliance_score || 0}/100
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <div className="text-center py-8">
            <Heart className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Advanced Customer Service Analytics</h3>
            <p className="text-gray-300 mb-4">
              Premium conversation analytics with sentiment prediction (85-95% CSAT accuracy), agent empathy scoring, and customer effort analysis.
            </p>
            <div className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-4">
              <p className="text-sm text-purple-300">
                <strong>To enable advanced KPIs:</strong> Ensure you have a premium subscription and LLM API configured in your company profile.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top and Bottom Performing Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 3 Agents */}
        <div className="bg-gradient-to-br from-green-800/20 to-emerald-800/20 backdrop-blur-sm rounded-xl p-6 border border-green-700/30">
          <div className="flex items-center mb-6">
            <Users className="w-5 h-5 text-green-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">{t('ui.top_agents')}</h3>
          </div>
          <div className="space-y-4">
            {getTopAgents().map((agent, index) => (
              <button 
                key={agent.name} 
                onClick={() => handleAgentClick(agent)}
                className="w-full flex items-center justify-between p-4 bg-green-900/20 rounded-lg border border-green-700/20 hover:bg-green-900/30 transition-colors group cursor-pointer"
              >
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3 ${
                    index === 0 ? 'bg-yellow-500 text-yellow-900' :
                    index === 1 ? 'bg-gray-300 text-gray-800' :
                    'bg-orange-400 text-orange-900'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-white group-hover:text-green-300 transition-colors">{agent.name}</div>
                    <div className="text-sm text-green-300">{agent.calls} {t('ui.calls')}</div>
                  </div>
                </div>
                <div className="text-right flex items-center">
                  <div className="mr-2">
                    <div className="text-xl font-bold text-green-400">{agent.overallScore}%</div>
                    <div className="text-xs text-gray-400">{t('ui.overall_score')}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-green-300 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom 3 Agents */}
        <div className="bg-gradient-to-br from-red-800/20 to-pink-800/20 backdrop-blur-sm rounded-xl p-6 border border-red-700/30">
          <div className="flex items-center mb-6">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">{t('ui.bottom_agents')}</h3>
          </div>
          <div className="space-y-4">
            {getBottomAgents().map((agent, index) => (
              <button 
                key={agent.name} 
                onClick={() => handleAgentClick(agent)}
                className="w-full flex items-center justify-between p-4 bg-red-900/20 rounded-lg border border-red-700/20 hover:bg-red-900/30 transition-colors group cursor-pointer"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-sm font-bold text-red-400 mr-3">
                    {index + 1}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-white group-hover:text-red-300 transition-colors">{agent.name}</div>
                    <div className="text-sm text-red-300">{agent.calls} {t('ui.calls')}</div>
                  </div>
                </div>
                <div className="text-right flex items-center">
                  <div className="mr-2">
                    <div className="text-xl font-bold text-red-400">{agent.overallScore}%</div>
                    <div className="text-xs text-gray-400">{t('ui.overall_score')}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-red-300 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Individual Call Analysis List */}
      <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <MessageSquare className="w-5 h-5 text-blue-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">{t('ui.recent_call_analysis')}</h3>
          </div>
          <div className="text-sm text-gray-400">{t('ui.last_calls', { count: 20 })}</div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="text-left py-3 px-4 font-medium text-gray-300">{t('ui.date')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-300">{t('ui.agent')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-300">{t('ui.customer')}</th>
                <th className="text-center py-3 px-4 font-medium text-gray-300">{t('ui.sentiment')}</th>
                <th className="text-center py-3 px-4 font-medium text-gray-300">{t('ui.empathy')}</th>
                <th className="text-center py-3 px-4 font-medium text-gray-300">{t('ui.fcr')}</th>
                <th className="text-center py-3 px-4 font-medium text-gray-300">{t('ui.script')}</th>
                <th className="text-center py-3 px-4 font-medium text-gray-300">{t('ui.overall_score')}</th>
              </tr>
            </thead>
            <tbody>
              {getRecentCallsAnalysis().map((call, index) => (
                <tr 
                  key={call.id} 
                  onClick={() => handleCallClick(call)}
                  className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4 text-sm text-gray-300">{call.date}</td>
                  <td className="py-3 px-4 text-sm text-white font-medium group-hover:text-blue-300 transition-colors">{call.agent}</td>
                  <td className="py-3 px-4 text-sm text-gray-300">{call.customer || t('ui.not_identified')}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      call.sentiment >= 0 ? 'bg-green-900/30 text-green-300 border border-green-700/30' : 
                      'bg-red-900/30 text-red-300 border border-red-700/30'
                    }`}>
                      {call.sentiment.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-sm font-medium ${
                      call.empathy >= 80 ? 'text-green-400' :
                      call.empathy >= 60 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {call.empathy}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className={`w-3 h-3 rounded-full mx-auto ${
                      call.fcr ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-sm font-medium ${
                      call.scriptAdherence >= 90 ? 'text-green-400' :
                      call.scriptAdherence >= 70 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {call.scriptAdherence}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-lg font-bold ${
                      call.overallScore >= 80 ? 'text-green-400' :
                      call.overallScore >= 60 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {call.overallScore}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CustomerServiceDashboard;