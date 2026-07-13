/**
 * ClassesPage Container Component
 *
 * Main page for managing classes with RTL layout:
 * - Stats Card (LEFT) - hidden when drawer open
 * - DataGrid (CENTER) - expands when drawer open
 * - Edit Drawer (LEFT) - replaces stats card
 *
 * Features:
 * - Checkbox selection for bulk operations
 * - Row click opens edit drawer
 * - Stats summary card
 * - Search, grade category, and status filtering
 *
 * Requirements: 1.1, 1.5, 2.1, 3.1, 3.4, 9.1, 10.1
 */

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ClassFormValues } from '@/schemas/class.schema';
import { BookOpen, ChevronDown, Copy, GraduationCap, Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useClasses, useDeleteClass, useUpdateClass } from '../hooks/useClasses';
import { useClassFilters } from '../hooks/useClassFilters';
import type { ClassGroup } from '../types';
import { BulkApplyCurriculumDialog } from './BulkApplyCurriculumDialog';
import { BulkClassDialog } from './BulkClassDialog';
import { ClassDataGrid } from './ClassDataGrid';
import { ClassEditDrawer } from './ClassEditDrawer';
import { ClassFilters } from './ClassFilters';
import { ClassFormDrawer } from './ClassFormDrawer';
import { ClassStatsCard } from './ClassStatsCard';

export interface ClassesPageProps {
  initialSelectedId?: number;
}

