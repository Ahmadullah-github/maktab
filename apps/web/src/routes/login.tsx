import { PlatformLoginView } from '@/features/platform/components/PlatformLoginView';
import { requirePlatformRoute } from '@/runtime';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/login')({
  beforeLoad: requirePlatformRoute,
  component: PlatformLoginView,
});
