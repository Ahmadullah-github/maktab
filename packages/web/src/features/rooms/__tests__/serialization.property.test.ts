/**
 * Property-based tests for room serialization utilities
 *
 * **Feature: rooms-feature, Property 4: Room serialization round-trip**
 * **Validates: Requirements 7.2, 9.1, 9.2**
 *
 * Property 4: Room serialization round-trip
 * *For any* valid Room object, serializing it for the API and then
 * deserializing the response should produce an equivalent Room object
 * (features array, unavailable slots, and meta preserved).
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { RoomFormValues, RoomResponse, RoomType, UnavailableSlot } from '../types';
import {
  deserializeRoom,
  parseJsonArray,
  parseJsonObject,
  parseUnavailableSlots,
  serializeRoomForApi,
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
 * Arbitrary generator for UnavailableSlot
 */
const unavailableSlotArb: fc.Arbitrary<UnavailableSlot> = fc.record({
  day: fc.integer({ min: 0, max: 6 }),
  period: fc.integer({ min: 0, max: 10 }),
});

/**
 * Arbitrary generator for array of UnavailableSlot
 */
const unavailableSlotsArb: fc.Arbitrary<UnavailableSlot[]> = fc.array(unavailableSlotArb, {
  minLength: 0,
  maxLength: 20,
});

/**
 * Arbitrary generator for RoomFormValues
 */
const roomFormValuesArb: fc.Arbitrary<RoomFormValues> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  capacity: fc.integer({ min: 1, max: 500 }),
  type: roomTypeArb,
  features: featureArrayArb,
  unavailable: unavailableSlotsArb,
});

/**
 * Arbitrary generator for valid ISO date strings
 */
const isoDateStringArb: fc.Arbitrary<string> = fc.constantFrom(
  '2020-01-15T10:30:00.000Z',
  '2021-06-20T14:45:30.000Z',
  '2022-12-01T08:00:00.000Z',
  '2023-03-10T16:20:15.000Z',
  '2024-09-25T12:00:00.000Z'
);

/**
 * Arbitrary generator for RoomResponse (raw API response)
 */
const roomResponseArb: fc.Arbitrary<RoomResponse> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  schoolId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  capacity: fc.integer({ min: 1, max: 500 }),
  type: fc.constantFrom(
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
  features: featureArrayArb.map((arr) => JSON.stringify(arr)),
  unavailable: unavailableSlotsArb.map((arr) => JSON.stringify(arr)),
  meta: fc.constant('{}'),
  isDeleted: fc.boolean(),
  deletedAt: fc.option(isoDateStringArb, { nil: null }),
  createdAt: isoDateStringArb,
  updatedAt: isoDateStringArb,
});

