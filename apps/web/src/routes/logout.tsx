import { usePlatformSessionStore } from '@/features/platform';
import { requirePlatformRoute } from '@/runtime';
import { createFileRoute } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

export const Route = createFileRoute('/logout')({
  beforeLoad: requirePlatformRoute,
  component: LogoutPage,
});

function LogoutPage() {
  const logout = usePlatformSessionStore((state) => state.logout);

  useEffect(() => {
    void logout().finally(() => {
      window.location.assign('/login');
    });
  }, [logout]);

  return (
    <div className="min-h-full grid place-items-center text-muted-foreground">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Signing out…
      </div>
    </div>
  );
}
