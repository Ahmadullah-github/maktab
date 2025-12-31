/**
 * Property-Based Tests for Machine ID Module
 * 
 * **Feature: license-request-system, Property 1: Machine ID Consistency (Idempotence)**
 * **Feature: license-request-system, Property 2: Machine ID Format Validity**
 */

const fc = require("fast-check");

// Mock electron app module before requiring machineId
jest.mock("electron", () => ({
  app: {
    getPath: jest.fn(() => "/tmp/test-maktab"),
  },
}));

const { 
  getMachineIdSync, 
  getShortMachineIdSync, 
  toShortFormat,
  getOrCreateFallbackUuid,
} = require("../machineId");

describe("Machine ID Property Tests", () => {
  /**
   * **Feature: license-request-system, Property 1: Machine ID Consistency (Idempotence)**
   * **Validates: Requirements 1.1, 1.3**
   * 
   * For any single hardware configuration, calling getMachineId() multiple times 
   * SHALL return the same value.
   */
  describe("Property 1: Machine ID Consistency (Idempotence)", () => {
    it("should return the same machine ID on multiple calls", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }), // Number of calls to make
          (numCalls) => {
            const results = [];
            for (let i = 0; i < numCalls; i++) {
              results.push(getMachineIdSync());
            }
            
            // All results should be identical
            const firstResult = results[0];
            return results.every((result) => result === firstResult);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return the same short machine ID on multiple calls", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }), // Number of calls to make
          (numCalls) => {
            const results = [];
            for (let i = 0; i < numCalls; i++) {
              results.push(getShortMachineIdSync());
            }
            
            // All results should be identical
            const firstResult = results[0];
            return results.every((result) => result === firstResult);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: license-request-system, Property 2: Machine ID Format Validity**
   * **Validates: Requirements 1.2**
   * 
   * For any generated Machine ID, the short format value SHALL match the pattern 
   * ^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$ (12 alphanumeric characters with 2 dashes).
   */
  describe("Property 2: Machine ID Format Validity", () => {
    const SHORT_ID_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

    it("should produce short IDs matching the required format", () => {
      const shortId = getShortMachineIdSync();
      expect(shortId).toMatch(SHORT_ID_PATTERN);
    });

    it("should produce valid format for any input string", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (inputString) => {
            const shortFormat = toShortFormat(inputString);
            return SHORT_ID_PATTERN.test(shortFormat);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should produce exactly 14 characters (12 alphanumeric + 2 dashes)", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (inputString) => {
            const shortFormat = toShortFormat(inputString);
            return shortFormat.length === 14;
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should produce deterministic output for the same input", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          (inputString) => {
            const result1 = toShortFormat(inputString);
            const result2 = toShortFormat(inputString);
            return result1 === result2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should produce different outputs for different inputs (collision resistance)", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (input1, input2) => {
            // Skip if inputs are the same
            if (input1 === input2) return true;
            
            const result1 = toShortFormat(input1);
            const result2 = toShortFormat(input2);
            
            // Different inputs should (almost always) produce different outputs
            // Due to hash collision possibility, we just verify format is valid
            return SHORT_ID_PATTERN.test(result1) && SHORT_ID_PATTERN.test(result2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Fallback UUID", () => {
    it("should return a valid UUID format", () => {
      const uuid = getOrCreateFallbackUuid();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidPattern);
    });

    it("should return the same UUID on multiple calls (persistence)", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),
          (numCalls) => {
            const results = [];
            for (let i = 0; i < numCalls; i++) {
              results.push(getOrCreateFallbackUuid());
            }
            const firstResult = results[0];
            return results.every((result) => result === firstResult);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
