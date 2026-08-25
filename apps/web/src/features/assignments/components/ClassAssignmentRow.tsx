/**
 * ClassAssignmentRow Component
 *
 * A single class row showing subject assignment cells.
 * Each cell represents a subject requirement and its assignment status.
 *
 * Requirements: Phase 3.2
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Subject } from '@/features/subjects/types';
import type { Teacher } from '@/features/teachers/types';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, User } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AssignmentCellSelection, ClassWithAssignmentStatus } from '../types';
import { AssignmentCell } from './AssignmentCell';

// ============================================================================
// Types
// ============================================================================

export interface ClassAssignmentRowProps {
  /** Class data with assignment status */
  classData: ClassWithAssignmentStatus;
  /** Cell click handler */
  onCellClick: (classId: number, subjectId: number) => void;
  /** Bulk select handler for this class */
  onBulkSelectClass: (cells: AssignmentCellSelection[]) => void;
  /** Get teacher by ID */
  getTeacherById: (id: number) => Teacher | undefined;
  /** Get subject by ID */
  getSubjectById: (id: number) => Subject | undefined;
  /** Compact mode when drawer is open */
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ClassAssignmentRow({
  classData,
  onCellClick,
  onBulkSelectClass,
  getTeacherById,
  getSubjectById,
  compact = false,
}: ClassAssignmentRowProps) {
  const { t } = useTranslation();

  // Handle bulk select for unassigned subjects
  const handleBulkSelect = useCallback(() => {
    const unassignedCells = classData.requirements
      .filter((r) => r.assignmentStatus === 'unassigned' || r.assignmentStatus === 'partial')
      .map((r) => ({
        classId: classData.classId,
        subjectId: r.subjectId,
        periodsPerWeek: r.periodsPerWeek,
      }));

    if (unassignedCells.length > 0) {
      onBulkSelectClass(unassignedCells);
    }
  }, [classData, onBulkSelectClass]);

  return (
    <div
      className={cn(
        'group flex items-stretch border rounded-lg bg-white hover:shadow-sm transition-shadow',
        classData.overallStatus === 'conflict' && 'border-red-200'
      )}
    >
      {/* Class Info Column */}
      <div
        className={cn(
          'flex items-center gap-3 p-3 border-e bg-slate-50/50',
          compact ? 'w-[140px]' : 'w-[180px]'
        )}
      >
        <div
          className={cn(
            'w-2 h-2 rounded-full shrink-0',
            classData.overallStatus === 'assigned' && 'bg-emerald-500',
            classData.overallStatus === 'unassigned' && 'bg-amber-500',
            classData.overallStatus === 'partial' && 'bg-blue-500',
            classData.overallStatus === 'conflict' && 'bg-red-500'
          )}
        />

        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-800 truncate">{classData.displayName}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-slate-500">
              {classData.stats.assigned}/{classData.stats.total}
            </span>
            {classData.singleTeacherMode && (
              <Tooltip>
                <TooltipTrigger>
                  <User className="w-3 h-3 text-slate-400" />
                </TooltipTrigger>
                <TooltipContent>
                  {t('assignments.singleTeacherMode', 'حالت معلم واحد')}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Subject Cells */}
      <div className="flex-1 flex items-center gap-1 p-2 overflow-x-auto">
        {classData.requirements.map((requirement) => {
          const subject = getSubjectById(requirement.subjectId);
          const teacher = requirement.teacherId ? getTeacherById(requirement.teacherId) : undefined;

          return (
            <AssignmentCell
              key={requirement.subjectId}
              requirement={requirement}
              subject={subject}
              teacher={teacher}
              onClick={() => onCellClick(classData.classId, requirement.subjectId)}
              compact={compact}
            />
          );
        })}

        {classData.requirements.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400 py-2">
            {t('assignments.noSubjects', 'مضمونی تعریف نشده')}
          </div>
        )}
      </div>

      {/* Actions Column */}
      <div className="flex items-center gap-2 p-2 border-s bg-slate-50/50">
        {classData.stats.unassigned + classData.stats.partial > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleBulkSelect}
          >
            {t('assignments.assignRemaining', 'تخصیص باقی‌مانده')}
            <Badge variant="secondary" className="ms-1.5 h-4 px-1 text-[10px]">
              {classData.stats.unassigned + classData.stats.partial}
            </Badge>
          </Button>
        )}

        {classData.stats.conflict > 0 && (
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-medium">{classData.stats.conflict}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {t('assignments.conflictCount', '{{count}} تعارض', {
                count: classData.stats.conflict,
              })}
            </TooltipContent>
          </Tooltip>
        )}

        {classData.overallStatus === 'assigned' && (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        )}
      </div>
    </div>
  );
}

export default ClassAssignmentRow;
