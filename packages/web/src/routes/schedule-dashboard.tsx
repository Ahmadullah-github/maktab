import { ScheduleDashboard } from '@/features/schedule';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/schedule-dashboard')({
  component: ScheduleDashboardPage,
});

function ScheduleDashboardPage() {
  return <ScheduleDashboard />;
}
