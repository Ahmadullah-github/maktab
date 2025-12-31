import { ClassScheduleView } from '@/features/schedule/components/views';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/classes-schedule')({
  component: ClassesSchedulePage,
});

function ClassesSchedulePage() {
  return <ClassScheduleView />;
}
