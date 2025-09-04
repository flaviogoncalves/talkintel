import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import WordCloud from 'wordcloud';
import { Hash, TrendingUp } from 'lucide-react';

interface WordCloudData {
  text: string;
  value: number;
}

interface WordCloudProps {
  data: WordCloudData[];
  onTopicClick?: (topic: string) => void;
}

const WordCloudComponent: React.FC<WordCloudProps> = ({ data, onTopicClick }) => {
  const { t } = useTranslation('dashboard');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) {
      console.log('🔍 WordCloud - Canvas ou dados indisponíveis:', { 
        hasCanvas: !!canvasRef.current, 
        dataLength: data.length 
      });
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('❌ WordCloud - Não foi possível obter contexto do canvas');
      return;
    }

    console.log('🎨 WordCloud - Iniciando renderização:', data);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Prepare data in the format expected by wordcloud library
    const wordList: [string, number][] = data.map(item => [item.text, item.value]);
    console.log('📋 WordCloud - Lista de palavras:', wordList);

    // Calculate dynamic sizing
  const maxValue = Math.max(...data.map(item => item.value));
    const minValue = Math.min(...data.map(item => item.value));

    // Para poucos dados, usar tamanhos maiores
    const baseFontSize = data.length <= 5 ? 24 : 16;
    const maxFontSize = data.length <= 5 ? 48 : 32;

    // WordCloud configuration
    const options = {
      list: wordList,
      gridSize: 8, // Menor para melhor encaixe
      weightFactor: (size: number) => {
        if (maxValue === minValue) {
          // Se todos têm o mesmo peso, usar tamanho médio
          return baseFontSize + 8;
        }
        const ratio = (size - minValue) / (maxValue - minValue);
        return baseFontSize + (ratio * (maxFontSize - baseFontSize));
      },
      fontFamily: 'Inter, Arial, sans-serif',
      color: (word: string, weight: number) => {
        if (maxValue === minValue) {
          // Se todos têm o mesmo peso, usar cores variadas
          const colors = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
          const index = wordList.findIndex(item => item[0] === word);
          return colors[index % colors.length];
        }
        const ratio = (weight - minValue) / (maxValue - minValue);
        if (ratio > 0.8) return '#a855f7'; // purple-500
        if (ratio > 0.6) return '#3b82f6'; // blue-500
        if (ratio > 0.4) return '#10b981'; // green-500
        if (ratio > 0.2) return '#f59e0b'; // yellow-500
        return '#6b7280'; // gray-500
      },
      rotateRatio: 0.1, // Menos rotação para melhor legibilidade
      rotationSteps: 2,
      backgroundColor: 'transparent',
      drawOutOfBound: false,
      shrinkToFit: true,
      minSize: 12,
      maxSize: maxFontSize,
      origin: [canvas.width / 2, canvas.height / 2], // Centro do canvas
      click: (item: [string, number]) => {
        console.log(`Clicked on: ${item[0]} (${item[1]} occurrences)`);
        if (onTopicClick) {
          onTopicClick(item[0]);
        }
      },
      hover: (item: [string, number] | undefined, dimension: any, event: MouseEvent) => {
        if (item) {
          canvas.style.cursor = 'pointer';
          canvas.title = `${item[0]}: ${item[1]} ${item[1] === 1 ? 'ocorrência' : 'ocorrências'}`;
        } else {
          canvas.style.cursor = 'default';
          canvas.title = '';
        }
      }
    };

    console.log('⚙️ WordCloud - Configurações:', options);

    // Generate word cloud
    try {
      WordCloud(canvas, options);
      console.log('✅ WordCloud - Renderização concluída');
    } catch (error) {
      console.error('❌ WordCloud - Erro na renderização:', error);
      
      // Fallback: desenhar texto simples se a biblioteca falhar
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const lineHeight = 25;
      
      data.forEach((item, index) => {
        const y = centerY - (data.length * lineHeight / 2) + (index * lineHeight);
        ctx.fillText(`${item.text} (${item.value})`, centerX, y);
      });
      
      console.log('🔧 WordCloud - Fallback text renderizado');
    }
  }, [data]);

  if (data.length === 0) {
  return (
      <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 text-center">
        <div className="space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center mx-auto border border-purple-500/30">
            <Hash className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">{t('topics.noTopicsFound')}</h3>
            <p className="text-gray-400">
              {t('topics.description')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(item => item.value));
        
  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-2xl border border-gray-700/50 overflow-hidden">
      {/* Header com estatísticas */}
      <div className="px-6 py-4 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/50 to-gray-700/50">
        <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 text-sm text-gray-400">
          <div className="flex items-center space-x-2">
            <Hash className="w-4 h-4" />
              <span>{data.length} {t('topics.uniqueTopics', 'unique topics')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4" />
              <span>{t('topics.maxOccurrences', 'Max: {{count}} occurrences', { count: maxValue })}</span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {t('topics.clickForDetails', 'Click on words for more details')}
          </div>
        </div>
      </div>

      {/* Word Cloud Canvas */}
      <div className="relative p-6 flex items-center justify-center bg-gradient-to-br from-gray-700/10 to-gray-800/10">
        <canvas
          ref={canvasRef}
          width={800}
          height={267}
          className="max-w-full h-auto rounded-lg"
            style={{
            filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
            background: 'transparent'
          }}
        />
      </div>


    </div>
  );
};

export default WordCloudComponent;