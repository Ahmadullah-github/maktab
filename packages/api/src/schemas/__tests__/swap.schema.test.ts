/**
 * Unit tests for swap validation schemas
 *
 * Tests Zod schema validation for swap requests and responses.
 */

import { describe, expect, it } from 'vitest';
import {
  constraintViolationSchema,
  lessonMoveSchema,
  safeValidateSwapRequest,
  slotSchema,
  swapRequestSchema,
  swapValidationResponseSchema,
  validateSwapRequest,
} from '../swap.schema';

describe('Swap Schemas', () => {
  describe('slotSchema', () => {
    it('should validate valid slot', () => {
      const validSlot = {
        classId: '7A',
        day: 'Saturday',
        period: 0,
      };

      const result = slotSchema.safeParse(validSlot);
      expect(result.success).toBe(true);
    });

    it('should reject empty classId', () => {
      const invalidSlot = {
        classId: '',
        day: 'Saturday',
        period: 0,
      };

      const result = slotSchema.safeParse(invalidSlot);
      expect(result.success).toBe(false);
    });

    it('should reject invalid day', () => {
      const invalidSlot = {
        classId: '7A',
        day: 'InvalidDay',
        period: 0,
      };

      const result = slotSchema.safeParse(invalidSlot);
      expect(result.success).toBe(false);
    });

    it('should reject negative period', () => {
      const invalidSlot = {
        classId: '7A',
        day: 'Saturday',
        period: -1,
      };

      const result = slotSchema.safeParse(invalidSlot);
      expect(result.success).toBe(false);
    });

    it('should accept all valid days', () => {
      const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

      for (const day of days) {
        const slot = {
          classId: '7A',
          day,
          period: 0,
        };

        const result = slotSchema.safeParse(slot);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('swapRequestSchema', () => {
    it('should validate valid swap request', () => {
      const validRequest = {
        timetableId: 1,
        sourceSlot: {
          classId: '7A',
          day: 'Saturday',
          period: 0,
        },
        targetSlot: {
          classId: '7A',
          day: 'Saturday',
          period: 1,
        },
      };

      const result = swapRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should reject same source and target slot', () => {
      const invalidRequest = {
        timetableId: 1,
        sourceSlot: {
          classId: '7A',
          day: 'Saturday',
          period: 0,
        },
        targetSlot: {
          classId: '7A',
          day: 'Saturday',
          period: 0,
        },
      };

      const result = swapRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasErrorMessage = result.error.issues.some((issue) =>
          issue.message.includes('different')
        );
        expect(hasErrorMessage).toBe(true);
      }
    });

    it('should reject zero timetableId', () => {
      const invalidRequest = {
        timetableId: 0,
        sourceSlot: {
          classId: '7A',
          day: 'Saturday',
          period: 0,
        },
        targetSlot: {
          classId: '7A',
          day: 'Saturday',
          period: 1,
        },
      };

      const result = swapRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject negative timetableId', () => {
      const invalidRequest = {
        timetableId: -1,
        sourceSlot: {
          classId: '7A',
          day: 'Saturday',
          period: 0,
        },
        targetSlot: {
          classId: '7A',
          day: 'Saturday',
          period: 1,
        },
      };

      const result = swapRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should allow swap between different classes', () => {
      const validRequest = {
        timetableId: 1,
        sourceSlot: {
          classId: '7A',
          day: 'Saturday',
          period: 0,
        },
        targetSlot: {
          classId: '7B',
          day: 'Saturday',
          period: 0,
        },
      };

      const result = swapRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should allow swap between different days', () => {
      const validRequest = {
        timetableId: 1,
        sourceSlot: {
          classId: '7A',
          day: 'Saturday',
          period: 0,
        },
        targetSlot: {
          classId: '7A',
          day: 'Sunday',
          period: 0,
        },
      };

      const result = swapRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });
  });

  describe('validateSwapRequest', () => {
    it('should return validated data for valid request', () => {
      const validRequest = {
        timetableId: 1,
        sourceSlot: {
          classId: '7A',
          day: 'Saturday',
          period: 0,
        },
        targetSlot: {
          classId: '7A',
          day: 'Saturday',
          period: 1,
        },
      };

      const result = validateSwapRequest(validRequest);
      expect(result).toEqual(validRequest);
    });

    it('should throw ZodError for invalid request', () => {
      const invalidRequest = {
        timetableId: 'invalid',
        sourceSlot: {},
        targetSlot: {},
      };

      expect(() => validateSwapRequest(invalidRequest)).toThrow();
    });
  });

  describe('safeValidateSwapRequest', () => {
    it('should return success for valid request', () => {
      const validRequest = {
        timetableId: 1,
        sourceSlot: {
          classId: '7A',
          day: 'Saturday',
          period: 0,
        },
        targetSlot: {
          classId: '7A',
          day: 'Saturday',
          period: 1,
        },
      };

      const result = safeValidateSwapRequest(validRequest);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validRequest);
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid request', () => {
      const invalidRequest = {
        timetableId: 'invalid',
        sourceSlot: {},
        targetSlot: {},
      };

      const result = safeValidateSwapRequest(invalidRequest);
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
    });
  });

  describe('constraintViolationSchema', () => {
    it('should validate valid constraint violation', () => {
      const validViolation = {
        type: 'TEACHER_CONFLICT',
        severity: 'hard' as const,
        message: 'Teacher is already scheduled',
        details: {
          teacherId: '1',
          conflictingClass: '7B',
        },
      };

      const result = constraintViolationSchema.safeParse(validViolation);
      expect(result.success).toBe(true);
    });

    it('should reject invalid severity', () => {
      const invalidViolation = {
        type: 'TEACHER_CONFLICT',
        severity: 'invalid',
        message: 'Teacher is already scheduled',
        details: {},
      };

      const result = constraintViolationSchema.safeParse(invalidViolation);
      expect(result.success).toBe(false);
    });
  });

  describe('lessonMoveSchema', () => {
    it('should validate valid lesson move', () => {
      const validMove = {
        classId: '7A',
        subjectId: 'math',
        teacherId: 'T001',
        roomId: 'R101',
        fromDay: 'Saturday',
        fromPeriod: 0,
        toDay: 'Sunday',
        toPeriod: 1,
      };

      const result = lessonMoveSchema.safeParse(validMove);
      expect(result.success).toBe(true);
    });
  });

  describe('swapValidationResponseSchema', () => {
    it('should validate valid response', () => {
      const validResponse = {
        isValid: true,
        canProceedWithWarning: false,
        errors: [],
        warnings: [],
        affectedLessons: [],
        totalMoves: 0,
      };

      const result = swapValidationResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should validate response with violations', () => {
      const responseWithViolations = {
        isValid: false,
        canProceedWithWarning: false,
        errors: [
          {
            type: 'TEACHER_CONFLICT',
            severity: 'hard',
            message: 'Teacher conflict',
            details: {},
          },
        ],
        warnings: [
          {
            type: 'DIFFICULT_AFTERNOON',
            severity: 'soft',
            message: 'Difficult subject in afternoon',
            details: {},
          },
        ],
        affectedLessons: [
          {
            classId: '7A',
            subjectId: 'math',
            teacherId: 'T001',
            roomId: 'R101',
            fromDay: 'Saturday',
            fromPeriod: 0,
            toDay: 'Sunday',
            toPeriod: 1,
          },
        ],
        totalMoves: 1,
      };

      const result = swapValidationResponseSchema.safeParse(responseWithViolations);
      expect(result.success).toBe(true);
    });

    it('should reject negative totalMoves', () => {
      const invalidResponse = {
        isValid: true,
        canProceedWithWarning: false,
        errors: [],
        warnings: [],
        affectedLessons: [],
        totalMoves: -1,
      };

      const result = swapValidationResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });
});
