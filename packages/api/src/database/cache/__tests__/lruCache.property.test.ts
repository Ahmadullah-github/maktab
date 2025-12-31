/**
 * Property-based tests for LRU Cache
 * 
 * **Feature: backend-refactoring, Property 4: Cache LRU eviction**
 * **Validates: Requirements 7.1, 7.2**
 * 
 * Property 4: Cache LRU eviction
 * *For any* sequence of cache operations that exceeds the maximum cache size M,
 * the cache SHALL contain at most M entries, with the least-recently-accessed
 * entries evicted first.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { LRUCache } from '../lruCache';

describe('LRU Cache Property Tests', () => {
  /**
   * **Feature: backend-refactoring, Property 4: Cache LRU eviction**
   * **Validates: Requirements 7.1, 7.2**
   * 
   * For any sequence of cache operations that exceeds the maximum cache size M,
   * the cache SHALL contain at most M entries.
   */
  it('Property 4: Cache never exceeds max size', () => {
    fc.assert(
      fc.property(
        // Generate max size between 1 and 50
        fc.integer({ min: 1, max: 50 }),
        // Generate array of key-value pairs to insert (more than max size)
        fc.array(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 20 }),
            value: fc.integer(),
          }),
          { minLength: 1, maxLength: 200 }
        ),
        (maxSize, entries) => {
          const cache = new LRUCache<number>({ maxSize, ttlMs: 60000 });

          // Insert all entries
          for (const entry of entries) {
            cache.set(entry.key, entry.value);
          }

          // Cache size should never exceed maxSize
          return cache.size <= maxSize;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 4: Cache LRU eviction**
   * **Validates: Requirements 7.1, 7.2**
   * 
   * For any sequence of cache operations, when eviction occurs, the most recently
   * added/accessed entries are preserved. This test verifies that the last N entries
   * (where N = maxSize) are kept after inserting more than maxSize unique entries.
   */
  it('Property 4: LRU eviction preserves most recent entries', () => {
    fc.assert(
      fc.property(
        // Generate max size between 2 and 20
        fc.integer({ min: 2, max: 20 }),
        // Generate unique keys (more than max size to trigger evictions)
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 5, maxLength: 50 }),
        (maxSize, uniqueKeys) => {
          // Need more keys than maxSize to trigger eviction
          if (uniqueKeys.length <= maxSize) return true;

          const cache = new LRUCache<number>({ maxSize, ttlMs: 60000 });

          // Insert all entries sequentially
          for (let i = 0; i < uniqueKeys.length; i++) {
            cache.set(uniqueKeys[i], i);
          }

          // After all insertions, the cache should contain the last maxSize entries
          // (since we only did set operations, no get operations to change access order)
          const lastKeys = uniqueKeys.slice(-maxSize);
          
          // All of the last maxSize keys should be in the cache
          const allLastKeysPresent = lastKeys.every(key => cache.has(key));
          
          // Cache size should be exactly maxSize
          const sizeCorrect = cache.size === maxSize;

          return allLastKeysPresent && sizeCorrect;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 4: Cache LRU eviction**
   * **Validates: Requirements 7.1, 7.2**
   * 
   * Eviction count should match the number of entries that exceeded max size.
   */
  it('Property 4: Eviction count matches overflow', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 100 }),
        (maxSize, uniqueKeys) => {
          const cache = new LRUCache<number>({ maxSize, ttlMs: 60000 });

          // Insert all unique keys
          for (let i = 0; i < uniqueKeys.length; i++) {
            cache.set(uniqueKeys[i], i);
          }

          const stats = cache.getStats();
          const expectedEvictions = Math.max(0, uniqueKeys.length - maxSize);

          return stats.evictions === expectedEvictions;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 4: Cache LRU eviction**
   * **Validates: Requirements 7.1, 7.2**
   * 
   * Updating an existing key should not trigger eviction.
   */
  it('Property 4: Updating existing key does not trigger eviction', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 50 }),
        fc.array(fc.integer(), { minLength: 1, maxLength: 50 }),
        (maxSize, uniqueKeys, updateValues) => {
          if (uniqueKeys.length === 0) return true;

          const cache = new LRUCache<number>({ maxSize, ttlMs: 60000 });

          // Fill cache to exactly maxSize (or less if not enough keys)
          const keysToUse = uniqueKeys.slice(0, maxSize);
          for (let i = 0; i < keysToUse.length; i++) {
            cache.set(keysToUse[i], i);
          }

          const initialEvictions = cache.getStats().evictions;

          // Update existing keys multiple times
          for (let i = 0; i < updateValues.length; i++) {
            const keyIndex = i % keysToUse.length;
            cache.set(keysToUse[keyIndex], updateValues[i]);
          }

          // No new evictions should have occurred
          return cache.getStats().evictions === initialEvictions;
        }
      ),
      { numRuns: 100 }
    );
  });
});
