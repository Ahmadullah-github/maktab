import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { classesApi } from '@/features/classes/api';
import { invalidateClassCaches, invalidateSubjectCaches } from '@/lib/queryKeys';
import { ApiError } from '@/lib/api';
import { useNavigationGuardStore } from '@/stores/navigationGuardStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBlocker } from '@tanstack/react-router';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardPaste,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { schoolCurriculumApi } from '../api';
import type {
  CurriculumItem,
  CurriculumPlan,
  CurriculumPreview,
  ProposedCurriculumClass,
} from '../types';

type Drafts = Record<number, CurriculumItem[]>;

interface RowIssue {
  row: number;
  field: string;
  message: string;
}

const SECTION_LETTERS = ['الف', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ی'];

function newId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    return (token === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function draftSnapshot(drafts: Drafts): string {
  return JSON.stringify(
    Object.entries(drafts).map(([grade, items]) => [
      Number(grade),
      items.map(({ normalizedCode: _normalizedCode, ...item }) => item),
    ])
  );
}

function planDrafts(plan: CurriculumPlan): Drafts {
  return Object.fromEntries(plan.grades.map((entry) => [entry.grade, entry.items]));
}

function normalizeCode(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('fa');
}

export function validateGradeDraft(items: CurriculumItem[]): RowIssue[] {
  const issues: RowIssue[] = [];
  const codes = new Map<string, number>();
  items.forEach((item, row) => {
    if (!item.name.trim()) issues.push({ row, field: 'name', message: 'نام مضمون ضروری است.' });
    const code = normalizeCode(item.code);
    if (!code) issues.push({ row, field: 'code', message: 'کد مضمون ضروری است.' });
    else if (codes.has(code)) issues.push({ row, field: 'code', message: `کد در ردیف ${Number(codes.get(code)) + 1} تکرار شده است.` });
    codes.set(code, row);
    if (!Number.isInteger(item.weeklyPeriods) || item.weeklyPeriods < 1 || item.weeklyPeriods > 84) {
      issues.push({ row, field: 'weeklyPeriods', message: 'ساعات هفتگی باید بین ۱ و ۸۴ باشد.' });
    }
    if (item.requiredRoomType && !/^[a-z0-9_-]+$/.test(item.requiredRoomType)) {
      issues.push({ row, field: 'requiredRoomType', message: 'نوع اتاق باید یک کد لاتین معتبر باشد.' });
    }
  });
  return issues;
}

export function parseCurriculumPaste(text: string): { items: CurriculumItem[]; issues: RowIssue[] } {
  const issues: RowIssue[] = [];
  const items = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, row) => {
      const columns = line.split(line.includes('\t') ? '\t' : ',').map((value) => value.trim());
      const [name = '', nameEn = '', code = '', periods = '', difficulty = '', room = ''] = columns;
      const weeklyPeriods = Number(periods);
      const difficultValue = difficulty.toLocaleLowerCase();
      const validDifficulty = !difficulty || ['1', '0', 'true', 'false', 'yes', 'no', 'بلی', 'خیر'].includes(difficultValue);
      if (columns.length < 4) issues.push({ row, field: 'row', message: 'حداقل نام، نام انگلیسی، کد و ساعات لازم است.' });
      if (!validDifficulty) issues.push({ row, field: 'isDifficult', message: 'مقدار دشواری معتبر نیست.' });
      return {
        id: newId(),
        name,
        nameEn: nameEn || null,
        code,
        normalizedCode: normalizeCode(code),
        weeklyPeriods,
        isDifficult: ['1', 'true', 'yes', 'بلی'].includes(difficultValue),
        requiredRoomType: room.toLowerCase() || null,
      };
    });
  return { items, issues: [...issues, ...validateGradeDraft(items)] };
}

function apiConflictCode(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.payload || typeof error.payload !== 'object') return null;
  return typeof error.payload.code === 'string' ? error.payload.code : null;
}

