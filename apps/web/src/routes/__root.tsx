import { MainLayout } from '@/components/layout/MainLayout';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useDirection } from '@/hooks/useDirection';
import { PlatformSessionBootstrap } from '@/features/platform';
import { useRuntime } from '@/runtime';
import { createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  // Initialize direction management
  useDirection();
  const runtime = useRuntime();

  return (
    <TooltipProvider delayDuration={300}>
      {runtime.capabilities.platform && <PlatformSessionBootstrap />}
      <MainLayout />
      <Toaster />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </TooltipProvider>
  );
}
