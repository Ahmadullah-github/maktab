/**
 * AssignmentStatusBadge Component
 *
 * Phase 1.4: Shared UI Components
 *
 * Displays assignment status with consistent styling across all views.
 * - Assigned: Green - teacher is assigned
 * - Unassigned: Amber - no teacher assigned
 * - Partial: Blue - some assignments complete
 * - Conflict: Red - has conflicts
 */

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Circle, MinusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AssignmentStatus } from '../../types';

export interface AssignmentStatusBadgeProps {
  /** Assignment status */
  status: AssignmentStatus;
  /** Show icon only (no text) */
  iconOnly?: boolean;
  /** Show tooltip with explanation */
  showTooltip?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show as dot indicator only */
  dot?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const STATUS_CONFIG: Record<
  AssignmentStatus,
  {
    label: string;
    labelFa: string;
    description: string;
    descriptionFa: string;
    icon: React.ReactNode;
    bgColor: string;
    textColor: string;
    borderColor: string;
    dotColor: string;
  }
> = {
  assigned: {
    label: 'Assigned',
    labelFa: 'تخصیص یافته',
    description: 'Teacher has been assigned',
    descriptionFa: 'معلم تخصیص یافته است',
    icon: <CheckCircle2 className="w-3 h-3" />,
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
  },
  unassigned: {
    label: 'Unassigned',
    labelFa: 'بدون تخصیص',
    description: 'No teacher assigned yet',
    descriptionFa: 'هنوز معلمی تخصیص نیافته',
    icon: <Circle className="w-3 h-3" />,
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    dotColor: 'bg-amber-500',
  },
  partial: {
    label: 'Partial',
    labelFa: 'ناقص',
    description: 'Some assignments are incomplete',
    descriptionFa: 'برخی تخصیص‌ها ناقص است',
    icon: <MinusCircle className="w-3 h-3" />,
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    dotColor: 'bg-blue-500',
  },
  conflict: {
    label: 'Conflict',
    labelFa: 'تعارض',
    description: 'Assignment has conflicts',
    descriptionFa: 'تخصیص دارای تعارض است',
    icon: <AlertTriangle className="w-3 h-3" />,
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
    dotColor: 'bg-red-500',
  },
};

export function AssignmentStatusBadge({
  status,
  iconOnly = false,
  showTooltip = true,
  size = 'sm',
  dot = false,
  className,
}: AssignmentStatusBadgeProps) {
  const { i18n } = useTranslation();
  const config = STATUS_CONFIG[status];
  const isFarsi = i18n.language === 'fa';

  // Dot indicator mode
  if (dot) {
    const dotElement = (
      <span
        className={cn(
          'rounded-full shrink-0',
          config.dotColor,
          size === 'sm' && 'w-2 h-2',
          size === 'md' && 'w-2.5 h-2.5',
          size === 'lg' && 'w-3 h-3',
          className
        )}
      />
    );

    if (!showTooltip) {
      return dotElement;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{dotElement}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <span className="font-medium">{isFarsi ? config.labelFa : config.label}</span>
          <span className="text-muted-foreground ms-1">
            - {isFarsi ? config.descriptionFa : config.description}
          </span>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Badge mode
  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 shrink-0',
        config.bgColor,
        config.textColor,
        config.borderColor,
        size === 'sm' && 'text-[10px] px-1.5 py-0.5',
        size === 'md' && 'text-xs px-2 py-1',
        size === 'lg' && 'text-sm px-2.5 py-1',
        iconOnly && 'px-1',
        className
      )}
    >
      {config.icon}
      {!iconOnly && (isFarsi ? config.labelFa : config.label)}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {isFarsi ? config.descriptionFa : config.description}
      </TooltipContent>
    </Tooltip>
  );
}

export default AssignmentStatusBadge;