export function ClassesPage({ initialSelectedId }: ClassesPageProps) {
  const { t } = useTranslation();

  // Selection state
  const [selectedClassId, setSelectedClassId] = useState<number | null>(initialSelectedId ?? null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isBulkCurriculumDialogOpen, setIsBulkCurriculumDialogOpen] = useState(false);
  const [bulkCurriculumMode, setBulkCurriculumMode] = useState<'selected' | 'all'>('selected');

  // Data fetching
  const { data: classes = [], isLoading, error } = useClasses();

  // Mutations
  const updateClassMutation = useUpdateClass();
  const deleteClassMutation = useDeleteClass();

  // Filtering
  const {
    filters,
    setSearch,
    setGradeCategory,
    setStatusFilter,
    filteredClasses,
    totalCount,
    filteredCount,
  } = useClassFilters(classes);

  // Selected class for edit drawer
  const selectedClass = useMemo(() => {
    if (!selectedClassId) return null;
    return classes.find((c) => c.id === selectedClassId) ?? null;
  }, [classes, selectedClassId]);

  // Assigned room IDs (for room selector exclusion)
  const assignedRoomIds = useMemo(() => {
    return classes
      .filter((c) => c.fixedRoomId !== null && c.id !== selectedClassId)
      .map((c) => c.fixedRoomId as number);
  }, [classes, selectedClassId]);

  // Is drawer open?
  const isDrawerOpen = selectedClass !== null;

  // Handlers
  const handleSelectClass = useCallback((classGroup: ClassGroup) => {
    setSelectedClassId(classGroup.id);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedClassId(null);
  }, []);

  const handleToggleSelect = useCallback((classId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredClasses.length) {
        return new Set();
      }
      return new Set(filteredClasses.map((c) => c.id));
    });
  }, [filteredClasses]);

  const handleOpenCreateDrawer = useCallback(() => {
    setIsCreateDrawerOpen(true);
  }, []);

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

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    const idsToDelete = Array.from(selectedIds);
    try {
      for (const id of idsToDelete) {
        await deleteClassMutation.mutateAsync(id);
      }
      toast.success(t('classes.success.deleted'));
      setSelectedIds(new Set());
      if (selectedClassId && idsToDelete.includes(selectedClassId)) {
        setSelectedClassId(null);
      }
    } catch {
      toast.error(t('classes.errors.deleteFailed'));
    }
  }, [selectedIds, deleteClassMutation, selectedClassId, t]);

  const handleBulkEdit = useCallback(() => {
    const firstSelectedId = Array.from(selectedIds)[0];
    if (firstSelectedId) {
      setSelectedClassId(firstSelectedId);
    }
  }, [selectedIds]);

  // Bulk curriculum handlers
  const handleBulkCurriculumSelected = useCallback(() => {
    if (selectedIds.size === 0) {
      toast.error(t('curriculum.selectClassesFirst', 'ابتدا صنف‌هایی را انتخاب کنید'));
      return;
    }
    setBulkCurriculumMode('selected');
    setIsBulkCurriculumDialogOpen(true);
  }, [selectedIds.size, t]);

  const handleBulkCurriculumAll = useCallback(() => {
    setBulkCurriculumMode('all');
    setIsBulkCurriculumDialogOpen(true);
  }, []);

  // Count classes without curriculum (for "apply to all" mode)
  const classesWithoutCurriculum = useMemo(() => {
    return classes.filter(
      (c) => c.grade !== null && (!c.subjectRequirements || c.subjectRequirements.length === 0)
    );
  }, [classes]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-linear-to-br from-slate-50 via-gray-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center animate-pulse">
            <GraduationCap className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-linear-to-br from-slate-50 via-gray-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-destructive" />
          </div>
          <p className="text-destructive">{t('classes.errors.fetchFailed')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-linear-to-br from-slate-50 via-gray-50 to-slate-100">
      {/* Sticky Header */}
      <PageHeader
        icon={GraduationCap}
        title={t('classes.pageTitle')}
        subtitle={t('classes.pageSubtitle')}
        actions={
          <div className="flex items-center gap-2">
            {/* Bulk Curriculum Dropdown */}
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {t('curriculum.bulkApply', 'اعمال برنامه درسی')}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={handleBulkCurriculumSelected}
                  disabled={selectedIds.size === 0}
                  className="gap-2"
                >
                  {t('curriculum.bulkApplySelected', 'اعمال به صنف‌های انتخاب شده')}
                  {selectedIds.size > 0 && (
                    <span className="mr-auto text-xs text-muted-foreground">
                      ({selectedIds.size})
                    </span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleBulkCurriculumAll}
                  disabled={classesWithoutCurriculum.length === 0}
                  className="gap-2"
                >
                  {t('curriculum.bulkApplyAll', 'اعمال به همه صنف‌های بدون برنامه')}
                  {classesWithoutCurriculum.length > 0 && (
                    <span className="mr-auto text-xs text-muted-foreground">
                      ({classesWithoutCurriculum.length})
                    </span>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" onClick={() => setIsBulkDialogOpen(true)} className="gap-2">
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">{t('classes.bulkAdd', 'ایجاد دسته‌ای')}</span>
            </Button>
            <Button
              onClick={handleOpenCreateDrawer}
              className="gap-2 bg-linear-to-r from-[#003366] to-[#004488] hover:from-[#002244] hover:to-[#003366] text-white shadow-lg"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t('classes.add')}</span>
            </Button>
          </div>
        }
      />

      {/* Filters Bar */}
      <div className="px-4 py-3 border-b bg-white/80 backdrop-blur-sm">
        <ClassFilters
          search={filters.search}
          onSearchChange={setSearch}
          gradeCategory={filters.gradeCategory}
          onGradeCategoryChange={setGradeCategory}
          statusFilter={filters.statusFilter}
          onStatusFilterChange={setStatusFilter}
          onAddClick={handleOpenCreateDrawer}
          totalCount={totalCount}
          filteredCount={filteredCount}
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
          <ClassDataGrid
            classes={filteredClasses}
            selectedId={selectedClassId}
            selectedIds={selectedIds}
            onSelect={handleSelectClass}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            isLoading={isLoading}
            compact={isDrawerOpen}
            className="h-full"
          />
        </div>

        {/* Stats Card OR Edit Drawer */}
        <div
          className={`transition-all duration-300 ease-in-out h-full border-s border-gray-200 bg-gray-50 shrink-0 overflow-auto ${
            isDrawerOpen ? 'w-[480px]' : 'w-[300px]'
          }`}
        >
          {isDrawerOpen && selectedClass ? (
            <ClassEditDrawer
              classData={selectedClass}
              onClose={handleCloseDrawer}
              onUpdate={handleUpdateClass}
              isUpdating={updateClassMutation.isPending}
              assignedRoomIds={assignedRoomIds}
              className="h-full"
            />
          ) : (
            <ClassStatsCard classes={classes} selectedCount={selectedIds.size} className="h-full" />
          )}
        </div>
      </div>

      {/* Create Class Drawer */}
      <ClassFormDrawer
        open={isCreateDrawerOpen}
        onOpenChange={setIsCreateDrawerOpen}
        assignedRoomIds={assignedRoomIds}
      />

      {/* Bulk Create Dialog */}
      <BulkClassDialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen} />

      {/* Bulk Apply Curriculum Dialog */}
      <BulkApplyCurriculumDialog
        open={isBulkCurriculumDialogOpen}
        onOpenChange={setIsBulkCurriculumDialogOpen}
        classIds={bulkCurriculumMode === 'selected' ? Array.from(selectedIds) : []}
        mode={bulkCurriculumMode}
        affectedCount={
          bulkCurriculumMode === 'selected' ? selectedIds.size : classesWithoutCurriculum.length
        }
      />
    </div>
  );
}

export default ClassesPage;
