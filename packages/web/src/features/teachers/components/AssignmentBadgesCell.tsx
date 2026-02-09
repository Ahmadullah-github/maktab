/**
 * AssignmentBadgesCell Component
 *
 * Renders clickable assignment badges in the teachers table.
 * Shows class-subject assignments with an "Add" button.
 * Clicking a badge or the add button triggers callbacks for drawer navigation.
 *
 * Phase 1.1 of Teacher Assignment System
 * REAL-TIME FIX: Now uses useTeacherAssignments() for real-time updates
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { GraduationCap, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTeacherAssignments } from '../../teacher-assignments';
import type { Teacher } from '../types';

/**
 * Subject info for display
 */
interface SubjectInfo {
  id: number;
  name: string;
  periodsPerWeek?: number;
}

/**
 * Class info for display
 */
interface ClassInfo {
  id: number;
  name: string;
  grade?: number;
}

/**
 * Flattened assignment for display
 */
interface FlatAssignment {
  subjectId: number;
  subjectName: string;
  classId: number;
  className: string;
  periods: number;
}

export interface AssignmentBadgesCellProps {
  /** The teacher whose assignments to display */
  teacher: Teacher;
  /** Map of subject ID to subject info */
  subjectMap: Map<number, SubjectInfo>;
  /** Map of class ID to class info */
  classMap: Map<number, ClassInfo>;
  /** Maximum badges to display before showing "+N more" */
  maxDisplay?: number;
  /** Callback when a badge is clicked */
  onBadgeClick?: (teacher: Teacher, assignment: FlatAssignment) => void;
  /** Callback when the add button is clicked */
  onAddClick?: (teacher: Teacher) => void;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AssignmentBadgesCell displays teacher assignments as clickable badges
 */
export function AssignmentBadgesCell({
  teacher,
  subjectMap,
  classMap,
  maxDisplay = 3,
  onBadgeClick,
  onAddClick,
  compact = false,
  className,
}: AssignmentBadgesCellProps) {
  const { t } = useTranslation();

  // REAL-TIME FIX: Use useTeacherAssignments() for real-time updates
  const { data: allAssignments = [] } = useTeacherAssignments();

  // Flatten assignments into displayable format - REAL-TIME FIX
  const flatAssignments = useMemo((): FlatAssignment[] => {
    const result: FlatAssignment[] = [];

    // Filter assignments for this teacher from the assignments table
    const teacherAssignments = allAssignments.filter(
      (a) => a.teacherId === teacher.id && !a.isDeleted
    );

    teacherAssignments.forEach((assignment) => {
      const subject = subjectMap.get(assignment.subjectId);
      const cls = classMap.get(assignment.classId);

      if (!subject || !cls) return;

      result.push({
        subjectId: assignment.subjectId,
        subjectName: subject.name,
        classId: assignment.classId,
        className: cls.name,
        periods: assignment.periodsPerWeek || subject.periodsPerWeek || 0,
      });
    });

    return result;
  }, [allAssignments, teacher.id, subjectMap, classMap]);

  // Calculate total periods
  const totalPeriods = useMemo(() => {
    return flatAssignments.reduce((sum, a) => sum + a.periods, 0);
  }, [flatAssignments]);

  // Handle badge click
  const handleBadgeClick = (e: React.MouseEvent, assignment: FlatAssignment) => {
    e.stopPropagation();
    onBadgeClick?.(teacher, assignment);
  };

  // Handle add click
  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddClick?.(teacher);
  };

  // Empty state - no assignments
  if (flatAssignments.length === 0) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddClick}
          className={cn(
            'h-6 px-2 text-xs font-normal',
            'text-amber-600 hover:text-amber-700 hover:bg-amber-50',
            'border border-dashed border-amber-300 hover:border-amber-400'
          )}
        >
          <Plus className="h-3 w-3 me-1" />
          {t('teachers.assignments.clickToAssign', 'کلیک برای تخصیص')}
        </Button>
      </div>
    );
  }

  // Compact mode - just show count
  if (compact) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer"
                onClick={handleAddClick}
              >
                <GraduationCap className="h-3 w-3 me-1" />
                {flatAssignments.length} {t('teachers.assignments.classes', 'صنف')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px]">
              <div className="text-xs space-y-1">
                <div className="font-medium border-b pb-1 mb-1">
                  {t('teachers.assignments.title', 'تخصیص‌ها')} ({totalPeriods}{' '}
                  {t('common.periodsShort', 'ساعت')})
                </div>
                {flatAssignments.map((a, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span>{a.className}</span>
                    <span className="text-muted-foreground">
                      {a.subjectName} ({a.periods})
                    </span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  // Full mode - show badges
  const visibleAssignments = flatAssignments.slice(0, maxDisplay);
  const hiddenCount = flatAssignments.length - maxDisplay;

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {/* Visible assignment badges */}
      {visibleAssignments.map((assignment) => (
        <TooltipProvider key={`${assignment.classId}-${assignment.subjectId}`} delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className={cn(
                  'text-[10px] px-1.5 py-0 h-5 cursor-pointer transition-colors',
                  'bg-blue-50 text-blue-700 border border-blue-200',
                  'hover:bg-blue-100 hover:border-blue-300'
                )}
                onClick={(e) => handleBadgeClick(e, assignment)}
              >
                {assignment.className}
                <span className="ms-1 text-blue-500 font-normal">{assignment.subjectName}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="text-xs">
                <div className="font-medium">{assignment.className}</div>
                <div className="text-muted-foreground">
                  {assignment.subjectName} - {assignment.periods} {t('common.periodsShort', 'ساعت')}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}

      {/* Hidden count badge */}
      {hiddenCount > 0 && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-5 cursor-pointer hover:bg-slate-100"
                onClick={handleAddClick}
              >
                +{hiddenCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px]">
              <div className="text-xs space-y-1">
                <div className="font-medium border-b pb-1 mb-1">
                  {t('teachers.assignments.moreAssignments', 'تخصیص‌های بیشتر')}
                </div>
                {flatAssignments.slice(maxDisplay).map((a, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span>{a.className}</span>
                    <span className="text-muted-foreground">
                      {a.subjectName} ({a.periods})
                    </span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Add button */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddClick}
              className={cn(
                'h-5 w-5 p-0 rounded-md',
                'text-slate-400 hover:text-blue-600 hover:bg-blue-50',
                'border border-dashed border-slate-300 hover:border-blue-400'
              )}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <span className="text-xs">
              {t('teachers.assignments.addAssignment', 'افزودن تخصیص')}
            </span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Total periods indicator */}
      {totalPeriods > 0 && (
        <span className="text-[10px] text-muted-foreground ms-1">
          ({totalPeriods} {t('common.periodsShort', 'ساعت')})
        </span>
      )}
    </div>
  );
}

export default AssignmentBadgesCell;
