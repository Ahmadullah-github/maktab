import { TeachersPage } from '@/features/teachers';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const teachersSearchSchema = z.object({
  selected: z.number().optional(),
});

export const Route = createFileRoute('/teachers')({
  validateSearch: teachersSearchSchema,
  component: TeachersRouteComponent,
});

function TeachersRouteComponent() {
  const { selected } = Route.useSearch();
  return <TeachersPage initialSelectedId={selected} />;
}
