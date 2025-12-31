import { cn } from '@/lib/utils';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CELL_SIZE_MAP } from '../../constants';
import { useCellSelection } from '../../hooks/useCellSelection';
import { useDragDrop, type DragData } from '../../hooks/useDragDrop';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useValidSwapTargets } from '../../hooks/useValidSwapTargets';
import { useScheduleStore } from '../../stores/scheduleStore';
import type {
  DayOfWeek,
  ScheduleGridProps,
  ScheduledLesson,
  SwapValidationResult,
} from '../../types';
import { createSlotKey } from '../../utils/indexBuilder';
import { createCellId, getFirstSlot } from '../../utils/navigationUtils';
import { DraggableCell } from './DraggableCell';
import { DroppableCell } from './DroppableCell';
import { ScheduleCell } from './ScheduleCell';
import { SwapBlockedDialog } from './SwapBlockedDialog';
import { SwapPreview, SwapPreviewAtSource } from './SwapPreview';
import { SwapWarningDialog } from './SwapWarningDialog';

/**
 * Default days of the week (Afghan week starts on Saturday)
 */
const DEFAULT_DAYS: DayOfWeek[] = [
  'Saturday' as DayOfWeek,
  'Sunday' as DayOfWeek,
  'Monday' as DayOfWeek,
  'Tuesday' as DayOfWeek,
  'Wednesday' as DayOfWeek,
  'Thursday' as DayOfWeek,
];

/**
 * ScheduleGrid - Main grid component for displaying schedule
 *
 * Renders a CSS Grid layout with days as rows and periods as columns.
 * Supports both fixed and variable periods per day.
 * Integrates keyboard navigation, cell selection, and drag-drop for manual editing.
 *
 * Requirements: 6.1, 6.2 (focusability and initial focus)
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2 (drag-drop)
 */
