import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useClasses } from '@/features/classes/hooks/useClasses';
import { useDirection } from '@/hooks/useDirection';
import { useSchoolConfig } from '@/features/school-settings/hooks/useSchoolSettings';
import { cn } from '@/lib/utils';
import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  BookCopy,
  BookOpenCheck,
  CheckCircle2,
  ClipboardPaste,
  GraduationCap,
  Loader2,
  Plus,
  Save,
  School,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useApplyCurriculum,
  useCurriculumTemplate,
  usePreviewCurriculum,
  useSchoolCurriculum,
} from '../hooks';
import type {
  CurriculumClassProposal,
  CurriculumPlanInput,
  CurriculumPlanPreview,
  GradeCurriculum,
  SchoolCurriculumSubject,
} from '../types';

const SECTION_LETTERS = ['الف', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ی'];

export function activeGrades(config?: {
  enablePrimary: boolean;
  enableMiddle: boolean;
  enableHigh: boolean;
}) {
  if (!config) return [];
  return [
    ...(config.enablePrimary ? [1, 2, 3, 4, 5, 6] : []),
    ...(config.enableMiddle ? [7, 8, 9] : []),
    ...(config.enableHigh ? [10, 11, 12] : []),
  ];
}

export function categoryForGrade(grade: number) {
  if (grade <= 3) return 'Alpha-Primary';
  if (grade <= 6) return 'Beta-Primary';
  if (grade <= 9) return 'Middle';
  return 'High';
}

export function capacityForGrade(
  config: NonNullable<ReturnType<typeof useSchoolConfig>['data']>,
  grade: number
) {
  const category = categoryForGrade(grade);
  return config.daysOfWeek.reduce((total, day) => {
    if (config.categoryPeriodsEnabled) {
      return total + (config.categoryPeriodsMap[category]?.[day] ?? config.defaultPeriodsPerDay);
    }
    if (config.dynamicPeriodsEnabled) {
      return total + (config.periodsPerDayMap[day] ?? config.defaultPeriodsPerDay);
    }
    return total + config.defaultPeriodsPerDay;
  }, 0);
}

function newItemId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `curriculum-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function parsePastedSubjects(value: string): SchoolCurriculumSubject[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(/\t|,/).map((cell) => cell.trim());
      const periods = Number(cells.length >= 4 ? cells[3] : cells[2]);
      return {
        itemId: newItemId(),
        name: cells[0] ?? '',
        nameEn: cells.length >= 4 ? cells[1] : undefined,
        code: cells.length >= 4 ? cells[2] : (cells[1] ?? ''),
        periodsPerWeek: Number.isInteger(periods) && periods > 0 ? periods : 1,
      };
    });
}

interface SummaryTileProps {
  icon: typeof GraduationCap;
  label: string;
  value: string | number;
  accent?: boolean;
}

function SummaryTile({ icon: Icon, label, value, accent = false }: SummaryTileProps) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          accent ? 'bg-amber-100 text-amber-700' : 'bg-[#003366]/8 text-[#003366]'
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export function SchoolCurriculumPage() {
  const { t } = useTranslation();
  const { direction } = useDirection();
  const { data: config, isLoading: configLoading } = useSchoolConfig();
  const { data: curriculum, isLoading: curriculumLoading } = useSchoolCurriculum();
  const { data: template } = useCurriculumTemplate();
  const { data: classes = [] } = useClasses();
  const previewMutation = usePreviewCurriculum();
  const applyMutation = useApplyCurriculum();
  const grades = useMemo(() => activeGrades(config), [config]);
  const [drafts, setDrafts] = useState<Record<number, GradeCurriculum>>({});
  const [selectedGrade, setSelectedGrade] = useState(1);
  const [pasteValue, setPasteValue] = useState('');
  const [dirtyGrades, setDirtyGrades] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<CurriculumPlanPreview | null>(null);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [prefix, setPrefix] = useState('صنف');
  const [separator, setSeparator] = useState('-');
  const [studentCount, setStudentCount] = useState(30);
  const [sectionCounts, setSectionCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!curriculum || grades.length === 0 || dirtyGrades.size > 0) return;
    setDrafts(
      Object.fromEntries(
        curriculum.gradeConfigs
          .filter((entry) => grades.includes(entry.grade))
          .map((entry) => [
            entry.grade,
            { ...entry, subjects: entry.subjects.map((subject) => ({ ...subject })) },
          ])
      )
    );
    setSelectedGrade((current) => (grades.includes(current) ? current : grades[0]));
  }, [curriculum, grades, dirtyGrades.size]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyGrades.size === 0) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirtyGrades.size]);

  const updateGrade = (grade: number, transform: (draft: GradeCurriculum) => GradeCurriculum) => {
    setDrafts((current) => ({
      ...current,
      [grade]: transform(current[grade] ?? { grade, revision: 0, subjects: [] }),
    }));
    setDirtyGrades((current) => new Set(current).add(grade));
  };

  const existingClassCountByGrade = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const grade of grades) {
      counts[grade] = classes.filter((entry) => entry.grade === grade && !entry.isDeleted).length;
    }
    return counts;
  }, [classes, grades]);

  const classProposals = useMemo<CurriculumClassProposal[]>(() => {
    const proposals: CurriculumClassProposal[] = [];
    for (const grade of grades) {
      const existingForGrade = classes.filter((entry) => entry.grade === grade && !entry.isDeleted);
      const usedNames = new Set(
        existingForGrade.map((entry) => entry.name.trim().toLocaleLowerCase())
      );
      const usedSections = new Set(
        existingForGrade.map((entry) => entry.sectionIndex?.trim()).filter(Boolean)
      );
      const count = Math.max(0, sectionCounts[grade] ?? 0);
      let created = 0;
      let sectionNumber = 0;
      while (created < count) {
        const sectionIndex = SECTION_LETTERS[sectionNumber] ?? String(sectionNumber + 1);
        sectionNumber += 1;
        const joiner = separator === 'none' ? '' : separator;
        const name = `${prefix}${joiner}${grade}${joiner}${sectionIndex}`;
        if (usedSections.has(sectionIndex) || usedNames.has(name.trim().toLocaleLowerCase()))
          continue;
        usedSections.add(sectionIndex);
        usedNames.add(name.trim().toLocaleLowerCase());
        proposals.push({
          name,
          displayName: `صنف ${grade} ${sectionIndex}`,
          grade,
          sectionIndex,
          studentCount,
          classTeacherId: null,
        });
        created += 1;
      }
    }
    return proposals;
  }, [classes, grades, prefix, sectionCounts, separator, studentCount]);

  const selectedDraft = drafts[selectedGrade] ?? {
    grade: selectedGrade,
    revision: 0,
    subjects: [],
  };
  const selectedDemand = selectedDraft.subjects.reduce(
    (sum, subject) => sum + subject.periodsPerWeek,
    0
  );
  const selectedCapacity = config ? capacityForGrade(config, selectedGrade) : 0;
  const selectedRemaining = selectedCapacity - selectedDemand;
  const capacityPercent = selectedCapacity > 0 ? (selectedDemand / selectedCapacity) * 100 : 0;

  const buildPlan = (): CurriculumPlanInput | null => {
    const plannedGrades = new Set([
      ...dirtyGrades,
      ...classProposals.map((proposal) => proposal.grade),
    ]);
    if (!config || plannedGrades.size === 0) return null;
    return {
      schoolId: config.schoolId,
      schoolConfigRevision: config.revision,
      gradeConfigs: [...plannedGrades]
        .sort((a, b) => a - b)
        .map((grade) => drafts[grade] ?? { grade, revision: 0, subjects: [] }),
      classes: classProposals,
    };
  };

  const handlePreview = async () => {
    const plan = buildPlan();
    if (!plan) return toast.info(t('curriculum.toast.nothingToReview'));
    try {
      setPreview(await previewMutation.mutateAsync(plan));
      setConfirmRemoval(false);
    } catch (error) {
      toast.error(t('curriculum.toast.previewFailed'), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleApply = async () => {
    const plan = buildPlan();
    if (!plan || !preview) return;
    try {
      await applyMutation.mutateAsync({
        ...plan,
        previewToken: preview.previewToken,
        confirmAssignmentRemoval: confirmRemoval,
      });
      toast.success(t('curriculum.toast.applySuccess'));
      setDirtyGrades(new Set());
      setSectionCounts({});
      setPreview(null);
    } catch (error) {
      toast.error(t('curriculum.toast.applyFailed'), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleUseTemplate = () => {
    if (!template || !window.confirm(t('curriculum.template.confirm'))) return;
    const next = { ...drafts };
    const changed = new Set<number>();
    for (const grade of grades) {
      const source = template.gradeConfigs.find((entry) => entry.grade === grade);
      next[grade] = {
        grade,
        revision: drafts[grade]?.revision ?? 0,
        subjects: source?.subjects.map((subject) => ({ ...subject })) ?? [],
      };
      changed.add(grade);
    }
    setDrafts(next);
    setDirtyGrades(changed);
  };

  const handlePaste = () => {
    const parsed = parsePastedSubjects(pasteValue);
    updateGrade(selectedGrade, (draft) => ({
      ...draft,
      subjects: [...draft.subjects, ...parsed],
    }));
    setPasteValue('');
    toast.success(t('curriculum.toast.pasted', { count: parsed.length, grade: selectedGrade }));
  };

  if (configLoading || curriculumLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#003366]" />
      </div>
    );
  }

  if (grades.length === 0) {
    return (
      <div className="mx-auto max-w-3xl p-6" dir={direction}>
        <Alert>
          <School className="h-4 w-4" />
          <AlertTitle>{t('curriculum.emptyGrades.title')}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{t('curriculum.emptyGrades.description')}</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/school-settings">{t('curriculum.actions.openSettings')}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-full flex-1 flex-col bg-linear-to-br from-slate-50 via-white to-emerald-50/30"
      dir={direction}
    >
      <PageHeader
        icon={BookOpenCheck}
        title={t('curriculum.pageTitle')}
        subtitle={t('curriculum.pageSubtitle')}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              aria-label={t('curriculum.actions.useTemplate')}
              disabled={!template}
              onClick={handleUseTemplate}
              className="bg-white"
            >
              <BookCopy className="me-2 h-4 w-4" />
              <span className="hidden lg:inline">{t('curriculum.actions.useTemplate')}</span>
            </Button>
            <Button
              size="sm"
              aria-label={t('curriculum.actions.reviewApply')}
              onClick={() => void handlePreview()}
              disabled={
                previewMutation.isPending || (dirtyGrades.size === 0 && classProposals.length === 0)
              }
              className="bg-[#003366] hover:bg-[#004488]"
            >
              {previewMutation.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="me-2 h-4 w-4" />
              )}
              <span className="hidden sm:inline">{t('curriculum.actions.reviewApply')}</span>
            </Button>
          </>
        }
      />

      <main className="mx-auto w-full max-w-[1500px] space-y-4 p-4 sm:p-6">
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <SummaryTile
            icon={GraduationCap}
            label={t('curriculum.summary.activeGrades')}
            value={grades.length}
          />
          <SummaryTile
            icon={Sparkles}
            label={t('curriculum.summary.changedGrades')}
            value={dirtyGrades.size}
            accent={dirtyGrades.size > 0}
          />
          <SummaryTile
            icon={School}
            label={t('curriculum.summary.classesToCreate')}
            value={classProposals.length}
            accent={classProposals.length > 0}
          />
          <SummaryTile
            icon={BookOpenCheck}
            label={t('curriculum.summary.weeklyCapacity')}
            value={t('curriculum.editor.periodUsage', {
              demand: selectedDemand,
              capacity: selectedCapacity,
            })}
            accent={selectedDemand > selectedCapacity}
          />
        </section>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="border-b bg-slate-50/80 px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs
                value={String(selectedGrade)}
                onValueChange={(value) => setSelectedGrade(Number(value))}
                className="min-w-0"
              >
                <TabsList
                  aria-label={t('curriculum.gradeTabsLabel')}
                  className="h-auto max-w-full justify-start gap-1 overflow-x-auto bg-slate-200/60 p-1"
                >
                  {grades.map((grade) => (
                    <TabsTrigger
                      key={grade}
                      value={String(grade)}
                      className="relative min-w-20 gap-1.5 px-3 py-1.5"
                    >
                      {t('curriculum.grade', { grade })}
                      {dirtyGrades.has(grade) ? (
                        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                      ) : null}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="bg-white">
                  {t('curriculum.editor.subjectCount', { count: selectedDraft.subjects.length })}
                </Badge>
                <Badge
                  className={cn(
                    'border-0',
                    selectedRemaining < 0
                      ? 'bg-red-600'
                      : selectedRemaining === 0
                        ? 'bg-emerald-600'
                        : 'bg-sky-600'
                  )}
                >
                  {selectedRemaining < 0
                    ? t('curriculum.editor.over', { count: Math.abs(selectedRemaining) })
                    : selectedRemaining === 0
                      ? t('curriculum.editor.full')
                      : t('curriculum.editor.available', { count: selectedRemaining })}
                </Badge>
                <span className="text-muted-foreground">
                  {dirtyGrades.size > 0
                    ? t('curriculum.summary.unsaved', { count: dirtyGrades.size })
                    : t('curriculum.summary.saved')}
                </span>
              </div>
            </div>
          </div>

          <CardHeader className="gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">
                  {t('curriculum.editor.title', { grade: selectedGrade })}
                </CardTitle>
                <CardDescription className="mt-1">
                  {t('curriculum.editor.description')}
                </CardDescription>
              </div>
              <div className="w-full shrink-0 space-y-1.5 sm:w-64">
                <div className="flex justify-between text-xs font-medium">
                  <span>
                    {t('curriculum.editor.periodUsage', {
                      demand: selectedDemand,
                      capacity: selectedCapacity,
                    })}
                  </span>
                  <span dir="ltr">{Math.round(capacityPercent)}%</span>
                </div>
                <Progress
                  value={Math.min(capacityPercent, 100)}
                  className={cn('h-2', selectedRemaining < 0 && '[&>div]:bg-red-600')}
                />
              </div>
            </div>
            {selectedRemaining < 0 ? (
              <Alert variant="destructive" className="py-2.5">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t('curriculum.editor.capacityExceeded')}</AlertTitle>
                <AlertDescription>
                  {t('curriculum.editor.capacityExceededDescription', {
                    count: Math.abs(selectedRemaining),
                  })}
                </AlertDescription>
              </Alert>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-2 p-4 pt-0 sm:p-5 sm:pt-0">
            <div className="hidden grid-cols-[minmax(180px,1.25fr)_minmax(170px,1.15fr)_minmax(120px,.8fr)_112px_40px] gap-2 px-2 text-xs font-semibold text-slate-500 md:grid">
              <span>{t('curriculum.editor.columns.name')}</span>
              <span>{t('curriculum.editor.columns.englishName')}</span>
              <span>{t('curriculum.editor.columns.code')}</span>
              <span>{t('curriculum.editor.columns.periods')}</span>
              <span />
            </div>

            {selectedDraft.subjects.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed py-10 text-center">
                <BookOpenCheck className="mb-3 h-9 w-9 text-slate-300" />
                <p className="font-medium">{t('curriculum.editor.emptyTitle')}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('curriculum.editor.emptyDescription')}
                </p>
              </div>
            ) : (
              selectedDraft.subjects.map((subject, index) => (
                <div
                  key={subject.itemId}
                  className="group relative grid gap-2 rounded-lg border bg-white p-3 transition-colors hover:border-slate-300 hover:bg-slate-50/60 md:grid-cols-[minmax(180px,1.25fr)_minmax(170px,1.15fr)_minmax(120px,.8fr)_112px_40px] md:items-center md:border-transparent md:px-2 md:py-1.5"
                >
                  <span className="absolute -start-2 top-1/2 hidden -translate-y-1/2 text-[10px] tabular-nums text-slate-300 xl:block">
                    {index + 1}
                  </span>
                  <div className="space-y-1 md:space-y-0">
                    <Label className="text-xs text-muted-foreground md:sr-only">
                      {t('curriculum.editor.columns.name')}
                    </Label>
                    <Input
                      aria-label={t('curriculum.editor.columns.name')}
                      dir="auto"
                      value={subject.name}
                      className="h-9 bg-white"
                      onChange={(event) =>
                        updateGrade(selectedGrade, (draft) => ({
                          ...draft,
                          subjects: draft.subjects.map((entry) =>
                            entry.itemId === subject.itemId
                              ? { ...entry, name: event.target.value }
                              : entry
                          ),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1 md:space-y-0">
                    <Label className="text-xs text-muted-foreground md:sr-only">
                      {t('curriculum.editor.columns.englishName')}
                    </Label>
                    <Input
                      aria-label={t('curriculum.editor.columns.englishName')}
                      dir="ltr"
                      value={subject.nameEn ?? ''}
                      className="h-9 bg-white text-left"
                      onChange={(event) =>
                        updateGrade(selectedGrade, (draft) => ({
                          ...draft,
                          subjects: draft.subjects.map((entry) =>
                            entry.itemId === subject.itemId
                              ? { ...entry, nameEn: event.target.value }
                              : entry
                          ),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1 md:space-y-0">
                    <Label className="text-xs text-muted-foreground md:sr-only">
                      {t('curriculum.editor.columns.code')}
                    </Label>
                    <Input
                      aria-label={t('curriculum.editor.columns.code')}
                      dir="auto"
                      value={subject.code}
                      className="h-9 bg-white"
                      onChange={(event) =>
                        updateGrade(selectedGrade, (draft) => ({
                          ...draft,
                          subjects: draft.subjects.map((entry) =>
                            entry.itemId === subject.itemId
                              ? { ...entry, code: event.target.value }
                              : entry
                          ),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1 md:space-y-0">
                    <Label className="text-xs text-muted-foreground md:sr-only">
                      {t('curriculum.editor.columns.periods')}
                    </Label>
                    <Input
                      aria-label={t('curriculum.editor.columns.periods')}
                      dir="ltr"
                      type="number"
                      min={1}
                      max={84}
                      value={subject.periodsPerWeek}
                      className="h-9 bg-white text-center tabular-nums"
                      onChange={(event) =>
                        updateGrade(selectedGrade, (draft) => ({
                          ...draft,
                          subjects: draft.subjects.map((entry) =>
                            entry.itemId === subject.itemId
                              ? { ...entry, periodsPerWeek: Number(event.target.value) }
                              : entry
                          ),
                        }))
                      }
                    />
                  </div>
                  <Button
                    aria-label={t('curriculum.editor.removeSubject', {
                      name: subject.name || t('curriculum.editor.columns.name'),
                    })}
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 justify-self-end text-slate-400 hover:bg-red-50 hover:text-destructive md:justify-self-auto"
                    onClick={() =>
                      updateGrade(selectedGrade, (draft) => ({
                        ...draft,
                        subjects: draft.subjects.filter((entry) => entry.itemId !== subject.itemId),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}

            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-dashed"
              onClick={() =>
                updateGrade(selectedGrade, (draft) => ({
                  ...draft,
                  subjects: [
                    ...draft.subjects,
                    {
                      itemId: newItemId(),
                      name: '',
                      nameEn: '',
                      code: '',
                      periodsPerWeek: 1,
                    },
                  ],
                }))
              }
            >
              <Plus className="me-2 h-4 w-4" />
              {t('curriculum.actions.addSubject')}
            </Button>
          </CardContent>
        </Card>

        <section className="grid items-start gap-4 xl:grid-cols-[minmax(360px,.8fr)_minmax(620px,1.2fr)]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardPaste className="h-4 w-4 text-[#003366]" />
                    {t('curriculum.paste.title')}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t('curriculum.paste.description')}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {t('curriculum.paste.target', { grade: selectedGrade })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
              <Textarea
                dir="auto"
                value={pasteValue}
                onChange={(event) => setPasteValue(event.target.value)}
                rows={4}
                placeholder={t('curriculum.paste.placeholder')}
                className="min-h-24 resize-y bg-white font-mono text-sm"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!pasteValue.trim()}
                onClick={handlePaste}
              >
                <Plus className="me-2 h-4 w-4" />
                {t('curriculum.actions.addPastedRows')}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <School className="h-4 w-4 text-[#003366]" />
                {t('curriculum.classes.title')}
              </CardTitle>
              <CardDescription>{t('curriculum.classes.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>{t('curriculum.classes.prefix')}</Label>
                  <Input
                    dir="auto"
                    value={prefix}
                    onChange={(event) => setPrefix(event.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('curriculum.classes.separator')}</Label>
                  <Input
                    dir="ltr"
                    value={separator}
                    onChange={(event) => setSeparator(event.target.value)}
                    className="h-9 text-center"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('curriculum.classes.students')}</Label>
                  <Input
                    dir="ltr"
                    type="number"
                    min={0}
                    max={500}
                    value={studentCount}
                    onChange={(event) => setStudentCount(Number(event.target.value))}
                    className="h-9 text-center tabular-nums"
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {grades.map((grade) => (
                  <div
                    key={grade}
                    className="flex items-center gap-3 rounded-lg border bg-slate-50/60 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{t('curriculum.grade', { grade })}</div>
                      <div className="text-xs text-muted-foreground">
                        {t('curriculum.classes.existing', {
                          count: existingClassCountByGrade[grade] ?? 0,
                        })}
                      </div>
                    </div>
                    <Input
                      aria-label={t('curriculum.classes.additionalForGrade', { grade })}
                      dir="ltr"
                      className="h-8 w-16 text-center tabular-nums"
                      type="number"
                      min={0}
                      max={20}
                      value={sectionCounts[grade] ?? 0}
                      onChange={(event) =>
                        setSectionCounts((current) => ({
                          ...current,
                          [grade]: Number(event.target.value),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>

              {classProposals.length > 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                  <p className="mb-2 text-xs font-semibold text-emerald-800">
                    {t('curriculum.classes.preview')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {classProposals.map((proposal) => (
                      <Badge
                        key={proposal.name}
                        variant="secondary"
                        dir="auto"
                        className="bg-white"
                      >
                        {proposal.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </main>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl" dir={direction}>
          <DialogHeader>
            <DialogTitle>{t('curriculum.review.title')}</DialogTitle>
            <DialogDescription>{t('curriculum.review.description')}</DialogDescription>
          </DialogHeader>
          {preview ? (
            <ScrollArea className="max-h-[60vh] pe-4">
              <div className="space-y-3">
                <Alert variant={preview.canApply ? 'default' : 'destructive'}>
                  {preview.canApply ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {t(preview.canApply ? 'curriculum.review.ready' : 'curriculum.review.blocked')}
                  </AlertTitle>
                  <AlertDescription>
                    {t('curriculum.review.classSummary', {
                      created: preview.classes.create.length,
                      affected: preview.classes.totalExistingAffected,
                    })}
                  </AlertDescription>
                </Alert>

                {preview.changedGrades.map((impact) => (
                  <Card key={impact.grade} className="shadow-none">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>{t('curriculum.grade', { grade: impact.grade })}</strong>
                        <Badge variant={impact.blocker ? 'destructive' : 'outline'}>
                          {t('curriculum.editor.periodUsage', {
                            demand: impact.demand,
                            capacity: impact.capacity,
                          })}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        <span className="rounded-md bg-emerald-50 px-2 py-1.5 text-emerald-800">
                          {t('curriculum.review.added', { count: impact.subjects.added.length })}
                        </span>
                        <span className="rounded-md bg-sky-50 px-2 py-1.5 text-sky-800">
                          {t('curriculum.review.updated', {
                            count: impact.subjects.updated.length,
                          })}
                        </span>
                        <span className="rounded-md bg-red-50 px-2 py-1.5 text-red-800">
                          {t('curriculum.review.removed', {
                            count: impact.subjects.removed.length,
                          })}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-1.5 text-slate-700">
                          {t('curriculum.review.existingClasses', {
                            count: impact.existingClasses,
                          })}
                        </span>
                      </div>
                      {impact.blocker ? (
                        <p className="text-sm text-destructive">
                          {t('curriculum.review.blockedCapacity', {
                            grade: impact.grade,
                            count: Math.abs(impact.remaining),
                          })}
                        </p>
                      ) : impact.remaining > 0 ? (
                        <p className="text-sm text-amber-700">
                          {t('curriculum.review.unusedCapacity', {
                            grade: impact.grade,
                            count: impact.remaining,
                          })}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}

                {preview.assignmentRemovals.length > 0 ? (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <Checkbox
                      id="confirm-removal"
                      checked={confirmRemoval}
                      onCheckedChange={(value) => setConfirmRemoval(value === true)}
                    />
                    <Label htmlFor="confirm-removal" className="leading-5">
                      {t('curriculum.review.confirmRemoval', {
                        count: preview.assignmentRemovals.length,
                      })}
                    </Label>
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPreview(null)}>
              {t('curriculum.actions.back')}
            </Button>
            <Button
              onClick={() => void handleApply()}
              disabled={
                !preview?.canApply ||
                applyMutation.isPending ||
                Boolean(preview.assignmentRemovals.length && !confirmRemoval)
              }
              className="bg-[#003366] hover:bg-[#004488]"
            >
              {applyMutation.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t('curriculum.actions.apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
