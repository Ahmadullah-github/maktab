/**
 * useWorkloadImpact Hook
 *
 * Phase 1.3: Workload Impact Calculator
 *
 * Calculates the impact of adding periods to a teacher's workload.
 * Used to preview assignment effects before committing changes.
 *
 * Features:
 * - Current workload calculation
 * - Projected workload after assignment
 * - Status change detection (optimal → near_capacity → overloaded)
 * - Warning messages in Farsi
 * - Capacity validation
 */

import { useMemo } from 'react';
import { useTeachers } from '../../teachers/hooks/useTeachers';
import type { WorkloadStatus } from '../types';
import { useTeacherWorkloadViews } from '../projections';

// ============================================================================
// Types
// ============================================================================

/**
 * Workload impact analysis result
 */
export interface WorkloadImpact {
  /** Teacher ID being analyzed */
  teacherId: number;
  /** Teacher name for display */
  teacherName: string;
  /** Current total periods assigned */
  currentPeriods: number;
  /** Additional periods being added */
  additionalPeriods: number;
  /** Projected total after assignment */
  projectedPeriods: number;
  /** Maximum periods allowed */
  maxPeriods: number;
  /** Current workload status */
  status: WorkloadStatus;
  /** Projected status after assignment */
  projectedStatus: WorkloadStatus;
  /** Whether teacher can accept this assignment */
  canAccept: boolean;
  /** Remaining capacity after assignment (can be negative) */
  remainingCapacity: number;
  /** Utilization percentage after assignment */
  projectedUtilization: number;
  /** Warning message in Farsi (if any) */
  warning?: string;
  /** Warning message in English (if any) */
  warningEn?: string;
  /** Severity of the warning */
  warningSeverity?: 'info' | 'warning' | 'error';
}

/**
 * Options for the workload impact hook
 */
export interface UseWorkloadImpactOptions {
  /** Whether to include detailed breakdown */
  includeBreakdown?: boolean;
}

/**
 * Result of the workload impact hook
 */
