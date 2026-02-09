import { scheduleApi } from '@/features/schedule/api';
import { ClassScheduleView } from '@/features/schedule/components/views';
import { useScheduleStore } from '@/features/schedule/stores/scheduleStore';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

// Define search params schema
type ClassScheduleSearch = {
  scheduleId?: number;
};

export const Route = createFileRoute('/classes-schedule')({
  component: ClassesSchedulePage,
  validateSearch: (search: Record<string, unknown>): ClassScheduleSearch => {
    return {
      scheduleId: search.scheduleId ? Number(search.scheduleId) : undefined,
    };
  },
});

function ClassesSchedulePage() {
  const { scheduleId } = Route.useSearch();
  const navigate = useNavigate();
  const loadSchedule = useScheduleStore((state) => state.loadSchedule);
  const isLoading = useScheduleStore((state) => state.isLoading);
  const error = useScheduleStore((state) => state.error);
  const currentScheduleId = useScheduleStore((state) => state.scheduleId);
  const [isFetchingLatest, setIsFetchingLatest] = useState(false);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  // If no scheduleId provided, fetch and redirect to latest schedule
  useEffect(() => {
    if (!scheduleId && !isFetchingLatest && !hasAttemptedFetch) {
      console.log('[ClassSchedulePage] No scheduleId, fetching latest');
      setIsFetchingLatest(true);
      setHasAttemptedFetch(true);

      scheduleApi
        .getAll()
        .then((schedules) => {
          if (schedules.length > 0) {
            // Sort by createdAt descending and get the latest
            const latest = schedules.sort((a, b) => {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            })[0];

            console.log('[ClassSchedulePage] Found latest schedule', latest.id);
            // Navigate with the latest schedule ID
            navigate({
              to: '/classes-schedule',
              search: { scheduleId: latest.id },
              replace: true,
            });
          } else {
            console.log('[ClassSchedulePage] No schedules found');
            useScheduleStore.setState({
              isLoading: false,
              error: 'هیچ جدول زمانی ذخیره شده‌ای وجود ندارد',
            });
            setIsFetchingLatest(false);
          }
        })
        .catch((err) => {
          console.error('[ClassSchedulePage] Error fetching schedules', err);
          useScheduleStore.setState({
            isLoading: false,
            error: 'خطا در دریافت لیست جدول‌های زمانی',
          });
          setIsFetchingLatest(false);
        });
    }
  }, [scheduleId, navigate, isFetchingLatest, hasAttemptedFetch]);

  // Load schedule into store when scheduleId changes
  useEffect(() => {
    console.log('[ClassSchedulePage] Effect triggered', {
      scheduleId,
      currentScheduleId,
      shouldLoad: scheduleId && currentScheduleId !== scheduleId,
    });

    if (scheduleId && currentScheduleId !== scheduleId) {
      console.log('[ClassSchedulePage] Loading schedule', scheduleId);

      // Set loading state manually
      useScheduleStore.setState({ isLoading: true, error: null });

      // Fetch and load the schedule
      scheduleApi
        .getById(scheduleId)
        .then((result) => {
          console.log('[ClassSchedulePage] Fetched result', {
            id: result.id,
            lessonsCount: result.normalized.lessons.length,
            metadataClasses: result.normalized.metadata?.classes?.length,
            metadataTeachers: result.normalized.metadata?.teachers?.length,
          });

          // DEBUG: Check if gradeLevel exists in metadata
          console.log(
            '[ClassSchedulePage] First 3 classes from metadata:',
            result.normalized.metadata?.classes?.slice(0, 3).map((c) => ({
              classId: c.classId,
              className: c.className,
              gradeLevel: c.gradeLevel,
              category: c.category,
            }))
          );

          // Pass pre-normalized data directly to store
          loadSchedule(result.id, result.name, result.normalized);
        })
        .catch((err) => {
          console.error('[ClassSchedulePage] Error fetching schedule', err);
          const errorMessage =
            err instanceof Error ? err.message : 'Unknown error loading schedule';
          useScheduleStore.setState({ isLoading: false, error: errorMessage });
        });
    }
  }, [scheduleId, currentScheduleId, loadSchedule]);

  // Debug: Log store state after loading
  useEffect(() => {
    if (currentScheduleId === scheduleId && scheduleId) {
      const storeState = useScheduleStore.getState();
      console.log('[ClassSchedulePage] Store state after load', {
        scheduleId: storeState.scheduleId,
        lessonsCount: storeState.lessons.length,
        classesCount: storeState.classes.size,
        teachersCount: storeState.teachers.size,
        subjectsCount: storeState.subjects.size,
        hasMetadata: !!storeState.metadata,
        metadataClasses: storeState.metadata?.classes?.length,
      });
    }
  }, [currentScheduleId, scheduleId]);

  // Show loading state
  if (isLoading || isFetchingLatest) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <p className="text-destructive mb-2">خطا در بارگذاری جدول زمانی</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return <ClassScheduleView />;
}
