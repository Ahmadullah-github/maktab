import { LicenseBanner } from '@/components/license';
import { useDirection } from '@/hooks/useDirection';
import { useLicense } from '@/hooks/useLicense';
import { useUIStore } from '@/stores/uiStore';
import { SchoolSetupPage } from '@/features/school-settings/components/SchoolSetupPage';
import { useSchoolProfile } from '@/features/school-settings/hooks/useSchoolProfile';
import { Button } from '@/components/ui/button';
import { Outlet } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export const MainLayout = () => {
  const { t, i18n } = useTranslation();
  const { rightPanelOpen } = useUIStore();
  const { isRTL } = useDirection();

  // Initialize license status on app load
  useLicense();
  const profileQuery = useSchoolProfile();
  const profile = profileQuery.data?.profile ?? null;
  const defaultLanguage = profile?.defaultLanguage;

  useEffect(() => {
    if (defaultLanguage && i18n.resolvedLanguage !== defaultLanguage) {
      void i18n.changeLanguage(defaultLanguage);
    }
  }, [defaultLanguage, i18n]);

  if (profileQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label={t('common.loading')} />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-destructive">{t('schoolSettings.profile.loadFailed')}</p>
        <Button onClick={() => profileQuery.refetch()}>{t('common.retry')}</Button>
      </div>
    );
  }

  if (!profile) return <SchoolSetupPage />;

  return (
    <div className="flex flex-col h-screen w-full bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-primary-light/40 via-background to-background overflow-hidden">
      {/* License Banner - shows at top when needed */}
      <LicenseBanner />

      <Header profile={profile} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar profile={profile} />

        <main className="flex-1 flex flex-col min-w-0 bg-transparent">
          <div className="flex-1 flex overflow-hidden relative">
            <div className="flex-1 overflow-auto">
              <Outlet />
            </div>

            {/* Right Panel - Inspector (becomes left panel in RTL) */}
            {rightPanelOpen && (
              <div
                className={`w-80 ${isRTL ? 'border-e' : 'border-s'} bg-background/80 backdrop-blur-sm h-full p-4 overflow-auto shrink-0 ${isRTL ? 'animate-in slide-in-from-left-10' : 'animate-in slide-in-from-right-10'} shadow-lg z-10`}
              >
                <h3 className="font-semibold text-lg mb-4 text-natural">{t('common.inspector')}</h3>
                <div className="text-sm text-muted-foreground text-natural">
                  {t('common.selectItemDetails')}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
