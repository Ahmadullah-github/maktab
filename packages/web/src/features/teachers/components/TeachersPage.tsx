/**
 * TeachersPage Container Component
 *
 * Main page for managing teachers with RTL layout:
 * - Stats Card (LEFT) - hidden when drawer open
 * - DataGrid (CENTER) - expands when drawer open
 * - Edit Drawer (LEFT) - replaces stats card
 *
 * Features:
 * - Checkbox selection for bulk operations
 * - Row click opens edit drawer
 * - Stats summary card
 * - Search and status filtering
 */

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  calculateMaxPeriodsPerWeek,
  useSchoolConfig,
} from '@/features/school-settings/hooks/useSchoolSettings';
import type { SchoolConfigDto } from '@/features/school-settings/types';
import type { TeacherFormValues } from '@/schemas/teacher.schema';
import { Plus, Upload, Users } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useTeacherFilters } from '../hooks/useTeacherFilters';
import {
  useCreateTeacher,
  useDeleteTeacher,
  useTeachers,
  useUpdateTeacher,
} from '../hooks/useTeachers';
import type { Teacher, TeacherFormValues as TeacherFormValuesType } from '../types';
import { TeacherBulkImportDialog } from './TeacherBulkImportDialog';
import { TeacherDataGrid } from './TeacherDataGrid';
import { TeacherEditDrawer, type EditTab } from './TeacherEditDrawer';
import { TeacherFilters } from './TeacherFilters';
import { TeacherFormDrawer } from './TeacherFormDrawer';
import { TeacherStatsCard } from './TeacherStatsCard';

export interface TeachersPageProps {
  initialSelectedId?: number;
}

