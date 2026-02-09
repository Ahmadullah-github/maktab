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

import { LRUCache } from '../database/cache/lruCache';

/**
 * Teacher constraint data for swap validation
 */
export interface TeacherConstraintData {
  id: string;
  availability: Record<string, boolean[]>; // day -> period availability
  timePreference: 'Morning' | 'Afternoon' | 'None';
  maxConsecutivePeriods: number;
  maxPeriodsPerWeek: number;
}

/**
 * Subject constraint data for swap validation
 */
export interface SubjectConstraintData {
  id: string;
  requiredRoomType: string | null;
  isDifficult: boolean;
  minRoomCapacity: number;
}

/**
 * Room constraint data for swap validation
 */
export interface RoomConstraintData {
  id: string;
  type: string;
  capacity: number;
  features: string[];
  unavailable: Record<string, boolean[]>; // day -> period unavailability
}

/**
 * Assignment constraint data for swap validation
 */
export interface AssignmentConstraintData {
  teacherId: string;
  classId: string;
  subjectId: string;
  isFixed: boolean;
}

/**
 * Timetable data for swap validation
 */
export interface TimetableData {
  lessons: any[]; // Parsed from timetable.data JSON
  periodsPerDay: Record<string, number>;
  daysOfWeek: string[];
}

/**
 * Complete cached constraint data for a timetable
 */
export interface CachedConstraintData {
  teachers: TeacherConstraintData[];
  subjects: SubjectConstraintData[];
  rooms: RoomConstraintData[];
  assignments: AssignmentConstraintData[];
  timetableData: TimetableData;
  cachedAt: Date;
}

/**
 * SwapConstraintCache - Manages caching of constraint data
 *
 * Features:
 * - 5-minute TTL for constraint data
 * - LRU eviction when cache reaches 100 timetables
 * - Manual invalidation support
 * - Statistics tracking (hits, misses, evictions)
 */
export class SwapConstraintCache {
  private cache: LRUCache<CachedConstraintData>;

  /**
   * Creates a new SwapConstraintCache instance
   *
   * Configuration:
   * - maxSize: 100 timetables (sufficient for typical school)
   * - ttlMs: 5 minutes (300,000 ms)
   */
  constructor() {
    this.cache = new LRUCache<CachedConstraintData>({
      maxSize: 100, // Cache up to 100 timetables
      ttlMs: 5 * 60 * 1000, // 5 minutes
    });
  }

  /**
   * Get cached constraint data for a timetable
   *
   * @param timetableId - Timetable ID
   * @returns Cached constraint data or undefined if not found/expired
   */
  get(timetableId: number): CachedConstraintData | undefined {
    const key = this.buildKey(timetableId);
    return this.cache.get(key);
  }

  /**
   * Store constraint data in cache
   *
   * @param timetableId - Timetable ID
   * @param data - Constraint data to cache
   */
  set(timetableId: number, data: CachedConstraintData): void {
    const key = this.buildKey(timetableId);
    this.cache.set(key, data);
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
    const key = this.buildKey(timetableId);
    return this.cache.delete(key);
  }

  /**
   * Clear all cached constraint data
   *
   * Use when global data changes (e.g., teacher/subject/room updates)
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Check if constraint data is cached for a timetable
   *
   * @param timetableId - Timetable ID
   * @returns true if cached and not expired
   */
  has(timetableId: number): boolean {
    const key = this.buildKey(timetableId);
    return this.cache.has(key);
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics (size, hits, misses, evictions)
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Reset cache statistics counters
   */
  resetStats(): void {
    this.cache.resetStats();
  }

  /**
   * Remove expired entries from cache
   *
   * @returns Number of entries removed
   */
  prune(): number {
    return this.cache.prune();
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

/**
 * Singleton instance of SwapConstraintCache
 *
 * Use this instance throughout the application for consistent caching
 */
export const swapConstraintCache = new SwapConstraintCache();
