import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from '@tanstack/react-router';
import { Cable, Cloud, HardDrive, LogIn, Settings2 } from 'lucide-react';

import { platformModules, type ModuleDelivery } from '../moduleRegistry';
import { usePlatformSessionStore } from '../platformSessionStore';

const deliveryLabels: Record<ModuleDelivery, { label: string; icon: typeof Cloud }> = {
  online: { label: 'Online', icon: Cloud },
  offline: { label: 'Offline', icon: HardDrive },
  hybrid: { label: 'Hybrid', icon: Cable },
};

export function PlatformOverview() {
  const navigate = useNavigate();
  const status = usePlatformSessionStore((state) => state.status);
  const session = usePlatformSessionStore((state) => state.session);
  const activeMembership = usePlatformSessionStore((state) => state.activeMembership);
  const capabilities = usePlatformSessionStore((state) => state.capabilities);
  const selectMembership = usePlatformSessionStore((state) => state.selectMembership);
  const isAuthenticated = status === 'authenticated';
  const allowedModules = new Set(capabilities?.modules.map((module) => module.code) || []);
  const visibleModules = isAuthenticated
    ? platformModules.filter((module) => allowedModules.has(module.code))
    : platformModules;

  return (
    <div className="p-5 md:p-8 space-y-7">
      <section className="rounded-2xl border bg-card/80 p-5 md:p-7 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary">Platform foundation</Badge>
            <h1 className="text-2xl md:text-3xl font-bold">School operations workspace</h1>
            <p className="text-muted-foreground max-w-3xl">
              This is the implementation shell for future modules. Access is calculated from the
              selected school membership, assigned roles, and the school contract.
            </p>
          </div>
          {!isAuthenticated ? (
            <Button onClick={() => navigate({ to: '/login' })}>
              <LogIn className="h-4 w-4" /> Sign in
            </Button>
          ) : (
            <div className="min-w-64 rounded-xl border bg-background/70 p-3">
              <label htmlFor="membership-select" className="text-xs text-muted-foreground">
                Active school
              </label>
              <select
                id="membership-select"
                className="mt-1 w-full bg-transparent text-sm font-medium outline-none"
                value={activeMembership?.id || ''}
                onChange={(event) => void selectMembership(event.target.value)}
              >
                {session?.memberships
                  .filter((membership) => membership.status === 'active')
                  .map((membership) => (
                    <option key={membership.id} value={membership.id}>
                      {membership.tenant_name}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeMembership?.roles.map((role) => role.name).join(' • ') || 'No role assigned'}
              </p>
            </div>
          )}
        </div>
      </section>

      {!isAuthenticated && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-4 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          Preview mode shows the complete product map. After sign-in, only entitled and permitted
          modules are returned by the server and displayed.
        </div>
      )}

      {isAuthenticated && visibleModules.length === 0 && (
        <div className="rounded-xl border bg-muted/40 p-8 text-center">
          <Settings2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 font-semibold">No modules assigned</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            An administrator must assign a role and enable the matching contract modules.
          </p>
        </div>
      )}

      <section aria-label="School platform modules" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleModules.map((module) => {
          const Icon = module.icon;
          const delivery = deliveryLabels[module.delivery];
          const DeliveryIcon = delivery.icon;
          const actions = capabilities?.modules.find((item) => item.code === module.code)?.actions;
          return (
            <article
              key={module.code}
              className="group rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
                  <Icon className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="gap-1">
                  <DeliveryIcon className="h-3 w-3" /> {delivery.label}
                </Badge>
              </div>
              <h2 className="mt-4 font-semibold text-lg">{module.title}</h2>
              <p className="text-sm font-medium text-primary">{module.titleFa}</p>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {module.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {module.hardware && <Badge variant="secondary">{module.hardware}</Badge>}
                {actions?.map((action) => (
                  <Badge key={action} variant="secondary">
                    {action}
                  </Badge>
                ))}
                {!isAuthenticated && <Badge variant="secondary">Contract add-on</Badge>}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
