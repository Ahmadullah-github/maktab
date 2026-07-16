/**
 * Common types and interfaces shared across the API package
 * @module types/common
 */

/**
 * Parameters for paginated queries
 */
export interface PaginationParams {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  limit: number;
}

/**
 * Standard paginated response wrapper
 */
export interface PaginatedResponse<T> {
  /** Array of items for the current page */
  data: T[];
  /** Total number of items across all pages */
  total: number;
  /** Current page number */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Configuration for cache behavior
 */
export interface CacheConfig {
  /** Maximum number of entries in the cache */
  maxSize: number;
  /** Time-to-live in milliseconds */
  ttlMs: number;
}

/**
 * Standard service operation result wrapper
 */
export interface ServiceResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data (present on success) */
  data?: T;
  /** Error message (present on failure) */
  error?: string;
  /** HTTP-oriented error metadata used by route adapters. */
  statusCode?: number;
  code?: string;
  details?: unknown;
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    /** Error code for programmatic handling */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Field-level validation errors */
    details?: Record<string, string[]>;
  };
}

/**
 * Request context for logging
 */
export interface RequestContext {
  /** Unique request identifier */
  requestId?: string;
  /** HTTP method */
  method?: string;
  /** Request path */
  path?: string;
  /** User or session identifier */
  userId?: string;
}
