/**
 * GradeGroupSection Component
 *
 * Collapsible section for a grade tier (Alpha-Primary, Beta-Primary, Middle, High).
 * Contains ClassAssignmentRow components for each class in the group.
 *
 * Requirements: Phase 3.2, 3.3
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Subject } from '@/features/subjects/types';
import type { Teacher } from '@/features/teachers/types';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ChevronDown, Circle } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AssignmentCellSelection, GradeGroup } from '../types';
import { ClassAssignmentRow } from './ClassAssignmentRow';
import { SubjectColumnHeader } from './SubjectColumnHeader';

// ============================================================================
// Types
// ============================================================================

export interface GradeGroupSectionProps {
  /** Grade group data */
  group: GradeGroup;
  /** Whether the section is expanded */
  isExpanded: boolean;
  /** Toggle expand/collapse */
  onToggle: () => void;
  /** Cell click handler */
  onCellClick: (classId: number, subjectId: number) => void;
  /** Bulk select handler */
  onBulkSelect: (cells: AssignmentCellSelection[]) => void;
  /** All subjects for column headers */
  subjects: Subject[];
  /** All teachers for assignment display */
  teachers: Teacher[];
  /** Get teacher by ID */
  getTeacherById: (id: number) => Teacher | undefined;
  /** Get subject by ID */
  getSubjectById: (id: number) => Subject | undefined;
  /** Compact mode when drawer is open */
  compact?: boolean;
  /** Show subject column headers */
  showColumnHeaders?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function GradeGroupSection({
  group,
  isExpanded,
  onToggle,
  onCellClick,
  onBulkSelect,
  subjects,
  teachers,
  getTeacherById,
  getSubjectById,
  compact = false,
  showColumnHeaders = false,
}: GradeGroupSectionProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';

  // Suppress unused warnings - teachers passed for future enhancements
  void teachers;

  // Calculate active subject IDs (subjects used by classes in this group)
  const activeSubjectIds = useMemo(() => {
    const ids = new Set<number>();
    for (const classData of group.classes) {
      for (const req of classData.requirements) {
        ids.add(req.subjectId);
      }
    }
    return ids;
  }, [group.classes]);

  // Status icon based on completion
  const StatusIcon =
    group.stats.completionPercentage === 100
      ? CheckCircle2
      : group.stats.conflictCount > 0
        ? AlertTriangle
        : Circle;

  const statusColor =
    group.stats.completionPercentage === 100
      ? 'text-emerald-600'
      : group.stats.conflictCount > 0
        ? 'text-red-600'
        : 'text-amber-600';

  // Handle bulk select all unassigned in this grade group
  const handleBulkSelectAll = useCallback(() => {
    const allUnassigned: AssignmentCellSelection[] = [];

    for (const classData of group.classes) {
      for (const req of classData.requirements) {
        if (req.assignmentStatus === 'unassigned') {
          allUnassigned.push({
            classId: classData.classId,
            subjectId: req.subjectId,
            periodsPerWeek: req.periodsPerWeek,
          });
        }
      }
    }

    if (allUnassigned.length > 0) {
      onBulkSelect(allUnassigned);
    }
  }, [group.classes, onBulkSelect]);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChevronDown
                  className={cn(
                    'w-5 h-5 text-slate-400 transition-transform duration-200',
                    isExpanded && 'rotate-180'
                  )}
                />
                <div>
                  <h3 className="font-semibold text-slate-800">
                    {isRTL ? group.labelFa : group.label}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('assignments.gradeGroup.classCount', '{{count}} صنف', {
                      count: group.classes.length,
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Bulk Assign Button */}
                {group.stats.unassignedCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBulkSelectAll();
                    }}
                  >
                    {t('assignments.assignAll', 'تخصیص همه')}
                    <Badge variant="secondary" className="ms-1.5 h-4 px-1 text-[10px]">
                      {group.stats.unassignedCount}
                    </Badge>
                  </Button>
                )}

                {/* Progress Badge */}
                <Badge
                  variant="secondary"
                  className={cn(
                    'gap-1.5',
                    group.stats.completionPercentage === 100 && 'bg-emerald-50 text-emerald-700',
                    group.stats.conflictCount > 0 && 'bg-red-50 text-red-700'
                  )}
                >
                  <StatusIcon className={cn('w-3.5 h-3.5', statusColor)} />
                  {group.stats.completionPercentage}%
                </Badge>

                {/* Stats Summary */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="text-emerald-600">{group.stats.assignedCount}</span>
                  <span>/</span>
                  <span>{group.stats.totalRequirements}</span>
                  {group.stats.conflictCount > 0 && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span className="text-red-600 flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        {group.stats.conflictCount}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {group.classes.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                {t('assignments.gradeGroup.noClasses', 'هیچ صنفی در این گروه نیست')}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Subject Column Headers */}
                {showColumnHeaders && (
                  <SubjectColumnHeader
                    subjects={subjects}
                    activeSubjectIds={activeSubjectIds}
                    compact={compact}
                    classColumnWidth={compact ? 140 : 180}
                  />
                )}

                {/* Class Rows */}
                {group.classes.map((classData) => (
                  <ClassAssignmentRow
                    key={classData.classId}
                    classData={classData}
                    onCellClick={onCellClick}
                    onBulkSelectClass={onBulkSelect}
                    getTeacherById={getTeacherById}
                    getSubjectById={getSubjectById}
                    compact={compact}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default GradeGroupSection;
