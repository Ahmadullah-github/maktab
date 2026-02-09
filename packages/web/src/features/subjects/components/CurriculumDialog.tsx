/**
 * CurriculumDialog Component
 *
 * Enhanced dialog for bulk curriculum operations:
 * - Insert curriculum: Add standard Ministry curriculum subjects for selected grades
 * - Clear grade subjects: Remove all subjects for selected grades
 *
 * Features:
 * - Multi-grade selection based on school settings
 * - Real-time subject preview with detailed table
 * - Existing subjects count badges per grade
 * - Grade category grouping (Alpha-Primary, Beta-Primary, Middle, High)
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSchoolSettings } from '@/features/school-settings/hooks/useSchoolSettings';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Beaker,
  BookOpen,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Monitor,
  Star,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAvailableGrades,
  getCurriculumForGrade,
  getCurriculumStats,
  getGradeCategory,
  GRADE_CATEGORIES,
  type GradeCategory,
  type SubjectDefinition,
} from '../data/curriculum';
import { useClearGradeSubjects, useInsertCurriculum, useSubjects } from '../hooks/useSubjects';

export type CurriculumDialogMode = 'insert' | 'clear';

export interface CurriculumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CurriculumDialogMode;
}

/** Category color mapping for badges - dark mode compatible */
const CATEGORY_COLORS: Record<GradeCategory, string> = {
  'Alpha-Primary': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'Beta-Primary': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  Middle: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  High: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
};

/** Category background colors for cards */
const CATEGORY_BG: Record<GradeCategory, string> = {
  'Alpha-Primary': 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10',
  'Beta-Primary': 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10',
  Middle: 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10',
  High: 'bg-purple-500/5 border-purple-500/20 hover:bg-purple-500/10',
};

/** Room type icon mapping */
const getRoomIcon = (roomType?: string) => {
  if (!roomType) return null;
  if (roomType.includes('Computer')) return <Monitor className="h-3 w-3" />;
  if (roomType.includes('Science') || roomType.includes('Lab'))
    return <FlaskConical className="h-3 w-3" />;
  return <Beaker className="h-3 w-3" />;
};

