import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageContextType {
  currentLanguage: string;
  availableLanguages: { code: string; name: string; flag: string }[];
  changeLanguage: (language: string) => void;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const availableLanguages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
  ];

  const changeLanguage = async (language: string) => {
    setIsLoading(true);
    try {
      await i18n.changeLanguage(language);
      localStorage.setItem('i18nextLng', language);
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentLanguage = i18n.language || 'en';

  useEffect(() => {
    // Set initial loading state
    setIsLoading(!i18n.isInitialized);

    const handleLanguageChange = () => {
      console.log('Language changed to:', i18n.language);
      setIsLoading(false);
    };

    const handleLoaded = () => {
      console.log('i18n loaded, current language:', i18n.language);
      setIsLoading(false);
    };

    const handleInitialized = () => {
      console.log('i18n initialized, current language:', i18n.language);
      setIsLoading(false);
    };

    i18n.on('languageChanged', handleLanguageChange);
    i18n.on('loaded', handleLoaded);
    i18n.on('initialized', handleInitialized);

    // If already initialized, set loading to false
    if (i18n.isInitialized) {
      setIsLoading(false);
    }

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
      i18n.off('loaded', handleLoaded);
      i18n.off('initialized', handleInitialized);
    };
  }, [i18n]);

  const value: LanguageContextType = {
    currentLanguage,
    availableLanguages,
    changeLanguage,
    isLoading,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};