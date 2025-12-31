import { PlaceholderPage } from '@/components/shared';
import { createFileRoute } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';

export const Route = createFileRoute('/logout')({
  component: LogoutPage,
});

function LogoutPage() {
  return <PlaceholderPage titleKey="sidebar.logout" icon={LogOut} />;
}
