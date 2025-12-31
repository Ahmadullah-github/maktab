/**
 * Property-based tests for Request Validation Middleware
 * 
 * **Feature: backend-refactoring, Property 7: Request validation rejects invalid input**
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**
 * 
 * Property 7: Request validation rejects invalid input
 * *For any* request body that violates the defined Zod schema, the endpoint
 * SHALL return a 400 status with validation error details.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Request, Response } from 'express';
import { validateRequest } from '../validation.middleware';
import {
  createTeacherSchema,
  createSubjectSchema,
  createRoomSchema,
  createClassSchema,
} from '../../schemas';

// Helper to create mock request/response
function createMockReqRes(body: unknown) {
  const req = { body } as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn();
  return { req, res, next };
}

describe('Validation Middleware Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: backend-refactoring, Property 7: Request validation rejects invalid input**
   * **Validates: Requirements 9.1, 9.5**
   * 
   * For any teacher request with missing required fullName field,
   * validation SHALL reject with 400 status.
   */
  it('Property 7: Teacher validation rejects missing fullName', () => {
    fc.assert(
      fc.property(
        // Generate objects without fullName or with empty fullName
        fc.record({
          maxPeriodsPerWeek: fc.integer({ min: 0, max: 100 }),
          maxPeriodsPerDay: fc.integer({ min: 0, max: 20 }),
        }),
        (partialTeacher) => {
          const { req, res, next } = createMockReqRes(partialTeacher);
          const middleware = validateRequest(createTeacherSchema);
          
          middleware(req, res, next);
          
          // Should return 400 for missing fullName
          expect(res.status).toHaveBeenCalledWith(400);
          expect(next).not.toHaveBeenCalled();
          
          const jsonCall = (res.json as any).mock.calls[0][0];
          expect(jsonCall.success).toBe(false);
          expect(jsonCall.error.code).toBe('VALIDATION_ERROR');
          expect(jsonCall.error.details).toBeDefined();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 7: Request validation rejects invalid input**
   * **Validates: Requirements 9.1, 9.5**
   * 
   * For any teacher request with valid fullName, validation SHALL pass.
   */
  it('Property 7: Teacher validation accepts valid fullName', () => {
    fc.assert(
      fc.property(
        // Generate non-empty strings for fullName
        fc.string({ minLength: 1, maxLength: 100 }),
        (fullName) => {
          const { req, res, next } = createMockReqRes({ fullName });
          const middleware = validateRequest(createTeacherSchema);
          
          middleware(req, res, next);
          
          // Should call next() for valid input
          expect(next).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalled();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 7: Request validation rejects invalid input**
   * **Validates: Requirements 9.1, 9.5**
   * 
   * For any teacher request with negative maxPeriodsPerWeek,
   * validation SHALL reject with 400 status.
   */
  it('Property 7: Teacher validation rejects negative maxPeriodsPerWeek', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: -1000, max: -1 }),
        (fullName, maxPeriodsPerWeek) => {
          const { req, res, next } = createMockReqRes({ fullName, maxPeriodsPerWeek });
          const middleware = validateRequest(createTeacherSchema);
          
          middleware(req, res, next);
          
          // Should return 400 for negative value
          expect(res.status).toHaveBeenCalledWith(400);
          expect(next).not.toHaveBeenCalled();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 7: Request validation rejects invalid input**
   * **Validates: Requirements 9.2, 9.5**
   * 
   * For any subject request with missing required name field,
   * validation SHALL reject with 400 status.
   */
  it('Property 7: Subject validation rejects missing name', () => {
    fc.assert(
      fc.property(
        fc.record({
          code: fc.string({ maxLength: 50 }),
          grade: fc.integer({ min: 1, max: 12 }),
        }),
        (partialSubject) => {
          const { req, res, next } = createMockReqRes(partialSubject);
          const middleware = validateRequest(createSubjectSchema);
          
          middleware(req, res, next);
          
          expect(res.status).toHaveBeenCalledWith(400);
          expect(next).not.toHaveBeenCalled();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 7: Request validation rejects invalid input**
   * **Validates: Requirements 9.2, 9.5**
   * 
   * For any subject request with grade outside valid range (1-12),
   * validation SHALL reject with 400 status.
   */
  it('Property 7: Subject validation rejects invalid grade range', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.oneof(
          fc.integer({ min: -100, max: 0 }),
          fc.integer({ min: 13, max: 100 })
        ),
        (name, grade) => {
          const { req, res, next } = createMockReqRes({ name, grade });
          const middleware = validateRequest(createSubjectSchema);
          
          middleware(req, res, next);
          
          expect(res.status).toHaveBeenCalledWith(400);
          expect(next).not.toHaveBeenCalled();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 7: Request validation rejects invalid input**
   * **Validates: Requirements 9.3, 9.5**
   * 
   * For any room request with missing required fields (name, capacity, type),
   * validation SHALL reject with 400 status.
   */
  it('Property 7: Room validation rejects missing required fields', () => {
    fc.assert(
      fc.property(
        // Generate partial room objects missing at least one required field
        fc.oneof(
          fc.record({ capacity: fc.integer({ min: 1, max: 100 }), type: fc.string({ minLength: 1 }) }),
          fc.record({ name: fc.string({ minLength: 1 }), type: fc.string({ minLength: 1 }) }),
          fc.record({ name: fc.string({ minLength: 1 }), capacity: fc.integer({ min: 1, max: 100 }) })
        ),
        (partialRoom) => {
          const { req, res, next } = createMockReqRes(partialRoom);
          const middleware = validateRequest(createRoomSchema);
          
          middleware(req, res, next);
          
          expect(res.status).toHaveBeenCalledWith(400);
          expect(next).not.toHaveBeenCalled();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 7: Request validation rejects invalid input**
   * **Validates: Requirements 9.3, 9.5**
   * 
   * For any room request with capacity less than 1,
   * validation SHALL reject with 400 status.
   */
  it('Property 7: Room validation rejects invalid capacity', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: -100, max: 0 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (name, capacity, type) => {
          const { req, res, next } = createMockReqRes({ name, capacity, type });
          const middleware = validateRequest(createRoomSchema);
          
          middleware(req, res, next);
          
          expect(res.status).toHaveBeenCalledWith(400);
          expect(next).not.toHaveBeenCalled();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 7: Request validation rejects invalid input**
   * **Validates: Requirements 9.3, 9.5**
   * 
   * For any valid room request, validation SHALL pass.
   */
  it('Property 7: Room validation accepts valid input', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 500 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (name, capacity, type) => {
          const { req, res, next } = createMockReqRes({ name, capacity, type });
          const middleware = validateRequest(createRoomSchema);
          
          middleware(req, res, next);
          
          expect(next).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalled();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 7: Request validation rejects invalid input**
   * **Validates: Requirements 9.4, 9.5**
   * 
   * For any class request with missing required name field,
   * validation SHALL reject with 400 status.
   */
  it('Property 7: Class validation rejects missing name', () => {
    fc.assert(
      fc.property(
        fc.record({
          studentCount: fc.integer({ min: 0, max: 100 }),
          grade: fc.integer({ min: 1, max: 12 }),
        }),
        (partialClass) => {
          const { req, res, next } = createMockReqRes(partialClass);
          const middleware = validateRequest(createClassSchema);
          
          middleware(req, res, next);
          
          expect(res.status).toHaveBeenCalledWith(400);
          expect(next).not.toHaveBeenCalled();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 7: Request validation rejects invalid input**
   * **Validates: Requirements 9.4, 9.5**
   * 
   * For any class request with negative studentCount,
   * validation SHALL reject with 400 status.
   */
  it('Property 7: Class validation rejects negative studentCount', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: -100, max: -1 }),
        (name, studentCount) => {
          const { req, res, next } = createMockReqRes({ name, studentCount });
          const middleware = validateRequest(createClassSchema);
          
          middleware(req, res, next);
          
          expect(res.status).toHaveBeenCalledWith(400);
          expect(next).not.toHaveBeenCalled();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 7: Request validation rejects invalid input**
   * **Validates: Requirements 9.5**
   * 
   * For any invalid input, the error response SHALL include field-level details.
   */
  it('Property 7: Validation errors include field-level details', () => {
    fc.assert(
      fc.property(
        // Generate various invalid inputs
        fc.oneof(
          fc.constant({}),
          fc.constant({ fullName: '' }),
          fc.constant({ fullName: 123 }),
          fc.record({ randomField: fc.string() })
        ),
        (invalidInput) => {
          const { req, res, next } = createMockReqRes(invalidInput);
          const middleware = validateRequest(createTeacherSchema);
          
          middleware(req, res, next);
          
          // For empty fullName or missing fullName, should fail
          if (!invalidInput || typeof (invalidInput as any).fullName !== 'string' || (invalidInput as any).fullName === '') {
            expect(res.status).toHaveBeenCalledWith(400);
            
            const jsonCall = (res.json as any).mock.calls[0][0];
            expect(jsonCall.error.details).toBeDefined();
            expect(typeof jsonCall.error.details).toBe('object');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
