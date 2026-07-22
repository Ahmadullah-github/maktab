export const OPERATION_CONTRACT_VERSION = 1 as const;

export type OperationOutcome = 'success' | 'partial' | 'failed';
export type IssueSeverity = 'error' | 'warning' | 'info';
export type IssueCategory =
  | 'configuration'
  | 'assignment'
  | 'teacher'
  | 'class'
  | 'subject'
  | 'room'
  | 'solver'
  | 'system';
export type IssuePhase =
  | 'request'
  | 'preparation'
  | 'analysis'
  | 'solving'
  | 'output_validation'
  | 'saving';
export type AffectedEntityType = 'teacher' | 'class' | 'subject' | 'room';
export type IssueMessageValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | Record<string, unknown>;

export interface OperationAffectedEntity {
  type: AffectedEntityType;
  id: string;
  name?: string;
}

export interface OperationFieldIssue {
  path: string;
  code: string;
  params?: Record<string, unknown>;
}

export interface OperationIssue {
  code: string;
  severity: IssueSeverity;
  category: IssueCategory;
  phase: IssuePhase;
  blocking: boolean;
  retryable: boolean;
  messageParams: Record<string, IssueMessageValue>;
  affectedEntities: OperationAffectedEntity[];
  fieldIssues?: OperationFieldIssue[];
}

export interface OperationResponse<T> {
  contractVersion: typeof OPERATION_CONTRACT_VERSION;
  outcome: OperationOutcome;
  data: T | null;
  issues: OperationIssue[];
  diagnosticId: string;
  metadata: Record<string, unknown>;
}

const CATEGORY_BY_CODE: Record<string, IssueCategory> = {
  ASSIGNMENT_READINESS_FAILED: 'assignment',
  CLASS_PERIOD_SHORTAGE: 'class',
  EMPTY_PERIODS_ERROR: 'class',
  INVALID_GENERATED_PERIOD_BOUNDS: 'configuration',
  INVALID_GENERATED_TIMETABLE: 'solver',
  MISSING_ROOM_TYPE: 'room',
  NO_CLASSES: 'class',
  NO_FEASIBLE_SOLUTION: 'solver',
  NO_QUALIFIED_TEACHER: 'teacher',
  NO_ROOMS: 'room',
  NO_SUBJECTS: 'subject',
  NO_TEACHERS: 'teacher',
  NO_VALID_RESOURCES: 'assignment',
  OVER_ALLOCATION_ERROR: 'class',
  PERIOD_CONFIG_MISSING_DAY: 'configuration',
  PERIOD_CONFIG_OUT_OF_RANGE: 'configuration',
  ROOM_CAPACITY_WARNING: 'room',
  ROOM_CONFLICT: 'room',
  SUBJECT_CONSECUTIVE_WARNING: 'subject',
  SUBJECT_DAILY_LIMIT_INFEASIBLE: 'subject',
  SUBJECT_DISTRIBUTION_WARNING: 'subject',
  TEACHER_AVAILABILITY_CONFLICT: 'teacher',
  TEACHER_OVERLOAD: 'teacher',
  TEACHER_OVERLOAD_PREDICTED: 'teacher',
  TOTAL_PERIODS_MISMATCH: 'configuration',
  VALIDATION_ERROR: 'configuration',
};

const RETRYABLE_CODES = new Set(['SOLVER_TIMEOUT', 'SOLVER_BUSY']);
const ISSUE_CATEGORIES = new Set<IssueCategory>([
  'configuration',
  'assignment',
  'teacher',
  'class',
  'subject',
  'room',
  'solver',
  'system',
]);
const ISSUE_PHASES = new Set<IssuePhase>([
  'request',
  'preparation',
  'analysis',
  'solving',
  'output_validation',
  'saving',
]);

