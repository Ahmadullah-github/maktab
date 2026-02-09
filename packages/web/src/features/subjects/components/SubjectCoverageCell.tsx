/**
 * SubjectCoverageCell Component
 *
 * Displays coverage status in the subjects table with progress bar
 * and teacher names. Clickable to open assignment sheet.
 *
 * Phase 3.1 of Teacher Assignment System
 */

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Users, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SubjectAssignmentSummary } from '../hooks/useSubjectAssignments';

export interface SubjectCoverageCellProps {
  /** Assignment summary for this subject */
  summary: SubjectAssignmentSummary | null;
  /** Click handler to open assignment sheet */
  onClick?: () => void;
  /** Whether to show compact view */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get status color based on coverage percentage
 */
function getStatusColors(percentage: number): {
  bg: string;
  text: string;
  progress: string;
  icon: typeof CheckCircle2;
} {
  if (percentage === 100) {
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      progress: '[&>div]:bg-emerald-500',
      icon: CheckCircle2,
    };
  }
  if (percentage > 0) {
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      progress: '[&>div]:bg-amber-500',
      icon: AlertCircle,
    };
  }
  return {
    bg: 'bg-red-50',
    text: 'text-red-700',
    progress: '[&>div]:bg-red-500',
    icon: XCircle,
  };
}

export function SubjectCoverageCell({
  summary,
  onClick,
  compact = false,
  className,
}: SubjectCoverageCellProps) {
  const { t } = useTranslation();

  // No classes require this subject
  if (!summary || summary.totalClasses === 0) {
    return <div className={cn('text-xs text-muted-foreground text-center', className)}>—</div>;
  }

  const { coveragePercentage, assignedClasses, totalClasses, assignedTeachers } = summary;
  const colors = getStatusColors(coveragePercentage);
  const StatusIcon = colors.icon;

  // Compact view for table
  if (compact) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onClick}
              className={cn(
                'flex items-center gap-2 px-2 py-1 rounded-md transition-colors cursor-pointer',
                'hover:bg-slate-100',
                className
              )}
            >
              <StatusIcon className={cn('h-3.5 w-3.5', colors.text)} />
              <span className={cn('text-xs font-medium', colors.text)}>
                {assignedClasses}/{totalClasses}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs">{t('subjects.coverage.title', 'پوشش تدریس')}</span>
                <Badge variant="outline" className={cn('text-[10px]', colors.text)}>
                  {coveragePercentage}%
                </Badge>
              </div>
              <Progress value={coveragePercentage} className={cn('h-1.5', colors.progress)} />
              {assignedTeachers.length > 0 && (
                <div className="text-[10px] text-muted-foreground">
                  {assignedTeachers.map((t) => t.teacherName).join('، ')}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full view
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-2 rounded-lg border transition-colors cursor-pointer text-start',
        colors.bg,
        'border-slate-200 hover:border-violet-300',
        className
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <StatusIcon className={cn('h-3.5 w-3.5', colors.text)} />
          <span className={cn('text-xs font-medium', colors.text)}>
            {assignedClasses}/{totalClasses} {t('subjects.coverage.assigned', 'تخصیص یافته')}
          </span>
        </div>
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', colors.text)}>
          {coveragePercentage}%
        </Badge>
      </div>

      <Progress value={coveragePercentage} className={cn('h-1.5 mb-1.5', colors.progress)} />

      {assignedTeachers.length > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Users className="h-3 w-3" />
          <span className="truncate">
            {assignedTeachers
              .slice(0, 2)
              .map((t) => t.teacherName)
              .join('، ')}
            {assignedTeachers.length > 2 && ` +${assignedTeachers.length - 2}`}
          </span>
        </div>
      )}
    </button>
  );
}

export default SubjectCoverageCell;
