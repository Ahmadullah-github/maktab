/**
 * Property-based tests for subject serialization utilities
 *
 * **Feature: subjects-feature, Property 1: JSON Serialization Round-Trip**
 * **Validates: Requirements 1.3, 6.5**
 *
 * Property 1: JSON Serialization Round-Trip
 * *For any* valid array of feature strings, serializing to JSON and then
 * deserializing should produce an equivalent array.
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { RoomType, Section, SubjectFormValues, SubjectResponse } from '../types';
import {
  deserializeSubject,
  parseJsonArray,
  parseJsonObject,
  serializeSubjectForApi,
} from '../utils/serialization';

/**
 * Arbitrary generator for valid feature strings (non-empty, no special chars that break JSON)
 */
const featureStringArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

/**
 * Arbitrary generator for array of feature strings
 */
const featureArrayArb: fc.Arbitrary<string[]> = fc.array(featureStringArb, {
  minLength: 0,
  maxLength: 10,
});

/**
 * Arbitrary generator for valid section values
 */
const sectionArb: fc.Arbitrary<Section> = fc.constantFrom('PRIMARY', 'MIDDLE', 'HIGH', '' as const);

/**
 * Arbitrary generator for valid room type values
 */
const roomTypeArb: fc.Arbitrary<RoomType> = fc.constantFrom(
  'normal',
  'computer_lab',
  'biology_lab',
  'chemistry_lab',
  'math_lab',
  'physics_lab',
  'lab',
  'library',
  'salon',
  'gym',
  'sport_camp',
  'other',
  '' as const
);

/**
 * Arbitrary generator for SubjectFormValues
 */
const subjectFormValuesArb: fc.Arbitrary<SubjectFormValues> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  code: fc.string({ minLength: 1, maxLength: 10 }),
  grade: fc.option(fc.integer({ min: 1, max: 12 }), { nil: null }),
  periodsPerWeek: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
  section: sectionArb,
  requiredRoomType: roomTypeArb,
  requiredFeatures: featureArrayArb,
  desiredFeatures: featureArrayArb,
  isDifficult: fc.boolean(),
  minRoomCapacity: fc.integer({ min: 0, max: 500 }),
});

/**
 * Arbitrary generator for valid ISO date strings
 * Uses constant date strings to avoid invalid date issues with fc.date()
 */
const isoDateStringArb: fc.Arbitrary<string> = fc.constantFrom(
  '2020-01-15T10:30:00.000Z',
  '2021-06-20T14:45:30.000Z',
  '2022-12-01T08:00:00.000Z',
  '2023-03-10T16:20:15.000Z',
  '2024-09-25T12:00:00.000Z'
);

/**
 * Arbitrary generator for SubjectResponse (raw API response)
 */
const subjectResponseArb: fc.Arbitrary<SubjectResponse> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  schoolId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  code: fc.string({ minLength: 1, maxLength: 10 }),
  grade: fc.option(fc.integer({ min: 1, max: 12 }), { nil: null }),
  periodsPerWeek: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
  section: fc.constantFrom('PRIMARY', 'MIDDLE', 'HIGH', ''),
  requiredRoomType: fc.constantFrom(
    'normal',
    'computer_lab',
    'biology_lab',
    'chemistry_lab',
    'math_lab',
    'physics_lab',
    'lab',
    'library',
    'salon',
    'gym',
    'sport_camp',
    'other',
    ''
  ),
  requiredFeatures: featureArrayArb.map((arr) => JSON.stringify(arr)),
  desiredFeatures: featureArrayArb.map((arr) => JSON.stringify(arr)),
  isDifficult: fc.boolean(),
  minRoomCapacity: fc.integer({ min: 0, max: 500 }),
  meta: fc.constant('{}'),
  isDeleted: fc.boolean(),
  deletedAt: fc.option(isoDateStringArb, { nil: null }),
  createdAt: isoDateStringArb,
  updatedAt: isoDateStringArb,
});

