import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { buildUrl, createAuthHeaders } from '../config/api';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Settings, 
  Save, 
  X, 
  Eye, 
  PlayCircle,
  Brain,
  Zap,
  Shield,
  RefreshCw
} from 'lucide-react';

interface KPIDefinition {
  kpi_key: string;
  display_name: string;
  description: string;
  icon_name: string;
  weight: number;
  min_value: number;
  max_value: number;
  calculation_hint: string;
  threshold_poor: number;
  threshold_fair: number;
  threshold_good: number;
}

interface LLMProfile {
  profile_name: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  user_prompt_template: string;
  output_format: any;
}

interface DashboardType {
  id?: string;
  internal_name: string;
  display_name: string;
  description: string;
  campaign_type: string;
  theme_color: string;
  icon_name: string;
  recording_url_prefix: string;
  is_default: boolean;
  kpis: KPIDefinition[];
  llm_profile?: LLMProfile;
}

const DashboardAdmin: React.FC = () => {
  const { tokens } = useAuth();
  const [dashboardTypes, setDashboardTypes] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<DashboardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPromptHelper, setShowPromptHelper] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('customer_service');
  const [error, setError] = useState<string | null>(null);
  const [kpiProcessing, setKpiProcessing] = useState(false);
  const [kpiProcessingStatus, setKpiProcessingStatus] = useState<string>('');
  const [processingStats, setProcessingStats] = useState<any>(null);

  console.log('🚀 DashboardAdmin component loaded!');
  console.log('🔑 Auth tokens available:', !!tokens?.accessToken);
  
  const [formData, setFormData] = useState<DashboardType>({
    internal_name: '',
    display_name: '',
    description: '',
    campaign_type: '',
    theme_color: '#8B5CF6',
    icon_name: 'layout-dashboard',
    recording_url_prefix: '',
    is_default: false,
    kpis: Array(8).fill(null).map((_, i) => ({
      kpi_key: '',
      display_name: '',
      description: '',
      icon_name: 'activity',
      weight: 12.5, // 100/8 = 12.5
      min_value: 0,
      max_value: 10,
      calculation_hint: '',
      threshold_poor: 4,
      threshold_fair: 6,
      threshold_good: 8
    })),
    llm_profile: {
      profile_name: '',
      model_name: 'gpt-4',
      temperature: 0.7,
      max_tokens: 500,
      system_prompt: '',
      user_prompt_template: '',
      output_format: {}
    }
  });

  // Prompt Templates for different industries
  const promptTemplates = {
    customer_service: {
      name: 'Customer Service Excellence',
      system: 'You are a contact center quality analyst specializing in customer service excellence. Analyze call transcriptions and evaluate them against key performance indicators. Rate each KPI from 0 to 10 based on the conversation quality.',
      user: `Call Transcription:
{transcription}

Agent Name: {agent_name}
Customer Name: {customer_name}
Call Duration: {duration} seconds

Evaluate the following 8 KPIs and provide a score from 0-10 for each:

1. Customer Sentiment Score (0-10): Overall customer emotional state throughout the call
2. Agent Empathy Score (0-10): How well the agent demonstrated understanding and compassion
3. First Contact Resolution (0-10): Likelihood that the issue was resolved in this call
4. Customer Effort Score (0-10): How easy was it for the customer to get their issue resolved
5. Conversation Flow Quality (0-10): Natural dialogue progression and turn-taking
6. Agent Knowledge Assessment (0-10): Agent expertise and information accuracy
7. Call Wrap-up Quality (0-10): Quality of call conclusion with next steps
8. Behavioral Standards Compliance (0-10): Adherence to professional standards

Provide your evaluation in the following JSON structure:
{
  "customer_sentiment_score": 0,
  "agent_empathy_score": 0,
  "first_contact_resolution": 0,
  "customer_effort_score": 0,
  "conversation_flow_quality": 0,
  "agent_knowledge_assessment": 0,
  "call_wrap_up_quality": 0,
  "behavioral_standards_compliance": 0
}`
    },
    debt_collection: {
      name: 'Debt Collection Compliance',
      system: 'You are a compliance specialist for debt collection operations. Analyze call transcriptions for regulatory compliance and effectiveness. Rate each KPI from 0 to 10 based on legal adherence and collection best practices.',
      user: `Call Transcription:
{transcription}

Agent Name: {agent_name}
Customer Name: {customer_name}
Call Duration: {duration} seconds

Evaluate the following 8 KPIs and provide a score from 0-10 for each:

1. Mini-Miranda Compliance (0-10): Proper disclosure of debt collection attempt
2. Promise-to-Pay Conversion (0-10): Effectiveness in securing payment commitment
3. Payment Discussion Rate (0-10): Whether agent actually requested payment
4. Right Party Contact Verification (0-10): Proper identity confirmation before discussing debt
5. FDCPA Violation Detection (0-10): Absence of prohibited language or threatening tone
6. Empathy Score (0-10): Professional and respectful communication
7. Objection Handling (0-10): Ability to address customer concerns appropriately
8. Information Gathering (0-10): Collection of relevant customer data

Provide your evaluation in the following JSON structure:
{
  "mini_miranda_compliance": 0,
  "promise_to_pay_conversion": 0,
  "payment_discussion_rate": 0,
  "right_party_verification": 0,
  "fdcpa_compliance": 0,
  "empathy_score": 0,
  "objection_handling": 0,
  "information_gathering": 0
}`
    },
    telesales: {
      name: 'Telesales Performance',
      system: 'You are a sales performance analyst specializing in telesales operations. Analyze call transcriptions for sales effectiveness and methodology adherence. Rate each KPI from 0 to 10 based on proven sales techniques.',
      user: `Call Transcription:
{transcription}

Agent Name: {agent_name}
Customer Name: {customer_name}
Call Duration: {duration} seconds

Evaluate the following 8 KPIs and provide a score from 0-10 for each:

1. Talk-to-Listen Ratio (0-10): Optimal balance (40-45% agent talk time)
2. Discovery Questions (0-10): Frequency and quality of probing questions
3. Customer Engagement (0-10): Length and quality of customer responses
4. Conversation Dynamics (0-10): Natural flow and speaker transitions
5. Value Proposition Articulation (0-10): Clear connection of benefits to needs
6. Sales Methodology Adherence (0-10): Following proven sales frameworks
7. Competitive Handling (0-10): Response to competitive mentions
8. Next Steps Conversion (0-10): Securing time-bound commitments

Provide your evaluation in the following JSON structure:
{
  "talk_listen_ratio": 0,
  "discovery_questions": 0,
  "customer_engagement": 0,
  "conversation_dynamics": 0,
  "value_proposition": 0,
  "methodology_adherence": 0,
  "competitive_handling": 0,
  "next_steps_conversion": 0
}`
    }
  };

  const applyTemplate = (templateKey: string) => {
    const template = promptTemplates[templateKey as keyof typeof promptTemplates];
    if (template) {
      setFormData({
        ...formData,
        llm_profile: {
          ...formData.llm_profile!,
          system_prompt: template.system,
          user_prompt_template: template.user,
          profile_name: template.name
        }
      });
    }
  };

  const fetchDashboardTypes = async (forceRefresh = false) => {
    console.log('📡 Fetching dashboard types...', forceRefresh ? '(Force Refresh)' : '');
    setError(null);
    
    // If this is a force refresh, briefly show loading state
    if (forceRefresh) {
      setLoading(true);
    }
    
    try {
      // Add cache-busting parameter for force refresh
      const url = forceRefresh 
        ? buildUrl(`/api/dashboards/types?_t=${Date.now()}`)
        : buildUrl('/api/dashboards/types');
        
      const response = await fetch(url, {
        headers: createAuthHeaders(tokens?.accessToken)
      });
      
      console.log('📡 Dashboard API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Dashboard types received:', data.dashboard_types?.length || 0);
        
        // Force React to re-render by creating a new array reference
        setDashboardTypes([...data.dashboard_types || []]);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch dashboard types:', response.status, errorText);
        setError(`API Error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Network error fetching dashboard types:', error);
      setError(`Network Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardTypes();
  }, []);

  // KPI Processing function
  const processKpiScores = async () => {
    if (!tokens?.accessToken) return;
    
    setKpiProcessing(true);
    setKpiProcessingStatus('Starting KPI processing pipeline...');
    setProcessingStats(null);
    
    try {
      console.log('🚀 Triggering KPI processing from Dashboard Admin...');
      
      const response = await fetch(buildUrl('/api/kpi/process'), {
        method: 'POST',
        headers: createAuthHeaders(tokens.accessToken)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ KPI processing completed:', data);
        
        setProcessingStats(data.stats);
        setKpiProcessingStatus(`Processing completed successfully! Processed ${data.stats?.processed_webhooks || 0} webhooks.`);
        
        // Clear status after a delay
        setTimeout(() => {
          setKpiProcessing(false);
          setKpiProcessingStatus('');
        }, 5000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || `Processing failed: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error processing KPI scores:', error);
      setKpiProcessingStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      setTimeout(() => {
        setKpiProcessing(false);
        setKpiProcessingStatus('');
        setProcessingStats(null);
      }, 5000);
    }
  };

  const handleCreateDashboard = async () => {
    try {
      // Validate weights sum to 100
      const totalWeight = formData.kpis.reduce((sum, kpi) => sum + kpi.weight, 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        alert(`KPI weights must sum to 100. Currently: ${totalWeight}`);
        return;
      }

      // Build output format from KPIs
      const outputFormat = {
        type: 'object',
        properties: {},
        required: formData.kpis.map(kpi => kpi.kpi_key)
      };

      formData.kpis.forEach(kpi => {
        if (kpi.kpi_key) {
          outputFormat.properties[kpi.kpi_key] = {
            type: 'number',
            minimum: kpi.min_value,
            maximum: kpi.max_value
          };
        }
      });

      formData.llm_profile!.output_format = outputFormat;

      console.log('🔄 Creating dashboard...', formData.display_name);

      const response = await fetch(buildUrl('/api/dashboards/types'), {
        method: 'POST',
        headers: createAuthHeaders(tokens?.accessToken),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Dashboard created successfully:', result);
        
        alert('Dashboard type created successfully!');
        setShowCreateForm(false);
        resetForm();
        
        // Force a refresh with a small delay to ensure backend has processed
        setTimeout(async () => {
          console.log('🔄 Refreshing dashboard list after creation...');
          await fetchDashboardTypes(true);
        }, 500);
      } else {
        const error = await response.json();
        console.error('❌ Dashboard creation failed:', error);
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('❌ Error creating dashboard:', error);
      alert('Failed to create dashboard type');
    }
  };

  const resetForm = () => {
    setFormData({
      internal_name: '',
      display_name: '',
      description: '',
      campaign_type: '',
      theme_color: '#8B5CF6',
      icon_name: 'layout-dashboard',
      recording_url_prefix: '',
      is_default: false,
      kpis: Array(8).fill(null).map((_, i) => ({
        kpi_key: '',
        display_name: '',
        description: '',
        icon_name: 'activity',
        weight: 12.5,
        min_value: 0,
        max_value: 10,
        calculation_hint: '',
        threshold_poor: 4,
        threshold_fair: 6,
        threshold_good: 8
      })),
      llm_profile: {
        profile_name: '',
        model_name: 'gpt-4',
        temperature: 0.7,
        max_tokens: 500,
        system_prompt: '',
        user_prompt_template: '',
        output_format: {}
      }
    });
  };

  // Fetch detailed dashboard data for editing
  const fetchDashboardDetails = async (dashboardId: string) => {
    try {
      const response = await fetch(buildUrl(`/api/dashboards/types/${dashboardId}`), {
        headers: createAuthHeaders(tokens?.accessToken)
      });
      
      if (response.ok) {
        const data = await response.json();
        const dashboard = data.dashboard_type;
        
        // Populate form with dashboard data
        setFormData({
          internal_name: dashboard.internal_name,
          display_name: dashboard.display_name,
          description: dashboard.description || '',
          campaign_type: dashboard.campaign_type || '',
          theme_color: dashboard.theme_color || '#8B5CF6',
          icon_name: dashboard.icon_name || 'layout-dashboard',
          recording_url_prefix: dashboard.recording_url_prefix || '',
          is_default: dashboard.is_default || false,
          kpis: dashboard.kpis || Array(8).fill(null).map((_, i) => ({
            kpi_key: '',
            display_name: '',
            description: '',
            icon_name: 'activity',
            weight: 12.5,
            min_value: 0,
            max_value: 10,
            calculation_hint: '',
            threshold_poor: 4,
            threshold_fair: 6,
            threshold_good: 8
          })),
          llm_profile: dashboard.llm_profile || {
            profile_name: '',
            model_name: 'gpt-4',
            temperature: 0.7,
            max_tokens: 500,
            system_prompt: '',
            user_prompt_template: '',
            output_format: {}
          }
        });
        
        setEditingDashboard({ ...dashboard, id: dashboardId });
        setShowCreateForm(true);
      } else {
        const error = await response.json();
        alert(`Error loading dashboard: ${error.error}`);
      }
    } catch (error) {
      console.error('Error fetching dashboard details:', error);
      alert('Failed to load dashboard details');
    }
  };

  // Handle dashboard editing
  const handleEditDashboard = async () => {
    if (!editingDashboard) return;
    
    try {
      // Validate weights sum to 100
      const totalWeight = formData.kpis.reduce((sum, kpi) => sum + kpi.weight, 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        alert(`KPI weights must sum to 100. Currently: ${totalWeight}`);
        return;
      }

      console.log('🔄 Updating dashboard...', formData.display_name);

      const response = await fetch(buildUrl(`/api/dashboards/types/${editingDashboard.id}`), {
        method: 'PUT',
        headers: createAuthHeaders(tokens?.accessToken),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Dashboard updated successfully:', result);
        
        alert('Dashboard type updated successfully!');
        setShowCreateForm(false);
        setEditingDashboard(null);
        resetForm();
        
        // Force a refresh with a small delay to ensure backend has processed
        setTimeout(async () => {
          console.log('🔄 Refreshing dashboard list after update...');
          await fetchDashboardTypes(true);
        }, 500);
      } else {
        const error = await response.json();
        console.error('❌ Dashboard update failed:', error);
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('❌ Error updating dashboard:', error);
      alert('Failed to update dashboard type');
    }
  };

  // Handle dashboard deletion
  const handleDeleteDashboard = async (dashboard: any) => {
    if (!confirm(`Are you sure you want to delete "${dashboard.display_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      console.log('🗑️ Deleting dashboard...', dashboard.display_name);

      const response = await fetch(buildUrl(`/api/dashboards/types/${dashboard.id}`), {
        method: 'DELETE',
        headers: createAuthHeaders(tokens?.accessToken)
      });

      if (response.ok) {
        console.log('✅ Dashboard deleted successfully:', dashboard.display_name);
        alert('Dashboard type deleted successfully!');
        
        // Force a refresh with a small delay to ensure backend has processed
        setTimeout(async () => {
          console.log('🔄 Refreshing dashboard list after deletion...');
          await fetchDashboardTypes(true);
        }, 500);
      } else {
        const error = await response.json();
        console.error('❌ Dashboard deletion failed:', error);
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('❌ Error deleting dashboard:', error);
      alert('Failed to delete dashboard type');
    }
  };

  const updateKPI = (index: number, field: keyof KPIDefinition, value: any) => {
    const newKpis = [...formData.kpis];
    newKpis[index] = { ...newKpis[index], [field]: value };
    setFormData({ ...formData, kpis: newKpis });
  };

  const normalizeWeights = () => {
    const newKpis = formData.kpis.map(kpi => ({
      ...kpi,
      weight: 100 / 8 // Equal weights
    }));
    setFormData({ ...formData, kpis: newKpis });
  };

  const loadTemplate = (templateName: string) => {
    const templates = {
      customer_service: {
        display_name: 'Customer Service Excellence',
        description: 'Comprehensive customer service quality analysis with 8 key performance indicators',
        campaign_type: 'customer_service',
        kpis: [
          { key: 'customer_sentiment_score', name: 'Customer Sentiment', icon: 'heart', weight: 20, hint: 'Rate customer emotional state from 0-10' },
          { key: 'agent_empathy_score', name: 'Agent Empathy', icon: 'users', weight: 15, hint: 'Look for empathy markers and understanding' },
          { key: 'first_contact_resolution', name: 'First Contact Resolution', icon: 'check-circle', weight: 25, hint: '10 = completely resolved, 0 = no progress' },
          { key: 'customer_effort_score', name: 'Customer Effort', icon: 'activity', weight: 15, hint: '10 = effortless, 0 = high effort required' },
          { key: 'conversation_flow_quality', name: 'Conversation Flow', icon: 'message-circle', weight: 10, hint: 'Natural dialogue and turn-taking quality' },
          { key: 'agent_knowledge_assessment', name: 'Agent Knowledge', icon: 'brain', weight: 5, hint: 'Expertise and information accuracy' },
          { key: 'call_wrap_up_quality', name: 'Call Wrap-up', icon: 'check-square', weight: 5, hint: 'Clear next steps and closure' },
          { key: 'behavioral_standards_compliance', name: 'Standards Compliance', icon: 'shield', weight: 5, hint: 'Professional standards adherence' }
        ]
      },
      debt_collection: {
        display_name: 'Debt Collection Compliance',
        description: 'FDCPA compliance and collection effectiveness analysis',
        campaign_type: 'debt_collection',
        kpis: [
          { key: 'fdcpa_compliance_rate', name: 'FDCPA Compliance', icon: 'shield-check', weight: 30, hint: 'Check for required disclosures and prohibited practices' },
          { key: 'payment_commitment_rate', name: 'Payment Commitment', icon: 'credit-card', weight: 25, hint: 'Successfully obtained payment promises' },
          { key: 'negotiation_effectiveness', name: 'Negotiation Skills', icon: 'handshake', weight: 20, hint: 'Effective negotiation and problem solving' },
          { key: 'customer_verification_score', name: 'Identity Verification', icon: 'user-check', weight: 10, hint: 'Proper right party contact verification' },
          { key: 'empathy_professionalism', name: 'Empathy & Professionalism', icon: 'heart', weight: 5, hint: 'Respectful and understanding approach' },
          { key: 'information_gathering', name: 'Information Gathering', icon: 'clipboard', weight: 5, hint: 'Collected necessary customer information' },
          { key: 'objection_handling', name: 'Objection Handling', icon: 'message-square', weight: 3, hint: 'Addressed customer concerns effectively' },
          { key: 'call_documentation', name: 'Documentation Quality', icon: 'file-text', weight: 2, hint: 'Proper call notes and follow-up' }
        ]
      },
      sales: {
        display_name: 'Sales Performance Analysis',
        description: 'Sales conversation dynamics and methodology assessment',
        campaign_type: 'sales',
        kpis: [
          { key: 'discovery_question_rate', name: 'Discovery Questions', icon: 'help-circle', weight: 25, hint: 'Quality and quantity of discovery questions' },
          { key: 'customer_engagement', name: 'Customer Engagement', icon: 'users', weight: 20, hint: 'Customer participation and interest level' },
          { key: 'value_proposition_quality', name: 'Value Proposition', icon: 'target', weight: 20, hint: 'Clear articulation of benefits and value' },
          { key: 'objection_handling_sales', name: 'Objection Handling', icon: 'shield', weight: 15, hint: 'Effective responses to customer objections' },
          { key: 'closing_technique', name: 'Closing Technique', icon: 'check-circle', weight: 10, hint: 'Natural and effective closing attempts' },
          { key: 'product_knowledge', name: 'Product Knowledge', icon: 'book', weight: 5, hint: 'Demonstrated expertise and accuracy' },
          { key: 'rapport_building', name: 'Rapport Building', icon: 'smile', weight: 3, hint: 'Connection and trust establishment' },
          { key: 'next_steps_clarity', name: 'Next Steps', icon: 'arrow-right', weight: 2, hint: 'Clear follow-up and progression plan' }
        ]
      }
    };

    if (templates[templateName as keyof typeof templates]) {
      const template = templates[templateName as keyof typeof templates];
      setFormData({
        ...formData,
        display_name: template.display_name,
        description: template.description,
        campaign_type: template.campaign_type,
        kpis: template.kpis.map(kpi => ({
          kpi_key: kpi.key,
          display_name: kpi.name,
          description: '',
          icon_name: kpi.icon,
          weight: kpi.weight,
          min_value: 0,
          max_value: 10,
          calculation_hint: kpi.hint,
          threshold_poor: 4,
          threshold_fair: 6,
          threshold_good: 8
        }))
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
        <h2 className="text-xl font-bold text-red-400 mb-4">❌ Dashboard Admin Error</h2>
        <p className="text-red-300 mb-4">{error}</p>
        <button
          onClick={() => {
            setError(null);
            fetchDashboardTypes(true);
          }}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
        <div className="mt-4 p-4 bg-gray-800 rounded text-sm">
          <p className="text-gray-300">Debug Info:</p>
          <p className="text-gray-400">• Auth tokens: {tokens?.accessToken ? '✅' : '❌'}</p>
          <p className="text-gray-400">• API URL: {buildUrl('/api/dashboards/types')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard Administration</h1>
          <p className="text-gray-400">Create and manage configurable dashboard types</p>
          {kpiProcessingStatus && (
            <div className="mt-2 p-2 bg-blue-900/30 border border-blue-500/30 rounded text-sm">
              <p className={`${kpiProcessing ? 'text-yellow-300' : 'text-green-300'} font-medium`}>
                {kpiProcessing ? '⏳ ' : '✅ '}{kpiProcessingStatus}
              </p>
              {processingStats && (
                <div className="mt-1 text-xs text-blue-200">
                  Total webhooks: {processingStats.total_webhooks} | 
                  Processed: {processingStats.processed_webhooks} | 
                  Unprocessed: {processingStats.unprocessed_webhooks} | 
                  Errors: {processingStats.error_count}
                </div>
              )}
              {kpiProcessing && (
                <div className="w-full bg-gray-600 rounded-full h-1 mt-2">
                  <div className="bg-blue-500 h-1 rounded-full animate-pulse" style={{width: '70%'}}></div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={processKpiScores}
            disabled={kpiProcessing}
            className="flex items-center space-x-2 px-3 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            title="Process webhooks to generate KPI scores for all dashboard types"
          >
            <Brain className="w-4 h-4" />
            <span>{kpiProcessing ? 'Processing...' : 'Process KPIs'}</span>
          </button>
          <button
            onClick={() => fetchDashboardTypes(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg transition-colors"
            title="Refresh dashboard list"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create Dashboard</span>
          </button>
        </div>
      </div>

      {/* Dashboard Types List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboardTypes.map((dashboard) => (
          <div key={dashboard.id} className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: dashboard.theme_color }}
                >
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{dashboard.display_name}</h3>
                  <p className="text-sm text-gray-400">{dashboard.campaign_type}</p>
                </div>
              </div>
              {dashboard.is_default && (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Default</span>
              )}
            </div>
            
            <p className="text-gray-300 text-sm mb-4">{dashboard.description}</p>
            
            <div className="flex justify-between items-center text-sm text-gray-400">
              <span>{dashboard.kpi_count} KPIs</span>
              <span>{dashboard.llm_profile_count} LLM Profile</span>
            </div>
            
            <div className="flex space-x-2 mt-4">
              <button className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors">
                <Eye className="w-4 h-4" />
                <span>View</span>
              </button>
              <button 
                onClick={() => fetchDashboardDetails(dashboard.id)}
                className="flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              {dashboard.internal_name !== 'customer_service' && (
                <button 
                  onClick={() => handleDeleteDashboard(dashboard)}
                  className="flex items-center justify-center space-x-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingDashboard ? 'Edit Dashboard Type' : 'Create Dashboard Type'}
              </h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Internal Name *
                  </label>
                  <input
                    type="text"
                    value={formData.internal_name}
                    onChange={(e) => setFormData({ ...formData, internal_name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="e.g., customer_service_v2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="Customer Service Excellence"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Campaign Type
                  </label>
                  <select
                    value={formData.campaign_type}
                    onChange={(e) => setFormData({ ...formData, campaign_type: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="">All Types</option>
                    <option value="customer_service">Customer Service</option>
                    <option value="debt_collection">Debt Collection</option>
                    <option value="sales">Sales</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Theme Color
                  </label>
                  <input
                    type="color"
                    value={formData.theme_color}
                    onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })}
                    className="w-full h-10 bg-gray-700 border border-gray-600 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Recording URL Prefix
                  </label>
                  <input
                    type="text"
                    value={formData.recording_url_prefix}
                    onChange={(e) => setFormData({ ...formData, recording_url_prefix: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="https://recordings.example.com/"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Describe the purpose and focus of this dashboard type..."
                />
              </div>

              {/* Quick Templates */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Quick Templates
                </label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => loadTemplate('customer_service')}
                    className="px-3 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors"
                  >
                    Customer Service
                  </button>
                  <button
                    type="button"
                    onClick={() => loadTemplate('debt_collection')}
                    className="px-3 py-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors"
                  >
                    Debt Collection
                  </button>
                  <button
                    type="button"
                    onClick={() => loadTemplate('sales')}
                    className="px-3 py-2 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors"
                  >
                    Sales
                  </button>
                </div>
              </div>

              {/* KPI Configuration */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">KPI Configuration</h3>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={normalizeWeights}
                      className="px-3 py-2 bg-gray-600 text-gray-300 rounded-lg hover:bg-gray-500 transition-colors text-sm"
                    >
                      Equal Weights
                    </button>
                    <span className="text-sm text-gray-400 py-2">
                      Total: {formData.kpis.reduce((sum, kpi) => sum + kpi.weight, 0).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {formData.kpis.map((kpi, index) => (
                    <div key={index} className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-300 mb-3">KPI {index + 1}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="kpi_key"
                          value={kpi.kpi_key}
                          onChange={(e) => updateKPI(index, 'kpi_key', e.target.value)}
                          className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Display Name"
                          value={kpi.display_name}
                          onChange={(e) => updateKPI(index, 'display_name', e.target.value)}
                          className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                        />
                        <input
                          type="number"
                          placeholder="Weight %"
                          value={kpi.weight}
                          onChange={(e) => updateKPI(index, 'weight', parseFloat(e.target.value) || 0)}
                          className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Icon name"
                          value={kpi.icon_name}
                          onChange={(e) => updateKPI(index, 'icon_name', e.target.value)}
                          className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                        />
                      </div>
                      <textarea
                        placeholder="Calculation hint for LLM..."
                        value={kpi.calculation_hint}
                        onChange={(e) => updateKPI(index, 'calculation_hint', e.target.value)}
                        rows={2}
                        className="w-full mt-2 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* LLM Profile */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">LLM Configuration</h3>
                  <button
                    type="button"
                    onClick={() => setShowPromptHelper(!showPromptHelper)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 flex items-center gap-2 transition-all"
                  >
                    <span>✨</span>
                    {showPromptHelper ? 'Hide' : 'Show'} Prompt Helper
                  </button>
                </div>

                {/* Prompt Helper */}
                {showPromptHelper && (
                  <div className="mb-6 p-4 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                    <h4 className="text-lg font-semibold text-blue-200 mb-3">🚀 AI Prompt Assistant</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-200 mb-2">
                          Choose a Template
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {Object.entries(promptTemplates).map(([key, template]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setSelectedTemplate(key);
                                applyTemplate(key);
                              }}
                              className={`p-3 rounded-lg border-2 transition-all ${
                                selectedTemplate === key
                                  ? 'border-blue-400 bg-blue-500/20 text-blue-200'
                                  : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-blue-500 hover:bg-blue-500/10'
                              }`}
                            >
                              <div className="text-sm font-semibold">{template.name}</div>
                              <div className="text-xs opacity-75 mt-1">
                                {key === 'customer_service' && 'Service quality & satisfaction'}
                                {key === 'debt_collection' && 'Compliance & effectiveness'}
                                {key === 'telesales' && 'Sales methodology & conversion'}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 pt-2">
                        <div className="px-3 py-1 bg-green-900/40 text-green-200 rounded-full text-xs">
                          💡 Tip: Choose the template that best matches your operation type
                        </div>
                        <div className="px-3 py-1 bg-yellow-900/40 text-yellow-200 rounded-full text-xs">
                          🎯 Each template includes industry-specific KPIs and scoring criteria
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      placeholder="Profile Name"
                      value={formData.llm_profile?.profile_name || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        llm_profile: { ...formData.llm_profile!, profile_name: e.target.value }
                      })}
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    />
                    <select
                      value={formData.llm_profile?.model_name || 'gpt-4'}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        llm_profile: { ...formData.llm_profile!, model_name: e.target.value }
                      })}
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    >
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="claude-3">Claude 3</option>
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      placeholder="Temperature"
                      value={formData.llm_profile?.temperature || 0.7}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        llm_profile: { ...formData.llm_profile!, temperature: parseFloat(e.target.value) || 0.7 }
                      })}
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    />
                  </div>
                  
                  <textarea
                    placeholder="System prompt..."
                    value={formData.llm_profile?.system_prompt || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      llm_profile: { ...formData.llm_profile!, system_prompt: e.target.value }
                    })}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                  
                  <textarea
                    placeholder="User prompt template (use {transcription}, {agent_name}, etc.)..."
                    value={formData.llm_profile?.user_prompt_template || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      llm_profile: { ...formData.llm_profile!, user_prompt_template: e.target.value }
                    })}
                    rows={6}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t border-gray-600">
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingDashboard(null);
                    resetForm();
                  }}
                  className="px-6 py-2 bg-gray-600 text-gray-300 rounded-lg hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingDashboard ? handleEditDashboard : handleCreateDashboard}
                  className="flex items-center space-x-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingDashboard ? 'Update Dashboard' : 'Create Dashboard'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardAdmin;