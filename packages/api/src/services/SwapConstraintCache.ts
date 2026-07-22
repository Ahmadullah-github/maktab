/**
 * SwapConstraintCache - Cache for swap constraint data
 *
 * Caches constraint data gathered from database entities to optimize
 * swap validation performance. Uses LRU eviction with 5-minute TTL.
 *
 * Requirements: Phase 0.1
 * - Cache constraint data with 5-minute TTL
 * - LRU eviction when max size reached
 * - Invalidation method for manual cache clearing
 * - Singleton instance for global access
 */

import {
  CacheManager,
  SWAP_CONSTRAINT_CACHE_PREFIX as SHARED_SWAP_CONSTRAINT_CACHE_PREFIX,
} from '../database/cache/cacheManager';

export const SWAP_CONSTRAINT_CACHE_PREFIX = SHARED_SWAP_CONSTRAINT_CACHE_PREFIX;

/**
 * Teacher constraint data for swap validation
 */
export interface TeacherConstraintData {
  id: string;
  fullName: string;
  unavailable: Array<{ day: string; period: number }>;
  timePreference: 'Morning' | 'Afternoon' | 'None';
  maxPeriodsPerWeek: number;
}

/**
 * Subject constraint data for swap validation
 */
export interface SubjectConstraintData {
  id: string;
  name: string;
  requiredRoomType: string | null;
  isDifficult: boolean;
  minRoomCapacity: number;
  requiredFeatures: string[];
}

/**
 * Room constraint data for swap validation
 */
export interface RoomConstraintData {
  id: string;
  name: string;
  type: string;
  capacity: number;
  features: string[];
  unavailable: Array<{ day: string; period: number }>;
}

/**
 * Timetable data for swap validation
 */
export interface TimetableData {
  lessons: Array<{
    classId: string;
    subjectId: string;
    teacherId: string;
    teacherIds: string[];
    roomId: string | null;
    day: string;
    periodIndex: number;
    duration: number;
    isFixed: boolean;
  }>;
  periodsPerDay: Record<string, number>;
  daysOfWeek: string[];
  revision: number;
  allowConsecutivePeriodsForSameSubject: boolean;
}

/**
 * Complete cached constraint data for a timetable
 */
export interface CachedConstraintData {
  teachers: TeacherConstraintData[];
  subjects: SubjectConstraintData[];
  rooms: RoomConstraintData[];
  classes: Array<{ id: string; studentCount: number; fixedRoomId: string | null }>;
  timetableData: TimetableData;
  cachedAt: Date;
}

/**
 * SwapConstraintCache - Manages caching of constraint data
 *
 * Features:
 * - 5-minute TTL for constraint data
 * - LRU eviction using the shared CacheManager limit
 * - Manual invalidation support
 * - Statistics tracking (hits, misses, evictions)
 */
export class SwapConstraintCache {
  /**
   * Creates a new SwapConstraintCache instance
   *
   * Configuration:
   * - maxSize: inherited from CacheManager configuration
   * - ttlMs: 5 minutes (300,000 ms)
   */
  constructor(private readonly cacheManager: CacheManager) {}

  /**
   * Get cached constraint data for a timetable
   *
   * @param timetableId - Timetable ID
   * @returns Cached constraint data or undefined if not found/expired
   */
  get(timetableId: number): CachedConstraintData | undefined {
    return this.cacheManager.get<CachedConstraintData>(
      SWAP_CONSTRAINT_CACHE_PREFIX,
      this.buildKey(timetableId)
    );
  }

  /**
   * Store constraint data in cache
   *
   * @param timetableId - Timetable ID
   * @param data - Constraint data to cache
   */
  set(timetableId: number, data: CachedConstraintData): void {
    this.cacheManager.set(
      SWAP_CONSTRAINT_CACHE_PREFIX,
      this.buildKey(timetableId),
      data,
      5 * 60 * 1000
    );
  }

  /**
   * Invalidate cached data for a specific timetable
   *
   * Use when timetable or related entities are modified
   *
   * @param timetableId - Timetable ID to invalidate
   * @returns true if entry was deleted, false if not found
   */
  invalidate(timetableId: number): boolean {
    return this.cacheManager.delete(SWAP_CONSTRAINT_CACHE_PREFIX, this.buildKey(timetableId));
  }

  /**
   * Clear all cached constraint data
   *
   * Use when global data changes (e.g., teacher/subject/room updates)
   */
  clear(): void {
    this.cacheManager.invalidatePrefix(SWAP_CONSTRAINT_CACHE_PREFIX);
  }

  /**
   * Check if constraint data is cached for a timetable
   *
   * @param timetableId - Timetable ID
   * @returns true if cached and not expired
   */
  has(timetableId: number): boolean {
    return this.cacheManager.has(SWAP_CONSTRAINT_CACHE_PREFIX, this.buildKey(timetableId));
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics (size, hits, misses, evictions)
   */
  getStats() {
    return this.cacheManager
      .getCache<CachedConstraintData>(SWAP_CONSTRAINT_CACHE_PREFIX)
      .getStats();
  }

  /**
   * Reset cache statistics counters
   */
  resetStats(): void {
    this.cacheManager.getCache<CachedConstraintData>(SWAP_CONSTRAINT_CACHE_PREFIX).resetStats();
  }

  /**
   * Remove expired entries from cache
   *
   * @returns Number of entries removed
   */
  prune(): number {
    return this.cacheManager.getCache<CachedConstraintData>(SWAP_CONSTRAINT_CACHE_PREFIX).prune();
  }

  /**
   * Build cache key for a timetable
   *
   * @param timetableId - Timetable ID
   * @returns Cache key string
   */
  private buildKey(timetableId: number): string {
    return `swap_constraints_${timetableId}`;
  }
}
