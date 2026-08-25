import { SubjectsPage } from '@/features/subjects';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/subjects')({
  component: SubjectsPage,
});
