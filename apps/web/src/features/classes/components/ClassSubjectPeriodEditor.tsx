import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check, Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ClassSubjectPeriodEditorProps {
  value: number;
  assignedPeriods?: number;
  gradeDefaultPeriods?: number | null;
  periodMode?: 'inherited' | 'class_override';
  onSave: (periodsPerWeek: number) => Promise<unknown>;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

export function ClassSubjectPeriodEditor({
  value,
  assignedPeriods = 0,
  gradeDefaultPeriods = null,
  periodMode,
  onSave,
  disabled = false,
  compact = false,
  className,
}: ClassSubjectPeriodEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setDraft(value), [value]);

  const minimum = Math.max(1, assignedPeriods);
  const valid = Number.isInteger(draft) && draft >= minimum && draft <= 84;
  const changed = draft !== value;
  const isOverride =
    periodMode === 'class_override' ||
    (gradeDefaultPeriods !== null && value !== gradeDefaultPeriods);

  const save = async () => {
    if (!changed || !valid || disabled || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(draft);
    } catch {
      setDraft(value);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {!compact && (
        <span className="text-[11px] text-slate-500">
          {t('classes.subjectRequirements.classPeriods', 'ساعات این صنف')}
        </span>
      )}
      <Input
        type="number"
        min={minimum}
        max={84}
        value={draft}
        onChange={(event) => setDraft(Number(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void save();
          }
        }}
        disabled={disabled || isSaving}
        aria-label={t('classes.subjectRequirements.classPeriods', 'ساعات این صنف')}
        className={cn('h-8 w-16 px-2 text-center font-semibold tabular-nums', !valid && 'border-red-400')}
      />
      <span className="text-[10px] text-slate-500">{t('common.periodsShort', 'ساعت')}</span>
      {changed ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => void save()}
          disabled={!valid || disabled || isSaving}
          className="h-8 w-8 border-blue-200 text-blue-700"
          aria-label={t('common.save', 'ذخیره')}
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
      ) : (
        <Badge
          variant="outline"
          className={cn(
            'h-5 px-1.5 text-[9px] font-normal',
            isOverride
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : 'border-sky-200 bg-sky-50 text-sky-700'
          )}
        >
          {isOverride
            ? t('classes.subjectRequirements.classException', 'استثنای صنف')
            : t('classes.subjectRequirements.inherited', 'برگرفته از پایه')}
        </Badge>
      )}
      {changed && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setDraft(value)}
          disabled={disabled || isSaving}
          className="h-7 w-7 text-slate-500"
          aria-label={t('common.cancel', 'انصراف')}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      )}
      {!valid && (
        <span className="text-[10px] text-red-600">
          {assignedPeriods > 0
            ? t('classes.subjectRequirements.minimumAssigned', 'کمتر از ساعات تخصیص‌شده ممکن نیست')
            : t('classes.subjectRequirements.invalidPeriods', 'بین ۱ تا ۸۴')}
        </span>
      )}
    </div>
  );
}
