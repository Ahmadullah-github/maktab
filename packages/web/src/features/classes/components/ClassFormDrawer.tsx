/**
 * ClassFormDrawer Component - Modern styled drawer for creating classes
 * Consistent with TeacherFormDrawer and RoomFormDrawer patterns
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
import type { ClassFormValues } from '@/schemas/class.schema';
import { GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCreateClass } from '../hooks/useClasses';
import { ClassForm } from './ClassForm';

export interface ClassFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedRoomIds?: number[];
  className?: string;
}

export function ClassFormDrawer({
  open,
  onOpenChange,
  assignedRoomIds = [],
  className,
}: ClassFormDrawerProps) {
  const { t } = useTranslation();
  const createClass = useCreateClass();

  const handleSubmit = async (values: ClassFormValues) => {
    const normalizedValues = {
      ...values,
      fixedRoomId: values.fixedRoomId ?? null,
      classTeacherId: values.classTeacherId ?? null,
      displayName: values.displayName ?? '',
      sectionIndex: values.sectionIndex ?? '',
    };

    try {
      await createClass.mutateAsync(normalizedValues);
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
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <SheetTitle className="text-lg font-semibold text-slate-800">
                {t('classes.add')}
              </SheetTitle>
              <SheetDescription className="text-sm text-slate-500">
                {t('classes.pageSubtitle')}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)]">
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
