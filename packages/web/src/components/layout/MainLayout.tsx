import { LicenseBanner } from '@/components/license';
import { useDirection } from '@/hooks/useDirection';
import { useLicense } from '@/hooks/useLicense';
import { useUIStore } from '@/stores/uiStore';
import { Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export const MainLayout = () => {
  const { t } = useTranslation();
  const { rightPanelOpen } = useUIStore();
  const { isRTL } = useDirection();

  // Initialize license status on app load
  useLicense();

  return (
    <div className="flex flex-col h-screen w-full bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-primary-light/40 via-background to-background overflow-hidden">
      {/* License Banner - shows at top when needed */}
      <LicenseBanner />

      <Header />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

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
