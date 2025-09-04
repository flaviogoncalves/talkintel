import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { buildUrl, createAuthHeaders } from '../config/api';
import { CallAnalysis } from '../types';
import CallAnalysisTable from './CallAnalysisTable';
import { Filter, Users, Calendar, Trash2 } from 'lucide-react';

interface KPIConfig {
  id: string;
  kpi_key: string;
  display_name: string;
  description: string;
  icon_name: string;
  display_order: number;
  weight: number;
  min_value: number;
  max_value: number;
  threshold_poor: number;
  threshold_fair: number;
  threshold_good: number;
}

interface DashboardType {
  id: string;
  internal_name: string;
  display_name: string;
  description: string;
  campaign_type?: string;
  theme_color: string;
  icon_name: string;
  recording_url_prefix?: string;
  is_active: boolean;
  is_default: boolean;
  kpis: KPIConfig[];
}

interface WebhookKPIScore {
  id: string;
  webhook_id: string;
  kpi_scores: Record<string, number>;
  overall_score: number;
  created_at: string;
  agent_name?: string;
  customer_name?: string;
  call_duration?: number;
  recording_url?: string;
}

interface GenericDashboardProps {
  dashboardTypeId?: string;
  campaignType?: string;
  refreshTrigger?: number;
}

const GenericDashboard: React.FC<GenericDashboardProps> = ({
  dashboardTypeId,
  campaignType,
  refreshTrigger = 0
}) => {
  const { tokens } = useAuth();
  const [dashboardType, setDashboardType] = useState<DashboardType | null>(null);
  const [kpiScores, setKpiScores] = useState<WebhookKPIScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpiProcessing, setKpiProcessing] = useState(false);
  const [kpiProcessingStatus, setKpiProcessingStatus] = useState<string>('');
  const [dateRange, setDateRange] = useState({ from: '7', to: '0' }); // Last 7 days
  const [kpiFilters, setKpiFilters] = useState<Record<string, { min: number; max: number }>>({});
  const [overallScoreFilter, setOverallScoreFilter] = useState({ min: 0, max: 10 });
  const [noDataAvailable, setNoDataAvailable] = useState(false);
  
  // Call Analysis states
  const [callAnalyses, setCallAnalyses] = useState<CallAnalysis[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });

  // Fetch dashboard configuration
  const fetchDashboardType = async () => {
    if (!tokens?.accessToken) return;
    
    try {
      let url = buildUrl('/api/dashboards/types');
      
      // If specific dashboard type is requested
      if (dashboardTypeId) {
        url = buildUrl(`/api/dashboards/types/${dashboardTypeId}`);
      } else if (campaignType) {
        url = buildUrl(`/api/dashboards/types?campaign_type=${campaignType}`);
      } else {
        // Get default dashboard
        url = buildUrl('/api/dashboards/types?default=true');
      }

      const response = await fetch(url, {
        headers: createAuthHeaders(tokens.accessToken)
      });

      if (response.ok) {
        const data = await response.json();
        const dashboard = dashboardTypeId ? data.dashboard_type : 
                         (data.dashboard_types && data.dashboard_types[0]);
        
        if (dashboard) {
          setDashboardType(dashboard);
          
          // Initialize KPI filters based on dashboard configuration
          const filters: Record<string, { min: number; max: number }> = {};
          dashboard.kpis?.forEach((kpi: KPIConfig) => {
            filters[kpi.kpi_key] = {
              min: kpi.min_value,
              max: kpi.max_value
            };
          });
          setKpiFilters(filters);
        }
      } else {
        throw new Error(`Failed to fetch dashboard type: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching dashboard type:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Fetch KPI scores
  const fetchKpiScores = async () => {
    if (!tokens?.accessToken || !dashboardType) return;
    
    try {
      const params = new URLSearchParams({
        dashboard_type_id: dashboardType.id,
        days_ago_from: dateRange.from,
        days_ago_to: dateRange.to
      });

      // Add KPI filters
      Object.entries(kpiFilters).forEach(([kpiKey, filter]) => {
        params.append(`kpi_${kpiKey}_min`, filter.min.toString());
        params.append(`kpi_${kpiKey}_max`, filter.max.toString());
      });

      // Add overall score filter
      params.append('overall_score_min', overallScoreFilter.min.toString());
      params.append('overall_score_max', overallScoreFilter.max.toString());

      const response = await fetch(buildUrl(`/api/webhooks/kpi-scores?${params}`), {
        headers: createAuthHeaders(tokens.accessToken)
      });

      if (response.ok) {
        const data = await response.json();
        const scores = data.kpi_scores || [];
        setKpiScores(scores);
        setNoDataAvailable(scores.length === 0);
        setError(null); // Clear any previous errors
      } else if (response.status === 404 || response.status === 400) {
        // These are expected for new dashboard types - not real errors
        setKpiScores([]);
        setNoDataAvailable(true);
        setError(null);
      } else {
        throw new Error(`Failed to fetch KPI scores: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching KPI scores:', error);
      // Only set error for real network/server issues, not missing data
      if (error instanceof TypeError || (error as any).message?.includes('fetch')) {
        setError(error instanceof Error ? error.message : 'Network error occurred');
      } else {
        setKpiScores([]);
        setNoDataAvailable(true);
        setError(null);
      }
    }
  };

  // Trigger KPI processing
  const processKpiScores = async () => {
    if (!tokens?.accessToken) return;
    
    setKpiProcessing(true);
    setKpiProcessingStatus('Starting KPI processing...');
    
    try {
      const response = await fetch(buildUrl('/api/kpi/process'), {
        method: 'POST',
        headers: createAuthHeaders(tokens.accessToken)
      });

      if (response.ok) {
        const data = await response.json();
        setKpiProcessingStatus(`Processing completed! ${data.stats?.processed_webhooks || 0} webhooks processed.`);
        
        // Wait a moment then refresh the data
        setTimeout(() => {
          fetchKpiScores();
          setKpiProcessing(false);
          setKpiProcessingStatus('');
        }, 2000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.details || `Processing failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Error processing KPI scores:', error);
      setKpiProcessingStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => {
        setKpiProcessing(false);
        setKpiProcessingStatus('');
      }, 3000);
    }
  };

  // Fetch webhook data for call analysis
  const fetchWebhookData = async () => {
    if (!tokens?.accessToken || !dashboardType) return;
    
    try {
      const params = new URLSearchParams();
      
      // Add dashboard type filter - use campaign_type if available
      if (dashboardType.campaign_type) {
        params.append('campaign_type', dashboardType.campaign_type);
      }
      
      // Add limit to get more data for analysis
      params.append('limit', '1000');
      
      const response = await fetch(buildUrl(`/api/webhooks?${params}`), {
        headers: createAuthHeaders(tokens.accessToken)
      });

      if (response.ok) {
        const data = await response.json();
        const webhooks = data.webhooks || [];
        
        // Convert webhooks to CallAnalysis format
        const callAnalyses: CallAnalysis[] = webhooks.map((webhook: any) => {
          // Extract sentiment
          let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
          if (webhook.sentiment_score !== null && webhook.sentiment_score !== undefined) {
            sentiment = webhook.sentiment_score > 0.1 ? 'positive' : 
                       webhook.sentiment_score < -0.1 ? 'negative' : 'neutral';
          }
          
          // Extract topics from webhook
          const topics: string[] = [];
          if (webhook.topics && typeof webhook.topics === 'string') {
            try {
              const parsedTopics = JSON.parse(webhook.topics);
              if (Array.isArray(parsedTopics)) {
                topics.push(...parsedTopics.map((t: any) => typeof t === 'string' ? t : t.label || t.topic));
              }
            } catch (e) {
              // If not JSON, split by comma
              topics.push(...webhook.topics.split(',').map((t: string) => t.trim()));
            }
          }

          return {
            id: webhook.id,
            timestamp: webhook.timestamp || webhook.created_at,
            duration: webhook.duration || 0,
            callType: webhook.call_type || 'human-human',
            agentId: webhook.agent_name || 'unknown',
            agentName: webhook.agent_name || 'Unknown Agent',
            agentType: webhook.call_type === 'human-bot' ? 'ai' : 'human',
            customerSatisfaction: webhook.satisfaction_score || 0,
            sentiment,
            resolutionRate: webhook.resolved ? 100 : 0,
            responseTime: webhook.duration || 0,
            callQuality: webhook.sentiment_score ? Math.max(0, Math.min(10, (webhook.sentiment_score + 1) * 5)) : 5,
            tags: topics.slice(0, 3), // Limit to first 3 topics as tags
            summary: webhook.summary || 'No summary available',
            keyInsights: webhook.key_insights ? [webhook.key_insights] : [],
            cost: webhook.cost || 0,
            currency: webhook.currency || 'USD',
            topics: topics,
            resolved: webhook.resolved === 1 || webhook.resolved === true,
            transcription: webhook.transcription,
            segments: webhook.segments ? (typeof webhook.segments === 'string' ? JSON.parse(webhook.segments) : webhook.segments) : undefined,
            sentimentAnalysis: webhook.sentiment_analysis ? (typeof webhook.sentiment_analysis === 'string' ? JSON.parse(webhook.sentiment_analysis) : webhook.sentiment_analysis) : undefined
          } as CallAnalysis;
        });
        
        setCallAnalyses(callAnalyses);
      } else {
        console.error('Failed to fetch webhook data:', response.status);
      }
    } catch (error) {
      console.error('Error fetching webhook data:', error);
    }
  };

  // Filter calls based on selected filters
  const getFilteredCalls = (): CallAnalysis[] => {
    let filtered = callAnalyses;

    // Filter by period
    if (selectedPeriod !== 'custom') {
      const today = new Date();
      const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
      const startDate = new Date(today.getTime() - (days * 24 * 60 * 60 * 1000));
      
      filtered = filtered.filter(call => {
        const callDate = new Date(call.timestamp);
        return callDate >= startDate;
      });
    } else if (customDateRange.start && customDateRange.end) {
      filtered = filtered.filter(call => {
        const callDate = new Date(call.timestamp);
        const start = new Date(customDateRange.start);
        const end = new Date(customDateRange.end);
        return callDate >= start && callDate <= end;
      });
    }

    // Filter by topic
    if (selectedTopic) {
      filtered = filtered.filter(call => 
        call.topics && call.topics.some(topic => 
          topic.toLowerCase().includes(selectedTopic.toLowerCase())
        )
      );
    }

    // Filter by agent
    if (selectedAgentId) {
      filtered = filtered.filter(call => call.agentId === selectedAgentId);
    }

    return filtered;
  };

  // Get unique agents for filter dropdown
  const getUniqueAgents = () => {
    const agents = callAnalyses.map(call => ({
      id: call.agentId,
      name: call.agentName
    }));
    
    const uniqueAgents = agents.filter((agent, index, self) => 
      index === self.findIndex(a => a.id === agent.id)
    );
    
    return uniqueAgents;
  };

  // Get unique topics for filter dropdown
  const getUniqueTopics = () => {
    const topics = callAnalyses.flatMap(call => call.topics || []);
    return [...new Set(topics)].filter(topic => topic && topic.trim() !== '');
  };

  // Delete webhook function
  const handleDeleteWebhook = async (webhookId: string) => {
    if (!tokens?.accessToken) return;
    
    try {
      const response = await fetch(buildUrl(`/api/webhooks/${webhookId}`), {
        method: 'DELETE',
        headers: createAuthHeaders(tokens.accessToken)
      });

      if (response.ok) {
        // Remove from local state
        setCallAnalyses(prev => prev.filter(call => call.id !== webhookId));
      } else {
        console.error('Failed to delete webhook:', response.status);
      }
    } catch (error) {
      console.error('Error deleting webhook:', error);
    }
  };

  useEffect(() => {
    fetchDashboardType();
  }, [tokens?.accessToken, dashboardTypeId, campaignType]);

  useEffect(() => {
    if (dashboardType) {
      fetchWebhookData(); // Fetch webhook data when dashboard type is loaded
    }
  }, [dashboardType]);

  useEffect(() => {
    if (dashboardType) {
      fetchKpiScores();
    }
  }, [dashboardType, dateRange, kpiFilters, overallScoreFilter, refreshTrigger]);

  useEffect(() => {
    setLoading(false);
  }, [kpiScores]);

  // Calculate aggregated statistics
  const stats = React.useMemo(() => {
    if (!kpiScores.length || !dashboardType?.kpis) return null;

    const totalCalls = kpiScores.length;
    const avgOverallScore = kpiScores.reduce((sum, score) => sum + score.overall_score, 0) / totalCalls;

    const kpiAverages: Record<string, number> = {};
    dashboardType.kpis.forEach(kpi => {
      const values = kpiScores
        .map(score => score.kpi_scores[kpi.kpi_key])
        .filter(val => val !== undefined);
      
      kpiAverages[kpi.kpi_key] = values.length > 0 
        ? values.reduce((sum, val) => sum + val, 0) / values.length
        : 0;
    });

    return {
      totalCalls,
      avgOverallScore,
      kpiAverages
    };
  }, [kpiScores, dashboardType]);

  // Helper function to get KPI color based on thresholds
  const getKpiColor = (kpi: KPIConfig, value: number): string => {
    if (value >= kpi.threshold_good) return 'text-green-400';
    if (value >= kpi.threshold_fair) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Helper function to get icon component (simplified)
  const getIconComponent = (iconName: string) => {
    // In a real implementation, you'd import from lucide-react or similar
    return <div className="w-6 h-6 bg-blue-400 rounded"></div>;
  };

  // Helper function to format recording URL
  const getRecordingUrl = (score: WebhookKPIScore): string | null => {
    if (!dashboardType?.recording_url_prefix || !score.recording_url) {
      return null;
    }
    return `${dashboardType.recording_url_prefix}${score.recording_url}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
        <h2 className="text-xl font-bold text-red-400 mb-4">❌ Dashboard Error</h2>
        <p className="text-red-300 mb-4">{error}</p>
        <div className="bg-gray-800/50 rounded p-4 mb-4">
          <p className="text-gray-300 font-medium text-sm mb-2">Troubleshooting:</p>
          <ul className="text-gray-400 text-sm space-y-1">
            <li>• Check if the webhook server is running (port 3005)</li>
            <li>• Verify authentication tokens are valid</li>
            <li>• Ensure dashboard types have been created</li>
            <li>• Check browser console for detailed error logs</li>
          </ul>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => { setError(null); fetchDashboardType(); }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
          >
            Retry
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-white transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardType) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6">
        <h2 className="text-xl font-bold text-yellow-400 mb-4">⚠️ No Dashboard Configuration</h2>
        <p className="text-yellow-300 mb-4">No dashboard configuration found. Please create a dashboard type first.</p>
        <div className="bg-blue-900/20 border border-blue-500/30 rounded p-4">
          <h3 className="text-blue-300 font-medium mb-2">Next Steps:</h3>
          <ul className="text-blue-200 text-sm space-y-1">
            <li>• Go to Dashboard Admin to create a new dashboard type</li>
            <li>• Configure KPIs and LLM profiles for analysis</li>
            <li>• Start sending webhook data to populate the dashboard</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Dashboard Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          {getIconComponent(dashboardType.icon_name)}
          <h1 className="text-3xl font-bold" style={{ color: dashboardType.theme_color }}>
            {dashboardType.display_name}
          </h1>
        </div>
        <p className="text-gray-400">{dashboardType.description}</p>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Filters</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Date Range</label>
            <select 
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            >
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>

          {/* Overall Score Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Overall Score ({overallScoreFilter.min} - {overallScoreFilter.max})
            </label>
            <div className="flex space-x-2">
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={overallScoreFilter.min}
                onChange={(e) => setOverallScoreFilter(prev => ({ 
                  ...prev, 
                  min: parseFloat(e.target.value) 
                }))}
                className="flex-1"
              />
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={overallScoreFilter.max}
                onChange={(e) => setOverallScoreFilter(prev => ({ 
                  ...prev, 
                  max: parseFloat(e.target.value) 
                }))}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        {/* KPI Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {dashboardType.kpis?.map(kpi => (
            <div key={kpi.kpi_key}>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {kpi.display_name} ({kpiFilters[kpi.kpi_key]?.min.toFixed(1)} - {kpiFilters[kpi.kpi_key]?.max.toFixed(1)})
              </label>
              <div className="flex space-x-2">
                <input
                  type="range"
                  min={kpi.min_value}
                  max={kpi.max_value}
                  step="0.1"
                  value={kpiFilters[kpi.kpi_key]?.min || kpi.min_value}
                  onChange={(e) => setKpiFilters(prev => ({
                    ...prev,
                    [kpi.kpi_key]: {
                      ...prev[kpi.kpi_key],
                      min: parseFloat(e.target.value)
                    }
                  }))}
                  className="flex-1"
                />
                <input
                  type="range"
                  min={kpi.min_value}
                  max={kpi.max_value}
                  step="0.1"
                  value={kpiFilters[kpi.kpi_key]?.max || kpi.max_value}
                  onChange={(e) => setKpiFilters(prev => ({
                    ...prev,
                    [kpi.kpi_key]: {
                      ...prev[kpi.kpi_key],
                      max: parseFloat(e.target.value)
                    }
                  }))}
                  className="flex-1"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Overview */}
      {stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Total Calls</h3>
            <p className="text-3xl font-bold text-blue-400">{stats.totalCalls}</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Average Score</h3>
            <p className="text-3xl font-bold text-green-400">
              {stats.avgOverallScore.toFixed(1)}
            </p>
          </div>

          {dashboardType.kpis?.slice(0, 2).map(kpi => (
            <div key={kpi.kpi_key} className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">{kpi.display_name}</h3>
              <p className={`text-3xl font-bold ${getKpiColor(kpi, stats.kpiAverages[kpi.kpi_key])}`}>
                {stats.kpiAverages[kpi.kpi_key].toFixed(1)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Total Calls</h3>
            <p className="text-3xl font-bold text-gray-500">0</p>
            <p className="text-xs text-gray-500 mt-1">No data available</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Average Score</h3>
            <p className="text-3xl font-bold text-gray-500">-</p>
            <p className="text-xs text-gray-500 mt-1">No scores to calculate</p>
          </div>

          {dashboardType.kpis?.slice(0, 2).map(kpi => (
            <div key={kpi.kpi_key} className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">{kpi.display_name}</h3>
              <p className="text-3xl font-bold text-gray-500">-</p>
              <p className="text-xs text-gray-500 mt-1">No scores available</p>
            </div>
          ))}
        </div>
      )}

      {/* KPI Details Grid */}
      {dashboardType.kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {dashboardType.kpis.map(kpi => (
            <div key={kpi.kpi_key} className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-2">
                {getIconComponent(kpi.icon_name)}
                <h3 className="text-lg font-semibold">{kpi.display_name}</h3>
              </div>
              <p className="text-gray-400 text-sm mb-3">{kpi.description}</p>
              
              {stats ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Average:</span>
                    <span className={getKpiColor(kpi, stats.kpiAverages[kpi.kpi_key])}>
                      {stats.kpiAverages[kpi.kpi_key].toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Weight:</span>
                    <span>{kpi.weight}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${(stats.kpiAverages[kpi.kpi_key] / kpi.max_value) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Average:</span>
                    <span className="text-gray-500">No data</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Weight:</span>
                    <span>{kpi.weight}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className="bg-gray-600 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Send webhook data to see KPI scores</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recent Calls Table */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Calls</h3>
        
        {kpiScores.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6 max-w-lg mx-auto">
              <h4 className="text-blue-300 font-semibold mb-3">
                {noDataAvailable ? '🔄 No KPI Data Processed Yet' : '📊 No Call Data Available'}
              </h4>
              
              {noDataAvailable ? (
                <div>
                  <p className="text-blue-200 text-sm mb-4">
                    This dashboard type doesn't have any processed KPI scores yet. 
                    You'll need to process existing webhook data to see metrics and insights.
                  </p>
                  
                  {kpiProcessingStatus && (
                    <div className="bg-gray-700/50 rounded p-3 mb-4">
                      <p className="text-yellow-300 text-sm font-medium">
                        {kpiProcessing ? '⏳ ' : '✅ '}{kpiProcessingStatus}
                      </p>
                      {kpiProcessing && (
                        <div className="w-full bg-gray-600 rounded-full h-1 mt-2">
                          <div className="bg-blue-500 h-1 rounded-full animate-pulse" style={{width: '60%'}}></div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="bg-gray-700/50 rounded p-3 text-left mb-4">
                    <p className="text-gray-300 font-medium text-xs mb-2">What processing does:</p>
                    <ul className="text-gray-400 text-xs space-y-1">
                      <li>• Analyzes existing webhook transcriptions</li>
                      <li>• Generates KPI scores using LLM analysis</li>
                      <li>• Creates quality metrics for this dashboard type</li>
                      <li>• May take a few minutes depending on data volume</li>
                    </ul>
                  </div>
                  
                  <div className="flex space-x-2 justify-center">
                    <button 
                      onClick={processKpiScores}
                      disabled={kpiProcessing}
                      className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 disabled:bg-gray-600/20 disabled:cursor-not-allowed text-green-300 disabled:text-gray-500 rounded text-sm transition-colors"
                    >
                      {kpiProcessing ? 'Processing...' : '🚀 Process KPI Scores'}
                    </button>
                    
                    <button 
                      onClick={() => fetchKpiScores()}
                      disabled={kpiProcessing}
                      className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 disabled:bg-gray-600/20 disabled:cursor-not-allowed text-blue-300 disabled:text-gray-500 rounded text-sm transition-colors"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-blue-200 text-sm mb-4">
                    {dateRange.from === '1' ? 'No calls found in the last 24 hours' : 
                     dateRange.from === '7' ? 'No calls found in the last 7 days' :
                     dateRange.from === '30' ? 'No calls found in the last 30 days' :
                     'No calls found in the last 90 days'} matching your current filters.
                  </p>
                  <div className="bg-gray-700/50 rounded p-3 text-left mb-4">
                    <p className="text-gray-300 font-medium text-xs mb-2">Possible reasons:</p>
                    <ul className="text-gray-400 text-xs space-y-1">
                      <li>• Filters are too restrictive</li>
                      <li>• Selected date range has no activity</li>
                      <li>• No webhook data matches the current criteria</li>
                    </ul>
                  </div>
                  <button 
                    onClick={() => {
                      setKpiFilters({});
                      setOverallScoreFilter({ min: 0, max: 10 });
                      setDateRange({ from: '90', to: '0' });
                    }}
                    className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded text-sm transition-colors"
                  >
                    Reset All Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-3">Date/Time</th>
                  <th className="text-left p-3">Agent</th>
                  <th className="text-left p-3">Customer</th>
                  <th className="text-left p-3">Overall Score</th>
                  {dashboardType.kpis?.slice(0, 3).map(kpi => (
                    <th key={kpi.kpi_key} className="text-left p-3">{kpi.display_name}</th>
                  ))}
                  {dashboardType.recording_url_prefix && (
                    <th className="text-left p-3">Recording</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {kpiScores.slice(0, 20).map((score, index) => (
                  <tr key={score.id} className={index % 2 === 0 ? 'bg-gray-700/50' : ''}>
                    <td className="p-3">
                      {new Date(score.created_at).toLocaleString()}
                    </td>
                    <td className="p-3">{score.agent_name || 'Unknown'}</td>
                    <td className="p-3">{score.customer_name || 'Unknown'}</td>
                    <td className="p-3">
                      <span className={score.overall_score >= 8 ? 'text-green-400' : 
                                     score.overall_score >= 6 ? 'text-yellow-400' : 'text-red-400'}>
                        {score.overall_score.toFixed(1)}
                      </span>
                    </td>
                    {dashboardType.kpis?.slice(0, 3).map(kpi => (
                      <td key={kpi.kpi_key} className="p-3">
                        <span className={getKpiColor(kpi, score.kpi_scores[kpi.kpi_key] || 0)}>
                          {(score.kpi_scores[kpi.kpi_key] || 0).toFixed(1)}
                        </span>
                      </td>
                    ))}
                    {dashboardType.recording_url_prefix && (
                      <td className="p-3">
                        {getRecordingUrl(score) ? (
                          <a 
                            href={getRecordingUrl(score)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                          >
                            🎵 Play
                          </a>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Call Analysis Section */}
      <div className="bg-gray-800 rounded-lg p-6 mt-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold text-white flex items-center">
            📞 Call Analysis
            <span className="ml-2 text-sm text-gray-400">({getFilteredCalls().length} calls)</span>
          </h3>
          
          {/* Call Analysis Filters */}
          <div className="flex items-center space-x-3">
            {/* Period Filter */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="custom">Custom Range</option>
            </select>

            {/* Agent Filter */}
            <select
              value={selectedAgentId || ''}
              onChange={(e) => setSelectedAgentId(e.target.value || null)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm"
            >
              <option value="">All Agents</option>
              {getUniqueAgents().map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>

            {/* Topic Filter */}
            <select
              value={selectedTopic || ''}
              onChange={(e) => setSelectedTopic(e.target.value || null)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm"
            >
              <option value="">All Topics</option>
              {getUniqueTopics().map(topic => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>

            {/* Clear Filters Button */}
            {(selectedAgentId || selectedTopic || selectedPeriod !== '7d') && (
              <button
                onClick={() => {
                  setSelectedAgentId(null);
                  setSelectedTopic(null);
                  setSelectedPeriod('7d');
                  setCustomDateRange({ start: '', end: '' });
                }}
                className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-md text-sm transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Range */}
        {selectedPeriod === 'custom' && (
          <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">From</label>
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">To</label>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Call Analysis Table */}
        {getFilteredCalls().length > 0 ? (
          <CallAnalysisTable calls={getFilteredCalls()} onDelete={handleDeleteWebhook} />
        ) : (
          <div className="text-center py-12">
            <div className="bg-gray-700/50 rounded-lg p-6 max-w-md mx-auto">
              <h4 className="text-gray-300 font-semibold mb-3">📞 No Calls Found</h4>
              <p className="text-gray-400 text-sm mb-4">
                {callAnalyses.length === 0 
                  ? "No call data available for this dashboard type yet."
                  : "No calls match your current filter criteria."
                }
              </p>
              {callAnalyses.length === 0 ? (
                <p className="text-gray-500 text-xs">
                  Call data will appear here once webhooks are sent to this dashboard type's campaigns.
                </p>
              ) : (
                <button 
                  onClick={() => {
                    setSelectedAgentId(null);
                    setSelectedTopic(null);
                    setSelectedPeriod('90d');
                    setCustomDateRange({ start: '', end: '' });
                  }}
                  className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded text-sm transition-colors"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GenericDashboard;