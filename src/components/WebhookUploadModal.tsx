import React, { useState } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Sparkles, Clipboard } from 'lucide-react';
import { TalkIntelWebhook, CallAnalysis } from '../types';
import { WebhookProcessor } from '../services/webhookProcessor';
import DataStorageService from '../services/dataStorage';

interface WebhookUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWebhookProcessed: (analysis: CallAnalysis) => void;
}

const WebhookUploadModal: React.FC<WebhookUploadModalProps> = ({ isOpen, onClose, onWebhookProcessed }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessed, setLastProcessed] = useState<CallAnalysis | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');

  if (!isOpen) return null;

  const processWebhookData = async (webhookData: any) => {
    setIsProcessing(true);
    setLastProcessed(null);
    setError(null);
    
    try {
      // Validar estrutura básica
      if (!webhookData || typeof webhookData !== 'object') {
        throw new Error('Estrutura do JSON inválida');
      }

      console.log('🔍 DEBUG Upload - Webhook original recebido:');
      console.log('   Has payload:', !!webhookData.payload);
      console.log('   Has payload.summarization:', !!webhookData.payload?.summarization);
      console.log('   payload.summarization:', webhookData.payload?.summarization);
      console.log('   payload.agent_name:', webhookData.payload?.agent_name);
      console.log('   payload.customer_name:', webhookData.payload?.customer_name);
      console.log('   Full payload keys:', webhookData.payload ? Object.keys(webhookData.payload) : 'no payload');

      // Converter formato do webhook usando a nova função
      const convertedWebhook = WebhookProcessor.convertWebhookFormat(webhookData);
      
      console.log('🔍 DEBUG Upload - Webhook convertido:');
      console.log('   convertedWebhook.summarization:', convertedWebhook.summarization);
      
      // Processar webhook convertido
      const analysis = WebhookProcessor.processWebhook(convertedWebhook);
      
      console.log('🔍 DEBUG Upload - Análise processada:');
      console.log('   analysis.summary:', analysis.summary);
      
      // Send to server (enviar o webhook original, não o convertido)
      // Note: DataStorageService.saveCallAnalysis() apenas loga - dados salvos no servidor
      try {
        console.log('🔍 DEBUG Upload - Enviando para servidor:');
        console.log('   webhookData.payload.summarization:', webhookData.payload?.summarization);
        console.log('   webhookData.payload.agent_name:', webhookData.payload?.agent_name);
        console.log('   webhookData.payload.customer_name:', webhookData.payload?.customer_name);
        
        const response = await fetch('http://localhost:3007/webhook/sippulse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookData)
        });
        
        if (response.ok) {
          console.log('✅ Webhook enviado para servidor com sucesso');
        } else {
          console.warn('⚠️ Erro ao enviar webhook para servidor:', response.status);
        }
      } catch (serverError) {
        console.warn('⚠️ Erro de conexão com servidor:', serverError);
        // Continue mesmo se o servidor não estiver disponível
      }
      
      setLastProcessed(analysis);
      
      // Notify parent component
      onWebhookProcessed(analysis);
      
      console.log('✅ Webhook processado e salvo:', analysis.id);
      
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao processar webhook';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const text = await file.text();
      
      // Validar se é um JSON válido
      let webhook: any;
      try {
        webhook = JSON.parse(text);
      } catch (parseError) {
        throw new Error('Arquivo não é um JSON válido');
      }

      await processWebhookData(webhook);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao processar arquivo';
      setError(errorMessage);
    }
  };

  const handlePasteJson = async () => {
    if (!jsonInput.trim()) {
      setError('Por favor, cole um JSON válido');
      return;
    }

    try {
      // Validar se é um JSON válido
      let webhook: any;
      try {
        webhook = JSON.parse(jsonInput);
      } catch (parseError) {
        throw new Error('JSON inválido. Verifique a sintaxe.');
      }

      await processWebhookData(webhook);
    } catch (error) {
      console.error('Erro ao processar JSON colado:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao processar JSON';
      setError(errorMessage);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const simulateWebhook = () => {
    setIsProcessing(true);
    setLastProcessed(null);
    setError(null);
    
    // Simular webhook com o novo formato
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
        cost: 0.1117458795264,
        currency: "BRL",
        cost_details: [],
        performance: {
          delay: 527,
          execution_time: 20603,
          relative_execution_time: 5.24894432849585,
          relative_execution_time_unit: "seconds_per_seconds"
        }
      },
      summarization: "A ligação foi feita por Nicolas, representante da Caixa, para discutir um assunto comercial com Miguel. Miguel expressou desconfiança em relação à ligação.",
      sentiment_analysis: [
        {
          label: "confiança",
          score: 0.3,
          timestamp: "00:12-00:31",
          fragment: "Bom dia, eu me chamo Nicolas e eu falo aqui no nome da Caixa."
        },
        {
          label: "desconfiança",
          score: 0.1,
          timestamp: "00:32-00:36",
          fragment: "O senhor vai ter essa ligação gravada, porque eu não tenho nada com Caixa."
        },
        {
          label: "frustração",
          score: 0.2,
          timestamp: "00:37-00:55",
          fragment: "A caixa está em dias, que eu fui lá no gerente lá."
        }
      ],
      topic_detection: [
        {
          label: "ligação comercial",
          confidence: 0.9,
          timestamp: "00:12-00:31",
          fragment: "Bom dia, eu me chamo Nicolas e eu falo aqui no nome da Caixa."
        },
        {
          label: "desconfiança sobre segurança",
          confidence: 0.85,
          timestamp: "00:32-00:36",
          fragment: "O senhor vai ter essa ligação gravada, porque eu não tenho nada com Caixa."
        }
      ],
      resolution: false,
      agent_name: "Nicolas",
      customer_name: "Miguel"
    };

    setTimeout(async () => {
      try {
        const analysis = WebhookProcessor.processWebhook(sampleWebhook);
        
        // Send to server (dados agora salvos apenas no servidor)
        // Note: DataStorageService.saveCallAnalysis() apenas loga
        try {
          const response = await fetch('http://localhost:3007/webhook/sippulse', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(sampleWebhook)
          });
          
          if (response.ok) {
            console.log('✅ Webhook simulado enviado para servidor com sucesso');
          } else {
            console.warn('⚠️ Erro ao enviar webhook simulado para servidor:', response.status);
          }
        } catch (serverError) {
          console.warn('⚠️ Erro de conexão com servidor:', serverError);
          // Continue mesmo se o servidor não estiver disponível
        }
        
        setLastProcessed(analysis);
        
        // Notify parent component
        onWebhookProcessed(analysis);
        
        console.log('✅ Webhook simulado processado e salvo:', analysis.id);
      } catch (error) {
        console.error('Erro na simulação:', error);
        setError('Erro ao simular webhook');
      } finally {
        setIsProcessing(false);
      }
    }, 1500);
  };

  const handleCloseAndRefresh = () => {
    onClose();
    // Force a small delay to ensure the modal closes before refresh
    setTimeout(() => {
      if (lastProcessed) {
        onWebhookProcessed(lastProcessed);
      }
    }, 100);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-800/95 to-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700/50 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg border border-purple-500/30">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Upload Webhook JSON</h2>
              <p className="text-gray-400 text-sm">Analise dados do TalkIntel AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors duration-200"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-800/50 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'upload'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Upload className="w-4 h-4" />
                <span>Upload Arquivo</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'paste'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Clipboard className="w-4 h-4" />
                <span>Colar JSON</span>
              </div>
            </button>
          </div>

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                dragActive
                  ? 'border-purple-500/50 bg-purple-500/10'
                  : 'border-gray-600/50 hover:border-gray-500/50 hover:bg-gray-700/20'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl flex items-center justify-center border border-purple-500/30">
                  <Upload className="w-8 h-8 text-purple-400" />
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Arraste e solte seu arquivo JSON aqui
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Ou clique para selecionar um arquivo
                  </p>
                  
                  <div className="flex justify-center space-x-3">
                    <label className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-2 rounded-lg cursor-pointer transition-all duration-300 flex items-center space-x-2">
                      <Upload className="w-4 h-4" />
                      <span>Selecionar Arquivo</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={isProcessing}
                      />
                    </label>
                    
                    <button
                      onClick={simulateWebhook}
                      disabled={isProcessing}
                      className="bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white px-6 py-2 rounded-lg transition-all duration-300 flex items-center space-x-2 disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Simular</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Paste Tab */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                <div className="flex items-center space-x-2 mb-3">
                  <Clipboard className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-semibold text-white">Cole seu JSON aqui</h3>
                </div>
                <p className="text-gray-400 text-sm mb-4">
                  Cole o conteúdo JSON do webhook do TalkIntel AI diretamente nesta área
                </p>
                
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder={`Cole seu JSON aqui...

Exemplo:
{
  "id": "webhook-123",
  "timestamp": "2024-01-01T10:00:00Z",
  "payload": {
    "transcription": {
      "text": "Olá, como posso ajudar?",
      "segments": [...]
    },
    "sentiment_analysis": [...],
    "topic_detection": [...]
  }
}`}
                  className="w-full h-64 bg-gray-900/50 border border-gray-600/50 rounded-lg p-4 text-white placeholder-gray-500 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
                  disabled={isProcessing}
                />
                
                <div className="flex justify-center mt-4">
                  <button
                    onClick={handlePasteJson}
                    disabled={isProcessing || !jsonInput.trim()}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-8 py-3 rounded-lg transition-all duration-300 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Clipboard className="w-4 h-4" />
                    <span>Processar JSON</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="flex items-center justify-center py-8">
              <div className="relative">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500/20 border-t-purple-500"></div>
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 animate-pulse"></div>
              </div>
              <div className="ml-3">
                <p className="text-white font-medium">Processando webhook...</p>
                <p className="text-gray-400 text-sm">Analisando dados com IA</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isProcessing && (
            <div className="bg-gradient-to-br from-red-500/10 to-red-600/10 backdrop-blur-sm rounded-xl p-6 border border-red-500/30">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-red-500/20 rounded-lg border border-red-500/30">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <span className="text-red-400 font-semibold">Erro no processamento</span>
                  <p className="text-gray-400 text-sm">Verifique o formato do JSON</p>
                </div>
              </div>
              
              <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                <p className="text-red-300 text-sm">{error}</p>
              </div>

              <div className="text-center mt-4">
                <button
                  onClick={() => setError(null)}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-6 py-2 rounded-lg transition-all duration-300"
                >
                  Tentar Novamente
                </button>
              </div>
            </div>
          )}

          {/* Success Results */}
          {lastProcessed && !isProcessing && !error && (
            <div className="bg-gradient-to-br from-gray-700/50 to-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-600/50">
              {/* Success Header */}
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg border border-green-500/30">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <span className="text-green-400 font-semibold">Processado com sucesso!</span>
                  <p className="text-gray-400 text-sm">Análise salva e dashboard atualizado</p>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <span className="text-gray-400 text-xs">Agente</span>
                  <p className="text-white font-medium">{lastProcessed.agentName}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <span className="text-gray-400 text-xs">Score de Sentimento</span>
                  <p className="text-white font-medium">{lastProcessed.customerSatisfaction.toFixed(1)}/5</p>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={handleCloseAndRefresh}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-2 rounded-lg transition-all duration-300"
                >
                  Fechar e Ver no Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebhookUploadModal;