import { TeacherScheduleView } from '@/features/schedule/components/views';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/teachers-schedule')({
  component: TeachersSchedulePage,
});

function TeachersSchedulePage() {
  return <TeacherScheduleView />;
}
