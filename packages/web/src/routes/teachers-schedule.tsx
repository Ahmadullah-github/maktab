import { ScheduleRouteState } from '@/features/schedule/components/views/ScheduleRouteState';
import { TeacherScheduleView } from '@/features/schedule/components/views/TeacherScheduleView';
import {
  parseScheduleSearch,
  useScheduleRouteLoader,
} from '@/features/schedule/hooks/useScheduleRouteLoader';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

export const Route = createFileRoute('/teachers-schedule')({
  component: TeachersSchedulePage,
  validateSearch: parseScheduleSearch,
});

function TeachersSchedulePage() {
  const { scheduleId } = Route.useSearch();
  const navigate = useNavigate();
  const navigateToSchedule = useCallback(
    (selectedScheduleId: number) =>
      navigate({
        to: '/teachers-schedule',
        search: { scheduleId: selectedScheduleId },
        replace: true,
      }),
    [navigate]
  );
  const state = useScheduleRouteLoader({
    scheduleId,
    navigateToSchedule,
    logScope: 'TeachersSchedulePage',
  });

  return (
    <ScheduleRouteState {...state}>
      <TeacherScheduleView />
    </ScheduleRouteState>
  );
}
