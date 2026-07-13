import { DataSource } from 'typeorm';

type ScopeKey = object;

const scopedInstances = new Map<ScopeKey, WeakMap<DataSource, unknown>>();

/** Return one instance per DataSource instead of leaking process-global state across apps. */
export function getDataSourceScopedInstance<T>(
  dataSource: DataSource,
  scope: ScopeKey,
  factory: () => T
): T {
  let instances = scopedInstances.get(scope);
  if (!instances) {
    instances = new WeakMap<DataSource, unknown>();
    scopedInstances.set(scope, instances);
  }

  const existing = instances.get(dataSource) as T | undefined;
  if (existing !== undefined) return existing;

  const created = factory();
  instances.set(dataSource, created);
  return created;
}

/** Clear all DataSource-scoped instances for a service/repository, primarily for test isolation. */
export function clearDataSourceScopedInstances(scope: ScopeKey): void {
  scopedInstances.delete(scope);
}
