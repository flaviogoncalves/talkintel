import React from 'react';
import { TrendingUp, TrendingDown, Zap, Star, ArrowRight, Hash } from 'lucide-react';

interface TopicTrend {
  topic: string;
  count: number;
  previousCount: number;
  change: number;
  isNew: boolean;
  isRising: boolean;
  isFalling: boolean;
}

interface TrendingTopicsProps {
  topicsWithTrends: TopicTrend[];
  totalCalls: number;
}

const TrendingTopicsComponent: React.FC<TrendingTopicsProps> = ({
  topicsWithTrends,
  totalCalls
}) => {
  const safeTopicsWithTrends = topicsWithTrends || [];
  const top3Topics = safeTopicsWithTrends.slice(0, 3);

  const getTrendIcon = (topic: TopicTrend) => {
    if (topic.isNew) {
      return <Zap className="w-4 h-4 text-yellow-400" />;
    }
    if (topic.isRising) {
      return <TrendingUp className="w-4 h-4 text-green-400" />;
    }
    if (topic.isFalling) {
      return <TrendingDown className="w-4 h-4 text-red-400" />;
    }
    return <Hash className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = (topic: TopicTrend) => {
    if (topic.isNew) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
    if (topic.isRising) return 'text-green-400 bg-green-400/10 border-green-400/30';
    if (topic.isFalling) return 'text-red-400 bg-red-400/10 border-red-400/30';
    return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
  };

  const getTrendLabel = (topic: TopicTrend) => {
    if (topic.isNew) return 'NOVO';
    if (topic.change > 0) return `+${topic.change}%`;
    if (topic.change < 0) return `${topic.change}%`;
    return 'ESTÁVEL';
  };

  const getTopicPercentage = (count: number) => {
    return totalCalls > 0 ? Math.round((count / totalCalls) * 100) : 0;
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return '📌';
    }
  };

  const getPositionChange = (topic: TopicTrend) => {
    // This would ideally come from backend comparing positions
    // For now, we'll simulate it based on change percentage
    if (topic.isNew) return 'novo';
    if (topic.change > 50) return '+2';
    if (topic.change > 20) return '+1';
    if (topic.change < -50) return '-2';
    if (topic.change < -20) return '-1';
    return '=';
  };

  if (!top3Topics.length) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 backdrop-blur-sm">
        <div className="text-center text-gray-400">
          <Hash className="w-8 h-8 mx-auto mb-2" />
          <p>Nenhum tópico encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center">
          <Star className="w-6 h-6 mr-3 text-orange-400" />
          Top 3 Tópicos em Tendência
        </h3>
        <div className="text-sm text-gray-400">
          Baseado em {totalCalls} chamadas
        </div>
      </div>

      <div className="space-y-4">
        {top3Topics.map((topic, index) => {
          const percentage = getTopicPercentage(topic.count);
          const positionChange = getPositionChange(topic);
          
          return (
            <div 
              key={topic.topic}
              className="relative p-4 bg-gray-900/50 rounded-lg border border-gray-600/30 hover:border-gray-500/50 transition-all duration-200"
            >
              {/* Rank Badge */}
              <div className="absolute -top-2 -left-2 text-xl">
                {getRankIcon(index)}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(topic)}
                      <h4 className="text-white font-semibold text-lg">
                        {topic.topic}
                      </h4>
                    </div>
                    
                    {/* Trend Badge */}
                    <div className={`px-2 py-1 rounded-full text-xs font-bold border ${getTrendColor(topic)}`}>
                      {getTrendLabel(topic)}
                    </div>
                    
                    {/* Position Change */}
                    {positionChange !== '=' && (
                      <div className="text-xs text-gray-400 font-mono">
                        {positionChange === 'novo' ? '🆕' : positionChange}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400">Menções:</span>
                      <span className="text-white font-bold">{topic.count}</span>
                      <span className="text-gray-500">({percentage}%)</span>
                    </div>
                    
                    {topic.previousCount > 0 && (
                      <>
                        <ArrowRight className="w-3 h-3 text-gray-500" />
                        <div className="text-gray-400">
                          Anterior: {topic.previousCount}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          topic.isNew ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                          topic.isRising ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                          topic.isFalling ? 'bg-gradient-to-r from-red-400 to-rose-500' :
                          'bg-gradient-to-r from-gray-400 to-gray-500'
                        }`}
                        style={{ width: `${Math.min(percentage * 2, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Insight Badge */}
              <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs">
                <div className="text-blue-300 font-medium">
                  💡 {topic.isNew ? 'Tópico emergente - monitorar de perto' :
                      topic.isRising ? 'Tendência crescente - possível problema ou oportunidade' :
                      topic.isFalling ? 'Tendência decrescente - melhoria ou mudança de foco' :
                      'Tópico estável - parte do fluxo normal'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-gray-700/50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-green-400">
              {top3Topics.filter(t => t.isRising || t.isNew).length}
            </div>
            <div className="text-xs text-gray-400">Em Alta</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-400">
              {top3Topics.filter(t => !t.isRising && !t.isFalling && !t.isNew).length}
            </div>
            <div className="text-xs text-gray-400">Estáveis</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-400">
              {top3Topics.filter(t => t.isFalling).length}
            </div>
            <div className="text-xs text-gray-400">Em Queda</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendingTopicsComponent;