import { PlaceholderPage } from '@/components/shared';
import { createFileRoute } from '@tanstack/react-router';
import { Info } from 'lucide-react';

export const Route = createFileRoute('/about')({
  component: AboutPage,
});

function AboutPage() {
  return <PlaceholderPage titleKey="sidebar.about" icon={Info} />;
}
