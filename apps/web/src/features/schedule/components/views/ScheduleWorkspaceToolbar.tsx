import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ArrowLeftRight, Check, Download, Lock, Move, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { SaveButton } from '../edit/SaveButton';
import { UndoRedoButtons } from '../edit/UndoRedoButtons';

interface ScheduleWorkspaceToolbarProps {
  title: string;
  description?: string;
  metadata?: ReactNode;
  isEditing: boolean;
  canEdit: boolean;
  onEditingChange: (editing: boolean) => void;
  unsavedCount: number;
  hasChanges: boolean;
  isSaving: boolean;
  onSave: () => void;
  canExport: boolean;
  onExport: () => void;
  onSettings: () => void;
  className?: string;
}

export function ScheduleWorkspaceToolbar({
  title,
  description,
  metadata,
  isEditing,
  canEdit,
  onEditingChange,
  unsavedCount,
  hasChanges,
  isSaving,
  onSave,
  canExport,
  onExport,
  onSettings,
  className,
}: ScheduleWorkspaceToolbarProps) {
  const { t } = useTranslation();

  return (
    <header
      className={cn(
        'border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur',
        className
      )}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
            <Badge
              variant="outline"
              className={cn(
                'h-6 gap-1.5 rounded-full px-2.5 text-[11px] font-medium',
                isEditing
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-border bg-muted/50 text-muted-foreground'
              )}
            >
              {isEditing ? <Move className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {isEditing
                ? t('editing.mode.swapEnabled', 'جابه‌جایی فعال')
                : t('editing.mode.readOnly', 'فقط مشاهده')}
            </Badge>
            {metadata}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {description ??
              (isEditing
                ? t(
                    'swap.feedback.workspaceHint',
                    'یک درس را انتخاب کنید، سپس خانه مقصد را بزنید یا درس را بکشید.'
                  )
                : t(
                    'editing.hints.enableSwap',
                    'برای جابه‌جایی درس‌ها، حالت ویرایش را فعال کنید.'
                  ))}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={isEditing ? 'default' : 'outline'}
            size="sm"
            onClick={() => onEditingChange(!isEditing)}
            disabled={!canEdit}
            className={cn(
              'h-9 gap-2 rounded-lg px-3 shadow-none',
              isEditing && 'bg-emerald-600 text-white hover:bg-emerald-700'
            )}
          >
            {isEditing ? <Check className="h-4 w-4" /> : <ArrowLeftRight className="h-4 w-4" />}
            {isEditing
              ? t('editing.actions.finishEditing', 'پایان ویرایش')
              : t('editing.actions.enableEditing', 'فعال‌سازی جابه‌جایی')}
          </Button>

          {isEditing ? (
            <div className="flex h-9 items-center rounded-lg border border-border bg-muted/25 px-1">
              <UndoRedoButtons />
              <Separator orientation="vertical" className="mx-1 h-5 w-px bg-border" />
              <SaveButton
                count={unsavedCount}
                hasChanges={hasChanges}
                isSaving={isSaving}
                onSave={onSave}
              />
            </div>
          ) : null}

          <Separator orientation="vertical" className="mx-1 hidden h-6 w-px bg-border sm:block" />

          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={!canExport}
            className="h-9 gap-2 rounded-lg px-3"
          >
            <Download className="h-4 w-4" />
            {t('schedule.export.button', 'صادرات')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettings}
            className="h-9 w-9 rounded-lg border border-transparent hover:border-border"
            aria-label={t('schedule.settings.title', 'تنظیمات نمایش')}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
