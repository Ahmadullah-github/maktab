/**
 * ExportDialog Component
 * Main modal dialog for configuring export options
 *
 * Requirements: 1.1, 9.4
 */

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Download, FileChartColumn } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { exportFormSchema, type ExportFormValues } from '@/schemas/export.schema';
import { useDisplaySettings } from '../../hooks/useDisplaySettings';
import { useExportSchedule } from '../../hooks/useExportSchedule';
import type { DisplaySettings } from '../../types';
import { ExportProgress } from './ExportProgress';
import { FormatSelector } from './FormatSelector';
import { LanguageSelector } from './LanguageSelector';
import { ScopeSelector } from './ScopeSelector';
import { SettingsToggles } from './SettingsToggles';

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentScheduleId: number;
  currentType: 'class' | 'teacher';
  currentTargetId: string;
}

function getDefaultValues(displaySettings: DisplaySettings): ExportFormValues {
  return {
    format: 'pdf',
    scope: 'current',
    language: 'fa',
    showTeacherName: displaySettings.showTeacherName,
    showRoomName: displaySettings.showRoomName,
    colorBy: 'none',
    includeAnalysis: false,
  };
}

export function resolveExportTargetType(
  scope: ExportFormValues['scope'],
  currentType: 'class' | 'teacher'
): 'class' | 'teacher' {
  if (scope === 'all-classes') return 'class';
  if (scope === 'all-teachers') return 'teacher';
  return currentType;
}

/**
 * ExportDialog - Main export configuration modal
 *
 * Features:
 * - Format selection (PDF/Excel)
 * - Scope selection (Current/All Classes/All Teachers)
 * - Language selection (Persian/English)
 * - Display settings integration from Phase 4
 * - Form validation with React Hook Form + Zod
 *
 * Requirements: 1.1, 9.4
 */
