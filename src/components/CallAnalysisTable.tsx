import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, User, Bot, Star, Tag, Trash2, FileText, X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { CallAnalysis } from '../types';

interface CallAnalysisTableProps {
  calls: CallAnalysis[];
  onDelete?: (callId: string) => void;
}

const CallAnalysisTable: React.FC<CallAnalysisTableProps> = ({ calls, onDelete }) => {
  const [openSummaryId, setOpenSummaryId] = useState<string | null>(null);
  const [openTranscriptionId, setOpenTranscriptionId] = useState<string | null>(null);
  const [openTopicsId, setOpenTopicsId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Pagination calculations
  const totalPages = Math.ceil(calls.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCalls = calls.slice(startIndex, endIndex);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'negative':
        return 'text-red-400 bg-red-500/20 border-red-500/30';
      default:
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDelete = (callId: string) => {
    if (onDelete) {
      onDelete(callId);
    }
  };

  const handleViewSummary = (callId: string) => {
    setOpenSummaryId(callId);
  };

  const handleViewTranscription = (callId: string) => {
    setOpenTranscriptionId(callId);
  };

  const handleViewTopics = (callId: string) => {
    setOpenTopicsId(callId);
  };

  const closeSummaryModal = () => {
    setOpenSummaryId(null);
  };

  const closeTranscriptionModal = () => {
    setOpenTranscriptionId(null);
  };

  const closeTopicsModal = () => {
    setOpenTopicsId(null);
  };

  // Pagination functions
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // CSV Export function
  const exportToCSV = () => {
    const headers = [
      'Agente',
      'Data/Hora',
      'Duração (segundos)',
      'Sentimento',
      'Score Sentimento',
      'Resolução',
      'Tópicos',
      'Resumo'
    ];

    const csvData = calls.map(call => [
      call.agentName || '',
      formatDateTime(call.timestamp),
      call.duration.toString(),
      call.sentiment === 'positive' ? 'Positivo' : 
       call.sentiment === 'negative' ? 'Negativo' : 'Neutro',
      (call.customerSatisfaction || 0).toFixed(2),
      call.resolved ? 'Resolvido' : 'Pendente',
      (call.topics && Array.isArray(call.topics) ? call.topics.join('; ') : ''),
      (call.summary || '').replace(/"/g, '""') // Escape quotes
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `analise_chamadas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to render modal in portal
  const renderModal = (content: React.ReactNode) => {
    return createPortal(content, document.body);
  };

  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-2xl border border-gray-700/50 overflow-hidden">
      {/* Header with Export */}
      <div className="px-6 py-4 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/50 to-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span>Mostrando {startIndex + 1}-{Math.min(endIndex, calls.length)} de {calls.length} chamadas</span>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center space-x-2 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 hover:text-green-300 rounded-lg border border-green-500/30 hover:border-green-400/50 transition-all duration-200 text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-700/30 backdrop-blur-sm">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Agente
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Data/Hora
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Duração
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Sentimento
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Resolução
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Tópicos
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Sumário
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Transcrição
              </th>
              {onDelete && (
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {paginatedCalls.map((call, index) => (
              <tr 
                key={call.id} 
                className="group hover:bg-gradient-to-r hover:from-gray-700/20 hover:to-gray-800/20 transition-all duration-200"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg border transition-all duration-200 ${
                      call.agentType === 'human' 
                        ? 'bg-blue-500/20 border-blue-500/30 group-hover:border-blue-400/50' 
                        : 'bg-green-500/20 border-green-500/30 group-hover:border-green-400/50'
                    }`}>
                      {call.agentType === 'human' ? (
                        <User className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Bot className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white group-hover:text-purple-200 transition-colors duration-200">
                        {call.agentName}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">
                        {call.agentType === 'human' ? 'Humano' : 'IA'}
                      </p>
                    </div>
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">{formatDateTime(call.timestamp)}</span>
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-white">
                    {formatDuration(call.duration)}
                  </span>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${getSentimentColor(call.sentiment)}`}>
                      {call.sentiment === 'positive' ? 'Positivo' : 
                       call.sentiment === 'negative' ? 'Negativo' : 'Neutro'}
                    </span>
                    <span className="text-sm font-semibold text-white ml-2">
                      {typeof call.customerSatisfaction === 'number' ? call.customerSatisfaction.toFixed(2) : '0.00'}
                    </span>
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${call.resolved ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className={`text-sm font-medium ${call.resolved ? 'text-green-400' : 'text-red-400'}`}>
                      {call.resolved ? 'Resolvido' : 'Pendente'}
                    </span>
                  </div>
                </td>
                
                <td className="px-6 py-4">
                  {call.topics && Array.isArray(call.topics) && call.topics.length > 0 ? (
                    <button
                      onClick={() => handleViewTopics(call.id)}
                      className="flex items-center space-x-1 px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 rounded-lg border border-blue-500/30 hover:border-blue-400/50 transition-all duration-200 text-xs font-medium"
                    >
                      <Tag className="w-3 h-3" />
                      <span>Ver Tópicos</span>
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500">Nenhum tópico</span>
                  )}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleViewSummary(call.id)}
                    className="flex items-center space-x-1 px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 hover:text-purple-300 rounded-lg border border-purple-500/30 hover:border-purple-400/50 transition-all duration-200 text-xs font-medium"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Ver Sumário</span>
                  </button>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleViewTranscription(call.id)}
                    className="flex items-center space-x-1 px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 rounded-lg border border-blue-500/30 hover:border-blue-400/50 transition-all duration-200 text-xs font-medium"
                    disabled={!call.transcription && (!call.segments || call.segments.length === 0)}
                  >
                    <FileText className="w-3 h-3" />
                    <span>Ver Transcrição</span>
                  </button>
                </td>
                
                {onDelete && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleDelete(call.id)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded-lg border border-red-500/30 hover:border-red-400/50 transition-all duration-200 opacity-0 group-hover:opacity-100"
                      title="Excluir chamada"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-700/50 bg-gradient-to-r from-gray-800/50 to-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <span>Página {currentPage} de {totalPages}</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={prevPage}
                disabled={currentPage === 1}
                className="flex items-center space-x-1 px-3 py-1.5 bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 hover:text-gray-300 rounded-lg border border-gray-600/30 hover:border-gray-500/50 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        currentPage === pageNum
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 hover:text-gray-300 border border-gray-600/30 hover:border-gray-500/50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className="flex items-center space-x-1 px-3 py-1.5 bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 hover:text-gray-300 rounded-lg border border-gray-600/30 hover:border-gray-500/50 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Próxima</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {openSummaryId && renderModal(
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={closeSummaryModal}
        >
          <div 
            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700/50 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-700/50 flex-shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center">
                <FileText className="w-5 h-5 mr-2 text-purple-400" />
                Sumário da Conversa
              </h3>
              <button
                onClick={closeSummaryModal}
                className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const call = calls.find(c => c.id === openSummaryId);
                if (!call) return <p className="text-gray-400">Chamada não encontrada</p>;
                
                return (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Agente:</h4>
                      <p className="text-white">{call.agentName}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Horário:</h4>
                      <p className="text-white">{new Date(call.timestamp).toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Resumo:</h4>
                      <p className="text-gray-200 leading-relaxed">
                        {call.summary || 'Resumo não disponível'}
                      </p>
                    </div>
                    {call.keyInsights && call.keyInsights.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Insights Principais:</h4>
                        <ul className="space-y-1">
                          {call.keyInsights.map((insight, index) => (
                            <li key={index} className="text-gray-200 flex items-start">
                              <span className="text-purple-400 mr-2">•</span>
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Transcription Modal */}
      {openTranscriptionId && renderModal(
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={closeTranscriptionModal}
        >
          <div 
            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700/50 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-700/50 flex-shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-400" />
                Transcrição da Conversa
              </h3>
              <button
                onClick={closeTranscriptionModal}
                className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const call = calls.find(c => c.id === openTranscriptionId);
                if (!call) return <p className="text-gray-400">Chamada não encontrada</p>;
                
                return (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Agente:</h4>
                      <p className="text-white">{call.agentName}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Horário:</h4>
                      <p className="text-white">{new Date(call.timestamp).toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Transcrição:</h4>
                      {call.segments && call.segments.length > 0 ? (
                        <div className="space-y-3">
                          {call.segments.map((segment, index) => (
                            <div key={index} className="bg-gray-700/30 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-purple-400">
                                  {segment.speaker}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {Math.floor(segment.initial_time)}s - {Math.floor(segment.end_time)}s
                                </span>
                              </div>
                              <p className="text-gray-200 leading-relaxed">{segment.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-200 leading-relaxed">
                          {call.transcription || 'Transcrição não disponível'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Topics Modal */}
      {openTopicsId && renderModal(
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={closeTopicsModal}
        >
          <div 
            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700/50 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-700/50 flex-shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center">
                <Tag className="w-5 h-5 mr-2 text-blue-400" />
                Tópicos da Conversa
              </h3>
              <button
                onClick={closeTopicsModal}
                className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const call = calls.find(c => c.id === openTopicsId);
                if (!call) return <p className="text-gray-400">Chamada não encontrada</p>;
                
                return (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Agente:</h4>
                      <p className="text-white">{call.agentName}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Horário:</h4>
                      <p className="text-white">{new Date(call.timestamp).toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">
                        Tópicos Identificados ({call.topics && Array.isArray(call.topics) ? call.topics.length : 0}):
                      </h4>
                      {call.topics && Array.isArray(call.topics) && call.topics.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {call.topics.map((topic, index) => (
                            <span 
                              key={index}
                              className="px-3 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 rounded-lg text-sm font-medium border border-blue-500/30 hover:border-blue-400/50 transition-all duration-200"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400">Nenhum tópico identificado para esta conversa.</p>
                      )}
                    </div>
                    {call.tags && call.tags.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-2">
                          Tags Relacionadas ({call.tags.length}):
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {call.tags.map((tag, index) => (
                            <span 
                              key={index}
                              className="px-2 py-1 bg-gray-500/20 text-gray-300 rounded text-xs font-medium border border-gray-500/30"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallAnalysisTable;