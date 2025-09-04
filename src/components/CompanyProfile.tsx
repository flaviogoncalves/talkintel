import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  User, 
  Crown, 
  Key, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  Save, 
  TestTube,
  Shield,
  Zap,
  Globe,
  Bot
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG, buildUrl, createAuthHeaders } from '../config/api';

interface CompanySettings {
  id: string;
  name: string;
  domain: string;
  subscription_tier: 'basic' | 'premium' | 'enterprise';
  settings: any;
  webhook_endpoint: string;
}

interface LLMSettings {
  api_url: string;
  model: string;
  has_api_key: boolean;
  api_key_masked?: string;
}

const CompanyProfile: React.FC = () => {
  const { t } = useTranslation(['dashboard', 'common']);
  const { user, tokens } = useAuth();
  const token = tokens?.accessToken;

  // State management
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [llmSettings, setLLMSettings] = useState<LLMSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    api_key: '',
    api_url: 'https://api.sippulse.ai',
    model: 'gpt-3.5-turbo'
  });

  // Load company and LLM settings
  useEffect(() => {
    if (token) {
      loadSettings();
    }
  }, [token]);

  const loadSettings = async () => {
    try {
      setLoading(true);

      // Load company settings
      const companyResponse = await fetch(buildUrl('/api/company/settings'), {
        headers: createAuthHeaders(token!)
      });

      if (companyResponse.ok) {
        const companyData = await companyResponse.json();
        setCompanySettings(companyData.data);
      }

      // Load LLM settings (always try to load for development)
      try {
        const llmResponse = await fetch(buildUrl('/api/company/llm-settings'), {
          headers: createAuthHeaders(token!)
        });

        if (llmResponse.ok) {
          const llmData = await llmResponse.json();
          console.log('LLM Settings loaded:', llmData);
          setLLMSettings(llmData.data);
          setFormData({
            api_key: '',
            api_url: llmData.data.api_url || 'https://api.sippulse.ai',
            model: llmData.data.model || 'gpt-3.5-turbo'
          });
        } else {
          console.log('LLM settings response not OK:', llmResponse.status);
          // Set default settings even if API fails
          setLLMSettings({
            api_url: 'https://api.sippulse.ai',
            model: 'gpt-3.5-turbo',
            has_api_key: false
          });
          setFormData({
            api_key: '',
            api_url: 'https://api.sippulse.ai',
            model: 'gpt-3.5-turbo'
          });
        }
      } catch (error) {
        console.log('LLM settings error:', error);
        // Set default settings even if API fails
        setLLMSettings({
          api_url: 'https://api.sippulse.ai',
          model: 'gpt-3.5-turbo',
          has_api_key: false
        });
        setFormData({
          api_key: '',
          api_url: 'https://api.sippulse.ai',
          model: 'gpt-3.5-turbo'
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleLLMSettingsUpdate = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const updateData: any = {
        api_url: formData.api_url,
        model: formData.model
      };

      // Only include API key if it's been changed
      if (formData.api_key.trim()) {
        updateData.api_key = formData.api_key;
      }

      const response = await fetch(buildUrl('/api/company/llm-settings'), {
        method: 'PUT',
        headers: createAuthHeaders(token!),
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'LLM settings updated successfully!' });
        // Clear the API key field after successful update
        setFormData(prev => ({ ...prev, api_key: '' }));
        // Reload settings to get updated masked key
        await loadSettings();
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to update settings' });
      }
    } catch (error) {
      console.error('Error updating LLM settings:', error);
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setMessage(null);

      const response = await fetch(buildUrl('/api/company/test-llm'), {
        method: 'POST',
        headers: createAuthHeaders(token!)
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `Connection successful! Using model: ${result.model}` 
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: `Connection failed: ${result.error}` 
        });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setMessage({ type: 'error', text: 'Failed to test connection' });
    } finally {
      setTesting(false);
    }
  };

  const getPlanBadgeColor = (tier: string) => {
    switch (tier) {
      case 'basic': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      case 'premium': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'enterprise': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getPlanIcon = (tier: string) => {
    switch (tier) {
      case 'basic': return <User className="w-4 h-4" />;
      case 'premium': return <Crown className="w-4 h-4" />;
      case 'enterprise': return <Shield className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="bg-gray-800/50 rounded-2xl h-32 mb-6"></div>
            <div className="bg-gray-800/50 rounded-2xl h-64"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
                <Settings className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Company Profile</h1>
                <p className="text-gray-400">Manage your company settings and integrations</p>
              </div>
            </div>
            
            {companySettings && (
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-full border ${getPlanBadgeColor(companySettings.subscription_tier)}`}>
                {getPlanIcon(companySettings.subscription_tier)}
                <span className="font-semibold capitalize">{companySettings.subscription_tier}</span>
              </div>
            )}
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`p-4 rounded-xl border ${
            message.type === 'success' 
              ? 'bg-green-500/10 border-green-500/30 text-green-300' 
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            <div className="flex items-center space-x-2">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {/* Company Information */}
        {companySettings && (
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <Globe className="w-6 h-6 mr-3 text-blue-400" />
              Company Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Company Name</label>
                <div className="p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white">
                  {companySettings.name}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Domain</label>
                <div className="p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white">
                  {companySettings.domain || 'Not set'}
                </div>
              </div>
              
            </div>
          </div>
        )}

        {/* Plan Upgrade Section */}
        <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <Crown className="w-6 h-6 mr-3 text-yellow-400" />
            Subscription Plan
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Basic Plan */}
            <div className={`p-4 rounded-xl border ${
              companySettings?.subscription_tier === 'basic' 
                ? 'bg-gray-500/20 border-gray-400 ring-2 ring-gray-400' 
                : 'bg-gray-800/50 border-gray-600 hover:border-gray-500'
            }`}>
              <div className="flex items-center space-x-2 mb-3">
                <User className="w-5 h-5 text-gray-400" />
                <h3 className="font-semibold text-white">Basic</h3>
              </div>
              <ul className="text-sm text-gray-300 space-y-1 mb-4">
                <li>• Basic call analysis</li>
                <li>• Standard metrics</li>
                <li>• Up to 1,000 calls/month</li>
              </ul>
              {companySettings?.subscription_tier === 'basic' && (
                <div className="text-green-400 text-sm font-medium">Current Plan</div>
              )}
            </div>

            {/* Premium Plan */}
            <div className={`p-4 rounded-xl border ${
              companySettings?.subscription_tier === 'premium' 
                ? 'bg-purple-500/20 border-purple-400 ring-2 ring-purple-400' 
                : 'bg-gray-800/50 border-gray-600 hover:border-purple-500'
            }`}>
              <div className="flex items-center space-x-2 mb-3">
                <Crown className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white">Premium</h3>
              </div>
              <ul className="text-sm text-gray-300 space-y-1 mb-4">
                <li>• Advanced analytics</li>
                <li>• <strong className="text-purple-400">Script adherence</strong></li>
                <li>• LLM integration</li>
                <li>• Up to 10,000 calls/month</li>
              </ul>
              {companySettings?.subscription_tier === 'premium' ? (
                <div className="text-green-400 text-sm font-medium">Current Plan</div>
              ) : (
                <button className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors">
                  Upgrade to Premium
                </button>
              )}
            </div>

            {/* Enterprise Plan */}
            <div className={`p-4 rounded-xl border ${
              companySettings?.subscription_tier === 'enterprise' 
                ? 'bg-yellow-500/20 border-yellow-400 ring-2 ring-yellow-400' 
                : 'bg-gray-800/50 border-gray-600 hover:border-yellow-500'
            }`}>
              <div className="flex items-center space-x-2 mb-3">
                <Shield className="w-5 h-5 text-yellow-400" />
                <h3 className="font-semibold text-white">Enterprise</h3>
              </div>
              <ul className="text-sm text-gray-300 space-y-1 mb-4">
                <li>• Everything in Premium</li>
                <li>• Custom integrations</li>
                <li>• Priority support</li>
                <li>• Unlimited calls</li>
              </ul>
              {companySettings?.subscription_tier === 'enterprise' ? (
                <div className="text-green-400 text-sm font-medium">Current Plan</div>
              ) : (
                <button className="w-full py-2 px-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors">
                  Contact Sales
                </button>
              )}
            </div>
          </div>
        </div>

        {/* LLM Configuration - Always Show for Development/Testing */}
        {true && (
          <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center">
                  <Bot className="w-6 h-6 mr-3 text-purple-400" />
                  LLM Configuration
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Configure your AI language model for script adherence analysis
                </p>
              </div>
              <div className="flex items-center space-x-2 px-3 py-1 bg-purple-500/20 rounded-full border border-purple-500/30">
                <Crown className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300 text-sm font-medium">Premium Feature</span>
              </div>
            </div>

            {llmSettings && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center space-x-2 text-blue-300 text-sm">
                  <Key className="w-4 h-4" />
                  <span>
                    API Key Status: {llmSettings.has_api_key ? (
                      <span className="text-green-400 font-medium">
                        Configured ({llmSettings.api_key_masked})
                      </span>
                    ) : (
                      <span className="text-yellow-400 font-medium">Not configured</span>
                    )}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                  placeholder={llmSettings?.has_api_key ? "Enter new API key to replace" : "sk-..."}
                  className="w-full p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank to keep current key. OpenAI format supported.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  API URL
                </label>
                <input
                  type="url"
                  value={formData.api_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, api_url: e.target.value }))}
                  className="w-full p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Model
                </label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="e.g., gpt-3.5-turbo, claude-3-sonnet, llama-70b"
                  className="w-full p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter any model available on TalkIntel AI (25+ models supported)
                </p>
              </div>

              <div className="flex flex-col justify-end">
                <div className="flex space-x-3">
                  <button
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg font-medium transition-colors"
                  >
                    {testing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <TestTube className="w-4 h-4" />
                        <span>Test</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={handleLLMSettingsUpdate}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded-lg font-medium transition-colors"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Feature Benefits */}
            <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <h4 className="text-white font-medium mb-2 flex items-center">
                <Zap className="w-4 h-4 mr-2 text-purple-400" />
                Script Adherence Features
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
                <div>
                  <div className="text-purple-400 font-medium">Customer Service</div>
                  <div>Empathy detection, FCR analysis, effort scoring</div>
                </div>
                <div>
                  <div className="text-purple-400 font-medium">Debt Collection</div>
                  <div>FDCPA compliance, Mini-Miranda verification</div>
                </div>
                <div>
                  <div className="text-purple-400 font-medium">Sales</div>
                  <div>SPIN/MEDDIC methodology, conversion optimization</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Basic Plan Upgrade CTA */}
        {companySettings?.subscription_tier === 'basic' && (
          <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Unlock Advanced Features
                </h3>
                <p className="text-gray-300">
                  Upgrade to Premium to access LLM-powered script adherence analysis and advanced analytics.
                </p>
              </div>
              <button className="py-3 px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-semibold transition-all transform hover:scale-105">
                Upgrade Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyProfile;