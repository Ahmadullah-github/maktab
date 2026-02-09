import { AssignmentsPage } from '@/features/assignments';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/assignments')({
  component: AssignmentsPage,
});
