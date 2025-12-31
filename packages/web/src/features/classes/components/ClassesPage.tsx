/**
 * ClassesPage Container Component
 * Requirements: 1.1, 1.5, 2.1, 3.1, 3.4, 9.1, 10.1
 */

import { Button } from '@/components/ui/button';
import type { ClassFormValues } from '@/schemas/class.schema';
import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useClasses, useDeleteClass, useUpdateClass } from '../hooks/useClasses';
import { useClassFilters } from '../hooks/useClassFilters';
import type { ClassGroup } from '../types';
import { ClassDataGrid } from './ClassDataGrid';
import { ClassFilters } from './ClassFilters';
import { ClassFormDrawer } from './ClassFormDrawer';
import { ClassInspector } from './ClassInspector';

export interface ClassesPageProps {
  initialSelectedId?: number;
}

export function ClassesPage({ initialSelectedId }: ClassesPageProps) {
  const { t } = useTranslation();
  const [selectedClassId, setSelectedClassId] = useState<number | null>(initialSelectedId ?? null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data: classes = [], isLoading, error } = useClasses();
  const deleteClassMutation = useDeleteClass();
  const updateClassMutation = useUpdateClass();

  const { filters, setSearch, setGradeCategory, filteredClasses, totalCount, filteredCount } =
    useClassFilters(classes);

  const selectedClass = useMemo(() => {
    if (!selectedClassId) return null;
    return classes.find((c) => c.id === selectedClassId) ?? null;
  }, [classes, selectedClassId]);

  const assignedRoomIds = useMemo(() => {
    return classes
      .filter((c) => c.fixedRoomId !== null && c.id !== selectedClassId)
      .map((c) => c.fixedRoomId as number);
  }, [classes, selectedClassId]);

  const handleSelectClass = useCallback(
    (classGroup: ClassGroup) => setSelectedClassId(classGroup.id),
    []
  );
  const handleDeselectClass = useCallback(() => setSelectedClassId(null), []);
  const handleOpenDrawer = useCallback(() => setIsDrawerOpen(true), []);

  const handleDeleteClass = useCallback(
    async (classGroup: ClassGroup) => {
      try {
        await deleteClassMutation.mutateAsync(classGroup.id);
        toast.success(t('classes.success.deleted'));
        if (selectedClassId === classGroup.id) setSelectedClassId(null);
      } catch {
        toast.error(t('classes.errors.deleteFailed'));
      }
    },
    [deleteClassMutation, selectedClassId, t]
  );

  const handleUpdateClass = useCallback(
    async (id: number, data: Partial<ClassFormValues>) => {
      try {
        await updateClassMutation.mutateAsync({ id, data });
        toast.success(t('classes.success.updated'));
      } catch {
        toast.error(t('classes.errors.updateFailed'));
      }
    },
    [updateClassMutation, t]
  );

  const teacherMap = useMemo(() => new Map<number, string>(), []);
  const roomMap = useMemo(() => new Map<number, string>(), []);

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  if (error)
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">{t('classes.errors.fetchFailed')}</p>
      </div>
    );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('classes.pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('classes.pageSubtitle')}</p>
        </div>
        <Button onClick={handleOpenDrawer}>
          <Plus className="h-4 w-4 me-2" />
          {t('classes.add')}
        </Button>
      </div>
      <div className="p-4 border-b">
        <ClassFilters
          search={filters.search}
          gradeCategory={filters.gradeCategory}
          onSearchChange={setSearch}
          onGradeCategoryChange={setGradeCategory}
          totalCount={totalCount}
          filteredCount={filteredCount}
        />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 p-4 overflow-auto transition-all ${selectedClass ? 'pe-0' : ''}`}>
          <ClassDataGrid
            classes={filteredClasses}
            selectedClassId={selectedClassId}
            onSelectClass={handleSelectClass}
            onDeleteClass={handleDeleteClass}
            isDeleting={deleteClassMutation.isPending}
            teacherMap={teacherMap}
            roomMap={roomMap}
          />
        </div>
        {selectedClass && (
          <div className="w-[400px] border-s overflow-auto">
            <ClassInspector
              classData={selectedClass}
              onClose={handleDeselectClass}
              onUpdate={handleUpdateClass}
              isUpdating={updateClassMutation.isPending}
              assignedRoomIds={assignedRoomIds}
            />
          </div>
        )}
      </div>
      <ClassFormDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        assignedRoomIds={assignedRoomIds}
      />
    </div>
  );
}

export default ClassesPage;
