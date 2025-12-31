/**
 * ExportDialog Component
 * Main modal dialog for configuring export options
 *
 * Requirements: 1.1, 9.4
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { Download } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { exportFormSchema, type ExportFormValues } from '@/schemas/export.schema';
import { useDisplaySettings } from '../../hooks/useDisplaySettings';
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

  // Form setup with React Hook Form and Zod validation
  const form = useForm<ExportFormValues>({
    resolver: zodResolver(exportFormSchema),
    defaultValues: {
      format: 'pdf',
      scope: 'current',
      language: 'fa',
      showTeacherName: displaySettings.showTeacherName,
      showRoomName: displaySettings.showRoomName,
      colorBy: displaySettings.colorBy,
    },
  });

  // Sync form with current display settings when they change
  useEffect(() => {
    form.setValue('showTeacherName', displaySettings.showTeacherName);
    form.setValue('showRoomName', displaySettings.showRoomName);
    form.setValue('colorBy', displaySettings.colorBy);
  }, [displaySettings, form]);

  /**
   * Handle form submission
   * Requirements: 1.1, 9.4
   */
  const onSubmit = useCallback(
    (values: ExportFormValues) => {
      console.log('Export form submitted:', {
        scheduleId: currentScheduleId,
        targetType: currentType,
        targetId: currentTargetId,
        ...values,
      });

      // TODO: Implement actual export logic in subsequent tasks
      // This will be connected to useExportSchedule hook

      // Close dialog after submission
      onOpenChange(false);
    },
    [currentScheduleId, currentType, currentTargetId, onOpenChange]
  );

  /**
   * Handle dialog close
   */
  const handleClose = useCallback(() => {
    form.reset();
    onOpenChange(false);
  }, [form, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {t('schedule.export.title', 'صادرات برنامه')}
          </DialogTitle>
        </DialogHeader>

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
            <label className="text-sm font-medium">{t('schedule.export.language', 'زبان')}</label>
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
              displaySettings={{
                showSubjectName: true, // Always true
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

          <DialogFooter className="flex-row-reverse gap-2">
            <Button type="submit" className="gap-2">
              <Download className="h-4 w-4" />
              {t('schedule.export.exportButton', 'صادرات')}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose}>
              {t('schedule.export.cancel', 'لغو')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
