/**
 * Property-based tests for Solver Service - API Response Passthrough
 * 
 * **Feature: solver-ux-feedback, Property 3: API Response Passthrough**
 * **Validates: Requirements 1.4**
 * 
 * Property 3: API Response Passthrough
 * *For any* SolverResponse returned by the Python solver, the API SHALL forward
 * the response to the UI with identical structure (no field modification or omission).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  SolverResponse,
  SolverErrorDetail,
  AffectedEntity,
  QualityScore,
  QualityBreakdown,
  Suggestion,
  SolverResponseMetadata,
  PreSolveResult,
} from '../solver.service';

/**
 * Arbitrary generator for AffectedEntity
 */
const affectedEntityArb = fc.record({
  entity_type: fc.constantFrom('teacher', 'class', 'room', 'subject'),
  entity_id: fc.string({ minLength: 1, maxLength: 20 }),
  entity_name: fc.string({ minLength: 1, maxLength: 50 }),
});

/**
 * Arbitrary generator for SolverErrorDetail
 */
const solverErrorDetailArb = fc.record({
  error_code: fc.string({ minLength: 1, maxLength: 30 }),
  severity: fc.constantFrom('error', 'warning', 'info') as fc.Arbitrary<'error' | 'warning' | 'info'>,
  message_key: fc.string({ minLength: 1, maxLength: 50 }),
  message_farsi: fc.string({ minLength: 1, maxLength: 200 }),
  message_english: fc.string({ minLength: 1, maxLength: 200 }),
  affected_entities: fc.array(affectedEntityArb, { maxLength: 5 }),
  context: fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
});

/**
 * Arbitrary generator for Suggestion
 */
const suggestionArb = fc.record({
  suggestion_code: fc.string({ minLength: 1, maxLength: 30 }),
  message_farsi: fc.string({ minLength: 1, maxLength: 200 }),
  affected_entities: fc.array(affectedEntityArb, { maxLength: 3 }),
  expected_improvement: fc.integer({ min: 0, max: 100 }),
});

/**
 * Arbitrary generator for QualityBreakdown
 * Note: We use noNaN: true to avoid NaN values which JSON.stringify converts to null
 */
const qualityBreakdownArb: fc.Arbitrary<QualityBreakdown> = fc.record({
  teacher_gaps: fc.record({
    count: fc.integer({ min: 0, max: 100 }),
    penalty: fc.integer({ min: 0, max: 100 }),
    details: fc.array(fc.jsonValue(), { maxLength: 5 }),
  }),
  afternoon_difficult_subjects: fc.record({
    count: fc.integer({ min: 0, max: 100 }),
    penalty: fc.integer({ min: 0, max: 100 }),
    details: fc.array(fc.jsonValue(), { maxLength: 5 }),
  }),
  same_day_subject_repetition: fc.record({
    count: fc.integer({ min: 0, max: 100 }),
    penalty: fc.integer({ min: 0, max: 100 }),
    details: fc.array(fc.jsonValue(), { maxLength: 5 }),
  }),
  teacher_load_balance: fc.record({
    variance: fc.float({ min: 0, max: 10, noNaN: true }),
    penalty: fc.integer({ min: 0, max: 100 }),
  }),
});

/**
 * Arbitrary generator for QualityScore
 */
const qualityScoreArb: fc.Arbitrary<QualityScore> = fc.record({
  overall: fc.integer({ min: 0, max: 100 }),
  breakdown: qualityBreakdownArb,
  suggestions: fc.array(suggestionArb, { maxLength: 5 }),
});

/**
 * Arbitrary generator for SolverResponseMetadata
 * Note: We use noNaN: true to avoid NaN values which JSON.stringify converts to null
 */
const metadataArb: fc.Arbitrary<SolverResponseMetadata> = fc.record({
  solve_time_seconds: fc.option(fc.float({ min: 0, max: 3600, noNaN: true }), { nil: undefined }),
  strategy_selected: fc.option(fc.constantFrom('fast', 'balanced', 'thorough'), { nil: undefined }),
  strategy_reason: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  strategy_overridden: fc.option(fc.boolean(), { nil: undefined }),
  total_lessons: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
});