export function CurriculumDialog({ open, onOpenChange, mode }: CurriculumDialogProps) {
  const { t } = useTranslation();
  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);

  // Data hooks
  const { data: schoolSettings, isLoading: settingsLoading } = useSchoolSettings();
  const { data: existingSubjects = [] } = useSubjects();
  const insertCurriculum = useInsertCurriculum();
  const clearGradeSubjects = useClearGradeSubjects();

  const isPending = insertCurriculum.isPending || clearGradeSubjects.isPending;
  const isInsertMode = mode === 'insert';

  // Get available grades based on school settings
  const availableGrades = useMemo(() => {
    if (!schoolSettings) return [];
    return getAvailableGrades({
      enablePrimary: schoolSettings.enablePrimary,
      enableMiddle: schoolSettings.enableMiddle,
      enableHigh: schoolSettings.enableHigh,
    });
  }, [schoolSettings]);

  // Count existing subjects per grade
  const existingCountByGrade = useMemo(() => {
    const counts: Record<number, number> = {};
    existingSubjects.forEach((subject) => {
      const grade = (subject as { grade?: number | null }).grade;
      if (grade) {
        counts[grade] = (counts[grade] || 0) + 1;
      }
    });
    return counts;
  }, [existingSubjects]);

  // Group grades by category
  const gradesByCategory = useMemo(() => {
    const grouped: Record<GradeCategory, number[]> = {
      'Alpha-Primary': [],
      'Beta-Primary': [],
      Middle: [],
      High: [],
    };
    availableGrades.forEach((grade) => {
      const category = getGradeCategory(grade);
      if (category) grouped[category].push(grade);
    });
    return grouped;
  }, [availableGrades]);

  // Get preview subjects for selected grades
  const previewSubjects = useMemo(() => {
    const subjects: Array<SubjectDefinition & { grade: number }> = [];
    selectedGrades.forEach((grade) => {
      getCurriculumForGrade(grade).forEach((subject) => {
        subjects.push({ ...subject, grade });
      });
    });
    return subjects;
  }, [selectedGrades]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    let totalSubjects = 0;
    let totalPeriods = 0;
    let coreCount = 0;
    let labCount = 0;
    selectedGrades.forEach((grade) => {
      const stats = getCurriculumStats(grade);
      totalSubjects += stats.subjectCount;
      totalPeriods += stats.totalPeriods;
      coreCount += stats.coreCount;
      labCount += stats.labCount;
    });
    return { totalSubjects, totalPeriods, coreCount, labCount };
  }, [selectedGrades]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedGrades([]);
    }
  }, [open, mode]);

  // Toggle grade selection
  const handleGradeToggle = useCallback((grade: number) => {
    setSelectedGrades((prev) =>
      prev.includes(grade)
        ? prev.filter((g) => g !== grade)
        : [...prev, grade].sort((a, b) => a - b)
    );
  }, []);

  // Select all grades in a category
  const handleSelectCategory = useCallback(
    (category: GradeCategory) => {
      const categoryGrades = gradesByCategory[category];
      const allSelected = categoryGrades.every((g) => selectedGrades.includes(g));
      if (allSelected) {
        setSelectedGrades((prev) => prev.filter((g) => !categoryGrades.includes(g)));
      } else {
        setSelectedGrades((prev) =>
          [...new Set([...prev, ...categoryGrades])].sort((a, b) => a - b)
        );
      }
    },
    [gradesByCategory, selectedGrades]
  );

  // Handle confirm action
  const handleConfirm = useCallback(async () => {
    if (selectedGrades.length === 0) return;

    try {
      for (const grade of selectedGrades) {
        if (isInsertMode) {
          await insertCurriculum.mutateAsync(grade);
        } else {
          await clearGradeSubjects.mutateAsync(grade);
        }
      }
      onOpenChange(false);
    } catch {
      // Error handling is done in the mutation hooks
    }
  }, [selectedGrades, isInsertMode, insertCurriculum, clearGradeSubjects, onOpenChange]);

  const translationPrefix = isInsertMode
    ? 'subjects.curriculum.insertDialog'
    : 'subjects.curriculum.clearDialog';

  // Loading state
  if (settingsLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl" style={{ backgroundColor: 'hsl(var(--card))' }}>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] flex flex-col gap-4"
        style={{ backgroundColor: 'hsl(var(--card))' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', isInsertMode ? 'bg-primary/10' : 'bg-red-500/10')}>
              {isInsertMode ? (
                <BookOpen className="h-5 w-5 text-primary" />
              ) : (
                <Trash2 className="h-5 w-5 text-red-500" />
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span>{t(`${translationPrefix}.title`)}</span>
              <DialogDescription className="text-xs font-normal">
                {t(`${translationPrefix}.description`)}
              </DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Grade Selection by Category */}
          <div className="space-y-3">
            <label className="text-sm font-medium">{t(`${translationPrefix}.selectGrade`)}</label>

            <div className="space-y-3">
              {(Object.entries(gradesByCategory) as [GradeCategory, number[]][]).map(
                ([category, grades]) => {
                  if (grades.length === 0) return null;
                  const categoryInfo = GRADE_CATEGORIES[category];
                  const allSelected = grades.every((g) => selectedGrades.includes(g));
                  const someSelected = grades.some((g) => selectedGrades.includes(g));

                  return (
                    <div
                      key={category}
                      className={cn(
                        'rounded-xl border p-4 space-y-3 transition-colors',
                        CATEGORY_BG[category]
                      )}
                    >
                      {/* Category Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => handleSelectCategory(category)}
                            className={cn('h-5 w-5', someSelected && !allSelected && 'opacity-50')}
                          />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-sm">
                              {categoryInfo.descriptionFa}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {grades.length} صنف • {categoryInfo.totalPeriods} ساعت/هفته
                            </span>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('text-xs font-medium', CATEGORY_COLORS[category])}
                        >
                          {categoryInfo.description.split(' ')[0]}
                        </Badge>
                      </div>

                      {/* Grade Checkboxes */}
                      <div className="flex flex-wrap gap-2 ms-8">
                        {grades.map((grade) => {
                          const existingCount = existingCountByGrade[grade] || 0;
                          const isSelected = selectedGrades.includes(grade);

                          return (
                            <button
                              key={grade}
                              type="button"
                              onClick={() => handleGradeToggle(grade)}
                              disabled={isPending}
                              className={cn(
                                'relative flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                                isSelected
                                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                  : 'bg-background hover:bg-accent border-border hover:border-primary/50'
                              )}
                            >
                              <span>صنف {grade}</span>
                              {existingCount > 0 && (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    'h-5 min-w-5 px-1.5 text-xs font-bold',
                                    isSelected
                                      ? 'bg-primary-foreground/20 text-primary-foreground'
                                      : isInsertMode
                                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                        : 'bg-red-500/15 text-red-600 dark:text-red-400'
                                  )}
                                >
                                  {existingCount}
                                </Badge>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Preview Section */}
          {selectedGrades.length > 0 && (
            <div className="space-y-3">
              {/* Summary Stats */}
              <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold">{summaryStats.totalSubjects}</span>
                      <span className="text-xs text-muted-foreground">مضمون</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Star className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold">{summaryStats.coreCount}</span>
                      <span className="text-xs text-muted-foreground">اصلی</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <FlaskConical className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold">{summaryStats.labCount}</span>
                      <span className="text-xs text-muted-foreground">لابراتوار</span>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {selectedGrades.length} صنف انتخاب شده
                </Badge>
              </div>

              {/* Subject Preview Table */}
              {isInsertMode && (
                <ScrollArea className="h-[250px] rounded-xl border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-16 font-semibold">صنف</TableHead>
                        <TableHead className="font-semibold">مضمون</TableHead>
                        <TableHead className="w-20 text-center font-semibold">ساعات</TableHead>
                        <TableHead className="w-28 text-center font-semibold">نوع اتاق</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewSubjects.map((subject, idx) => (
                        <TableRow
                          key={`${subject.grade}-${subject.code}-${idx}`}
                          className="hover:bg-muted/30"
                        >
                          <TableCell>
                            <Badge variant="secondary" className="text-xs font-medium">
                              {subject.grade}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{subject.name}</span>
                              {subject.isCore && (
                                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                              )}
                              {subject.isDifficult && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 text-orange-600 dark:text-orange-400 border-orange-500/30"
                                >
                                  دشوار
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-semibold">{subject.periodsPerWeek}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {subject.requiredRoomType ? (
                              <Badge
                                variant="outline"
                                className="gap-1.5 text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                              >
                                {getRoomIcon(subject.requiredRoomType)}
                                {subject.requiredRoomType.includes('Computer')
                                  ? 'کمپیوتر'
                                  : 'لابراتوار'}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}

              {/* Insert Mode Warning */}
              {isInsertMode &&
                Object.keys(existingCountByGrade).some((g) =>
                  selectedGrades.includes(Number(g))
                ) && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">توجه</p>
                      <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
                        {t(`${translationPrefix}.existingWarning`)}
                      </p>
                    </div>
                  </div>
                )}

              {/* Clear Mode Warning */}
              {!isInsertMode && (
                <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 space-y-2">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-semibold">{t(`${translationPrefix}.warning`)}</span>
                  </div>
                  <p className="text-sm text-red-600/80 dark:text-red-400/80">
                    {selectedGrades.length === 1
                      ? t(`${translationPrefix}.warningDescription`, { grade: selectedGrades[0] })
                      : `تمام مضامین صنف‌های ${selectedGrades.join('، ')} به طور دائم حذف خواهند شد.`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {selectedGrades.length === 0 && (
            <div className="rounded-xl border-2 border-dashed p-10 text-center bg-muted/20">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <BookOpen className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                {t(`${translationPrefix}.noPreview`)}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                برای مشاهده پیش‌نمایش، صنف‌های مورد نظر را انتخاب کنید
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={isInsertMode ? 'default' : 'destructive'}
            onClick={handleConfirm}
            disabled={selectedGrades.length === 0 || isPending}
            className="gap-2 min-w-[140px]"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t(`${translationPrefix}.confirming`)}
              </>
            ) : (
              <>
                {isInsertMode ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {t(`${translationPrefix}.confirm`)}
                {selectedGrades.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ms-1 bg-primary-foreground/20 text-primary-foreground"
                  >
                    {selectedGrades.length}
                  </Badge>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CurriculumDialog;
