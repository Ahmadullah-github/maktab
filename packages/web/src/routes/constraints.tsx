import { ConstraintsPage } from '@/features/constraints';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/constraints')({
  component: ConstraintsPage,
});
