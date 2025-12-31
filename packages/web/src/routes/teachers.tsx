import { TeachersPage } from '@/features/teachers';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/teachers')({
  component: TeachersPage,
});
