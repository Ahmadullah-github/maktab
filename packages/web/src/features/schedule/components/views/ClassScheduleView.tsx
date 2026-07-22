/**
 * ClassScheduleView - Schedule view organized by class
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 * Phase 8 Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 11.1, 14.1, 14.2, 14.3
 */

import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useNavigationGuardStore } from '@/stores/navigationGuardStore';
import { AlertTriangle, GraduationCap, Users } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAutoSave } from '../../hooks/useAutoSave';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useSaveScheduleChanges } from '../../hooks/useSaveScheduleChanges';
import { useScheduleView } from '../../hooks/useScheduleView';
import { useSwapConstraintContext } from '../../hooks/useSwapConstraintContext';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import {
  getHasUnsavedChanges,
  getUnsavedChangesCount,
  useScheduleStore,
} from '../../stores/scheduleStore';
import type { DayOfWeek, ScheduledLesson } from '../../types';
import { ExportDialog } from '../export/ExportDialog';
import { ScheduleGrid } from '../grid/ScheduleGrid';
import { ClassTabNavigation } from '../navigation/ClassTabNavigation';
import { DisplaySettingsDialog } from '../settings/DisplaySettingsDialog';
import { EmptyScheduleState } from './EmptyScheduleState';
import { ScheduleWorkspaceToolbar } from './ScheduleWorkspaceToolbar';
import { UnsavedChangesDialog } from '../edit/UnsavedChangesDialog';

/**
 * ClassScheduleView - Main view for class-based schedule display
 *
 * Features:
 * - Horizontal tab navigation with ClassTabNavigation (hybrid tabs + dropdown)
 * - Main area with ScheduleGrid for selected class
 * - Classes grouped by Afghanistan's 4-tier grade categories
 * - Class metadata display (student count, single-teacher badge)
 * - Phase 8: Undo/Redo buttons, Save button, keyboard shortcuts
 */
