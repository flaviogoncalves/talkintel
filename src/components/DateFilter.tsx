import React from 'react';
import { Calendar, Clock, Filter } from 'lucide-react';

interface DateFilterProps {
  dateRange: { start: string; end: string };
  setDateRange: (range: { start: string; end: string }) => void;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
}

const DateFilter: React.FC<DateFilterProps> = ({
  dateRange,
  setDateRange,
  selectedPeriod,
  setSelectedPeriod
}) => {
  const quickPeriods = [
    { id: '7d', label: 'Últimos 7 dias', icon: Clock },
    { id: '30d', label: 'Últimos 30 dias', icon: Calendar },
    { id: '90d', label: 'Últimos 90 dias', icon: Calendar },
    { id: 'custom', label: 'Personalizado', icon: Filter }
  ];

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    
    if (period !== 'custom') {
      const today = new Date();
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date(today.getTime() - (days * 24 * 60 * 60 * 1000));
      
      setDateRange({
        start: startDate.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Period Buttons */}
      <div className="flex flex-wrap gap-3">
        {quickPeriods.map((period) => {
          const Icon = period.icon;
          const isSelected = selectedPeriod === period.id;
          
          return (
            <button
              key={period.id}
              onClick={() => handlePeriodChange(period.id)}
              className={`group flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border ${
                isSelected
                  ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 border-purple-500/30 shadow-lg shadow-purple-500/10'
                  : 'bg-gray-700/50 text-gray-400 border-gray-600/50 hover:bg-gray-600/50 hover:text-white hover:border-gray-500/50'
              }`}
            >
              <Icon className={`w-4 h-4 transition-colors duration-300 ${
                isSelected ? 'text-purple-400' : 'group-hover:text-white'
              }`} />
              <span>{period.label}</span>
            </button>
          );
        })}
      </div>

      {/* Custom Date Range */}
      {selectedPeriod === 'custom' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-700/30 rounded-xl border border-gray-600/50">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-purple-400" />
              Data Inicial
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-purple-400" />
              Data Final
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
            />
          </div>
        </div>
      )}


    </div>
  );
};

export default DateFilter;