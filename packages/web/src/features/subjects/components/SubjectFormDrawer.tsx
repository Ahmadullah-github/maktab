/**
 * SubjectFormDrawer Component
 *
 * A drawer/sheet component for creating new subjects.
 * Opens from the left side (RTL layout) with ~30% width.
 *
 * Features:
 * - Backdrop overlay blocking main content
 * - Integrates SubjectForm component
 * - Handles close on backdrop click or close button
 * - Shows success/error toasts on form submission
 *
 * Requirements: 4.1, 4.5, 4.6, 4.7
 */

import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateSubject } from '../hooks/useSubjects';
import type { SubjectFormValues } from '../types';
import { componentLogger, logger } from '../utils/logger';
import { SubjectForm } from './SubjectForm';

/**
 * Props for the SubjectFormDrawer component
 */
export interface SubjectFormDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Callback when the drawer should close */
  onOpenChange: (open: boolean) => void;
}

/**
 * SubjectFormDrawer provides a side panel for creating new subjects
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <SubjectFormDrawer
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 * />
 * ```
 */
export function SubjectFormDrawer({ open, onOpenChange }: SubjectFormDrawerProps) {
  const { t } = useTranslation();
  const createSubject = useCreateSubject();

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('SubjectFormDrawer', { open });
    return () => componentLogger.unmount('SubjectFormDrawer');
  }, []);

  // Log when drawer opens/closes
  useEffect(() => {
    componentLogger.update('SubjectFormDrawer', 'open state changed', { open });
  }, [open]);

  /**
   * Handle form submission
   * Creates a new subject and closes the drawer on success
   */
  const handleSubmit = async (values: SubjectFormValues) => {
    logger.debug('SubjectFormDrawer: submitting form', { name: values.name });

    // Normalize optional fields to ensure they're not undefined
    const normalizedValues: SubjectFormValues = {
      ...values,
      grade: values.grade ?? null,
      periodsPerWeek: values.periodsPerWeek ?? null,
      section: values.section ?? '',
      requiredRoomType: values.requiredRoomType ?? '',
      requiredFeatures: values.requiredFeatures ?? [],
      desiredFeatures: values.desiredFeatures ?? [],
      isDifficult: values.isDifficult ?? false,
      minRoomCapacity: values.minRoomCapacity ?? 0,
    };

    try {
      await createSubject.mutateAsync(normalizedValues);
      logger.info('SubjectFormDrawer: subject created successfully', { name: values.name });
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the useCreateSubject hook
      logger.error('SubjectFormDrawer: failed to create subject', { error });
    }
  };

  /**
   * Handle cancel/close
   */
  const handleCancel = () => {
    logger.debug('SubjectFormDrawer: cancelled');
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:w-[400px] md:w-[450px] lg:w-[30%] lg:min-w-[400px] p-0"
        side="left"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>{t('subjects.add')}</SheetTitle>
          <SheetDescription>{t('subjects.pageSubtitle')}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="px-6 py-6">
            <SubjectForm
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isSubmitting={createSubject.isPending}
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default SubjectFormDrawer;