export interface UseWorkloadImpactResult {
  /** Workload impact analysis (null if no teacher selected) */
  impact: WorkloadImpact | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

// ============================================================================
// Constants
// ============================================================================

const NEAR_CAPACITY_THRESHOLD = 5;

// ============================================================================
// Helper Functions
// ============================================================================


/**
 * Determine workload status based on periods and max
 */
function determineWorkloadStatus(totalPeriods: number, maxPeriods: number): WorkloadStatus {
  if (maxPeriods <= 0) return 'underloaded';

  const utilizationPercentage = (totalPeriods / maxPeriods) * 100;
  const remainingCapacity = maxPeriods - totalPeriods;

  if (totalPeriods > maxPeriods) return 'overloaded';
  if (remainingCapacity <= NEAR_CAPACITY_THRESHOLD) return 'near_capacity';
  if (utilizationPercentage >= 50) return 'optimal';
  return 'underloaded';
}

/**
 * Get warning message based on projected status
 */
function getWarningMessage(
  projectedStatus: WorkloadStatus,
  currentStatus: WorkloadStatus,
  projectedPeriods: number,
  maxPeriods: number
): { warning?: string; warningEn?: string; severity?: 'info' | 'warning' | 'error' } {
  if (projectedStatus === 'overloaded') {
    const overBy = projectedPeriods - maxPeriods;
    return {
      warning: `این تخصیص باعث تجاوز از حداکثر ساعات می‌شود (${overBy} ساعت اضافی)`,
      warningEn: `This assignment exceeds maximum workload by ${overBy} periods`,
      severity: 'error',
    };
  }

  if (projectedStatus === 'near_capacity') {
    const remaining = maxPeriods - projectedPeriods;
    if (currentStatus !== 'near_capacity') {
      return {
        warning: `معلم به حداکثر ظرفیت نزدیک می‌شود (${remaining} ساعت باقیمانده)`,
        warningEn: `Teacher approaching maximum capacity (${remaining} periods remaining)`,
        severity: 'warning',
      };
    }
    return {
      warning: `ظرفیت محدود: ${remaining} ساعت باقیمانده`,
      warningEn: `Limited capacity: ${remaining} periods remaining`,
      severity: 'info',
    };
  }

  return {};
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for calculating workload impact of an assignment
 *
 * @param teacherId - Teacher ID to analyze (null for no selection)
 * @param additionalPeriods - Number of periods being added
 * @param options - Optional configuration
 * @returns Workload impact analysis
 *
 * @example
 * ```tsx
 * const { impact } = useWorkloadImpact(selectedTeacherId, 4);
 *
 * if (impact && !impact.canAccept) {
 *   toast.error(impact.warning);
 * }
 * ```
 */
export function useWorkloadImpact(
  teacherId: number | null,
  additionalPeriods: number,
  _options: UseWorkloadImpactOptions = {}
): UseWorkloadImpactResult {
  const { data: teachers = [], isLoading: isLoadingTeachers, error: teachersError } = useTeachers();
  const teacherIds = useMemo(() => teachers.map((teacher) => teacher.id), [teachers]);
  const { workloadByTeacherId, isLoading: isLoadingWorkloads, error: workloadsError } =
    useTeacherWorkloadViews(teacherIds);

  const impact = useMemo((): WorkloadImpact | null => {
    if (!teacherId) return null;

    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) return null;

    const workload = workloadByTeacherId.get(teacherId);
    const currentPeriods = workload?.assignedPeriodsPerWeek ?? 0;
    const projectedPeriods = currentPeriods + additionalPeriods;
    const maxPeriods = workload?.effectiveCapacityPerWeek ?? teacher.maxPeriodsPerWeek;

    const status = determineWorkloadStatus(currentPeriods, maxPeriods);
    const projectedStatus = determineWorkloadStatus(projectedPeriods, maxPeriods);

    const remainingCapacity = maxPeriods - projectedPeriods;
    const projectedUtilization = maxPeriods > 0 ? (projectedPeriods / maxPeriods) * 100 : 0;

    const canAccept = projectedPeriods <= maxPeriods;

    const { warning, warningEn, severity } = getWarningMessage(
      projectedStatus,
      status,
      projectedPeriods,
      maxPeriods
    );

    return {
      teacherId,
      teacherName: teacher.fullName,
      currentPeriods,
      additionalPeriods,
      projectedPeriods,
      maxPeriods,
      status,
      projectedStatus,
      canAccept,
      remainingCapacity,
      projectedUtilization,
      warning,
      warningEn,
      warningSeverity: severity,
    };
  }, [teacherId, additionalPeriods, teachers, workloadByTeacherId]);

  return {
    impact,
    isLoading: isLoadingTeachers || isLoadingWorkloads,
    error: teachersError || workloadsError || null,
  };
}

// ============================================================================
// Utility Hook: Bulk Workload Impact
// ============================================================================

/**
 * Bulk workload impact for multiple teachers
 */
export interface BulkWorkloadImpact {
  teacherId: number;
  teacherName: string;
  additionalPeriods: number;
  impact: WorkloadImpact;
}

/**
 * Hook for calculating workload impact for multiple teachers at once
 *
 * @param assignments - Array of { teacherId, additionalPeriods }
 * @returns Array of workload impacts
 *
 * @example
 * ```tsx
 * const impacts = useBulkWorkloadImpact([
 *   { teacherId: 1, additionalPeriods: 4 },
 *   { teacherId: 2, additionalPeriods: 2 },
 * ]);
 * ```
 */
export function useBulkWorkloadImpact(
  assignments: Array<{ teacherId: number; additionalPeriods: number }>
): {
  impacts: BulkWorkloadImpact[];
  hasOverloaded: boolean;
  hasWarnings: boolean;
  isLoading: boolean;
  error: Error | null;
} {
  const { data: teachers = [], isLoading: isLoadingTeachers, error: teachersError } = useTeachers();
  const teacherIds = useMemo(() => teachers.map((teacher) => teacher.id), [teachers]);
  const { workloadByTeacherId, isLoading: isLoadingWorkloads, error: workloadsError } =
    useTeacherWorkloadViews(teacherIds);

  const result = useMemo(() => {
    const impacts: BulkWorkloadImpact[] = [];
    let hasOverloaded = false;
    let hasWarnings = false;

    for (const { teacherId, additionalPeriods } of assignments) {
      const teacher = teachers.find((t) => t.id === teacherId);
      if (!teacher) continue;

      const workload = workloadByTeacherId.get(teacherId);
      const currentPeriods = workload?.assignedPeriodsPerWeek ?? 0;
      const projectedPeriods = currentPeriods + additionalPeriods;
      const maxPeriods = workload?.effectiveCapacityPerWeek ?? teacher.maxPeriodsPerWeek;

      const status = determineWorkloadStatus(currentPeriods, maxPeriods);
      const projectedStatus = determineWorkloadStatus(projectedPeriods, maxPeriods);

      const remainingCapacity = maxPeriods - projectedPeriods;
      const projectedUtilization = maxPeriods > 0 ? (projectedPeriods / maxPeriods) * 100 : 0;

      const canAccept = projectedPeriods <= maxPeriods;

      const { warning, warningEn, severity } = getWarningMessage(
        projectedStatus,
        status,
        projectedPeriods,
        maxPeriods
      );

      if (projectedStatus === 'overloaded') hasOverloaded = true;
      if (severity === 'warning' || severity === 'error') hasWarnings = true;

      impacts.push({
        teacherId,
        teacherName: teacher.fullName,
        additionalPeriods,
        impact: {
          teacherId,
          teacherName: teacher.fullName,
          currentPeriods,
          additionalPeriods,
          projectedPeriods,
          maxPeriods,
          status,
          projectedStatus,
          canAccept,
          remainingCapacity,
          projectedUtilization,
          warning,
          warningEn,
          warningSeverity: severity,
        },
      });
    }

    return { impacts, hasOverloaded, hasWarnings };
  }, [assignments, teachers, workloadByTeacherId]);

  return {
    ...result,
    isLoading: isLoadingTeachers || isLoadingWorkloads,
    error: teachersError || workloadsError || null,
  };
}

export default useWorkloadImpact;
