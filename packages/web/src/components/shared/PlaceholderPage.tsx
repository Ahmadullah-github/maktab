import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface PlaceholderPageProps {
  /** i18n key for the page title */
  titleKey: string;
  /** Lucide icon component to display */
  icon: LucideIcon;
}

/**
 * A reusable placeholder page component for features under development.
 * Displays a centered layout with an icon, title, and "under development" message.
 */
export function PlaceholderPage({ titleKey, icon: Icon }: PlaceholderPageProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <Icon className="w-16 h-16 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold mb-2">{t(titleKey)}</h1>
      <p className="text-muted-foreground">{t('placeholder.underDevelopment')}</p>
    </div>
  );
}
