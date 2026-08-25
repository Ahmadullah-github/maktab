import { ClassesPage } from '@/features/classes';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/classes')({
  component: ClassesPage,
});