describe('Subject Serialization Property Tests', () => {
  describe('parseJsonArray', () => {
    /**
     * **Feature: subjects-feature, Property 1: JSON Serialization Round-Trip**
     * **Validates: Requirements 1.3, 6.5**
     *
     * For any valid array of strings, JSON.stringify then parseJsonArray
     * should produce an equivalent array
     */
    it('Property 1: Round-trip preserves string arrays', () => {
      fc.assert(
        fc.property(featureArrayArb, (features) => {
          const serialized = JSON.stringify(features);
          const deserialized = parseJsonArray(serialized);

          // Check length is preserved
          if (deserialized.length !== features.length) {
            return false;
          }

          // Check each element is equivalent
          for (let i = 0; i < features.length; i++) {
            if (features[i] !== deserialized[i]) {
              return false;
            }
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: subjects-feature, Property 1: JSON Serialization Round-Trip**
     * **Validates: Requirements 1.3**
     *
     * parseJsonArray should handle empty/null/undefined input gracefully
     */
    it('Property 1: Handles empty input gracefully', () => {
      expect(parseJsonArray('')).toEqual([]);
      expect(parseJsonArray(null)).toEqual([]);
      expect(parseJsonArray(undefined)).toEqual([]);
      expect(parseJsonArray('[]')).toEqual([]);
    });

    /**
     * **Feature: subjects-feature, Property 1: JSON Serialization Round-Trip**
     * **Validates: Requirements 1.3**
     *
     * parseJsonArray should handle malformed JSON gracefully
     */
    it('Property 1: Handles malformed JSON gracefully', () => {
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
            const result = parseJsonArray(malformedJson);
            return Array.isArray(result);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('parseJsonObject', () => {
    /**
     * **Feature: subjects-feature, Property 1: JSON Serialization Round-Trip**
     * **Validates: Requirements 1.3**
     *
     * For any valid object, JSON.stringify then parseJsonObject
     * should produce an equivalent object
     */
    it('Property 1: Round-trip preserves objects', () => {
      const simpleObjectArb = fc.record({
        key1: fc.string(),
        key2: fc.integer(),
        key3: fc.boolean(),
      });

      fc.assert(
        fc.property(simpleObjectArb, (obj) => {
          const serialized = JSON.stringify(obj);
          const deserialized = parseJsonObject(serialized);

          return (
            deserialized.key1 === obj.key1 &&
            deserialized.key2 === obj.key2 &&
            deserialized.key3 === obj.key3
          );
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: subjects-feature, Property 1: JSON Serialization Round-Trip**
     * **Validates: Requirements 1.3**
     *
     * parseJsonObject should handle empty/null/undefined input gracefully
     */
    it('Property 1: Handles empty input gracefully', () => {
      expect(parseJsonObject('')).toEqual({});
      expect(parseJsonObject(null)).toEqual({});
      expect(parseJsonObject(undefined)).toEqual({});
      expect(parseJsonObject('{}')).toEqual({});
    });
  });

  describe('deserializeSubject', () => {
    /**
     * **Feature: subjects-feature, Property 1: JSON Serialization Round-Trip**
     * **Validates: Requirements 1.3**
     *
     * deserializeSubject should correctly parse JSON string fields
     */
    it('Property 1: Correctly deserializes JSON string fields', () => {
      fc.assert(
        fc.property(subjectResponseArb, (response) => {
          const subject = deserializeSubject(response);

          // Verify arrays are properly parsed
          const expectedRequiredFeatures = JSON.parse(response.requiredFeatures);
          const expectedDesiredFeatures = JSON.parse(response.desiredFeatures);

          return (
            Array.isArray(subject.requiredFeatures) &&
            Array.isArray(subject.desiredFeatures) &&
            typeof subject.meta === 'object' &&
            subject.requiredFeatures.length === expectedRequiredFeatures.length &&
            subject.desiredFeatures.length === expectedDesiredFeatures.length
          );
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: subjects-feature, Property 1: JSON Serialization Round-Trip**
     * **Validates: Requirements 1.3**
     *
     * deserializeSubject should preserve non-JSON fields
     */
    it('Property 1: Preserves non-JSON fields', () => {
      fc.assert(
        fc.property(subjectResponseArb, (response) => {
          const subject = deserializeSubject(response);

          return (
            subject.id === response.id &&
            subject.name === response.name &&
            subject.code === response.code &&
            subject.grade === response.grade &&
            subject.periodsPerWeek === response.periodsPerWeek &&
            subject.isDifficult === response.isDifficult &&
            subject.minRoomCapacity === response.minRoomCapacity &&
            subject.isDeleted === response.isDeleted
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('serializeSubjectForApi', () => {
    /**
     * **Feature: subjects-feature, Property 1: JSON Serialization Round-Trip**
     * **Validates: Requirements 6.5**
     *
     * serializeSubjectForApi should convert arrays to JSON strings
     */
    it('Property 1: Converts arrays to JSON strings', () => {
      fc.assert(
        fc.property(subjectFormValuesArb, (formValues) => {
          const serialized = serializeSubjectForApi(formValues);

          // Verify arrays are serialized to strings
          const requiredFeatures = serialized.requiredFeatures;
          const desiredFeatures = serialized.desiredFeatures;

          if (typeof requiredFeatures !== 'string' || typeof desiredFeatures !== 'string') {
            return false;
          }

          // Verify they are valid JSON
          try {
            const parsedRequired = JSON.parse(requiredFeatures);
            const parsedDesired = JSON.parse(desiredFeatures);

            return (
              Array.isArray(parsedRequired) &&
              Array.isArray(parsedDesired) &&
              parsedRequired.length === formValues.requiredFeatures.length &&
              parsedDesired.length === formValues.desiredFeatures.length
            );
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: subjects-feature, Property 1: JSON Serialization Round-Trip**
     * **Validates: Requirements 6.5**
     *
     * serializeSubjectForApi should preserve simple fields
     */
    it('Property 1: Preserves simple fields', () => {
      fc.assert(
        fc.property(subjectFormValuesArb, (formValues) => {
          const serialized = serializeSubjectForApi(formValues);

          return (
            serialized.name === formValues.name &&
            serialized.code === formValues.code &&
            serialized.grade === formValues.grade &&
            serialized.periodsPerWeek === formValues.periodsPerWeek &&
            serialized.section === formValues.section &&
            serialized.requiredRoomType === formValues.requiredRoomType &&
            serialized.isDifficult === formValues.isDifficult &&
            serialized.minRoomCapacity === formValues.minRoomCapacity
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Full Round-Trip', () => {
    /**
     * **Feature: subjects-feature, Property 1: JSON Serialization Round-Trip**
     * **Validates: Requirements 1.3, 6.5**
     *
     * For any SubjectFormValues, serializing then deserializing (simulating API round-trip)
     * should preserve the feature arrays
     */
    it('Property 1: Full serialize/deserialize round-trip preserves feature arrays', () => {
      fc.assert(
        fc.property(subjectFormValuesArb, (formValues) => {
          // Serialize for API
          const serialized = serializeSubjectForApi(formValues);

          // Simulate API response (create a SubjectResponse-like object)
          const mockResponse: SubjectResponse = {
            id: 1,
            schoolId: null,
            name: serialized.name as string,
            code: serialized.code as string,
            grade: serialized.grade as number | null,
            periodsPerWeek: serialized.periodsPerWeek as number | null,
            section: serialized.section as string,
            requiredRoomType: serialized.requiredRoomType as string,
            requiredFeatures: serialized.requiredFeatures as string,
            desiredFeatures: serialized.desiredFeatures as string,
            isDifficult: serialized.isDifficult as boolean,
            minRoomCapacity: serialized.minRoomCapacity as number,
            meta: '{}',
            isDeleted: false,
            deletedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Deserialize
          const deserialized = deserializeSubject(mockResponse);

          // Verify feature arrays are preserved
          if (deserialized.requiredFeatures.length !== formValues.requiredFeatures.length) {
            return false;
          }
          if (deserialized.desiredFeatures.length !== formValues.desiredFeatures.length) {
            return false;
          }

          for (let i = 0; i < formValues.requiredFeatures.length; i++) {
            if (deserialized.requiredFeatures[i] !== formValues.requiredFeatures[i]) {
              return false;
            }
          }

          for (let i = 0; i < formValues.desiredFeatures.length; i++) {
            if (deserialized.desiredFeatures[i] !== formValues.desiredFeatures[i]) {
              return false;
            }
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
