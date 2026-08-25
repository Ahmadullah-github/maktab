/**
 * CompatibilityBadge Component
 *
 * Phase 1.4: Shared UI Components
 *
 * Displays teacher-subject compatibility level with consistent styling.
 * - Primary: Teacher's main subject (green)
 * - Allowed: Teacher can teach this subject (blue)
 * - Incompatible: Teacher cannot teach this subject (red)
 */

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TeacherCompatibilityLevel } from '../../types';

export interface CompatibilityBadgeProps {
  /** Compatibility level */
  compatibility: TeacherCompatibilityLevel;
  /** Show icon only (no text) */
  iconOnly?: boolean;
  /** Show tooltip with explanation */
  showTooltip?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

const COMPATIBILITY_CONFIG: Record<
  TeacherCompatibilityLevel,
  {
    label: string;
    labelFa: string;
    description: string;
    descriptionFa: string;
    icon: React.ReactNode;
    bgColor: string;
    textColor: string;
    borderColor: string;
  }
> = {
  primary: {
    label: 'Primary',
    labelFa: 'اصلی',
    description: "This is the teacher's primary subject",
    descriptionFa: 'این مضمون اصلی معلم است',
    icon: <CheckCircle className="w-3 h-3" />,
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
  },
  allowed: {
    label: 'Allowed',
    labelFa: 'مجاز',
    description: 'Teacher can teach this subject',
    descriptionFa: 'معلم می‌تواند این مضمون را تدریس کند',
    icon: <Circle className="w-3 h-3" />,
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
  },
  incompatible: {
    label: 'Not Assigned',
    labelFa: 'تخصیص نشده',
    description: 'Subject not in teacher capabilities (will be auto-added on assignment)',
    descriptionFa: 'مضمون در لیست معلم نیست (با تخصیص اضافه می‌شود)',
    icon: <AlertTriangle className="w-3 h-3" />,
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
};

export function CompatibilityBadge({
  compatibility,
  iconOnly = false,
  showTooltip = true,
  size = 'sm',
  className,
}: CompatibilityBadgeProps) {
  const { i18n } = useTranslation();
  const config = COMPATIBILITY_CONFIG[compatibility];
  const isFarsi = i18n.language === 'fa';

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 shrink-0',
        config.bgColor,
        config.textColor,
        config.borderColor,
        size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1',
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

export default CompatibilityBadge;
