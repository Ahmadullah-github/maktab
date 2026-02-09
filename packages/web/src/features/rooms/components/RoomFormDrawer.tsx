/**
 * RoomFormDrawer Component - Modern styled drawer for creating rooms
 * Consistent with TeacherFormDrawer and SubjectFormDrawer patterns
 */
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { DoorOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCreateRoom } from '../hooks/useRooms';
import type { RoomFormValues } from '../types';
import { RoomForm } from './RoomForm';

export interface RoomFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

export function RoomFormDrawer({ open, onOpenChange, className }: RoomFormDrawerProps) {
  const { t } = useTranslation();
  const createRoom = useCreateRoom();

  const handleSubmit = async (values: RoomFormValues) => {
    try {
      await createRoom.mutateAsync(values);
      onOpenChange(false);
    } catch {
      // Error handled by hook
    }
  };

  const handleCancel = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl p-0',
          'bg-linear-to-br from-slate-50 to-white',
          className
        )}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b-2 border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-[#003366] to-[#004488] flex items-center justify-center shadow-md">
              <DoorOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <SheetTitle className="text-lg font-semibold text-slate-800">
                {t('rooms.add')}
              </SheetTitle>
              <SheetDescription className="text-sm text-slate-500">
                {t('rooms.pageSubtitle')}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)]">
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
