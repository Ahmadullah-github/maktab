/**
 * CurriculumDialog Component
 *
 * Dialog for bulk curriculum operations:
 * - Insert curriculum: Add standard Ministry curriculum subjects for a grade
 * - Clear grade subjects: Remove all subjects for a specific grade
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, BookOpen, Loader2, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClearGradeSubjects, useInsertCurriculum } from '../hooks/useSubjects';
import { componentLogger } from '../utils/logger';

/**
 * Dialog mode type
 */
export type CurriculumDialogMode = 'insert' | 'clear';

export interface CurriculumDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Dialog mode: 'insert' for curriculum insertion, 'clear' for grade clearing */
  mode: CurriculumDialogMode;
}

/**
 * Grade options for selection (1-12)
 */
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * CurriculumDialog provides bulk operations for curriculum management
 *
 * @example
 * ```tsx
 * <CurriculumDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   mode="insert"
 * />
 * ```
 */
export function CurriculumDialog({ open, onOpenChange, mode }: CurriculumDialogProps) {
  const { t } = useTranslation();
  const [selectedGrade, setSelectedGrade] = useState<string>('');

  // Mutations
  const insertCurriculum = useInsertCurriculum();
  const clearGradeSubjects = useClearGradeSubjects();

  const isPending = insertCurriculum.isPending || clearGradeSubjects.isPending;

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      componentLogger.mount('CurriculumDialog', { mode });
      setSelectedGrade('');
    } else {
      componentLogger.unmount('CurriculumDialog');
    }
  }, [open, mode]);

  // Handle grade selection
  const handleGradeChange = useCallback((value: string) => {
    setSelectedGrade(value);
  }, []);

  // Handle confirm action
  const handleConfirm = useCallback(async () => {
    if (!selectedGrade) return;

    const grade = parseInt(selectedGrade, 10);

    try {
      if (mode === 'insert') {
        await insertCurriculum.mutateAsync(grade);
      } else {
        await clearGradeSubjects.mutateAsync(grade);
      }
      onOpenChange(false);
    } catch {
      // Error handling is done in the mutation hooks
    }
  }, [selectedGrade, mode, insertCurriculum, clearGradeSubjects, onOpenChange]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const isInsertMode = mode === 'insert';
  const translationPrefix = isInsertMode
    ? 'subjects.curriculum.insertDialog'
    : 'subjects.curriculum.clearDialog';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isInsertMode ? (
              <BookOpen className="h-5 w-5 text-primary" />
            ) : (
              <Trash2 className="h-5 w-5 text-destructive" />
            )}
            {t(`${translationPrefix}.title`)}
          </DialogTitle>
          <DialogDescription>{t(`${translationPrefix}.description`)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Grade Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t(`${translationPrefix}.selectGrade`)}</label>
            <Select value={selectedGrade} onValueChange={handleGradeChange} disabled={isPending}>
              <SelectTrigger>
                <SelectValue placeholder={t(`${translationPrefix}.selectGradePlaceholder`)} />
              </SelectTrigger>
              <SelectContent>
                {GRADE_OPTIONS.map((grade) => (
                  <SelectItem key={grade} value={grade.toString()}>
                    {t(`${translationPrefix}.gradeLabel`, { grade })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Insert Mode: Preview Section */}
          {isInsertMode && selectedGrade && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <h4 className="text-sm font-medium">{t(`${translationPrefix}.preview`)}</h4>
              <p className="text-sm text-muted-foreground">
                {t(`${translationPrefix}.previewDescription`, { grade: selectedGrade })}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                {t(`${translationPrefix}.existingWarning`)}
              </p>
            </div>
          )}

          {/* Insert Mode: No Selection */}
          {isInsertMode && !selectedGrade && (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm text-muted-foreground">{t(`${translationPrefix}.noPreview`)}</p>
            </div>
          )}

          {/* Clear Mode: Warning */}
          {!isInsertMode && selectedGrade && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">{t(`${translationPrefix}.warning`)}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t(`${translationPrefix}.warningDescription`, { grade: selectedGrade })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={isInsertMode ? 'default' : 'destructive'}
            onClick={handleConfirm}
            disabled={!selectedGrade || isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {isPending ? t(`${translationPrefix}.confirming`) : t(`${translationPrefix}.confirm`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CurriculumDialog;
