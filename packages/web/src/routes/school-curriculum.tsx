import { ErrorBoundary } from '@/components/shared';
import { SchoolCurriculumPage } from '@/features/curriculum/components/SchoolCurriculumPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/school-curriculum')({
  component: () => <ErrorBoundary><SchoolCurriculumPage /></ErrorBoundary>,
});
