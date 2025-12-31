/**
 * Property-based tests for subject requirements serialization
 *
 * **Feature: classes-page, Property 5: Subject Requirements Round-Trip Serialization**
 * **Validates: Requirements 12.1, 12.2, 12.3**
 *
 * Property 5: Subject Requirements Round-Trip Serialization
 * *For any* valid array of SubjectRequirement objects, serializing to JSON string
 * and then deserializing back should produce an equivalent array with the same
 * subjectId, periodsPerWeek, and teacherId values for each element.
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { SubjectRequirement } from '../types';
import {
  deserializeSubjectRequirements,
  serializeSubjectRequirements,
} from '../utils/serialization';

/**
 * Arbitrary generator for SubjectRequirement
 */
const subjectRequirementArb: fc.Arbitrary<SubjectRequirement> = fc.record({
  subjectId: fc.integer({ min: 1, max: 1000 }),
  periodsPerWeek: fc.integer({ min: 1, max: 20 }),
  teacherId: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
});

/**
 * Arbitrary generator for array of SubjectRequirements
 */
const subjectRequirementsArrayArb: fc.Arbitrary<SubjectRequirement[]> = fc.array(
  subjectRequirementArb,
  { minLength: 0, maxLength: 20 }
);

describe('Subject Requirements Serialization Property Tests', () => {
  /**
   * **Feature: classes-page, Property 5: Subject Requirements Round-Trip Serialization**
   * **Validates: Requirements 12.1, 12.2, 12.3**
   *
   * For any valid array of SubjectRequirement objects, serializing and then
   * deserializing should produce an equivalent array
   */
  it('Property 5: Round-trip serialization preserves data', () => {
    fc.assert(
      fc.property(subjectRequirementsArrayArb, (requirements) => {
        const serialized = serializeSubjectRequirements(requirements);
        const deserialized = deserializeSubjectRequirements(serialized);

        // Check length is preserved
        if (deserialized.length !== requirements.length) {
          return false;
        }

        // Check each element is equivalent
        for (let i = 0; i < requirements.length; i++) {
          const original = requirements[i];
          const restored = deserialized[i];

          if (
            original.subjectId !== restored.subjectId ||
            original.periodsPerWeek !== restored.periodsPerWeek ||
            original.teacherId !== restored.teacherId
          ) {
            return false;
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 5: Subject Requirements Round-Trip Serialization**
   * **Validates: Requirements 12.1, 12.2, 12.3**
   *
   * Serialization should produce valid JSON
   */
  it('Property 5: Serialization produces valid JSON', () => {
    fc.assert(
      fc.property(subjectRequirementsArrayArb, (requirements) => {
        const serialized = serializeSubjectRequirements(requirements);

        // Should not throw when parsing
        try {
          JSON.parse(serialized);
          return true;
        } catch {
          return false;
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 5: Subject Requirements Round-Trip Serialization**
   * **Validates: Requirements 12.4**
   *
   * Deserialization should handle empty/null/undefined input gracefully
   */
  it('Property 5: Deserialization handles empty input gracefully', () => {
    expect(deserializeSubjectRequirements('')).toEqual([]);
    expect(deserializeSubjectRequirements(null)).toEqual([]);
    expect(deserializeSubjectRequirements(undefined)).toEqual([]);
  });

  /**
   * **Feature: classes-page, Property 5: Subject Requirements Round-Trip Serialization**
   * **Validates: Requirements 12.4**
   *
   * Deserialization should handle malformed JSON gracefully
   */
  it('Property 5: Deserialization handles malformed JSON gracefully', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => {
          // Filter to strings that are NOT valid JSON arrays
          try {
            const parsed = JSON.parse(s);
            return !Array.isArray(parsed);
          } catch {
            return true; // Invalid JSON is what we want
          }
        }),
        (malformedJson) => {
          // Should not throw, should return empty array
          const result = deserializeSubjectRequirements(malformedJson);
          return Array.isArray(result);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 5: Subject Requirements Round-Trip Serialization**
   * **Validates: Requirements 12.1, 12.2**
   *
   * Empty array should round-trip correctly
   */
  it('Property 5: Empty array round-trips correctly', () => {
    const empty: SubjectRequirement[] = [];
    const serialized = serializeSubjectRequirements(empty);
    const deserialized = deserializeSubjectRequirements(serialized);

    expect(deserialized).toEqual([]);
  });

  /**
   * **Feature: classes-page, Property 5: Subject Requirements Round-Trip Serialization**
   * **Validates: Requirements 12.1, 12.2**
   *
   * Single element array should round-trip correctly
   */
  it('Property 5: Single element round-trips correctly', () => {
    fc.assert(
      fc.property(subjectRequirementArb, (requirement) => {
        const original = [requirement];
        const serialized = serializeSubjectRequirements(original);
        const deserialized = deserializeSubjectRequirements(serialized);

        return (
          deserialized.length === 1 &&
          deserialized[0].subjectId === requirement.subjectId &&
          deserialized[0].periodsPerWeek === requirement.periodsPerWeek &&
          deserialized[0].teacherId === requirement.teacherId
        );
      }),
      { numRuns: 100 }
    );
  });
});
