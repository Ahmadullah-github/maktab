/**
 * Property-based tests for Teachers serialization utilities
 *
 * Feature: teachers-feature, Property 7: Unavailable slots serialization round-trip
 * Validates: Requirements 4.6
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ClassAssignment, UnavailableSlot } from '../types';
import {
  parseClassAssignments,
  parseJsonArray,
  parseJsonObject,
  parseNumberArray,
  parseUnavailableSlots,
  stringifyArray,
  stringifyClassAssignments,
  stringifyNumberArray,
  stringifyObject,
  stringifyUnavailableSlots,
} from '../utils/serialization';

describe('Serialization Property Tests', () => {
  /**
   * Feature: teachers-feature, Property 7: Unavailable slots serialization round-trip
   * For any array of UnavailableSlot objects, serializing to JSON string and
   * deserializing back SHALL produce an equivalent array.
   * Validates: Requirements 4.6
   */
  describe('Property 7: Unavailable slots serialization round-trip', () => {
    // Generator for UnavailableSlot
    const unavailableSlotArbitrary = fc.record({
      day: fc.integer({ min: 0, max: 6 }),
      period: fc.integer({ min: 0, max: 9 }),
    });

    it('should round-trip unavailable slots correctly', () => {
      fc.assert(
        fc.property(fc.array(unavailableSlotArbitrary), (slots: UnavailableSlot[]) => {
          const serialized = stringifyUnavailableSlots(slots);
          const deserialized = parseUnavailableSlots(serialized);

          expect(deserialized).toEqual(slots);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle empty array', () => {
      const slots: UnavailableSlot[] = [];
      const serialized = stringifyUnavailableSlots(slots);
      const deserialized = parseUnavailableSlots(serialized);

      expect(deserialized).toEqual([]);
    });

    it('should handle null/undefined input gracefully', () => {
      expect(parseUnavailableSlots(null)).toEqual([]);
      expect(parseUnavailableSlots(undefined)).toEqual([]);
      expect(parseUnavailableSlots('')).toEqual([]);
      expect(stringifyUnavailableSlots(null)).toBe('[]');
      expect(stringifyUnavailableSlots(undefined)).toBe('[]');
    });
  });

  describe('Number array serialization round-trip', () => {
    it('should round-trip number arrays correctly', () => {
      fc.assert(
        fc.property(fc.array(fc.integer({ min: 1, max: 1000 })), (numbers: number[]) => {
          const serialized = stringifyNumberArray(numbers);
          const deserialized = parseNumberArray(serialized);

          expect(deserialized).toEqual(numbers);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle empty array', () => {
      const numbers: number[] = [];
      const serialized = stringifyNumberArray(numbers);
      const deserialized = parseNumberArray(serialized);

      expect(deserialized).toEqual([]);
    });
  });

  describe('Class assignments serialization round-trip', () => {
    // Generator for ClassAssignment
    const classAssignmentArbitrary = fc.record({
      subjectId: fc.integer({ min: 1, max: 100 }),
      classIds: fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 0, maxLength: 10 }),
    });

    it('should round-trip class assignments correctly', () => {
      fc.assert(
        fc.property(fc.array(classAssignmentArbitrary), (assignments: ClassAssignment[]) => {
          const serialized = stringifyClassAssignments(assignments);
          const deserialized = parseClassAssignments(serialized);

          expect(deserialized).toEqual(assignments);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Generic array serialization round-trip', () => {
    it('should round-trip string arrays correctly', () => {
      fc.assert(
        fc.property(fc.array(fc.string()), (strings: string[]) => {
          const serialized = stringifyArray(strings);
          const deserialized = parseJsonArray<string>(serialized);

          expect(deserialized).toEqual(strings);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Object serialization round-trip', () => {
    it('should round-trip simple objects correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            key1: fc.string(),
            key2: fc.integer(),
            key3: fc.boolean(),
          }),
          (obj: Record<string, unknown>) => {
            const serialized = stringifyObject(obj);
            const deserialized = parseJsonObject(serialized);

            expect(deserialized).toEqual(obj);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty object', () => {
      const obj = {};
      const serialized = stringifyObject(obj);
      const deserialized = parseJsonObject(serialized);

      expect(deserialized).toEqual({});
    });

    it('should handle null/undefined input gracefully', () => {
      expect(parseJsonObject(null)).toEqual({});
      expect(parseJsonObject(undefined)).toEqual({});
      expect(parseJsonObject('')).toEqual({});
      expect(stringifyObject(null)).toBe('{}');
      expect(stringifyObject(undefined)).toBe('{}');
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed JSON gracefully', () => {
      expect(parseJsonArray('not valid json')).toEqual([]);
      expect(parseJsonObject('not valid json')).toEqual({});
      expect(parseUnavailableSlots('{ broken')).toEqual([]);
      expect(parseNumberArray('[1, 2, ')).toEqual([]);
    });

    it('should handle non-array JSON for array parsers', () => {
      expect(parseJsonArray('{"key": "value"}')).toEqual([]);
      expect(parseNumberArray('"string"')).toEqual([]);
    });

    it('should handle non-object JSON for object parser', () => {
      expect(parseJsonObject('[1, 2, 3]')).toEqual({});
      expect(parseJsonObject('"string"')).toEqual({});
    });
  });
});
