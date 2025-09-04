import React, { useState, useEffect } from 'react';
import { Plus, Users, Link, Trash2, Edit, Copy, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG, buildUrl, createAuthHeaders } from '../config/api';

interface Campaign {
  id: string;
  name: string;
  description: string;
  script: string;
  webhook_endpoint: string;
  campaign_type: string;
  dashboard_type_id?: string;
  created_at: string;
  company_id: string;
}

interface DashboardType {
  id: string;
  internal_name: string;
  display_name: string;
  description: string;
  campaign_type: string;
  theme_color: string;
  icon_name: string;
  is_active: boolean;
  is_default: boolean;
}

const getCampaignTypeLabel = (type: string) => {
  switch (type) {
    case 'sales': return 'Vendas';
    case 'debt_collection': return 'Cobrança';
    case 'customer_service': return 'Atendimento';
    default: return 'Atendimento';
  }
};

const getCampaignTypeColor = (type: string) => {
  switch (type) {
    case 'sales': return 'bg-green-500';
    case 'debt_collection': return 'bg-yellow-500';
    case 'customer_service': return 'bg-blue-500';
    default: return 'bg-blue-500';
  }
};

interface CampaignManagerProps {
  onCampaignSelected?: (campaign: Campaign | null) => void;
}

const CampaignManager: React.FC<CampaignManagerProps> = ({ onCampaignSelected }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [dashboardTypes, setDashboardTypes] = useState<DashboardType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    description: '',
    script: '',
    campaign_type: 'customer_service',
    dashboard_type_id: ''
  });

  const { user, tokens } = useAuth();
  const token = tokens?.accessToken;
  
  // Debug logging for auth context
  console.log('🔍 CampaignManager - Auth context:', { 
    hasUser: !!user, 
    hasToken: !!token,
    hasTokens: !!tokens,
    userEmail: user?.email,
    tokenPreview: token ? `${token.substring(0, 20)}...` : 'null'
  });
  
  // Additional debugging for 401 errors
  if (!token) {
    console.error('❌ No token available - user needs to login again');
  }

  const loadCampaigns = async () => {
    if (!token) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(buildUrl('/api/campaigns'), {
        headers: createAuthHeaders(token)
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          console.error('🔑 Authentication failed - token may be expired');
          setError('Session expired. Please logout and login again.');
          return;
        }
        throw new Error(result.error || 'Failed to load campaigns');
      }

      setCampaigns(result.data || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDashboardTypes = async () => {
    if (!token) return;

    try {
      const response = await fetch(buildUrl('/api/dashboards/types'), {
        headers: createAuthHeaders(token)
      });

      if (response.ok) {
        const result = await response.json();
        setDashboardTypes(result.dashboard_types || []);
      }
    } catch (error) {
      console.error('Error loading dashboard types:', error);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔄 Campaign creation started');
    console.log('🔍 Token exists:', !!token);
    console.log('🔍 Campaign name:', newCampaign.name);
    
    if (!token || !newCampaign.name.trim()) {
      console.log('❌ Validation failed - token or name missing');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('📡 Making API request to:', buildUrl('/api/campaigns'));
      const response = await fetch(buildUrl('/api/campaigns'), {
        method: 'POST',
        headers: createAuthHeaders(token),
        body: JSON.stringify({
          name: newCampaign.name,
          description: newCampaign.description,
          script: newCampaign.script,
          campaign_type: newCampaign.campaign_type,
          dashboard_type_id: newCampaign.dashboard_type_id
        })
      });

      console.log('📡 Response status:', response.status);
      const result = await response.json();
      console.log('📡 Response data:', result);

      if (!response.ok) {
        if (response.status === 401) {
          console.error('🔑 Authentication failed during campaign creation');
          setError('Session expired. Please logout and login again.');
          return;
        }
        throw new Error(result.error || 'Failed to create campaign');
      }

      console.log('✅ Campaign created successfully');
      setCampaigns(prev => [...prev, result.data]);
      setNewCampaign({ 
        name: '', 
        description: '', 
        script: '', 
        campaign_type: 'customer_service', 
        dashboard_type_id: ''
      });
      setShowCreateModal(false);
      
      // Reload campaigns to ensure fresh data
      await loadCampaigns();
    } catch (error) {
      console.error('❌ Campaign creation error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!token || !confirm('Are you sure you want to delete this campaign? This will also delete all associated webhook data.')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(buildUrl(`/api/campaigns/${campaignId}`), {
        method: 'DELETE',
        headers: createAuthHeaders(token)
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete campaign');
      }

      setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const copyWebhookEndpoint = async (endpoint: string, campaignId: string) => {
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopiedEndpoint(campaignId);
      setTimeout(() => setCopiedEndpoint(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  useEffect(() => {
    loadCampaigns();
    loadDashboardTypes();
  }, [token]);

  if (isLoading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando campanhas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Users className="w-6 h-6 mr-2 text-purple-400" />
            Gestão de Campanhas
          </h2>
          <p className="text-gray-400 mt-1">
            Gerencie as campanhas do contact center e seus webhooks únicos
          </p>
        </div>
        <button
          onClick={() => {
            console.log('🔄 Create campaign button clicked');
            setShowCreateModal(true);
          }}
          className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Campanha</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Campaigns Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-purple-500/50 transition-colors duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-white">
                    {campaign.name}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getCampaignTypeColor(campaign.campaign_type)}`}>
                    {getCampaignTypeLabel(campaign.campaign_type)}
                  </span>
                </div>
                {campaign.description && (
                  <p className="text-gray-400 text-sm mb-4">
                    {campaign.description}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDeleteCampaign(campaign.id)}
                  className="p-1 text-gray-400 hover:text-red-400 transition-colors duration-200"
                  title="Excluir campanha"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Webhook Endpoint
                </label>
                <div className="flex items-center space-x-2 bg-gray-900 rounded p-2">
                  <Link className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <code className="text-xs text-purple-300 font-mono truncate flex-1">
                    http://localhost:3005/webhook/campaign/{campaign.webhook_endpoint}
                  </code>
                  <button
                    onClick={() => copyWebhookEndpoint(`http://localhost:3005/webhook/campaign/${campaign.webhook_endpoint}`, campaign.id)}
                    className="p-1 text-gray-400 hover:text-white transition-colors duration-200"
                    title="Copiar endpoint"
                  >
                    {copiedEndpoint === campaign.id ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Criada em {new Date(campaign.created_at).toLocaleDateString('pt-BR')}
              </div>

              {onCampaignSelected && (
                <button
                  onClick={() => onCampaignSelected(campaign)}
                  className="w-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 hover:border-purple-500/50 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200"
                >
                  Selecionar Campanha
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {campaigns.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            Nenhuma campanha encontrada
          </h3>
          <p className="text-gray-500 mb-6">
            Crie sua primeira campanha para começar a receber dados de qualidade
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200"
          >
            Criar Primeira Campanha
          </button>
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg w-full max-w-md p-6 border border-gray-700">
            <h3 className="text-xl font-semibold text-white mb-6">
              Nova Campanha
            </h3>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label htmlFor="campaignName" className="block text-sm font-medium text-gray-300 mb-2">
                  Nome da Campanha *
                </label>
                <input
                  id="campaignName"
                  type="text"
                  required
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white focus:outline-none focus:border-purple-500"
                  placeholder="Ex: Suporte Técnico, Vendas, Cobrança..."
                />
              </div>

              <div>
                <label htmlFor="dashboardType" className="block text-sm font-medium text-gray-300 mb-2">
                  Dashboard Type *
                </label>
                <select
                  id="dashboardType"
                  value={newCampaign.dashboard_type_id}
                  onChange={(e) => {
                    const selectedDashboard = dashboardTypes.find(dt => dt.id === e.target.value);
                    setNewCampaign(prev => ({ 
                      ...prev, 
                      dashboard_type_id: e.target.value,
                      campaign_type: selectedDashboard?.campaign_type || 'customer_service'
                    }));
                  }}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white focus:outline-none focus:border-purple-500"
                  required
                >
                  <option value="">Select a Dashboard Type</option>
                  {dashboardTypes.filter(dt => dt.is_active).map(dashboardType => (
                    <option key={dashboardType.id} value={dashboardType.id}>
                      {dashboardType.display_name}
                      {dashboardType.is_default ? ' (Default)' : ''}
                    </option>
                  ))}
                </select>
                {dashboardTypes.length === 0 && (
                  <p className="text-sm text-yellow-400 mt-1">
                    No dashboard types found. Create one in Dashboard Admin first.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="campaignDescription" className="block text-sm font-medium text-gray-300 mb-2">
                  Descrição (opcional)
                </label>
                <textarea
                  id="campaignDescription"
                  value={newCampaign.description}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white focus:outline-none focus:border-purple-500"
                  placeholder="Descreva o objetivo desta campanha..."
                  rows={2}
                />
              </div>

              <div>
                <label htmlFor="campaignScript" className="block text-sm font-medium text-gray-300 mb-2">
                  Script da Campanha (opcional)
                </label>
                <textarea
                  id="campaignScript"
                  value={newCampaign.script}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, script: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white focus:outline-none focus:border-purple-500"
                  placeholder="Cole aqui o script que os agentes devem seguir durante o atendimento..."
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">
                  O LLM usará este script para calcular a aderência dos agentes durante as chamadas
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewCampaign({ name: '', description: '', script: '', campaign_type: 'customer_service' });
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !newCampaign.name.trim()}
                  onClick={() => console.log('🔄 Create campaign form submit button clicked')}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Criando...' : 'Criar Campanha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignManager;