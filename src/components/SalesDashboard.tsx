import React, { useState, useEffect } from 'react';
import { TrendingUp, Target, Users, MessageSquare, Clock, Award, BarChart, Zap } from 'lucide-react';
import StatCard from './StatCard';

interface AdvancedSalesKPIs {
  talk_to_listen_ratio: {
    agent_talk_percentage: number;
    customer_talk_percentage: number;
    optimal_range: string;
    performance: 'excellent' | 'good' | 'needs_improvement';
  };
  discovery_question_rate: {
    total_questions: number;
    questions_per_hour: number;
    question_types: {
      situation: number;
      problem: number;
      implication: number;
      need_payoff: number;
    };
    performance: 'excellent' | 'good' | 'needs_improvement';
  };
  conversation_engagement: {
    switch_frequency: number;
    longest_customer_monologue_seconds: number;
    longest_agent_monologue_seconds: number;
    engagement_level: 'high' | 'medium' | 'low';
  };
  value_proposition: {
    articulation_rate: number;
    benefit_connections: number;
    feature_to_benefit_ratio: number;
    effectiveness: 'excellent' | 'good' | 'needs_improvement';
  };
  methodology_adherence: {
    spin_coverage: {
      situation_covered: boolean;
      problem_covered: boolean;
      implication_covered: boolean;
      need_payoff_covered: boolean;
      completion_percentage: number;
    };
    meddic_coverage: {
      metrics_identified: boolean;
      economic_buyer_identified: boolean;
      decision_criteria_covered: boolean;
      decision_process_covered: boolean;
      pain_points_identified: boolean;
      champions_identified: boolean;
      completion_percentage: number;
    };
  };
  customer_insights: {
    sentiment_progression: 'positive' | 'neutral' | 'negative';
    pain_points_discovered: number;
    pain_points_quantified: number;
    engagement_indicators: string[];
  };
  competitive_handling: {
    competitors_mentioned: number;
    responses_provided: number;
    response_quality: 'excellent' | 'good' | 'poor';
    differentiation_clear: boolean;
  };
  call_preparation: {
    account_knowledge_demonstrated: boolean;
    preparation_score: number;
    personalization_evident: boolean;
  };
  next_steps: {
    urgency_created: boolean;
    time_bound_commitments: boolean;
    clear_next_steps: boolean;
    conversion_likelihood: 'high' | 'medium' | 'low';
  };
}

interface SalesMetrics {
  totalCalls: number;
  // Traditional metrics (for backward compatibility)
  talkToListenRatio: number;
  discoveryQuestionRate: number;
  longestCustomerMonologue: number;
  conversationSwitchFrequency: number;
  customerSentimentProgression: number;
  valuePropositionRate: number;
  competitiveHandlingRate: number;
  averageDealValue: number;
  conversionRate: number;
  methodologyAdherence: number;
  accountKnowledgeScore: number;
  // Advanced KPIs
  advanced_kpis?: {
    kpis: AdvancedSalesKPIs;
    totalCalls: number;
    trends: any;
    benchmarks: any;
  };
}

interface SalesDashboardProps {
  companyId: string;
  dateRange?: string;
  refreshTrigger?: number;
}

const SalesDashboard: React.FC<SalesDashboardProps> = ({ 
  companyId, 
  dateRange = '7d',
  refreshTrigger = 0 
}) => {
  const [metrics, setMetrics] = useState<SalesMetrics>({
    totalCalls: 0,
    talkToListenRatio: 50,
    discoveryQuestionRate: 0,
    longestCustomerMonologue: 0,
    conversationSwitchFrequency: 0,
    customerSentimentProgression: 0,
    valuePropositionRate: 0,
    competitiveHandlingRate: 0,
    averageDealValue: 0,
    conversionRate: 0,
    methodologyAdherence: 0,
    accountKnowledgeScore: 0
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSalesMetrics = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          console.error('No access token found');
          return;
        }

        // Fetch enhanced sales KPIs that include both traditional and advanced metrics
        console.log('🔍 Fetching sales KPIs for company:', companyId, 'period:', dateRange);
        const response = await fetch(`http://localhost:3005/api/companies/${companyId}/sales-kpis?period=${dateRange}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          const data = result.data;
          console.log('📊 Sales KPI API Response:', result);
          
          // If we have advanced KPIs, use them to populate enhanced metrics
          if (data && data.kpis) {
            console.log('✅ Advanced KPIs found:', data.kpis);
            const advancedKpis = data.kpis;
            const enhancedMetrics = {
              ...metrics,
              totalCalls: data.totalCalls || 0,
              // Map advanced KPIs to traditional structure for backward compatibility
              talkToListenRatio: advancedKpis.talk_to_listen_ratio?.agent_talk_percentage || 50,
              discoveryQuestionRate: advancedKpis.discovery_question_rate?.questions_per_hour || 0,
              longestCustomerMonologue: advancedKpis.conversation_engagement?.longest_customer_monologue_seconds || 0,
              conversationSwitchFrequency: advancedKpis.conversation_engagement?.switch_frequency || 0,
              customerSentimentProgression: advancedKpis.customer_insights?.sentiment_progression === 'positive' ? 75 : 
                                          advancedKpis.customer_insights?.sentiment_progression === 'neutral' ? 50 : 25,
              valuePropositionRate: advancedKpis.value_proposition?.articulation_rate || 0,
              competitiveHandlingRate: advancedKpis.competitive_handling?.response_quality === 'excellent' ? 90 :
                                     advancedKpis.competitive_handling?.response_quality === 'good' ? 70 : 40,
              methodologyAdherence: Math.max(
                advancedKpis.methodology_adherence?.spin_coverage?.completion_percentage || 0,
                advancedKpis.methodology_adherence?.meddic_coverage?.completion_percentage || 0
              ),
              accountKnowledgeScore: advancedKpis.call_preparation?.preparation_score || 0,
              // Include advanced KPIs data
              advanced_kpis: data
            };
            setMetrics(enhancedMetrics);
          } else {
            console.log('⚠️ No advanced KPIs found, using traditional metrics fallback');
            // Fallback to traditional metrics if advanced KPIs are not available
            setMetrics(data?.traditional_metrics || data || metrics);
          }
        } else {
          console.error('Failed to fetch sales metrics');
        }
      } catch (error) {
        console.error('Error fetching sales metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSalesMetrics();
  }, [companyId, dateRange, refreshTrigger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getTalkToListenStatus = (ratio: number) => {
    if (ratio >= 40 && ratio <= 45) return { status: 'Optimal', color: 'text-green-600' };
    if (ratio >= 35 && ratio <= 50) return { status: 'Good', color: 'text-yellow-600' };
    return { status: 'Needs Improvement', color: 'text-red-600' };
  };

  const talkToListenStatus = getTalkToListenStatus(metrics.talkToListenRatio);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sales Performance Dashboard</h2>
        <p className="text-gray-600">Advanced sales metrics focusing on conversation dynamics, methodology adherence, and revenue generation</p>
      </div>

      {/* Conversation Dynamics - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Talk-to-Listen Ratio"
          value={`${metrics.talkToListenRatio.toFixed(1)}%`}
          icon={MessageSquare}
          className={`bg-gradient-to-br ${metrics.talkToListenRatio >= 40 && metrics.talkToListenRatio <= 45 ? 'from-green-500/10 to-green-600/20 border-green-200' : 'from-yellow-500/10 to-yellow-600/20 border-yellow-200'}`}
          subtitle={`Target: 40-45% agent talk time`}
        />
        <StatCard
          title="Discovery Questions/Hour"
          value={metrics.discoveryQuestionRate.toString()}
          icon={Target}
          className={`bg-gradient-to-br ${metrics.discoveryQuestionRate >= 18 ? 'from-green-500/10 to-green-600/20 border-green-200' : 'from-orange-500/10 to-orange-600/20 border-orange-200'}`}
          subtitle={`Elite performers: 18+ questions/hour`}
        />
        <StatCard
          title="Customer Monologue"
          value={`${metrics.longestCustomerMonologue.toFixed(0)}s`}
          icon={Clock}
          className="bg-gradient-to-br from-blue-500/10 to-blue-600/20 border-blue-200"
          subtitle={`Target: 45-90 seconds (engagement)`}
        />
        <StatCard
          title="Conversation Switches"
          value={metrics.conversationSwitchFrequency.toString()}
          icon={Zap}
          className="bg-gradient-to-br from-purple-500/10 to-purple-600/20 border-purple-200"
          subtitle={`Higher = more interactive dialogue`}
        />
      </div>

      {/* Sales Performance - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Sentiment Progression"
          value={`${metrics.customerSentimentProgression.toFixed(1)}%`}
          icon={TrendingUp}
          className={`bg-gradient-to-br ${metrics.customerSentimentProgression >= 70 ? 'from-green-500/10 to-green-600/20 border-green-200' : 'from-yellow-500/10 to-yellow-600/20 border-yellow-200'}`}
          subtitle={`Target: 70% positive shift`}
        />
        <StatCard
          title="Value Propositions/10min"
          value={`${metrics.valuePropositionRate.toFixed(1)}`}
          icon={Award}
          className={`bg-gradient-to-br ${metrics.valuePropositionRate >= 3 ? 'from-green-500/10 to-green-600/20 border-green-200' : 'from-orange-500/10 to-orange-600/20 border-orange-200'}`}
          subtitle={`Target: 3-4 value connections/10min`}
        />
        <StatCard
          title="Competitive Handling"
          value={`${metrics.competitiveHandlingRate.toFixed(1)}%`}
          icon={BarChart}
          className={`bg-gradient-to-br ${metrics.competitiveHandlingRate >= 90 ? 'from-green-500/10 to-green-600/20 border-green-200' : 'from-yellow-500/10 to-yellow-600/20 border-yellow-200'}`}
          subtitle={`Target: 90% proper acknowledgment`}
        />
        <StatCard
          title="Account Knowledge"
          value={`${metrics.accountKnowledgeScore.toFixed(1)}/10`}
          icon={Users}
          className={`bg-gradient-to-br ${metrics.accountKnowledgeScore >= 8 ? 'from-green-500/10 to-green-600/20 border-green-200' : 'from-orange-500/10 to-orange-600/20 border-orange-200'}`}
          subtitle={`85% should demonstrate preparation`}
        />
      </div>

      {/* Revenue Metrics */}
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
          Revenue Performance
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-700">${metrics.averageDealValue.toLocaleString()}</div>
            <div className="text-sm text-green-600">Average Deal Value</div>
            <div className="text-xs text-gray-500 mt-1">Per successful conversion</div>
          </div>
          
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-700">{metrics.conversionRate.toFixed(1)}%</div>
            <div className="text-sm text-blue-600">Conversion Rate</div>
            <div className="text-xs text-gray-500 mt-1">Qualified leads to sales</div>
          </div>
          
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
            <div className="text-2xl font-bold text-purple-700">{metrics.methodologyAdherence.toFixed(0)}%</div>
            <div className="text-sm text-purple-600">Methodology Adherence</div>
            <div className="text-xs text-gray-500 mt-1">SPIN/MEDDIC coverage</div>
          </div>
        </div>
      </div>

      {/* Conversation Quality Analysis */}
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <MessageSquare className="w-5 h-5 mr-2 text-purple-600" />
          Conversation Quality Analysis
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Talk-to-Listen Quality */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 flex items-center">
              <MessageSquare className="w-4 h-4 mr-2 text-blue-600" />
              Talk-to-Listen Balance
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Agent Talk Time</span>
                <span className="font-medium">{metrics.talkToListenRatio.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Customer Talk Time</span>
                <span className="font-medium">{(100 - metrics.talkToListenRatio).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Balance Status</span>
                <span className={`font-medium ${talkToListenStatus.color}`}>
                  {talkToListenStatus.status}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    metrics.talkToListenRatio >= 40 && metrics.talkToListenRatio <= 45 
                      ? 'bg-green-500' 
                      : metrics.talkToListenRatio >= 35 && metrics.talkToListenRatio <= 50
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${metrics.talkToListenRatio}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Engagement Metrics */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 flex items-center">
              <Target className="w-4 h-4 mr-2 text-green-600" />
              Engagement Quality
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Discovery Questions</span>
                <span className={`font-medium ${metrics.discoveryQuestionRate >= 18 ? 'text-green-600' : 'text-orange-600'}`}>
                  {metrics.discoveryQuestionRate >= 18 ? 'Elite Level' : 'Needs Improvement'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Customer Engagement</span>
                <span className={`font-medium ${metrics.longestCustomerMonologue >= 45 && metrics.longestCustomerMonologue <= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {metrics.longestCustomerMonologue >= 45 && metrics.longestCustomerMonologue <= 90 ? 'Optimal' : 'Suboptimal'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Interactive Flow</span>
                <span className={`font-medium ${metrics.conversationSwitchFrequency >= 30 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {metrics.conversationSwitchFrequency >= 30 ? 'Dynamic' : 'Static'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced KPIs Section - Always show but with conditional content */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-6 border">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-600">Loading Advanced Sales Analytics...</span>
          </div>
        </div>
      ) : metrics.advanced_kpis?.kpis ? (
        <>
          {/* SPIN/MEDDIC Methodology Adherence */}
          <div className="bg-white rounded-lg shadow-md p-6 border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-blue-600" />
              Sales Methodology Adherence
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* SPIN Selling Coverage */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-700 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2 text-green-600" />
                  SPIN Selling Framework
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Situation Questions</span>
                    <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.methodology_adherence?.spin_coverage?.situation_covered ? 'bg-green-500' : 'bg-red-400'}`}></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Problem Questions</span>
                    <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.methodology_adherence?.spin_coverage?.problem_covered ? 'bg-green-500' : 'bg-red-400'}`}></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Implication Questions</span>
                    <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.methodology_adherence?.spin_coverage?.implication_covered ? 'bg-green-500' : 'bg-red-400'}`}></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Need-Payoff Questions</span>
                    <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.methodology_adherence?.spin_coverage?.need_payoff_covered ? 'bg-green-500' : 'bg-red-400'}`}></div>
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Coverage Score</span>
                      <span className={`text-sm font-bold ${metrics.advanced_kpis.kpis.methodology_adherence?.spin_coverage?.completion_percentage >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                        {metrics.advanced_kpis.kpis.methodology_adherence?.spin_coverage?.completion_percentage || 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* MEDDIC Qualification */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-700 flex items-center">
                  <BarChart className="w-4 h-4 mr-2 text-purple-600" />
                  MEDDIC Qualification
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Metrics Identified</span>
                    <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.methodology_adherence?.meddic_coverage?.metrics_identified ? 'bg-green-500' : 'bg-red-400'}`}></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Economic Buyer</span>
                    <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.methodology_adherence?.meddic_coverage?.economic_buyer_identified ? 'bg-green-500' : 'bg-red-400'}`}></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Decision Criteria</span>
                    <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.methodology_adherence?.meddic_coverage?.decision_criteria_covered ? 'bg-green-500' : 'bg-red-400'}`}></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Decision Process</span>
                    <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.methodology_adherence?.meddic_coverage?.decision_process_covered ? 'bg-green-500' : 'bg-red-400'}`}></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Pain Points</span>
                    <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.methodology_adherence?.meddic_coverage?.pain_points_identified ? 'bg-green-500' : 'bg-red-400'}`}></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Champions</span>
                    <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.methodology_adherence?.meddic_coverage?.champions_identified ? 'bg-green-500' : 'bg-red-400'}`}></div>
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Coverage Score</span>
                      <span className={`text-sm font-bold ${metrics.advanced_kpis.kpis.methodology_adherence?.meddic_coverage?.completion_percentage >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                        {metrics.advanced_kpis.kpis.methodology_adherence?.meddic_coverage?.completion_percentage || 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Discovery Question Analysis */}
          <div className="bg-white rounded-lg shadow-md p-6 border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-green-600" />
              Discovery Question Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-700">{metrics.advanced_kpis.kpis.discovery_question_rate?.questions_per_hour || 0}</div>
                <div className="text-sm text-green-600">Questions/Hour</div>
                <div className="text-xs text-gray-500 mt-1">Elite: 18+ per hour</div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium text-gray-700">Question Types</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Situation</span>
                    <span className="text-sm font-medium">{metrics.advanced_kpis.kpis.discovery_question_rate?.question_types?.situation || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Problem</span>
                    <span className="text-sm font-medium">{metrics.advanced_kpis.kpis.discovery_question_rate?.question_types?.problem || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Implication</span>
                    <span className="text-sm font-medium">{metrics.advanced_kpis.kpis.discovery_question_rate?.question_types?.implication || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Need-Payoff</span>
                    <span className="text-sm font-medium">{metrics.advanced_kpis.kpis.discovery_question_rate?.question_types?.need_payoff || 0}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium text-gray-700">Performance Rating</h4>
                <div className={`text-center p-3 rounded-lg font-medium ${
                  metrics.advanced_kpis.kpis.discovery_question_rate?.performance === 'excellent' ? 'bg-green-100 text-green-700' :
                  metrics.advanced_kpis.kpis.discovery_question_rate?.performance === 'good' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {metrics.advanced_kpis.kpis.discovery_question_rate?.performance?.toUpperCase() || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Customer Insights & Competitive Handling */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer Insights */}
            <div className="bg-white rounded-lg shadow-md p-6 border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-600" />
                Customer Insights
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Sentiment Progression</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    metrics.advanced_kpis.kpis.customer_insights?.sentiment_progression === 'positive' ? 'bg-green-100 text-green-700' :
                    metrics.advanced_kpis.kpis.customer_insights?.sentiment_progression === 'neutral' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {metrics.advanced_kpis.kpis.customer_insights?.sentiment_progression?.toUpperCase() || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Pain Points Discovered</span>
                  <span className="text-sm font-bold text-blue-600">{metrics.advanced_kpis.kpis.customer_insights?.pain_points_discovered || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Pain Points Quantified</span>
                  <span className="text-sm font-bold text-blue-600">{metrics.advanced_kpis.kpis.customer_insights?.pain_points_quantified || 0}</span>
                </div>
                {metrics.advanced_kpis.kpis.customer_insights?.engagement_indicators && (
                  <div className="mt-3">
                    <span className="text-sm font-medium">Engagement Indicators</span>
                    <div className="mt-2 space-y-1">
                      {metrics.advanced_kpis.kpis.customer_insights.engagement_indicators.slice(0, 3).map((indicator, index) => (
                        <div key={index} className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {indicator}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Competitive Handling */}
            <div className="bg-white rounded-lg shadow-md p-6 border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BarChart className="w-5 h-5 mr-2 text-purple-600" />
                Competitive Handling
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Competitors Mentioned</span>
                  <span className="text-sm font-bold text-purple-600">{metrics.advanced_kpis.kpis.competitive_handling?.competitors_mentioned || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Responses Provided</span>
                  <span className="text-sm font-bold text-purple-600">{metrics.advanced_kpis.kpis.competitive_handling?.responses_provided || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Response Quality</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    metrics.advanced_kpis.kpis.competitive_handling?.response_quality === 'excellent' ? 'bg-green-100 text-green-700' :
                    metrics.advanced_kpis.kpis.competitive_handling?.response_quality === 'good' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {metrics.advanced_kpis.kpis.competitive_handling?.response_quality?.toUpperCase() || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Clear Differentiation</span>
                  <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.competitive_handling?.differentiation_clear ? 'bg-green-500' : 'bg-red-400'}`}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Call Preparation & Next Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Call Preparation */}
            <div className="bg-white rounded-lg shadow-md p-6 border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Award className="w-5 h-5 mr-2 text-orange-600" />
                Call Preparation
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Account Knowledge</span>
                  <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.call_preparation?.account_knowledge_demonstrated ? 'bg-green-500' : 'bg-red-400'}`}></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Preparation Score</span>
                  <span className={`text-sm font-bold ${metrics.advanced_kpis.kpis.call_preparation?.preparation_score >= 8 ? 'text-green-600' : 'text-orange-600'}`}>
                    {metrics.advanced_kpis.kpis.call_preparation?.preparation_score || 0}/10
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Personalization Evident</span>
                  <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.call_preparation?.personalization_evident ? 'bg-green-500' : 'bg-red-400'}`}></div>
                </div>
              </div>
            </div>

            {/* Next Steps & Urgency */}
            <div className="bg-white rounded-lg shadow-md p-6 border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-red-600" />
                Next Steps & Urgency
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Urgency Created</span>
                  <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.next_steps?.urgency_created ? 'bg-green-500' : 'bg-red-400'}`}></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Time-bound Commitments</span>
                  <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.next_steps?.time_bound_commitments ? 'bg-green-500' : 'bg-red-400'}`}></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Clear Next Steps</span>
                  <div className={`w-3 h-3 rounded-full ${metrics.advanced_kpis.kpis.next_steps?.clear_next_steps ? 'bg-green-500' : 'bg-red-400'}`}></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Conversion Likelihood</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    metrics.advanced_kpis.kpis.next_steps?.conversion_likelihood === 'high' ? 'bg-green-100 text-green-700' :
                    metrics.advanced_kpis.kpis.next_steps?.conversion_likelihood === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {metrics.advanced_kpis.kpis.next_steps?.conversion_likelihood?.toUpperCase() || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6 border">
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Advanced Sales Analytics</h3>
            <p className="text-gray-500 mb-4">
              Premium conversation analytics with SPIN/MEDDIC methodology tracking, discovery question analysis, and competitive handling insights.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700">
                <strong>To enable advanced KPIs:</strong> Ensure you have a premium subscription and LLM API configured in your company profile.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sales Methodology Compliance - Enhanced or Fallback */}
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Methodology Best Practices</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Conversation Dynamics</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              <li className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${metrics.talkToListenRatio >= 40 && metrics.talkToListenRatio <= 45 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                Optimal talk-to-listen ratio (40-45%)
              </li>
              <li className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${metrics.discoveryQuestionRate >= 18 ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                Elite discovery question rate (18+/hour)
              </li>
              <li className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${metrics.longestCustomerMonologue >= 45 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                Customer engagement depth (45-90s stories)
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Sales Excellence</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              <li className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${metrics.customerSentimentProgression >= 70 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                Positive sentiment progression (70%+ target)
              </li>
              <li className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${metrics.valuePropositionRate >= 3 ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                Value proposition articulation (3-4/10min)
              </li>
              <li className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${metrics.competitiveHandlingRate >= 90 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                Competitive handling excellence (90%+ target)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;