export function ExportDialog({
  open,
  onOpenChange,
  currentScheduleId,
  currentType,
  currentTargetId,
}: ExportDialogProps) {
  const { t } = useTranslation();
  const { settings: displaySettings } = useDisplaySettings();
  const { exportSchedule, isExporting, progress, error, cancelExport } = useExportSchedule();
  const [submittedScope, setSubmittedScope] = useState<ExportFormValues['scope'] | null>(null);
  const wasExportingRef = useRef(false);

  // Form setup with React Hook Form and Zod validation
  const form = useForm<ExportFormValues>({
    resolver: zodResolver(exportFormSchema),
    defaultValues: getDefaultValues(displaySettings),
  });

  // Sync form with current display settings when they change
  useEffect(() => {
    form.setValue('showTeacherName', displaySettings.showTeacherName);
    form.setValue('showRoomName', displaySettings.showRoomName);
  }, [displaySettings, form]);

  // Reset transient export state whenever the dialog closes.
  useEffect(() => {
    if (!open) {
      form.reset(getDefaultValues(displaySettings));
      setSubmittedScope(null);
    }
  }, [displaySettings, form, open]);

  // Close the dialog automatically when a batch export finishes successfully.
  useEffect(() => {
    if (
      wasExportingRef.current &&
      !isExporting &&
      submittedScope !== null &&
      submittedScope !== 'current' &&
      !error
    ) {
      form.reset(getDefaultValues(displaySettings));
      setSubmittedScope(null);
      onOpenChange(false);
    }

    wasExportingRef.current = isExporting;
  }, [displaySettings, error, form, isExporting, onOpenChange, submittedScope]);

  /**
   * Handle form submission
   * Requirements: 1.1, 9.4
   */
  const onSubmit = useCallback(
    async (values: ExportFormValues) => {
      setSubmittedScope(values.scope);

      try {
        await exportSchedule({
          scheduleId: currentScheduleId,
          format: values.format,
          scope: values.scope,
          targetType: resolveExportTargetType(values.scope, currentType),
          targetId: currentTargetId,
          language: values.language,
          displaySettings: {
            showSubjectName: true,
            showTeacherName: values.showTeacherName,
            showRoomName: values.showRoomName,
            cellSize: displaySettings.cellSize,
            fontSize: displaySettings.fontSize,
            colorBy: values.colorBy,
          },
          includeAnalysis:
            values.scope !== 'current' && values.format === 'pdf' && values.includeAnalysis,
        });

        if (values.scope === 'current') {
          form.reset(getDefaultValues(displaySettings));
          setSubmittedScope(null);
          onOpenChange(false);
        }
      } catch {
        // The export hook already surfaces localized errors; keep the dialog open.
      }
    },
    [
      currentScheduleId,
      currentTargetId,
      currentType,
      displaySettings,
      exportSchedule,
      form,
      onOpenChange,
    ]
  );

  /**
   * Handle dialog close
   */
  const handleClose = useCallback(() => {
    if (isExporting) {
      return;
    }

    form.reset(getDefaultValues(displaySettings));
    setSubmittedScope(null);
    onOpenChange(false);
  }, [displaySettings, form, isExporting, onOpenChange]);

  const handleCancelExport = useCallback(async () => {
    await cancelExport();
    form.reset(getDefaultValues(displaySettings));
    setSubmittedScope(null);
    onOpenChange(false);
  }, [cancelExport, displaySettings, form, onOpenChange]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true);
        return;
      }

      handleClose();
    },
    [handleClose, onOpenChange]
  );

  const showBatchProgress = submittedScope !== null && submittedScope !== 'current' && isExporting;
  const selectedScope = form.watch('scope');
  const selectedFormat = form.watch('format');
  const selectedTargetType = resolveExportTargetType(selectedScope, currentType);
  const exportProgress =
    progress ?? {
      current: 0,
      total: 0,
      status: 'preparing' as const,
      message: t('schedule.export.progress.preparing', 'Preparing export...'),
    };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        dir="rtl"
        onEscapeKeyDown={(event: Event) => {
          if (isExporting) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event: Event) => {
          if (isExporting) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-right">
            {t('schedule.export.title', 'صادرات برنامه')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t(
              'schedule.export.description',
              'Configure the schedule export format, scope, language, and display settings.'
            )}
          </DialogDescription>
        </DialogHeader>

        {showBatchProgress ? (
          <ExportProgress progress={exportProgress} onCancel={handleCancelExport} />
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Format Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">
                {t('schedule.export.format', 'فرمت فایل')}
              </label>
              <FormatSelector
                value={form.watch('format')}
                onChange={(format) => form.setValue('format', format)}
              />
            </div>

            {/* Scope Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">
                {t('schedule.export.scope', 'محدوده صادرات')}
              </label>
              <ScopeSelector
                value={form.watch('scope')}
                onChange={(scope) => form.setValue('scope', scope)}
                currentType={currentType}
              />
            </div>

            {/* Language Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">
                {t('schedule.export.language', 'زبان')}
              </label>
              <LanguageSelector
                value={form.watch('language')}
                onChange={(language) => form.setValue('language', language)}
              />
            </div>

            {/* Display Settings */}
            <div className="space-y-3">
              <label className="text-sm font-medium">
                {t('schedule.export.displaySettings', 'تنظیمات نمایش')}
              </label>
              <SettingsToggles
                targetType={selectedTargetType}
                displaySettings={{
                  showSubjectName: true,
                  showTeacherName: form.watch('showTeacherName'),
                  showRoomName: form.watch('showRoomName'),
                  cellSize: displaySettings.cellSize,
                  fontSize: displaySettings.fontSize,
                  colorBy: form.watch('colorBy'),
                }}
                onChange={(updates) => {
                  if ('showTeacherName' in updates) {
                    form.setValue('showTeacherName', updates.showTeacherName!);
                  }
                  if ('showRoomName' in updates) {
                    form.setValue('showRoomName', updates.showRoomName!);
                  }
                  if ('colorBy' in updates) {
                    form.setValue('colorBy', updates.colorBy!);
                  }
                }}
              />
            </div>

            {selectedFormat === 'pdf' && selectedScope !== 'current' && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="include-analysis"
                    className="mt-0.5"
                    checked={form.watch('includeAnalysis')}
                    onCheckedChange={(checked: boolean | 'indeterminate') =>
                      form.setValue('includeAnalysis', checked === true)
                    }
                  />
                  <Label
                    htmlFor="include-analysis"
                    className="flex cursor-pointer items-start gap-2 font-normal"
                  >
                    <FileChartColumn className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <span className="block">
                        {t('schedule.export.includeAnalysis', 'Include analysis cover page')}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t(
                          'schedule.export.includeAnalysisDescription',
                          'Adds a summary page before the batch timetables.'
                        )}
                      </span>
                    </span>
                  </Label>
                </div>
              </div>
            )}

            {error && (
              <div
                className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-row-reverse gap-2">
              <Button type="submit" className="gap-2" disabled={isExporting}>
                <Download className="h-4 w-4" />
                {t('schedule.export.exportButton', 'صادرات')}
              </Button>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isExporting}>
                {t('schedule.export.cancel', 'لغو')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
