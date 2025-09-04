import React from 'react';
import { Wifi, WifiOff, Activity, AlertCircle, CheckCircle } from 'lucide-react';
import { useWebhookStream } from '../hooks/useWebhookStream';

const WebhookStatus: React.FC = () => {
  const { isConnected, webhookCount, error } = useWebhookStream();

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isConnected ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            {isConnected ? (
              <Wifi className="w-5 h-5 text-green-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Webhook Status</h3>
            <p className="text-xs text-gray-400">
              {isConnected ? 'Conectado e aguardando webhooks' : 'Desconectado'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-center">
            <div className="text-lg font-bold text-white">{webhookCount}</div>
            <div className="text-xs text-gray-400">Recebidos</div>
          </div>
          
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
            isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {isConnected ? (
              <>
                <CheckCircle className="w-3 h-3" />
                <span>Online</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3" />
                <span>Offline</span>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        </div>
      )}

      <div className="mt-3 p-3 bg-gray-700/50 rounded-lg">
        <div className="text-xs text-gray-400 mb-1">Endpoint do Webhook:</div>
        <div className="text-sm font-mono text-green-400">
          http://localhost:3007/webhook/sippulse
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Configure este endpoint no TalkIntel AI para receber webhooks automaticamente
        </div>
      </div>
    </div>
  );
};

export default WebhookStatus;