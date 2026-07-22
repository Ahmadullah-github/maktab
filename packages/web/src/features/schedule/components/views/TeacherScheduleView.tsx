/**
 * TeacherScheduleView - Schedule view organized by teacher
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 * Phase 8 Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 11.1, 14.1, 14.2, 14.3
 */

import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useNavigationGuardStore } from '@/stores/navigationGuardStore';
import { AlertTriangle, BookOpen, Users } from 'lucide-react';
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
import type { DayOfWeek, DisplaySettings, ScheduledLesson, TeacherMetadata } from '../../types';
import { cloneTeacherMetadata } from '../../utils/metadataCloners';
import { ExportDialog } from '../export/ExportDialog';
import { ScheduleGrid } from '../grid/ScheduleGrid';
import { TeacherTabs } from '../navigation/TeacherTabs';
import { DisplaySettingsDialog } from '../settings/DisplaySettingsDialog';
import { EmptyScheduleState } from './EmptyScheduleState';
import { ScheduleWorkspaceToolbar } from './ScheduleWorkspaceToolbar';
import { UnsavedChangesDialog } from '../edit/UnsavedChangesDialog';

/**
 * TeacherScheduleView - Main view for teacher-based schedule display
 *
 * Features:
 * - Horizontal scrollable TeacherTabs at top
 * - Main area with ScheduleGrid for selected teacher
 * - "All" tab showing a stacked teacher-by-teacher overview
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

  const [isEditingEnabled, setIsEditingEnabled] = useState(false);

  // Get schedule data from store
  const scheduleId = useScheduleStore((state) => state.scheduleId);
  const displaySettings = useScheduleStore((state) => state.displaySettings);
  const teachers = useScheduleStore((state) => state.teachers);
  const indexes = useScheduleStore((state) => state.indexes);
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
    availableTeachers,
    periodsPerDay,
    days,
    periodIntegrityIssues,
  } = useScheduleView('teacher');
  const hasPeriodIntegrityError = periodIntegrityIssues.length > 0;

  useEffect(() => {
    if (hasPeriodIntegrityError || currentViewId === null) {
      setIsEditingEnabled(false);
    }
  }, [currentViewId, hasPeriodIntegrityError]);

  // Prefer the hook-provided order, but fall back to the teacher map while data settles.
  const teacherList = useMemo<TeacherMetadata[]>(() => {
    if (availableTeachers.length > 0) {
      return availableTeachers;
    }

    return Array.from(teachers.entries())
      .map(([teacherId, teacher]) => ({
        ...cloneTeacherMetadata(teacher),
        teacherId,
      }))
      .sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'fa'));
  }, [availableTeachers, teachers]);

  // Get selected teacher metadata
  const selectedTeacher = useMemo(() => {
    if (!currentViewId) return null;
    return teacherList.find((teacher) => teacher.teacherId === currentViewId) ?? null;
  }, [currentViewId, teacherList]);

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

  const allTeacherSections = useMemo(
    () =>
      teacherList.map((teacher) => ({
        teacher,
        lessons: indexes.byTeacher.get(teacher.teacherId) ?? [],
      })),
    [teacherList, indexes.byTeacher]
  );

  const allTeacherStats = useMemo(
    () => ({
      totalTeachers: allTeacherSections.length,
      scheduledTeachers: allTeacherSections.filter((section) => section.lessons.length > 0).length,
      totalPeriods: allTeacherSections.reduce((sum, section) => sum + section.lessons.length, 0),
    }),
    [allTeacherSections]
  );

  const overviewDisplaySettings = useMemo<DisplaySettings>(
    () => ({
      ...displaySettings,
      cellSize: 'compact',
      fontSize: displaySettings.fontSize === 'lg' ? 'md' : 'sm',
    }),
    [displaySettings]
  );

  // Handle teacher selection
  const handleSelectTeacher = useCallback(
    (teacherId: string | null) => {
      cancelSelection();
      setView('teacher', teacherId);
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

  // Lessons for the currently selected teacher
  const displayLessons = useMemo(() => filteredLessons, [filteredLessons]);

  // Show empty state if no schedule loaded
  if (!scheduleId) {
    return <EmptyScheduleState />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/70 bg-background px-3 py-2">
        <TeacherTabs
          teachers={teacherList}
          selectedTeacherId={currentViewId}
          onSelectTeacher={handleSelectTeacher}
          lessonCounts={lessonCounts}
        />
      </div>

      <ScheduleWorkspaceToolbar
        title={selectedTeacher?.teacherName ?? t('schedule.views.allTeachers', 'همه معلمان')}
        description={
          currentViewId === null
            ? t(
                'schedule.views.allTeachersDescription',
                'برای مشاهده و جابه‌جایی درس‌ها، یک معلم را از بالا انتخاب کنید.'
              )
            : undefined
        }
        metadata={
          selectedTeacher ? (
            <>
              <Badge variant="secondary" className="h-6 rounded-full text-[11px]">
                {t('schedule.metadata.periods', '{{count}} ساعت', {
                  count: selectedTeacherPeriodCount,
                })}
              </Badge>
              {selectedTeacher.primarySubjects.length > 0 ? (
                <Badge variant="outline" className="h-6 gap-1 rounded-full text-[11px]">
                  <BookOpen className="h-3 w-3" />
                  {selectedTeacher.primarySubjects.slice(0, 2).join('، ')}
                  {selectedTeacher.primarySubjects.length > 2
                    ? ` +${selectedTeacher.primarySubjects.length - 2}`
                    : ''}
                </Badge>
              ) : null}
              {selectedTeacher.classTeacherOf.length > 0 ? (
                <Badge variant="outline" className="h-6 gap-1 rounded-full text-[11px]">
                  <Users className="h-3 w-3" />
                  {t('schedule.metadata.classTeacherOf', 'معلم صنف: {{classes}}', {
                    classes: selectedTeacher.classTeacherOf.join('، '),
                  })}
                </Badge>
              ) : null}
            </>
          ) : (
            <Badge variant="secondary" className="h-6 rounded-full text-[11px]">
              {t('schedule.views.teacherCount', '{{count}} معلم', {
                count: allTeacherStats.totalTeachers,
              })}
            </Badge>
          )
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

      {/* Schedule content */}
      <div
        id={currentViewId ? `teacher-schedule-${currentViewId}` : 'all-teachers-schedule'}
        className="flex-1 overflow-auto bg-muted/15 p-3 lg:p-4"
      >
        {currentViewId === null ? (
          allTeacherSections.length > 0 ? (
            <div className="mx-auto flex w-full max-w-[1800px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/80 shadow-sm">
              {allTeacherSections.map(({ teacher, lessons: teacherLessons }, index) => (
                <section
                  key={teacher.teacherId}
                  id={`teacher-schedule-${teacher.teacherId}`}
                  className="border-b border-slate-200 last:border-b-0"
                >
                  <div className="border-b border-slate-200/80 bg-linear-to-r from-slate-50 via-white to-slate-50 px-5 py-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#003366] text-sm font-semibold text-white shadow-sm">
                            {teacher.teacherName.trim().charAt(0) || String(index + 1)}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-slate-900">
                                {teacher.teacherName}
                              </h3>
                              <Badge className="border-transparent bg-[#003366]/10 text-[#003366]">
                                {t('schedule.metadata.periods', '{{count}} ساعت', {
                                  count: lessonCounts.get(teacher.teacherId) ?? 0,
                                })}
                              </Badge>
                              {teacherLessons.length === 0 && (
                                <Badge variant="outline" className="text-slate-500">
                                  {t('schedule.views.noAssignedLessons', 'بدون برنامه')}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-500">
                              {teacher.classTeacherOf.length > 0
                                ? t('schedule.metadata.classTeacherOf', 'معلم صنف: {{classes}}', {
                                    classes: teacher.classTeacherOf.join('، '),
                                  })
                                : t(
                                    'schedule.views.noClassTeacherAssignment',
                                    'هنوز به عنوان معلم صنف تعیین نشده است'
                                  )}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {teacher.primarySubjects.slice(0, 4).map((subject) => (
                          <Badge key={subject} variant="outline" className="bg-white/80">
                            {subject}
                          </Badge>
                        ))}
                        {teacher.primarySubjects.length === 0 && (
                          <Badge variant="outline" className="bg-white/80 text-slate-500">
                            {t('schedule.views.noPrimarySubjects', 'بدون مضمون تخصصی')}
                          </Badge>
                        )}
                        {teacher.primarySubjects.length > 4 && (
                          <Badge variant="outline" className="bg-white/80">
                            +{teacher.primarySubjects.length - 4}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    {teacherLessons.length > 0 ? (
                      <ScheduleGrid
                        lessons={teacherLessons}
                        days={days}
                        periodsPerDay={periodsPerDay}
                        displaySettings={overviewDisplaySettings}
                        onCellClick={handleCellClick}
                        isReadOnly={true}
                        viewScope="teacher"
                        viewId={teacher.teacherId}
                      />
                    ) : (
                      <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-sm text-slate-500">
                        {t(
                          'schedule.views.noLessonsForTeacher',
                          'برای این معلم هنوز هیچ ساعتی در جدول ثبت نشده است'
                        )}
                      </div>
                    )}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/70 px-6 text-sm text-slate-500">
              {t('schedule.views.noTeachersAvailable', 'هیچ معلمی برای نمایش وجود ندارد')}
            </div>
          )
        ) : (
          <ScheduleGrid
            lessons={displayLessons}
            days={days}
            periodsPerDay={periodsPerDay}
            displaySettings={displaySettings}
            onCellClick={handleCellClick}
            isReadOnly={!isEditingEnabled || hasPeriodIntegrityError}
            viewScope="teacher"
            viewId={currentViewId ?? undefined}
            highlightTeacherId={currentViewId ?? undefined}
          />
        )}
      </div>

      {/* Display Settings Dialog */}
      <DisplaySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Export Dialog - only show when a specific teacher is selected */}
      {currentViewId && scheduleId && !hasPeriodIntegrityError && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          currentScheduleId={scheduleId}
          currentType="teacher"
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

export default TeacherScheduleView;