export function ScheduleGrid({
  lessons,
  days = DEFAULT_DAYS,
  periodsPerDay,
  displaySettings,
  onCellClick,
  isReadOnly = true,
  highlightTeacherId,
  viewScope = 'class',
  viewId,
}: ScheduleGridProps) {
  const { t } = useTranslation();

  // Ref for the grid container (for keyboard navigation)
  const gridRef = useRef<HTMLDivElement>(null);

  // Track active drag data for DragOverlay
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);

  // Phase 7: Track hovered cell for SwapPreview
  const [hoveredSlot, setHoveredSlot] = useState<{ day: DayOfWeek; period: number } | null>(null);

  // Phase 7: Dialog state for swap warnings and blocks
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false);
  const [pendingSwapResult, setPendingSwapResult] = useState<SwapValidationResult | null>(null);

  // Get interaction state from store
  const focusedSlot = useScheduleStore((state) => state.focusedSlot);
  const selectedLesson = useScheduleStore((state) => state.selectedLesson);
  const isLocked = useScheduleStore((state) => state.isLocked);
  const setFocusedSlot = useScheduleStore((state) => state.setFocusedSlot);
  const cancelSelection = useScheduleStore((state) => state.cancelSelection);

  // Get unique class ID from lessons (for single-class view)
  const classId = useMemo(() => {
    if (lessons.length === 0) return null;
    return lessons[0].classId;
  }, [lessons]);

  // Derive the effective viewId (use provided or derive from lessons)
  const effectiveViewId = viewId ?? classId ?? '';

  // Phase 7: Use valid swap targets hook for swap validation
  // Requirements: 11.1, 16.1
  const { validationResults, getValidationStatus, hasValidTargets } = useValidSwapTargets(
    selectedLesson,
    {
      viewScope,
      scopeId: effectiveViewId,
    }
  );

  // Phase 8: Use swap execution hook (Requirement: 14.3)
  const { executeSwap } = useSwapExecution();

  // Integrate keyboard navigation hook
  // Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
  useKeyboardNavigation({
    days,
    periodsPerDay,
    gridRef,
  });

  // Integrate cell selection hook
  // Requirements: 3.1, 3.2, 3.3, 3.5
  const { handleCellAction } = useCellSelection({
    gridRef,
  });

  // Integrate drag-drop hook
  // Requirements: 4.1, 4.2, 4.5, 4.6, 5.1, 5.4
  const { sensors, handleDragStart, handleDragEnd, handleDragCancel } = useDragDrop({
    viewScope,
    viewId: effectiveViewId,
  });

  // Wrap drag start to track active drag data
  const onDragStart = useCallback(
    (event: Parameters<typeof handleDragStart>[0]) => {
      const dragData = event.active.data.current as DragData | undefined;
      if (dragData) {
        setActiveDragData(dragData);
      }
      handleDragStart(event);
    },
    [handleDragStart]
  );

  // Wrap drag end to clear active drag data
  const onDragEnd = useCallback(
    (event: Parameters<typeof handleDragEnd>[0]) => {
      setActiveDragData(null);
      handleDragEnd(event);
    },
    [handleDragEnd]
  );

  // Wrap drag cancel to clear active drag data
  const onDragCancel = useCallback(() => {
    setActiveDragData(null);
    handleDragCancel();
  }, [handleDragCancel]);

  // Phase 7: Handle swap attempt when clicking on a target cell
  // Phase 8: Execute swap on valid targets (Requirement: 14.3)
  // Requirements: 11.1, 16.1
  const handleSwapAttempt = useCallback(
    (targetSlot: { day: DayOfWeek; period: number }) => {
      // Only process if we have a selected lesson
      if (!selectedLesson) return;

      // Get validation result for this slot
      const slotKey = createSlotKey(targetSlot.day, targetSlot.period);
      const result = validationResults.get(slotKey);

      if (!result) return;

      // Store the pending swap result for dialog handling
      setPendingSwapResult(result);

      if (!result.isValid) {
        // Hard constraint violations - show blocked dialog
        setBlockedDialogOpen(true);
      } else if (result.canProceedWithWarning) {
        // Soft constraint violations - show warning dialog
        setWarningDialogOpen(true);
      } else {
        // Valid swap - execute directly (Phase 8: Requirement 14.3)
        executeSwap(result);
      }
    },
    [selectedLesson, validationResults, executeSwap]
  );

  // Phase 7: Handle warning dialog confirm
  // Phase 8: Execute swap after warning confirmation (Requirement: 14.3)
  const handleWarningConfirm = useCallback(() => {
    if (pendingSwapResult) {
      executeSwap(pendingSwapResult);
    }
    setPendingSwapResult(null);
    setWarningDialogOpen(false);
  }, [pendingSwapResult, executeSwap]);

  // Phase 7: Handle warning dialog cancel
  const handleWarningCancel = useCallback(() => {
    setPendingSwapResult(null);
  }, []);

  // Phase 7: Get alternative slots for blocked dialog
  const getAlternativeSlots = useCallback((): { day: DayOfWeek; period: number }[] => {
    const alternatives: { day: DayOfWeek; period: number }[] = [];

    for (const [slotKey, result] of validationResults) {
      if (result.isValid) {
        // Parse slot key to get day and period
        const [day, periodStr] = slotKey.split('-');
        const period = parseInt(periodStr, 10);
        if (!isNaN(period)) {
          alternatives.push({ day: day as DayOfWeek, period });
        }
      }
    }

    return alternatives.slice(0, 5); // Limit to 5 alternatives
  }, [validationResults]);

  // Phase 7: Handle hover for SwapPreview
  // Requirements: 13.1, 13.2
  const handleCellHover = useCallback(
    (day: DayOfWeek, period: number) => {
      // Only track hover when a lesson is selected
      if (!selectedLesson) {
        setHoveredSlot(null);
        return;
      }

      // Get validation status for this slot
      const status = getValidationStatus(day, period);

      // Only show preview for valid or warning targets
      if (status === 'valid' || status === 'warning') {
        setHoveredSlot({ day, period });
      } else {
        setHoveredSlot(null);
      }
    },
    [selectedLesson, getValidationStatus]
  );

  // Phase 7: Handle hover leave
  const handleCellHoverLeave = useCallback(() => {
    setHoveredSlot(null);
  }, []);

  // Handle grid focus event - set initial focusedSlot
  // Requirement: 6.2
  const handleGridFocus = useCallback(() => {
    // Only set initial focus if no slot is currently focused
    if (focusedSlot === null) {
      const firstSlot = getFirstSlot(days);
      if (firstSlot) {
        setFocusedSlot(firstSlot);
      }
    }
  }, [focusedSlot, days, setFocusedSlot]);

  // Build lesson lookup map for O(1) access: "classId-day-period" -> lesson
  const lessonMap = useMemo(() => {
    const map = new Map<string, ScheduledLesson>();
    for (const lesson of lessons) {
      const key = `${lesson.classId}-${lesson.day}-${lesson.periodIndex}`;
      map.set(key, lesson);
    }
    return map;
  }, [lessons]);

  // Phase 7: Get lesson at a specific slot (for SwapPreview)
  const getLessonAtSlot = useCallback(
    (day: DayOfWeek, period: number): ScheduledLesson | null => {
      if (!classId) return null;
      const key = `${classId}-${day}-${period}`;
      return lessonMap.get(key) || null;
    },
    [classId, lessonMap]
  );

  // Phase 7: Check if a slot is the source slot (selected lesson's slot)
  const isSourceSlot = useCallback(
    (day: DayOfWeek, period: number): boolean => {
      if (!selectedLesson) return false;
      return selectedLesson.day === day && selectedLesson.periodIndex === period;
    },
    [selectedLesson]
  );

  // Phase 7: Check if a slot is the hovered target slot
  const isHoveredTargetSlot = useCallback(
    (day: DayOfWeek, period: number): boolean => {
      if (!hoveredSlot) return false;
      return hoveredSlot.day === day && hoveredSlot.period === period;
    },
    [hoveredSlot]
  );

  // Derive periods per day map
  const periodsMap = useMemo((): Map<DayOfWeek, number> => {
    if (typeof periodsPerDay === 'number') {
      // Fixed periods for all days
      const map = new Map<DayOfWeek, number>();
      for (const day of days) {
        map.set(day, periodsPerDay);
      }
      return map;
    }
    return periodsPerDay;
  }, [periodsPerDay, days]);

  // Calculate max periods across all days for grid columns
  const maxPeriods = useMemo(() => {
    let max = 0;
    for (const count of periodsMap.values()) {
      if (count > max) max = count;
    }
    // Fallback: derive from lesson data if no config
    if (max === 0 && lessons.length > 0) {
      for (const lesson of lessons) {
        if (lesson.periodsThisDay && lesson.periodsThisDay > max) {
          max = lesson.periodsThisDay;
        }
        if (lesson.periodIndex + 1 > max) {
          max = lesson.periodIndex + 1;
        }
      }
    }
    return max || 6; // Default to 6 periods if nothing found
  }, [periodsMap, lessons]);

  // Handle cell click
  const handleCellClick = (day: DayOfWeek, period: number, lesson: ScheduledLesson | null) => {
    if (isReadOnly || !onCellClick) return;
    onCellClick(day, period, lesson);
    // Also trigger cell selection for non-read-only mode
    handleCellAction(day, period, lesson);
  };

  // Check if a slot is focused
  const isSlotFocused = (day: DayOfWeek, period: number): boolean => {
    return focusedSlot !== null && focusedSlot.day === day && focusedSlot.period === period;
  };

  // Check if a lesson is selected
  const isLessonSelected = (lesson: ScheduledLesson | null): boolean => {
    if (!selectedLesson || !lesson) return false;
    return (
      selectedLesson.day === lesson.day &&
      selectedLesson.periodIndex === lesson.periodIndex &&
      selectedLesson.classId === lesson.classId
    );
  };

  // Check if a lesson should be highlighted (teacher match)
  const isLessonHighlighted = (lesson: ScheduledLesson | null): boolean => {
    if (!highlightTeacherId || !lesson) return false;
    return lesson.teacherIds.includes(highlightTeacherId);
  };

  // Get cell size configuration from CELL_SIZE_MAP
  const cellSizeConfig = useMemo(() => {
    return CELL_SIZE_MAP[displaySettings.cellSize];
  }, [displaySettings.cellSize]);

  // Render the grid content (shared between read-only and editable modes)
  const renderGridContent = () => (
    <div
      className={cn('grid min-w-fit', cellSizeConfig.className)}
      style={
        {
          gridTemplateColumns: `auto repeat(${maxPeriods}, minmax(${cellSizeConfig.minWidth}, 1fr))`,
          '--cell-min-height': cellSizeConfig.minHeight,
        } as React.CSSProperties
      }
    >
      {/* Header row: empty corner + period numbers */}
      <div
        className={cn(
          'sticky top-0 z-20 bg-background border-b border-border',
          'sticky inset-inline-start-0 z-30'
        )}
      />
      {Array.from({ length: maxPeriods }, (_, i) => (
        <div
          key={`header-${i}`}
          className={cn(
            'sticky top-0 z-10 bg-background border-b border-border',
            'flex items-center justify-center p-2 font-medium text-sm text-muted-foreground'
          )}
        >
          {t('common.periodNumber', { number: i + 1 })}
        </div>
      ))}

      {/* Day rows */}
      {days.map((day) => {
        const dayPeriods = periodsMap.get(day) || maxPeriods;

        return (
          <div key={day} className="contents" role="row">
            {/* Day name cell (sticky) */}
            <div
              className={cn(
                'sticky inset-inline-start-0 z-10 bg-background border-e border-b border-border',
                'flex items-center justify-center p-2 font-medium text-sm min-w-[80px]'
              )}
              role="rowheader"
            >
              {t(`days.${day}`)}
            </div>

            {/* Period cells */}
            {Array.from({ length: maxPeriods }, (_, periodIndex) => {
              const key = classId ? `${classId}-${day}-${periodIndex}` : null;
              const lesson = key ? lessonMap.get(key) || null : null;
              const isOutOfRange = periodIndex >= dayPeriods;
              const cellId = createCellId(day, periodIndex);

              if (isOutOfRange) {
                // Render disabled/empty cell for days with fewer periods
                return (
                  <div
                    key={cellId}
                    className="border-b border-border bg-muted/10"
                    role="gridcell"
                    aria-disabled="true"
                  />
                );
              }

              // For read-only mode, render simple ScheduleCell
              if (isReadOnly) {
                return (
                  <div key={cellId} className="border-b border-border">
                    <ScheduleCell
                      lesson={lesson}
                      displaySettings={displaySettings}
                      isFocused={isSlotFocused(day, periodIndex)}
                      isSelected={isLessonSelected(lesson)}
                      isHighlighted={isLessonHighlighted(lesson)}
                      isReadOnly={isReadOnly}
                    />
                  </div>
                );
              }

              // For editable mode, wrap with DroppableCell and DraggableCell
              // Phase 7: Include validation status and swap preview
              const validationStatus = selectedLesson
                ? getValidationStatus(day, periodIndex)
                : null;
              const showSwapPreviewAtTarget =
                isHoveredTargetSlot(day, periodIndex) && selectedLesson;
              const showSwapPreviewAtSource =
                isSourceSlot(day, periodIndex) && hoveredSlot !== null;
              const targetLessonForPreview = hoveredSlot
                ? getLessonAtSlot(hoveredSlot.day, hoveredSlot.period)
                : null;

              return (
                <div
                  key={cellId}
                  className="border-b border-border relative"
                  onMouseEnter={() => handleCellHover(day, periodIndex)}
                  onMouseLeave={handleCellHoverLeave}
                >
                  <DroppableCell
                    id={cellId}
                    day={day}
                    period={periodIndex}
                    viewScope={viewScope}
                    viewId={effectiveViewId}
                    disabled={isOutOfRange}
                  >
                    <DraggableCell
                      id={cellId}
                      day={day}
                      period={periodIndex}
                      lesson={lesson}
                      displaySettings={displaySettings}
                      isSelected={isLessonSelected(lesson)}
                      isFocused={isSlotFocused(day, periodIndex)}
                      isHighlighted={isLessonHighlighted(lesson)}
                      validationStatus={validationStatus}
                      viewScope={viewScope}
                      viewId={effectiveViewId}
                      disabled={isLocked && !isLessonSelected(lesson)}
                      onClick={() => {
                        // If a lesson is selected and this is a different slot, attempt swap
                        if (selectedLesson && !isSourceSlot(day, periodIndex)) {
                          handleSwapAttempt({ day, period: periodIndex });
                        } else {
                          handleCellClick(day, periodIndex, lesson);
                        }
                      }}
                      isReadOnly={false}
                    />
                  </DroppableCell>

                  {/* Phase 7: SwapPreview at target position */}
                  {showSwapPreviewAtTarget && selectedLesson && (
                    <SwapPreview
                      sourceLesson={selectedLesson}
                      targetLesson={lesson}
                      sourceSlot={{
                        day: selectedLesson.day as DayOfWeek,
                        period: selectedLesson.periodIndex,
                      }}
                      targetSlot={{ day, period: periodIndex }}
                      displaySettings={displaySettings}
                    />
                  )}

                  {/* Phase 7: SwapPreview at source position (showing target lesson) */}
                  {showSwapPreviewAtSource && (
                    <SwapPreviewAtSource
                      targetLesson={targetLessonForPreview}
                      displaySettings={displaySettings}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  // For read-only mode, render without DndContext
  if (isReadOnly) {
    return (
      <div
        ref={gridRef}
        dir="rtl"
        className="overflow-auto outline-none"
        role="grid"
        aria-label={t('schedule.grid.title', 'جدول زمانی')}
        tabIndex={0}
        onFocus={handleGridFocus}
      >
        {renderGridContent()}
      </div>
    );
  }

  // For editable mode, wrap with DndContext
  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div
        ref={gridRef}
        dir="rtl"
        className="overflow-auto outline-none"
        role="grid"
        aria-label={t('schedule.grid.title', 'جدول زمانی')}
        tabIndex={0}
        onFocus={handleGridFocus}
      >
        {renderGridContent()}
      </div>

      {/* Drag overlay for visual feedback during drag */}
      <DragOverlay>
        {activeDragData?.lesson ? (
          <div className="opacity-80 shadow-lg">
            <ScheduleCell
              lesson={activeDragData.lesson}
              displaySettings={displaySettings}
              isSelected={true}
              isReadOnly={true}
            />
          </div>
        ) : null}
      </DragOverlay>

      {/* Phase 7: Swap Warning Dialog */}
      <SwapWarningDialog
        open={warningDialogOpen}
        onOpenChange={setWarningDialogOpen}
        warnings={pendingSwapResult?.warnings ?? []}
        onConfirm={handleWarningConfirm}
        onCancel={handleWarningCancel}
      />

      {/* Phase 7: Swap Blocked Dialog */}
      <SwapBlockedDialog
        open={blockedDialogOpen}
        onOpenChange={setBlockedDialogOpen}
        errors={pendingSwapResult?.errors ?? []}
        alternativeSlots={getAlternativeSlots()}
      />
    </DndContext>
  );
}

export default ScheduleGrid;
