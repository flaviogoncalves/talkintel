import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import SimplifiedCustomerServiceDashboard from './components/SimplifiedCustomerServiceDashboard';
import DebtCollectionDashboard from './components/DebtCollectionDashboard';
import SalesDashboard from './components/SalesDashboard';
import CampaignManager from './components/CampaignManager';
import CompanyProfile from './components/CompanyProfile';
import DashboardAdmin from './components/DashboardAdmin';
import GenericDashboard from './components/GenericDashboard';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { CallAnalysis } from './types';

function AppContent() {
  const { isAuthenticated, isLoading, user, login } = useAuth();
  const { isLoading: languageLoading } = useLanguage();
  const { ready, t } = useTranslation(['common', 'dashboard']);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [registrationResult, setRegistrationResult] = useState<any>(null);
  const [selectedCampaignType, setSelectedCampaignType] = useState<string | null>(null);

  // Function to trigger refresh across all components
  const handleDataUpdate = (newAnalysis?: CallAnalysis) => {
    setRefreshTrigger(prev => prev + 1);
    console.log('🔄 Dados atualizados, refreshing components...', newAnalysis?.id);
  };

  const handleCampaignTypeChange = (campaignType: string | null) => {
    console.log('📊 Campaign type changed:', campaignType);
    setSelectedCampaignType(campaignType);
    
    // Switch to general dashboard when campaign type changes if current tab is no longer available
    const specializedTabs = ['customer-service', 'debt-collection', 'sales'];
    const currentTabIsSpecialized = specializedTabs.includes(activeTab);
    
    if (currentTabIsSpecialized) {
      // If no campaign is selected (campaignType is null), switch to dashboard
      if (!campaignType) {
        setActiveTab('dashboard');
      } else {
        // If campaign type doesn't match current tab, switch to dashboard
        const tabCampaignTypeMap = {
          'customer-service': 'customer_service',
          'debt-collection': 'debt_collection',
          'sales': 'sales'
        };
        
        if (tabCampaignTypeMap[activeTab as keyof typeof tabCampaignTypeMap] !== campaignType) {
          setActiveTab('dashboard');
        }
      }
    }
  };

  const handleLoginSuccess = (userData: any, tokens: any) => {
    login(userData, tokens);
  };

  const handleRegistrationSuccess = (result: any) => {
    setRegistrationResult(result);
    // Show registration success and then switch to login
    setTimeout(() => {
      setRegistrationResult(null);
      setAuthMode('login');
    }, 3000);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard key={refreshTrigger} onDataUpdate={handleDataUpdate} onCampaignTypeChange={handleCampaignTypeChange} />;
      case 'customer-service':
        return <SimplifiedCustomerServiceDashboard key={refreshTrigger} />;
      case 'debt-collection':
        return <DebtCollectionDashboard 
          companyId={user?.company_id || ''} 
          refreshTrigger={refreshTrigger} 
        />;
      case 'sales':
        return <SalesDashboard 
          companyId={user?.company_id || ''} 
          refreshTrigger={refreshTrigger} 
        />;
      case 'campaigns':
        return <CampaignManager />;
      case 'dashboard-admin':
        return <DashboardAdmin />;
      case 'generic-dashboard':
        return <GenericDashboard refreshTrigger={refreshTrigger} />;
      case 'profile':
        return <CompanyProfile />;
      default:
        return <Dashboard key={refreshTrigger} onDataUpdate={handleDataUpdate} onCampaignTypeChange={handleCampaignTypeChange} />;
    }
  };

  // Show loading screen
  if (isLoading || languageLoading || !ready) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // Show registration success message
  if (registrationResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Empresa Registrada!</h2>
          <p className="text-gray-600 mb-4">
            Sua empresa <strong>{registrationResult.data.company.name}</strong> foi registrada com sucesso.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
            <p className="text-sm text-blue-800 font-medium mb-2">Próximos Passos:</p>
            <p className="text-xs text-blue-600">
              Crie campanhas (Vendas, Cobrança, Atendimento) para obter endpoints únicos de webhook para cada operação.
            </p>
          </div>
          <button
            onClick={() => {
              setRegistrationResult(null);
              setAuthMode('login');
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-200 mb-2"
          >
            Ir para Login
          </button>
          <p className="text-xs text-gray-500">
            Ou aguarde 3 segundos para redirecionamento automático...
          </p>
        </div>
      </div>
    );
  }

  // Show authentication screens if not authenticated
  if (!isAuthenticated) {
    if (authMode === 'login') {
      return (
        <Login
          onLoginSuccess={handleLoginSuccess}
          onSwitchToRegister={() => setAuthMode('register')}
        />
      );
    } else {
      return (
        <Register
          onRegistrationSuccess={handleRegistrationSuccess}
          onSwitchToLogin={() => setAuthMode('login')}
        />
      );
    }
  }

  // Show authenticated dashboard
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onDataUpdate={handleDataUpdate}
        selectedCampaignType={selectedCampaignType}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;