import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSelector: React.FC = () => {
  const { currentLanguage, changeLanguage, isLoading } = useLanguage();

  const languages = [
    { code: 'en', label: 'EN' },
    { code: 'pt', label: 'PT' }
  ];

  return (
    <div className="flex items-center space-x-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700/50">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => changeLanguage(lang.code)}
          disabled={isLoading}
          className={`px-2 py-1 text-xs font-medium rounded transition-all duration-200 disabled:opacity-50 ${
            currentLanguage === lang.code
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
};

export default LanguageSelector;