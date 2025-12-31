/**
 * LRU (Least Recently Used) Cache implementation with TTL support
 * @module database/cache/lruCache
 * 
 * Requirements: 7.1, 7.2
 * - Configurable maximum size per entity type
 * - LRU eviction when cache reaches maximum size
 */

import { CacheConfig } from '../../types/common.types';
import { DEFAULT_CACHE_MAX_SIZE, DEFAULT_CACHE_TTL_MS } from '../../constants';

/**
 * Internal cache entry structure
 */
export interface CacheEntry<T> {
  /** The cached value */
  value: T;
  /** Timestamp when the entry expires */
  expiresAt: number;
  /** Timestamp of last access (for LRU tracking) */
  lastAccessed: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Number of entries currently in cache */
  size: number;
  /** Maximum allowed entries */
  maxSize: number;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Number of evictions due to size limit */
  evictions: number;
}

/**
 * LRU Cache with TTL support
 * 
 * Implements a Least Recently Used cache that:
 * - Evicts least recently accessed entries when max size is reached
 * - Automatically expires entries after TTL
 * - Tracks access times for LRU ordering
 */
export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private readonly ttlMs: number;
  
  // Statistics
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  constructor(config?: Partial<CacheConfig>) {
    this.maxSize = config?.maxSize ?? DEFAULT_CACHE_MAX_SIZE;
    this.ttlMs = config?.ttlMs ?? DEFAULT_CACHE_TTL_MS;
    this.cache = new Map();
  }

  /**
   * Get a value from the cache
   * Updates last accessed time on hit
   * @param key - Cache key
   * @returns The cached value or undefined if not found/expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Update last accessed time for LRU tracking
    entry.lastAccessed = Date.now();
    this.hits++;
    
    return entry.value;
  }

  /**
   * Set a value in the cache
   * Evicts LRU entry if cache is at max size
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlMs - Optional custom TTL for this entry
   */
  set(key: string, value: T, ttlMs?: number): void {
    const now = Date.now();
    const effectiveTtl = ttlMs ?? this.ttlMs;

    // If key already exists, update it (doesn't count toward size)
    if (this.cache.has(key)) {
      this.cache.set(key, {
        value,
        expiresAt: now + effectiveTtl,
        lastAccessed: now,
      });
      return;
    }

    // Evict if at max size
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      expiresAt: now + effectiveTtl,
      lastAccessed: now,
    });
  }

  /**
   * Delete a specific entry from the cache
   * @param key - Cache key to delete
   * @returns true if entry was deleted, false if not found
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Check if a key exists in the cache (without updating access time)
   * @param key - Cache key
   * @returns true if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Get the current number of entries in the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    };
  }

  /**
   * Reset statistics counters
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get all keys in the cache (for debugging/testing)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Remove expired entries from the cache
   * @returns Number of entries removed
   */
  prune(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    return removed;
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.cache.delete(oldestKey);
      this.evictions++;
    }
  }
}
