/**
 * ReadinessItem Component
 * Individual item in the readiness checklist showing entity count and status
 *
 * Features:
 * - Display icon, label, count with status indicator
 * - Green checkmark for count > 0, amber warning for count = 0
 * - Tooltip for warning state explaining the issue
 * - Clickable with navigation to management page
 * - Entrance animation
 *
 * Requirements: 3.5, 3.6, 3.7, 14.5
 */

import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ReadinessStatus } from '@/types/readiness';
import { getReadinessStatus } from '@/types/readiness';
import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  DoorOpen,
  GraduationCap,
  type LucideIcon,
  Users,
} from 'lucide-react';

/**
 * Icon mapping for readiness items
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Users: Users,
  GraduationCap: GraduationCap,
  BookOpen: BookOpen,
  DoorOpen: DoorOpen,
};

/**
 * Props for ReadinessItem component
 */
export interface ReadinessItemProps {
  /** Icon name from Lucide (Users, GraduationCap, BookOpen, DoorOpen) */
  icon: string;
  /** Persian label for the item */
  labelFa: string;
  /** Count of entities */
  count: number;
  /** Whether data is loading */
  isLoading: boolean;
  /** Navigation path when clicked */
  navigateTo: string;
  /** Whether this item is critical for generation */
  isCritical?: boolean;
  /** Warning message to show in tooltip when count is 0 */
  warningMessage?: string;
  /** Animation delay for staggered entrance */
  animationDelay?: number;
}

/**
 * Status indicator colors and icons
 */
const STATUS_CONFIG: Record<
  ReadinessStatus,
  { bgColor: string; textColor: string; icon: LucideIcon }
> = {
  ready: {
    bgColor: 'bg-green-100',
    textColor: 'text-green-600',
    icon: CheckCircle2,
  },
  warning: {
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-600',
    icon: AlertTriangle,
  },
  error: {
    bgColor: 'bg-red-100',
    textColor: 'text-red-600',
    icon: AlertTriangle,
  },
};

/**
 * ReadinessItem component for displaying entity readiness status
 *
 * Shows an icon, label, and count with visual status indicator.
 * Clickable to navigate to the entity management page.
 *
 * Requirements: 3.5, 3.6, 3.7, 14.5
 */
export function ReadinessItem({
  icon,
  labelFa,
  count,
  isLoading,
  navigateTo,
  isCritical = true,
  warningMessage,
  animationDelay = 0,
}: ReadinessItemProps) {
  const navigate = useNavigate();
  const Icon = ICON_MAP[icon] || Users;

  // Determine status based on count (Requirements: 3.5, 3.6)
  const status: ReadinessStatus = getReadinessStatus(count);
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  // Default warning message if not provided
  const tooltipMessage =
    warningMessage ||
    (status === 'warning'
      ? `هیچ ${labelFa.replace('‌ها', '')} ثبت نشده است. برای ادامه کلیک کنید.`
      : `${count} ${labelFa} ثبت شده`);

  // Handle click navigation (Requirement: 3.7)
  const handleClick = () => {
    navigate({ to: navigateTo });
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-2 p-3 min-w-[100px]">
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="w-16 h-4" />
        <Skeleton className="w-8 h-5" />
      </div>
    );
  }

  const itemContent = (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: animationDelay,
        ease: 'easeOut',
      }}
      onClick={handleClick}
      className={cn(
        'group flex min-w-0 flex-col items-center gap-2 rounded-xl border border-transparent p-3',
        'cursor-pointer transition-all duration-200',
        'hover:border-slate-200 hover:bg-white hover:shadow-sm',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        status === 'warning' && isCritical && 'border-amber-200 bg-amber-50/70'
      )}
      aria-label={`${labelFa}: ${count}`}
    >
      {/* Icon with status indicator */}
      <div className="relative">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:-translate-y-0.5',
            status === 'ready' ? 'bg-slate-100' : statusConfig.bgColor
          )}
        >
          <Icon
            className={cn('w-5 h-5', status === 'ready' ? 'text-gray-600' : statusConfig.textColor)}
          />
        </div>

        {/* Status badge */}
        <div
          className={cn(
            'absolute -top-1.5 -end-1.5 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white',
            statusConfig.bgColor
          )}
        >
          <StatusIcon className={cn('w-3 h-3', statusConfig.textColor)} />
        </div>
      </div>

      {/* Label */}
      <span className="text-xs font-medium text-slate-600 sm:text-sm">{labelFa}</span>

      {/* Count */}
      <span
        className={cn(
          'text-xl font-bold leading-none',
          status === 'ready' ? 'text-gray-900' : statusConfig.textColor
        )}
      >
        {count}
      </span>
    </motion.button>
  );

  // Wrap with tooltip for warning state (Requirement: 14.5)
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{itemContent}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px]">
          <p className="text-sm">{tooltipMessage}</p>
          {status === 'warning' && (
            <p className="text-xs text-muted-foreground mt-1">برای افزودن کلیک کنید</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
