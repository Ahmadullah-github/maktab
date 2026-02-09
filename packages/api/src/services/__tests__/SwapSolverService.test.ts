/**
 * SwapSolverService Tests
 *
 * Tests for the swap solver service that integrates with Python solver.
 */

import { SwapSolverService } from '../SwapSolverService';

describe('SwapSolverService', () => {
  let service: SwapSolverService;

  beforeEach(() => {
    service = new SwapSolverService();
  });

  describe('constructor', () => {
    it('should initialize with correct paths', () => {
      expect(service).toBeDefined();
      expect(service['pythonPath']).toContain('solver/.venv/bin/python');
      expect(service['solverPath']).toContain('solver/swap_solver.py');
    });
  });

  describe('validateSwap', () => {
    it('should have validateSwap method', () => {
      expect(typeof service.validateSwap).toBe('function');
    });

    // Note: Full integration tests require:
    // 1. Database with timetable data
    // 2. Python environment set up
    // 3. Mock or real constraint data
    // These should be tested in E2E tests
  });
});
