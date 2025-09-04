import React, { useState, useEffect } from 'react';
import { Activity, Clock, DollarSign, MessageSquare, User, Bot } from 'lucide-react';
import { useWebhookStream } from '../hooks/useWebhookStream';
import { CallAnalysis } from '../types';

const RealTimeWebhookDisplay: React.FC = () => {
  const { lastWebhook } = useWebhookStream();
  const [recentWebhooks, setRecentWebhooks] = useState<CallAnalysis[]>([]);

  useEffect(() => {
    if (lastWebhook) {
      setRecentWebhooks(prev => [lastWebhook, ...prev.slice(0, 4)]);
    }
  }, [lastWebhook]);

  if (recentWebhooks.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="text-center py-8">
          <Activity className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Aguardando Webhooks</h3>
          <p className="text-gray-400">
            Nenhum webhook recebido ainda. Configure o endpoint no TalkIntel AI para começar a receber dados em tempo real.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Activity className="w-5 h-5 mr-2 text-green-400" />
          Webhooks Recebidos em Tempo Real
        </h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-green-400">Live</span>
        </div>
      </div>

      <div className="space-y-4">
        {recentWebhooks.map((webhook, index) => (
          <div
            key={webhook.id}
            className={`p-4 rounded-lg border transition-all duration-300 ${
              index === 0 
                ? 'bg-green-500/10 border-green-500/30 shadow-lg' 
                : 'bg-gray-700/50 border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  webhook.agentType === 'human' ? 'bg-blue-500/20' : 'bg-green-500/20'
                }`}>
                  {webhook.agentType === 'human' ? (
                    <User className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Bot className="w-4 h-4 text-green-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{webhook.agentName}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(webhook.timestamp).toLocaleTimeString('pt-BR')}
                  </p>
                </div>
              </div>
              
              {index === 0 && (
                <div className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                  Novo
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-300">{webhook.duration}s</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <span className={`px-2 py-1 rounded text-xs ${
                  webhook.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                  webhook.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {webhook.sentiment === 'positive' ? 'Positivo' :
                   webhook.sentiment === 'negative' ? 'Negativo' : 'Neutro'}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span className="text-gray-300">{webhook.currency} {webhook.cost.toFixed(4)}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className={`text-sm ${webhook.resolved ? 'text-green-400' : 'text-red-400'}`}>
                  {webhook.resolved ? 'Resolvido' : 'Não resolvido'}
                </span>
              </div>
            </div>

            {webhook.topics.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {webhook.topics.slice(0, 3).map((topic, topicIndex) => (
                  <span
                    key={topicIndex}
                    className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RealTimeWebhookDisplay;