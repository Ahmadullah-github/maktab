/**
 * Property-based tests for CacheManager
 * 
 * **Feature: backend-refactoring, Property 5: Cache update granularity**
 * **Validates: Requirements 7.3**
 * 
 * Property 5: Cache update granularity
 * *For any* single entity update, only that entity's cache entry SHALL be modified;
 * other entities' cache entries SHALL remain valid and unchanged.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CacheManager } from '../cacheManager';

describe('CacheManager Property Tests', () => {
  beforeEach(() => {
    // Reset singleton between tests
    CacheManager.resetInstance();
  });

  /**
   * **Feature: backend-refactoring, Property 5: Cache update granularity**
   * **Validates: Requirements 7.3**
   * 
   * For any single entity update, only that entity's cache entry is modified;
   * other entities' cache entries remain valid and unchanged.
   */
  it('Property 5: Single entity update does not affect other entries in same prefix', () => {
    fc.assert(
      fc.property(
        // Generate a prefix name
        fc.string({ minLength: 1, maxLength: 10 }),
        // Generate initial entries (key-value pairs)
        fc.array(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 20 }),
            value: fc.integer(),
          }),
          { minLength: 2, maxLength: 50 }
        ),
        // Generate index of entry to update
        fc.nat(),
        // Generate new value for update
        fc.integer(),
        (prefix, entries, updateIndexRaw, newValue) => {
          // Need at least 2 entries to test isolation
          if (entries.length < 2) return true;

          // Ensure unique keys
          const uniqueEntries = entries.filter(
            (entry, index, self) => self.findIndex(e => e.key === entry.key) === index
          );
          if (uniqueEntries.length < 2) return true;

          const updateIndex = updateIndexRaw % uniqueEntries.length;
          const cacheManager = new CacheManager({ defaultConfig: { maxSize: 1000, ttlMs: 60000 } });

          // Populate cache with initial entries
          for (const entry of uniqueEntries) {
            cacheManager.set(prefix, entry.key, entry.value);
          }

          // Record values of all entries except the one we'll update
          const otherEntries = uniqueEntries.filter((_, i) => i !== updateIndex);
          const beforeUpdate = otherEntries.map(entry => ({
            key: entry.key,
            value: cacheManager.get<number>(prefix, entry.key),
          }));

          // Update single entry
          const entryToUpdate = uniqueEntries[updateIndex];
          cacheManager.set(prefix, entryToUpdate.key, newValue);

          // Verify other entries are unchanged
          const afterUpdate = otherEntries.map(entry => ({
            key: entry.key,
            value: cacheManager.get<number>(prefix, entry.key),
          }));

          // All other entries should have the same values
          return beforeUpdate.every((before, i) => before.value === afterUpdate[i].value);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 5: Cache update granularity**
   * **Validates: Requirements 7.3**
   * 
   * For any single entity update in one prefix, entries in other prefixes
   * remain completely unaffected.
   */
  it('Property 5: Update in one prefix does not affect other prefixes', () => {
    fc.assert(
      fc.property(
        // Generate two different prefixes
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.string({ minLength: 1, maxLength: 10 })
        ).filter(([a, b]) => a !== b),
        // Generate entries for first prefix
        fc.array(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 20 }),
            value: fc.integer(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        // Generate entries for second prefix
        fc.array(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 20 }),
            value: fc.integer(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        // Generate new value for update
        fc.integer(),
        ([prefix1, prefix2], entries1, entries2, newValue) => {
          if (entries1.length === 0 || entries2.length === 0) return true;

          const cacheManager = new CacheManager({ defaultConfig: { maxSize: 1000, ttlMs: 60000 } });

          // Populate both caches
          for (const entry of entries1) {
            cacheManager.set(prefix1, entry.key, entry.value);
          }
          for (const entry of entries2) {
            cacheManager.set(prefix2, entry.key, entry.value);
          }

          // Record all values in prefix2 before update
          const beforeUpdate = entries2.map(entry => ({
            key: entry.key,
            value: cacheManager.get<number>(prefix2, entry.key),
          }));

          // Update an entry in prefix1
          const entryToUpdate = entries1[0];
          cacheManager.set(prefix1, entryToUpdate.key, newValue);

          // Verify all entries in prefix2 are unchanged
          const afterUpdate = entries2.map(entry => ({
            key: entry.key,
            value: cacheManager.get<number>(prefix2, entry.key),
          }));

          return beforeUpdate.every((before, i) => before.value === afterUpdate[i].value);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 5: Cache update granularity**
   * **Validates: Requirements 7.3**
   * 
   * Deleting a single entry does not affect other entries.
   */
  it('Property 5: Single entry deletion does not affect other entries', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.uniqueArray(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 20 }),
            value: fc.integer(),
          }),
          { minLength: 2, maxLength: 50, selector: entry => entry.key }
        ),
        fc.nat(),
        (prefix, entries, deleteIndexRaw) => {
          if (entries.length < 2) return true;

          const deleteIndex = deleteIndexRaw % entries.length;
          const cacheManager = new CacheManager({ defaultConfig: { maxSize: 1000, ttlMs: 60000 } });

          // Populate cache
          for (const entry of entries) {
            cacheManager.set(prefix, entry.key, entry.value);
          }

          // Record values of entries we're NOT deleting
          const otherEntries = entries.filter((_, i) => i !== deleteIndex);
          const beforeDelete = otherEntries.map(entry => ({
            key: entry.key,
            value: cacheManager.get<number>(prefix, entry.key),
          }));

          // Delete single entry
          const entryToDelete = entries[deleteIndex];
          cacheManager.delete(prefix, entryToDelete.key);

          // Verify other entries are unchanged
          const afterDelete = otherEntries.map(entry => ({
            key: entry.key,
            value: cacheManager.get<number>(prefix, entry.key),
          }));

          // Deleted entry should be gone
          const deletedIsGone = !cacheManager.has(prefix, entryToDelete.key);

          // All other entries should have the same values
          const othersUnchanged = beforeDelete.every((before, i) => before.value === afterDelete[i].value);

          return deletedIsGone && othersUnchanged;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 5: Cache update granularity**
   * **Validates: Requirements 7.3**
   * 
   * Invalidating one prefix does not affect other prefixes.
   */
  it('Property 5: Prefix invalidation does not affect other prefixes', () => {
    fc.assert(
      fc.property(
        // Generate two different prefixes
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.string({ minLength: 1, maxLength: 10 })
        ).filter(([a, b]) => a !== b),
        // Generate entries for each prefix
        fc.array(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 20 }),
            value: fc.integer(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        fc.array(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 20 }),
            value: fc.integer(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        ([prefix1, prefix2], entries1, entries2) => {
          if (entries1.length === 0 || entries2.length === 0) return true;

          const cacheManager = new CacheManager({ defaultConfig: { maxSize: 1000, ttlMs: 60000 } });

          // Populate both caches
          for (const entry of entries1) {
            cacheManager.set(prefix1, entry.key, entry.value);
          }
          for (const entry of entries2) {
            cacheManager.set(prefix2, entry.key, entry.value);
          }

          // Record all values in prefix2 before invalidation
          const beforeInvalidate = entries2.map(entry => ({
            key: entry.key,
            value: cacheManager.get<number>(prefix2, entry.key),
          }));

          // Invalidate prefix1
          cacheManager.invalidatePrefix(prefix1);

          // Verify prefix1 is empty
          const prefix1Empty = cacheManager.getSize(prefix1) === 0;

          // Verify all entries in prefix2 are unchanged
          const afterInvalidate = entries2.map(entry => ({
            key: entry.key,
            value: cacheManager.get<number>(prefix2, entry.key),
          }));

          const prefix2Unchanged = beforeInvalidate.every(
            (before, i) => before.value === afterInvalidate[i].value
          );

          return prefix1Empty && prefix2Unchanged;
        }
      ),
      { numRuns: 100 }
    );
  });
});
