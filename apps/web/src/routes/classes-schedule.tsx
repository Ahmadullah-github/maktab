import { ScheduleRouteState } from '@/features/schedule/components/views/ScheduleRouteState';
import { ClassScheduleView } from '@/features/schedule/components/views/ClassScheduleView';
import {
  parseScheduleSearch,
  useScheduleRouteLoader,
} from '@/features/schedule/hooks/useScheduleRouteLoader';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

export const Route = createFileRoute('/classes-schedule')({
  component: ClassesSchedulePage,
  validateSearch: parseScheduleSearch,
});

function ClassesSchedulePage() {
  const { scheduleId } = Route.useSearch();
  const navigate = useNavigate();
  const navigateToSchedule = useCallback(
    (selectedScheduleId: number) =>
      navigate({
        to: '/classes-schedule',
        search: { scheduleId: selectedScheduleId },
        replace: true,
      }),
    [navigate]
  );
  const state = useScheduleRouteLoader({
    scheduleId,
    navigateToSchedule,
    logScope: 'ClassesSchedulePage',
  });

  return (
    <ScheduleRouteState {...state}>
      <ClassScheduleView />
    </ScheduleRouteState>
  );
}
