import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, TrendingUp, Sparkles, Zap } from 'lucide-react';
import { TalkIntelWebhook, CallAnalysis } from '../types';
import { WebhookProcessor } from '../services/webhookProcessor';

interface WebhookProcessorProps {
  onWebhookProcessed: (analysis: CallAnalysis) => void;
}

const WebhookProcessorComponent: React.FC<WebhookProcessorProps> = ({ onWebhookProcessed }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessed, setLastProcessed] = useState<CallAnalysis | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    
    try {
      const text = await file.text();
      const webhook: TalkIntelWebhook = JSON.parse(text);
      
      // Add required fields if missing
      const processedWebhook = {
        ...webhook,
        id: webhook.id || `webhook-${Date.now()}`,
        timestamp: webhook.timestamp || new Date().toISOString(),
        call_type: webhook.call_type || 'human-human' as const
      };
      
      const analysis = WebhookProcessor.processWebhook(processedWebhook);
      setLastProcessed(analysis);
      onWebhookProcessed(analysis);
    } catch (error) {
      console.error('Error processing webhook:', error);
      alert('Erro ao processar webhook. Verifique o formato do arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const simulateWebhook = () => {
    setIsProcessing(true);
    
    // Simulate the webhook from your example
    const sampleWebhook: TalkIntelWebhook = {
      id: `webhook-${Date.now()}`,
      timestamp: new Date().toISOString(),
      call_type: 'human-human',
      duration: 106,
      participants: ['Nicolas', 'Miguel'],
      segments: [
        {
          end_time: 9.98,
          initial_time: 9.54,
          speaker: "NOT IDENTF",
          text: "Alô."
        },
        {
          end_time: 11.84,
          initial_time: 9.98,
          speaker: "SPEAKER_00",
          text: "Olá. Opa,"
        },
        {
          end_time: 31.38,
          initial_time: 12.7,
          speaker: "SPEAKER_00",
          text: "Bom dia, eu me chamo Nicolas e eu falo aqui no nome da Caixa. Por gentileza, fala com o Miguel."
        },
        {
          end_time: 36.68,
          initial_time: 32.68,
          speaker: "SPEAKER_01",
          text: "O senhor vai ter essa ligação gravada, porque eu não tenho nada com Caixa."
        }
      ],
      text: "Conversa entre Nicolas da Caixa e Miguel sobre assunto comercial.",
      usage: {
        cost: 0.1081915775808,
        currency: "BRL",
        cost_details: [],
        performance: {
          delay: 577,
          execution_time: 4536,
          relative_execution_time: 23.841269841269845,
          relative_execution_time_unit: "seconds_per_seconds"
        }
      },
      summarization: "A call was made by Nicolas from Caixa to Miguel regarding a commercial matter. Miguel expressed confusion and concern about the legitimacy of the call.",
      sentiment_analysis: [
        {
          label: "confusion",
          score: 0.3,
          timestamp: "00:32-00:36",
          fragment: "O senhor vai ter essa ligação gravada, porque eu não tenho nada com Caixa."
        },
        {
          label: "frustration",
          score: 0.2,
          timestamp: "00:37-00:55",
          fragment: "A caixa está em dias, que eu fui lá no gerente lá."
        }
      ],
      topic_detection: [
        {
          label: "customer service",
          confidence: 0.9,
          timestamp: "00:12-00:31",
          fragment: "Bom dia, eu me chamo Nicolas e eu falo aqui no nome da Caixa."
        },
        {
          label: "banking issues",
          confidence: 0.85,
          timestamp: "00:37-00:55",
          fragment: "A caixa está em dias, que eu fui lá no gerente lá."
        }
      ],
      resolution: "Não, o problema não foi resolvido na ligação, Miguel decidiu visitar a agência."
    };

    setTimeout(() => {
      const analysis = WebhookProcessor.processWebhook(sampleWebhook);
      setLastProcessed(analysis);
      onWebhookProcessed(analysis);
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <div className="relative bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5"></div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-3xl"></div>
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl border border-purple-500/30">
              <FileText className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Processador de Webhooks</h3>
              <p className="text-gray-400 text-sm">Analise dados do TalkIntel AI em tempo real</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <label className="group relative bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-3 rounded-xl cursor-pointer transition-all duration-300 flex items-center shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5">
              <Upload className="w-4 h-4 mr-2" />
              <span className="font-medium">Upload JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isProcessing}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </label>
            
            <button
              onClick={simulateWebhook}
              disabled={isProcessing}
              className="group relative bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white px-6 py-3 rounded-xl transition-all duration-300 flex items-center disabled:opacity-50 shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              <span className="font-medium">Simular Webhook</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>
        </div>

        {/* Processing State */}
        {isProcessing && (
          <div className="flex items-center justify-center py-12">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500/20 border-t-purple-500"></div>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 animate-pulse"></div>
            </div>
            <div className="ml-4">
              <p className="text-white font-medium">Processando webhook...</p>
              <p className="text-gray-400 text-sm">Analisando dados com IA</p>
            </div>
          </div>
        )}

        {/* Results */}
        {lastProcessed && !isProcessing && (
          <div className="bg-gradient-to-br from-gray-700/50 to-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-600/50">
            {/* Success Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg border border-green-500/30">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <span className="text-green-400 font-semibold">Webhook processado com sucesso</span>
                  <p className="text-gray-400 text-sm">Análise completa gerada</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 px-3 py-1 bg-green-500/20 rounded-full border border-green-500/30">
                <Zap className="w-3 h-3 text-green-400" />
                <span className="text-green-400 text-xs font-medium">Processado</span>
              </div>
            </div>
            
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
                <span className="text-gray-400 text-sm">Agente</span>
                <p className="text-white font-semibold mt-1">{lastProcessed.agentName}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
                <span className="text-gray-400 text-sm">Duração</span>
                <p className="text-white font-semibold mt-1">{lastProcessed.duration}s</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
                <span className="text-gray-400 text-sm">Satisfação</span>
                <p className="text-white font-semibold mt-1">{lastProcessed.customerSatisfaction.toFixed(1)}/5</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
                <span className="text-gray-400 text-sm">Custo</span>
                <p className="text-white font-semibold mt-1">{lastProcessed.currency} {lastProcessed.cost.toFixed(4)}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
                <span className="text-gray-400 text-sm">Sentimento</span>
                <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${
                  lastProcessed.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                  lastProcessed.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {lastProcessed.sentiment === 'positive' ? 'Positivo' :
                   lastProcessed.sentiment === 'negative' ? 'Negativo' : 'Neutro'}
                </span>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
                <span className="text-gray-400 text-sm">Status</span>
                <p className={`font-semibold mt-1 ${lastProcessed.resolved ? 'text-green-400' : 'text-red-400'}`}>
                  {lastProcessed.resolved ? 'Resolvido' : 'Não resolvido'}
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30 mb-4">
              <span className="text-gray-400 text-sm font-medium">Resumo da Análise</span>
              <p className="text-gray-300 text-sm mt-2 leading-relaxed">{lastProcessed.summary}</p>
            </div>

            {/* Topics */}
            {lastProcessed.topics.length > 0 && (
              <div className="space-y-3">
                <span className="text-gray-400 text-sm font-medium">Tópicos Identificados</span>
                <div className="flex flex-wrap gap-2">
                  {lastProcessed.topics.map((topic, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 rounded-lg text-xs font-medium border border-blue-500/30"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WebhookProcessorComponent;