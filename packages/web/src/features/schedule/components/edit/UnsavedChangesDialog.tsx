/**
 * UnsavedChangesDialog component
 *
 * Confirmation dialog shown when user tries to navigate away
 * with unsaved changes. Offers options to save, discard, or cancel.
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
import { buttonVariants } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

/**
 * Props for UnsavedChangesDialog component
 */
export interface UnsavedChangesDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when user chooses to save changes */
  onSave: () => void;
  /** Callback when user chooses to discard changes */
  onDiscard: () => void;
  /** Number of unsaved changes (for display) */
  changeCount?: number;
}

/**
 * Dialog warning about unsaved changes
 *
 * Shows when user attempts to navigate away with pending changes.
 * Provides three options: Save, Discard, or Cancel (stay on page).
 */
export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onSave,
  onDiscard,
  changeCount,
}: UnsavedChangesDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('schedule.edit.unsavedChanges.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {changeCount
              ? t('schedule.edit.unsavedChanges.descriptionWithCount', { count: changeCount })
              : t('schedule.edit.unsavedChanges.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: 'destructive' })}
            onClick={onDiscard}
          >
            {t('schedule.edit.unsavedChanges.discard')}
          </AlertDialogAction>
          <AlertDialogAction onClick={onSave}>
            {t('schedule.edit.unsavedChanges.save')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
