/**
 * Property-based tests for Subject Zod schema validation
 *
 * **Feature: subjects-feature, Property 6: Zod Schema Validation**
 * **Validates: Requirements 3.3**
 */

import { subjectSchema, type SubjectFormData } from '@/schemas/subject.schema';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

const sectionArb = fc.constantFrom('PRIMARY', 'MIDDLE', 'HIGH', '' as const);
const roomTypeArb = fc.constantFrom('classroom', 'lab', 'gym', 'library', '' as const);

const validSubjectFormDataArb: fc.Arbitrary<SubjectFormData> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  code: fc.string({ minLength: 1, maxLength: 10 }),
  grade: fc.option(fc.integer({ min: 1, max: 12 }), { nil: null }),
  periodsPerWeek: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
  section: sectionArb,
  requiredRoomType: roomTypeArb,
  requiredFeatures: fc.array(fc.string(), { maxLength: 10 }),
  desiredFeatures: fc.array(fc.string(), { maxLength: 10 }),
  isDifficult: fc.boolean(),
  minRoomCapacity: fc.integer({ min: 0, max: 500 }),
});

const invalidNameArb = fc.constant('');
const invalidCodeArb = fc.oneof(fc.constant(''), fc.string({ minLength: 11, maxLength: 20 }));
const invalidPeriodsArb = fc.oneof(
  fc.integer({ min: -100, max: 0 }),
  fc.integer({ min: 11, max: 100 })
);
const invalidCapacityArb = fc.integer({ min: -100, max: -1 });

describe('Subject Schema Property Tests', () => {
  describe('Valid Input Acceptance', () => {
    it('Property 6: Accepts all valid SubjectFormData', () => {
      fc.assert(
        fc.property(validSubjectFormDataArb, (data) => {
          const result = subjectSchema.safeParse(data);
          return result.success === true;
        }),
        { numRuns: 100 }
      );
    });

    it('Property 6: Parsing preserves all field values', () => {
      fc.assert(
        fc.property(validSubjectFormDataArb, (data) => {
          const result = subjectSchema.safeParse(data);
          if (!result.success) return false;
          const parsed = result.data;
          return (
            parsed.name === data.name &&
            parsed.code === data.code &&
            parsed.grade === data.grade &&
            parsed.periodsPerWeek === data.periodsPerWeek &&
            parsed.section === data.section &&
            parsed.requiredRoomType === data.requiredRoomType &&
            parsed.isDifficult === data.isDifficult &&
            parsed.minRoomCapacity === data.minRoomCapacity &&
            parsed.requiredFeatures.length === data.requiredFeatures.length &&
            parsed.desiredFeatures.length === data.desiredFeatures.length
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Invalid Input Rejection', () => {
    it('Property 6: Rejects empty name', () => {
      fc.assert(
        fc.property(validSubjectFormDataArb, invalidNameArb, (validData, invalidName) => {
          const data = { ...validData, name: invalidName };
          const result = subjectSchema.safeParse(data);
          return result.success === false;
        }),
        { numRuns: 100 }
      );
    });

    it('Property 6: Rejects invalid code', () => {
      fc.assert(
        fc.property(validSubjectFormDataArb, invalidCodeArb, (validData, invalidCode) => {
          const data = { ...validData, code: invalidCode };
          const result = subjectSchema.safeParse(data);
          return result.success === false;
        }),
        { numRuns: 100 }
      );
    });

    it('Property 6: Rejects invalid periodsPerWeek', () => {
      fc.assert(
        fc.property(validSubjectFormDataArb, invalidPeriodsArb, (validData, invalidPeriods) => {
          const data = { ...validData, periodsPerWeek: invalidPeriods };
          const result = subjectSchema.safeParse(data);
          return result.success === false;
        }),
        { numRuns: 100 }
      );
    });

    it('Property 6: Rejects negative minRoomCapacity', () => {
      fc.assert(
        fc.property(validSubjectFormDataArb, invalidCapacityArb, (validData, invalidCapacity) => {
          const data = { ...validData, minRoomCapacity: invalidCapacity };
          const result = subjectSchema.safeParse(data);
          return result.success === false;
        }),
        { numRuns: 100 }
      );
    });

    it('Property 6: Rejects invalid section values', () => {
      const invalidSectionArb = fc
        .string()
        .filter((s) => !['PRIMARY', 'MIDDLE', 'HIGH', ''].includes(s));
      fc.assert(
        fc.property(validSubjectFormDataArb, invalidSectionArb, (validData, invalidSection) => {
          const data = { ...validData, section: invalidSection };
          const result = subjectSchema.safeParse(data);
          return result.success === false;
        }),
        { numRuns: 100 }
      );
    });

    it('Property 6: Rejects invalid room type values', () => {
      const invalidRoomTypeArb = fc
        .string()
        .filter((s) => !['classroom', 'lab', 'gym', 'library', ''].includes(s));
      fc.assert(
        fc.property(validSubjectFormDataArb, invalidRoomTypeArb, (validData, invalidRoomType) => {
          const data = { ...validData, requiredRoomType: invalidRoomType };
          const result = subjectSchema.safeParse(data);
          return result.success === false;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Default Values', () => {
    it('Property 6: Applies default values for optional fields', () => {
      const minimalData = {
        name: 'Test Subject',
        code: 'TEST',
        grade: null,
        periodsPerWeek: null,
        section: '' as const,
        requiredRoomType: '' as const,
      };
      const result = subjectSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requiredFeatures).toEqual([]);
        expect(result.data.desiredFeatures).toEqual([]);
        expect(result.data.isDifficult).toBe(false);
        expect(result.data.minRoomCapacity).toBe(0);
      }
    });
  });
});
