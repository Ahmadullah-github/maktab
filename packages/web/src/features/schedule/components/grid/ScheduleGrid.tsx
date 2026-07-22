import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import {
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  CheckCircle2,
  Loader2,
  MousePointerClick,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CELL_SIZE_MAP } from '../../constants';
import { useCellSelection } from '../../hooks/useCellSelection';
import { useDragDrop, type DragData } from '../../hooks/useDragDrop';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { usePeriodsConfiguration } from '../../hooks/usePeriodsConfiguration';
import { useSwapExecution } from '../../hooks/useSwapExecution';
import {
  getValidationStatusFromResult,
  useValidSwapTargets,
} from '../../hooks/useValidSwapTargets';
import { useViewScopeValidation } from '../../hooks/useViewScopeValidation';
import { useScheduleStore } from '../../stores/scheduleStore';
import type {
  CellValidationStatus,
  DayOfWeek,
  EnrichedLesson,
  ScheduleGridProps,
  ScheduledLesson,
  SwapValidationResult,
} from '../../types';
import { createSlotKey } from '../../utils/indexBuilder';
import { logger } from '../../utils/logger';
import { createCellId, getFirstSlot } from '../../utils/navigationUtils';
import {
  collectAlternativeSwapSlots,
  getSwapValidationStatus,
  rankSwapValidationResult,
} from '../../utils/swapValidation';
import { DraggableCell } from './DraggableCell';
import { DroppableCell } from './DroppableCell';
import { MultiLessonCell } from './MultiLessonCell';
import { ScheduleCell } from './ScheduleCell';
import { SwapLessonPickerDialog } from './SwapLessonPickerDialog';
import { SwapPreview, SwapPreviewAtSource } from './SwapPreview';

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

interface LessonPickerState {
  mode: 'source' | 'target';
  day: DayOfWeek;
  period: number;
  options: Array<{
    lesson: ScheduledLesson;
    status?: CellValidationStatus;
    result?: SwapValidationResult;
  }>;
}

