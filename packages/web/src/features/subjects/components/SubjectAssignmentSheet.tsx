/**
 * SubjectAssignmentSheet Component
 *
 * Full subject-centric assignment interface in a sheet/drawer.
 * Shows coverage progress, compatible teachers, and class assignments
 * grouped by grade with bulk assignment controls.
 *
 * Phase 3.2 of Teacher Assignment System
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Loader2,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSubjectAssignments, type ClassWithAssignment } from '../hooks/useSubjectAssignments';
import type { Subject } from '../types';

export interface SubjectAssignmentSheetProps {
  /** The subject to manage assignments for */
  subject: Subject | null;
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * Teacher interface for updates
 */
interface Teacher {
  id: number;
  fullName: string;
  classAssignments: string | Array<{ subjectId: number; classIds: number[] }>;
}

/**
 * Class assignment structure
 */
interface ClassAssignment {
  subjectId: number;
  classIds: number[];
}

/**
 * Parse JSON string or return as-is if already an array
 */
function parseJsonArray<T>(value: string | T[] | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Get status colors based on coverage
 */
function getStatusColors(percentage: number) {
  if (percentage === 100) {
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      progress: '[&>div]:bg-emerald-500',
      icon: CheckCircle2,
    };
  }
  if (percentage > 0) {
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      progress: '[&>div]:bg-amber-500',
      icon: AlertCircle,
    };
  }
  return {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    progress: '[&>div]:bg-red-500',
    icon: XCircle,
  };
}

/**
 * Grade group component showing classes for a specific grade
 */
