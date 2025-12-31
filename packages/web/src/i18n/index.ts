import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fa from './locales/fa.json';

const resources = {
  fa: { translation: fa },
  en: { translation: en },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'fa', // Default language - Persian
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