describe('Room Serialization Property Tests', () => {
  describe('parseJsonArray', () => {
    /**
     * **Feature: rooms-feature, Property 4: Room serialization round-trip**
     * **Validates: Requirements 9.2**
     *
     * For any valid array of strings, JSON.stringify then parseJsonArray
     * should produce an equivalent array
     */
    it('Property 4: Round-trip preserves string arrays', () => {
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
     * **Feature: rooms-feature, Property 4: Room serialization round-trip**
     * **Validates: Requirements 9.3**
     *
     * parseJsonArray should handle empty/null/undefined input gracefully
     */
    it('Property 4: Handles empty input gracefully', () => {
      expect(parseJsonArray('')).toEqual([]);
      expect(parseJsonArray(null)).toEqual([]);
      expect(parseJsonArray(undefined)).toEqual([]);
      expect(parseJsonArray('[]')).toEqual([]);
    });

    /**
     * **Feature: rooms-feature, Property 4: Room serialization round-trip**
     * **Validates: Requirements 9.3**
     *
     * parseJsonArray should handle malformed JSON gracefully
     */
    it('Property 4: Handles malformed JSON gracefully', () => {
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

  describe('parseUnavailableSlots', () => {
    /**
     * **Feature: rooms-feature, Property 4: Room serialization round-trip**
     * **Validates: Requirements 9.2**
     *
     * For any valid array of UnavailableSlot, JSON.stringify then parseUnavailableSlots
     * should produce an equivalent array
     */
    it('Property 4: Round-trip preserves unavailable slots', () => {
      fc.assert(
        fc.property(unavailableSlotsArb, (slots) => {
          const serialized = JSON.stringify(slots);
          const deserialized = parseUnavailableSlots(serialized);

          // Check length is preserved
          if (deserialized.length !== slots.length) {
            return false;
          }

          // Check each slot is equivalent
          for (let i = 0; i < slots.length; i++) {
            if (
              deserialized[i].day !== slots[i].day ||
              deserialized[i].period !== slots[i].period
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
     * **Feature: rooms-feature, Property 4: Room serialization round-trip**
     * **Validates: Requirements 9.3**
     *
     * parseUnavailableSlots should handle empty/null/undefined input gracefully
     */
    it('Property 4: Handles empty input gracefully', () => {
      expect(parseUnavailableSlots('')).toEqual([]);
      expect(parseUnavailableSlots(null)).toEqual([]);
      expect(parseUnavailableSlots(undefined)).toEqual([]);
      expect(parseUnavailableSlots('[]')).toEqual([]);
    });
  });

  describe('parseJsonObject', () => {
    /**
     * **Feature: rooms-feature, Property 4: Room serialization round-trip**
     * **Validates: Requirements 9.2**
     *
     * For any valid object, JSON.stringify then parseJsonObject
     * should produce an equivalent object
     */
    it('Property 4: Round-trip preserves objects', () => {
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
     * **Feature: rooms-feature, Property 4: Room serialization round-trip**
     * **Validates: Requirements 9.3**
     *
     * parseJsonObject should handle empty/null/undefined input gracefully
     */
    it('Property 4: Handles empty input gracefully', () => {
      expect(parseJsonObject('')).toEqual({});
      expect(parseJsonObject(null)).toEqual({});
      expect(parseJsonObject(undefined)).toEqual({});
      expect(parseJsonObject('{}')).toEqual({});
    });
  });

  describe('deserializeRoom', () => {
    /**
     * **Feature: rooms-feature, Property 4: Room serialization round-trip**
     * **Validates: Requirements 9.2**
     *
     * deserializeRoom should correctly parse JSON string fields
     */
    it('Property 4: Correctly deserializes JSON string fields', () => {
      fc.assert(
        fc.property(roomResponseArb, (response) => {
          const room = deserializeRoom(response);

          // Verify arrays are properly parsed
          const expectedFeatures = JSON.parse(response.features);
          const expectedUnavailable = JSON.parse(response.unavailable);

          return (
            Array.isArray(room.features) &&
            Array.isArray(room.unavailable) &&
            typeof room.meta === 'object' &&
            room.features.length === expectedFeatures.length &&
            room.unavailable.length === expectedUnavailable.length
          );
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 4: Room serialization round-trip**
     * **Validates: Requirements 9.2**
     *
     * deserializeRoom should preserve non-JSON fields
     */
    it('Property 4: Preserves non-JSON fields', () => {
      fc.assert(
        fc.property(roomResponseArb, (response) => {
          const room = deserializeRoom(response);

          return (
            room.id === response.id &&
            room.name === response.name &&
            room.capacity === response.capacity &&
            room.isDeleted === response.isDeleted
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('serializeRoomForApi', () => {
    /**
     * **Feature: rooms-feature, Property 4: Room serialization round-trip**
     * **Validates: Requirements 9.1**
     *
     * serializeRoomForApi should convert arrays to JSON strings
     */
    it('Property 4: Converts arrays to JSON strings', () => {
      fc.assert(
        fc.property(roomFormValuesArb, (formValues) => {
          const serialized = serializeRoomForApi(formValues);

          // Verify arrays are serialized to strings
          const features = serialized.features;
          const unavailable = serialized.unavailable;

          if (typeof features !== 'string' || typeof unavailable !== 'string') {
            return false;
          }

          // Verify they are valid JSON
          try {
            const parsedFeatures = JSON.parse(features);
            const parsedUnavailable = JSON.parse(unavailable);

            return (
              Array.isArray(parsedFeatures) &&
              Array.isArray(parsedUnavailable) &&
              parsedFeatures.length === formValues.features.length &&
              parsedUnavailable.length === formValues.unavailable.length
            );
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 4: Room serialization round-trip**
     * **Validates: Requirements 9.1**
     *
     * serializeRoomForApi should preserve simple fields
     */
    it('Property 4: Preserves simple fields', () => {
      fc.assert(
        fc.property(roomFormValuesArb, (formValues) => {
          const serialized = serializeRoomForApi(formValues);

          return (
            serialized.name === formValues.name &&
            serialized.capacity === formValues.capacity &&
            serialized.type === formValues.type
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Full Round-Trip', () => {
    /**
     * **Feature: rooms-feature, Property 4: Room serialization round-trip**
     * **Validates: Requirements 7.2, 9.1, 9.2**
     *
     * For any RoomFormValues, serializing then deserializing (simulating API round-trip)
     * should preserve the features array and unavailable slots
     */
    it('Property 4: Full serialize/deserialize round-trip preserves complex fields', () => {
      fc.assert(
        fc.property(roomFormValuesArb, (formValues) => {
          // Serialize for API
          const serialized = serializeRoomForApi(formValues);

          // Simulate API response (create a RoomResponse-like object)
          const mockResponse: RoomResponse = {
            id: 1,
            schoolId: null,
            name: serialized.name as string,
            capacity: serialized.capacity as number,
            type: serialized.type as string,
            features: serialized.features as string,
            unavailable: serialized.unavailable as string,
            meta: '{}',
            isDeleted: false,
            deletedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Deserialize
          const deserialized = deserializeRoom(mockResponse);

          // Verify features array is preserved
          if (deserialized.features.length !== formValues.features.length) {
            return false;
          }

          for (let i = 0; i < formValues.features.length; i++) {
            if (deserialized.features[i] !== formValues.features[i]) {
              return false;
            }
          }

          // Verify unavailable slots are preserved
          if (deserialized.unavailable.length !== formValues.unavailable.length) {
            return false;
          }

          for (let i = 0; i < formValues.unavailable.length; i++) {
            if (
              deserialized.unavailable[i].day !== formValues.unavailable[i].day ||
              deserialized.unavailable[i].period !== formValues.unavailable[i].period
            ) {
              return false;
            }
          }

          // Verify simple fields are preserved
          return (
            deserialized.name === formValues.name &&
            deserialized.capacity === formValues.capacity &&
            deserialized.type === formValues.type
          );
        }),
        { numRuns: 100 }
      );
    });
  });
});
