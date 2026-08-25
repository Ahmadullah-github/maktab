import { PlatformOverview } from '@/features/platform/components/PlatformOverview';
import { requirePlatformRoute } from '@/runtime';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/platform')({
  beforeLoad: requirePlatformRoute,
  component: PlatformOverview,
});
