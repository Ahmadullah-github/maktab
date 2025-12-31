import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Hook to manage text direction based on current language
 * Persian/Dari (fa) uses RTL, English (en) uses LTR
 */
export function useDirection() {
  const { i18n } = useTranslation();

  const isRTL = i18n.language === 'fa';
  const direction = isRTL ? 'rtl' : 'ltr';

  useEffect(() => {
    // Set direction on document element
    document.documentElement.dir = direction;
    document.documentElement.lang = i18n.language;

    // Add/remove RTL class for Tailwind RTL plugin
    if (isRTL) {
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.classList.remove('rtl');
    }
  }, [direction, isRTL, i18n.language]);

  return {
    isRTL,
    direction,
    language: i18n.language,
  };
}
