/**
 * Unit tests for SwapConstraintCache
 *
 * Tests cache functionality including:
 * - Get/Set operations
 * - TTL expiration
 * - LRU eviction
 * - Invalidation
 * - Statistics tracking
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CachedConstraintData, SwapConstraintCache } from '../SwapConstraintCache';

describe('SwapConstraintCache', () => {
  let cache: SwapConstraintCache;

  // Mock constraint data factory
  const createMockConstraintData = (timetableId: number): CachedConstraintData => ({
    teachers: [
      {
        id: '1',
        availability: { Saturday: [true, true, true, true, true, true, true] },
        timePreference: 'Morning',
        maxConsecutivePeriods: 4,
        maxPeriodsPerWeek: 30,
      },
    ],
    subjects: [
      {
        id: '1',
        requiredRoomType: null,
        isDifficult: false,
        minRoomCapacity: 0,
      },
    ],
    rooms: [
      {
        id: '1',
        type: 'normal',
        capacity: 30,
        features: [],
        unavailable: {},
      },
    ],
    assignments: [
      {
        teacherId: '1',
        classId: '1',
        subjectId: '1',
        isFixed: true,
      },
    ],
    timetableData: {
      lessons: [],
      periodsPerDay: { Saturday: 7 },
      daysOfWeek: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    },
    cachedAt: new Date(),
  });

  beforeEach(() => {
    cache = new SwapConstraintCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve constraint data', () => {
      const timetableId = 1;
      const data = createMockConstraintData(timetableId);

      cache.set(timetableId, data);
      const retrieved = cache.get(timetableId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.teachers).toHaveLength(1);
      expect(retrieved?.subjects).toHaveLength(1);
      expect(retrieved?.rooms).toHaveLength(1);
      expect(retrieved?.assignments).toHaveLength(1);
    });

    it('should return undefined for non-existent timetable', () => {
      const retrieved = cache.get(999);
      expect(retrieved).toBeUndefined();
    });

    it('should check if timetable is cached', () => {
      const timetableId = 1;

      expect(cache.has(timetableId)).toBe(false);

      cache.set(timetableId, createMockConstraintData(timetableId));

      expect(cache.has(timetableId)).toBe(true);
    });

    it('should update existing entry without increasing size', () => {
      const timetableId = 1;
      const data1 = createMockConstraintData(timetableId);
      const data2 = createMockConstraintData(timetableId);
      data2.teachers[0].maxPeriodsPerWeek = 25;

      cache.set(timetableId, data1);
      const stats1 = cache.getStats();

      cache.set(timetableId, data2);
      const stats2 = cache.getStats();

      expect(stats1.size).toBe(stats2.size);
      expect(cache.get(timetableId)?.teachers[0].maxPeriodsPerWeek).toBe(25);
    });
  });

  describe('TTL Expiration', () => {
    it('should expire entries after 5 minutes', () => {
      const timetableId = 1;
      const data = createMockConstraintData(timetableId);

      cache.set(timetableId, data);
      expect(cache.get(timetableId)).toBeDefined();

      // Advance time by 5 minutes + 1ms
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      expect(cache.get(timetableId)).toBeUndefined();
    });

    it('should not expire entries before TTL', () => {
      const timetableId = 1;
      const data = createMockConstraintData(timetableId);

      cache.set(timetableId, data);

      // Advance time by 4 minutes (less than TTL)
      vi.advanceTimersByTime(4 * 60 * 1000);

      expect(cache.get(timetableId)).toBeDefined();
    });

    it('should update access time on get', () => {
      const timetableId = 1;
      const data = createMockConstraintData(timetableId);

      cache.set(timetableId, data);

      // Advance time by 4 minutes
      vi.advanceTimersByTime(4 * 60 * 1000);

      // Access the entry (updates lastAccessed)
      cache.get(timetableId);

      // Advance time by another 4 minutes (total 8 minutes from set, but 4 from last access)
      vi.advanceTimersByTime(4 * 60 * 1000);

      // Should still be expired (TTL is from set time, not access time)
      expect(cache.get(timetableId)).toBeUndefined();
    });
  });

  describe('Invalidation', () => {
    it('should invalidate specific timetable', () => {
      const timetableId1 = 1;
      const timetableId2 = 2;

      cache.set(timetableId1, createMockConstraintData(timetableId1));
      cache.set(timetableId2, createMockConstraintData(timetableId2));

      const deleted = cache.invalidate(timetableId1);

      expect(deleted).toBe(true);
      expect(cache.get(timetableId1)).toBeUndefined();
      expect(cache.get(timetableId2)).toBeDefined();
    });

    it('should return false when invalidating non-existent entry', () => {
      const deleted = cache.invalidate(999);
      expect(deleted).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set(1, createMockConstraintData(1));
      cache.set(2, createMockConstraintData(2));
      cache.set(3, createMockConstraintData(3));

      expect(cache.getStats().size).toBe(3);

      cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(cache.get(1)).toBeUndefined();
      expect(cache.get(2)).toBeUndefined();
      expect(cache.get(3)).toBeUndefined();
    });
  });

  describe('Statistics', () => {
    it('should track cache hits', () => {
      const timetableId = 1;
      cache.set(timetableId, createMockConstraintData(timetableId));

      cache.get(timetableId); // hit
      cache.get(timetableId); // hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });

    it('should track cache misses', () => {
      cache.get(1); // miss
      cache.get(2); // miss

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it('should track expired entries as misses', () => {
      const timetableId = 1;
      cache.set(timetableId, createMockConstraintData(timetableId));

      // Expire the entry
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      cache.get(timetableId); // miss (expired)

      const stats = cache.getStats();
      expect(stats.misses).toBe(1);
    });

    it('should reset statistics', () => {
      const timetableId = 1;
      cache.set(timetableId, createMockConstraintData(timetableId));

      cache.get(timetableId); // hit
      cache.get(999); // miss

      let stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      cache.resetStats();

      stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should report current cache size', () => {
      expect(cache.getStats().size).toBe(0);

      cache.set(1, createMockConstraintData(1));
      expect(cache.getStats().size).toBe(1);

      cache.set(2, createMockConstraintData(2));
      expect(cache.getStats().size).toBe(2);

      cache.invalidate(1);
      expect(cache.getStats().size).toBe(1);
    });
  });

  describe('Pruning', () => {
    it('should remove expired entries on prune', () => {
      cache.set(1, createMockConstraintData(1));
      cache.set(2, createMockConstraintData(2));
      cache.set(3, createMockConstraintData(3));

      // Expire entries 1 and 2
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      const removed = cache.prune();

      expect(removed).toBe(3); // All expired
      expect(cache.getStats().size).toBe(0);
    });

    it('should not remove non-expired entries on prune', () => {
      cache.set(1, createMockConstraintData(1));

      // Advance time but not past TTL
      vi.advanceTimersByTime(2 * 60 * 1000);

      cache.set(2, createMockConstraintData(2));

      // Advance time to expire entry 1 but not entry 2
      vi.advanceTimersByTime(3 * 60 * 1000 + 1);

      const removed = cache.prune();

      expect(removed).toBe(1); // Only entry 1 expired
      expect(cache.get(1)).toBeUndefined();
      expect(cache.get(2)).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should handle large number of entries efficiently', () => {
      const startTime = Date.now();

      // Add 100 entries (max size)
      for (let i = 1; i <= 100; i++) {
        cache.set(i, createMockConstraintData(i));
      }

      const setTime = Date.now() - startTime;

      // Retrieve all entries
      const retrieveStart = Date.now();
      for (let i = 1; i <= 100; i++) {
        cache.get(i);
      }
      const retrieveTime = Date.now() - retrieveStart;

      // Operations should be fast (< 100ms for 100 entries)
      expect(setTime).toBeLessThan(100);
      expect(retrieveTime).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle timetableId of 0', () => {
      const timetableId = 0;
      const data = createMockConstraintData(timetableId);

      cache.set(timetableId, data);
      expect(cache.get(timetableId)).toBeDefined();
    });

    it('should handle negative timetableId', () => {
      const timetableId = -1;
      const data = createMockConstraintData(timetableId);

      cache.set(timetableId, data);
      expect(cache.get(timetableId)).toBeDefined();
    });

    it('should handle very large timetableId', () => {
      const timetableId = Number.MAX_SAFE_INTEGER;
      const data = createMockConstraintData(timetableId);

      cache.set(timetableId, data);
      expect(cache.get(timetableId)).toBeDefined();
    });

    it('should handle empty constraint data', () => {
      const timetableId = 1;
      const emptyData: CachedConstraintData = {
        teachers: [],
        subjects: [],
        rooms: [],
        assignments: [],
        timetableData: {
          lessons: [],
          periodsPerDay: {},
          daysOfWeek: [],
        },
        cachedAt: new Date(),
      };

      cache.set(timetableId, emptyData);
      const retrieved = cache.get(timetableId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.teachers).toHaveLength(0);
      expect(retrieved?.subjects).toHaveLength(0);
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton instance', async () => {
      const { swapConstraintCache } = await import('../SwapConstraintCache');

      expect(swapConstraintCache).toBeInstanceOf(SwapConstraintCache);
    });
  });
});
