import { useState, useEffect, useCallback } from 'react';
import { SipPulseWebhook, CallAnalysis } from '../types';
import { WebhookProcessor } from '../services/webhookProcessor';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG } from '../config/api';

interface WebhookStreamData {
  type: 'webhook' | 'connected' | 'error';
  data?: SipPulseWebhook;
  message?: string;
  company?: string;
}

export const useAuthenticatedWebhookStream = () => {
  const { tokens, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastWebhook, setLastWebhook] = useState<CallAnalysis | null>(null);
  const [webhookCount, setWebhookCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const processWebhook = useCallback((webhook: SipPulseWebhook): CallAnalysis => {
    return WebhookProcessor.processWebhook(webhook);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !tokens?.accessToken) {
      setIsConnected(false);
      setError('Authentication required');
      return;
    }

    // Create EventSource with authentication
    const eventSource = new EventSource(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.EVENTS}`, {
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`
      }
    } as any);

    eventSource.onopen = () => {
      console.log('📡 Connected to authenticated webhook stream');
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: WebhookStreamData = JSON.parse(event.data);
        console.log('📨 Received webhook stream data:', data);

        if (data.type === 'connected') {
          console.log('✅ Stream connection confirmed');
        } else if (data.type === 'webhook' && data.data) {
          const analysis = processWebhook(data.data);
          setLastWebhook(analysis);
          setWebhookCount(prev => prev + 1);
          
          console.log(`🔄 Processed webhook from company: ${data.company}`, analysis);
        } else if (data.type === 'error') {
          console.error('❌ Stream error:', data.message);
          setError(data.message || 'Unknown stream error');
        }
      } catch (parseError) {
        console.error('❌ Error parsing webhook stream data:', parseError);
        setError('Failed to parse stream data');
      }
    };

    eventSource.onerror = (event) => {
      console.error('❌ Webhook stream connection error:', event);
      setIsConnected(false);
      setError('Connection error - stream disconnected');
    };

    // Cleanup function
    return () => {
      console.log('🔌 Closing authenticated webhook stream connection');
      eventSource.close();
      setIsConnected(false);
    };
  }, [isAuthenticated, tokens?.accessToken, processWebhook]);

  // Reset state when authentication changes
  useEffect(() => {
    if (!isAuthenticated) {
      setLastWebhook(null);
      setWebhookCount(0);
      setIsConnected(false);
      setError(null);
    }
  }, [isAuthenticated]);

  return {
    isConnected,
    lastWebhook,
    webhookCount,
    error,
    isAuthenticated
  };
};