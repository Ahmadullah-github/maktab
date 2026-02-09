/**
 * AssignmentDrawer Component
 *
 * Side panel for assignment operations:
 * - Single assignment (one class + one subject)
 * - Bulk assignment (multiple class-subject combinations)
 * - View assignment details
 * - Teacher selection with workload preview
 * - Unassign functionality
 *
 * Requirements: Phase 3.4
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ClassGroup } from '@/features/classes/types';
import type { Subject } from '@/features/subjects/types';
import { useTeacherAssignments } from '@/features/teacher-assignments/hooks';
import type { TeacherClassSubjectAssignment } from '@/features/teacher-assignments/types';
import { WorkloadProgressHeader } from '@/features/teachers/components/WorkloadProgressHeader';
import type { Teacher } from '@/features/teachers/types';
import { cn } from '@/lib/utils';
import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Search,
  Star,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAssignmentMutations } from '../hooks/useAssignmentMutations';
import { determineWorkloadStatus } from '../services/workloadCalculation';
import type { AssignmentCellSelection, AssignmentDrawerMode } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface AssignmentDrawerProps {
  /** Current drawer mode */
  mode: AssignmentDrawerMode;
  /** Target class ID (for single assignment) */
  classId: number | null;
  /** Target subject ID (for single assignment) */
  subjectId: number | null;
  /** Selected cells (for bulk assignment) */
  selectedCells: AssignmentCellSelection[];
  /** Close drawer handler */
  onClose: () => void;
  /** All teachers */
  teachers: Teacher[];
  /** All subjects */
  subjects: Subject[];
  /** All classes */
  classes: ClassGroup[];
  /** Get teacher by ID */
  getTeacherById: (id: number) => Teacher | undefined;
  /** Get subject by ID */
  getSubjectById: (id: number) => Subject | undefined;
  /** Get class by ID */
  getClassById: (id: number) => ClassGroup | undefined;
  /** Additional class names */
  className?: string;
}

