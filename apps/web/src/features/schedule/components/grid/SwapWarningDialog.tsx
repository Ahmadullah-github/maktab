/**
 * SwapWarningDialog Component
 * Dialog for soft constraint violations during swap operations.
 * Shows warnings and allows user to proceed or cancel.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
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
import { AlertTriangle } from 'lucide-react';

import type { ConstraintViolation } from '../../types';

export interface SwapWarningDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** List of warning violations to display */
  warnings: ConstraintViolation[];
  /** Callback when user confirms the swap */
  onConfirm: () => void;
  /** Callback when user cancels the swap */
  onCancel: () => void;
}

/**
 * Dialog for soft constraint violations
 * Title: "هشدار جابجایی" (Swap Warning)
 * Buttons: "ادامه" (Continue), "لغو" (Cancel)
 */
export function SwapWarningDialog({
  open,
  onOpenChange,
  warnings,
  onConfirm,
  onCancel,
}: SwapWarningDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            هشدار جابجایی
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>این جابجایی دارای هشدارهای زیر است:</p>
              <ul className="space-y-2">
                {warnings.map((warning, index) => (
                  <li
                    key={`${warning.type}-${index}`}
                    className="flex items-start gap-2 text-yellow-600 dark:text-yellow-400"
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{warning.message}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground">آیا می‌خواهید ادامه دهید؟</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>لغو</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-yellow-500 text-white hover:bg-yellow-600"
          >
            ادامه
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
