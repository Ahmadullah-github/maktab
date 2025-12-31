/**
 * Property-based tests for Pagination Middleware
 * 
 * **Feature: backend-refactoring, Property 3: Pagination returns correct subset**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
 * 
 * Property 3: Pagination returns correct subset
 * *For any* valid page P and limit L on a collection of size N, the returned data
 * SHALL contain exactly min(L, N - (P-1)*L) items starting from index (P-1)*L.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Request, Response } from 'express';
import {
  paginationMiddleware,
  paginateArray,
  calculatePaginationMeta,
} from '../pagination.middleware';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../constants';

// Helper to create mock request/response
function createMockReqRes(query: Record<string, string | undefined>) {
  const req = { query } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn();
  return { req, res, next };
}

describe('Pagination Middleware Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: backend-refactoring, Property 3: Pagination returns correct subset**
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
   * 
   * For any valid page and limit, paginateArray returns the correct subset.
   */
  it('Property 3: paginateArray returns correct subset size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),  // page
        fc.integer({ min: 1, max: 100 }),  // limit
        fc.array(fc.integer(), { minLength: 0, maxLength: 500 }),  // items
        (page, limit, items) => {
          const result = paginateArray(items, { page, limit });
          
          const startIndex = (page - 1) * limit;
          const expectedCount = Math.max(0, Math.min(limit, items.length - startIndex));
          
          expect(result.length).toBe(expectedCount);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 3: Pagination returns correct subset**
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
   * 
   * For any valid page and limit, paginateArray returns items starting from correct index.
   */
  it('Property 3: paginateArray returns items from correct starting index', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),  // page
        fc.integer({ min: 1, max: 50 }),  // limit
        fc.array(fc.integer(), { minLength: 1, maxLength: 200 }),  // items (non-empty)
        (page, limit, items) => {
          const result = paginateArray(items, { page, limit });
          
          const startIndex = (page - 1) * limit;
          
          // If we have results, first item should match expected start index
          if (result.length > 0 && startIndex < items.length) {
            expect(result[0]).toBe(items[startIndex]);
          }
          
          // All returned items should match their expected positions
          for (let i = 0; i < result.length; i++) {
            expect(result[i]).toBe(items[startIndex + i]);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 3: Pagination returns correct subset**
   * **Validates: Requirements 6.5**
   * 
   * calculatePaginationMeta returns correct total pages calculation.
   */
  it('Property 3: calculatePaginationMeta computes correct totalPages', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),  // total items
        fc.integer({ min: 1, max: 100 }),    // page
        fc.integer({ min: 1, max: 100 }),    // limit
        (total, page, limit) => {
          const meta = calculatePaginationMeta(total, { page, limit });
          
          const expectedTotalPages = Math.ceil(total / limit) || 1;
          
          expect(meta.total).toBe(total);
          expect(meta.page).toBe(page);
          expect(meta.limit).toBe(limit);
          expect(meta.totalPages).toBe(expectedTotalPages);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 3: Pagination returns correct subset**
   * **Validates: Requirements 6.6**
   * 
   * Middleware applies default values when parameters are not provided.
   */
  it('Property 3: Middleware applies defaults when params missing', () => {
    fc.assert(
      fc.property(
        fc.constant({}),  // empty query
        () => {
          const { req, res, next } = createMockReqRes({});
          
          paginationMiddleware(req, res, next);
          
          expect(req.pagination).toBeDefined();
          expect(req.pagination!.page).toBe(DEFAULT_PAGE);
          expect(req.pagination!.limit).toBe(DEFAULT_PAGE_LIMIT);
          expect(next).toHaveBeenCalled();
          
          return true;
        }
      ),
      { numRuns: 10 }  // Fewer runs since input is constant
    );
  });

  /**
   * **Feature: backend-refactoring, Property 3: Pagination returns correct subset**
   * **Validates: Requirements 6.6**
   * 
   * Middleware parses valid page and limit from query string.
   */
  it('Property 3: Middleware parses valid page and limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),  // page
        fc.integer({ min: 1, max: MAX_PAGE_LIMIT }),  // limit (within max)
        (page, limit) => {
          const { req, res, next } = createMockReqRes({
            page: String(page),
            limit: String(limit),
          });
          
          paginationMiddleware(req, res, next);
          
          expect(req.pagination).toBeDefined();
          expect(req.pagination!.page).toBe(page);
          expect(req.pagination!.limit).toBe(limit);
          expect(next).toHaveBeenCalled();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 3: Pagination returns correct subset**
   * **Validates: Requirements 6.7**
   * 
   * Middleware caps limit at MAX_PAGE_LIMIT.
   */
  it('Property 3: Middleware caps limit at maximum', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),  // page
        fc.integer({ min: MAX_PAGE_LIMIT + 1, max: 10000 }),  // limit exceeding max
        (page, limit) => {
          const { req, res, next } = createMockReqRes({
            page: String(page),
            limit: String(limit),
          });
          
          paginationMiddleware(req, res, next);
          
          expect(req.pagination).toBeDefined();
          expect(req.pagination!.page).toBe(page);
          expect(req.pagination!.limit).toBe(MAX_PAGE_LIMIT);
          expect(next).toHaveBeenCalled();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 3: Pagination returns correct subset**
   * **Validates: Requirements 6.6**
   * 
   * Middleware handles invalid (non-numeric) values by using defaults.
   * Note: parseInt("2.5") returns 2, which is valid, so we only test truly invalid values.
   */
  it('Property 3: Middleware uses defaults for invalid values', () => {
    fc.assert(
      fc.property(
        // Truly invalid page values (non-numeric or <= 0)
        fc.oneof(
          fc.constant('abc'),
          fc.constant(''),
          fc.constant('-5'),
          fc.constant('0'),
          fc.constant('NaN'),
          fc.constant('undefined')
        ),
        // Truly invalid limit values (non-numeric or <= 0)
        fc.oneof(
          fc.constant('xyz'),
          fc.constant(''),
          fc.constant('-10'),
          fc.constant('0'),
          fc.constant('NaN'),
          fc.constant('null')
        ),
        (invalidPage, invalidLimit) => {
          const { req, res, next } = createMockReqRes({
            page: invalidPage,
            limit: invalidLimit,
          });
          
          paginationMiddleware(req, res, next);
          
          expect(req.pagination).toBeDefined();
          // Invalid values should fall back to defaults
          expect(req.pagination!.page).toBe(DEFAULT_PAGE);
          expect(req.pagination!.limit).toBe(DEFAULT_PAGE_LIMIT);
          expect(next).toHaveBeenCalled();
          
          return true;
        }
      ),
      { numRuns: 36 }  // 6x6 combinations
    );
  });

  /**
   * **Feature: backend-refactoring, Property 3: Pagination returns correct subset**
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
   * 
   * For any page beyond the data, paginateArray returns empty array.
   */
  it('Property 3: paginateArray returns empty for page beyond data', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 1, maxLength: 100 }),  // items
        fc.integer({ min: 1, max: 50 }),  // limit
        (items, limit) => {
          // Calculate a page that's definitely beyond the data
          const totalPages = Math.ceil(items.length / limit);
          const beyondPage = totalPages + 1;
          
          const result = paginateArray(items, { page: beyondPage, limit });
          
          expect(result.length).toBe(0);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 3: Pagination returns correct subset**
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
   * 
   * Paginating all pages should return all items exactly once.
   */
  it('Property 3: Paginating all pages returns all items', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 200 }),  // items
        fc.integer({ min: 1, max: 50 }),  // limit
        (items, limit) => {
          const totalPages = Math.ceil(items.length / limit) || 1;
          const allPaginatedItems: number[] = [];
          
          for (let page = 1; page <= totalPages; page++) {
            const pageItems = paginateArray(items, { page, limit });
            allPaginatedItems.push(...pageItems);
          }
          
          // All items should be returned exactly once
          expect(allPaginatedItems.length).toBe(items.length);
          expect(allPaginatedItems).toEqual(items);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
