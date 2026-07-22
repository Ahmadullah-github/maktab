import { RoomsPage } from '@/features/rooms';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const roomsSearchSchema = z.object({ selected: z.number().optional() });

export const Route = createFileRoute('/rooms')({
  validateSearch: roomsSearchSchema,
  component: RoomsRouteComponent,
});

function RoomsRouteComponent() {
  const { selected } = Route.useSearch();
  return <RoomsPage initialSelectedId={selected} />;
}
