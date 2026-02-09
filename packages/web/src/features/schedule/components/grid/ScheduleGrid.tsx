import { cn } from '@/lib/utils';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CELL_SIZE_MAP } from '../../constants';
import { useCellSelection } from '../../hooks/useCellSelection';
import { useDragDrop, type DragData } from '../../hooks/useDragDrop';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { usePeriodsConfiguration } from '../../hooks/usePeriodsConfiguration';
import { useSwapExecution } from '../../hooks/useSwapExecution';
import { useValidSwapTargets } from '../../hooks/useValidSwapTargets';
import { useViewScopeValidation } from '../../hooks/useViewScopeValidation';
import { useScheduleStore } from '../../stores/scheduleStore';
import type {
  DayOfWeek,
  EnrichedLesson,
  ScheduleGridProps,
  ScheduledLesson,
  SwapValidationResult,
} from '../../types';
import { createSlotKey } from '../../utils/indexBuilder';
import { createCellId, getFirstSlot } from '../../utils/navigationUtils';
import { DraggableCell } from './DraggableCell';
import { DroppableCell } from './DroppableCell';
import { MultiLessonCell } from './MultiLessonCell';
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

  // Get unique class ID from lessons (for single-class view)
  // Note: In teacher view, lessons can be from multiple classes
  const classId = useMemo(() => {
    if (lessons.length === 0) return null;
    // Only use classId if all lessons are from the same class
    const firstClassId = lessons[0].classId;
    const allSameClass = lessons.every((l) => l.classId === firstClassId);
    return allSameClass ? firstClassId : null;
  }, [lessons]);

  // Derive the effective viewId (use provided or derive from lessons)
  const effectiveViewId = viewId ?? classId ?? '';

  // Phase 7: Use valid swap targets hook for swap validation
  // Requirements: 11.1, 16.1
  const { validationResults, getValidationStatus } = useValidSwapTargets(selectedLesson, {
    viewScope,
    scopeId: effectiveViewId,
  });

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
        try {
          executeSwap(result);
        } catch (error) {
          console.error('Failed to execute swap:', error);
          // Could show error toast here if needed
        }
      }
    },
    [selectedLesson, validationResults, executeSwap, createSlotKey]
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

  // Phase 3: Use enriched data from store (computed once during load)
  // Issue #4, #5: No more per-render enrichment or index building
  const enrichedLessons = useScheduleStore((state) => state.enrichedLessons);
  const metadata = useScheduleStore((state) => state.metadata);

  // Phase 3: Use validation hook for view scope filtering
  // Issue #3: Validates viewId matches lessons
  const { isValid, filteredLessons, warnings } = useViewScopeValidation(
    enrichedLessons,
    viewScope,
    viewId ?? null
  );

  // Phase 3: Use periods configuration hook
  // Issue #6: Single source of truth for periods
  const periodsConfig = usePeriodsConfiguration(periodsPerDay, days, filteredLessons, metadata);

  // Build lookup maps from enriched lessons for O(1) access
  const lessonMap = useMemo(() => {
    const map = new Map<string, EnrichedLesson>();
    for (const lesson of filteredLessons) {
      const key = `${lesson.classId}-${lesson.day}-${lesson.periodIndex}`;
      map.set(key, lesson);
    }
    return map;
  }, [filteredLessons]);

  // Build multi-lesson map for teacher view: "day-period" -> lessons[]
  const lessonsBySlot = useMemo(() => {
    const map = new Map<string, EnrichedLesson[]>();
    for (const lesson of filteredLessons) {
      const key = `${lesson.day}-${lesson.periodIndex}`;
      const existing = map.get(key) || [];
      existing.push(lesson);
      map.set(key, existing);
    }
    return map;
  }, [filteredLessons]);

  // Phase 7: Get lesson at a specific slot (for SwapPreview)
  const getLessonAtSlot = useCallback(
    (day: DayOfWeek, period: number): EnrichedLesson | null => {
      if (classId) {
        // Single class: use classId-based lookup
        const key = `${classId}-${day}-${period}`;
        return lessonMap.get(key) || null;
      } else {
        // Multi-class: use slot-based lookup
        const slotKey = `${day}-${period}`;
        const lessonsAtSlot = lessonsBySlot.get(slotKey) || [];
        return lessonsAtSlot[0] || null;
      }
    },
    [classId, lessonMap, lessonsBySlot]
  );

  // Phase 7: Check if a slot is the source slot (selected lesson's slot)
  const isSourceSlot = useCallback(
    (day: DayOfWeek, period: number): boolean => {
      if (!selectedLesson || !selectedLesson.day || selectedLesson.periodIndex === undefined) {
        return false;
      }
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

  // Phase 3: Use periods from configuration hook
  // Issue #6: Single source of truth
  const periodsMap = periodsConfig.periodsMap;
  const maxPeriods = periodsConfig.maxPeriods;

  // Debug logging
  useEffect(() => {
    console.log('[ScheduleGrid] Phase 3 Debug', {
      enrichedLessonsCount: enrichedLessons.length,
      filteredLessonsCount: filteredLessons.length,
      isValid,
      warnings,
      classId,
      viewScope,
      viewId,
      days,
      periodsMapSize: periodsMap.size,
      maxPeriods,
      periodsMapEntries: Array.from(periodsMap.entries()),
      lessonMapSize: lessonMap.size,
      lessonsBySlotSize: lessonsBySlot.size,
    });
  }, [
    enrichedLessons,
    filteredLessons,
    isValid,
    warnings,
    classId,
    viewScope,
    viewId,
    days,
    periodsMap,
    maxPeriods,
    lessonMap,
    lessonsBySlot,
  ]);

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

  // Calculate responsive cell width based on number of periods
  // AGGRESSIVE sizing for better fit
  const getResponsiveCellWidth = () => {
    // More periods = narrower cells for better fit
    if (maxPeriods >= 8) return '80px'; // 8+ periods: very compact
    if (maxPeriods >= 7) return '90px'; // 7 periods: compact
    if (maxPeriods >= 6) return '100px'; // 6 periods: normal
    return '110px'; // 5 or fewer: comfortable
  };

  const minCellWidth = getResponsiveCellWidth();

  // Render the grid content (shared between read-only and editable modes)
  const renderGridContent = () => (
    <div
      className={cn('grid min-w-fit gap-2 p-3 bg-muted/30 rounded-lg', cellSizeConfig.className)}
      style={
        {
          gridTemplateColumns: `auto repeat(${maxPeriods}, minmax(${minCellWidth}, 1fr))`,
          '--cell-min-height': cellSizeConfig.minHeight,
        } as React.CSSProperties
      }
    >
      {/* Header row: empty corner + period numbers */}
      <div
        className={cn(
          'sticky top-0 z-20 bg-background shadow-sm rounded-lg',
          'sticky inset-inline-start-0 z-30'
        )}
      />
      {Array.from({ length: maxPeriods }, (_, i) => (
        <div
          key={`header-${i}`}
          className={cn(
            'sticky top-0 z-10 bg-background shadow-sm rounded-lg',
            'flex items-center justify-center p-3 font-medium text-base text-muted-foreground'
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
                'sticky inset-inline-start-0 z-10 bg-background shadow-sm rounded-lg',
                'flex items-center justify-center p-3 font-semibold text-md min-w-[100px]'
              )}
              role="rowheader"
            >
              {t(`days.${day}`)}
            </div>

            {/* Period cells */}
            {Array.from({ length: maxPeriods }, (_, periodIndex) => {
              // Phase 3: Issue #1, #2 - Multi-lesson handling for teacher view
              // Determine which lesson lookup strategy to use:
              // - If we have a single classId (class view or single-class teacher), use classId-based lookup
              // - If classId is null (multi-class teacher view), use slot-based lookup for multiple lessons
              let lesson: EnrichedLesson | null = null;
              let lessonsAtSlot: EnrichedLesson[] = [];

              if (classId) {
                // Single class view: use classId-day-period key
                const key = `${classId}-${day}-${periodIndex}`;
                lesson = lessonMap.get(key) || null;
              } else {
                // Multi-class view (teacher with multiple classes): use day-period key
                const slotKey = `${day}-${periodIndex}`;
                lessonsAtSlot = lessonsBySlot.get(slotKey) || [];
                lesson = lessonsAtSlot[0] || null;
              }

              const isOutOfRange = periodIndex >= dayPeriods;
              const cellId = createCellId(day, periodIndex);

              // Phase 3: Issue #15 - Visual indicator for disabled cells (variable periods)
              if (isOutOfRange) {
                // Render disabled/empty cell for days with fewer periods
                return (
                  <div
                    key={cellId}
                    className="bg-muted/10 rounded-lg flex items-center justify-center text-muted-foreground/40 text-2xl font-bold"
                    role="gridcell"
                    aria-disabled="true"
                    title={t('schedule.grid.disabledPeriod', 'این ساعت برای این روز فعال نیست')}
                  >
                    —
                  </div>
                );
              }

              // For read-only mode, render simple ScheduleCell or MultiLessonCell
              if (isReadOnly) {
                // Phase 3: Issue #1 - Use MultiLessonCell for multiple lessons
                if (!classId && lessonsAtSlot.length > 1) {
                  return (
                    <div key={cellId}>
                      <MultiLessonCell
                        lessons={lessonsAtSlot}
                        day={day}
                        period={periodIndex}
                        displaySettings={displaySettings}
                        isReadOnly={isReadOnly}
                      />
                    </div>
                  );
                }

                return (
                  <div key={cellId}>
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

              // Phase 3: Issue #1 - Use MultiLessonCell for multiple lessons in editable mode
              if (!classId && lessonsAtSlot.length > 1) {
                return (
                  <div
                    key={cellId}
                    className="relative"
                    onMouseEnter={() => handleCellHover(day, periodIndex)}
                    onMouseLeave={handleCellHoverLeave}
                  >
                    <MultiLessonCell
                      lessons={lessonsAtSlot}
                      day={day}
                      period={periodIndex}
                      displaySettings={displaySettings}
                      isReadOnly={false}
                      isFocused={isSlotFocused(day, periodIndex)}
                      onClick={() => {
                        // If a lesson is selected and this is a different slot, attempt swap
                        if (selectedLesson && !isSourceSlot(day, periodIndex)) {
                          handleSwapAttempt({ day, period: periodIndex });
                        } else {
                          handleCellClick(day, periodIndex, lesson);
                        }
                      }}
                    />

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
              }

              return (
                <div
                  key={cellId}
                  className="relative"
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
