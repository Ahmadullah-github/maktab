import type {
  IssueCategory,
  OperationAffectedEntity,
  OperationIssue,
} from '@/types/operation';

export type IssueActionType =
  | 'edit_teacher'
  | 'add_teacher'
  | 'edit_class'
  | 'add_class'
  | 'edit_subject'
  | 'add_subject'
  | 'edit_room'
  | 'add_room'
  | 'edit_assignments'
  | 'edit_config';

export interface IssueAction {
  type: IssueActionType;
  labelKey: string;
  entity?: OperationAffectedEntity;
}

const PRIORITY_BY_CODE: Record<string, number> = {
  VALIDATION_ERROR: 10,
  ASSIGNMENT_READINESS_FAILED: 19,
  ASSIGNMENT_NOT_LOCKED: 20,
  ASSIGNMENT_PERIOD_MISMATCH: 21,
  TEACHER_SUBJECT_CAPABILITY_MISSING: 22,
  NO_TEACHERS: 30,
  NO_CLASSES: 31,
  NO_SUBJECTS: 32,
  NO_ROOMS: 33,
  TEACHER_OVERLOAD: 40,
  TEACHER_OVERLOAD_PREDICTED: 41,
  NO_QUALIFIED_TEACHER: 42,
  NO_VALID_RESOURCES: 43,
  CLASS_PERIOD_SHORTAGE: 50,
  EMPTY_PERIODS_ERROR: 51,
  OVER_ALLOCATION_ERROR: 52,
  MISSING_ROOM_TYPE: 60,
  FIXED_ROOM_INCOMPATIBLE: 61,
  ROOM_CONFLICT: 62,
  NO_FEASIBLE_SOLUTION: 80,
  SOLVER_TIMEOUT: 90,
  SOLVER_BUSY: 91,
  INTERNAL_ERROR: 100,
  CLIENT_NETWORK_ERROR: 101,
  CLIENT_PROTOCOL_ERROR: 102,
};

const ACTION_BY_CODE: Record<string, Omit<IssueAction, 'entity'>> = {
  ASSIGNMENT_READINESS_FAILED: {
    type: 'edit_assignments',
    labelKey: 'errors.actions.editAssignments',
  },
  ASSIGNMENT_NOT_LOCKED: { type: 'edit_assignments', labelKey: 'errors.actions.editAssignments' },
  ASSIGNMENT_PERIOD_MISMATCH: {
    type: 'edit_assignments',
    labelKey: 'errors.actions.editAssignments',
  },
  TEACHER_SUBJECT_CAPABILITY_MISSING: {
    type: 'edit_assignments',
    labelKey: 'errors.actions.editAssignments',
  },
  CLASS_GRADE_INVALID: { type: 'edit_class', labelKey: 'errors.actions.editClass' },
  CLASS_TEACHER_MISSING: { type: 'edit_class', labelKey: 'errors.actions.editClass' },
  PRIMARY_CLASS_TEACHER_MISMATCH: {
    type: 'edit_assignments',
    labelKey: 'errors.actions.editAssignments',
  },
  CLASS_TEACHER_NOT_ASSIGNED: {
    type: 'edit_assignments',
    labelKey: 'errors.actions.editAssignments',
  },
  TEACHER_OVERLOAD: { type: 'edit_teacher', labelKey: 'errors.actions.editTeacher' },
  TEACHER_OVERLOAD_PREDICTED: {
    type: 'edit_teacher',
    labelKey: 'errors.actions.editTeacher',
  },
  TEACHER_AVAILABILITY_CONFLICT: {
    type: 'edit_teacher',
    labelKey: 'errors.actions.editTeacher',
  },
  NO_QUALIFIED_TEACHER: { type: 'add_teacher', labelKey: 'errors.actions.addTeacher' },
  NO_VALID_RESOURCES: {
    type: 'edit_assignments',
    labelKey: 'errors.actions.editAssignments',
  },
  NO_TEACHERS: { type: 'add_teacher', labelKey: 'errors.actions.addTeacher' },
  CLASS_PERIOD_SHORTAGE: { type: 'edit_class', labelKey: 'errors.actions.editClass' },
  EMPTY_PERIODS_ERROR: { type: 'edit_class', labelKey: 'errors.actions.editClass' },
  OVER_ALLOCATION_ERROR: { type: 'edit_class', labelKey: 'errors.actions.editClass' },
  CLASS_NO_SUBJECTS: { type: 'edit_class', labelKey: 'errors.actions.editClass' },
  NO_CLASSES: { type: 'add_class', labelKey: 'errors.actions.addClass' },
  NO_SUBJECTS: { type: 'add_subject', labelKey: 'errors.actions.addSubject' },
  MISSING_ROOM_TYPE: { type: 'add_room', labelKey: 'errors.actions.addRoom' },
  FIXED_ROOM_INCOMPATIBLE: { type: 'edit_room', labelKey: 'errors.actions.editRoom' },
  ROOM_CONFLICT: { type: 'edit_room', labelKey: 'errors.actions.editRoom' },
  NO_ROOMS: { type: 'add_room', labelKey: 'errors.actions.addRoom' },
  INVALID_CATEGORY: { type: 'edit_config', labelKey: 'errors.actions.editConfig' },
  PERIOD_CONFIG_MISSING_DAY: { type: 'edit_config', labelKey: 'errors.actions.editConfig' },
  PERIOD_CONFIG_OUT_OF_RANGE: { type: 'edit_config', labelKey: 'errors.actions.editConfig' },
  TOTAL_PERIODS_MISMATCH: { type: 'edit_config', labelKey: 'errors.actions.editConfig' },
  SCHOOL_CONFIG_CORRUPT: { type: 'edit_config', labelKey: 'errors.actions.editConfig' },
};

