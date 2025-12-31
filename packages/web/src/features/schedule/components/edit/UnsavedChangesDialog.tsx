/**
 * UnsavedChangesDialog component
 *
 * Dialog warning about unsaved changes with save/leave/cancel options.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10
 */

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Props for UnsavedChangesDialog component
 */
export interface UnsavedChangesDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Number of unsaved changes */
  count: number;
  /** Callback for save and leave */
  onSaveAndLeave: () => void;
  /** Callback for leave without saving */
  onLeaveWithoutSaving: () => void;
  /** Callback for cancel */
  onCancel: () => void;
  /** Whether save is in progress */
  isSaving?: boolean;
}

/**
 * Dialog warning about unsaved changes
 *
 * - Displays when open is true (Requirement: 14.1)
 * - Shows Persian message with count (Requirement: 14.4)
 * - "ذخیره و خروج" (Save and Leave) button (Requirement: 14.5)
 * - "خروج بدون ذخیره" (Leave without Saving) button (Requirement: 14.6)
 * - "لغو" (Cancel) button (Requirement: 14.7)
 * - Handles button click callbacks (Requirements: 14.8, 14.9, 14.10)
 * - Shows loading state during save (Requirement: 14.2)
 *
 * @param props - Component props
 * @returns Dialog element
 */
export function UnsavedChangesDialog({
  open,
  onOpenChange,
  count,
  onSaveAndLeave,
  onLeaveWithoutSaving,
  onCancel,
  isSaving = false,
}: UnsavedChangesDialogProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تغییرات ذخیره نشده</DialogTitle>
          <DialogDescription>
            {/* Persian message with count (Requirement: 14.4) */}
            شما {count} تغییر ذخیره نشده دارید. آیا می‌خواهید قبل از خروج ذخیره کنید؟
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start">
          {/* Save and Leave button (Requirement: 14.5) */}
          <Button onClick={onSaveAndLeave} disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                در حال ذخیره...
              </>
            ) : (
              'ذخیره و خروج'
            )}
          </Button>

          {/* Leave without Saving button (Requirement: 14.6) */}
          <Button
            variant="destructive"
            onClick={onLeaveWithoutSaving}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            خروج بدون ذخیره
          </Button>

          {/* Cancel button (Requirement: 14.7) */}
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            لغو
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
