import { PlaceholderPage } from '@/components/shared';
import { denyDesktopOnlyPlaceholder } from '@/runtime';
import { createFileRoute } from '@tanstack/react-router';
import { HelpCircle } from 'lucide-react';

export const Route = createFileRoute('/guidance')({
  beforeLoad: denyDesktopOnlyPlaceholder,
  component: GuidancePage,
});

function GuidancePage() {
  return <PlaceholderPage titleKey="sidebar.guidance" icon={HelpCircle} />;
}