interface TeacherOption {
  teacher: Teacher;
  isPrimary: boolean;
  isAllowed: boolean;
  currentWorkload: number;
  projectedWorkload: number;
  maxWorkload: number;
  utilizationPercent: number;
  projectedUtilization: number;
  canAccept: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate teacher's current workload from real-time TeacherClassSubjectAssignment records
 * This uses the actual assignment data instead of stale teacher.classAssignments
 */
function calculateTeacherWorkloadFromAssignments(
  teacherId: number,
  assignments: TeacherClassSubjectAssignment[]
): number {
  return assignments
    .filter((a) => a.teacherId === teacherId)
    .reduce((sum, a) => sum + a.periodsPerWeek, 0);
}

/**
 * Get initials from a full name
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

export function AssignmentDrawer({
  mode,
  classId,
  subjectId,
  selectedCells,
  onClose,
  teachers,
  subjects,
  classes,
  getTeacherById,
  getSubjectById,
  getClassById,
  className,
}: AssignmentDrawerProps) {
  const { t } = useTranslation();
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'eligible' | 'all'>('eligible');

  const { assignTeacher, unassignTeacher, isLoading } = useAssignmentMutations();

  // Fetch real-time assignment data for accurate workload calculation
  const { data: allAssignments = [] } = useTeacherAssignments();

  // Get target data for single assignment
  const targetClass = classId ? getClassById(classId) : null;
  const targetSubject = subjectId ? getSubjectById(subjectId) : null;

  // Suppress unused - these are used in calculateTeacherWorkloadFromAssignments
  void subjects;
  void classes;

  // Get current assignment for single mode
  const currentAssignment = useMemo(() => {
    if (!targetClass || !subjectId) return null;
    const requirement = targetClass.subjectRequirements?.find((r) => r.subjectId === subjectId);
    if (!requirement?.teacherId) return null;
    return getTeacherById(requirement.teacherId);
  }, [targetClass, subjectId, getTeacherById]);

  // Calculate periods to add
  const periodsToAdd = useMemo(() => {
    if (mode === 'assign' && targetClass && subjectId) {
      const requirement = targetClass.subjectRequirements?.find((r) => r.subjectId === subjectId);
      return requirement?.periodsPerWeek || 4;
    }
    if (mode === 'bulk-assign') {
      return selectedCells.reduce((sum, cell) => sum + (cell.periodsPerWeek || 4), 0);
    }
    return 0;
  }, [mode, targetClass, subjectId, selectedCells]);

  // Build teacher options with workload calculations using real-time assignment data
  const teacherOptions = useMemo((): TeacherOption[] => {
    const targetSubjectId = subjectId || selectedCells[0]?.subjectId;
    if (!targetSubjectId) return [];

    return teachers
      .filter((teacher) => !teacher.isDeleted)
      .map((teacher) => {
        const isPrimary = teacher.primarySubjectIds?.includes(targetSubjectId) || false;
        const isAllowed =
          !teacher.restrictToPrimarySubjects &&
          (teacher.allowedSubjectIds?.includes(targetSubjectId) || false);
        const canTeach = isPrimary || isAllowed;

        // Use real-time assignment data for accurate workload calculation
        const currentWorkload = calculateTeacherWorkloadFromAssignments(teacher.id, allAssignments);
        const maxWorkload = teacher.maxPeriodsPerWeek || 30;
        const projectedWorkload = currentWorkload + periodsToAdd;
        const utilizationPercent = Math.round((currentWorkload / maxWorkload) * 100);
        const projectedUtilization = Math.round((projectedWorkload / maxWorkload) * 100);
        // canAccept is ONLY about workload capacity, not subject eligibility
        const hasWorkloadCapacity = projectedWorkload <= maxWorkload;

        return {
          teacher,
          isPrimary,
          isAllowed,
          currentWorkload,
          projectedWorkload,
          maxWorkload,
          utilizationPercent,
          projectedUtilization,
          // canAccept combines both: can teach the subject AND has workload capacity
          canAccept: canTeach && hasWorkloadCapacity,
        };
      })
      .sort((a, b) => {
        // Sort: primary first, then allowed, then by utilization
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        if (a.isAllowed !== b.isAllowed) return a.isAllowed ? -1 : 1;
        return a.utilizationPercent - b.utilizationPercent;
      });
  }, [teachers, subjectId, selectedCells, periodsToAdd, allAssignments]);

  // Filter teachers based on tab and search
  const filteredTeachers = useMemo(() => {
    let filtered = teacherOptions;

    // Filter by tab
    if (activeTab === 'eligible') {
      filtered = filtered.filter((opt) => opt.isPrimary || opt.isAllowed);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((opt) => opt.teacher.fullName.toLowerCase().includes(query));
    }

    return filtered;
  }, [teacherOptions, activeTab, searchQuery]);

  // Selected teacher option
  const selectedOption = useMemo(() => {
    if (!selectedTeacherId) return null;
    return teacherOptions.find((opt) => opt.teacher.id === selectedTeacherId);
  }, [teacherOptions, selectedTeacherId]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleAssign = useCallback(async () => {
    if (!selectedTeacherId) return;

    if (mode === 'assign' && classId && subjectId) {
      const requirement = targetClass?.subjectRequirements?.find((r) => r.subjectId === subjectId);

      await assignTeacher.mutateAsync({
        teacherId: selectedTeacherId,
        subjectId,
        classIds: [classId],
        periodsPerWeek: requirement?.periodsPerWeek || 4,
      });

      onClose();
    } else if (mode === 'bulk-assign' && selectedCells.length > 0) {
      // Group by subject for bulk assignment
      const bySubject = new Map<number, { classIds: number[]; periodsPerWeek: number }>();

      for (const cell of selectedCells) {
        if (!bySubject.has(cell.subjectId)) {
          bySubject.set(cell.subjectId, {
            classIds: [],
            periodsPerWeek: cell.periodsPerWeek || 4,
          });
        }
        bySubject.get(cell.subjectId)!.classIds.push(cell.classId);
      }

      // Assign each subject group
      for (const [subjId, data] of bySubject) {
        await assignTeacher.mutateAsync({
          teacherId: selectedTeacherId,
          subjectId: subjId,
          classIds: data.classIds,
          periodsPerWeek: data.periodsPerWeek,
        });
      }

      onClose();
    }
  }, [
    selectedTeacherId,
    mode,
    classId,
    subjectId,
    targetClass,
    selectedCells,
    assignTeacher,
    onClose,
  ]);

  const handleUnassign = useCallback(async () => {
    if (!currentAssignment || !classId || !subjectId) return;

    await unassignTeacher.mutateAsync({
      teacherId: currentAssignment.id,
      subjectId,
      classIds: [classId],
    });

    onClose();
  }, [currentAssignment, classId, subjectId, unassignTeacher, onClose]);

  // ============================================================================
  // Render
  // ============================================================================

  const title =
    mode === 'assign'
      ? t('assignments.drawer.assignTitle', 'تخصیص معلم')
      : mode === 'bulk-assign'
        ? t('assignments.drawer.bulkAssignTitle', 'تخصیص گروهی')
        : t('assignments.drawer.detailsTitle', 'جزئیات تخصیص');

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            {mode === 'bulk-assign' ? (
              <Users className="w-5 h-5 text-purple-600" />
            ) : (
              <User className="w-5 h-5 text-purple-600" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">{title}</h2>
            {mode === 'assign' && targetClass && targetSubject && (
              <p className="text-sm text-slate-500">
                {targetClass.displayName || targetClass.name} - {targetSubject.name}
              </p>
            )}
            {mode === 'bulk-assign' && (
              <p className="text-sm text-slate-500">
                {t('assignments.drawer.selectedCount', '{{count}} مورد انتخاب شده', {
                  count: selectedCells.length,
                })}
              </p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Current Assignment (for single mode) */}
          {mode === 'assign' && currentAssignment && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-800">
                  {t('assignments.drawer.currentAssignment', 'تخصیص فعلی')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 font-medium">
                      {getInitials(currentAssignment.fullName)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{currentAssignment.fullName}</p>
                      <p className="text-xs text-slate-500">
                        {t(
                          'assignments.drawer.clickToReplace',
                          'برای جایگزینی معلم جدید انتخاب کنید'
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleUnassign}
                    disabled={isLoading}
                  >
                    <Trash2 className="w-4 h-4 me-1" />
                    {t('assignments.drawer.unassign', 'حذف تخصیص')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selected Items (for bulk) */}
          {mode === 'bulk-assign' && selectedCells.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('assignments.drawer.selectedItems', 'موارد انتخاب شده')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {selectedCells.map((cell, idx) => (
                    <div
                      key={`${cell.classId}-${cell.subjectId}-${idx}`}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <span className="text-slate-600">
                        {cell.className} - {cell.subjectName}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {cell.periodsPerWeek || 4} {t('assignments.periods', 'ساعت')}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    {t('assignments.drawer.totalPeriods', 'مجموع ساعات')}
                  </span>
                  <span className="font-medium text-slate-800">{periodsToAdd}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Teacher Selection */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {t('assignments.drawer.selectTeacher', 'انتخاب معلم')}
                </CardTitle>
                <Badge variant="outline">
                  {filteredTeachers.length} {t('assignments.drawer.teachers', 'معلم')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder={t('assignments.drawer.searchTeacher', 'جستجوی معلم...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-9 h-9"
                />
              </div>

              {/* Tabs */}
              <Tabs
                value={activeTab}
                onValueChange={(v: string) => setActiveTab(v as 'eligible' | 'all')}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="eligible" className="flex-1">
                    {t('assignments.drawer.eligibleTeachers', 'واجد شرایط')}
                  </TabsTrigger>
                  <TabsTrigger value="all" className="flex-1">
                    {t('assignments.drawer.allTeachers', 'همه معلمین')}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="eligible" className="mt-3">
                  <TeacherList
                    options={filteredTeachers}
                    selectedId={selectedTeacherId}
                    onSelect={setSelectedTeacherId}
                  />
                </TabsContent>

                <TabsContent value="all" className="mt-3">
                  <TeacherList
                    options={filteredTeachers}
                    selectedId={selectedTeacherId}
                    onSelect={setSelectedTeacherId}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Workload Preview */}
          {selectedOption && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('assignments.drawer.workloadPreview', 'پیش‌نمایش بار کاری')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Teacher Info */}
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium',
                      selectedOption.canAccept
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-red-100 text-red-700'
                    )}
                  >
                    {getInitials(selectedOption.teacher.fullName)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">
                        {selectedOption.teacher.fullName}
                      </p>
                      <Link
                        to="/teachers"
                        search={{ selected: selectedOption.teacher.id }}
                        className="text-xs text-purple-600 hover:text-purple-700 hover:underline flex items-center gap-0.5"
                      >
                        {t('assignments.drawer.viewProfile', 'مشاهده پروفایل')}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedOption.isPrimary && (
                        <Badge className="bg-purple-100 text-purple-700 text-xs">
                          <Star className="w-3 h-3 me-1" />
                          {t('assignments.drawer.primarySubject', 'مضمون اصلی')}
                        </Badge>
                      )}
                      {!selectedOption.isPrimary && selectedOption.isAllowed && (
                        <Badge variant="secondary" className="text-xs">
                          {t('assignments.drawer.allowedSubject', 'مضمون مجاز')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Current Workload - Using shared WorkloadProgressHeader */}
                <div className="space-y-3">
                  <div className="text-xs text-slate-500 font-medium">
                    {t('assignments.drawer.currentLoad', 'بار فعلی')}
                  </div>
                  <WorkloadProgressHeader
                    currentPeriods={selectedOption.currentWorkload}
                    maxPeriods={selectedOption.maxWorkload}
                    status={determineWorkloadStatus(
                      selectedOption.currentWorkload,
                      selectedOption.maxWorkload
                    )}
                    remainingCapacity={selectedOption.maxWorkload - selectedOption.currentWorkload}
                    compact
                  />
                </div>

                {/* Projected Workload After Assignment */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                      {t('assignments.drawer.afterAssignment', 'پس از تخصیص')}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        selectedOption.canAccept
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      )}
                    >
                      +{periodsToAdd} {t('common.period', 'ساعت')}
                    </Badge>
                  </div>
                  <WorkloadProgressHeader
                    currentPeriods={selectedOption.projectedWorkload}
                    maxPeriods={selectedOption.maxWorkload}
                    status={determineWorkloadStatus(
                      selectedOption.projectedWorkload,
                      selectedOption.maxWorkload
                    )}
                    remainingCapacity={
                      selectedOption.maxWorkload - selectedOption.projectedWorkload
                    }
                    compact
                  />
                </div>

                {/* Warning if workload exceeds maximum */}
                {selectedOption.projectedWorkload > selectedOption.maxWorkload && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-700">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">
                        {t('assignments.drawer.overloadWarning', 'هشدار بار کاری')}
                      </p>
                      <p className="text-xs mt-0.5">
                        {t(
                          'assignments.drawer.overloadMessage',
                          'این تخصیص باعث افزایش بار کاری بیش از حد مجاز می‌شود'
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-white">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            {t('common.cancel', 'انصراف')}
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedTeacherId || isLoading}
            className={cn(
              'flex-1',
              selectedOption?.canAccept === false
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-purple-600 hover:bg-purple-700'
            )}
          >
            {isLoading
              ? t('common.saving', 'در حال ذخیره...')
              : selectedOption?.canAccept === false
                ? t('assignments.drawer.assignAnyway', 'تخصیص با هشدار')
                : t('assignments.drawer.assign', 'تخصیص')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TeacherList Sub-component
// ============================================================================

interface TeacherListProps {
  options: TeacherOption[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function TeacherList({ options, selectedId, onSelect }: TeacherListProps) {
  const { t } = useTranslation();

  if (options.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        {t('assignments.drawer.noTeachersFound', 'معلمی یافت نشد')}
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[300px] overflow-auto">
      {options.map((option) => {
        const isSelected = selectedId === option.teacher.id;
        const canTeach = option.isPrimary || option.isAllowed;

        return (
          <div
            key={option.teacher.id}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all',
              isSelected
                ? 'bg-purple-50 border-2 border-purple-500'
                : canTeach
                  ? 'bg-slate-50 hover:bg-slate-100 border-2 border-transparent'
                  : 'bg-slate-50/50 border-2 border-transparent opacity-60'
            )}
            onClick={() => onSelect(option.teacher.id)}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium',
                  isSelected
                    ? 'bg-purple-500 text-white'
                    : option.isPrimary
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-slate-200 text-slate-600'
                )}
              >
                {getInitials(option.teacher.fullName)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-800">{option.teacher.fullName}</p>
                  {option.isPrimary && <Star className="w-3 h-3 text-purple-500" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500">
                    {option.currentWorkload}/{option.maxWorkload}
                  </span>
                  {!canTeach && (
                    <Badge variant="outline" className="text-[10px] h-4 text-slate-400">
                      {t('assignments.drawer.notEligible', 'غیرمجاز')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {option.canAccept ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AssignmentDrawer;
