import React, { createContext, useContext, useMemo } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import axios from 'axios';

type LanguageContextValue = ReturnType<typeof useLanguage>;

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
	const lang = useLanguage();

	// Load preference order: backend config > localStorage
	React.useEffect(() => {
		const saved = localStorage.getItem('lang');
		if (saved === 'fa' || saved === 'en') {
			lang.changeLanguage(saved as any);
		}

		// Try fetch from backend configuration
		(async () => {
			try {
				const resp = await axios.get('/api/config/uiPreferences');
				const value = resp?.data?.value;
				if (typeof value === 'string') {
					try {
						const parsed = JSON.parse(value);
						const serverLang = parsed?.language;
						if ((serverLang === 'fa' || serverLang === 'en') && serverLang !== lang.language) {
							lang.changeLanguage(serverLang);
						}
					} catch {
						// value not JSON, attempt direct string usage
						if ((value === 'fa' || value === 'en') && value !== lang.language) {
							lang.changeLanguage(value);
						}
					}
				}
			} catch {
				// ignore backend errors
			}
		})();
	}, []);

	// Persist locally and to backend when language changes
	React.useEffect(() => {
		localStorage.setItem('lang', lang.language);
		(async () => {
			try {
				await axios.post(`/api/config/uiPreferences`, {
					value: JSON.stringify({ language: lang.language, calendar: lang.language === 'fa' ? 'jalali' : 'gregorian', numerals: lang.language === 'fa' ? 'persian' : 'latin' })
				});
			} catch {
				// ignore backend errors
			}
		})();
	}, [lang.language]);

	const value = useMemo(() => lang, [lang.language, lang.isRTL]);

	return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguageCtx() {
	const ctx = useContext(LanguageContext);
	if (!ctx) throw new Error('useLanguageCtx must be used within LanguageProvider');
	return ctx;
}

// Re-export RTL helpers from useLanguage
export { rtlClass, rtlSide, rtlRow } from '@/hooks/useLanguage';