function inferCategory(code: string): IssueCategory {
  const known = CATEGORY_BY_CODE[code];
  if (known) return known;
  if (code.startsWith('TEACHER_')) return 'teacher';
  if (code.startsWith('CLASS_')) return 'class';
  if (code.startsWith('SUBJECT_')) return 'subject';
  if (code.startsWith('ROOM_') || code.startsWith('MISSING_ROOM')) return 'room';
  if (code.startsWith('ASSIGNMENT_')) return 'assignment';
  if (code.startsWith('SOLVER_') || code === 'NO_FEASIBLE_SOLUTION') return 'solver';
  if (
    code === 'INTERNAL_ERROR' ||
    code === 'ANALYSIS_ERROR' ||
    code === 'TIMETABLE_SAVE_ERROR'
  )
    return 'system';
  return 'configuration';
}

export function createOperationIssue(
  code: string,
  phase: IssuePhase,
  options: Partial<Omit<OperationIssue, 'code' | 'phase'>> = {}
): OperationIssue {
  const severity = options.severity ?? 'error';
  return {
    code,
    severity,
    category: options.category ?? inferCategory(code),
    phase,
    blocking: options.blocking ?? severity === 'error',
    retryable: options.retryable ?? RETRYABLE_CODES.has(code),
    messageParams: options.messageParams ?? {},
    affectedEntities: options.affectedEntities ?? [],
    ...(options.fieldIssues ? { fieldIssues: options.fieldIssues } : {}),
  };
}

export function createOperationResponse<T>(
  outcome: OperationOutcome,
  diagnosticId: string,
  options: {
    data?: T | null;
    issues?: OperationIssue[];
    metadata?: Record<string, unknown>;
  } = {}
): OperationResponse<T> {
  return {
    contractVersion: OPERATION_CONTRACT_VERSION,
    outcome,
    // A rejected operation may carry structured issues and metadata, but never
    // domain success data. This invariant keeps every consumer from having to
    // guess whether a failed payload is safe to render as a result.
    data: outcome === 'failed' ? null : (options.data ?? null),
    issues: options.issues ?? [],
    diagnosticId,
    metadata: options.metadata ?? {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isAffectedEntity(value: unknown): value is OperationAffectedEntity {
  if (!isRecord(value)) return false;
  return (
    (value.type === 'teacher' ||
      value.type === 'class' ||
      value.type === 'subject' ||
      value.type === 'room') &&
    typeof value.id === 'string' &&
    (value.name === undefined || typeof value.name === 'string')
  );
}

function isFieldIssue(value: unknown): value is OperationFieldIssue {
  return (
    isRecord(value) &&
    typeof value.path === 'string' &&
    typeof value.code === 'string' &&
    (value.params === undefined || isRecord(value.params))
  );
}

function isIssue(value: unknown): value is OperationIssue {
  if (!isRecord(value)) return false;
  return (
    typeof value.code === 'string' &&
    (value.severity === 'error' || value.severity === 'warning' || value.severity === 'info') &&
    ISSUE_CATEGORIES.has(value.category as IssueCategory) &&
    ISSUE_PHASES.has(value.phase as IssuePhase) &&
    typeof value.blocking === 'boolean' &&
    typeof value.retryable === 'boolean' &&
    isRecord(value.messageParams) &&
    Array.isArray(value.affectedEntities) &&
    value.affectedEntities.every(isAffectedEntity) &&
    (value.fieldIssues === undefined ||
      (Array.isArray(value.fieldIssues) && value.fieldIssues.every(isFieldIssue)))
  );
}

export function isOperationResponse<T = unknown>(value: unknown): value is OperationResponse<T> {
  if (!isRecord(value)) return false;
  return (
    value.contractVersion === OPERATION_CONTRACT_VERSION &&
    (value.outcome === 'success' || value.outcome === 'partial' || value.outcome === 'failed') &&
    'data' in value &&
    Array.isArray(value.issues) &&
    value.issues.every(isIssue) &&
    typeof value.diagnosticId === 'string' &&
    isRecord(value.metadata)
  );
}

export function withDiagnosticId<T>(
  response: OperationResponse<T>,
  diagnosticId: string
): OperationResponse<T> {
  return { ...response, diagnosticId };
}
