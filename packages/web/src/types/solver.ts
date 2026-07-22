import {
  parseOperationResponse,
  type OperationResponse,
  OperationAffectedEntity,
  OperationIssue,
} from './operation';

export interface TimetableData {
  schedule: unknown[];
  metadata: unknown;
  statistics: unknown;
  status?: 'success' | 'partial';
  quality_score?: QualityScore | null;
}

export interface SavedTimetableSummary {
  id: number;
  name: string;
  description: string;
  data: unknown;
  schoolId: number | null;
  academicYearId: number | null;
  termId: number | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedScheduleData {
  timetable: TimetableData;
  savedTimetable: SavedTimetableSummary;
}

export type SolverResponse = OperationResponse<GeneratedScheduleData>;
export type SolverErrorDetail = OperationIssue;
export type AffectedEntity = OperationAffectedEntity;

export type SolverGenerationPhase =
  | 'idle'
  | 'preparing'
  | 'analyzing'
  | 'validation'
  | 'modelBuilding'
  | 'solvingPhase1'
  | 'solvingPhase2'
  | 'formatting'
  | 'saving'
  | 'cancelling';

export type SolverRunOutcome = 'success' | 'partial' | 'failed' | 'cancelled';

export interface SolverLastRun {
  outcome: SolverRunOutcome;
  finishedAt: string;
  issueCode?: string;
  timetableId?: number;
}

export interface SolverStatus {
  isRunning: boolean;
  processId?: number;
  startedAt?: string;
  phase: SolverGenerationPhase;
  phaseFarsi?: string;
  strategy?: string;
  percentComplete?: number;
  estimatedSecondsRemaining?: number;
  canCancel: boolean;
  lastRun?: SolverLastRun;
}

interface QualityAffectedEntity {
  entity_type: OperationAffectedEntity['type'];
  entity_id: string;
  entity_name: string;
}

export interface QualityScore {
  overall: number;
  breakdown: QualityBreakdown;
  objective_results: ObjectiveResult[];
  suggestions: QualitySuggestion[];
}

export interface ObjectiveResult {
  key: string;
  strength: number;
  violation_units: number;
  opportunity_units: number;
  satisfaction_percent: number;
  affected_entities: QualityAffectedEntity[];
}

export interface QualityBreakdown {
  teacher_gaps: QualityMetric;
  afternoon_difficult_subjects: QualityMetric;
  same_day_subject_repetition: QualityMetric;
  teacher_load_balance: QualityMetric;
}

export interface QualityMetric {
  count: number;
  penalty: number;
  details: unknown[];
}

export interface QualitySuggestion {
  suggestion_code?: string;
  message_key?: string;
  message_params?: Record<string, unknown>;
  message_farsi?: string;
  message_english?: string;
  affected_entities: QualityAffectedEntity[];
  expected_improvement: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isQualityMetric(value: unknown): value is QualityMetric {
  return (
    isRecord(value) &&
    typeof value.count === 'number' &&
    typeof value.penalty === 'number' &&
    Array.isArray(value.details)
  );
}

function isQualityAffectedEntity(value: unknown): value is QualityAffectedEntity {
  return (
    isRecord(value) &&
    (value.entity_type === 'teacher' ||
      value.entity_type === 'class' ||
      value.entity_type === 'subject' ||
      value.entity_type === 'room') &&
    typeof value.entity_id === 'string' &&
    typeof value.entity_name === 'string'
  );
}

function isObjectiveResult(value: unknown): value is ObjectiveResult {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.strength === 'number' &&
    typeof value.violation_units === 'number' &&
    typeof value.opportunity_units === 'number' &&
    typeof value.satisfaction_percent === 'number' &&
    Array.isArray(value.affected_entities) &&
    value.affected_entities.every(isQualityAffectedEntity)
  );
}

function isQualitySuggestion(value: unknown): value is QualitySuggestion {
  return (
    isRecord(value) &&
    (value.suggestion_code === undefined || typeof value.suggestion_code === 'string') &&
    (value.message_key === undefined || typeof value.message_key === 'string') &&
    (value.message_params === undefined || isRecord(value.message_params)) &&
    (value.message_farsi === undefined || typeof value.message_farsi === 'string') &&
    (value.message_english === undefined || typeof value.message_english === 'string') &&
    Array.isArray(value.affected_entities) &&
    value.affected_entities.every(isQualityAffectedEntity) &&
    typeof value.expected_improvement === 'number'
  );
}

function isQualityScore(value: unknown): value is QualityScore {
  if (!isRecord(value) || !isRecord(value.breakdown)) return false;
  return (
    typeof value.overall === 'number' &&
    isQualityMetric(value.breakdown.teacher_gaps) &&
    isQualityMetric(value.breakdown.afternoon_difficult_subjects) &&
    isQualityMetric(value.breakdown.same_day_subject_repetition) &&
    isQualityMetric(value.breakdown.teacher_load_balance) &&
    Array.isArray(value.objective_results) &&
    value.objective_results.every(isObjectiveResult) &&
    Array.isArray(value.suggestions) &&
    value.suggestions.every(isQualitySuggestion)
  );
}

function isTimetableData(value: unknown): value is TimetableData {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.schedule) &&
    'metadata' in value &&
    'statistics' in value &&
    (value.status === undefined || value.status === 'success' || value.status === 'partial') &&
    (value.quality_score === undefined ||
      value.quality_score === null ||
      isQualityScore(value.quality_score))
  );
}

function isSavedTimetableSummary(value: unknown): value is SavedTimetableSummary {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    'data' in value &&
    isNullableNumber(value.schoolId) &&
    isNullableNumber(value.academicYearId) &&
    isNullableNumber(value.termId) &&
    typeof value.revision === 'number' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isGeneratedScheduleData(value: unknown): value is GeneratedScheduleData {
  return (
    isRecord(value) &&
    isTimetableData(value.timetable) &&
    isSavedTimetableSummary(value.savedTimetable)
  );
}

/**
 * Parse the operation envelope and enforce generation-specific data invariants.
 * Any failed operation is normalized to data:null, including responses from an
 * older API. Success and partial responses are accepted only with usable data.
 */
export function parseSolverResponse(value: unknown): SolverResponse | null {
  const operation = parseOperationResponse<unknown>(value);
  if (!operation) return null;

  if (operation.outcome === 'failed') {
    return { ...operation, data: null };
  }

  if (!isGeneratedScheduleData(operation.data)) return null;
  return operation as SolverResponse;
}

export type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor';

export function getQualityLevel(score: number): QualityLevel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

export function getQualityColorClass(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

export function getQualityBgClass(score: number): string {
  if (score >= 80) return 'bg-green-100';
  if (score >= 60) return 'bg-amber-100';
  return 'bg-red-100';
}
