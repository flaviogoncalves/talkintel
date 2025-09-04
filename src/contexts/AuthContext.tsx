import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_CONFIG, buildUrl, createAuthHeaders } from '../config/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  company_id: string;
  company_name: string;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextType {
  user: User | null;
  tokens: Tokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (user: User, tokens: Tokens) => void;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!tokens;

  // Load stored auth data on initialization
  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedUser = localStorage.getItem('sippulse_user');
        const storedTokens = localStorage.getItem('sippulse_tokens');

        if (storedUser && storedTokens) {
          const parsedUser = JSON.parse(storedUser);
          const parsedTokens = JSON.parse(storedTokens);
          
          // Validate tokens by making a test API call
          try {
            const response = await fetch(buildUrl('/api/company/settings'), {
              headers: createAuthHeaders(parsedTokens.accessToken)
            });
            
            if (response.ok) {
              // Tokens are valid
              setUser(parsedUser);
              setTokens(parsedTokens);
              console.log('✅ Stored tokens validated successfully');
            } else {
              // Tokens are invalid, clear them
              console.log('❌ Stored tokens are invalid, clearing...');
              localStorage.removeItem('sippulse_user');
              localStorage.removeItem('sippulse_tokens');
            }
          } catch (error) {
            console.log('❌ Token validation failed, clearing stored auth:', error);
            localStorage.removeItem('sippulse_user');
            localStorage.removeItem('sippulse_tokens');
          }
        }
      } catch (error) {
        console.error('Error loading stored auth data:', error);
        // Clear invalid stored data
        localStorage.removeItem('sippulse_user');
        localStorage.removeItem('sippulse_tokens');
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredAuth();
  }, []);

  const login = (userData: User, tokenData: Tokens) => {
    setUser(userData);
    setTokens(tokenData);
    
    // Store in localStorage
    localStorage.setItem('sippulse_user', JSON.stringify(userData));
    localStorage.setItem('sippulse_tokens', JSON.stringify(tokenData));
    
    console.log('✅ User logged in:', userData.name, 'Company:', userData.company_name);
  };

  const logout = () => {
    setUser(null);
    setTokens(null);
    
    // Clear localStorage
    localStorage.removeItem('sippulse_user');
    localStorage.removeItem('sippulse_tokens');
    
    console.log('👋 User logged out');
  };

  const refreshToken = async (): Promise<boolean> => {
    if (!tokens?.refreshToken) {
      logout();
      return false;
    }

    try {
      const response = await fetch(buildUrl(API_CONFIG.ENDPOINTS.REFRESH), {
        method: 'POST',
        headers: createAuthHeaders(),
        body: JSON.stringify({
          refreshToken: tokens.refreshToken
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const newTokens = {
          accessToken: result.data.accessToken,
          refreshToken: result.data.refreshToken || tokens.refreshToken
        };
        
        setTokens(newTokens);
        localStorage.setItem('sippulse_tokens', JSON.stringify(newTokens));
        
        return true;
      }
      
      logout();
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    tokens,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};