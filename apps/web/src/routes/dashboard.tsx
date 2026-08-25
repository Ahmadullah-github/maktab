import { DashboardView } from '@/features/dashboard';
import { denyDesktopOnlyPlaceholder } from '@/runtime';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: denyDesktopOnlyPlaceholder,
  component: DashboardPage,
});

function DashboardPage() {
  return <DashboardView />;
}
