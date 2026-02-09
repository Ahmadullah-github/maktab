/**
 * BulkClassDialog Component
 *
 * Dialog for creating multiple classes at once with a naming pattern.
 * User specifies grade range and sections per grade.
 * Shows preview before creating.
 * Respects school settings for enabled grade levels.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSchoolSettings } from '@/features/school-settings/hooks/useSchoolSettings';
import { cn } from '@/lib/utils';
import { Copy, GraduationCap, Hash, Loader2, Sparkles, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBulkCreateClasses } from '../hooks/useClasses';
import type { ClassFormValues } from '../types';

export interface BulkClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Persian/Arabic section letters
const SECTION_LETTERS = ['الف', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ی'];

const MAX_CLASSES = 100;
const DEFAULT_STUDENT_COUNT = 30;

// Grade ranges for each level
const GRADE_RANGES = {
  primary: { start: 1, end: 6, label: 'ابتدایی' },
  middle: { start: 7, end: 9, label: 'متوسطه' },
  high: { start: 10, end: 12, label: 'لیسه' },
} as const;

export function BulkClassDialog({ open, onOpenChange }: BulkClassDialogProps) {
  const { t } = useTranslation();
  const bulkCreate = useBulkCreateClasses();
  const { data: schoolSettings } = useSchoolSettings();

  // Compute available grades based on school settings
  const availableGrades = useMemo(() => {
    const grades: number[] = [];
    if (schoolSettings?.enablePrimary) {
      for (let g = GRADE_RANGES.primary.start; g <= GRADE_RANGES.primary.end; g++) {
        grades.push(g);
      }
    }
    if (schoolSettings?.enableMiddle) {
      for (let g = GRADE_RANGES.middle.start; g <= GRADE_RANGES.middle.end; g++) {
        grades.push(g);
      }
    }
    if (schoolSettings?.enableHigh) {
      for (let g = GRADE_RANGES.high.start; g <= GRADE_RANGES.high.end; g++) {
        grades.push(g);
      }
    }
    // Fallback to all grades if no settings or nothing enabled
    if (grades.length === 0) {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    }
    return grades;
  }, [schoolSettings]);

  // Compute suggested defaults based on enabled levels
  const suggestedDefaults = useMemo(() => {
    if (!schoolSettings) return { startGrade: 1, endGrade: 6 };

    const grades = availableGrades;
    if (grades.length === 0) return { startGrade: 1, endGrade: 6 };

    return {
      startGrade: grades[0],
      endGrade: grades[grades.length - 1],
    };
  }, [schoolSettings, availableGrades]);

  // Form state
  const [prefix, setPrefix] = useState('صنف');
  const [startGrade, setStartGrade] = useState(suggestedDefaults.startGrade);
  const [endGrade, setEndGrade] = useState(suggestedDefaults.endGrade);
  const [sectionsPerGrade, setSectionsPerGrade] = useState(2);
  const [studentCount, setStudentCount] = useState(DEFAULT_STUDENT_COUNT);
  const [separator, setSeparator] = useState('-');
  const [autoSingleTeacher, setAutoSingleTeacher] = useState(true);

  // Update defaults when school settings load
  useEffect(() => {
    if (schoolSettings && open) {
      setStartGrade(suggestedDefaults.startGrade);
      setEndGrade(suggestedDefaults.endGrade);
    }
  }, [schoolSettings, suggestedDefaults, open]);

  // Generate preview classes
  const previewClasses = useMemo(() => {
    const classes: { name: string; displayName: string; data: ClassFormValues }[] = [];
    const actualSeparator = separator === 'none' ? '' : separator;

    for (let grade = startGrade; grade <= endGrade && classes.length < MAX_CLASSES; grade++) {
      for (let section = 0; section < sectionsPerGrade && classes.length < MAX_CLASSES; section++) {
        const sectionLetter = SECTION_LETTERS[section] || `${section + 1}`;
        const name = `${prefix}${actualSeparator}${grade}${actualSeparator}${sectionLetter}`;
        const displayName = `${t('classes.grade', 'صنف')} ${grade} ${sectionLetter}`;

        // Auto-enable single teacher mode for grades 1-3 (Alpha-Primary)
        const singleTeacherMode = autoSingleTeacher && grade <= 3;

        classes.push({
          name,
          displayName,
          data: {
            name,
            displayName,
            grade,
            sectionIndex: sectionLetter,
            studentCount,
            fixedRoomId: null,
            singleTeacherMode,
            classTeacherId: null,
            subjectRequirements: [],
          },
        });
      }
    }
    return classes;
  }, [
    prefix,
    startGrade,
    endGrade,
    sectionsPerGrade,
    studentCount,
    separator,
    autoSingleTeacher,
    t,
  ]);

  // Stats for preview
  const stats = useMemo(() => {
    const singleTeacherCount = previewClasses.filter((c) => c.data.singleTeacherMode).length;
    return {
      total: previewClasses.length,
      singleTeacher: singleTeacherCount,
      multiTeacher: previewClasses.length - singleTeacherCount,
    };
  }, [previewClasses]);

  const handleCreate = async () => {
    const classesData = previewClasses.map((c) => c.data);
    await bulkCreate.mutateAsync(classesData);
    onOpenChange(false);
    // Reset form
    setPrefix('صنف');
    setStartGrade(1);
    setEndGrade(6);
    setSectionsPerGrade(2);
    setStudentCount(DEFAULT_STUDENT_COUNT);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] p-0 gap-0 overflow-hidden bg-white border-0 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-linear-to-br from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md">
              <Copy className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t('classes.bulk.title', 'ایجاد دسته‌ای صنف‌ها')}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                {t('classes.bulk.description', 'چندین صنف را با یک الگوی نام‌گذاری ایجاد کنید')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5 bg-white">
          {/* Enabled Levels Info */}
          {schoolSettings && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-xs text-blue-700">
                {t('classes.bulk.enabledLevels', 'مقاطع فعال:')}
              </span>
              <div className="flex gap-1.5">
                {schoolSettings.enablePrimary && (
                  <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700">
                    {t('classes.bulk.primary', 'ابتدایی')} (۱-۶)
                  </Badge>
                )}
                {schoolSettings.enableMiddle && (
                  <Badge variant="secondary" className="text-[10px] bg-sky-100 text-sky-700">
                    {t('classes.bulk.middle', 'متوسطه')} (۷-۹)
                  </Badge>
                )}
                {schoolSettings.enableHigh && (
                  <Badge variant="secondary" className="text-[10px] bg-rose-100 text-rose-700">
                    {t('classes.bulk.high', 'لیسه')} (۱۰-۱۲)
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Naming Pattern Section */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <h3 className="font-medium text-sm text-slate-800">
                {t('classes.bulk.namingPattern', 'الگوی نام‌گذاری')}
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Prefix */}
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">
                  {t('classes.bulk.prefix', 'پیشوند')}
                </Label>
                <Input
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="صنف"
                  className="h-9 border-slate-200 focus:border-emerald-400"
                />
              </div>

              {/* Separator */}
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">
                  {t('classes.bulk.separator', 'جداکننده')}
                </Label>
                <Select value={separator} onValueChange={setSeparator}>
                  <SelectTrigger className="h-9 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-">-</SelectItem>
                    <SelectItem value="_">_</SelectItem>
                    <SelectItem value=" ">(فاصله)</SelectItem>
                    <SelectItem value="none">(بدون)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sections per grade */}
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">
                  {t('classes.bulk.sectionsPerGrade', 'شعبه در هر صنف')}
                </Label>
                <Select
                  value={String(sectionsPerGrade)}
                  onValueChange={(v: string) => setSectionsPerGrade(parseInt(v))}
                >
                  <SelectTrigger className="h-9 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {t('classes.bulk.sections', 'شعبه')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview of pattern */}
            <div className="mt-3 p-2 bg-white rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 mb-1">{t('classes.bulk.example', 'نمونه:')}</p>
              <p className="font-mono text-sm text-emerald-600">
                {prefix}
                {separator === 'none' ? '' : separator}
                {startGrade}
                {separator === 'none' ? '' : separator}
                الف, {prefix}
                {separator === 'none' ? '' : separator}
                {startGrade}
                {separator === 'none' ? '' : separator}
                ب...
              </p>
            </div>
          </div>

          {/* Grade Range & Defaults Section */}
          <div className="grid grid-cols-4 gap-4">
            {/* Start Grade */}
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">
                <GraduationCap className="h-3 w-3 inline me-1" />
                {t('classes.bulk.startGrade', 'از صنف')}
              </Label>
              <Select
                value={String(startGrade)}
                onValueChange={(v: string) => setStartGrade(parseInt(v))}
              >
                <SelectTrigger className="h-9 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableGrades.map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      {t('classes.bulk.gradeN', 'صنف {{n}}', { n: g })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* End Grade */}
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">
                {t('classes.bulk.endGrade', 'تا صنف')}
              </Label>
              <Select
                value={String(endGrade)}
                onValueChange={(v: string) => setEndGrade(parseInt(v))}
              >
                <SelectTrigger className="h-9 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableGrades
                    .filter((g) => g >= startGrade)
                    .map((g) => (
                      <SelectItem key={g} value={String(g)}>
                        {t('classes.bulk.gradeN', 'صنف {{n}}', { n: g })}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Student Count */}
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">
                <Users className="h-3 w-3 inline me-1" />
                {t('classes.bulk.studentCount', 'تعداد دانش‌آموز')}
              </Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={studentCount}
                onChange={(e) => setStudentCount(parseInt(e.target.value) || DEFAULT_STUDENT_COUNT)}
                className="h-9 border-slate-200 focus:border-emerald-400"
              />
            </div>

            {/* Total Count Display */}
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">
                <Hash className="h-3 w-3 inline me-1" />
                {t('classes.bulk.totalClasses', 'مجموع صنف‌ها')}
              </Label>
              <div className="h-9 px-3 flex items-center bg-emerald-50 border border-emerald-200 rounded-md">
                <span className="text-emerald-700 font-semibold">{previewClasses.length}</span>
              </div>
            </div>
          </div>

          {/* Single Teacher Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-violet-50 rounded-lg border border-violet-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {t('classes.bulk.autoSingleTeacher', 'حالت تک‌معلم خودکار')}
                </p>
                <p className="text-xs text-slate-500">
                  {t('classes.bulk.autoSingleTeacherHint', 'برای صنف‌های ۱-۳ فعال می‌شود')}
                </p>
              </div>
            </div>
            <Switch checked={autoSingleTeacher} onCheckedChange={setAutoSingleTeacher} />
          </div>

          {/* Preview Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-slate-600">
                {t('classes.bulk.preview', 'پیش‌نمایش')} ({previewClasses.length}{' '}
                {t('classes.bulk.classes', 'صنف')})
              </Label>
              <div className="flex gap-2">
                {stats.singleTeacher > 0 && (
                  <Badge variant="secondary" className="text-[10px] bg-violet-50 text-violet-700">
                    {stats.singleTeacher} {t('classes.bulk.singleTeacher', 'تک‌معلم')}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">
                  {studentCount} {t('classes.bulk.studentsEach', 'دانش‌آموز')}
                </Badge>
              </div>
            </div>
            <ScrollArea className="h-[140px] rounded-lg border border-slate-200 bg-white">
              <div className="p-3 flex flex-wrap gap-2">
                {previewClasses.map((cls, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className={cn(
                      'text-xs px-2.5 py-1 bg-white border-slate-200 text-slate-700',
                      cls.data.singleTeacherMode &&
                        'border-violet-300 bg-violet-50 text-violet-700',
                      idx < 3 &&
                        !cls.data.singleTeacherMode &&
                        'border-emerald-300 bg-emerald-50 text-emerald-700'
                    )}
                  >
                    {cls.displayName}
                  </Badge>
                ))}
              </div>
            </ScrollArea>
            {previewClasses.length >= MAX_CLASSES && (
              <p className="text-[10px] text-amber-600 mt-1">
                {t('classes.bulk.maxReached', 'حداکثر {{max}} صنف در هر بار', { max: MAX_CLASSES })}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-slate-50">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={bulkCreate.isPending}
          >
            {t('common.cancel', 'انصراف')}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={bulkCreate.isPending || previewClasses.length === 0 || !prefix.trim()}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {bulkCreate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('classes.bulk.create', 'ایجاد {{count}} صنف', { count: previewClasses.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BulkClassDialog;