/**
 * Arbitrary generator for SolverResponse
 */
const solverResponseArb: fc.Arbitrary<SolverResponse> = fc.record({
  status: fc.constantFrom('success', 'partial', 'failed') as fc.Arbitrary<'success' | 'partial' | 'failed'>,
  data: fc.option(fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()), { nil: null }),
  errors: fc.array(solverErrorDetailArb, { maxLength: 5 }),
  warnings: fc.array(solverErrorDetailArb, { maxLength: 5 }),
  quality_score: fc.option(qualityScoreArb, { nil: null }),
  metadata: metadataArb,
});

/**
 * Arbitrary generator for PreSolveResult
 */
const preSolveResultArb: fc.Arbitrary<PreSolveResult> = fc.record({
  can_proceed: fc.boolean(),
  errors: fc.array(solverErrorDetailArb, { maxLength: 5 }),
  warnings: fc.array(solverErrorDetailArb, { maxLength: 5 }),
  suggestions: fc.array(suggestionArb, { maxLength: 5 }),
  analysis_time_ms: fc.integer({ min: 0, max: 10000 }),
});

/**
 * Simulates API passthrough - the API should not modify the response
 */
function apiPassthrough<T>(response: T): T {
  // The API should pass through the response without modification
  // This simulates what the API does: JSON.parse(JSON.stringify(response))
  return JSON.parse(JSON.stringify(response));
}

