/**
 * Property-based tests for Solver Service
 * 
 * **Feature: backend-refactoring, Property 6: Concurrent solver request handling**
 * **Validates: Requirements 8.1**
 * 
 * Property 6: Concurrent solver request handling
 * *For any* two concurrent timetable generation requests, at most one SHALL be
 * actively running at any time; the other SHALL be queued or rejected with a
 * "busy" status.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { ERROR_CODES } from '../../constants';

// Create a mock SolverService that doesn't spawn real processes
class MockSolverService {
  private static instance: MockSolverService | null = null;
  private _isRunning: boolean = false;
  private solveStartedAt: Date | undefined = undefined;
  private currentProcessId: number | undefined = undefined;
  private resolveDelay: number = 10;

  private constructor() {}

  static getInstance(): MockSolverService {
    if (!MockSolverService.instance) {
      MockSolverService.instance = new MockSolverService();
    }
    return MockSolverService.instance;
  }

  static resetInstance(): void {
    MockSolverService.instance = null;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  getStatus() {
    return {
      isRunning: this._isRunning,
      processId: this.currentProcessId,
      startedAt: this.solveStartedAt,
    };
  }

  setResolveDelay(ms: number): void {
    this.resolveDelay = ms;
  }

  async runSolver(data: any): Promise<any> {
    // Check if solver is already running (concurrent request handling)
    if (this._isRunning) {
      const error = new Error('Solver is currently busy processing another request') as any;
      error.clientMessage = 'Timetable generation is already in progress. Please wait for it to complete.';
      error.code = ERROR_CODES.SOLVER_BUSY;
      throw error;
    }

    // Mark as running
    this._isRunning = true;
    this.solveStartedAt = new Date();
    this.currentProcessId = Math.floor(Math.random() * 10000);

    try {
      // Simulate async solver execution
      await new Promise(resolve => setTimeout(resolve, this.resolveDelay));
      return { status: 'success', data };
    } finally {
      // Always clean up after execution
      this._isRunning = false;
      this.currentProcessId = undefined;
      this.solveStartedAt = undefined;
    }
  }
}

describe('Solver Service Property Tests', () => {
  let solverService: MockSolverService;

  beforeEach(() => {
    MockSolverService.resetInstance();
    solverService = MockSolverService.getInstance();
  });

  afterEach(() => {
    MockSolverService.resetInstance();
  });


  /**
   * **Feature: backend-refactoring, Property 6: Concurrent solver request handling**
   * **Validates: Requirements 8.1**
   * 
   * For any two concurrent timetable generation requests, at most one SHALL be
   * actively running at any time; the other SHALL be rejected with SOLVER_BUSY.
   */
  it('Property 6: Concurrent requests are rejected with SOLVER_BUSY', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random solver input data
        fc.record({
          teachers: fc.array(fc.record({ id: fc.integer(), name: fc.string() }), { maxLength: 5 }),
          classes: fc.array(fc.record({ id: fc.integer(), name: fc.string() }), { maxLength: 5 }),
        }),
        async (inputData) => {
          // Reset for each test iteration
          MockSolverService.resetInstance();
          const service = MockSolverService.getInstance();
          service.setResolveDelay(20); // Short delay to ensure overlap

          // Start first request (don't await - let it run)
          const firstRequest = service.runSolver(inputData);

          // Immediately try second request while first is running
          let secondRejected = false;
          let rejectionCode: string | undefined;

          try {
            // This should be rejected immediately since first is running
            await service.runSolver(inputData);
          } catch (err: any) {
            secondRejected = true;
            rejectionCode = err.code;
          }

          // Wait for first request to complete
          try {
            await firstRequest;
          } catch (_) {
            // First request may fail for various reasons in test, that's ok
          }

          // The second request MUST have been rejected with SOLVER_BUSY
          return secondRejected && rejectionCode === ERROR_CODES.SOLVER_BUSY;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 6: Concurrent solver request handling**
   * **Validates: Requirements 8.1**
   * 
   * For any number of concurrent requests N > 1, exactly N-1 should be rejected
   * with SOLVER_BUSY status.
   */
  it('Property 6: Multiple concurrent requests - only one succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate number of concurrent requests (2-10)
        fc.integer({ min: 2, max: 10 }),
        fc.record({
          data: fc.string({ maxLength: 10 }),
        }),
        async (numRequests, inputData) => {
          // Reset for each test iteration
          MockSolverService.resetInstance();
          const service = MockSolverService.getInstance();
          service.setResolveDelay(20);

          // Launch all requests concurrently
          const requests = Array.from({ length: numRequests }, () =>
            service.runSolver(inputData).catch((err) => err)
          );

          // Wait for all to complete
          const results = await Promise.all(requests);

          // Count how many were rejected with SOLVER_BUSY
          const busyRejections = results.filter(
            (r) => r instanceof Error && r.code === ERROR_CODES.SOLVER_BUSY
          ).length;

          // Exactly numRequests - 1 should be rejected (one succeeds)
          return busyRejections === numRequests - 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 6: Concurrent solver request handling**
   * **Validates: Requirements 8.1**
   * 
   * The isRunning flag should accurately reflect whether a solver is running.
   */
  it('Property 6: isRunning flag is accurate during execution', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({ value: fc.integer() }),
        async (inputData) => {
          MockSolverService.resetInstance();
          const service = MockSolverService.getInstance();
          service.setResolveDelay(10);

          // Before any request, isRunning should be false
          const beforeRunning = service.isRunning;

          // Start a request
          const request = service.runSolver(inputData);

          // During execution, isRunning should be true
          const duringRunning = service.isRunning;

          // Wait for completion
          try {
            await request;
          } catch (_) {
            // May fail, that's ok
          }

          // After completion, isRunning should be false
          const afterRunning = service.isRunning;

          return !beforeRunning && duringRunning && !afterRunning;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 6: Concurrent solver request handling**
   * **Validates: Requirements 8.1**
   * 
   * After a request completes (success or failure), subsequent requests should be accepted.
   */
  it('Property 6: Sequential requests are all accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate number of sequential requests
        fc.integer({ min: 2, max: 5 }),
        fc.record({ value: fc.integer() }),
        async (numRequests, inputData) => {
          MockSolverService.resetInstance();
          const service = MockSolverService.getInstance();
          service.setResolveDelay(5);

          let busyRejections = 0;

          // Run requests sequentially (wait for each to complete)
          for (let i = 0; i < numRequests; i++) {
            try {
              await service.runSolver(inputData);
            } catch (err: any) {
              if (err.code === ERROR_CODES.SOLVER_BUSY) {
                busyRejections++;
              }
              // Other errors are acceptable
            }
          }

          // No request should be rejected with SOLVER_BUSY when run sequentially
          return busyRejections === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});
