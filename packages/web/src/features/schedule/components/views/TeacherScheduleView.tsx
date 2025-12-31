/**
 * TeacherScheduleView - Schedule view organized by teacher
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 * Phase 8 Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 11.1, 14.1, 14.2, 14.3
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Settings } from 'lucide-react';
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
import { TeacherTabs } from '../navigation/TeacherTabs';
import { DisplaySettingsDialog } from '../settings/DisplaySettingsDialog';
import { EmptyScheduleState } from './EmptyScheduleState';

/**
 * TeacherScheduleView - Main view for teacher-based schedule display
 *
 * Features:
 * - Horizontal scrollable TeacherTabs at top
 * - Main area with ScheduleGrid for selected teacher
 * - "All" tab showing combined read-only view
 * - Teacher metadata display (subjects, period count)
 * - Highlighted cells for selected teacher
 * - Phase 8: Undo/Redo buttons, Save button, keyboard shortcuts
 */
export const TeacherScheduleView = memo(function TeacherScheduleView() {
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
  const teachers = useScheduleStore((state) => state.teachers);
  const indexes = useScheduleStore((state) => state.indexes);
  const lessons = useScheduleStore((state) => state.lessons);
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
  const { currentViewId, filteredLessons, setView, availableTeachers, periodsPerDay, days } =
    useScheduleView('teacher');

  // Get selected teacher metadata
  const selectedTeacher = useMemo(() => {
    if (!currentViewId) return null;
    return teachers.get(currentViewId) ?? null;
  }, [currentViewId, teachers]);

  // Calculate lesson counts per teacher for tabs
  const lessonCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [teacherId, teacherLessons] of indexes.byTeacher) {
      counts.set(teacherId, teacherLessons.length);
    }
    return counts;
  }, [indexes.byTeacher]);

  // Get total period count for selected teacher
  const selectedTeacherPeriodCount = useMemo(() => {
    if (!currentViewId) return 0;
    return lessonCounts.get(currentViewId) ?? 0;
  }, [currentViewId, lessonCounts]);

  // Handle teacher selection
  const handleSelectTeacher = useCallback(
    (teacherId: string | null) => {
      setView('teacher', teacherId);
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

  // Determine which lessons to show
  // "All" view (null) shows all lessons, otherwise filtered by teacher
  const displayLessons = useMemo(() => {
    if (currentViewId === null) {
      return lessons; // Show all lessons for "All" view
    }
    return filteredLessons;
  }, [currentViewId, lessons, filteredLessons]);

  // Show empty state if no schedule loaded
  if (!scheduleId) {
    return <EmptyScheduleState />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Teacher tabs navigation */}
      <header className="p-4 border-b border-border bg-background">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <TeacherTabs
              teachers={availableTeachers}
              selectedTeacherId={currentViewId}
              onSelectTeacher={handleSelectTeacher}
              lessonCounts={lessonCounts}
            />
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
            {/* Export button - only show when a specific teacher is selected */}
            {currentViewId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportOpen(true)}
                className="gap-2"
                aria-label={t('schedule.export.button', 'صادرات')}
              >
                <Download className="h-4 w-4" />
                {t('schedule.export.button', 'صادرات')}
              </Button>
            )}
            {/* Settings button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label={t('schedule.settings.title', 'تنظیمات نمایش')}
              className="shrink-0"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Teacher metadata header */}
      {selectedTeacher && (
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{selectedTeacher.teacherName}</h2>
            <div className="flex items-center gap-2">
              {/* Period count badge */}
              <Badge variant="secondary">
                {t('schedule.metadata.periods', '{{count}} ساعت', {
                  count: selectedTeacherPeriodCount,
                })}
              </Badge>
              {/* Subject badges */}
              {selectedTeacher.primarySubjects.slice(0, 3).map((subject) => (
                <Badge key={subject} variant="outline">
                  {subject}
                </Badge>
              ))}
              {selectedTeacher.primarySubjects.length > 3 && (
                <Badge variant="outline">+{selectedTeacher.primarySubjects.length - 3}</Badge>
              )}
            </div>
          </div>
          {/* Class teacher info */}
          {selectedTeacher.classTeacherOf.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {t('schedule.metadata.classTeacherOf', 'معلم صنف: {{classes}}', {
                classes: selectedTeacher.classTeacherOf.join('، '),
              })}
            </p>
          )}
        </div>
      )}

      {/* "All" view header */}
      {currentViewId === null && (
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="text-lg font-semibold">{t('schedule.views.allTeachers', 'همه معلمان')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('schedule.views.allTeachersDescription', 'نمای کلی جدول زمانی همه معلمان')}
          </p>
        </div>
      )}

      {/* Schedule grid */}
      <div className="flex-1 overflow-auto p-4">
        <ScheduleGrid
          lessons={displayLessons}
          days={days}
          periodsPerDay={periodsPerDay}
          displaySettings={displaySettings}
          onCellClick={handleCellClick}
          isReadOnly={true}
          highlightTeacherId={currentViewId ?? undefined}
        />
      </div>

      {/* Display Settings Dialog */}
      <DisplaySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Export Dialog - only show when a specific teacher is selected */}
      {currentViewId && scheduleId && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          currentScheduleId={scheduleId}
          currentType="teacher"
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

export default TeacherScheduleView;
