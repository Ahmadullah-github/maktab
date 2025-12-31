/**
 * UnsavedChangesAlert Component
 *
 * Displays an indicator when form has unsaved changes
 * and provides navigation blocking with confirmation dialog
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
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
import { Badge } from '@/components/ui/badge';
import { useBlocker } from '@tanstack/react-router';
import { AlertCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface UnsavedChangesAlertProps {
  /**
   * Whether the form has unsaved changes (dirty state)
   * Requirements: 6.1
   */
  isDirty: boolean;
  /**
   * Namespace for translations (e.g., 'schoolSettings' or 'periodStructure')
   */
  translationNamespace?: string;
}

/**
 * UnsavedChangesIndicator - Shows a badge when there are unsaved changes
 * Requirements: 6.1
 */
export function UnsavedChangesIndicator({ isDirty }: { isDirty: boolean }) {
  const { t } = useTranslation();

  if (!isDirty) return null;

  return (
    <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
      <AlertCircle className="h-3 w-3" />
      {t('schoolSettings.unsavedChanges.indicator')}
    </Badge>
  );
}

/**
 * UnsavedChangesAlert - Provides navigation blocking and confirmation dialog
 * Requirements: 6.2, 6.3, 6.4
 */
export function UnsavedChangesAlert({
  isDirty,
  translationNamespace = 'schoolSettings',
}: UnsavedChangesAlertProps) {
  const { t } = useTranslation();
  const [showDialog, setShowDialog] = useState(false);

  // Use TanStack Router's useBlocker to block navigation when dirty
  // Requirements: 6.2
  const { proceed, reset, status } = useBlocker({
    condition: isDirty,
  });

  // Show dialog when navigation is blocked
  useEffect(() => {
    if (status === 'blocked') {
      setShowDialog(true);
    }
  }, [status]);

  // Handle confirm navigation (discard changes)
  // Requirements: 6.3
  const handleConfirmLeave = useCallback(() => {
    setShowDialog(false);
    proceed?.();
  }, [proceed]);

  // Handle cancel navigation (stay on page)
  // Requirements: 6.4
  const handleStay = useCallback(() => {
    setShowDialog(false);
    reset?.();
  }, [reset]);

  return (
    <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(`${translationNamespace}.unsavedChanges.confirmTitle`)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(`${translationNamespace}.unsavedChanges.confirmMessage`)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel onClick={handleStay}>
            {t(`${translationNamespace}.unsavedChanges.confirmStay`)}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmLeave}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t(`${translationNamespace}.unsavedChanges.confirmLeave`)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook to manage unsaved changes state
 * Provides isDirty state and reset function
 */
export function useUnsavedChanges(formIsDirty: boolean, onSaveSuccess?: () => void) {
  const [isDirty, setIsDirty] = useState(false);

  // Sync with form dirty state
  useEffect(() => {
    setIsDirty(formIsDirty);
  }, [formIsDirty]);

  // Reset dirty state after successful save
  // Requirements: 6.5
  const clearDirtyState = useCallback(() => {
    setIsDirty(false);
    onSaveSuccess?.();
  }, [onSaveSuccess]);

  return {
    isDirty,
    clearDirtyState,
  };
}
