import { useState, useEffect, useCallback } from 'react';
import { translations, type Language } from '@/i18n/translations';

export function useLanguage() {
  const [language, setLanguage] = useState<Language>('en');
  const [isRTL, setIsRTL] = useState(false);

  // Get current translations
  const t = translations[language];
  
  // Update document direction when language changes
  useEffect(() => {
    const isRTL = language === 'fa';
    setIsRTL(isRTL);
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = isRTL ? 'fa-AF' : 'en';
  }, [language]);

  // Toggle language
  const toggleLanguage = useCallback(() => {
    setLanguage(prev => prev === 'en' ? 'fa' : 'en');
  }, []);

  // Set specific language
  const changeLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
  }, []);

  return {
    language,
    isRTL,
    t,
    toggleLanguage,
    changeLanguage,
  };
}

// Helper function for RTL-aware class names
export function rtlClass(rtlClass: string, ltrClass: string, isRTL: boolean) {
  return isRTL ? rtlClass : ltrClass;
}

// Helper for RTL-aware margin/padding classes
export function rtlSide(isRTL: boolean, leftValue: string, rightValue: string) {
  return isRTL ? rightValue : leftValue;
}

// Helper for flex row direction
export function rtlRow(isRTL: boolean) {
  return isRTL ? "flex-row" : "flex-row";
}
