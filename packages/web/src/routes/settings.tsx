import { PlaceholderPage } from '@/components/shared';
import { createFileRoute } from '@tanstack/react-router';
import { Settings } from 'lucide-react';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  return <PlaceholderPage titleKey="sidebar.settings" icon={Settings} />;
}