type ResolvedSwapStatus = Exclude<CellValidationStatus, 'checking' | null>;
type SwapReviewStatus = Extract<ResolvedSwapStatus, 'blocked' | 'warning'>;

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
  const { t, i18n } = useTranslation();

  // Ref for the grid container (for keyboard navigation)
  const gridRef = useRef<HTMLDivElement>(null);

  // Track active drag data for DragOverlay
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);

  // Phase 7: Track hovered cell for SwapPreview
  const [hoveredSlot, setHoveredSlot] = useState<{ day: DayOfWeek; period: number } | null>(null);
  const hoverCandidateRef = useRef<string | null>(null);

  // Phase 7: Swap session state
  const [pendingSwapResult, setPendingSwapResult] = useState<SwapValidationResult | null>(null);
  const [pendingTargetSlot, setPendingTargetSlot] = useState<{ day: DayOfWeek; period: number } | null>(
    null
  );
  const [lessonPickerState, setLessonPickerState] = useState<LessonPickerState | null>(null);

  // Get interaction state from store
  const focusedSlot = useScheduleStore((state) => state.focusedSlot);
  const selectedLesson = useScheduleStore((state) => state.selectedLesson);
  const isLocked = useScheduleStore((state) => state.isLocked);
  const setFocusedSlot = useScheduleStore((state) => state.setFocusedSlot);
  const cancelSelection = useScheduleStore((state) => state.cancelSelection);
  const selectLesson = useScheduleStore((state) => state.selectLesson);

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
  const {
    validationResults,
    getValidationStatus,
    isLoading: isSwapValidationPending,
    validatingSlotKey,
    validateSlot,
    error: swapValidationError,
  } = useValidSwapTargets(selectedLesson, {
    viewScope,
    scopeId: effectiveViewId,
  });
  const isExplicitSwapValidationPending =
    isSwapValidationPending && pendingTargetSlot !== null;

  // Phase 8: Use swap execution hook (Requirement: 14.3)
  const { executeSwap } = useSwapExecution();
  const [lastResolvedStatus, setLastResolvedStatus] = useState<ResolvedSwapStatus | null>(null);
  const selectedLessonKey = useMemo(
    () =>
      selectedLesson
        ? `${selectedLesson.classId}-${selectedLesson.subjectId}-${selectedLesson.day}-${selectedLesson.periodIndex}`
        : null,
    [selectedLesson]
  );

  useEffect(() => {
    setLastResolvedStatus(null);
    setPendingSwapResult(null);
    setPendingTargetSlot(null);
    setHoveredSlot(null);
    setLessonPickerState(null);
  }, [selectedLessonKey]);

  // Integrate keyboard navigation hook
  // Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
  useKeyboardNavigation({
    days,
    periodsPerDay,
    gridRef,
  });

  // Phase 7: Handle swap attempt when clicking on a target cell
  // Phase 8: Execute swap on valid targets (Requirement: 14.3)
  // Requirements: 11.1, 16.1
  const processSwapResult = useCallback(
    (result: SwapValidationResult) => {
      setPendingSwapResult(result);
      setPendingTargetSlot(result.swap.slotB);

      const status = getSwapValidationStatus(result);
      setLastResolvedStatus(status);

      if (status === 'blocked' || status === 'warning') {
        return;
      }

      try {
        executeSwap(result);
        setPendingSwapResult(null);
      } catch (error) {
        logger.error('Failed to execute validated swap', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [executeSwap]
  );

  const openSourceLessonPicker = useCallback(
    (day: DayOfWeek, period: number, slotLessons: ScheduledLesson[]) => {
      const movableLessons = slotLessons.filter((lesson) => !lesson.isFixed);
      if (movableLessons.length === 0) return;
      setLessonPickerState({
        mode: 'source',
        day,
        period,
        options: movableLessons.map((lesson) => ({
          lesson,
        })),
      });
    },
    []
  );

  const openTargetLessonPicker = useCallback(
    (day: DayOfWeek, period: number, results: SwapValidationResult[]) => {
      const orderedResults = [...results].sort(
        (left, right) => rankSwapValidationResult(right) - rankSwapValidationResult(left)
      );

      setLessonPickerState({
        mode: 'target',
        day,
        period,
        options: orderedResults
          .filter((result) => result.swap.lessonB !== null)
          .map((result) => ({
            lesson: result.swap.lessonB!,
            status: getValidationStatusFromResult(result),
            result,
          })),
      });
    },
    []
  );

  const handleSwapAttempt = useCallback(
    async (targetSlot: { day: DayOfWeek; period: number }) => {
      // Only process if we have a selected lesson
      if (!selectedLesson) return;

      if (selectedLesson.day === targetSlot.day && selectedLesson.periodIndex === targetSlot.period) {
        return;
      }

      const targetSlotKey = createSlotKey(targetSlot.day, targetSlot.period);
      if (validatingSlotKey === targetSlotKey) {
        return;
      }

      setHoveredSlot(null);
      setPendingSwapResult(null);
      setPendingTargetSlot(targetSlot);
      setLastResolvedStatus(null);

      let results: SwapValidationResult[];
      try {
        results = await validateSlot(targetSlot.day, targetSlot.period);
      } catch (error) {
        logger.error('Failed to validate swap target', {
          error: error instanceof Error ? error.message : String(error),
        });
        setPendingTargetSlot(null);
        return;
      }

      if (results.length === 0) {
        setPendingTargetSlot(null);
        return;
      }

      if (results.length > 1) {
        openTargetLessonPicker(targetSlot.day, targetSlot.period, results);
        return;
      }

      processSwapResult(results[0]);
    },
    [
      openTargetLessonPicker,
      processSwapResult,
      selectedLesson,
      validateSlot,
      validatingSlotKey,
    ]
  );

  // Integrate cell selection hook
  // Requirements: 3.1, 3.2, 3.3, 3.5
  const { handleCellAction } = useCellSelection({
    gridRef,
    onCellActionRequested: (slot) => {
      const slotLessons = getLessonsAtSlot(slot.day, slot.period);
      handleGridCellAction(slot.day, slot.period, slotLessons);
    },
    onSwapInitiated: (_sourceLesson, targetSlot) => {
      void handleSwapAttempt(targetSlot);
    },
  });

  // Integrate drag-drop hook
  // Requirements: 4.1, 4.2, 4.5, 4.6, 5.1, 5.4
  const { sensors, handleDragStart, handleDragEnd, handleDragCancel } = useDragDrop({
    viewScope,
    viewId: effectiveViewId,
    onDropComplete: (_source, targetSlot) => {
      void handleSwapAttempt(targetSlot);
    },
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

  // Phase 7: Handle warning dialog confirm
  // Phase 8: Execute swap after warning confirmation (Requirement: 14.3)
  const handleWarningConfirm = useCallback(() => {
    try {
      if (pendingSwapResult) {
        executeSwap(pendingSwapResult);
      }
    } finally {
      setPendingTargetSlot(null);
      setPendingSwapResult(null);
      setLastResolvedStatus(null);
    }
  }, [pendingSwapResult, executeSwap]);

  const handleChooseAnotherTarget = useCallback(() => {
    setPendingTargetSlot(null);
    setPendingSwapResult(null);
    setLastResolvedStatus(null);
  }, []);

  const handleLessonPickerOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        if (lessonPickerState?.mode === 'target') {
          setPendingTargetSlot(null);
        }
        setLessonPickerState(null);
      }
    },
    [lessonPickerState?.mode]
  );

  const handleLessonPickerSelect = useCallback(
    (lesson: ScheduledLesson) => {
      if (!lessonPickerState) {
        return;
      }

      if (lessonPickerState.mode === 'source') {
        selectLesson(lesson);
        setLastResolvedStatus(null);
        setLessonPickerState(null);
        return;
      }

      const selectedResult = lessonPickerState.options.find(
        (option) =>
          option.lesson.classId === lesson.classId &&
          option.lesson.day === lesson.day &&
          option.lesson.periodIndex === lesson.periodIndex &&
          option.result
      )?.result;

      if (selectedResult) {
        processSwapResult(selectedResult);
      }

      setLessonPickerState(null);
    },
    [lessonPickerState, processSwapResult, selectLesson]
  );

  const handleCancelSwapSelection = useCallback(() => {
    cancelSelection();
    setHoveredSlot(null);
    setPendingTargetSlot(null);
    setPendingSwapResult(null);
    setLessonPickerState(null);
    setLastResolvedStatus(null);
  }, [cancelSelection]);

  // Phase 7: Get alternative slots for blocked dialog
  const getAlternativeSlots = useCallback(
    (): { day: DayOfWeek; period: number }[] => collectAlternativeSwapSlots(validationResults),
    [validationResults]
  );

  const formatSlotLabel = useCallback(
    (day: DayOfWeek, period: number) =>
      `${t(`days.${day}`)} • ${t('common.periodNumber', { number: period + 1 })}`,
    [t]
  );

  const reviewStatus = useMemo<SwapReviewStatus | null>(() => {
    if (!pendingSwapResult || isExplicitSwapValidationPending) {
      return null;
    }

    return lastResolvedStatus === 'blocked' || lastResolvedStatus === 'warning'
      ? lastResolvedStatus
      : null;
  }, [isExplicitSwapValidationPending, lastResolvedStatus, pendingSwapResult]);

  const swapStatus = useMemo(() => {
    if (!selectedLesson) {
      return null;
    }

    const sourceLabel = selectedLesson.subjectName ?? selectedLesson.className ?? '';
    const sourceSlotLabel = formatSlotLabel(selectedLesson.day, selectedLesson.periodIndex);
    const targetSlotLabel = pendingTargetSlot
      ? formatSlotLabel(pendingTargetSlot.day, pendingTargetSlot.period)
      : null;
    const stepLabel = isExplicitSwapValidationPending
      ? t('swap.feedback.stepChecking', 'مرحله ۲: در حال بررسی مقصد')
      : reviewStatus
        ? t('swap.feedback.stepReview', 'مرحله ۲: بازبینی نتیجه')
        : t('swap.feedback.stepTarget', 'مرحله ۲: انتخاب مقصد');

    if (isExplicitSwapValidationPending) {
      return {
        className: 'border-sky-200 bg-sky-50 text-sky-800',
        icon: Loader2,
        iconClassName: 'animate-spin',
        stepLabel,
        message: t('swap.feedback.checking', 'در حال بررسی جابه‌جایی...'),
        helper: t(
          'swap.feedback.checkingHint',
          'لطفاً کمی صبر کنید. این بررسی ممکن است چند ثانیه طول بکشد.'
        ),
        sourceLabel,
        sourceSlotLabel,
        targetSlotLabel,
      };
    }

    if (swapValidationError) {
      return {
        className: 'border-rose-200 bg-rose-50 text-rose-800',
        icon: AlertTriangle,
        iconClassName: '',
        stepLabel,
        message: t(
          'swap.feedback.validationFailed',
          'اعتبارسنجی جابه‌جایی انجام نشد. دوباره تلاش کنید.'
        ),
        helper: t(
          'swap.feedback.tryAnotherTarget',
          'می‌توانید مقصد دیگری را انتخاب کنید یا این حالت را لغو کنید.'
        ),
        sourceLabel,
        sourceSlotLabel,
        targetSlotLabel,
      };
    }

    if (lastResolvedStatus === 'blocked') {
      return {
        className: 'border-rose-200 bg-rose-50 text-rose-800',
        icon: Ban,
        iconClassName: '',
        stepLabel,
        message: t('swap.feedback.blocked', 'این جابه‌جایی ممکن نیست. مقصد دیگری را انتخاب کنید.'),
        helper: t(
          'swap.feedback.tryAnotherTarget',
          'می‌توانید مقصد دیگری را انتخاب کنید یا این حالت را لغو کنید.'
        ),
        sourceLabel,
        sourceSlotLabel,
        targetSlotLabel,
      };
    }

    if (lastResolvedStatus === 'warning') {
      return {
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: AlertTriangle,
        iconClassName: '',
        stepLabel,
        message: t('swap.feedback.warning', 'این جابه‌جایی هشدار دارد و نیاز به تأیید دارد.'),
        helper: null,
        sourceLabel,
        sourceSlotLabel,
        targetSlotLabel,
      };
    }

    if (lastResolvedStatus === 'valid') {
      return {
        className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        icon: CheckCircle2,
        iconClassName: '',
        stepLabel,
        message: t('swap.feedback.valid', 'جابه‌جایی مجاز است. در حال اعمال تغییرات...'),
        helper: null,
        sourceLabel,
        sourceSlotLabel,
        targetSlotLabel,
      };
    }

      return {
        className: 'border-primary/20 bg-primary/5 text-primary',
        icon: MousePointerClick,
        iconClassName: '',
        stepLabel,
        message: t('swap.feedback.selectTarget', 'خانه مقصد را انتخاب کنید.'),
        helper: t(
          'swap.feedback.cancelHint',
          'برای خروج از حالت جابه‌جایی، لغو را بزنید یا کلید Esc را فشار دهید.'
        ),
      sourceLabel,
      sourceSlotLabel,
        targetSlotLabel,
      };
  }, [
    formatSlotLabel,
    isExplicitSwapValidationPending,
    lastResolvedStatus,
    pendingTargetSlot,
    reviewStatus,
    selectedLesson,
    swapValidationError,
    t,
  ]);
  const SwapStatusIcon = swapStatus?.icon;

  const swapReview = useMemo(() => {
    if (!pendingSwapResult || reviewStatus === null) {
      return null;
    }

    if (reviewStatus === 'blocked') {
      const alternativeSlots = getAlternativeSlots();
      return {
        className: 'border-rose-200 bg-rose-50/80 text-rose-900',
        icon: Ban,
        iconClassName: '',
        title: t('swap.feedback.blockedTitle', 'این جابه‌جایی ممکن نیست'),
        description: t(
          'swap.feedback.blockedDescription',
          'این مقصد با محدودیت‌های برنامه سازگار نیست. مقصد دیگری را انتخاب کنید.'
        ),
        items: pendingSwapResult.errors.map((error) =>
          i18n.language.startsWith('en') ? error.message : error.messageFarsi || error.message
        ),
        alternativeSlots,
      };
    }

    return {
      className: 'border-amber-200 bg-amber-50/80 text-amber-900',
      icon: AlertTriangle,
      iconClassName: '',
      title: t('swap.feedback.warningTitle', 'این جابه‌جایی هشدار دارد'),
      description: t(
        'swap.feedback.warningDescription',
        'می‌توانید ادامه دهید، مقصد دیگری انتخاب کنید، یا جابه‌جایی را لغو کنید.'
      ),
      items: pendingSwapResult.warnings.map((warning) =>
        i18n.language.startsWith('en') ? warning.message : warning.messageFarsi || warning.message
      ),
      alternativeSlots: [] as { day: DayOfWeek; period: number }[],
    };
  }, [getAlternativeSlots, i18n.language, pendingSwapResult, reviewStatus, t]);
  const SwapReviewIcon = swapReview?.icon;

  // Phase 7: Handle hover for SwapPreview
  // Requirements: 13.1, 13.2
  const handleCellHover = useCallback(
    (day: DayOfWeek, period: number) => {
      // Only track hover when a lesson is selected
      if (!selectedLesson) {
        hoverCandidateRef.current = null;
        setHoveredSlot(null);
        return;
      }

      if (selectedLesson.day === day && selectedLesson.periodIndex === period) {
        hoverCandidateRef.current = null;
        setHoveredSlot(null);
        return;
      }

      const candidateKey = createSlotKey(day, period);
      hoverCandidateRef.current = candidateKey;

      // Get validation status for this slot
      const status = getValidationStatus(day, period);

      // Only show preview for valid or warning targets
      if (status === 'valid' || status === 'warning') {
        setHoveredSlot({ day, period });
      } else {
        setHoveredSlot(null);
        if (status === null) {
          void validateSlot(day, period)
            .then((results) => {
              if (hoverCandidateRef.current !== candidateKey) return;
              const hasPreviewableResult = results.some((result) => {
                const resultStatus = getSwapValidationStatus(result);
                return resultStatus === 'valid' || resultStatus === 'warning';
              });
              if (hasPreviewableResult) setHoveredSlot({ day, period });
            })
            .catch(() => {
              // Click validation presents errors; hover prefetch stays quiet.
            });
        }
      }
    },
    [selectedLesson, getValidationStatus, validateSlot]
  );

  // Phase 7: Handle hover leave
  const handleCellHoverLeave = useCallback(() => {
    hoverCandidateRef.current = null;
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
  const { filteredLessons } = useViewScopeValidation(enrichedLessons, viewScope, viewId ?? null);

  // Phase 3: Use periods configuration hook
  // Issue #6: Single source of truth for periods
  const periodsConfig = usePeriodsConfiguration(periodsPerDay, days, filteredLessons, metadata);

  const periodHeaderTimes = useMemo(() => {
    return Array.from({ length: periodsConfig.maxPeriods }, (_, periodIndex) => {
      const timings = days
        .map((day) =>
          metadata?.periodConfiguration?.periodTimelineByDay?.[day]?.find(
            (entry) => entry.periodIndex === periodIndex
          )
        )
        .filter((timing): timing is NonNullable<typeof timing> => Boolean(timing));

      if (timings.length === 0) return null;
      const firstTiming = timings[0];
      const isSharedTime = timings.every(
        (timing) =>
          timing.startTime === firstTiming.startTime && timing.endTime === firstTiming.endTime
      );

      return isSharedTime ? firstTiming : null;
    });
  }, [days, metadata?.periodConfiguration?.periodTimelineByDay, periodsConfig.maxPeriods]);

  const renderSlotTime = (day: DayOfWeek, periodIndex: number) => {
    const timing = metadata?.periodConfiguration?.periodTimelineByDay?.[day]?.find(
      (entry) => entry.periodIndex === periodIndex
    );
    if (!timing || periodHeaderTimes[periodIndex]) return null;
    return (
      <span className="pointer-events-none absolute end-1.5 top-1.5 z-20 rounded-md border border-border/60 bg-background/90 px-1.5 text-[9px] leading-4 text-muted-foreground">
        {timing.startTime}–{timing.endTime}
      </span>
    );
  };

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
        return lessonsAtSlot.length === 1 ? lessonsAtSlot[0] : null;
      }
    },
    [classId, lessonMap, lessonsBySlot]
  );

  const getLessonsAtSlot = useCallback(
    (day: DayOfWeek, period: number): EnrichedLesson[] => {
      if (classId) {
        const key = `${classId}-${day}-${period}`;
        const lesson = lessonMap.get(key);
        return lesson ? [lesson] : [];
      }

      return lessonsBySlot.get(`${day}-${period}`) || [];
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

  const getSwapSlotBadge = useCallback(
    (day: DayOfWeek, period: number) => {
      if (!selectedLesson) {
        return null;
      }

      if (isSourceSlot(day, period)) {
        return {
          className: 'bg-primary text-primary-foreground shadow-sm',
          label: t('swap.feedback.sourceLabel', 'مبدا'),
          positionClass: 'top-2 start-2',
        };
      }

      if (!pendingTargetSlot || pendingTargetSlot.day !== day || pendingTargetSlot.period !== period) {
        return null;
      }

      if (isExplicitSwapValidationPending) {
        return {
          className: 'bg-sky-600 text-white shadow-sm',
          label: t('swap.status.checking', 'در حال بررسی'),
          positionClass: 'bottom-2 start-2',
        };
      }

      if (lastResolvedStatus === 'blocked') {
        return {
          className: 'bg-rose-600 text-white shadow-sm',
          label: t('swap.status.blocked', 'مسدود'),
          positionClass: 'bottom-2 start-2',
        };
      }

      if (lastResolvedStatus === 'warning') {
        return {
          className: 'bg-amber-500 text-white shadow-sm',
          label: t('swap.status.warning', 'هشدار'),
          positionClass: 'bottom-2 start-2',
        };
      }

      return {
        className: 'bg-emerald-600 text-white shadow-sm',
        label: t('swap.feedback.targetLabel', 'مقصد'),
        positionClass: 'bottom-2 start-2',
      };
    },
    [isExplicitSwapValidationPending, isSourceSlot, lastResolvedStatus, pendingTargetSlot, selectedLesson, t]
  );

  // Phase 3: Use periods from configuration hook
  // Issue #6: Single source of truth
  const periodsMap = periodsConfig.periodsMap;
  const maxPeriods = periodsConfig.maxPeriods;

  // Handle cell click
  const handleCellClick = useCallback(
    (day: DayOfWeek, period: number, lesson: ScheduledLesson | null) => {
      if (isReadOnly) return;
      onCellClick?.(day, period, lesson);
      handleCellAction(day, period, lesson);
    },
    [handleCellAction, isReadOnly, onCellClick]
  );

  const handleGridCellAction = useCallback(
    (day: DayOfWeek, period: number, slotLessons: ScheduledLesson[]) => {
      if (isReadOnly) {
        return;
      }

      if (slotLessons.length > 1) {
        if (selectedLesson && !isSourceSlot(day, period)) {
          void handleSwapAttempt({ day, period });
          return;
        }

        openSourceLessonPicker(day, period, slotLessons);
        return;
      }

      handleCellClick(day, period, slotLessons[0] ?? null);
    },
    [
      handleCellClick,
      handleSwapAttempt,
      isReadOnly,
      isSourceSlot,
      openSourceLessonPicker,
      selectedLesson,
    ]
  );

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

  // Preserve enough space for names while allowing the grid to scroll on smaller screens.
  const getResponsiveCellWidth = () => {
    if (maxPeriods >= 8) return '96px';
    if (maxPeriods >= 7) return '108px';
    if (maxPeriods >= 6) return '118px';
    return '128px';
  };

  const minCellWidth = getResponsiveCellWidth();

  // Render the grid content (shared between read-only and editable modes)
  const renderGridContent = () => (
    <div
      className={cn(
        'grid min-w-fit gap-1.5 rounded-xl border border-border/60 bg-card p-2 shadow-sm',
        cellSizeConfig.className
      )}
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
          'sticky top-0 z-20 rounded-lg border border-border/50 bg-muted/50',
          'sticky inset-inline-start-0 z-30'
        )}
      />
      {Array.from({ length: maxPeriods }, (_, i) => (
        <div
          key={`header-${i}`}
          className={cn(
            'sticky top-0 z-10 rounded-lg border border-border/50 bg-muted/50',
            'flex min-h-12 flex-col items-center justify-center px-2 py-1.5 text-sm font-semibold text-foreground/75'
          )}
        >
          {t('common.periodNumber', { number: i + 1 })}
          {periodHeaderTimes[i] ? (
            <span className="mt-0.5 text-[10px] font-normal tabular-nums text-muted-foreground">
              {periodHeaderTimes[i]?.startTime}–{periodHeaderTimes[i]?.endTime}
            </span>
          ) : null}
        </div>
      ))}

      {/* Day rows */}
      {days.map((day) => {
        const dayPeriods = periodsMap.get(day) || maxPeriods;
        const dayBreaks = metadata?.periodConfiguration?.breakIntervalsByDay?.[day] ?? [];
        const breakDetails = dayBreaks
          .map((interval) => {
            const label =
              interval.kind === 'prayer'
                ? interval.name || t('periodStructure.sections.prayerBreaks')
                : t('periodStructure.labels.break');
            return `${label} ${interval.startTime}–${interval.endTime}`;
          })
          .join('\n');

        return (
          <div key={day} className="contents" role="row">
            {/* Day name cell (sticky) */}
            <div
              className={cn(
                'sticky inset-inline-start-0 z-10 min-w-[92px] rounded-lg border border-border/50 bg-muted/50',
                'flex flex-col items-center justify-center px-2 py-2 text-sm font-semibold'
              )}
              role="rowheader"
            >
              <span>{t(`days.${day}`)}</span>
              {dayBreaks.length > 0 && (
                <span
                  className="mt-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
                  title={breakDetails}
                >
                  {dayBreaks.length} {t('periodStructure.labels.break', 'وقفه')}
                </span>
              )}
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
                    className="flex items-center justify-center rounded-xl border border-dashed border-border/40 bg-muted/10 text-base text-muted-foreground/25"
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
                    <div key={cellId} className="relative">
                      {renderSlotTime(day, periodIndex)}
                      <MultiLessonCell
                        lessons={lessonsAtSlot}
                        day={day}
                        period={periodIndex}
                        displaySettings={displaySettings}
                        viewScope={viewScope}
                        isReadOnly={isReadOnly}
                        isSelected={isSourceSlot(day, periodIndex)}
                      />
                    </div>
                  );
                }

                return (
                  <div key={cellId} className="relative">
                    {renderSlotTime(day, periodIndex)}
                    <ScheduleCell
                      lesson={lesson}
                      displaySettings={displaySettings}
                      viewScope={viewScope}
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
              const swapSlotBadge = getSwapSlotBadge(day, periodIndex);

              // Phase 3: Issue #1 - Use MultiLessonCell for multiple lessons in editable mode
              if (!classId && lessonsAtSlot.length > 1) {
                return (
                  <div key={cellId} className="relative">
                    {renderSlotTime(day, periodIndex)}
                    <DroppableCell
                      id={cellId}
                      day={day}
                      period={periodIndex}
                      viewScope={viewScope}
                      viewId={effectiveViewId}
                      disabled={isOutOfRange}
                    >
                      <div
                        className="relative"
                        onMouseEnter={() => handleCellHover(day, periodIndex)}
                        onMouseLeave={handleCellHoverLeave}
                      >
                        <MultiLessonCell
                          lessons={lessonsAtSlot}
                          day={day}
                          period={periodIndex}
                          displaySettings={displaySettings}
                          viewScope={viewScope}
                          isReadOnly={false}
                          isFocused={isSlotFocused(day, periodIndex)}
                          isSelected={isSourceSlot(day, periodIndex)}
                          validationStatus={validationStatus}
                          onClick={() => {
                            handleGridCellAction(day, periodIndex, lessonsAtSlot);
                          }}
                        />
                      </div>
                    </DroppableCell>

                    {/* Phase 7: SwapPreview at target position */}
                    {showSwapPreviewAtTarget && selectedLesson && (
                      <SwapPreview
                        sourceLesson={selectedLesson}
                        targetLesson={null}
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

                    {swapSlotBadge ? (
                      <span
                        className={cn(
                          'pointer-events-none absolute z-30 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          swapSlotBadge.positionClass,
                          swapSlotBadge.className
                        )}
                      >
                        {swapSlotBadge.label}
                      </span>
                    ) : null}
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
                  {renderSlotTime(day, periodIndex)}
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
                      disabled={Boolean(lesson?.isFixed) || (isLocked && !isLessonSelected(lesson))}
                      onClick={() => {
                        handleGridCellAction(day, periodIndex, lesson ? [lesson] : []);
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

                  {swapSlotBadge ? (
                    <span
                      className={cn(
                        'pointer-events-none absolute z-30 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                        swapSlotBadge.positionClass,
                        swapSlotBadge.className
                      )}
                    >
                      {swapSlotBadge.label}
                    </span>
                  ) : null}
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
      <div className="space-y-3">
        {swapStatus ? (
          <div className="sticky top-2 z-30 space-y-2" aria-live="polite">
            <div
              className={cn(
                'rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/90',
                swapStatus.className
              )}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/85 text-current shadow-sm">
                    {SwapStatusIcon ? (
                      <SwapStatusIcon
                        className={cn('h-4 w-4 shrink-0', swapStatus.iconClassName)}
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold opacity-70">
                      {t('swap.feedback.mode', 'حالت جابه‌جایی')}
                    </p>
                    <p className="truncate text-sm font-semibold">{swapStatus.message}</p>
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-current/10 bg-background/70 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-medium opacity-65">
                      {t('swap.feedback.sourceLabel', 'مبدا')}
                    </span>
                    <p className="truncate text-sm font-semibold text-foreground">
                      {swapStatus.sourceLabel}
                    </p>
                    <p className="truncate text-[11px] opacity-75">{swapStatus.sourceSlotLabel}</p>
                  </div>

                  <ArrowLeftRight className="h-4 w-4 shrink-0 opacity-50" />

                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-medium opacity-65">
                      {t('swap.feedback.targetLabel', 'مقصد')}
                    </span>
                    <p className="truncate text-sm font-semibold text-foreground">
                      {swapStatus.targetSlotLabel ??
                        t('swap.feedback.targetPending', 'یک خانه را انتخاب کنید')}
                    </p>
                    {swapStatus.helper ? (
                      <p className="truncate text-[11px] opacity-75">{swapStatus.helper}</p>
                    ) : null}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 bg-background/70"
                  onClick={handleCancelSwapSelection}
                >
                  <X className="h-4 w-4" />
                  {t('swap.feedback.cancel', 'لغو')}
                </Button>
              </div>
            </div>

            {swapReview ? (
              <div className={cn('rounded-xl border p-3 shadow-sm', swapReview.className)}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="rounded-lg bg-background/80 p-2 shadow-sm">
                      {SwapReviewIcon ? (
                        <SwapReviewIcon className={cn('h-4 w-4', swapReview.iconClassName)} />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{swapReview.title}</h3>
                      <p className="text-xs opacity-80">{swapReview.description}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {reviewStatus === 'warning' ? (
                      <Button size="sm" onClick={handleWarningConfirm}>
                        {t('swap.feedback.continueSwap', 'تأیید جابه‌جایی')}
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={handleChooseAnotherTarget}>
                      {t('swap.feedback.chooseAnotherTarget', 'مقصد دیگر')}
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
                  <div className="grid gap-1.5">
                    {(swapReview.items.length > 0
                      ? swapReview.items
                      : [t('swap.feedback.noDetails', 'جزئیات بیشتری در دسترس نیست.')]
                    ).map(
                      (item, index) => (
                        <div
                          key={`${reviewStatus}-${index}`}
                          className="flex items-start gap-2 rounded-lg bg-background/65 px-3 py-2 text-xs"
                        >
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                          <span>{item}</span>
                        </div>
                      )
                    )}
                  </div>

                  {reviewStatus === 'blocked' && swapReview.alternativeSlots.length > 0 ? (
                    <div className="rounded-lg border border-current/10 bg-background/70 p-2.5">
                      <div className="mb-2 text-xs font-semibold">
                        {t('swap.feedback.alternativeSlots', 'زمان‌های جایگزین پیشنهادی')}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {swapReview.alternativeSlots.slice(0, 4).map((slot) => (
                          <button
                            type="button"
                            key={`${slot.day}-${slot.period}`}
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 transition-colors hover:bg-emerald-100"
                            onClick={() => void handleSwapAttempt(slot)}
                          >
                            {formatSlotLabel(slot.day, slot.period)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="relative">
          <div
            ref={gridRef}
            dir="rtl"
            className={cn(
              'overflow-auto outline-none transition-opacity',
              isExplicitSwapValidationPending && 'pointer-events-none select-none opacity-80'
            )}
            role="grid"
            aria-label={t('schedule.grid.title', 'جدول زمانی')}
            aria-busy={isExplicitSwapValidationPending}
            tabIndex={0}
            onFocus={handleGridFocus}
          >
            {renderGridContent()}
          </div>

          {isExplicitSwapValidationPending ? (
            <div
              className="absolute inset-0 z-20 flex items-start justify-center rounded-lg bg-background/20 backdrop-blur-[1px]"
              aria-hidden="true"
            >
              <div className="mt-4 flex items-center gap-2 rounded-full border border-sky-200 bg-background/95 px-4 py-2 text-sm font-medium text-sky-800 shadow-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {t('swap.feedback.checking', 'در حال بررسی جابه‌جایی...')}
                  {pendingTargetSlot
                    ? ` ${t(`days.${pendingTargetSlot.day}`)} • ${t('common.periodNumber', {
                        number: pendingTargetSlot.period + 1,
                      })}`
                    : ''}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Drag overlay for visual feedback during drag */}
      <DragOverlay>
        {activeDragData?.lesson ? (
          <div className="opacity-80 shadow-lg">
            <ScheduleCell
              lesson={activeDragData.lesson}
              displaySettings={displaySettings}
              viewScope={activeDragData.viewScope}
              isSelected={true}
              isReadOnly={true}
            />
          </div>
        ) : null}
      </DragOverlay>

      <SwapLessonPickerDialog
        open={lessonPickerState !== null}
        mode={lessonPickerState?.mode ?? 'source'}
        day={lessonPickerState?.day ?? DEFAULT_DAYS[0]}
        period={lessonPickerState?.period ?? 0}
        options={lessonPickerState?.options ?? []}
        onOpenChange={handleLessonPickerOpenChange}
        onSelect={handleLessonPickerSelect}
      />
    </DndContext>
  );
}

export default ScheduleGrid;
