/**
 * ClassScheduleView - Schedule view organized by class
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 * Phase 8 Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 11.1, 14.1, 14.2, 14.3
 */

import { Button } from '@/components/ui/button';
import { useNavigationGuardStore } from '@/stores/navigationGuardStore';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Edit3, Lock, Settings } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAutoSave } from '../../hooks/useAutoSave';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useSaveScheduleChanges } from '../../hooks/useSaveScheduleChanges';
import { useScheduleView } from '../../hooks/useScheduleView';
import { useSwapConstraintContext } from '../../hooks/useSwapConstraintContext';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import {
  getHasUnsavedChanges,
  getUnsavedChangesCount,
  useScheduleStore,
} from '../../stores/scheduleStore';
import type { DayOfWeek, ScheduledLesson } from '../../types';
import { SaveButton } from '../edit/SaveButton';
import { UndoRedoButtons } from '../edit/UndoRedoButtons';
import { ExportDialog } from '../export/ExportDialog';
import { ScheduleGrid } from '../grid/ScheduleGrid';
import { ClassTabNavigation } from '../navigation/ClassTabNavigation';
import { DisplaySettingsDialog } from '../settings/DisplaySettingsDialog';
import { EmptyScheduleState } from './EmptyScheduleState';

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
  const initializeEditState = useScheduleStore((state) => state.initializeEditState);

  // Phase 8: Get unsaved changes state from store
  const unsavedCount = useScheduleStore(getUnsavedChangesCount);
  const hasChanges = useScheduleStore(getHasUnsavedChanges);
  const { undo, redo } = useUndoRedo();

  // Phase 8: Use save schedule changes hook (Requirement: 15.1)
  const { saveChanges, isSaving } = useSaveScheduleChanges();
  useSwapConstraintContext(scheduleId);

  // Sync dirty state with navigation guard store
  const setDirty = useNavigationGuardStore((s) => s.setDirty);
  useEffect(() => {
    setDirty(hasChanges);
    return () => setDirty(false);
  }, [hasChanges, setDirty]);

  // Phase 8: Initialize edit state when schedule loads (Requirement: 14.4)
  useEffect(() => {
    if (scheduleId !== null) {
      initializeEditState();
    }
  }, [scheduleId, initializeEditState]);

  // Phase 8: Register keyboard shortcuts (Requirement: 14.1)
  useKeyboardShortcuts({
    enabled: scheduleId !== null,
    onUndo: undo,
    onRedo: redo,
    onSave: saveChanges,
  });

  // Phase 7: Auto-save to localStorage (Task 7.2)
  useAutoSave();

  // Use schedule view hook for filtering and navigation
  const { currentViewId, filteredLessons, setView, availableClasses, periodsPerDay, days } =
    useScheduleView('class');

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
    <div className="flex flex-col h-full">
      {/* Class Tab Navigation - Replaces sidebar */}
      <ClassTabNavigation
        categories={availableClasses}
        selectedClassId={currentViewId}
        onSelectClass={handleSelectClass}
      />

      {/* Action Buttons Header - Redesigned */}
      <header className="border-b bg-gradient-to-b from-white to-slate-50/50 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-6">
          {/* Left side - Editing toggle with enhanced design */}
          <div className="flex items-center gap-4">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Button
                variant={isEditingEnabled ? 'default' : 'outline'}
                size="default"
                onClick={() => setIsEditingEnabled(!isEditingEnabled)}
                className={
                  isEditingEnabled
                    ? 'gap-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md hover:shadow-lg transition-all duration-200 px-5 h-10'
                    : 'gap-2.5 border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all duration-200 px-5 h-10'
                }
                aria-label={
                  isEditingEnabled
                    ? t('editing.actions.disableEditing', 'غیرفعال‌سازی ویرایش')
                    : t('editing.actions.enableEditing', 'فعال‌سازی ویرایش')
                }
              >
                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{ rotate: isEditingEnabled ? 0 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {isEditingEnabled ? <Edit3 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </motion.div>
                <span className="font-medium">
                  {isEditingEnabled
                    ? t('editing.mode.editing', 'در حال ویرایش')
                    : t('editing.mode.readOnly', 'فقط خواندنی')}
                </span>
              </Button>
            </motion.div>

            {/* Editing hint with fade animation */}
            <AnimatePresence mode="wait">
              {!isEditingEnabled && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-md"
                >
                  {t('editing.hints.clickToSelect', 'برای ویرایش، دکمه را فعال کنید')}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Right side - Action buttons with improved spacing and design */}
          <div className="flex items-center gap-3">
            {/* Phase 8: Undo/Redo buttons - Animated entrance */}
            <AnimatePresence mode="wait">
              {isEditingEnabled && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 20 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <UndoRedoButtons />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Phase 8: Save button - Animated entrance */}
            <AnimatePresence mode="wait">
              {isEditingEnabled && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 20 }}
                  transition={{ duration: 0.2, delay: 0.05, ease: 'easeOut' }}
                >
                  <SaveButton
                    count={unsavedCount}
                    hasChanges={hasChanges}
                    isSaving={isSaving}
                    onSave={saveChanges}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Divider when editing mode is active */}
            <AnimatePresence>
              {isEditingEnabled && (
                <motion.div
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0 }}
                  transition={{ duration: 0.2 }}
                  className="h-8 w-px bg-slate-300"
                />
              )}
            </AnimatePresence>

            {/* Export button - Enhanced design */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Button
                variant="outline"
                size="default"
                onClick={() => setExportOpen(true)}
                disabled={!currentViewId}
                className="gap-2 border-2 border-slate-300 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 px-4 h-10 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={t('schedule.export.button', 'صادرات')}
              >
                <Download className="h-4 w-4" />
                <span className="font-medium">{t('schedule.export.button', 'صادرات')}</span>
              </Button>
            </motion.div>

            {/* Settings button - Enhanced design */}
            <motion.div
              whileHover={{ scale: 1.02, rotate: 90 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Button
                variant="ghost"
                size="default"
                onClick={() => setSettingsOpen(true)}
                className="border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-100 transition-all duration-200 px-3 h-10"
                aria-label={t('schedule.settings.title', 'تنظیمات نمایش')}
              >
                <Settings className="h-4 w-4 text-slate-600" />
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Schedule grid - Now takes full width */}
      <main className="flex-1 overflow-auto p-4">
        {currentViewId ? (
          <ScheduleGrid
            lessons={filteredLessons}
            days={days}
            periodsPerDay={periodsPerDay}
            displaySettings={displaySettings}
            onCellClick={handleCellClick}
            isReadOnly={!isEditingEnabled}
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
      {currentViewId && scheduleId && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          currentScheduleId={scheduleId}
          currentType="class"
          currentTargetId={currentViewId}
        />
      )}
    </div>
  );
});

export default ClassScheduleView;
