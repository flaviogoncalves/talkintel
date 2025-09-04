import { useState, useEffect, useCallback } from 'react';
import { SipPulseWebhook, CallAnalysis } from '../types';
import { WebhookProcessor } from '../services/webhookProcessor';
import { useAuth } from '../contexts/AuthContext';

interface WebhookStreamData {
  type: 'webhook' | 'connected' | 'error' | 'metrics_updated';
  data?: SipPulseWebhook;
  message?: string;
  companyId?: string;
  agents_updated?: number;
  timestamp?: string;
}

export const useWebhookStream = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastWebhook, setLastWebhook] = useState<CallAnalysis | null>(null);
  const [webhookCount, setWebhookCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { tokens } = useAuth();

  const processWebhook = useCallback((webhook: SipPulseWebhook): CallAnalysis => {
    return WebhookProcessor.processWebhook(webhook);
  }, []);

  useEffect(() => {
    // Don't connect if there's no auth token
    if (!tokens?.accessToken) {
      setIsConnected(false);
      setError('No authentication token available');
      return;
    }

    // EventSource doesn't support custom headers directly, so we need to use a different approach
    // We'll pass the token as a query parameter for the SSE endpoint
    const eventSource = new EventSource(`http://localhost:3005/events?token=${encodeURIComponent(tokens.accessToken)}`);

    eventSource.onopen = () => {
      console.log('📡 Connected to webhook stream');
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: WebhookStreamData = JSON.parse(event.data);
        
        if (data.type === 'webhook' && data.data) {
          console.log('📞 New webhook received:', data.data);
          const analysis = processWebhook(data.data);
          setLastWebhook(analysis);
          setWebhookCount(prev => prev + 1);
          
          // Check if agent metrics were updated and dispatch custom event
          if ((data.data as any)?.agent_metrics_updated) {
            console.log('🎯 Agent metrics updated via webhook, dispatching refresh event');
            window.dispatchEvent(new CustomEvent('agentMetricsUpdated', {
              detail: { 
                updated_agent_metrics: (data.data as any)?.updated_agent_metrics,
                source: 'webhook'
              }
            }));
          }
        } else if (data.type === 'connected') {
          console.log('✅ Stream connected:', data.message);
        } else if (data.type === 'metrics_updated') {
          console.log('📊 Agent metrics update notification:', data);
          // Dispatch event for components to refresh their agent metrics
          window.dispatchEvent(new CustomEvent('agentMetricsUpdated', {
            detail: { 
              agents_updated: data.agents_updated,
              timestamp: data.timestamp,
              source: 'metrics_recalculation'
            }
          }));
        }
      } catch (err) {
        console.error('Error parsing webhook data:', err);
        setError('Error parsing webhook data');
      }
    };

    eventSource.onerror = (event) => {
      console.error('❌ Webhook stream error:', event);
      setIsConnected(false);
      setError('Connection to webhook stream lost');
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [processWebhook, tokens?.accessToken]);

  return {
    isConnected,
    lastWebhook,
    webhookCount,
    error
  };
};