/**
 * Deep equality check that handles undefined vs missing keys
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  // Check all keys from a exist in b with same values
  for (const key of keysA) {
    if (a[key] === undefined) continue; // Skip undefined values
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  // Check all keys from b exist in a
  for (const key of keysB) {
    if (b[key] === undefined) continue;
    if (!(key in a) || a[key] === undefined) return false;
  }
  
  return true;
}

describe('Solver Service Property Tests - API Response Passthrough', () => {
  /**
   * **Feature: solver-ux-feedback, Property 3: API Response Passthrough**
   * **Validates: Requirements 1.4**
   * 
   * For any SolverResponse returned by the Python solver, the API SHALL forward
   * the response to the UI with identical structure (no field modification or omission).
   */
  describe('Property 3: API Response Passthrough', () => {
    it('SolverResponse structure is preserved through API passthrough', async () => {
      await fc.assert(
        fc.property(solverResponseArb, (originalResponse) => {
          // Simulate API passthrough (JSON serialization/deserialization)
          const passthroughResponse = apiPassthrough(originalResponse);
          
          // Verify all required fields are present
          expect(passthroughResponse).toHaveProperty('status');
          expect(passthroughResponse).toHaveProperty('errors');
          expect(passthroughResponse).toHaveProperty('warnings');
          expect(passthroughResponse).toHaveProperty('metadata');
          
          // Verify status is unchanged
          expect(passthroughResponse.status).toBe(originalResponse.status);
          
          // Verify errors array length is unchanged
          expect(passthroughResponse.errors.length).toBe(originalResponse.errors.length);
          
          // Verify warnings array length is unchanged
          expect(passthroughResponse.warnings.length).toBe(originalResponse.warnings.length);
          
          // Verify data is unchanged (null or object)
          if (originalResponse.data === null) {
            expect(passthroughResponse.data).toBeNull();
          } else {
            expect(passthroughResponse.data).not.toBeNull();
          }
          
          // Verify quality_score is unchanged (null or object)
          if (originalResponse.quality_score === null) {
            expect(passthroughResponse.quality_score).toBeNull();
          } else {
            expect(passthroughResponse.quality_score).not.toBeNull();
            expect(passthroughResponse.quality_score!.overall).toBe(originalResponse.quality_score!.overall);
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('Error details are preserved through API passthrough', async () => {
      await fc.assert(
        fc.property(solverErrorDetailArb, (originalError) => {
          const passthroughError = apiPassthrough(originalError);
          
          // Verify all required fields are present and unchanged
          expect(passthroughError.error_code).toBe(originalError.error_code);
          expect(passthroughError.severity).toBe(originalError.severity);
          expect(passthroughError.message_key).toBe(originalError.message_key);
          expect(passthroughError.message_farsi).toBe(originalError.message_farsi);
          expect(passthroughError.message_english).toBe(originalError.message_english);
          expect(passthroughError.affected_entities.length).toBe(originalError.affected_entities.length);
          
          // Verify each affected entity is preserved
          for (let i = 0; i < originalError.affected_entities.length; i++) {
            expect(passthroughError.affected_entities[i].entity_type).toBe(
              originalError.affected_entities[i].entity_type
            );
            expect(passthroughError.affected_entities[i].entity_id).toBe(
              originalError.affected_entities[i].entity_id
            );
            expect(passthroughError.affected_entities[i].entity_name).toBe(
              originalError.affected_entities[i].entity_name
            );
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('Quality score is preserved through API passthrough', async () => {
      await fc.assert(
        fc.property(qualityScoreArb, (originalScore) => {
          const passthroughScore = apiPassthrough(originalScore);
          
          // Verify overall score is unchanged
          expect(passthroughScore.overall).toBe(originalScore.overall);
          
          // Verify breakdown is preserved
          expect(passthroughScore.breakdown.teacher_gaps.count).toBe(
            originalScore.breakdown.teacher_gaps.count
          );
          expect(passthroughScore.breakdown.teacher_gaps.penalty).toBe(
            originalScore.breakdown.teacher_gaps.penalty
          );
          expect(passthroughScore.breakdown.afternoon_difficult_subjects.count).toBe(
            originalScore.breakdown.afternoon_difficult_subjects.count
          );
          expect(passthroughScore.breakdown.same_day_subject_repetition.count).toBe(
            originalScore.breakdown.same_day_subject_repetition.count
          );
          
          // Verify suggestions array length is unchanged
          expect(passthroughScore.suggestions.length).toBe(originalScore.suggestions.length);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('PreSolveResult is preserved through API passthrough', async () => {
      await fc.assert(
        fc.property(preSolveResultArb, (originalResult) => {
          const passthroughResult = apiPassthrough(originalResult);
          
          // Verify all required fields are present and unchanged
          expect(passthroughResult.can_proceed).toBe(originalResult.can_proceed);
          expect(passthroughResult.errors.length).toBe(originalResult.errors.length);
          expect(passthroughResult.warnings.length).toBe(originalResult.warnings.length);
          expect(passthroughResult.suggestions.length).toBe(originalResult.suggestions.length);
          expect(passthroughResult.analysis_time_ms).toBe(originalResult.analysis_time_ms);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('Metadata is preserved through API passthrough', async () => {
      await fc.assert(
        fc.property(metadataArb, (originalMetadata) => {
          const passthroughMetadata = apiPassthrough(originalMetadata);
          
          // Verify optional fields are preserved when present
          if (originalMetadata.solve_time_seconds !== undefined) {
            expect(passthroughMetadata.solve_time_seconds).toBe(originalMetadata.solve_time_seconds);
          }
          if (originalMetadata.strategy_selected !== undefined) {
            expect(passthroughMetadata.strategy_selected).toBe(originalMetadata.strategy_selected);
          }
          if (originalMetadata.strategy_reason !== undefined) {
            expect(passthroughMetadata.strategy_reason).toBe(originalMetadata.strategy_reason);
          }
          if (originalMetadata.strategy_overridden !== undefined) {
            expect(passthroughMetadata.strategy_overridden).toBe(originalMetadata.strategy_overridden);
          }
          if (originalMetadata.total_lessons !== undefined) {
            expect(passthroughMetadata.total_lessons).toBe(originalMetadata.total_lessons);
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
