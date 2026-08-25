/**
 * useSchedulePerformance Hook
 *
 * Monitors schedule rendering performance and logs warnings
 * when operations exceed defined thresholds.
 *
 * Phase 4: Developer Tools
 * - Tracks enrichment, indexing, and render times
 * - Logs warnings for slow operations
 * - Only active in development mode by default
 */

import { useEffect, useRef } from 'react';
import { logger } from '../utils/logger';

interface PerformanceMetrics {
  enrichmentTime: number;
  indexBuildTime: number;
  renderTime: number;
  lessonCount: number;
}

interface PerformanceThresholds {
  enrichment: number;
  indexBuild: number;
  render: number;
}

/**
 * Default performance thresholds (in milliseconds)
 */
const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  enrichment: 100, // Enrichment should complete in < 100ms
  indexBuild: 50, // Index building should complete in < 50ms
  render: 200, // Rendering should complete in < 200ms
};

/**
 * Monitors schedule rendering performance
 *
 * @param lessonCount - Number of lessons being rendered
 * @param enabled - Whether monitoring is enabled (default: development mode only)
 * @param thresholds - Custom performance thresholds (optional)
 * @returns Ref to metrics object for updating
 *
 * @example
 * ```typescript
 * const metricsRef = useSchedulePerformance(lessons.length);
 *
 * // Update metrics after enrichment
 * metricsRef.current.enrichmentTime = performance.now() - startTime;
 * ```
 */
export function useSchedulePerformance(
  lessonCount: number,
  enabled: boolean = process.env.NODE_ENV === 'development',
  thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS
) {
  const metricsRef = useRef<PerformanceMetrics>({
    enrichmentTime: 0,
    indexBuildTime: 0,
    renderTime: 0,
    lessonCount,
  });

  // Update lesson count when it changes
  useEffect(() => {
    metricsRef.current.lessonCount = lessonCount;
  }, [lessonCount]);

  // Check metrics and log warnings
  useEffect(() => {
    if (!enabled) return;

    const metrics = metricsRef.current;

    // Check enrichment time
    if (metrics.enrichmentTime > thresholds.enrichment) {
      logger.warn('Slow enrichment detected', {
        time: `${metrics.enrichmentTime.toFixed(2)}ms`,
        lessonCount: metrics.lessonCount,
        threshold: `${thresholds.enrichment}ms`,
        recommendation: 'Consider optimizing enrichment logic or reducing lesson count',
      });
    }

    // Check index building time
    if (metrics.indexBuildTime > thresholds.indexBuild) {
      logger.warn('Slow index building detected', {
        time: `${metrics.indexBuildTime.toFixed(2)}ms`,
        lessonCount: metrics.lessonCount,
        threshold: `${thresholds.indexBuild}ms`,
        recommendation: 'Consider optimizing index structure or using Map instead of Object',
      });
    }

    // Check render time
    if (metrics.renderTime > thresholds.render) {
      logger.warn('Slow rendering detected', {
        time: `${metrics.renderTime.toFixed(2)}ms`,
        lessonCount: metrics.lessonCount,
        threshold: `${thresholds.render}ms`,
        recommendation: 'Consider using React.memo, virtualization, or reducing re-renders',
      });
    }

    // Log summary if any threshold exceeded
    const hasSlowOperation =
      metrics.enrichmentTime > thresholds.enrichment ||
      metrics.indexBuildTime > thresholds.indexBuild ||
      metrics.renderTime > thresholds.render;

    if (hasSlowOperation) {
      logger.info('Performance summary', {
        enrichment: `${metrics.enrichmentTime.toFixed(2)}ms`,
        indexBuild: `${metrics.indexBuildTime.toFixed(2)}ms`,
        render: `${metrics.renderTime.toFixed(2)}ms`,
        total: `${(metrics.enrichmentTime + metrics.indexBuildTime + metrics.renderTime).toFixed(2)}ms`,
        lessonCount: metrics.lessonCount,
      });
    }
  }, [enabled, thresholds, lessonCount]);

  return metricsRef;
}

/**
 * Helper function to measure operation time
 *
 * @example
 * ```typescript
 * const metricsRef = useSchedulePerformance(lessons.length);
 *
 * measureTime(() => {
 *   // Enrichment logic
 *   enrichLessons(lessons);
 * }, (time) => {
 *   metricsRef.current.enrichmentTime = time;
 * });
 * ```
 */
export function measureTime(operation: () => void, callback: (time: number) => void): void {
  const startTime = performance.now();
  operation();
  const endTime = performance.now();
  callback(endTime - startTime);
}

/**
 * Helper function to measure async operation time
 *
 * @example
 * ```typescript
 * const metricsRef = useSchedulePerformance(lessons.length);
 *
 * await measureTimeAsync(async () => {
 *   // Async enrichment logic
 *   await enrichLessonsAsync(lessons);
 * }, (time) => {
 *   metricsRef.current.enrichmentTime = time;
 * });
 * ```
 */
export async function measureTimeAsync(
  operation: () => Promise<void>,
  callback: (time: number) => void
): Promise<void> {
  const startTime = performance.now();
  await operation();
  const endTime = performance.now();
  callback(endTime - startTime);
}
