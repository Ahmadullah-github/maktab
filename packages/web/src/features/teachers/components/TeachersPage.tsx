/**
 * TeachersPage Container Component
 *
 * Main page for managing teachers with three-column layout:
 * - Filters section
 * - DataGrid for teacher list
 * - Inspector panel for selected teacher
 *
 * Features:
 * - State management for selectedTeacherId
 * - "Add New Teacher" button opens FormDrawer wizard
 * - Loading and error states
 * - Integration of all child components
 *
 * Requirements: 1.1, 6.1, 7.1
 */

import { Button } from '@/components/ui/button';
import type { TeacherFormValues } from '@/schemas/teacher.schema';
import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { calculateMaxPeriodsPerWeek, useSchoolConfig } from '../hooks/useSchoolConfig';
import { useTeacherFilters } from '../hooks/useTeacherFilters';
import {
  useCreateTeacher,
  useDeleteTeacher,
  useTeachers,
  useUpdateTeacher,
} from '../hooks/useTeachers';
import type { Teacher, TeacherFormValues as TeacherFormValuesType } from '../types';
import { TeacherDataGrid } from './TeacherDataGrid';
import { TeacherFilters } from './TeacherFilters';
import { TeacherFormDrawer } from './TeacherFormDrawer';
import { TeacherInspector } from './TeacherInspector';

export interface TeachersPageProps {
  /** Optional initial selected teacher ID */
  initialSelectedId?: number;
}

/**
 * TeachersPage provides the main container for teacher management
 *
 * @example
 * ```tsx
 * <TeachersPage />
 * ```
 *
 * Requirements: 1.1, 6.1, 7.1
 */
export function TeachersPage({ initialSelectedId }: TeachersPageProps) {
  const { t } = useTranslation();
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(
    initialSelectedId ?? null
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Data fetching
  const { data: teachers = [], isLoading, error } = useTeachers();
  const { data: schoolConfig, isLoading: isLoadingConfig } = useSchoolConfig();

  // Mutations
  const createTeacherMutation = useCreateTeacher();
  const updateTeacherMutation = useUpdateTeacher();
  const deleteTeacherMutation = useDeleteTeacher();

  // Filters
  const { filters, setSearch, setStatusFilter, filteredTeachers, totalCount, filteredCount } =
    useTeacherFilters(teachers, schoolConfig);

  // Find selected teacher from the list
  const selectedTeacher = useMemo(() => {
    if (!selectedTeacherId) return null;
    return teachers.find((t) => t.id === selectedTeacherId) ?? null;
  }, [teachers, selectedTeacherId]);

  // Calculate max periods per week for the data grid
  const maxPeriodsPerWeek = useMemo(() => {
    if (!schoolConfig) return 42; // Default fallback
    return calculateMaxPeriodsPerWeek(schoolConfig);
  }, [schoolConfig]);

  // Default school config for when loading
  const defaultSchoolConfig = useMemo(
    () => ({
      id: 0,
      schoolId: null,
      schoolName: null,
      daysPerWeek: 6,
      periodsPerDay: 7,
      defaultPeriodsPerDay: 7,
      daysOfWeek: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      periodsPerDayMap: null,
      ramadanModeEnabled: false,
      ramadanPeriodDuration: 35,
      enableMinistryValidation: false,
      ministryValidationMode: 'strict',
      lowResourceMode: false,
    }),
    []
  );

  // Handlers
  const handleSelectTeacher = useCallback((teacher: Teacher) => {
    setSelectedTeacherId(teacher.id);
  }, []);

  const handleDeselectTeacher = useCallback(() => {
    setSelectedTeacherId(null);
  }, []);

  const handleOpenDrawer = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  const handleDeleteTeacher = useCallback(
    async (teacher: Teacher) => {
      try {
        await deleteTeacherMutation.mutateAsync(teacher.id);
        // Clear selection if deleted teacher was selected
        if (selectedTeacherId === teacher.id) {
          setSelectedTeacherId(null);
        }
      } catch {
        // Error toast is handled by the mutation hook
      }
    },
    [deleteTeacherMutation, selectedTeacherId]
  );

  const handleUpdateTeacher = useCallback(
    async (id: number, data: Partial<TeacherFormValuesType>) => {
      try {
        await updateTeacherMutation.mutateAsync({ id, data });
      } catch {
        // Error toast is handled by the mutation hook
      }
    },
    [updateTeacherMutation]
  );

  const handleCreateTeacher = useCallback(
    async (data: TeacherFormValues) => {
      try {
        await createTeacherMutation.mutateAsync(data as TeacherFormValuesType);
        setIsDrawerOpen(false);
      } catch {
        // Error toast is handled by the mutation hook
      }
    },
    [createTeacherMutation]
  );

  // Loading state
  if (isLoading || isLoadingConfig) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">{t('teachers.errors.fetchFailed')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('teachers.pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('teachers.pageSubtitle')}</p>
        </div>
        <Button onClick={handleOpenDrawer}>
          <Plus className="h-4 w-4 me-2" />
          {t('teachers.addTeacher')}
        </Button>
      </div>

      {/* Filters */}
      <div className="p-4 border-b">
        <TeacherFilters
          search={filters.search}
          statusFilter={filters.statusFilter}
          onSearchChange={setSearch}
          onStatusFilterChange={setStatusFilter}
          totalCount={totalCount}
          filteredCount={filteredCount}
        />
      </div>

      {/* Main Content: DataGrid + Inspector */}
      <div className="flex flex-1 overflow-hidden">
        {/* DataGrid */}
        <div className={`flex-1 p-4 overflow-auto transition-all ${selectedTeacher ? 'pe-0' : ''}`}>
          <TeacherDataGrid
            teachers={filteredTeachers}
            selectedTeacherId={selectedTeacherId}
            onSelectTeacher={handleSelectTeacher}
            onDeleteTeacher={handleDeleteTeacher}
            isDeleting={deleteTeacherMutation.isPending}
            maxPeriodsPerWeek={maxPeriodsPerWeek}
          />
        </div>

        {/* Inspector Panel */}
        {selectedTeacher && (
          <div className="w-[400px] border-s overflow-auto">
            <TeacherInspector
              teacher={selectedTeacher}
              onClose={handleDeselectTeacher}
              onUpdate={handleUpdateTeacher}
              isUpdating={updateTeacherMutation.isPending}
              schoolConfig={schoolConfig ?? defaultSchoolConfig}
            />
          </div>
        )}
      </div>

      {/* Wizard Drawer */}
      <TeacherFormDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onCreate={handleCreateTeacher}
        isCreating={createTeacherMutation.isPending}
        schoolConfig={schoolConfig ?? defaultSchoolConfig}
      />
    </div>
  );
}

export default TeachersPage;
