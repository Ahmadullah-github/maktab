import { SubjectsPage } from '@/features/subjects';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const subjectsSearchSchema = z.object({ selected: z.number().optional() });

export const Route = createFileRoute('/subjects')({
  validateSearch: subjectsSearchSchema,
  component: SubjectsRouteComponent,
});

function SubjectsRouteComponent() {
  const { selected } = Route.useSearch();
  return <SubjectsPage initialSelectedId={selected} />;
}
