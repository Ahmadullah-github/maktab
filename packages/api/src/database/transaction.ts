import { DataSource, EntityManager } from 'typeorm';
import { CacheManager } from './cache/cacheManager';

/**
 * Run a top-level transaction and invalidate cached snapshots only after commit.
 * Repository operations using an EntityManager intentionally bypass the cache.
 */
export async function runCommittedTransaction<T>(
  dataSource: DataSource,
  cacheManager: CacheManager,
  operation: (manager: EntityManager) => Promise<T>
): Promise<T> {
  const result = await dataSource.transaction(operation);
  cacheManager.clear();
  return result;
}
