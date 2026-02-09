/**
 * ProblemSizeWarning Component
 * Context-aware banner showing how problem size affects constraint application
 * Color-coded: green (small), yellow (medium), orange (large)
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PresetId, ProblemSize } from '../types';
import { getProblemSizeInfo } from '../utils/problemSize';

const SIZE_CONFIG: Record<
  ProblemSize,
  {
    icon: React.ComponentType<{ className?: string }>;
    variant: 'default' | 'destructive';
    className: string;
    badgeClass: string;
  }
> = {
  small: {
    icon: CheckCircle2,
    variant: 'default',
    className: 'border-green-200 bg-green-50 text-green-900',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
  },
  medium: {
    icon: Info,
    variant: 'default',
    className: 'border-amber-200 bg-amber-50 text-amber-900',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  large: {
    icon: AlertCircle,
    variant: 'default',
    className: 'border-orange-200 bg-orange-50 text-orange-900',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
  },
};

export interface ProblemSizeWarningProps {
  /** Number of classes */
  classCount: number;
  /** Average subjects per class */
  subjectCount: number;
  /** Currently selected preset */
  selectedPreset?: PresetId;
  /** Callback when user clicks recommended preset */
  onSelectRecommendedPreset?: (presetId: PresetId) => void;
  /** Additional class names */
  className?: string;
}

export function ProblemSizeWarning({
  classCount,
  subjectCount,
  selectedPreset,
  onSelectRecommendedPreset,
  className,
}: ProblemSizeWarningProps) {
  const { t } = useTranslation();

  // Calculate request count internally for threshold logic
  const requestCount = classCount * subjectCount;
  const sizeInfo = useMemo(() => getProblemSizeInfo(requestCount), [requestCount]);
  const config = SIZE_CONFIG[sizeInfo.size];
  const Icon = config.icon;

  const showRecommendation =
    sizeInfo.size === 'large' && selectedPreset !== 'fast' && onSelectRecommendedPreset;

  return (
    <Alert className={cn(config.className, className)}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {t(`constraints.problemSize.${sizeInfo.size}.title`)}
        <Badge variant="outline" className={cn('font-mono text-xs', config.badgeClass)}>
          {classCount} {t('constraints.problemSize.classes')} × {subjectCount}{' '}
          {t('constraints.problemSize.subjects')}
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-1">
        <p>
          {t(`constraints.problemSize.${sizeInfo.size}.description`, {
            classCount,
            subjectCount,
          })}
        </p>

        {showRecommendation && (
          <button
            type="button"
            onClick={() => onSelectRecommendedPreset('fast')}
            className={cn(
              'mt-2 inline-flex items-center gap-1.5 text-sm font-medium',
              'text-orange-700 hover:text-orange-800 underline underline-offset-2',
              'transition-colors'
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            {t('constraints.problemSize.switchToFast')}
          </button>
        )}
      </AlertDescription>
    </Alert>
  );
}
