/**
 * Assignment Confirmation Dialog Component
 * Reusable confirmation dialog for assignment operations
 *
 * Requirements: 8.2
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
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ============================================================================
// Types
// ============================================================================

export interface AssignmentConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Whether the operation is in progress */
  isLoading?: boolean;
  /** Dialog variant */
  variant?: 'remove' | 'warning' | 'bulk-remove';
  /** Custom title (optional) */
  title?: string;
  /** Custom description (optional) */
  description?: string;
  /** Number of items for bulk operations */
  itemCount?: number;
  /** Subject name for context */
  subjectName?: string;
  /** Class name for context */
  className?: string;
  /** Teacher name for context */
  teacherName?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AssignmentConfirmDialog provides a reusable confirmation dialog
 * for assignment removal and other destructive operations.
 *
 * @example
 * ```tsx
 * <AssignmentConfirmDialog
 *   open={showConfirm}
 *   onOpenChange={setShowConfirm}
 *   onConfirm={handleRemove}
 *   variant="remove"
 *   subjectName="ریاضی"
 * />
 * ```
 */
export function AssignmentConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  variant = 'remove',
  title,
  description,
  itemCount = 1,
  subjectName,
  className,
  teacherName,
}: AssignmentConfirmDialogProps) {
  const { t } = useTranslation();

  // Get default title based on variant
  const getDefaultTitle = (): string => {
    switch (variant) {
      case 'remove':
        return t('assignments.confirmDialog.removeTitle', 'حذف تخصیص');
      case 'bulk-remove':
        return t('assignments.confirmDialog.bulkRemoveTitle', 'حذف تخصیص‌ها');
      case 'warning':
        return t('assignments.confirmDialog.warningTitle', 'هشدار');
      default:
        return t('common.confirm', 'تایید');
    }
  };

  // Get default description based on variant
  const getDefaultDescription = (): string => {
    switch (variant) {
      case 'remove': {
        let desc = t(
          'assignments.confirmDialog.removeDescription',
          'آیا از حذف این تخصیص مطمئن هستید؟'
        );
        if (subjectName) {
          desc += ` (${subjectName}`;
          if (className) {
            desc += ` - ${className}`;
          }
          desc += ')';
        }
        return desc;
      }
      case 'bulk-remove':
        return t(
          'assignments.confirmDialog.bulkRemoveDescription',
          'آیا از حذف {{count}} تخصیص مطمئن هستید؟ این عمل قابل بازگشت نیست.',
          { count: itemCount }
        );
      case 'warning':
        return t(
          'assignments.confirmDialog.warningDescription',
          'این عملیات ممکن است تغییرات غیرقابل بازگشت ایجاد کند.'
        );
      default:
        return t('common.areYouSure', 'آیا مطمئن هستید؟');
    }
  };

  // Get icon based on variant
  const getIcon = () => {
    switch (variant) {
      case 'remove':
      case 'bulk-remove':
        return <Trash2 className="h-5 w-5 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  // Get confirm button style based on variant
  const getConfirmButtonClass = (): string => {
    switch (variant) {
      case 'remove':
      case 'bulk-remove':
        return 'bg-destructive text-destructive-foreground hover:bg-destructive/90';
      case 'warning':
        return 'bg-yellow-500 text-white hover:bg-yellow-600';
      default:
        return '';
    }
  };

  // Get confirm button text
  const getConfirmText = (): string => {
    if (isLoading) {
      return t('common.processing', 'در حال پردازش...');
    }
    switch (variant) {
      case 'remove':
        return t('common.remove', 'حذف');
      case 'bulk-remove':
        return t('common.removeAll', 'حذف همه');
      case 'warning':
        return t('common.continue', 'ادامه');
      default:
        return t('common.confirm', 'تایید');
    }
  };

  const handleConfirm = () => {
    if (!isLoading) {
      onConfirm();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {getIcon()}
            {title || getDefaultTitle()}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-2">
              <p>{description || getDefaultDescription()}</p>
              {teacherName && (
                <p className="text-sm text-muted-foreground">
                  {t('assignments.confirmDialog.teacher', 'معلم')}: {teacherName}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{t('common.cancel', 'انصراف')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={getConfirmButtonClass()}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {getConfirmText()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default AssignmentConfirmDialog;
