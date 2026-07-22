import { ClassesPage } from '@/features/classes';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const classesSearchSchema = z.object({ selected: z.number().optional() });

export const Route = createFileRoute('/classes')({
  validateSearch: classesSearchSchema,
  component: ClassesRouteComponent,
});

function ClassesRouteComponent() {
  const { selected } = Route.useSearch();
  return <ClassesPage initialSelectedId={selected} />;
}
