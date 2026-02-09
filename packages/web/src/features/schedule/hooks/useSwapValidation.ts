/**
 * React hook for swap validation API calls
 *
 * Provides TanStack Query mutation for validating lesson swaps
 * before execution, with proper error handling and loading states.
 *
 * Phase 4: Frontend Swap UI Components
 */

import { useMutation } from '@tanstack/react-query';
import type { DayOfWeek } from '../types';

/**
 * Request payload for swap validation
 */
export interface SwapValidationRequest {
  timetableId: number;
  sourceSlot: {
    classId: string;
    day: DayOfWeek;
    period: number;
  };
  targetSlot: {
    classId: string;
    day: DayOfWeek;
    period: number;
  };
}

/**
 * Constraint violation details
 */
export interface ConstraintViolation {
  type: string;
  severity: 'hard' | 'soft';
  message: string;
  details: Record<string, unknown>;
}

/**
 * Affected lesson in swap operation
 */
export interface AffectedLesson {
  classId: string;
  subjectId: string;
  teacherId: string;
  roomId: string | null;
  fromDay: string;
  fromPeriod: number;
  toDay: string;
  toPeriod: number;
}

/**
 * Response from swap validation endpoint
 */
export interface SwapValidationResponse {
  isValid: boolean;
  canProceedWithWarning: boolean;
  errors: ConstraintViolation[];
  warnings: ConstraintViolation[];
  affectedLessons: AffectedLesson[];
  totalMoves: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

/**
 * Hook for validating swap operations
 *
 * @returns Mutation with validation function and loading states
 */
export function useSwapValidation() {
  return useMutation({
    mutationFn: async (request: SwapValidationRequest): Promise<SwapValidationResponse> => {
      const response = await fetch(`${API_BASE_URL}/swap/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: response.statusText,
        }));
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.result;
    },
    onError: (error) => {
      console.error('Swap validation failed:', error);
    },
  });
}

/**
 * Hook for executing validated swap operations
 *
 * @returns Mutation with execute function and loading states
 */
export function useSwapExecution() {
  return useMutation({
    mutationFn: async (request: SwapValidationRequest): Promise<void> => {
      const response = await fetch(`${API_BASE_URL}/swap/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: response.statusText,
        }));
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }
    },
    onError: (error) => {
      console.error('Swap execution failed:', error);
    },
  });
}
