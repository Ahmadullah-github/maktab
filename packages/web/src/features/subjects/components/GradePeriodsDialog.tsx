import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClasses, useUpdateClass } from '@/features/classes/hooks/useClasses';
import type { ClassGroup, SubjectRequirement } from '@/features/classes/types';
import { AlertTriangle, BookOpen, RotateCcw, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubjects, useUpdateGradeSubjectPeriods } from '../hooks/useSubjects';
import type { Subject } from '../types';

interface GradePeriodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SubjectPeriodSummary {
  subject: Subject;
  inheritedClasses: ClassGroup[];
  exceptions: Array<{ classGroup: ClassGroup; requirement: SubjectRequirement }>;
}

export function GradePeriodsDialog({ open, onOpenChange }: GradePeriodsDialogProps) {
  const { t } = useTranslation();
  const { data: subjects = [] } = useSubjects();
  const { data: classes = [] } = useClasses();
  const updateDefault = useUpdateGradeSubjectPeriods();
  const updateClass = useUpdateClass();
  const availableGrades = useMemo(
    () =>
      [...new Set(subjects.flatMap((subject) => (subject.grade ? [subject.grade] : [])))].sort(
        (left, right) => left - right
      ),
    [subjects]
  );
  const [grade, setGrade] = useState<number | null>(null);
  const [draftPeriods, setDraftPeriods] = useState<Record<number, number>>({});

  useEffect(() => {
    if (open && grade === null && availableGrades.length > 0) setGrade(availableGrades[0]);
  }, [availableGrades, grade, open]);

  const summaries = useMemo<SubjectPeriodSummary[]>(() => {
    if (grade === null) return [];
    const gradeClasses = classes.filter((classGroup) => classGroup.grade === grade);

    return subjects
      .filter((subject) => subject.grade === grade && (subject.periodsPerWeek ?? 0) > 0)
      .sort((left, right) => left.name.localeCompare(right.name, 'fa'))
      .map((subject) => {
        const inheritedClasses: ClassGroup[] = [];
        const exceptions: SubjectPeriodSummary['exceptions'] = [];
        for (const classGroup of gradeClasses) {
          const requirement = classGroup.subjectRequirements.find(
            (item) => item.subjectId === subject.id
          );
          if (!requirement) continue;
          const isException =
            requirement.periodMode === 'class_override' ||
            requirement.periodsPerWeek !== subject.periodsPerWeek;
          if (isException) exceptions.push({ classGroup, requirement });
          else inheritedClasses.push(classGroup);
        }
        return { subject, inheritedClasses, exceptions };
      });
  }, [classes, grade, subjects]);

  useEffect(() => {
    setDraftPeriods(
      Object.fromEntries(
        summaries.map(({ subject }) => [subject.id, subject.periodsPerWeek ?? 1])
      )
    );
  }, [summaries]);

  const resetException = async (
    subject: Subject,
    classGroup: ClassGroup,
    requirement: SubjectRequirement
  ) => {
    if (!subject.periodsPerWeek) return;
    const nextRequirements = classGroup.subjectRequirements.map((item) =>
      item.subjectId === requirement.subjectId
        ? {
            ...item,
            periodsPerWeek: subject.periodsPerWeek!,
            periodMode: 'inherited' as const,
          }
        : item
    );
    await updateClass.mutateAsync({
      id: classGroup.id,
      data: { subjectRequirements: nextRequirements },
    });
  };

  const resetAllExceptions = async (summary: SubjectPeriodSummary) => {
    if (
      !window.confirm(
        t(
          'subjects.gradePeriods.confirmResetAll',
          {
            subject: summary.subject.name,
            defaultValue: `همه استثناهای ${summary.subject.name} به مقدار پایه بازگردانده شوند؟`,
          }
        )
      )
    ) return;
    for (const exception of summary.exceptions) {
      await resetException(summary.subject, exception.classGroup, exception.requirement);
    }
  };

  const saveDefault = async (summary: SubjectPeriodSummary) => {
    const periods = draftPeriods[summary.subject.id];
    if (!Number.isInteger(periods) || periods < 1 || periods > 84 || grade === null) return;
    const message = t(
      'subjects.gradePeriods.confirmDefaultChange',
      {
        inherited: summary.inheritedClasses.length,
        exceptions: summary.exceptions.length,
        defaultValue: `این تغییر برای ${summary.inheritedClasses.length} صنف اعمال می‌شود؛ ${summary.exceptions.length} استثنا حفظ خواهد شد. ادامه می‌دهید؟`,
      }
    );
    if (!window.confirm(message)) return;
    await updateDefault.mutateAsync({
      grade,
      subjectId: summary.subject.id,
      periodsPerWeek: periods,
      schoolId: summary.subject.schoolId,
    });
  };

  const isPending = updateDefault.isPending || updateClass.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#003366]" />
            {t('subjects.gradePeriods.title', 'ساعات هفتگی پایه و استثناهای صنف')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'subjects.gradePeriods.description',
              'مقدار پایه برای همه صنف‌های یک پایه مشترک است. فقط صنف‌های واقعاً متفاوت را به‌عنوان استثنا نگه دارید.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3">
          <span className="text-sm font-medium">
            {t('subjects.gradePeriods.grade', 'پایه')}
          </span>
          <Select
            value={grade?.toString() ?? ''}
            onValueChange={(value) => setGrade(Number(value))}
          >
            <SelectTrigger className="w-44 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableGrades.map((item) => (
                <SelectItem key={item} value={item.toString()}>
                  {t('common.grade', 'صنف')} {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-[60vh] pe-3">
          <div className="space-y-3">
            {summaries.map((summary) => {
              const { subject, inheritedClasses, exceptions } = summary;
              const draft = draftPeriods[subject.id] ?? subject.periodsPerWeek ?? 1;
              const changed = draft !== subject.periodsPerWeek;
              return (
                <section key={subject.id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{subject.name}</h3>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-sky-50 text-sky-700">
                          {inheritedClasses.length}{' '}
                          {t('subjects.gradePeriods.inheritedClasses', 'صنف پیرو مقدار پایه')}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            exceptions.length
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }
                        >
                          {exceptions.length}{' '}
                          {t('subjects.gradePeriods.exceptions', 'استثنا')}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={84}
                        value={draft}
                        onChange={(event) =>
                          setDraftPeriods((current) => ({
                            ...current,
                            [subject.id]: Number(event.target.value),
                          }))
                        }
                        className="h-9 w-20"
                        aria-label={t('subjects.gradePeriods.defaultPeriods', 'ساعات پایه')}
                      />
                      <span className="text-xs text-muted-foreground">
                        {t('common.hoursPerWeek', 'ساعت/هفته')}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => saveDefault(summary)}
                        disabled={!changed || isPending || draft < 1 || draft > 84}
                      >
                        <Save className="me-1 h-4 w-4" />
                        {t('common.save', 'ذخیره')}
                      </Button>
                    </div>
                  </div>

                  {exceptions.length > 0 && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
                          <AlertTriangle className="h-4 w-4" />
                          {t('subjects.gradePeriods.classExceptions', 'استثناهای صنف')}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => resetAllExceptions(summary)}
                          disabled={isPending}
                          className="h-7 text-xs text-amber-800"
                        >
                          <RotateCcw className="me-1 h-3.5 w-3.5" />
                          {t('subjects.gradePeriods.resetAll', 'بازگردانی همه')}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {exceptions.map(({ classGroup, requirement }) => (
                          <Button
                            key={classGroup.id}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => resetException(subject, classGroup, requirement)}
                            disabled={isPending}
                            className="h-8 bg-white text-xs"
                          >
                            {classGroup.displayName || classGroup.name}: {requirement.periodsPerWeek}
                            <RotateCcw className="ms-2 h-3 w-3" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
            {summaries.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {t('subjects.gradePeriods.empty', 'برای این پایه مضمونی یافت نشد.')}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
