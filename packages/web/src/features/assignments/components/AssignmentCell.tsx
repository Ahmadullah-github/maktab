/**
 * AssignmentCell Component
 *
 * A single cell representing a subject assignment for a class.
 * Shows assignment status with color coding and teacher info on hover.
 *
 * Requirements: Phase 3.2
 */

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Subject } from '@/features/subjects/types';
import type { Teacher } from '@/features/teachers/types';
import { cn } from '@/lib/utils';
import { AlertTriangle, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { EnhancedSubjectRequirement } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface AssignmentCellProps {
  /** Subject requirement with assignment status */
  requirement: EnhancedSubjectRequirement;
  /** Subject data */
  subject?: Subject;
  /** Assigned teacher (if any) */
  teacher?: Teacher;
  /** Click handler */
  onClick: () => void;
  /** Compact mode */
  compact?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get initials from a full name (supports Farsi/Arabic names)
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0);
  }
  return parts[0].charAt(0) + parts[parts.length - 1].charAt(0);
}

// ============================================================================
// Component
// ============================================================================

export function AssignmentCell({
  requirement,
  subject,
  teacher,
  onClick,
  compact = false,
}: AssignmentCellProps) {
  const { t } = useTranslation();

  const isAssigned = requirement.assignmentStatus === 'assigned';
  const isConflict = requirement.assignmentStatus === 'conflict';
  const isUnassigned = requirement.assignmentStatus === 'unassigned';

  // Cell styling based on status
  const cellStyles = cn(
    'relative flex items-center justify-center rounded-md cursor-pointer transition-all',
    'border-2 hover:scale-105 hover:shadow-md',
    compact ? 'w-10 h-10' : 'w-12 h-12',
    // Status-based colors
    isAssigned && 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
    isUnassigned && 'bg-amber-50 border-amber-200 hover:border-amber-400 border-dashed',
    isConflict && 'bg-red-50 border-red-300 hover:border-red-500'
  );

  // Tooltip content
  const tooltipContent = (
    <div className="space-y-1.5 text-sm">
      <div className="font-medium">{subject?.name || t('common.unknown', 'نامشخص')}</div>
      <div className="text-xs text-slate-400">
        {t('assignments.periodsPerWeek', '{{count}} ساعت در هفته', {
          count: requirement.periodsPerWeek,
        })}
      </div>
      <div className="border-t pt-1.5 mt-1.5">
        {isAssigned && teacher && (
          <div className="flex items-center gap-1.5 text-emerald-600">
            <User className="w-3 h-3" />
            <span>{teacher.fullName}</span>
          </div>
        )}
        {isUnassigned && (
          <div className="text-amber-600">{t('assignments.clickToAssign', 'کلیک برای تخصیص')}</div>
        )}
        {isConflict && (
          <div className="text-red-600 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" />
            {teacher
              ? t('assignments.teacherConflict', 'تعارض با معلم')
              : t('assignments.missingTeacher', 'معلم حذف شده')}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={cellStyles} onClick={onClick}>
            {/* Assigned: Show teacher initials */}
            {isAssigned && teacher && (
              <span className="text-xs font-medium text-emerald-700">
                {getInitials(teacher.fullName)}
              </span>
            )}

            {/* Unassigned: Show subject abbreviation (same style as assigned but different color) */}
            {isUnassigned && subject && (
              <span className="text-xs font-medium text-amber-600">
                {subject.code || subject.name.substring(0, 2)}
              </span>
            )}

            {/* Conflict: Show warning icon */}
            {isConflict && <AlertTriangle className="w-4 h-4 text-red-500" />}

            {/* Subject abbreviation badge - only show for assigned cells since unassigned shows subject in center */}
            {subject && isAssigned && (
              <span
                className={cn(
                  'absolute -top-1 -end-1 text-[8px] font-medium px-1 rounded',
                  'bg-slate-100 text-slate-600 border border-slate-200'
                )}
              >
                {subject.code || subject.name.substring(0, 2)}
              </span>
            )}

            {/* Periods indicator */}
            <span
              className={cn(
                'absolute -bottom-1 text-[8px] font-medium px-1 rounded',
                isAssigned && 'bg-emerald-100 text-emerald-700',
                isUnassigned && 'bg-amber-100 text-amber-700',
                isConflict && 'bg-red-100 text-red-700'
              )}
            >
              {requirement.periodsPerWeek}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default AssignmentCell;
