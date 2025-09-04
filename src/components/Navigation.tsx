import React from 'react';
import { BarChart3, Activity, Sparkles, LogOut, Users, Heart, DollarSign, TrendingUp, User, Settings, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';
import { CallAnalysis } from '../types';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onDataUpdate: (newAnalysis?: CallAnalysis) => void;
  selectedCampaignType?: string | null;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab, onDataUpdate, selectedCampaignType }) => {
  const { logout, user } = useAuth();
  const { t } = useTranslation('common');


  const mainTabs = [
    { id: 'dashboard', label: t('navigation.dashboard'), icon: BarChart3 },
    { id: 'generic-dashboard', label: 'Generic Dashboard', icon: Activity },
  ];

  const specializedDashboards = [
    { id: 'customer-service', label: t('navigation.customerService'), icon: Heart, campaignType: 'customer_service' },
    { id: 'debt-collection', label: t('navigation.debtCollection'), icon: DollarSign, campaignType: 'debt_collection' },
    { id: 'sales', label: t('navigation.sales'), icon: TrendingUp, campaignType: 'sales' },
  ];

  // Filter specialized dashboards based on selected campaign type
  const availableSpecializedDashboards = specializedDashboards.filter(dashboard => {
    return !selectedCampaignType || dashboard.campaignType === selectedCampaignType;
  });

  return (
    <>
      <nav className="relative bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700/50 backdrop-blur-xl z-50">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-blue-500/5"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3 group">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-purple-500/25 transition-all duration-300">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
                </div>
                <div>
                  <span className="text-xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                    TalkIntel
                  </span>
                  <div className="flex items-center space-x-1">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span className="text-xs text-purple-400 font-medium">Analytics</span>
                  </div>
                </div>
              </div>
              
              {/* Navigation Tabs */}
              <div className="flex space-x-1">
                {/* Main Dashboard Tabs */}
                {mainTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`group relative flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 border border-purple-500/30 shadow-lg shadow-purple-500/10'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/50 border border-transparent hover:border-gray-600/50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 transition-all duration-300 ${
                        isActive ? 'text-purple-400' : 'group-hover:text-white'
                      }`} />
                      <span className="transition-all duration-300">{tab.label}</span>
                      
                      {/* Active indicator */}
                      {isActive && (
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-1 h-1 bg-purple-500 rounded-full"></div>
                      )}
                    </button>
                  );
                })}

                {/* Specialized Dashboards Dropdown */}
                {availableSpecializedDashboards.length > 0 && (
                  <div className="relative group">
                    <button className={`group relative flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      specializedDashboards.some(d => d.id === activeTab)
                        ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 border border-purple-500/30 shadow-lg shadow-purple-500/10'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50 border border-transparent hover:border-gray-600/50'
                    }`}>
                      <Activity className={`w-4 h-4 transition-all duration-300 ${
                        specializedDashboards.some(d => d.id === activeTab) ? 'text-purple-400' : 'group-hover:text-white'
                      }`} />
                      <span className="transition-all duration-300">Specialized</span>
                      <ChevronDown className="w-3 h-3 transition-transform duration-200 group-hover:rotate-180" />
                      
                      {/* Active indicator */}
                      {specializedDashboards.some(d => d.id === activeTab) && (
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-1 h-1 bg-purple-500 rounded-full"></div>
                      )}
                    </button>
                    
                    {/* Dropdown Menu */}
                    <div className="absolute top-full left-0 mt-2 w-56 bg-gray-800/95 backdrop-blur-sm border border-gray-700/50 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[99999]">
                      <div className="p-1">
                        {availableSpecializedDashboards.map((dashboard) => {
                          const Icon = dashboard.icon;
                          const isActive = activeTab === dashboard.id;
                          return (
                            <button
                              key={dashboard.id}
                              onClick={() => setActiveTab(dashboard.id)}
                              className={`w-full text-left px-3 py-2 text-sm rounded transition-all duration-200 flex items-center space-x-2 ${
                                isActive 
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                                  : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{dashboard.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Right side controls */}
            <div className="flex items-center space-x-4">
              {/* Status Indicator */}
              <div 
                className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50 cursor-help" 
                title={t('status.connected')}
              ></div>

              {/* Language Selector */}
              <LanguageSelector />

              {/* Profile Dropdown */}
              <div className="relative group">
                <button className="group relative p-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 rounded-xl border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20">
                  <User className="w-4 h-4 text-blue-400 group-hover:text-blue-300 transition-colors duration-300" />
                </button>
                
                {/* Profile Dropdown Menu */}
                <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800/95 backdrop-blur-sm border border-gray-700/50 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[99999]">
                  <div className="p-3 border-b border-gray-700/50">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{user?.name}</div>
                        <div className="text-sm text-gray-400">{user?.company_name}</div>
                        <div className="text-xs text-blue-400">{user?.role}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-1">
                    <button
                      onClick={() => setActiveTab('profile')}
                      className="w-full text-left px-3 py-2 text-sm rounded transition-all duration-200 flex items-center space-x-2 text-gray-400 hover:bg-gray-700/50 hover:text-white"
                    >
                      <User className="w-4 h-4" />
                      <span>{t('navigation.profile')}</span>
                    </button>
                    
                    <button
                      onClick={() => setActiveTab('campaigns')}
                      className="w-full text-left px-3 py-2 text-sm rounded transition-all duration-200 flex items-center space-x-2 text-gray-400 hover:bg-gray-700/50 hover:text-white"
                    >
                      <Users className="w-4 h-4" />
                      <span>{t('navigation.campaigns')}</span>
                    </button>
                    
                    <button
                      onClick={() => setActiveTab('dashboard-admin')}
                      className="w-full text-left px-3 py-2 text-sm rounded transition-all duration-200 flex items-center space-x-2 text-gray-400 hover:bg-gray-700/50 hover:text-white"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Dashboard Admin</span>
                    </button>
                    
                    <div className="border-t border-gray-700/50 my-1"></div>
                    
                    <button
                      onClick={logout}
                      className="w-full text-left px-3 py-2 text-sm rounded transition-all duration-200 flex items-center space-x-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t('navigation.logout')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

    </>
  );
};

export default Navigation;