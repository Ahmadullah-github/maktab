/**
 * Pagination middleware for parsing and validating pagination query parameters
 * @module middleware/pagination
 * 
 * Requirements: 6.6, 6.7
 * - Parse page and limit query parameters
 * - Apply defaults (page=1, limit=50) when not provided
 * - Cap limit at 100 to prevent excessive data transfer
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { PaginationParams } from '../types/common.types';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../constants';

/**
 * Extends Express Request to include pagination params
 */
declare global {
  namespace Express {
    interface Request {
      pagination?: PaginationParams;
    }
  }
}

/**
 * Parses a string value to a positive integer
 * @param value - String value to parse
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed integer or default value
 */
function parsePositiveInt(value: unknown, defaultValue: number): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  
  const parsed = parseInt(String(value), 10);
  
  if (isNaN(parsed) || parsed < 1) {
    return defaultValue;
  }
  
  return parsed;
}

/**
 * Middleware that parses pagination query parameters and attaches them to the request
 * 
 * @example
 * ```typescript
 * router.get('/', paginationMiddleware, async (req, res) => {
 *   const { page, limit } = req.pagination!;
 *   // Use pagination params
 * });
 * ```
 */
export const paginationMiddleware: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
  let limit = parsePositiveInt(req.query.limit, DEFAULT_PAGE_LIMIT);
  
  // Cap limit at maximum allowed value (Requirement 6.7)
  if (limit > MAX_PAGE_LIMIT) {
    limit = MAX_PAGE_LIMIT;
  }
  
  req.pagination = { page, limit };
  next();
};

/**
 * Helper function to paginate an array of items
 * Used for in-memory pagination when data is already loaded
 * 
 * @param items - Array of items to paginate
 * @param params - Pagination parameters
 * @returns Paginated subset of items
 */
export function paginateArray<T>(items: T[], params: PaginationParams): T[] {
  const { page, limit } = params;
  const startIndex = (page - 1) * limit;
  return items.slice(startIndex, startIndex + limit);
}

/**
 * Calculates pagination metadata
 * 
 * @param total - Total number of items
 * @param params - Pagination parameters
 * @returns Pagination metadata including total pages
 */
export function calculatePaginationMeta(total: number, params: PaginationParams): {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} {
  const { page, limit } = params;
  const totalPages = Math.ceil(total / limit) || 1;
  
  return {
    total,
    page,
    limit,
    totalPages,
  };
}
