// API Configuration
export const API_CONFIG = {
  BASE_URL: 'http://localhost:3005',
  ENDPOINTS: {
    // Auth endpoints
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    
    // Company endpoints
    COMPANY_SETTINGS: '/api/company/settings',
    
    // Dashboard endpoints
    DASHBOARD_STATS: '/api/dashboard/stats',
    
    // Webhook endpoints
    WEBHOOKS: '/api/webhooks',
    WEBHOOK_BY_ID: '/api/webhooks',
    
    // Agent endpoints
    AGENTS: '/api/agents',
    AGENT_BY_ID: '/api/agents',
    
    // System endpoints
    HEALTH: '/health',
    EVENTS: '/events'
  }
};

// Helper function to build full URLs
export const buildUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function for authenticated requests
export const createAuthHeaders = (token?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};