export const ClassScheduleView = memo(function ClassScheduleView() {
  const { t } = useTranslation();

  // Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Export dialog state
  const [exportOpen, setExportOpen] = useState(false);

  // Editing mode state
  const [isEditingEnabled, setIsEditingEnabled] = useState(false);

  // Get schedule data from store
  const scheduleId = useScheduleStore((state) => state.scheduleId);
  const displaySettings = useScheduleStore((state) => state.displaySettings);
  const cancelSelection = useScheduleStore((state) => state.cancelSelection);

  // Phase 8: Get unsaved changes state from store
  const unsavedCount = useScheduleStore(getUnsavedChangesCount);
  const hasChanges = useScheduleStore(getHasUnsavedChanges);
  const { undo, redo } = useUndoRedo();

  // Phase 8: Use save schedule changes hook (Requirement: 15.1)
  const { saveChanges, isSaving } = useSaveScheduleChanges();
  const unsavedNavigation = useUnsavedChanges({ onSave: saveChanges });
  useSwapConstraintContext(scheduleId);

  // Sync dirty state with navigation guard store
  const setDirty = useNavigationGuardStore((s) => s.setDirty);
  useEffect(() => {
    setDirty(hasChanges);
    return () => setDirty(false);
  }, [hasChanges, setDirty]);

  // Phase 8: Register keyboard shortcuts (Requirement: 14.1)
  useKeyboardShortcuts({
    enabled: scheduleId !== null && isEditingEnabled,
    onUndo: undo,
    onRedo: redo,
    onSave: saveChanges,
  });

  // Phase 7: Auto-save to localStorage (Task 7.2)
  useAutoSave();

  // Use schedule view hook for filtering and navigation
  const {
    currentViewId,
    filteredLessons,
    setView,
    availableClasses,
    periodsPerDay,
    days,
    periodIntegrityIssues,
  } = useScheduleView('class');
  const hasPeriodIntegrityError = periodIntegrityIssues.length > 0;

  const selectedClass = useMemo(
    () =>
      availableClasses
        .flatMap((category) => category.classes)
        .find((classData) => classData.classId === currentViewId) ?? null,
    [availableClasses, currentViewId]
  );
  const selectedCategory = useMemo(
    () =>
      availableClasses.find((category) =>
        category.classes.some((classData) => classData.classId === currentViewId)
      ) ?? null,
    [availableClasses, currentViewId]
  );

  useEffect(() => {
    if (hasPeriodIntegrityError) setIsEditingEnabled(false);
  }, [hasPeriodIntegrityError]);

  // Handle class selection
  const handleSelectClass = useCallback(
    (classId: string) => {
      cancelSelection();
      setView('class', classId);
    },
    [cancelSelection, setView]
  );

  const handleEditingChange = useCallback(
    (editing: boolean) => {
      if (!editing) cancelSelection();
      setIsEditingEnabled(editing);
    },
    [cancelSelection]
  );

  // Handle cell click (read-only for now)
  const handleCellClick = useCallback(
    (_day: DayOfWeek, _period: number, _lesson: ScheduledLesson | null) => {
      // Future: implement cell editing
    },
    []
  );

  // Show empty state if no schedule loaded
  if (!scheduleId) {
    return <EmptyScheduleState />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Class Tab Navigation - Replaces sidebar */}
      <ClassTabNavigation
        categories={availableClasses}
        selectedClassId={currentViewId}
        onSelectClass={handleSelectClass}
      />

      <ScheduleWorkspaceToolbar
        title={selectedClass?.className ?? t('schedule.selectClass', 'یک صنف را انتخاب کنید')}
        metadata={
          selectedClass ? (
            <>
              <Badge variant="secondary" className="h-6 gap-1 rounded-full text-[11px]">
                <Users className="h-3 w-3" />
                {selectedClass.studentCount} {t('schedule.students', 'شاگرد')}
              </Badge>
              {selectedCategory ? (
                <Badge variant="outline" className="h-6 gap-1 rounded-full text-[11px]">
                  <GraduationCap className="h-3 w-3" />
                  {selectedCategory.nameFa}
                </Badge>
              ) : null}
            </>
          ) : null
        }
        isEditing={isEditingEnabled}
        canEdit={Boolean(currentViewId) && !hasPeriodIntegrityError}
        onEditingChange={handleEditingChange}
        unsavedCount={unsavedCount}
        hasChanges={hasChanges}
        isSaving={isSaving}
        onSave={saveChanges}
        canExport={Boolean(currentViewId) && !hasPeriodIntegrityError}
        onExport={() => setExportOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />

      {hasPeriodIntegrityError && (
        <Alert variant="destructive" className="m-4 mb-0 border-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {t('schedule.periodIntegrity.title', 'Invalid timetable period data')}
          </AlertTitle>
          <AlertDescription>
            {t(
              'schedule.periodIntegrity.description',
              'One or more lessons fall outside their class period limits. Editing and export are disabled until the timetable is regenerated.'
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Schedule grid - Now takes full width */}
      <main className="flex-1 overflow-auto bg-muted/15 p-3 lg:p-4">
        {currentViewId ? (
          <ScheduleGrid
            lessons={filteredLessons}
            days={days}
            periodsPerDay={periodsPerDay}
            displaySettings={displaySettings}
            onCellClick={handleCellClick}
            isReadOnly={!isEditingEnabled || hasPeriodIntegrityError}
            viewScope="class"
            viewId={currentViewId}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {t('schedule.selectClass', 'یک صنف را از لیست انتخاب کنید')}
          </div>
        )}
      </main>

      {/* Display Settings Dialog */}
      <DisplaySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Export Dialog */}
      {currentViewId && scheduleId && !hasPeriodIntegrityError && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          currentScheduleId={scheduleId}
          currentType="class"
          currentTargetId={currentViewId}
        />
      )}

      <UnsavedChangesDialog
        open={unsavedNavigation.isLeaveDialogOpen}
        onOpenChange={(open) => {
          if (!open) unsavedNavigation.stay();
        }}
        onSave={() => void unsavedNavigation.saveAndLeave()}
        onDiscard={unsavedNavigation.discardAndLeave}
        changeCount={unsavedCount}
        isSaving={unsavedNavigation.isSaving || isSaving}
      />
    </div>
  );
});

export default ClassScheduleView;
