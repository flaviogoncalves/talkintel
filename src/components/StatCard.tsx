import React from 'react';
import { useTranslation } from 'react-i18next';
import { DivideIcon as LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: number;
  changeType?: 'up' | 'down' | 'stable';
  suffix?: string;
  className?: string;
  tooltip?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  change,
  changeType,
  suffix = '',
  className = '',
  tooltip
}) => {
  const { t } = useTranslation('common');
  const getTrendIcon = () => {
    switch (changeType) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    switch (changeType) {
      case 'up':
        return 'text-green-400';
      case 'down':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div 
      className={`group relative bg-gray-800/90 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600/70 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1 ${className}`}
      title={tooltip}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      <div className="relative flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl border border-purple-500/30 group-hover:border-purple-400/50 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-purple-500/20">
            <Icon className="w-6 h-6 text-purple-400 group-hover:text-purple-300 transition-colors duration-300" />
          </div>
          <div>
            <p className="text-gray-400 text-sm font-medium mb-1 group-hover:text-gray-300 transition-colors duration-300">{title}</p>
            <p className="text-3xl font-bold text-white group-hover:text-purple-100 transition-colors duration-300">
              {value}{suffix}
            </p>
          </div>
        </div>
        
        {change !== undefined && (
          <div className="flex flex-col items-end space-y-1">
            <div className="flex items-center space-x-1">
              {getTrendIcon()}
              <span className={`text-sm font-semibold ${getTrendColor()}`}>
                {Math.abs(change)}%
              </span>
            </div>
            <div className="text-xs text-gray-500">{t('common:periods.vsPreviousPeriod', 'vs. previous period')}</div>
          </div>
        )}
      </div>
      
      {/* Animated bottom border */}
      <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-b-2xl transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
    </div>
  );
};

export default StatCard;