import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files statically
import commonEn from '../locales/en/common.json';
import authEn from '../locales/en/auth.json';
import dashboardEn from '../locales/en/dashboard.json';
import customerServiceEn from '../locales/en/customer-service.json';
import commonPt from '../locales/pt/common.json';
import authPt from '../locales/pt/auth.json';
import dashboardPt from '../locales/pt/dashboard.json';
import customerServicePt from '../locales/pt/customer-service.json';

const resources = {
  en: {
    common: commonEn,
    auth: authEn,
    dashboard: dashboardEn,
    'customer-service': customerServiceEn,
  },
  pt: {
    common: commonPt,
    auth: authPt,
    dashboard: dashboardPt,
    'customer-service': customerServicePt,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: 'en', // Force initial language to be 'en' instead of browser-detected
    debug: process.env.NODE_ENV === 'development',
    
    fallbackLng: {
      'en-US': ['en'],
      'pt-BR': ['pt'],
      'default': ['en']
    },
    
    interpolation: {
      escapeValue: false, // React already does escaping
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },

    ns: [
      'common',
      'auth',
      'dashboard', 
      'debt-collection',
      'sales',
      'customer-service',
      'campaigns'
    ],
    defaultNS: 'common',

    resources,

    // Language options
    supportedLngs: ['en', 'pt'],
    nonExplicitSupportedLngs: true,
    
    // Load all namespaces on init
    load: 'languageOnly',
    cleanCode: true,
    
    // React specific options
    react: {
      useSuspense: false, // Disable suspense to avoid loading issues
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
    },
  });

export default i18n;