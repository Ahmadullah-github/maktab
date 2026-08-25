import { ErrorBoundary } from '@/components/shared';
import { PeriodStructurePage } from '@/features/periods/components/PeriodStructurePage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/periods')({
  component: () => (
    <ErrorBoundary>
      <PeriodStructurePage />
    </ErrorBoundary>
  ),
});
