import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

import type { CellValidationStatus, DayOfWeek, ScheduledLesson } from '../../types';

export interface SwapLessonPickerOption {
  lesson: ScheduledLesson;
  status?: CellValidationStatus;
}

export interface SwapLessonPickerDialogProps {
  open: boolean;
  mode: 'source' | 'target';
  day: DayOfWeek;
  period: number;
  options: SwapLessonPickerOption[];
  onOpenChange: (open: boolean) => void;
  onSelect: (lesson: ScheduledLesson) => void;
}

function getStatusLabel(
  status: CellValidationStatus,
  t: ReturnType<typeof useTranslation>['t']
): string | null {
  switch (status) {
    case 'valid':
      return t('swap.status.valid', 'مجاز');
    case 'warning':
      return t('swap.status.warning', 'هشدار');
    case 'blocked':
      return t('swap.status.blocked', 'مسدود');
    case 'checking':
      return t('swap.status.checking', 'در حال بررسی');
    default:
      return null;
  }
}

function getStatusClasses(status: CellValidationStatus): string {
  switch (status) {
    case 'valid':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'warning':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'blocked':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'checking':
      return 'bg-sky-100 text-sky-700 border-sky-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function SwapLessonPickerDialog({
  open,
  mode,
  day,
  period,
  options,
  onOpenChange,
  onSelect,
}: SwapLessonPickerDialogProps) {
  const { t } = useTranslation();

  const title =
    mode === 'source'
      ? t('swap.lessonPicker.sourceTitle', 'درس مورد نظر را انتخاب کنید')
      : t('swap.lessonPicker.targetTitle', 'مقصد مورد نظر را انتخاب کنید');
  const description =
    mode === 'source'
      ? t(
          'swap.lessonPicker.sourceDescription',
          'در این خانه چند درس وجود دارد. ابتدا درسی را که می‌خواهید جابه‌جا شود انتخاب کنید.'
        )
      : t(
          'swap.lessonPicker.targetDescription',
          'در این خانه چند درس وجود دارد. مقصد دقیق را انتخاب کنید تا با حل‌کننده واقعی بررسی شود.'
        );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}{' '}
            {t('swap.lessonPicker.slotLabel', 'روز {{day}}، ساعت {{period}}', {
              day: day,
              period: period + 1,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {options.map((option) => {
            const teacherLabel = option.lesson.teacherNames?.join('، ') || 'بدون معلم';
            const roomLabel = option.lesson.roomName || 'بدون اتاق';
            const statusLabel = getStatusLabel(option.status ?? null, t);

            return (
              <Button
                key={`${option.lesson.classId}-${option.lesson.subjectId}-${option.lesson.day}-${option.lesson.periodIndex}`}
                type="button"
                variant="outline"
                className="h-auto w-full justify-between gap-4 px-4 py-3 text-right"
                onClick={() => onSelect(option.lesson)}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {option.lesson.className ?? option.lesson.classId}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {option.lesson.subjectName ?? option.lesson.subjectId}
                  </div>
                  <div className="truncate text-xs text-muted-foreground/80">
                    {teacherLabel} | {roomLabel}
                  </div>
                </div>

                {statusLabel ? (
                  <Badge className={cn('shrink-0 border', getStatusClasses(option.status ?? null))}>
                    {statusLabel}
                  </Badge>
                ) : null}
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SwapLessonPickerDialog;
