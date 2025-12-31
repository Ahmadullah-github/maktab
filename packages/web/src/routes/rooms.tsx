import { RoomsPage } from '@/features/rooms';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/rooms')({
  component: RoomsPage,
});
