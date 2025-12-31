/**
 * ClassScheduleView - Schedule view organized by class
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 * Phase 8 Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 11.1, 14.1, 14.2, 14.3
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Settings, User } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useSaveScheduleChanges } from '../../hooks/useSaveScheduleChanges';
import { useScheduleView } from '../../hooks/useScheduleView';
import {
  getHasUnsavedChanges,
  getUnsavedChangesCount,
  useScheduleStore,
} from '../../stores/scheduleStore';
import type { DayOfWeek, ScheduledLesson } from '../../types';
import { SaveButton } from '../edit/SaveButton';
import { UndoRedoButtons } from '../edit/UndoRedoButtons';
import { UnsavedChangesDialog } from '../edit/UnsavedChangesDialog';
import { ExportDialog } from '../export/ExportDialog';
import { ScheduleGrid } from '../grid/ScheduleGrid';
import { CategoryAccordion } from '../navigation/CategoryAccordion';
import { DisplaySettingsDialog } from '../settings/DisplaySettingsDialog';
import { EmptyScheduleState } from './EmptyScheduleState';

/**
 * ClassScheduleView - Main view for class-based schedule display
 *
 * Features:
 * - Left sidebar with CategoryAccordion for class navigation
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

  // Phase 8: Unsaved changes dialog state
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);

  // Get schedule data from store
  const scheduleId = useScheduleStore((state) => state.scheduleId);
  const displaySettings = useScheduleStore((state) => state.displaySettings);
  const classes = useScheduleStore((state) => state.classes);
  const initializeEditState = useScheduleStore((state) => state.initializeEditState);

  // Phase 8: Get unsaved changes state from store
  const unsavedCount = useScheduleStore(getUnsavedChangesCount);
  const hasChanges = useScheduleStore(getHasUnsavedChanges);

  // Phase 8: Use save schedule changes hook (Requirement: 15.1)
  const { saveChanges, isSaving } = useSaveScheduleChanges();

  // Phase 8: Initialize edit state when schedule loads (Requirement: 14.4)
  useEffect(() => {
    if (scheduleId !== null) {
      initializeEditState();
    }
  }, [scheduleId, initializeEditState]);

  // Phase 8: Register keyboard shortcuts (Requirement: 14.1)
  useKeyboardShortcuts({
    enabled: scheduleId !== null,
    onSave: saveChanges,
  });

  // Phase 8: Handle unsaved changes dialog actions
  const handleSaveAndLeave = useCallback(async () => {
    await saveChanges();
    setUnsavedDialogOpen(false);
  }, [saveChanges]);

  const handleLeaveWithoutSaving = useCallback(() => {
    setUnsavedDialogOpen(false);
  }, []);

  const handleCancelLeave = useCallback(() => {
    setUnsavedDialogOpen(false);
  }, []);

  // Use schedule view hook for filtering and navigation
  const { currentViewId, filteredLessons, setView, availableClasses, periodsPerDay, days } =
    useScheduleView('class');

  // Get selected class metadata
  const selectedClass = useMemo(() => {
    if (!currentViewId) return null;
    return classes.get(currentViewId) ?? null;
  }, [currentViewId, classes]);

  // Handle class selection
  const handleSelectClass = useCallback(
    (classId: string) => {
      setView('class', classId);
    },
    [setView]
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
    <div className="flex h-full">
      {/* Left sidebar with class navigation */}
      <aside className="w-64 shrink-0 border-e border-border bg-muted/30">
        <div className="p-3 border-b border-border">
          <h2 className="font-semibold text-sm">{t('schedule.views.classView', 'نمای صنف‌ها')}</h2>
        </div>
        <ScrollArea className="h-[calc(100%-49px)]">
          <CategoryAccordion
            categories={availableClasses}
            selectedClassId={currentViewId}
            onSelectClass={handleSelectClass}
          />
        </ScrollArea>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Class header with metadata */}
        {selectedClass && (
          <header className="p-4 border-b border-border bg-background">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold">{selectedClass.className}</h1>
                <div className="flex items-center gap-2">
                  {/* Single-teacher mode badge */}
                  {selectedClass.singleTeacherMode && (
                    <Badge variant="secondary" className="gap-1">
                      <User className="h-3 w-3" />
                      {t('schedule.metadata.singleTeacher', 'تک‌معلم')}
                    </Badge>
                  )}
                  {/* Student count */}
                  {selectedClass.studentCount > 0 && (
                    <Badge variant="outline">
                      {t('schedule.metadata.students', '{{count}} شاگرد', {
                        count: selectedClass.studentCount,
                      })}
                    </Badge>
                  )}
                  {/* Category */}
                  {selectedClass.categoryDari && (
                    <Badge variant="outline">{selectedClass.categoryDari}</Badge>
                  )}
                </div>
              </div>
              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {/* Phase 8: Undo/Redo buttons (Requirement: 14.1) */}
                <UndoRedoButtons />
                {/* Phase 8: Save button (Requirement: 14.1) */}
                <SaveButton
                  count={unsavedCount}
                  hasChanges={hasChanges}
                  isSaving={isSaving}
                  onSave={saveChanges}
                />
                {/* Export button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExportOpen(true)}
                  disabled={!currentViewId}
                  className="gap-2"
                  aria-label={t('schedule.export.button', 'صادرات')}
                >
                  <Download className="h-4 w-4" />
                  {t('schedule.export.button', 'صادرات')}
                </Button>
                {/* Settings button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSettingsOpen(true)}
                  aria-label={t('schedule.settings.title', 'تنظیمات نمایش')}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* Class teacher info for single-teacher mode */}
            {selectedClass.singleTeacherMode && selectedClass.classTeacherName && (
              <p className="text-sm text-muted-foreground mt-1">
                {t('schedule.metadata.classTeacher', 'معلم صنف: {{name}}', {
                  name: selectedClass.classTeacherName,
                })}
              </p>
            )}
          </header>
        )}

        {/* Schedule grid */}
        <div className="flex-1 overflow-auto p-4">
          {currentViewId ? (
            <ScheduleGrid
              lessons={filteredLessons}
              days={days}
              periodsPerDay={periodsPerDay}
              displaySettings={displaySettings}
              onCellClick={handleCellClick}
              isReadOnly={true}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {t('schedule.selectClass', 'یک صنف را از لیست انتخاب کنید')}
            </div>
          )}
        </div>
      </main>

      {/* Display Settings Dialog */}
      <DisplaySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Export Dialog */}
      {currentViewId && scheduleId && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          currentScheduleId={scheduleId}
          currentType="class"
          currentTargetId={currentViewId}
        />
      )}

      {/* Phase 8: Unsaved Changes Dialog (Requirement: 14.2) */}
      <UnsavedChangesDialog
        open={unsavedDialogOpen}
        onOpenChange={setUnsavedDialogOpen}
        count={unsavedCount}
        onSaveAndLeave={handleSaveAndLeave}
        onLeaveWithoutSaving={handleLeaveWithoutSaving}
        onCancel={handleCancelLeave}
        isSaving={isSaving}
      />
    </div>
  );
});

export default ClassScheduleView;
