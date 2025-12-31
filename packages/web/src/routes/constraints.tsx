import { PlaceholderPage } from '@/components/shared';
import { createFileRoute } from '@tanstack/react-router';
import { SlidersHorizontal } from 'lucide-react';

export const Route = createFileRoute('/constraints')({
  component: ConstraintsPage,
});

function ConstraintsPage() {
  return <PlaceholderPage titleKey="sidebar.constraints" icon={SlidersHorizontal} />;
}
