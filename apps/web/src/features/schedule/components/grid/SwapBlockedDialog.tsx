/**
 * SwapBlockedDialog Component
 * Dialog for hard constraint violations during swap operations.
 * Shows errors explaining why the swap is not possible.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { XCircle } from 'lucide-react';

import { DAYS_OF_WEEK } from '../../constants';
import type { ConstraintViolation, DayOfWeek } from '../../types';

export interface SwapBlockedDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** List of error violations to display */
  errors: ConstraintViolation[];
  /** Optional alternative slots that could work */
  alternativeSlots?: { day: DayOfWeek; period: number }[];
}

/**
 * Get Persian label for a day
 */
function getDayLabel(day: DayOfWeek): string {
  const dayInfo = DAYS_OF_WEEK.find((d) => d.value === day);
  return dayInfo?.labelFa || day;
}

/**
 * Format a slot for display in Persian
 */
function formatSlot(slot: { day: DayOfWeek; period: number }): string {
  const dayLabel = getDayLabel(slot.day);
  // Period is 0-indexed, display as 1-indexed
  return `${dayLabel} - زنگ ${slot.period + 1}`;
}

/**
 * Dialog for hard constraint violations
 * Title: "جابجایی ممکن نیست" (Swap Not Possible)
 * Button: "متوجه شدم" (Understood)
 */
export function SwapBlockedDialog({
  open,
  onOpenChange,
  errors,
  alternativeSlots,
}: SwapBlockedDialogProps) {
  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            جابجایی ممکن نیست
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>این جابجایی به دلایل زیر امکان‌پذیر نیست:</p>
              <ul className="space-y-2">
                {errors.map((error, index) => (
                  <li
                    key={`${error.type}-${index}`}
                    className="flex items-start gap-2 text-red-600 dark:text-red-400"
                  >
                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error.message}</span>
                  </li>
                ))}
              </ul>

              {alternativeSlots && alternativeSlots.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <p className="text-muted-foreground mb-2">زمان‌های جایگزین پیشنهادی:</p>
                  <ul className="space-y-1 text-sm">
                    {alternativeSlots.slice(0, 5).map((slot, index) => (
                      <li
                        key={`${slot.day}-${slot.period}-${index}`}
                        className="text-green-600 dark:text-green-400"
                      >
                        • {formatSlot(slot)}
                      </li>
                    ))}
                    {alternativeSlots.length > 5 && (
                      <li className="text-muted-foreground">
                        و {alternativeSlots.length - 5} زمان دیگر...
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleClose}>متوجه شدم</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
