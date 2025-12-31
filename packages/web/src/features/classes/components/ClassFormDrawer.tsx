/**
 * ClassFormDrawer Component
 *
 * A drawer/sheet component for creating new classes.
 * Opens from the left side (RTL layout) with ~30% width.
 *
 * Features:
 * - Backdrop overlay blocking main content
 * - Integrates ClassForm component
 * - Handles close on backdrop click or close button
 * - Shows success/error toasts on form submission
 *
 * Requirements: 2.1, 2.3, 2.6, 2.7, 11.2, 11.3
 */

import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { ClassFormValues } from '@/schemas/class.schema';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateClass } from '../hooks/useClasses';
import { componentLogger, logger } from '../utils/logger';
import { ClassForm } from './ClassForm';

/**
 * Props for the ClassFormDrawer component
 */
export interface ClassFormDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Callback when the drawer should close */
  onOpenChange: (open: boolean) => void;
  /** IDs of rooms already assigned to other classes */
  assignedRoomIds?: number[];
}

/**
 * ClassFormDrawer provides a side panel for creating new classes
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <ClassFormDrawer
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   assignedRoomIds={[1, 2, 3]}
 * />
 * ```
 */
export function ClassFormDrawer({
  open,
  onOpenChange,
  assignedRoomIds = [],
}: ClassFormDrawerProps) {
  const { t } = useTranslation();
  const createClass = useCreateClass();

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('ClassFormDrawer', { open });
    return () => componentLogger.unmount('ClassFormDrawer');
  }, []);

  // Log when drawer opens/closes
  useEffect(() => {
    componentLogger.update('ClassFormDrawer', 'open state changed', { open });
  }, [open]);

  /**
   * Handle form submission
   * Creates a new class and closes the drawer on success
   */
  const handleSubmit = async (values: ClassFormValues) => {
    logger.debug('ClassFormDrawer: submitting form', { name: values.name });

    // Normalize optional fields to ensure they're not undefined
    const normalizedValues = {
      ...values,
      fixedRoomId: values.fixedRoomId ?? null,
      classTeacherId: values.classTeacherId ?? null,
      displayName: values.displayName ?? '',
      sectionIndex: values.sectionIndex ?? '',
    };

    try {
      await createClass.mutateAsync(normalizedValues);
      logger.info('ClassFormDrawer: class created successfully', { name: values.name });
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the useCreateClass hook
      logger.error('ClassFormDrawer: failed to create class', { error });
    }
  };

  /**
   * Handle cancel/close
   */
  const handleCancel = () => {
    logger.debug('ClassFormDrawer: cancelled');
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:w-[400px] md:w-[450px] lg:w-[30%] lg:min-w-[400px] p-0"
        side="left"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>{t('classes.add')}</SheetTitle>
          <SheetDescription>{t('classes.pageSubtitle')}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="px-6 py-6">
            <ClassForm
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isSubmitting={createClass.isPending}
              assignedRoomIds={assignedRoomIds}
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default ClassFormDrawer;