const CATEGORY_ORDER: IssueCategory[] = [
  'assignment',
  'teacher',
  'class',
  'subject',
  'room',
  'configuration',
  'solver',
  'system',
];

export function issueTitleKey(code: string): string {
  return `errors.codes.${code}.title`;
}

export function issueDescriptionKey(code: string): string {
  return `errors.codes.${code}.description`;
}

export function categoryLabelKey(category: IssueCategory): string {
  return `errors.categories.${category}`;
}

export function getIssueAction(issue: OperationIssue): IssueAction | null {
  const action = ACTION_BY_CODE[issue.code];
  if (!action) return null;
  const preferredType = action.type.includes('teacher')
    ? 'teacher'
    : action.type.includes('class')
      ? 'class'
      : action.type.includes('subject')
        ? 'subject'
        : action.type.includes('room')
          ? 'room'
          : undefined;
  const entity = issue.affectedEntities.find((item) => item.type === preferredType);
  return { ...action, entity };
}

function priority(issue: OperationIssue): number {
  return PRIORITY_BY_CODE[issue.code] ?? 70;
}

export function prioritizeIssues(issues: OperationIssue[]): OperationIssue[] {
  const unique = new Map<string, OperationIssue>();
  for (const issue of issues) {
    const entities = issue.affectedEntities.map((entity) => `${entity.type}:${entity.id}`).join(',');
    const key = `${issue.code}:${entities}:${JSON.stringify(issue.messageParams)}`;
    if (!unique.has(key)) unique.set(key, issue);
  }

  return [...unique.values()].sort((left, right) => {
    if (left.blocking !== right.blocking) return left.blocking ? -1 : 1;
    const codeOrder = priority(left) - priority(right);
    if (codeOrder !== 0) return codeOrder;
    return left.code.localeCompare(right.code);
  });
}

export function groupIssues(issues: OperationIssue[]): Array<{
  category: IssueCategory;
  issues: OperationIssue[];
}> {
  const prioritized = prioritizeIssues(issues);
  return CATEGORY_ORDER.map((category) => ({
    category,
    issues: prioritized.filter((issue) => issue.category === category),
  })).filter((group) => group.issues.length > 0);
}
