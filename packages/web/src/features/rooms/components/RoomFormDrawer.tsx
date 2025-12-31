/**
 * RoomFormDrawer Component
 *
 * A drawer/sheet component for creating new rooms.
 * Opens from the left side (RTL layout) with ~30% width.
 *
 * Features:
 * - Backdrop overlay blocking main content
 * - Integrates RoomForm component
 * - Handles close on backdrop click or close button
 * - Shows success/error toasts on form submission
 *
 * Requirements: 4.1, 4.2
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
import { useCreateRoom } from '../hooks/useRooms';
import type { RoomFormValues } from '../types';
import { componentLogger, logger } from '../utils/logger';
import { RoomForm } from './RoomForm';

/**
 * Props for the RoomFormDrawer component
 */
export interface RoomFormDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Callback when the drawer should close */
  onOpenChange: (open: boolean) => void;
}

/**
 * RoomFormDrawer provides a side panel for creating new rooms
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <RoomFormDrawer
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 * />
 * ```
 *
 * Requirements: 4.1, 4.2
 */
export function RoomFormDrawer({ open, onOpenChange }: RoomFormDrawerProps) {
  const { t } = useTranslation();
  const createRoom = useCreateRoom();

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('RoomFormDrawer', { open });
    return () => componentLogger.unmount('RoomFormDrawer');
  }, []);

  // Log when drawer opens/closes
  useEffect(() => {
    componentLogger.update('RoomFormDrawer', 'open state changed', { open });
  }, [open]);

  /**
   * Handle form submission
   * Creates a new room and closes the drawer on success
   */
  const handleSubmit = async (values: RoomFormValues) => {
    logger.debug('RoomFormDrawer: submitting form', { name: values.name });

    try {
      await createRoom.mutateAsync(values);
      logger.info('RoomFormDrawer: room created successfully', { name: values.name });
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the useCreateRoom hook
      logger.error('RoomFormDrawer: failed to create room', { error });
    }
  };

  /**
   * Handle cancel/close
   */
  const handleCancel = () => {
    logger.debug('RoomFormDrawer: cancelled');
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:w-[400px] md:w-[450px] lg:w-[30%] lg:min-w-[400px] p-0"
        side="left"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>{t('rooms.add')}</SheetTitle>
          <SheetDescription>{t('rooms.pageSubtitle')}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="px-6 py-6">
            <RoomForm
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isSubmitting={createRoom.isPending}
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default RoomFormDrawer;
