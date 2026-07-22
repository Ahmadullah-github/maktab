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
  messageParams: Record<string, unknown>;
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

function isOperationIssue(value: unknown): value is OperationIssue {
  if (!isRecord(value)) return false;
  const categories: IssueCategory[] = [
    'configuration',
    'assignment',
    'teacher',
    'class',
    'subject',
    'room',
    'solver',
    'system',
  ];
  const phases: IssuePhase[] = [
    'request',
    'preparation',
    'analysis',
    'solving',
    'output_validation',
    'saving',
  ];

  return (
    typeof value.code === 'string' &&
    (value.severity === 'error' || value.severity === 'warning' || value.severity === 'info') &&
    categories.includes(value.category as IssueCategory) &&
    phases.includes(value.phase as IssuePhase) &&
    typeof value.blocking === 'boolean' &&
    typeof value.retryable === 'boolean' &&
    isRecord(value.messageParams) &&
    Array.isArray(value.affectedEntities) &&
    value.affectedEntities.every(isAffectedEntity) &&
    (value.fieldIssues === undefined ||
      (Array.isArray(value.fieldIssues) && value.fieldIssues.every(isFieldIssue)))
  );
}

export function parseOperationResponse<T = unknown>(value: unknown): OperationResponse<T> | null {
  if (!isRecord(value)) return null;
  if (
    value.contractVersion !== OPERATION_CONTRACT_VERSION ||
    (value.outcome !== 'success' && value.outcome !== 'partial' && value.outcome !== 'failed') ||
    !('data' in value) ||
    !Array.isArray(value.issues) ||
    !value.issues.every(isOperationIssue) ||
    typeof value.diagnosticId !== 'string' ||
    !isRecord(value.metadata)
  ) {
    return null;
  }

  return value as unknown as OperationResponse<T>;
}

export function createClientIssue(code: string, retryable = false): OperationIssue {
  return {
    code,
    severity: 'error',
    category: 'system',
    phase: 'request',
    blocking: true,
    retryable,
    messageParams: {},
    affectedEntities: [],
  };
}
