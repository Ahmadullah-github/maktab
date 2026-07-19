import { scheduleApi } from '@/features/schedule/api';
import { useScheduleStore } from '@/features/schedule/stores/scheduleStore';
import {
  findLatestScheduleId,
  getScheduleSelectionPreference,
  resolveScheduleIdForEntry,
  setLatestSchedulePreference,
  setManualSchedulePreference,
} from '@/features/schedule/utils/scheduleSelectionPreference';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScheduleStorage } from '@/features/schedule/utils/scheduleStorage';

export interface UseScheduleRouteLoaderOptions {
  scheduleId?: number;
  navigateToSchedule: (scheduleId: number) => void | Promise<void>;
  logScope: string;
}

export interface UseScheduleRouteLoaderReturn {
  isLoading: boolean;
  error: string | null;
}

export function parseScheduleSearch(search: Record<string, unknown>): { scheduleId?: number } {
  const value = Number(search.scheduleId);
  return Number.isInteger(value) && value > 0 ? { scheduleId: value } : {};
}

/**
 * Resolve a route's selected timetable and load it into the shared schedule store.
 * The schedule list is cached for the route lifetime so entry resolution and
 * preference persistence do not issue duplicate requests.
 */
export function useScheduleRouteLoader({
  scheduleId,
  navigateToSchedule,
  logScope,
}: UseScheduleRouteLoaderOptions): UseScheduleRouteLoaderReturn {
  const loadSchedule = useScheduleStore((state) => state.loadSchedule);
  const offerDraftRecovery = useScheduleStore((state) => state.offerDraftRecovery);
  const storeIsLoading = useScheduleStore((state) => state.isLoading);
  const error = useScheduleStore((state) => state.error);
  const currentScheduleId = useScheduleStore((state) => state.scheduleId);
  const schedulesPromiseRef = useRef<ReturnType<typeof scheduleApi.getAll> | null>(null);
  const [isResolvingEntry, setIsResolvingEntry] = useState(false);

  const getSchedules = useCallback(() => {
    schedulesPromiseRef.current ??= scheduleApi.getAll().catch((requestError) => {
      schedulesPromiseRef.current = null;
      throw requestError;
    });
    return schedulesPromiseRef.current;
  }, []);

  const persistPreference = useCallback(
    async (selectedScheduleId: number) => {
      try {
        const schedules = await getSchedules();
        const latestScheduleId = findLatestScheduleId(schedules);
        if (latestScheduleId === null || selectedScheduleId === latestScheduleId) {
          setLatestSchedulePreference();
        } else {
          setManualSchedulePreference(selectedScheduleId);
        }
      } catch (preferenceError) {
        console.error(`[${logScope}] Failed to persist schedule preference`, preferenceError);
      }
    },
    [getSchedules, logScope]
  );

  useEffect(() => {
    if (scheduleId) {
      setIsResolvingEntry(false);
      return;
    }

    setIsResolvingEntry(true);
    let cancelled = false;

    void getSchedules()
      .then((schedules) => {
        if (cancelled) return;
        const selectedScheduleId = resolveScheduleIdForEntry(
          schedules,
          getScheduleSelectionPreference()
        );

        if (selectedScheduleId === null) {
          useScheduleStore.setState({
            isLoading: false,
            error: 'هیچ جدول زمانی ذخیره شده‌ای وجود ندارد',
          });
          setIsResolvingEntry(false);
          return;
        }

        return navigateToSchedule(selectedScheduleId);
      })
      .catch((requestError) => {
        if (cancelled) return;
        console.error(`[${logScope}] Failed to resolve schedule entry`, requestError);
        useScheduleStore.setState({
          isLoading: false,
          error: 'خطا در دریافت لیست جدول‌های زمانی',
        });
        setIsResolvingEntry(false);
      });

    return () => {
      cancelled = true;
    };
  }, [getSchedules, logScope, navigateToSchedule, scheduleId]);

  useEffect(() => {
    if (!scheduleId || currentScheduleId === scheduleId) return;

    let cancelled = false;
    useScheduleStore.setState({ isLoading: true, error: null });

    void scheduleApi
      .getById(scheduleId)
      .then((result) => {
        if (cancelled) return;
        loadSchedule(result.id, result.name, result.normalized, result.revision);
        const draft = ScheduleStorage.load(result.id);
        if (
          draft &&
          draft.timestamp > new Date(result.updatedAt).getTime() &&
          JSON.stringify(draft.lessons) !== JSON.stringify(result.normalized.lessons)
        ) {
          offerDraftRecovery(draft.lessons);
        }
        void persistPreference(result.id);
      })
      .catch((requestError) => {
        if (cancelled) return;
        console.error(`[${logScope}] Failed to load schedule`, requestError);
        const message =
          requestError instanceof Error
            ? requestError.message
            : 'Unknown error loading schedule';
        useScheduleStore.setState({ isLoading: false, error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [currentScheduleId, loadSchedule, logScope, offerDraftRecovery, persistPreference, scheduleId]);

  return {
    isLoading: storeIsLoading || isResolvingEntry,
    error,
  };
}
