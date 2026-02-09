/**
 * SubjectsPage Container Component
 *
 * Main page for managing curriculum subjects with RTL layout:
 * - Stats Card (LEFT) - hidden when drawer open
 * - DataGrid (CENTER) - expands when drawer open
 * - Edit Drawer (LEFT) - replaces stats card
 *
 * Features:
 * - Checkbox selection for bulk operations
 * - Row click opens edit drawer
 * - Stats summary card
 * - Search and section filtering
 *
 * Requirements: 1.1, 8.1
 */

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BookOpen, ChevronDown, Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubjectFilters } from '../hooks/useSubjectFilters';
import { useDeleteSubject, useSubjects, useUpdateSubject } from '../hooks/useSubjects';
import type { Subject, SubjectFormValues } from '../types';
import { logger } from '../utils/logger';
import { CurriculumDialog, type CurriculumDialogMode } from './CurriculumDialog';
import { SubjectAssignmentSheet } from './SubjectAssignmentSheet';
import { SubjectDataGrid } from './SubjectDataGrid';
import { SubjectEditDrawer } from './SubjectEditDrawer';
import { SubjectFilters } from './SubjectFilters';
import { SubjectFormDrawer } from './SubjectFormDrawer';
import { SubjectStatsCard } from './SubjectStatsCard';

export interface SubjectsPageProps {
  /** Optional initial selected subject ID */
  initialSelectedId?: number;
}

/**
 * SubjectsPage is the main container for the subjects feature
 */
export function SubjectsPage({ initialSelectedId }: SubjectsPageProps) {
  const { t } = useTranslation();

  // Selection state
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    initialSelectedId ?? null
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCurriculumDialogOpen, setIsCurriculumDialogOpen] = useState(false);
  const [curriculumDialogMode, setCurriculumDialogMode] = useState<CurriculumDialogMode>('insert');
  const [assignmentSheetSubject, setAssignmentSheetSubject] = useState<Subject | null>(null);

  // Data fetching
  const { data: subjects = [], isLoading, error } = useSubjects();

  // Mutations
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();

  // Filtering
  const {
    search,
    section,
    grade,
    setSearch,
    setSection,
    setGrade,
    filteredSubjects,
    totalCount,
    filteredCount,
  } = useSubjectFilters(subjects);

  // Selected subject for edit drawer
  const selectedSubject = useMemo(() => {
    if (!selectedSubjectId) return null;
    return subjects.find((s) => s.id === selectedSubjectId) ?? null;
  }, [subjects, selectedSubjectId]);

  // Is edit drawer open?
  const isEditDrawerOpen = selectedSubject !== null;

  // Handlers
  const handleSelectSubject = useCallback((subject: Subject) => {
    setSelectedSubjectId(subject.id);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedSubjectId(null);
  }, []);

  const handleToggleSelect = useCallback((subjectId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredSubjects.length) {
        return new Set();
      }
      return new Set(filteredSubjects.map((s) => s.id));
    });
  }, [filteredSubjects]);

  const handleOpenCreateDrawer = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  const handleUpdateSubject = useCallback(
    async (id: number, data: Partial<SubjectFormValues>) => {
      logger.debug('SubjectsPage: updating subject', { id, data });
      await updateSubject.mutateAsync({ id, data });
    },
    [updateSubject]
  );

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    const idsToDelete = Array.from(selectedIds);
    for (const id of idsToDelete) {
      await deleteSubject.mutateAsync(id);
    }
    setSelectedIds(new Set());
    setSelectedSubjectId(null);
  }, [selectedIds, deleteSubject]);

  const handleBulkEdit = useCallback(() => {
    const firstSelectedId = Array.from(selectedIds)[0];
    if (firstSelectedId) {
      setSelectedSubjectId(firstSelectedId);
    }
  }, [selectedIds]);

  // Curriculum dialog handlers
  const handleInsertCurriculumClick = useCallback(() => {
    logger.debug('SubjectsPage: insert curriculum clicked');
    setCurriculumDialogMode('insert');
    setIsCurriculumDialogOpen(true);
  }, []);

  // Assignment sheet handler
  const handleCoverageClick = useCallback((subject: Subject) => {
    logger.debug('SubjectsPage: coverage clicked', { subjectId: subject.id });
    setAssignmentSheetSubject(subject);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-linear-to-br from-gray-50 via-slate-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#003366]/10 flex items-center justify-center animate-pulse">
            <BookOpen className="w-6 h-6 text-[#003366]" />
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
            <BookOpen className="w-6 h-6 text-destructive" />
          </div>
          <p className="text-destructive">{t('subjects.errors.fetchFailed')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-linear-to-br from-gray-50 via-slate-50 to-gray-100">
      {/* Sticky Header */}
      <PageHeader
        icon={BookOpen}
        title={t('subjects.pageTitle')}
        subtitle={t('subjects.pageSubtitle')}
        actions={
          <>
            {/* Curriculum Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 border-2 border-slate-200 hover:bg-slate-50"
                >
                  <BookOpen className="h-4 w-4" />
                  {t('subjects.curriculum.button')}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleInsertCurriculumClick}>
                  <Plus className="h-4 w-4 me-2" />
                  {t('subjects.curriculum.insert')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={handleOpenCreateDrawer}
              className="gap-2 bg-linear-to-r from-[#003366] to-[#004488] hover:from-[#002244] hover:to-[#003366] text-white shadow-lg"
            >
              <Plus className="h-4 w-4" />
              {t('subjects.add')}
            </Button>
          </>
        }
      />

      {/* Filters Bar */}
      <div className="px-4 py-3 border-b bg-white">
        <SubjectFilters
          search={search}
          onSearchChange={setSearch}
          section={section}
          onSectionChange={setSection}
          grade={grade}
          onGradeChange={setGrade}
          onAddClick={handleOpenCreateDrawer}
          totalCount={totalCount}
          filteredCount={filteredCount}
          hideAddButton
          hideStats={isEditDrawerOpen}
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
            isEditDrawerOpen ? 'flex-1 min-w-0' : 'flex-1'
          }`}
        >
          <SubjectDataGrid
            subjects={filteredSubjects}
            selectedId={selectedSubjectId}
            selectedIds={selectedIds}
            onSelect={handleSelectSubject}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onCoverageClick={handleCoverageClick}
            isLoading={isLoading}
            compact={isEditDrawerOpen}
            className="h-full"
          />
        </div>

        {/* Stats Card OR Edit Drawer */}
        <div
          className={`transition-all duration-300 ease-in-out h-full border-s border-gray-200 bg-gray-50 shrink-0 overflow-auto ${
            isEditDrawerOpen ? 'w-[480px]' : 'w-[300px]'
          }`}
        >
          {isEditDrawerOpen && selectedSubject ? (
            <SubjectEditDrawer
              subject={selectedSubject}
              onClose={handleCloseDrawer}
              onUpdate={handleUpdateSubject}
              isUpdating={updateSubject.isPending}
            />
          ) : (
            <SubjectStatsCard
              subjects={subjects}
              selectedCount={selectedIds.size}
              className="h-full"
            />
          )}
        </div>
      </div>

      {/* Create Subject Drawer */}
      <SubjectFormDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />

      {/* Curriculum Dialog */}
      <CurriculumDialog
        open={isCurriculumDialogOpen}
        onOpenChange={setIsCurriculumDialogOpen}
        mode={curriculumDialogMode}
      />

      {/* Subject Assignment Sheet */}
      <SubjectAssignmentSheet
        subject={assignmentSheetSubject}
        open={assignmentSheetSubject !== null}
        onOpenChange={(open) => {
          if (!open) setAssignmentSheetSubject(null);
        }}
      />
    </div>
  );
}

export default SubjectsPage;
