/**
 * BulkApplyCurriculumDialog Component
 *
 * Phase 3.4: Confirmation dialog for bulk curriculum application
 *
 * Features:
 * - Shows summary of classes to be updated
 * - Overwrite checkbox with warning
 * - Progress indicator during operation
 * - Success/failure summary
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle, BookOpen, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBulkApplyCurriculum } from '../hooks/useBulkApplyCurriculum';

// ============================================================================
// Types
// ============================================================================

export interface BulkApplyCurriculumDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Array of selected class IDs. Empty array means "apply to all without curriculum" */
  classIds: number[];
  /** Mode: 'selected' for specific classes, 'all' for all classes without curriculum */
  mode: 'selected' | 'all';
  /** Number of classes that will be affected (for display) */
  affectedCount?: number;
}

// ============================================================================
// Component
// ============================================================================

export function BulkApplyCurriculumDialog({
  open,
  onOpenChange,
  classIds,
  mode,
  affectedCount,
}: BulkApplyCurriculumDialogProps) {
  const { t } = useTranslation();
  const [overwrite, setOverwrite] = useState(false);
  const { mutate, isPending } = useBulkApplyCurriculum();

  const handleConfirm = () => {
    mutate(
      { classIds, overwrite },
      {
        onSuccess: () => {
          onOpenChange(false);
          setOverwrite(false);
        },
      }
    );
  };

  const handleCancel = () => {
    onOpenChange(false);
    setOverwrite(false);
  };

  const confirmMessage =
    mode === 'selected'
      ? t('classes.curriculum.bulkApplyConfirm')
      : t('classes.curriculum.bulkApplyAllConfirm');

  const displayCount = affectedCount ?? classIds.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md" dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-emerald-600" />
            {t('classes.curriculum.bulkApplyTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-right">{confirmMessage}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4 space-y-4">
          {/* Affected count */}
          {displayCount > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
              {t('classes.curriculum.classesWillUpdate', { count: displayCount })}
            </div>
          )}

          {/* Overwrite option */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="overwrite"
              checked={overwrite}
              onCheckedChange={(checked: boolean | 'indeterminate') =>
                setOverwrite(checked === true)
              }
              disabled={isPending}
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="overwrite" className="text-sm font-medium cursor-pointer">
                {t('classes.curriculum.overwriteExisting')}
              </Label>
              {overwrite && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {t('classes.curriculum.overwriteWarning')}
                </div>
              )}
            </div>
          </div>
        </div>

        <AlertDialogFooter className="flex-row-reverse gap-2">
          <AlertDialogCancel onClick={handleCancel} disabled={isPending}>
            {t('common.cancel', 'انصراف')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                {t('common.processing', 'در حال پردازش...')}
              </>
            ) : (
              t('classes.curriculum.applyAction')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default BulkApplyCurriculumDialog;