export function SchoolCurriculumPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const setDirty = useNavigationGuardStore((state) => state.setDirty);
  const setHasRouteBlocker = useNavigationGuardStore((state) => state.setHasRouteBlocker);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [baseline, setBaseline] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [pasteIssues, setPasteIssues] = useState<RowIssue[]>([]);
  const [preview, setPreview] = useState<CurriculumPreview | null>(null);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState<Set<number>>(new Set());
  const [classPrefix, setClassPrefix] = useState('صنف');
  const [classCount, setClassCount] = useState(0);
  const [studentCount, setStudentCount] = useState(30);
  const [staleMessage, setStaleMessage] = useState<string | null>(null);
  const loadedRevision = useRef<number | null>(null);

  const planQuery = useQuery({
    queryKey: ['school-curriculum', 'plan'],
    queryFn: () => schoolCurriculumApi.getPlan(),
  });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: classesApi.getAll });
  const isDirty = baseline !== '' && baseline !== draftSnapshot(drafts);
  useBlocker({
    shouldBlockFn: () => isDirty && !window.confirm(t('schoolCurriculum.unsavedConfirm')),
    enableBeforeUnload: isDirty,
  });

  useEffect(() => {
    setHasRouteBlocker(true);
    return () => setHasRouteBlocker(false);
  }, [setHasRouteBlocker]);
  useEffect(() => {
    setDirty(isDirty);
    return () => setDirty(false);
  }, [isDirty, setDirty]);
  useEffect(() => {
    if (!planQuery.data) return;
    if (loadedRevision.current === planQuery.data.revision) return;
    const next = planDrafts(planQuery.data);
    setDrafts(next);
    setBaseline(draftSnapshot(next));
    setSelectedGrade((current) =>
      current && planQuery.data.activeGrades.includes(current)
        ? current
        : (planQuery.data.activeGrades[0] ?? null)
    );
    loadedRevision.current = planQuery.data.revision;
  }, [planQuery.data]);

  const selectedItems = selectedGrade ? drafts[selectedGrade] ?? [] : [];
  const localIssues = useMemo(() => validateGradeDraft(selectedItems), [selectedItems]);
  const gradeMeta = planQuery.data?.grades.find((entry) => entry.grade === selectedGrade);
  const totalPeriods = selectedItems.reduce((sum, item) => sum + (Number.isFinite(item.weeklyPeriods) ? item.weeklyPeriods : 0), 0);
  const weeklyCapacity = gradeMeta?.capacity.weeklyCapacity ?? 0;
  const changedGrades = useMemo(() => {
    if (!planQuery.data) return [];
    const original = planDrafts(planQuery.data);
    return planQuery.data.activeGrades.filter(
      (grade) => JSON.stringify(original[grade]) !== JSON.stringify(drafts[grade] ?? [])
    );
  }, [drafts, planQuery.data]);
  const proposedClasses = useMemo<ProposedCurriculumClass[]>(() => {
    if (!selectedGrade) return [];
    return Array.from({ length: classCount }, (_, index) => {
      const section = SECTION_LETTERS[index] ?? String(index + 1);
      return {
        name: `${classPrefix}-${selectedGrade}-${section}`,
        displayName: `صنف ${selectedGrade} ${section}`,
        grade: selectedGrade,
        sectionIndex: section,
        studentCount,
        singleTeacherMode: selectedGrade <= 3,
        academicYearId: null,
      };
    });
  }, [classCount, classPrefix, selectedGrade, studentCount]);

  const updateItem = useCallback(
    (id: string, patch: Partial<CurriculumItem>) => {
      if (!selectedGrade) return;
      setDrafts((current) => ({
        ...current,
        [selectedGrade]: (current[selectedGrade] ?? []).map((item) =>
          item.id === id
            ? { ...item, ...patch, normalizedCode: normalizeCode(patch.code ?? item.code) }
            : item
        ),
      }));
    },
    [selectedGrade]
  );

  const templateMutation = useMutation({
    mutationFn: () => schoolCurriculumApi.getAfghanistanTemplate(),
    onSuccess: (template) => {
      if (!selectedGrade) return;
      const grade = template.grades.find((entry) => entry.grade === selectedGrade);
      if (!grade) return;
      if (!window.confirm(t('schoolCurriculum.templateConfirm', { grade: selectedGrade }))) return;
      setDrafts((current) => ({ ...current, [selectedGrade]: grade.items }));
      setPasteIssues([]);
    },
    onError: (error: Error) => toast.error('دریافت قالب ممکن نشد', { description: error.message }),
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!planQuery.data) throw new Error('برنامه درسی بارگذاری نشده است.');
      const allIssues = changedGrades.flatMap((grade) => validateGradeDraft(drafts[grade] ?? []));
      if (allIssues.length > 0) throw new Error(allIssues[0].message);
      if (changedGrades.some((grade) => {
        const meta = planQuery.data?.grades.find((entry) => entry.grade === grade);
        const total = (drafts[grade] ?? []).reduce((sum, item) => sum + item.weeklyPeriods, 0);
        return total > (meta?.capacity.weeklyCapacity ?? 0);
      })) throw new Error('ساعات یکی از صنف‌ها از ظرفیت هفتگی بیشتر است.');
      return schoolCurriculumApi.preview({
        revision: planQuery.data.revision,
        changedGrades: changedGrades.map((grade) => ({
          grade,
          items: (drafts[grade] ?? []).map(({ normalizedCode: _normalizedCode, ...item }) => item),
        })),
        synchronizeClassIds: [...selectedClassIds],
        proposedClasses,
      });
    },
    onSuccess: (result) => {
      setStaleMessage(null);
      setConfirmRemoval(false);
      setPreview(result);
    },
    onError: (error: Error) => toast.error('پیش‌نمایش ممکن نشد', { description: error.message }),
  });

  const applyMutation = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error('پیش‌نمایش موجود نیست.');
      return schoolCurriculumApi.apply(preview.previewToken, confirmRemoval);
    },
    onSuccess: async () => {
      setPreview(null);
      setConfirmRemoval(false);
      setSelectedClassIds(new Set());
      setClassCount(0);
      invalidateSubjectCaches(queryClient);
      invalidateClassCaches(queryClient);
      await queryClient.invalidateQueries({ queryKey: ['school-curriculum'] });
      toast.success(t('schoolCurriculum.success'));
    },
    onError: (error: Error) => {
      const code = apiConflictCode(error);
      if (['PREVIEW_EXPIRED', 'CURRICULUM_REVISION_STALE', 'PREVIEW_CHANGED'].includes(code ?? '')) {
        setPreview(null);
        setStaleMessage('اطلاعات پس از پیش‌نمایش تغییر کرده است. صفحه را تازه کنید و دوباره مرور نمایید.');
      }
      toast.error('اعمال برنامه ممکن نشد', { description: error.message });
    },
  });

  const handlePaste = () => {
    if (!selectedGrade) return;
    const parsed = parseCurriculumPaste(pasteText);
    setPasteIssues(parsed.issues);
    if (parsed.items.length > 0) {
      setDrafts((current) => ({
        ...current,
        [selectedGrade]: [...(current[selectedGrade] ?? []), ...parsed.items],
      }));
      setPasteText('');
    }
  };

  if (planQuery.isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (planQuery.error || !planQuery.data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p>{navigator.onLine ? t('schoolCurriculum.loadingError') : t('schoolCurriculum.offlineError')}</p>
        <Button variant="outline" onClick={() => void planQuery.refetch()}><RefreshCw className="me-2 h-4 w-4" />{t('schoolCurriculum.retry')}</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50" dir={i18n.dir()}>
      <PageHeader
        icon={BookOpenCheck}
        title={t('schoolCurriculum.title')}
        subtitle={t('schoolCurriculum.subtitle', { revision: planQuery.data.revision })}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => templateMutation.mutate()} disabled={!selectedGrade || templateMutation.isPending}>
              <Sparkles className="me-2 h-4 w-4" />{t('schoolCurriculum.template')}
            </Button>
            <Button onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending || (changedGrades.length === 0 && selectedClassIds.size === 0 && proposedClasses.length === 0)}>
              {previewMutation.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
              {t('schoolCurriculum.reviewApply')}
            </Button>
          </div>
        }
      />

      {staleMessage && <Alert variant="destructive" className="mx-4 mt-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>{t('schoolCurriculum.staleTitle')}</AlertTitle><AlertDescription>{staleMessage}</AlertDescription></Alert>}

      <div className="flex-1 min-h-0 overflow-auto p-4">
        <Tabs value={selectedGrade ? String(selectedGrade) : undefined} onValueChange={(value) => setSelectedGrade(Number(value))}>
          <TabsList className="mb-4 h-auto flex-wrap justify-start">
            {planQuery.data.activeGrades.map((grade) => (
              <TabsTrigger key={grade} value={String(grade)} className="gap-2">
                {t('schoolCurriculum.grade', { grade })}
                {(drafts[grade]?.length ?? 0) > 0 && <Badge variant="secondary">{drafts[grade].length}</Badge>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {selectedGrade && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
            <Card className="min-w-0">
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle>{t('schoolCurriculum.subjects', { grade: selectedGrade })}</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setDrafts((current) => ({
                  ...current,
                  [selectedGrade]: [...(current[selectedGrade] ?? []), {
                    id: newId(), name: '', nameEn: null, code: '', normalizedCode: '', weeklyPeriods: 1, isDifficult: false, requiredRoomType: null,
                  }],
                }))}><Plus className="me-2 h-4 w-4" />{t('schoolCurriculum.addRow')}</Button>
              </CardHeader>
              <CardContent className="overflow-x-auto px-0 sm:px-6">
                {selectedItems.length === 0 ? (
                  <div className="py-14 text-center text-muted-foreground">{t('schoolCurriculum.empty')}</div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t('schoolCurriculum.columns.name')}</TableHead><TableHead>{t('schoolCurriculum.columns.nameEn')}</TableHead><TableHead>{t('schoolCurriculum.columns.code')}</TableHead><TableHead>{t('schoolCurriculum.columns.periods')}</TableHead><TableHead>{t('schoolCurriculum.columns.difficult')}</TableHead><TableHead>{t('schoolCurriculum.columns.room')}</TableHead><TableHead><span className="sr-only">حذف</span></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {selectedItems.map((item, index) => {
                        const rowIssues = localIssues.filter((issue) => issue.row === index);
                        return (
                          <Fragment key={item.id}>
                          <TableRow className={rowIssues.length ? 'bg-red-50' : ''}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell><Input aria-label={`نام ردیف ${index + 1}`} value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} /></TableCell>
                            <TableCell><Input aria-label={`نام انگلیسی ردیف ${index + 1}`} dir="ltr" value={item.nameEn ?? ''} onChange={(event) => updateItem(item.id, { nameEn: event.target.value || null })} /></TableCell>
                            <TableCell><Input aria-label={`کد ردیف ${index + 1}`} value={item.code} onChange={(event) => updateItem(item.id, { code: event.target.value })} /></TableCell>
                            <TableCell><Input aria-label={`ساعات ردیف ${index + 1}`} className="w-20" type="number" min={1} max={84} value={item.weeklyPeriods} onChange={(event) => updateItem(item.id, { weeklyPeriods: Number(event.target.value) })} /></TableCell>
                            <TableCell><Checkbox aria-label={`دشواری ردیف ${index + 1}`} checked={item.isDifficult} onCheckedChange={(checked) => updateItem(item.id, { isDifficult: checked === true })} /></TableCell>
                            <TableCell><Input aria-label={`نوع اتاق ردیف ${index + 1}`} dir="ltr" placeholder="lab" value={item.requiredRoomType ?? ''} onChange={(event) => updateItem(item.id, { requiredRoomType: event.target.value.toLowerCase() || null })} /></TableCell>
                            <TableCell><Button aria-label={`حذف ردیف ${index + 1}`} size="icon" variant="ghost" onClick={() => setDrafts((current) => ({ ...current, [selectedGrade]: current[selectedGrade].filter((entry) => entry.id !== item.id) }))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                          </TableRow>
                          {rowIssues.length > 0 && (
                            <TableRow className="bg-red-50">
                              <TableCell colSpan={8} className="text-xs text-destructive">
                                ردیف {index + 1}: {rowIssues.map((issue) => issue.message).join(' ')}
                              </TableCell>
                            </TableRow>
                          )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card><CardHeader><CardTitle className="text-base">{t('schoolCurriculum.capacity.title')}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>{t('schoolCurriculum.capacity.planned')}</span><strong>{totalPeriods}</strong></div>
                <div className="flex justify-between"><span>{t('schoolCurriculum.capacity.available')}</span><strong>{weeklyCapacity}</strong></div>
                <div className="flex justify-between"><span>{t('schoolCurriculum.capacity.free')}</span><strong className={weeklyCapacity - totalPeriods < 0 ? 'text-destructive' : 'text-emerald-600'}>{weeklyCapacity - totalPeriods}</strong></div>
                <div className="flex justify-between"><span>{t('schoolCurriculum.capacity.classes')}</span><strong>{gradeMeta?.affectedClassCount ?? 0}</strong></div>
              </CardContent></Card>

              <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardPaste className="h-4 w-4" />{t('schoolCurriculum.paste.title')}</CardTitle></CardHeader><CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{t('schoolCurriculum.paste.hint')}</p>
                <Textarea dir="auto" value={pasteText} onChange={(event) => setPasteText(event.target.value)} rows={5} placeholder={'ترکی\tTurkish\tTR7\t2\tfalse\tnormal'} />
                <Button variant="secondary" className="w-full" onClick={handlePaste} disabled={!pasteText.trim()}>{t('schoolCurriculum.paste.action')}</Button>
                {pasteIssues.length > 0 && <Alert variant="destructive"><AlertDescription>{pasteIssues.slice(0, 3).map((issue) => `ردیف ${issue.row + 1}: ${issue.message}`).join(' ')}</AlertDescription></Alert>}
              </CardContent></Card>

              <Card><CardHeader><CardTitle className="text-base">{t('schoolCurriculum.sync.title')}</CardTitle></CardHeader><CardContent className="max-h-52 space-y-2 overflow-auto">
                {(classesQuery.data ?? []).map((classGroup) => (
                  <Label key={classGroup.id} className="flex items-center gap-2 rounded border p-2 font-normal">
                    <Checkbox checked={selectedClassIds.has(classGroup.id)} onCheckedChange={(checked) => setSelectedClassIds((current) => {
                      const next = new Set(current); if (checked === true) next.add(classGroup.id); else next.delete(classGroup.id); return next;
                    })} />
                    {classGroup.displayName || classGroup.name} <span className="text-muted-foreground">(صنف {classGroup.grade ?? '—'})</span>
                  </Label>
                ))}
              </CardContent></Card>

              <Card><CardHeader><CardTitle className="text-base">{t('schoolCurriculum.create.title')}</CardTitle></CardHeader><CardContent className="space-y-3">
                <div><Label htmlFor="class-prefix">{t('schoolCurriculum.create.prefix')}</Label><Input id="class-prefix" value={classPrefix} onChange={(event) => setClassPrefix(event.target.value)} /></div>
                <div className="grid grid-cols-2 gap-2"><div><Label htmlFor="class-count">{t('schoolCurriculum.create.count')}</Label><Input id="class-count" type="number" min={0} max={10} value={classCount} onChange={(event) => setClassCount(Math.max(0, Math.min(10, Number(event.target.value))))} /></div><div><Label htmlFor="student-count">{t('schoolCurriculum.create.students')}</Label><Input id="student-count" type="number" min={0} max={500} value={studentCount} onChange={(event) => setStudentCount(Number(event.target.value))} /></div></div>
                {proposedClasses.length > 0 && <div className="flex flex-wrap gap-1">{proposedClasses.map((entry) => <Badge key={entry.name} variant="outline">{entry.name}</Badge>)}</div>}
              </CardContent></Card>
            </div>
          </div>
        )}
      </div>

      <Dialog open={preview !== null} onOpenChange={(open) => { if (!open && !applyMutation.isPending) setPreview(null); }}>
        <DialogContent className="max-h-[90vh] max-w-3xl" dir={i18n.dir()}>
          <DialogHeader><DialogTitle>{t('schoolCurriculum.review.title')}</DialogTitle><DialogDescription>{t('schoolCurriculum.review.description')}</DialogDescription></DialogHeader>
          {preview && <ScrollArea className="max-h-[58vh] pe-3"><div className="space-y-4">
            {preview.blockers.length > 0 && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>{t('schoolCurriculum.review.blocked')}</AlertTitle><AlertDescription>{preview.blockers.map((entry) => entry.message).join(' ')}</AlertDescription></Alert>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card><CardContent className="p-3 text-center"><strong className="block text-xl">{preview.subjectActions.length}</strong><span className="text-xs text-muted-foreground">{t('schoolCurriculum.review.subjects')}</span></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><strong className="block text-xl">{preview.affectedClasses.length}</strong><span className="text-xs text-muted-foreground">{t('schoolCurriculum.review.classes')}</span></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><strong className="block text-xl">{preview.affectedRequirements.length}</strong><span className="text-xs text-muted-foreground">{t('schoolCurriculum.review.requirements')}</span></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><strong className="block text-xl">{preview.proposedClasses.length}</strong><span className="text-xs text-muted-foreground">{t('schoolCurriculum.review.newClasses')}</span></CardContent></Card>
            </div>
            {preview.subjectActions.length > 0 && <section><h3 className="mb-2 font-semibold">مضامین</h3><div className="space-y-1">{preview.subjectActions.map((action) => <div key={`${action.action}-${action.curriculumItemId}`} className="flex justify-between rounded border p-2 text-sm"><span>{action.name} — صنف {action.grade}</span><Badge variant={action.action === 'archive' ? 'destructive' : 'secondary'}>{action.action}</Badge></div>)}</div></section>}
            {preview.affectedClasses.length > 0 && <section><h3 className="mb-2 font-semibold">صنف‌های متأثر</h3><div className="flex flex-wrap gap-1">{preview.affectedClasses.map((entry) => <Badge key={entry.id} variant="outline">{entry.name}</Badge>)}</div></section>}
            {preview.proposedClasses.length > 0 && <section><h3 className="mb-2 font-semibold">{t('schoolCurriculum.review.newClasses')}</h3><div className="flex flex-wrap gap-1">{preview.proposedClasses.map((entry) => <Badge key={`${entry.grade}-${entry.name}`} variant="outline">{entry.name}</Badge>)}</div></section>}
            {(preview.assignmentImpacts.length > 0 || preview.capabilityImpacts.length > 0) && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>{t('schoolCurriculum.review.teacherRemoval')}</AlertTitle><AlertDescription>{t('schoolCurriculum.review.teacherRemovalCount', { assignments: preview.assignmentImpacts.reduce((sum, entry) => sum + entry.assignmentCount, 0), capabilities: preview.capabilityImpacts.reduce((sum, entry) => sum + entry.capabilityCount, 0) })}<Label className="mt-3 flex items-center gap-2"><Checkbox checked={confirmRemoval} onCheckedChange={(checked) => setConfirmRemoval(checked === true)} />{t('schoolCurriculum.review.confirmRemoval')}</Label></AlertDescription></Alert>}
            {preview.warnings.map((warning) => <Alert key={warning.code}><AlertTriangle className="h-4 w-4" /><AlertDescription>{warning.message}</AlertDescription></Alert>)}
          </div></ScrollArea>}
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setPreview(null)} disabled={applyMutation.isPending}>{t('schoolCurriculum.review.back')}</Button><Button onClick={() => applyMutation.mutate()} disabled={!preview || preview.blockers.length > 0 || applyMutation.isPending || ((preview.assignmentImpacts.length > 0 || preview.capabilityImpacts.length > 0) && !confirmRemoval)}>{applyMutation.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="me-2 h-4 w-4" />}{t('schoolCurriculum.review.apply')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
