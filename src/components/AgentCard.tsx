import React from 'react';
import { useTranslation } from 'react-i18next';
import { User, Bot, Star, Clock, CheckCircle, MessageCircle, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import { AgentMetrics } from '../types';

interface AgentCardProps {
  agent: AgentMetrics;
  onDelete?: (agentId: string) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, onDelete }) => {
  const { t } = useTranslation('dashboard');
  const isHuman = agent.type === 'human';
  
  console.log('🔍 DEBUG - AgentCard received agent data:', agent);

  const handleDelete = () => {
    if (onDelete) {
      onDelete(agent.id);
    }
  };

  return (
    <div className="group relative bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600/70 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-2">
      {/* Delete Button */}
      {onDelete && (
        <button
          onClick={handleDelete}
          className="absolute top-4 right-4 p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded-lg border border-red-500/30 hover:border-red-400/50 transition-all duration-200 opacity-0 group-hover:opacity-100 z-10"
          title={t('performance.deleteAgent', 'Delete agent')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-xl border transition-all duration-300 ${
              isHuman 
                ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-blue-500/30 group-hover:border-blue-400/50' 
                : 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30 group-hover:border-green-400/50'
            }`}>
              {isHuman ? (
                <User className="w-6 h-6 text-blue-400 group-hover:text-blue-300 transition-colors duration-300" />
              ) : (
                <Bot className="w-6 h-6 text-green-400 group-hover:text-green-300 transition-colors duration-300" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white group-hover:text-purple-100 transition-colors duration-300">{agent.name}</h3>
              <p className="text-gray-400 text-sm capitalize group-hover:text-gray-300 transition-colors duration-300">
                {agent.type === 'human' ? t('performance.humanAgent') : t('performance.aiAgent', 'AI Agent')}
              </p>
            </div>
          </div>
          
          <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-300 ${
            agent.trend === 'up' 
              ? 'bg-green-500/20 text-green-400 border-green-500/30 group-hover:border-green-400/50' :
            agent.trend === 'down' 
              ? 'bg-red-500/20 text-red-400 border-red-500/30 group-hover:border-red-400/50' :
              'bg-gray-500/20 text-gray-400 border-gray-500/30 group-hover:border-gray-400/50'
          }`}>
            {agent.trend === 'up' ? (
              <TrendingUp className="w-3 h-3" />
            ) : agent.trend === 'down' ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <div className="w-3 h-0.5 bg-current rounded"></div>
            )}
            <span>{agent.trendValue || 0}%</span>
          </div>
        </div>

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 text-sm">{t('performance.totalCalls')}</span>
            </div>
            <p className="text-2xl font-bold text-white">{agent.totalCalls || 0}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-gray-400 text-sm">{t('performance.sentiment')}</span>
            </div>
            <p className="text-2xl font-bold text-white">{agent.satisfactionScore || 0}/10</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-gray-400 text-sm">{t('performance.resolutionRate')}</span>
            </div>
            <p className="text-2xl font-bold text-white">{agent.resolutionRate || 0}%</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-gray-400 text-sm">{t('performance.quality')}</span>
            </div>
            <p className="text-2xl font-bold text-white">{agent.callQuality || 0}%</p>
          </div>
        </div>



        {/* Sentiment Analysis */}
        {agent.sentimentCounts && (
          <div className="space-y-3 mb-4">
            <div className="flex items-center space-x-2">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-gray-400 text-sm font-medium">{t('sentiment.distribution')}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="text-green-400 text-lg font-bold">{agent.sentimentCounts?.positive || 0}</div>
                <div className="text-xs text-gray-400">{t('sentiment.positive')}</div>
              </div>
              <div className="text-center p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="text-yellow-400 text-lg font-bold">{agent.sentimentCounts?.neutral || 0}</div>
                <div className="text-xs text-gray-400">{t('sentiment.neutral')}</div>
              </div>
              <div className="text-center p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="text-red-400 text-lg font-bold">{agent.sentimentCounts?.negative || 0}</div>
                <div className="text-xs text-gray-400">{t('sentiment.negative')}</div>
              </div>
            </div>
          </div>
        )}

        {/* Top Tags */}
        <div className="space-y-3">
          <span className="text-gray-400 text-sm font-medium">{t('performance.mainTags')}</span>
          <div className="flex flex-wrap gap-2">
            {(agent.topTags || []).map((tag, index) => (
              <span 
                key={index} 
                className="px-3 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 rounded-lg text-xs font-medium border border-purple-500/30 hover:border-purple-400/50 transition-all duration-200"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      {/* Animated bottom border */}
      <div className={`absolute bottom-0 left-0 h-1 rounded-b-2xl transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left ${
        isHuman 
          ? 'bg-gradient-to-r from-blue-500 to-indigo-500' 
          : 'bg-gradient-to-r from-green-500 to-emerald-500'
      }`}></div>
    </div>
  );
};

export default AgentCard;