import { Button } from '@/components/ui/button';
import { NumberText } from '@/components/ui/DirectionalText';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useDirection } from '@/hooks/useDirection';
import { useUIStore } from '@/stores/uiStore';
import { Bell, Menu, User, Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Header = () => {
  const { t } = useTranslation();
  const { toggleSidebar, theme } = useUIStore();
  const { isRTL } = useDirection();

  // Mock state for demo
  const isOnline = true;
  const licenseStatus = {
    plan: t('header.enterprise'),
    daysLeft: 342,
    percentage: 85,
  };

  return (
    <header className="h-16 border-b bg-background px-4 flex items-center justify-between shrink-0 z-20 relative">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="shrink-0">
          <Menu className="h-5 w-5" />
        </Button>

        {/* Branding */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-xl">
            M
          </div>
          <span className="font-bold text-lg hidden sm:inline-block">Maktab</span>
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        {/* License Widget */}
        <div className="hidden md:flex items-center gap-3 bg-muted/30 px-3 py-1.5 rounded-full border border-border/50">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-natural">
            {licenseStatus.plan}
          </span>
          <div className="h-2 w-24 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-green-400 via-emerald-500 to-teal-500 animate-pulse"
              style={{ width: `${licenseStatus.percentage}%` }}
            />
          </div>
          <span className="text-xs font-medium whitespace-nowrap">
            <NumberText>{licenseStatus.daysLeft}</NumberText> {t('header.days')}
          </span>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              isOnline ? 'text-green-600 bg-green-500/10' : 'text-slate-500 bg-slate-500/10'
            }`}
          >
            {isOnline ? (
              <Wifi className="h-3.5 w-3.5 icon-no-flip" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 icon-no-flip" />
            )}
            <span className="hidden sm:inline text-natural">
              {isOnline ? t('header.online') : t('header.offline')}
            </span>
          </div>
        </div>

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Actions */}
        <div
          className={`flex items-center gap-2 ${isRTL ? 'border-e pe-4 sm:pe-6' : 'border-s ps-4 sm:ps-6'}`}
        >
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Bell className="h-5 w-5 icon-no-flip" />
          </Button>

          <div className="flex items-center gap-3">
            <div className={`${isRTL ? 'text-start' : 'text-end'} hidden sm:block`}>
              <div className="text-sm font-medium leading-none text-natural">Ahmad Admin</div>
              <div className="text-xs text-muted-foreground mt-1 text-natural">
                {t('header.administrator')}
              </div>
            </div>
            <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <User className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
