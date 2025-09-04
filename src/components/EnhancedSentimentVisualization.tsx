import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Minus, Heart, Brain, Zap } from 'lucide-react';

interface SentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
  totalCalls: number;
  positivePercentage: number;
  neutralPercentage: number;
  negativePercentage: number;
}

interface EnhancedSentimentProps {
  sentimentDistribution: SentimentDistribution;
  recoveryRate: number;
  averageSentimentScore: number;
  totalCalls: number;
}

const EnhancedSentimentVisualization: React.FC<EnhancedSentimentProps> = ({
  sentimentDistribution,
  recoveryRate,
  averageSentimentScore,
  totalCalls
}) => {
  const { t } = useTranslation('dashboard');
  const getSentimentColor = (type: 'positive' | 'neutral' | 'negative') => {
    switch (type) {
      case 'positive': return 'from-green-500 to-emerald-600';
      case 'neutral': return 'from-yellow-500 to-amber-600';
      case 'negative': return 'from-red-500 to-rose-600';
    }
  };

  const getSentimentIcon = (type: 'positive' | 'neutral' | 'negative') => {
    switch (type) {
      case 'positive': return <Heart className="w-5 h-5" />;
      case 'neutral': return <Minus className="w-5 h-5" />;
      case 'negative': return <TrendingDown className="w-5 h-5" />;
    }
  };

  const getSentimentLabel = (type: 'positive' | 'neutral' | 'negative') => {
    switch (type) {
      case 'positive': return t('sentiment.positive');
      case 'neutral': return t('sentiment.neutral');
      case 'negative': return t('sentiment.negative');
    }
  };

  const safeRecoveryRate = recoveryRate || 0;

  const getRecoveryRateColor = () => {
    if (safeRecoveryRate >= 70) return 'text-green-400';
    if (safeRecoveryRate >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRecoveryRateIcon = () => {
    if (safeRecoveryRate >= 70) return <TrendingUp className="w-6 h-6 text-green-400" />;
    if (safeRecoveryRate >= 50) return <Zap className="w-6 h-6 text-yellow-400" />;
    return <TrendingDown className="w-6 h-6 text-red-400" />;
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center">
          <Brain className="w-6 h-6 mr-3 text-purple-400" />
          {t('sentiment.title')}
        </h3>
        <div className="text-sm text-gray-400">
          {t('sentiment.callsAnalyzed', { count: totalCalls })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sentiment Distribution */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white mb-4">Distribuição de Sentimentos</h4>
          
          {(['positive', 'neutral', 'negative'] as const).map((sentiment) => {
            const count = sentimentDistribution[sentiment];
            const percentage = sentimentDistribution[`${sentiment}Percentage`] || 0;
            
            return (
              <div key={sentiment} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getSentimentIcon(sentiment)}
                    <span className="text-gray-300 font-medium">
                      {getSentimentLabel(sentiment)}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold">{count}</div>
                    <div className="text-sm text-gray-400">{percentage}%</div>
                  </div>
                </div>
                
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${getSentimentColor(sentiment)} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Recovery Rate & Analytics */}
        <div className="space-y-6">
          <div className="text-center p-6 bg-gray-900/50 rounded-lg border border-gray-600/30">
            <div className="flex items-center justify-center mb-3">
              {getRecoveryRateIcon()}
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              {safeRecoveryRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-400 mb-4">Taxa de Recuperação</div>
            <div className="text-xs text-gray-500">
              Capacidade de transformar interações negativas em positivas
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gray-900/30 rounded-lg">
              <div className="text-2xl font-bold text-blue-400 mb-1">
                {(averageSentimentScore || 0).toFixed(1)}
              </div>
              <div className="text-xs text-gray-400">Score Médio</div>
            </div>
            
            <div className="text-center p-4 bg-gray-900/30 rounded-lg">
              <div className="text-2xl font-bold text-purple-400 mb-1">
                {sentimentDistribution.totalCalls}
              </div>
              <div className="text-xs text-gray-400">Com Sentimento</div>
            </div>
          </div>

          {/* Recovery Rate Quality Indicator */}
          <div className="p-4 rounded-lg border-l-4 border-l-blue-500 bg-blue-500/10">
            <div className="text-sm font-medium text-blue-300 mb-1">
              Qualidade da Recuperação
            </div>
            <div className="text-xs text-gray-400">
              {safeRecoveryRate >= 70 ? '🌟 Excelente - Agentes muito eficazes em reverter situações negativas' :
               safeRecoveryRate >= 50 ? '⚡ Boa - Margem para melhorar técnicas de recuperação' :
               '🎯 Atenção - Foco necessário em treinamento de recuperação emocional'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedSentimentVisualization;