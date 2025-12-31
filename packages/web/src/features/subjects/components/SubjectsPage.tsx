/**
 * SubjectsPage Container Component
 *
 * Main page for managing curriculum subjects. Composes:
 * - SubjectFilters for search and section filtering
 * - SubjectDataGrid for displaying subjects
 * - SubjectInspector for viewing/editing details
 * - SubjectFormDrawer for creating new subjects
 * - CurriculumDialog for bulk operations
 *
 * Requirements: 1.1, 8.1
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubjectFilters } from '../hooks/useSubjectFilters';
import { useDeleteSubject, useSubjects, useUpdateSubject } from '../hooks/useSubjects';
import type { Subject, SubjectFormValues } from '../types';
import { logger } from '../utils/logger';
import { CurriculumDialog, type CurriculumDialogMode } from './CurriculumDialog';
import { SubjectDataGrid } from './SubjectDataGrid';
import { SubjectFilters } from './SubjectFilters';
import { SubjectFormDrawer } from './SubjectFormDrawer';
import { SubjectInspector } from './SubjectInspector';

export interface SubjectsPageProps {
  /** Optional initial selected subject ID */
  initialSelectedId?: number;
}

/**
 * SubjectsPage is the main container for the subjects feature
 *
 * @example
 * ```tsx
 * <SubjectsPage />
 * ```
 */
export function SubjectsPage({ initialSelectedId }: SubjectsPageProps) {
  const { t } = useTranslation();
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    initialSelectedId ?? null
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCurriculumDialogOpen, setIsCurriculumDialogOpen] = useState(false);
  const [curriculumDialogMode, setCurriculumDialogMode] = useState<CurriculumDialogMode>('insert');

  // Data fetching
  const { data: subjects = [], isLoading, error } = useSubjects();

  // Mutations
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();

  // Filtering
  const { search, section, setSearch, setSection, filteredSubjects, totalCount, filteredCount } =
    useSubjectFilters(subjects);

  // Selected subject
  const selectedSubject = useMemo(() => {
    if (!selectedSubjectId) return null;
    return subjects.find((s) => s.id === selectedSubjectId) ?? null;
  }, [subjects, selectedSubjectId]);

  // Handlers
  const handleSelectSubject = useCallback((subject: Subject | null) => {
    setSelectedSubjectId(subject?.id ?? null);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setSelectedSubjectId(null);
  }, []);

  const handleOpenDrawer = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  const handleUpdateSubject = useCallback(
    async (id: number, data: Partial<SubjectFormValues>) => {
      logger.debug('SubjectsPage: updating subject', { id, data });
      await updateSubject.mutateAsync({ id, data });
    },
    [updateSubject]
  );

  const handleDeleteSubject = useCallback(
    async (id: number) => {
      logger.debug('SubjectsPage: deleting subject', { id });
      await deleteSubject.mutateAsync(id);
      // Close inspector after successful deletion
      setSelectedSubjectId(null);
    },
    [deleteSubject]
  );

  // Curriculum dialog handlers
  const handleInsertCurriculumClick = useCallback(() => {
    logger.debug('SubjectsPage: insert curriculum clicked');
    setCurriculumDialogMode('insert');
    setIsCurriculumDialogOpen(true);
  }, []);

  const handleClearGradeClick = useCallback(() => {
    logger.debug('SubjectsPage: clear grade clicked');
    setCurriculumDialogMode('clear');
    setIsCurriculumDialogOpen(true);
  }, []);

  // Loading state
  if (isLoading) {
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
        <p className="text-destructive">{t('subjects.errors.fetchFailed')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('subjects.pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('subjects.pageSubtitle')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b">
        <SubjectFilters
          search={search}
          onSearchChange={setSearch}
          section={section}
          onSectionChange={setSection}
          onAddClick={handleOpenDrawer}
          onInsertCurriculumClick={handleInsertCurriculumClick}
          onClearGradeClick={handleClearGradeClick}
          totalCount={totalCount}
          filteredCount={filteredCount}
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* DataGrid */}
        <div className={`flex-1 p-4 overflow-auto transition-all ${selectedSubject ? 'pe-0' : ''}`}>
          <SubjectDataGrid
            subjects={filteredSubjects}
            selectedId={selectedSubjectId}
            onSelect={handleSelectSubject}
            isLoading={isLoading}
          />
        </div>

        {/* Inspector Panel */}
        {selectedSubject && (
          <SubjectInspector
            subject={selectedSubject}
            onClose={handleCloseInspector}
            onUpdate={handleUpdateSubject}
            onDelete={handleDeleteSubject}
            isUpdating={updateSubject.isPending}
            isDeleting={deleteSubject.isPending}
          />
        )}
      </div>

      {/* Form Drawer */}
      <SubjectFormDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />

      {/* Curriculum Dialog */}
      <CurriculumDialog
        open={isCurriculumDialogOpen}
        onOpenChange={setIsCurriculumDialogOpen}
        mode={curriculumDialogMode}
      />
    </div>
  );
}

export default SubjectsPage;
