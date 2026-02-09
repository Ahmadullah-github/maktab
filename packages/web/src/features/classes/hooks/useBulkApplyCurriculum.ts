/**
 * useBulkApplyCurriculum Hook
 *
 * Phase 3.2: Bulk Apply Curriculum Hook
 *
 * Provides mutation for bulk applying curriculum to multiple classes.
 * Supports applying to specific classes or all classes without requirements.
 *
 * Features:
 * - Apply curriculum to selected classes
 * - Apply to all classes without requirements (empty classIds array)
 * - Optional overwrite mode for existing requirements
 * - Success/error toast notifications
 * - Automatic cache invalidation
 */

import { invalidateClassCaches } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { classesApi } from '../api';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of bulk curriculum application
 */
export interface BulkApplyCurriculumResult {
  /** Number of classes successfully updated */
  updated: number;
  /** Number of classes skipped (no grade, already has requirements, etc.) */
  skipped: number;
  /** Number of classes that failed to update */
  failed: number;
  /** Detailed results for each class */
  details: Array<{
    classId: number;
    className: string;
    status: 'updated' | 'skipped' | 'failed';
    reason?: string;
  }>;
}

/**
 * Options for bulk curriculum application
 */
export interface BulkApplyCurriculumOptions {
  /** Array of class IDs to apply curriculum to. Empty array = apply to all without requirements */
  classIds: number[];
  /** If true, overwrite existing requirements. Default: false */
  overwrite?: boolean;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for bulk applying curriculum to multiple classes
 *
 * @example
 * ```tsx
 * const { mutate, isPending } = useBulkApplyCurriculum();
 *
 * // Apply to specific classes
 * mutate({ classIds: [1, 2, 3], overwrite: false });
 *
 * // Apply to all classes without requirements
 * mutate({ classIds: [], overwrite: false });
 * ```
 */
export function useBulkApplyCurriculum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ classIds, overwrite = false }: BulkApplyCurriculumOptions) => {
      return classesApi.bulkApplyCurriculum(classIds, overwrite);
    },
    onSuccess: (result) => {
      // Invalidate class-related caches to refresh data across features
      invalidateClassCaches(queryClient);

      // Show success toast with summary
      if (result.updated > 0) {
        toast.success('برنامه درسی اعمال شد', {
          description: `${result.updated} صنف بروزرسانی شد${result.skipped > 0 ? `، ${result.skipped} صنف رد شد` : ''}`,
        });
      } else if (result.skipped > 0) {
        toast.info('هیچ صنفی بروزرسانی نشد', {
          description: `${result.skipped} صنف رد شد (بدون صنف تحصیلی یا دارای برنامه)`,
        });
      }

      if (result.failed > 0) {
        toast.warning('برخی صنف‌ها بروزرسانی نشدند', {
          description: `${result.failed} صنف با خطا مواجه شد`,
        });
      }
    },
    onError: (error: Error) => {
      toast.error('خطا در اعمال برنامه درسی', {
        description: error.message,
      });
    },
  });
}

export default useBulkApplyCurriculum;
