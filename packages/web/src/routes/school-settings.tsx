import { ErrorBoundary } from '@/components/shared';
import { SchoolSettingsPage } from '@/features/school-settings/components/SchoolSettingsPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/school-settings')({
  component: () => (
    <ErrorBoundary>
      <SchoolSettingsPage />
    </ErrorBoundary>
  ),
});