function GradeGroup({
  grade,
  classes,
  compatibleTeachers,
  onAssign,
  isAssigning,
}: {
  grade: number;
  classes: ClassWithAssignment[];
  compatibleTeachers: Array<{
    teacherId: number;
    teacherName: string;
    compatibility: 'primary' | 'allowed';
    availableCapacity: number;
  }>;
  onAssign: (classIds: number[], teacherId: number) => Promise<void>;
  isAssigning: boolean;
}) {
  const { t } = useTranslation();
  const [selectedClassIds, setSelectedClassIds] = useState<Set<number>>(new Set());
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  const unassignedClasses = classes.filter((c) => !c.assignedTeacherId);
  const assignedClasses = classes.filter((c) => c.assignedTeacherId);

  const handleToggleClass = useCallback((classId: number) => {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedClassIds.size === unassignedClasses.length) {
      setSelectedClassIds(new Set());
    } else {
      setSelectedClassIds(new Set(unassignedClasses.map((c) => c.classId)));
    }
  }, [unassignedClasses, selectedClassIds]);

  const handleAssign = async () => {
    if (!selectedTeacherId || selectedClassIds.size === 0) return;
    await onAssign(Array.from(selectedClassIds), parseInt(selectedTeacherId, 10));
    setSelectedClassIds(new Set());
    setSelectedTeacherId('');
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Grade Header */}
      <div className="px-3 py-2 bg-slate-50 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-medium text-slate-700">
            {t('subjects.assignment.grade', 'صنف')} {grade}
          </span>
          <Badge variant="secondary" className="text-xs">
            {classes.length} {t('subjects.assignment.classes', 'صنف')}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-emerald-600">{assignedClasses.length} ✓</span>
          <span className="text-amber-600">{unassignedClasses.length} ○</span>
        </div>
      </div>

      {/* Classes List */}
      <div className="p-3 space-y-2">
        {/* Assigned Classes */}
        {assignedClasses.map((cls) => (
          <div
            key={cls.classId}
            className="flex items-center justify-between p-2 rounded-md bg-emerald-50/50 border border-emerald-200"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-slate-700">{cls.className}</span>
              <span className="text-xs text-muted-foreground">
                ({cls.periodsPerWeek} {t('common.periodsShort', 'ساعت')})
              </span>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
              <UserCheck className="h-3 w-3 me-1" />
              {cls.assignedTeacherName}
            </Badge>
          </div>
        ))}

        {/* Unassigned Classes */}
        {unassignedClasses.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-dashed">
            {/* Select All */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={
                    selectedClassIds.size === unassignedClasses.length &&
                    unassignedClasses.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                  disabled={isAssigning}
                />
                <span className="text-xs text-muted-foreground">
                  {t('common.selectAll', 'انتخاب همه')}
                </span>
              </label>
              {selectedClassIds.size > 0 && (
                <span className="text-xs text-violet-600">
                  {selectedClassIds.size} {t('common.selected', 'انتخاب شده')}
                </span>
              )}
            </div>

            {/* Unassigned Class Items */}
            {unassignedClasses.map((cls) => (
              <label
                key={cls.classId}
                className={cn(
                  'flex items-center justify-between p-2 rounded-md border cursor-pointer transition-colors',
                  selectedClassIds.has(cls.classId)
                    ? 'bg-violet-50 border-violet-300'
                    : 'bg-slate-50 border-slate-200 hover:border-violet-200'
                )}
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedClassIds.has(cls.classId)}
                    onCheckedChange={() => handleToggleClass(cls.classId)}
                    disabled={isAssigning}
                  />
                  <span className="text-sm text-slate-700">{cls.className}</span>
                  <span className="text-xs text-muted-foreground">
                    ({cls.periodsPerWeek} {t('common.periodsShort', 'ساعت')})
                  </span>
                </div>
              </label>
            ))}

            {/* Bulk Assign Controls */}
            {selectedClassIds.size > 0 && (
              <div className="flex items-center gap-2 pt-2">
                <Select
                  value={selectedTeacherId}
                  onValueChange={setSelectedTeacherId}
                  disabled={isAssigning}
                >
                  <SelectTrigger className="flex-1 h-8 text-xs">
                    <SelectValue
                      placeholder={t('subjects.assignment.selectTeacher', 'انتخاب معلم')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {compatibleTeachers.map((teacher) => (
                      <SelectItem
                        key={teacher.teacherId}
                        value={teacher.teacherId.toString()}
                        className="text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span>{teacher.teacherName}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1 py-0',
                              teacher.compatibility === 'primary'
                                ? 'border-violet-300 text-violet-600'
                                : 'border-slate-300 text-slate-500'
                            )}
                          >
                            {teacher.compatibility === 'primary'
                              ? t('subjects.coverage.primary', 'اصلی')
                              : t('subjects.coverage.allowed', 'مجاز')}
                          </Badge>
                          <span className="text-muted-foreground">
                            ({teacher.availableCapacity}{' '}
                            {t('subjects.assignment.available', 'خالی')})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleAssign}
                  disabled={!selectedTeacherId || isAssigning}
                  className="h-8 px-3 text-xs"
                >
                  {isAssigning ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-3 w-3 me-1" />
                      {t('subjects.assignment.assign', 'تخصیص')}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SubjectAssignmentSheet({
  subject,
  open,
  onOpenChange,
}: SubjectAssignmentSheetProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isAssigning, setIsAssigning] = useState(false);

  const { summary, compatibleTeachers, isLoading } = useSubjectAssignments(subject?.id);

  // Get sorted grades
  const sortedGrades = useMemo(() => {
    if (!summary) return [];
    return Array.from(summary.classesByGrade.keys()).sort((a, b) => a - b);
  }, [summary]);

  // Handle assignment
  const handleAssign = useCallback(
    async (classIds: number[], teacherId: number) => {
      if (!subject) return;

      setIsAssigning(true);
      try {
        // Fetch current teacher data
        const teachers = (await api.teachers.list()) as Teacher[];
        const teacher = teachers.find((t) => t.id === teacherId);
        if (!teacher) throw new Error('Teacher not found');

        // Parse classAssignments from JSON string if needed
        const currentAssignments = parseJsonArray<ClassAssignment>(teacher.classAssignments);
        const existingIndex = currentAssignments.findIndex((a) => a.subjectId === subject.id);

        let updatedAssignments: ClassAssignment[];
        if (existingIndex >= 0) {
          // Add to existing assignment
          updatedAssignments = currentAssignments.map((a, i) => {
            if (i !== existingIndex) return a;
            const existingClassIds = a.classIds || [];
            return { ...a, classIds: [...new Set([...existingClassIds, ...classIds])] };
          });
        } else {
          // Create new assignment
          updatedAssignments = [...currentAssignments, { subjectId: subject.id, classIds }];
        }

        // Update teacher via API
        await api.teachers.update(teacherId, { classAssignments: updatedAssignments });

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ['teachers'] });
        queryClient.invalidateQueries({ queryKey: ['classes'] });

        toast.success(t('subjects.assignment.assignSuccess', 'تخصیص با موفقیت انجام شد'));
      } catch (error) {
        console.error('Assignment failed:', error);
        toast.error(t('subjects.assignment.assignError', 'خطا در تخصیص'));
      } finally {
        setIsAssigning(false);
      }
    },
    [subject, queryClient, t]
  );

  if (!subject) return null;

  const colors = summary ? getStatusColors(summary.coveragePercentage) : getStatusColors(0);
  const StatusIcon = colors.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-md">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <SheetTitle className="text-base">{subject.name}</SheetTitle>
              <SheetDescription className="text-xs">
                {t('subjects.assignment.sheetDescription', 'مدیریت تخصیص معلمان به صنف‌ها')}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : summary ? (
              <>
                {/* Coverage Summary */}
                <div className={cn('p-4 rounded-lg border', colors.bg, colors.border)}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={cn('h-4 w-4', colors.text)} />
                      <h4 className={cn('font-medium text-sm', colors.text)}>
                        {summary.coveragePercentage === 100 &&
                          t('subjects.coverage.complete', 'پوشش کامل')}
                        {summary.coveragePercentage > 0 &&
                          summary.coveragePercentage < 100 &&
                          t('subjects.coverage.partial', 'پوشش ناقص')}
                        {summary.coveragePercentage === 0 &&
                          t('subjects.coverage.uncovered', 'بدون پوشش')}
                      </h4>
                    </div>
                    <Badge variant="outline" className={cn('text-xs', colors.text, colors.border)}>
                      {summary.coveragePercentage}%
                    </Badge>
                  </div>

                  <Progress
                    value={summary.coveragePercentage}
                    className={cn('h-2 mb-3', colors.progress)}
                  />

                  <div className="flex items-center justify-between text-xs">
                    <span className={colors.text}>
                      {summary.assignedClasses} {t('subjects.coverage.assigned', 'تخصیص یافته')} /{' '}
                      {summary.totalClasses} {t('subjects.coverage.total', 'کل')}
                    </span>
                    {summary.unassignedClassIds.length > 0 && (
                      <span className="text-amber-600">
                        {summary.unassignedClassIds.length}{' '}
                        {t('subjects.coverage.needsAssignment', 'نیاز به تخصیص')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Compatible Teachers */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Users className="h-4 w-4 text-violet-600" />
                    {t('subjects.coverage.compatibleTeachers', 'معلمان مناسب')}
                    <Badge variant="secondary" className="text-xs">
                      {compatibleTeachers.length}
                    </Badge>
                  </h4>

                  {compatibleTeachers.length === 0 ? (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-700">
                      {t(
                        'subjects.coverage.noCompatibleTeachers',
                        'هیچ معلم مناسبی برای این مضمون یافت نشد'
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {compatibleTeachers.slice(0, 5).map((teacher) => (
                        <div
                          key={teacher.teacherId}
                          className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                'p-1.5 rounded-md',
                                teacher.compatibility === 'primary'
                                  ? 'bg-violet-100'
                                  : 'bg-slate-100'
                              )}
                            >
                              <Users
                                className={cn(
                                  'h-3.5 w-3.5',
                                  teacher.compatibility === 'primary'
                                    ? 'text-violet-600'
                                    : 'text-slate-500'
                                )}
                              />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">
                                {teacher.teacherName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {teacher.currentWorkload}/{teacher.maxWorkload}{' '}
                                {t('common.periodsShort', 'ساعت')}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              teacher.compatibility === 'primary'
                                ? 'border-violet-300 text-violet-600'
                                : 'border-slate-300 text-slate-500'
                            )}
                          >
                            {teacher.compatibility === 'primary'
                              ? t('subjects.coverage.primary', 'اصلی')
                              : t('subjects.coverage.allowed', 'مجاز')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Classes by Grade */}
                {summary.totalClasses > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-violet-600" />
                      {t('subjects.assignment.classesByGrade', 'صنف‌ها بر اساس پایه')}
                    </h4>

                    <div className="space-y-3">
                      {sortedGrades.map((grade) => (
                        <GradeGroup
                          key={grade}
                          grade={grade}
                          classes={summary.classesByGrade.get(grade) || []}
                          compatibleTeachers={compatibleTeachers}
                          onAssign={handleAssign}
                          isAssigning={isAssigning}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                    <GraduationCap className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">
                      {t(
                        'subjects.coverage.noClassesRequire',
                        'هیچ صنفی این مضمون را در برنامه ندارد'
                      )}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                <p className="text-sm text-slate-600">
                  {t('subjects.assignment.noData', 'اطلاعاتی یافت نشد')}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default SubjectAssignmentSheet;
