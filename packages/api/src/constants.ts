/**
 * Application constants and configuration defaults
 * @module constants
 */

// =============================================================================
// Server Configuration
// =============================================================================

/** Default server port */
export const DEFAULT_PORT = 4000;

/** Maximum JSON body size for requests */
export const MAX_JSON_BODY_SIZE = '10mb';

// =============================================================================
// Pagination Defaults
// =============================================================================

/** Default page number when not specified */
export const DEFAULT_PAGE = 1;

/** Default number of items per page */
export const DEFAULT_PAGE_LIMIT = 50;

/** Maximum allowed items per page */
export const MAX_PAGE_LIMIT = 100;

// =============================================================================
// Cache Configuration
// =============================================================================

/** Default maximum cache entries per entity type */
export const DEFAULT_CACHE_MAX_SIZE = 1000;

/** Default cache TTL in milliseconds (5 minutes) */
export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Cache prefixes for different entity types */
export const CACHE_PREFIXES = {
  TEACHER: 'teacher',
  SUBJECT: 'subject',
  ROOM: 'room',
  CLASS: 'class',
  TIMETABLE: 'timetable',
  CONFIG: 'config',
  WIZARD: 'wizard',
  LICENSE: 'license',
} as const;

// =============================================================================
// Solver Configuration
// =============================================================================

/** Default solver timeout in milliseconds (15 minutes) */
export const DEFAULT_SOLVER_TIMEOUT_MS = 15 * 60 * 1000;

/** Maximum data size before writing to temp file (1MB) */
export const SOLVER_MAX_STDIN_SIZE_BYTES = 1 * 1024 * 1024;

/** Solver script filename */
export const SOLVER_SCRIPT_NAME = 'solver_enhanced.py';

/** Solver executable filename (production) */
export const SOLVER_EXE_NAME = 'solver_enhanced.exe';

// =============================================================================
// Error Codes
// =============================================================================

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  SOLVER_BUSY: 'SOLVER_BUSY',
  SOLVER_TIMEOUT: 'SOLVER_TIMEOUT',
  SOLVER_NOT_FOUND: 'SOLVER_NOT_FOUND',
  SOLVER_SPAWN_ERROR: 'SOLVER_SPAWN_ERROR',
  SOLVER_RUNTIME_ERROR: 'SOLVER_RUNTIME_ERROR',
  SOLVER_EMPTY_OUTPUT: 'SOLVER_EMPTY_OUTPUT',
  SOLVER_PARSE_ERROR: 'SOLVER_PARSE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// =============================================================================
// HTTP Status Codes
// =============================================================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// =============================================================================
// Logging Configuration
// =============================================================================

/** Log levels in order of severity */
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

/** Default log level for production */
export const DEFAULT_PRODUCTION_LOG_LEVEL = 'INFO';

/** Default log level for development */
export const DEFAULT_DEVELOPMENT_LOG_LEVEL = 'DEBUG';

// =============================================================================
// Database Configuration
// =============================================================================

/** Default batch size for bulk operations */
export const DEFAULT_BATCH_SIZE = 100;

/** Transaction timeout in milliseconds */
export const TRANSACTION_TIMEOUT_MS = 30 * 1000;
