/**
 * Centralized Cache Manager for managing multiple entity caches
 * @module database/cache/cacheManager
 * 
 * Requirements: 7.4, 7.5
 * - Centralized CacheManager class for consistency
 * - Cache configuration loaded from environment variables or defaults
 */

import { CacheConfig } from '../../types/common.types';
import { DEFAULT_CACHE_MAX_SIZE, DEFAULT_CACHE_TTL_MS } from '../../constants';
import { LRUCache, CacheStats } from './lruCache';

/**
 * Aggregated cache statistics across all prefixes
 */
export interface AggregatedCacheStats {
  /** Total entries across all caches */
  totalSize: number;
  /** Statistics per cache prefix */
  caches: Record<string, CacheStats>;
  /** Total hits across all caches */
  totalHits: number;
  /** Total misses across all caches */
  totalMisses: number;
  /** Total evictions across all caches */
  totalEvictions: number;
}

/**
 * Configuration for individual cache prefixes
 */
export interface CacheManagerConfig {
  /** Default configuration for all caches */
  defaultConfig: CacheConfig;
  /** Per-prefix configuration overrides */
  prefixConfigs?: Record<string, Partial<CacheConfig>>;
}

/**
 * Centralized Cache Manager
 * 
 * Manages multiple LRU caches with per-prefix isolation.
 * Each entity type (teacher, subject, room, etc.) gets its own cache
 * with configurable size and TTL.
 */
export class CacheManager {
  private caches: Map<string, LRUCache<unknown>>;
  private readonly defaultConfig: CacheConfig;
  private readonly prefixConfigs: Record<string, Partial<CacheConfig>>;

  private static instance: CacheManager | null = null;

  constructor(config?: Partial<CacheManagerConfig>) {
    this.defaultConfig = {
      maxSize: config?.defaultConfig?.maxSize ?? DEFAULT_CACHE_MAX_SIZE,
      ttlMs: config?.defaultConfig?.ttlMs ?? DEFAULT_CACHE_TTL_MS,
    };
    this.prefixConfigs = config?.prefixConfigs ?? {};
    this.caches = new Map();
  }

  /**
   * Get singleton instance of CacheManager
   * Configuration is loaded from environment variables on first call
   */
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager({
        defaultConfig: {
          maxSize: parseInt(process.env.CACHE_MAX_SIZE || String(DEFAULT_CACHE_MAX_SIZE), 10),
          ttlMs: parseInt(process.env.CACHE_TTL_MS || String(DEFAULT_CACHE_TTL_MS), 10),
        },
      });
    }
    return CacheManager.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    CacheManager.instance = null;
  }

  /**
   * Get or create a cache for a specific prefix
   * @param prefix - Cache prefix (e.g., 'teacher', 'subject')
   * @returns LRU cache for the prefix
   */
  getCache<T>(prefix: string): LRUCache<T> {
    if (!this.caches.has(prefix)) {
      const prefixConfig = this.prefixConfigs[prefix] ?? {};
      const config: CacheConfig = {
        maxSize: prefixConfig.maxSize ?? this.defaultConfig.maxSize,
        ttlMs: prefixConfig.ttlMs ?? this.defaultConfig.ttlMs,
      };
      this.caches.set(prefix, new LRUCache<T>(config));
    }
    return this.caches.get(prefix) as LRUCache<T>;
  }

  /**
   * Get a value from a specific cache
   * @param prefix - Cache prefix
   * @param key - Cache key
   * @returns Cached value or undefined
   */
  get<T>(prefix: string, key: string): T | undefined {
    const cache = this.getCache<T>(prefix);
    return cache.get(key);
  }

  /**
   * Set a value in a specific cache
   * @param prefix - Cache prefix
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlMs - Optional custom TTL
   */
  set<T>(prefix: string, key: string, value: T, ttlMs?: number): void {
    const cache = this.getCache<T>(prefix);
    cache.set(key, value, ttlMs);
  }

  /**
   * Delete a specific entry from a cache
   * @param prefix - Cache prefix
   * @param key - Cache key
   * @returns true if entry was deleted
   */
  delete(prefix: string, key: string): boolean {
    const cache = this.caches.get(prefix);
    if (!cache) return false;
    return cache.delete(key);
  }

  /**
   * Invalidate all entries for a specific prefix
   * @param prefix - Cache prefix to invalidate
   */
  invalidatePrefix(prefix: string): void {
    const cache = this.caches.get(prefix);
    if (cache) {
      cache.clear();
    }
  }

  /**
   * Clear all caches
   */
  clear(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * Check if a key exists in a specific cache
   * @param prefix - Cache prefix
   * @param key - Cache key
   * @returns true if key exists and is not expired
   */
  has(prefix: string, key: string): boolean {
    const cache = this.caches.get(prefix);
    if (!cache) return false;
    return cache.has(key);
  }

  /**
   * Get aggregated statistics across all caches
   * @returns Aggregated cache statistics
   */
  getStats(): AggregatedCacheStats {
    const cacheStats: Record<string, CacheStats> = {};
    let totalSize = 0;
    let totalHits = 0;
    let totalMisses = 0;
    let totalEvictions = 0;

    for (const [prefix, cache] of this.caches.entries()) {
      const stats = cache.getStats();
      cacheStats[prefix] = stats;
      totalSize += stats.size;
      totalHits += stats.hits;
      totalMisses += stats.misses;
      totalEvictions += stats.evictions;
    }

    return {
      totalSize,
      caches: cacheStats,
      totalHits,
      totalMisses,
      totalEvictions,
    };
  }

  /**
   * Get list of all cache prefixes
   * @returns Array of prefix names
   */
  getPrefixes(): string[] {
    return Array.from(this.caches.keys());
  }

  /**
   * Prune expired entries from all caches
   * @returns Total number of entries removed
   */
  pruneAll(): number {
    let totalRemoved = 0;
    for (const cache of this.caches.values()) {
      totalRemoved += cache.prune();
    }
    return totalRemoved;
  }

  /**
   * Get the size of a specific cache
   * @param prefix - Cache prefix
   * @returns Number of entries in the cache, or 0 if cache doesn't exist
   */
  getSize(prefix: string): number {
    const cache = this.caches.get(prefix);
    return cache?.size ?? 0;
  }
}