export function TeachersPage({ initialSelectedId }: TeachersPageProps) {
  const { t } = useTranslation();

  // Selection state
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(
    initialSelectedId ?? null
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState<EditTab>('info');

  // Data fetching
  const { data: teachers = [], isLoading, error } = useTeachers();
  const { data: schoolConfig, isLoading: isLoadingConfig } = useSchoolConfig();

  // Mutations
  const createTeacherMutation = useCreateTeacher();
  const updateTeacherMutation = useUpdateTeacher();
  const deleteTeacherMutation = useDeleteTeacher();

  // Calculate max periods per week from REAL data
  const maxPeriodsPerWeek = useMemo(
    () => (schoolConfig ? calculateMaxPeriodsPerWeek(schoolConfig) : 42),
    [schoolConfig]
  );

  // Filtering - pass calculated maxPeriodsPerWeek
  const { filters, setSearch, setStatusFilter, filteredTeachers, totalCount, filteredCount } =
    useTeacherFilters(teachers, schoolConfig);

  // Default school config
  const defaultSchoolConfig = useMemo(
    (): SchoolConfigDto => ({
      id: 0,
      schoolId: null,
      revision: 1,
      schoolName: null,
      enablePrimary: true,
      enableMiddle: true,
      enableHigh: true,
      daysPerWeek: 6,
      defaultPeriodsPerDay: 7,
      daysOfWeek: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      schoolStartTime: '07:30',
      timezone: 'Asia/Kabul',
      ramadanModeEnabled: false,
      ramadanPeriodDuration: 35,
      enableMinistryValidation: false,
      ministryValidationMode: 'strict',
      customCurriculumMode: false,
      autoPopulateCurriculum: true,
      lowResourceMode: false,
      periodDuration: 45,
      dynamicPeriodsEnabled: false,
      periodsPerDayMap: {},
      categoryPeriodsEnabled: false,
      categoryPeriodsMap: {},
      breakPeriods: [],
      breakPeriodsByDay: {},
      prayerBreaksEnabled: false,
      prayerBreaks: [],
      createdAt: '',
      updatedAt: '',
    }),
    []
  );

  // Selected teacher for edit drawer
  const selectedTeacher = useMemo(() => {
    if (!selectedTeacherId) return null;
    return teachers.find((t) => t.id === selectedTeacherId) ?? null;
  }, [teachers, selectedTeacherId]);

  // Is drawer open?
  const isDrawerOpen = selectedTeacher !== null;

  // Handlers
  const handleSelectTeacher = useCallback((teacher: Teacher) => {
    setSelectedTeacherId(teacher.id);
    setDrawerInitialTab('info'); // Default to info tab when clicking row
  }, []);

  const handleAssignmentClick = useCallback((teacher: Teacher) => {
    setSelectedTeacherId(teacher.id);
    setDrawerInitialTab('subjects-assignments'); // Open subjects & assignments tab when clicking assignment badge
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedTeacherId(null);
  }, []);

  const handleToggleSelect = useCallback((teacherId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(teacherId)) {
        next.delete(teacherId);
      } else {
        next.add(teacherId);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredTeachers.length) {
        return new Set();
      }
      return new Set(filteredTeachers.map((t) => t.id));
    });
  }, [filteredTeachers]);

  const handleOpenCreateDrawer = useCallback(() => {
    setIsCreateDrawerOpen(true);
  }, []);

  const handleUpdateTeacher = useCallback(
    async (id: number, data: Partial<TeacherFormValuesType>) => {
      await updateTeacherMutation.mutateAsync({ id, data });
    },
    [updateTeacherMutation]
  );

  const handleCreateTeacher = useCallback(
    async (data: TeacherFormValues) => {
      await createTeacherMutation.mutateAsync(data as TeacherFormValuesType);
      setIsCreateDrawerOpen(false);
    },
    [createTeacherMutation]
  );

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    const idsToDelete = Array.from(selectedIds);
    for (const id of idsToDelete) {
      await deleteTeacherMutation.mutateAsync(id);
    }
    setSelectedIds(new Set());
    setSelectedTeacherId(null);
  }, [selectedIds, deleteTeacherMutation]);

  const handleBulkEdit = useCallback(() => {
    const firstSelectedId = Array.from(selectedIds)[0];
    if (firstSelectedId) {
      setSelectedTeacherId(firstSelectedId);
    }
  }, [selectedIds]);

  const handleOpenBulkImport = useCallback(() => {
    setIsBulkImportOpen(true);
  }, []);

  const handleBulkImportSuccess = useCallback(
    (count: number) => {
      toast.success(
        t('teachers.bulkImport.successMessage', '{{count}} معلم با موفقیت اضافه شد', { count })
      );
    },
    [t]
  );

  // Loading state
  if (isLoading || isLoadingConfig) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-linear-to-br from-gray-50 via-slate-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#003366]/10 flex items-center justify-center animate-pulse">
            <Users className="w-6 h-6 text-[#003366]" />
          </div>
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-linear-to-br from-gray-50 via-slate-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-destructive" />
          </div>
          <p className="text-destructive">{t('teachers.errors.fetchFailed')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-linear-to-br from-gray-50 via-slate-50 to-gray-100">
      {/* Sticky Header */}
      <PageHeader
        icon={Users}
        title={t('teachers.pageTitle')}
        subtitle={t('teachers.pageSubtitle')}
        actions={
          <>
            <Button
              variant="outline"
              onClick={handleOpenBulkImport}
              className="gap-2 border-2 border-slate-200 hover:bg-slate-50"
            >
              <Upload className="h-4 w-4" />
              {t('teachers.bulkImport.button', 'وارد کردن گروهی')}
            </Button>
            <Button
              onClick={handleOpenCreateDrawer}
              className="gap-2 bg-linear-to-r from-[#003366] to-[#004488] hover:from-[#002244] hover:to-[#003366] text-white shadow-lg"
            >
              <Plus className="h-4 w-4" />
              {t('teachers.addTeacher')}
            </Button>
          </>
        }
      />

      {/* Filters Bar */}
      <div className="px-4 py-3 border-b bg-white">
        <TeacherFilters
          search={filters.search}
          onSearchChange={setSearch}
          statusFilter={filters.statusFilter}
          onStatusFilterChange={setStatusFilter}
          onAddClick={handleOpenCreateDrawer}
          totalCount={totalCount}
          filteredCount={filteredCount}
          hideAddButton
          hideStats={isDrawerOpen}
          selectedCount={selectedIds.size}
          onDeselectAll={handleDeselectAll}
          onBulkDelete={handleBulkDelete}
          onBulkEdit={handleBulkEdit}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex">
        {/* DataGrid */}
        <div
          className={`transition-all duration-300 ease-in-out h-full overflow-auto ${
            isDrawerOpen ? 'flex-1 min-w-0' : 'flex-1'
          }`}
        >
          <TeacherDataGrid
            teachers={filteredTeachers}
            selectedId={selectedTeacherId}
            selectedIds={selectedIds}
            onSelect={handleSelectTeacher}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onAssignmentClick={handleAssignmentClick}
            maxPeriodsPerWeek={maxPeriodsPerWeek}
            isLoading={isLoading}
            compact={isDrawerOpen}
            className="h-full"
          />
        </div>

        {/* Stats Card OR Edit Drawer */}
        <div
          className={`transition-all duration-300 ease-in-out h-full border-s border-gray-200 bg-gray-50 shrink-0 overflow-auto ${
            isDrawerOpen ? 'w-[700px]' : 'w-[300px]'
          }`}
        >
          {isDrawerOpen && selectedTeacher ? (
            <TeacherEditDrawer
              teacher={selectedTeacher}
              onClose={handleCloseDrawer}
              onUpdate={handleUpdateTeacher}
              isUpdating={updateTeacherMutation.isPending}
              schoolConfig={schoolConfig ?? defaultSchoolConfig}
              initialTab={drawerInitialTab}
              className="h-full"
            />
          ) : (
            <TeacherStatsCard
              teachers={teachers}
              selectedCount={selectedIds.size}
              maxPeriodsPerWeek={maxPeriodsPerWeek}
              className="h-full"
            />
          )}
        </div>
      </div>

      {/* Create Teacher Drawer */}
      <TeacherFormDrawer
        open={isCreateDrawerOpen}
        onOpenChange={setIsCreateDrawerOpen}
        onCreate={handleCreateTeacher}
        isCreating={createTeacherMutation.isPending}
        schoolConfig={schoolConfig ?? defaultSchoolConfig}
      />

      {/* Bulk Import Dialog */}
      <TeacherBulkImportDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        existingTeachers={teachers}
        onSuccess={handleBulkImportSuccess}
      />
    </div>
  );
}

export default TeachersPage;
