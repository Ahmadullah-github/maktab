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
import { AlertTriangle, Clock, ExternalLink, ShieldAlert, X } from 'lucide-react';

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
  };

  const config = bannerConfig[bannerType];
  const Icon = config.icon;

  // Get message based on mode
  const getMessage = () => {
    switch (mode) {
      case 'active':
        return `لایسنس فعال - ${daysRemaining} روز باقی‌مانده`;
      case 'renewal_due':
        return `لایسنس فعال است و ${daysRemaining} روز تا تمدید باقی مانده است.`;
      case 'grace':
        return `لایسنس منقضی شده! ${daysRemaining} روز مهلت تمدید باقی‌مانده`;
      case 'expired':
        return 'لایسنس منقضی شده است. فقط تولید جدول جدید غیرفعال است؛ اطلاعات شما قابل ویرایش و پشتیبان‌گیری است.';
      default:
        return status?.message || '';
    }
  };

  // Get action button text
  const getActionText = () => {
    switch (mode) {
      case 'unactivated':
        return 'فعال‌سازی لایسنس';
      case 'renewal_due':
      case 'grace':
      case 'expired':
        return 'تمدید لایسنس';
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
            variant={bannerType === 'blocking' ? 'default' : 'outline'}
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
