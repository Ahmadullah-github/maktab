/**
 * License Banner - displays license status at top of app
 *
 * Requirements: License System
 * - Info banner: Trial active (dismissible)
 * - Warning banner: License expiring soon / grace period
 * - Blocking banner: Trial expired (not dismissible)
 * - Readonly banner: License expired (not dismissible)
 */

import { Button } from '@/components/ui/button';
import { useLicense } from '@/hooks/useLicense';
import { cn } from '@/lib/utils';
import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, Clock, ExternalLink, Lock, ShieldAlert, X } from 'lucide-react';

export function LicenseBanner() {
  const { status, isLoading, shouldShowBanner, bannerType, daysRemaining, dismissBanner, mode } =
    useLicense();
  const navigate = useNavigate();

  // Don't show while loading
  if (isLoading) return null;

  // Don't show if banner shouldn't be displayed
  if (!shouldShowBanner || !bannerType) return null;

  const handleActivate = () => {
    // Navigate to license/activation page
    navigate({ to: '/settings' });
  };

  // Banner configurations based on type
  const bannerConfig = {
    info: {
      icon: Clock,
      bgClass: 'bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800',
      textClass: 'text-blue-800 dark:text-blue-200',
      iconClass: 'text-blue-500',
      dismissible: true,
    },
    warning: {
      icon: AlertTriangle,
      bgClass: 'bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800',
      textClass: 'text-amber-800 dark:text-amber-200',
      iconClass: 'text-amber-500',
      dismissible: false,
    },
    blocking: {
      icon: ShieldAlert,
      bgClass: 'bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800',
      textClass: 'text-red-800 dark:text-red-200',
      iconClass: 'text-red-500',
      dismissible: false,
    },
    readonly: {
      icon: Lock,
      bgClass: 'bg-gray-100 border-gray-300 dark:bg-gray-900 dark:border-gray-700',
      textClass: 'text-gray-800 dark:text-gray-200',
      iconClass: 'text-gray-500',
      dismissible: false,
    },
  };

  const config = bannerConfig[bannerType];
  const Icon = config.icon;

  // Get message based on mode
  const getMessage = () => {
    switch (mode) {
      case 'trial':
        return `دوره آزمایشی: ${daysRemaining} روز باقی‌مانده`;
      case 'trial_expired':
        return 'دوره آزمایشی به پایان رسیده است. برای تولید جدول زمانی، لایسنس فعال کنید.';
      case 'licensed':
        return `لایسنس فعال - ${daysRemaining} روز باقی‌مانده`;
      case 'grace_period':
        return `لایسنس منقضی شده! ${daysRemaining} روز مهلت تمدید باقی‌مانده`;
      case 'license_expired':
        return 'لایسنس شما منقضی شده است. برنامه در حالت فقط خواندنی است.';
      default:
        return status?.message || '';
    }
  };

  // Get action button text
  const getActionText = () => {
    switch (mode) {
      case 'trial':
      case 'trial_expired':
        return 'فعال‌سازی لایسنس';
      case 'grace_period':
      case 'license_expired':
        return 'تمدید لایسنس';
      case 'licensed':
        return daysRemaining <= 30 ? 'تمدید لایسنس' : null;
      default:
        return null;
    }
  };

  const actionText = getActionText();

  return (
    <div
      className={cn(
        'w-full border-b px-4 py-2 flex items-center justify-between gap-4',
        'animate-in slide-in-from-top-2 duration-300',
        config.bgClass
      )}
      dir="rtl"
    >
      <div className="flex items-center gap-3 flex-1">
        <Icon className={cn('h-5 w-5 shrink-0', config.iconClass)} />
        <span className={cn('text-sm font-medium', config.textClass)}>{getMessage()}</span>
      </div>

      <div className="flex items-center gap-2">
        {actionText && (
          <Button
            variant={bannerType === 'blocking' || bannerType === 'readonly' ? 'default' : 'outline'}
            size="sm"
            onClick={handleActivate}
            className="gap-1.5"
          >
            {actionText}
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}

        {config.dismissible && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={dismissBanner}>
            <X className="h-4 w-4" />
            <span className="sr-only">بستن</span>
          </Button>
        )}
      </div>
    </div>
  );
}
