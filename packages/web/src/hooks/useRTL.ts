import { useLanguageCtx } from '@/i18n/provider';
import { useMemo } from 'react';

export function useRTL() {
  const { isRTL } = useLanguageCtx();

  const rtl = useMemo(() => ({
    // Spacing helpers using logical properties
    ms: (value: string) => `ms-${value}`, // margin-inline-start
    me: (value: string) => `me-${value}`, // margin-inline-end
    ps: (value: string) => `ps-${value}`, // padding-inline-start
    pe: (value: string) => `pe-${value}`, // padding-inline-end
    
    // Direction helpers
    dir: isRTL ? 'rtl' as const : 'ltr' as const,
    flexRow: isRTL ? 'flex-row' : 'flex-row',
    textAlign: isRTL ? 'text-right' : 'text-left',
    
    // Icon positioning
    iconStart: 'btn-icon-start',
    iconEnd: 'btn-icon-end',
  }), [isRTL]);

  return { isRTL, ...rtl };
}
