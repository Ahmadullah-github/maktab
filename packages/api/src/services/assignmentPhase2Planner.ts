export type CapabilityLevel = 'primary' | 'allowed';
export type PlanIssueSeverity = 'info' | 'warning' | 'error';

export interface LegacyTeacherAssignmentMirror {
  subjectId: number;
  classIds: number[];
}

export interface LegacySubjectRequirementMirror {
  subjectId: number;
  periodsPerWeek: number;
  teacherId?: number | null;
}

export interface LegacyTeacherSnapshot {
  id: number;
  fullName: string;
  isDeleted: boolean;
  primarySubjectIds: number[];
  allowedSubjectIds: number[];
  classAssignments: LegacyTeacherAssignmentMirror[];
}

export interface LegacyClassSnapshot {
  id: number;
  name: string;
  isDeleted: boolean;
  subjectRequirements: LegacySubjectRequirementMirror[];
}

export interface LegacySubjectSnapshot {
  id: number;
  name: string;
  isDeleted: boolean;
  periodsPerWeek: number | null;
}

export interface LegacyNormalizedAssignmentSnapshot {
  id: number;
  teacherId: number;
  classId: number;
  subjectId: number;
  periodsPerWeek: number;
  isFixed: boolean;
  isDeleted: boolean;
}

export interface Phase2PlannerInput {
  teachers: LegacyTeacherSnapshot[];
  classes: LegacyClassSnapshot[];
  subjects: LegacySubjectSnapshot[];
  normalizedAssignments: LegacyNormalizedAssignmentSnapshot[];
}

export interface CanonicalRequirementPlanRow {
  classId: number;
  subjectId: number;
  requiredPeriodsPerWeek: number;
  allowSplitAssignment: boolean;
  derivation:
    | 'class_requirement'
    | 'assignment_total'
    | 'subject_default'
    | 'subject_default_for_teacher_mirror';
}

export interface CanonicalCapabilityPlanRow {
  teacherId: number;
  subjectId: number;
  capabilityLevel: CapabilityLevel;
  derivation:
    | 'legacy_primary'
    | 'legacy_allowed'
    | 'normalized_assignment_inferred'
    | 'teacher_mirror_inferred';
}

export interface CanonicalAssignmentPlanRow {
  classId: number;
  subjectId: number;
  teacherId: number;
  assignedPeriodsPerWeek: number;
  isFixed: boolean;
  source: 'migration';
  derivation:
    | 'normalized_assignment'
    | 'class_requirement_teacher'
    | 'teacher_class_assignment';
}

export interface CanonicalRequirementSnapshotRow {
  id: number;
  classId: number;
  subjectId: number;
  requiredPeriodsPerWeek: number;
  allowSplitAssignment: boolean;
}

export interface CanonicalCapabilitySnapshotRow {
  id: number;
  teacherId: number;
  subjectId: number;
  capabilityLevel: CapabilityLevel;
}

export interface CanonicalAssignmentSnapshotRow {
  id: number;
  classId: number;
  subjectId: number;
  teacherId: number;
  assignedPeriodsPerWeek: number;
  isFixed: boolean;
  source: string;
}

export interface CanonicalSnapshot {
  requirements: CanonicalRequirementSnapshotRow[];
  capabilities: CanonicalCapabilitySnapshotRow[];
  assignments: CanonicalAssignmentSnapshotRow[];
}

export interface Phase2PlanIssue {
  code: string;
  severity: PlanIssueSeverity;
  message: string;
  classId?: number;
  subjectId?: number;
  teacherId?: number;
  normalizedAssignmentId?: number;
  details?: Record<string, unknown>;
}

export interface Phase2BackfillPlan {
  requirements: CanonicalRequirementPlanRow[];
  capabilities: CanonicalCapabilityPlanRow[];
  assignments: CanonicalAssignmentPlanRow[];
  issues: Phase2PlanIssue[];
  summary: {
    requirementCount: number;
    capabilityCount: number;
    assignmentCount: number;
    issueCount: number;
    warningCount: number;
    errorCount: number;
  };
}

export interface IntegrityDrift {
  key: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

export interface IntegrityReport {
  expected: Phase2BackfillPlan['summary'];
  actual: {
    requirementCount: number;
    capabilityCount: number;
    assignmentCount: number;
  };
  missingRequirements: IntegrityDrift[];
  mismatchedRequirements: IntegrityDrift[];
  unexpectedRequirements: IntegrityDrift[];
  missingCapabilities: IntegrityDrift[];
  mismatchedCapabilities: IntegrityDrift[];
  unexpectedCapabilities: IntegrityDrift[];
  missingAssignments: IntegrityDrift[];
  mismatchedAssignments: IntegrityDrift[];
  unexpectedAssignments: IntegrityDrift[];
}

interface PairAggregate {
  classId: number;
  subjectId: number;
  classRequirement?: LegacySubjectRequirementMirror;
  teacherMirrorTeacherIds: Set<number>;
  normalizedAssignments: LegacyNormalizedAssignmentSnapshot[];
}

const pairKey = (classId: number, subjectId: number): string => `${classId}:${subjectId}`;
const capabilityKey = (teacherId: number, subjectId: number): string => `${teacherId}:${subjectId}`;
const assignmentKey = (classId: number, subjectId: number, teacherId: number): string =>
  `${classId}:${subjectId}:${teacherId}`;

function toPositiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function dedupeSortedNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function issueCounts(issues: Phase2PlanIssue[]): Phase2BackfillPlan['summary'] {
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;

  return {
    requirementCount: 0,
    capabilityCount: 0,
    assignmentCount: 0,
    issueCount: issues.length,
    warningCount,
    errorCount,
  };
}

export function buildPhase2BackfillPlan(input: Phase2PlannerInput): Phase2BackfillPlan {
  const issues: Phase2PlanIssue[] = [];

  const activeTeachers = input.teachers.filter((teacher) => !teacher.isDeleted);
  const activeClasses = input.classes.filter((classGroup) => !classGroup.isDeleted);
  const activeSubjects = input.subjects.filter((subject) => !subject.isDeleted);
  const activeNormalizedAssignments = input.normalizedAssignments.filter(
    (assignment) => !assignment.isDeleted
  );

  const teacherMap = new Map(activeTeachers.map((teacher) => [teacher.id, teacher]));
  const classMap = new Map(activeClasses.map((classGroup) => [classGroup.id, classGroup]));
  const subjectMap = new Map(activeSubjects.map((subject) => [subject.id, subject]));

  const pairMap = new Map<string, PairAggregate>();

  const getPairAggregate = (classId: number, subjectId: number): PairAggregate => {
    const key = pairKey(classId, subjectId);
    const existing = pairMap.get(key);
    if (existing) {
      return existing;
    }

    const created: PairAggregate = {
      classId,
      subjectId,
      teacherMirrorTeacherIds: new Set<number>(),
      normalizedAssignments: [],
    };
    pairMap.set(key, created);
    return created;
  };

  for (const classGroup of activeClasses) {
    for (const requirement of classGroup.subjectRequirements) {
      const subjectId = toPositiveInteger(requirement.subjectId);
      const periodsPerWeek = toPositiveInteger(requirement.periodsPerWeek);

      if (!subjectId) {
        issues.push({
          code: 'invalid_class_requirement_subject',
          severity: 'error',
          classId: classGroup.id,
          message: 'Class subject requirement contains an invalid subjectId.',
          details: { requirement },
        });
        continue;
      }

      if (!subjectMap.has(subjectId)) {
        issues.push({
          code: 'class_requirement_subject_missing',
          severity: 'error',
          classId: classGroup.id,
          subjectId,
          message: 'Class subject requirement references a missing or deleted subject.',
        });
        continue;
      }

      if (!periodsPerWeek) {
        issues.push({
          code: 'class_requirement_periods_invalid',
          severity: 'error',
          classId: classGroup.id,
          subjectId,
          message: 'Class subject requirement must have positive periods per week.',
          details: { requirement },
        });
        continue;
      }

      const aggregate = getPairAggregate(classGroup.id, subjectId);
      aggregate.classRequirement = {
        subjectId,
        periodsPerWeek,
        teacherId: toPositiveInteger(requirement.teacherId) ?? null,
      };
    }
  }

  for (const assignment of activeNormalizedAssignments) {
    if (!teacherMap.has(assignment.teacherId)) {
      issues.push({
        code: 'normalized_assignment_teacher_missing',
        severity: 'error',
        teacherId: assignment.teacherId,
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        normalizedAssignmentId: assignment.id,
        message: 'Normalized assignment references a missing or deleted teacher.',
      });
      continue;
    }

    if (!classMap.has(assignment.classId)) {
      issues.push({
        code: 'normalized_assignment_class_missing',
        severity: 'error',
        teacherId: assignment.teacherId,
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        normalizedAssignmentId: assignment.id,
        message: 'Normalized assignment references a missing or deleted class.',
      });
      continue;
    }

    if (!subjectMap.has(assignment.subjectId)) {
      issues.push({
        code: 'normalized_assignment_subject_missing',
        severity: 'error',
        teacherId: assignment.teacherId,
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        normalizedAssignmentId: assignment.id,
        message: 'Normalized assignment references a missing or deleted subject.',
      });
      continue;
    }

    const periodsPerWeek = toPositiveInteger(assignment.periodsPerWeek);
    if (!periodsPerWeek) {
      issues.push({
        code: 'normalized_assignment_periods_invalid',
        severity: 'error',
        teacherId: assignment.teacherId,
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        normalizedAssignmentId: assignment.id,
        message: 'Normalized assignment must have positive periods per week.',
      });
      continue;
    }

    const aggregate = getPairAggregate(assignment.classId, assignment.subjectId);
    aggregate.normalizedAssignments.push({
      ...assignment,
      periodsPerWeek,
    });
  }

  for (const teacher of activeTeachers) {
    for (const assignment of teacher.classAssignments) {
      const subjectId = toPositiveInteger(assignment.subjectId);
      if (!subjectId) {
        issues.push({
          code: 'teacher_mirror_subject_invalid',
          severity: 'error',
          teacherId: teacher.id,
          message: 'Teacher classAssignments contains an invalid subjectId.',
          details: { assignment },
        });
        continue;
      }

      if (!subjectMap.has(subjectId)) {
        issues.push({
          code: 'teacher_mirror_subject_missing',
          severity: 'error',
          teacherId: teacher.id,
          subjectId,
          message: 'Teacher classAssignments references a missing or deleted subject.',
        });
        continue;
      }

      const normalizedClassIds = dedupeSortedNumbers(
        assignment.classIds
          .map((classId) => toPositiveInteger(classId))
          .filter((classId): classId is number => classId !== null)
      );

      for (const classId of normalizedClassIds) {
        if (!classMap.has(classId)) {
          issues.push({
            code: 'teacher_mirror_class_missing',
            severity: 'error',
            teacherId: teacher.id,
            classId,
            subjectId,
            message: 'Teacher classAssignments references a missing or deleted class.',
          });
          continue;
        }

        const aggregate = getPairAggregate(classId, subjectId);
        aggregate.teacherMirrorTeacherIds.add(teacher.id);
      }
    }
  }

  const requirementRows: CanonicalRequirementPlanRow[] = [];
  const assignmentRows: CanonicalAssignmentPlanRow[] = [];
  const capabilityRows = new Map<string, CanonicalCapabilityPlanRow>();

  const addCapability = (row: CanonicalCapabilityPlanRow): void => {
    const key = capabilityKey(row.teacherId, row.subjectId);
    const existing = capabilityRows.get(key);

    if (!existing) {
      capabilityRows.set(key, row);
      return;
    }

    if (existing.capabilityLevel === 'allowed' && row.capabilityLevel === 'primary') {
      capabilityRows.set(key, row);
    }
  };

  for (const teacher of activeTeachers) {
    const duplicateLegacySubjects = new Set<number>();

    for (const subjectId of teacher.primarySubjectIds) {
      if (!subjectMap.has(subjectId)) {
        issues.push({
          code: 'teacher_primary_subject_missing',
          severity: 'warning',
          teacherId: teacher.id,
          subjectId,
          message: 'Teacher primary subject references a missing or deleted subject.',
        });
        continue;
      }

      addCapability({
        teacherId: teacher.id,
        subjectId,
        capabilityLevel: 'primary',
        derivation: 'legacy_primary',
      });
      duplicateLegacySubjects.add(subjectId);
    }

    for (const subjectId of teacher.allowedSubjectIds) {
      if (!subjectMap.has(subjectId)) {
        issues.push({
          code: 'teacher_allowed_subject_missing',
          severity: 'warning',
          teacherId: teacher.id,
          subjectId,
          message: 'Teacher allowed subject references a missing or deleted subject.',
        });
        continue;
      }

      if (duplicateLegacySubjects.has(subjectId)) {
        issues.push({
          code: 'teacher_capability_declared_twice',
          severity: 'warning',
          teacherId: teacher.id,
          subjectId,
          message:
            'Teacher subject capability is declared in both primary and allowed lists. Primary wins.',
        });
      }

      addCapability({
        teacherId: teacher.id,
        subjectId,
        capabilityLevel: 'allowed',
        derivation: 'legacy_allowed',
      });
    }
  }

  for (const aggregate of [...pairMap.values()].sort((left, right) => {
    if (left.classId !== right.classId) {
      return left.classId - right.classId;
    }
    return left.subjectId - right.subjectId;
  })) {
    const classGroup = classMap.get(aggregate.classId);
    const subject = subjectMap.get(aggregate.subjectId);

    if (!classGroup || !subject) {
      continue;
    }

    const normalizedTeacherIds = dedupeSortedNumbers(
      aggregate.normalizedAssignments.map((assignment) => assignment.teacherId)
    );
    const teacherMirrorTeacherIds = dedupeSortedNumbers([...aggregate.teacherMirrorTeacherIds]);

    const totalNormalizedPeriods = aggregate.normalizedAssignments.reduce(
      (sum, assignment) => sum + assignment.periodsPerWeek,
      0
    );

    let requiredPeriodsPerWeek: number | null = null;
    let derivation: CanonicalRequirementPlanRow['derivation'] = 'class_requirement';

    if (aggregate.classRequirement) {
      requiredPeriodsPerWeek = aggregate.classRequirement.periodsPerWeek;
      derivation = 'class_requirement';
    } else if (totalNormalizedPeriods > 0) {
      requiredPeriodsPerWeek = totalNormalizedPeriods;
      derivation = 'assignment_total';
      issues.push({
        code: 'requirement_inferred_from_normalized_assignment',
        severity: 'warning',
        classId: aggregate.classId,
        subjectId: aggregate.subjectId,
        message:
          'Class requirement row was missing, so required periods were inferred from normalized assignments.',
        details: { totalNormalizedPeriods },
      });
    } else if ((subject.periodsPerWeek ?? 0) > 0) {
      requiredPeriodsPerWeek = subject.periodsPerWeek;
      derivation =
        teacherMirrorTeacherIds.length > 0
          ? 'subject_default_for_teacher_mirror'
          : 'subject_default';
      issues.push({
        code: 'requirement_inferred_from_subject_default',
        severity: 'warning',
        classId: aggregate.classId,
        subjectId: aggregate.subjectId,
        message:
          'Class requirement row was missing, so required periods were inferred from the subject default.',
        details: { subjectDefaultPeriodsPerWeek: subject.periodsPerWeek },
      });
    }

    if (!requiredPeriodsPerWeek) {
      issues.push({
        code: 'requirement_periods_unresolved',
        severity: 'error',
        classId: aggregate.classId,
        subjectId: aggregate.subjectId,
        message:
          'Canonical requirement periods could not be resolved from class requirements, normalized assignments, or subject defaults.',
      });
      continue;
    }

    if (
      aggregate.classRequirement?.teacherId &&
      normalizedTeacherIds.length > 0 &&
      !normalizedTeacherIds.includes(aggregate.classRequirement.teacherId)
    ) {
      issues.push({
        code: 'class_requirement_teacher_conflicts_with_normalized_assignment',
        severity: 'warning',
        classId: aggregate.classId,
        subjectId: aggregate.subjectId,
        teacherId: aggregate.classRequirement.teacherId,
        message:
          'Class subject requirement teacherId conflicts with normalized assignment rows. Normalized assignment wins.',
        details: {
          classRequirementTeacherId: aggregate.classRequirement.teacherId,
          normalizedTeacherIds,
        },
      });
    }

    if (normalizedTeacherIds.length > 0) {
      for (const teacherId of teacherMirrorTeacherIds) {
        if (!normalizedTeacherIds.includes(teacherId)) {
          issues.push({
            code: 'teacher_mirror_conflicts_with_normalized_assignment',
            severity: 'warning',
            classId: aggregate.classId,
            subjectId: aggregate.subjectId,
            teacherId,
            message:
              'Teacher classAssignments conflicts with normalized assignment rows. Normalized assignment wins.',
            details: { normalizedTeacherIds },
          });
        }
      }
    }

    const allowSplitAssignment =
      normalizedTeacherIds.length > 1 || teacherMirrorTeacherIds.length > 1;

    requirementRows.push({
      classId: aggregate.classId,
      subjectId: aggregate.subjectId,
      requiredPeriodsPerWeek,
      allowSplitAssignment,
      derivation,
    });

    if (totalNormalizedPeriods > requiredPeriodsPerWeek) {
      issues.push({
        code: 'normalized_assignment_periods_exceed_requirement',
        severity: 'error',
        classId: aggregate.classId,
        subjectId: aggregate.subjectId,
        message:
          'Normalized assignment periods exceed the resolved requirement periods for this class-subject.',
        details: { totalNormalizedPeriods, requiredPeriodsPerWeek },
      });
    }

    if (aggregate.normalizedAssignments.length > 0) {
      for (const assignment of aggregate.normalizedAssignments) {
        assignmentRows.push({
          classId: assignment.classId,
          subjectId: assignment.subjectId,
          teacherId: assignment.teacherId,
          assignedPeriodsPerWeek: assignment.periodsPerWeek,
          isFixed: assignment.isFixed,
          source: 'migration',
          derivation: 'normalized_assignment',
        });

        if (!capabilityRows.has(capabilityKey(assignment.teacherId, assignment.subjectId))) {
          issues.push({
            code: 'capability_inferred_from_normalized_assignment',
            severity: 'warning',
            classId: assignment.classId,
            subjectId: assignment.subjectId,
            teacherId: assignment.teacherId,
            message:
              'Teacher capability was missing and will be inferred as allowed from a normalized assignment.',
          });
        }

        addCapability({
          teacherId: assignment.teacherId,
          subjectId: assignment.subjectId,
          capabilityLevel: 'allowed',
          derivation: 'normalized_assignment_inferred',
        });
      }

      continue;
    }

    if (aggregate.classRequirement?.teacherId) {
      if (!teacherMap.has(aggregate.classRequirement.teacherId)) {
        issues.push({
          code: 'class_requirement_teacher_missing',
          severity: 'error',
          classId: aggregate.classId,
          subjectId: aggregate.subjectId,
          teacherId: aggregate.classRequirement.teacherId,
          message: 'Class subject requirement teacherId references a missing or deleted teacher.',
        });
        continue;
      }

      assignmentRows.push({
        classId: aggregate.classId,
        subjectId: aggregate.subjectId,
        teacherId: aggregate.classRequirement.teacherId,
        assignedPeriodsPerWeek: requiredPeriodsPerWeek,
        isFixed: true,
        source: 'migration',
        derivation: 'class_requirement_teacher',
      });

      if (
        teacherMirrorTeacherIds.length > 0 &&
        !teacherMirrorTeacherIds.includes(aggregate.classRequirement.teacherId)
      ) {
        issues.push({
          code: 'teacher_mirror_conflicts_with_class_requirement_teacher',
          severity: 'warning',
          classId: aggregate.classId,
          subjectId: aggregate.subjectId,
          teacherId: aggregate.classRequirement.teacherId,
          message:
            'Teacher classAssignments conflicts with class subject requirement teacherId. Class requirement wins when normalized assignments are absent.',
          details: { teacherMirrorTeacherIds },
        });
      }

      if (
        !capabilityRows.has(
          capabilityKey(aggregate.classRequirement.teacherId, aggregate.subjectId)
        )
      ) {
        issues.push({
          code: 'capability_inferred_from_class_requirement_teacher',
          severity: 'warning',
          classId: aggregate.classId,
          subjectId: aggregate.subjectId,
          teacherId: aggregate.classRequirement.teacherId,
          message:
            'Teacher capability was missing and will be inferred as allowed from class subject requirement teacherId.',
        });
      }

      addCapability({
        teacherId: aggregate.classRequirement.teacherId,
        subjectId: aggregate.subjectId,
        capabilityLevel: 'allowed',
        derivation: 'teacher_mirror_inferred',
      });
      continue;
    }

    if (teacherMirrorTeacherIds.length === 1) {
      const [teacherId] = teacherMirrorTeacherIds;

      assignmentRows.push({
        classId: aggregate.classId,
        subjectId: aggregate.subjectId,
        teacherId,
        assignedPeriodsPerWeek: requiredPeriodsPerWeek,
        isFixed: true,
        source: 'migration',
        derivation: 'teacher_class_assignment',
      });

      if (!capabilityRows.has(capabilityKey(teacherId, aggregate.subjectId))) {
        issues.push({
          code: 'capability_inferred_from_teacher_mirror',
          severity: 'warning',
          classId: aggregate.classId,
          subjectId: aggregate.subjectId,
          teacherId,
          message:
            'Teacher capability was missing and will be inferred as allowed from teacher classAssignments.',
        });
      }

      addCapability({
        teacherId,
        subjectId: aggregate.subjectId,
        capabilityLevel: 'allowed',
        derivation: 'teacher_mirror_inferred',
      });
      continue;
    }

    if (teacherMirrorTeacherIds.length > 1) {
      issues.push({
        code: 'teacher_mirror_assignment_ambiguous',
        severity: 'error',
        classId: aggregate.classId,
        subjectId: aggregate.subjectId,
        message:
          'Multiple teachers were inferred from teacher classAssignments without normalized period data. Manual reconciliation is required.',
        details: { teacherMirrorTeacherIds, requiredPeriodsPerWeek },
      });

      for (const teacherId of teacherMirrorTeacherIds) {
        addCapability({
          teacherId,
          subjectId: aggregate.subjectId,
          capabilityLevel: 'allowed',
          derivation: 'teacher_mirror_inferred',
        });
      }
    }
  }

  const capabilities = [...capabilityRows.values()].sort((left, right) => {
    if (left.teacherId !== right.teacherId) {
      return left.teacherId - right.teacherId;
    }
    return left.subjectId - right.subjectId;
  });

  const assignments = assignmentRows.sort((left, right) => {
    if (left.classId !== right.classId) {
      return left.classId - right.classId;
    }
    if (left.subjectId !== right.subjectId) {
      return left.subjectId - right.subjectId;
    }
    return left.teacherId - right.teacherId;
  });

  const summary = issueCounts(issues);
  summary.requirementCount = requirementRows.length;
  summary.capabilityCount = capabilities.length;
  summary.assignmentCount = assignments.length;

  return {
    requirements: requirementRows,
    capabilities,
    assignments,
    issues,
    summary,
  };
}

function getComparableFieldValue(record: object, field: string): unknown {
  return (record as Record<string, unknown>)[field];
}

function compareRecords(
  expected: object,
  actual: object,
  fields: string[]
): Record<string, { expected: unknown; actual: unknown }> {
  const mismatches: Record<string, { expected: unknown; actual: unknown }> = {};

  for (const field of fields) {
    const expectedValue = getComparableFieldValue(expected, field);
    const actualValue = getComparableFieldValue(actual, field);

    if (expectedValue !== actualValue) {
      mismatches[field] = {
        expected: expectedValue,
        actual: actualValue,
      };
    }
  }

  return mismatches;
}

export function comparePlanToCanonicalSnapshot(
  plan: Phase2BackfillPlan,
  snapshot: CanonicalSnapshot
): IntegrityReport {
  const expectedRequirementMap = new Map(
    plan.requirements.map((row) => [pairKey(row.classId, row.subjectId), row])
  );
  const actualRequirementMap = new Map(
    snapshot.requirements.map((row) => [pairKey(row.classId, row.subjectId), row])
  );

  const expectedCapabilityMap = new Map(
    plan.capabilities.map((row) => [capabilityKey(row.teacherId, row.subjectId), row])
  );
  const actualCapabilityMap = new Map(
    snapshot.capabilities.map((row) => [capabilityKey(row.teacherId, row.subjectId), row])
  );

  const expectedAssignmentMap = new Map(
    plan.assignments.map((row) => [assignmentKey(row.classId, row.subjectId, row.teacherId), row])
  );
  const actualAssignmentMap = new Map(
    snapshot.assignments.map((row) => [assignmentKey(row.classId, row.subjectId, row.teacherId), row])
  );

  const missingRequirements: IntegrityDrift[] = [];
  const mismatchedRequirements: IntegrityDrift[] = [];
  const unexpectedRequirements: IntegrityDrift[] = [];
  const missingCapabilities: IntegrityDrift[] = [];
  const mismatchedCapabilities: IntegrityDrift[] = [];
  const unexpectedCapabilities: IntegrityDrift[] = [];
  const missingAssignments: IntegrityDrift[] = [];
  const mismatchedAssignments: IntegrityDrift[] = [];
  const unexpectedAssignments: IntegrityDrift[] = [];

  for (const [key, expected] of expectedRequirementMap) {
    const actual = actualRequirementMap.get(key);
    if (!actual) {
      missingRequirements.push({
        key,
        message: 'Canonical class_subject_requirement row is missing.',
        expected,
      });
      continue;
    }

    const mismatches = compareRecords(expected, actual, [
      'requiredPeriodsPerWeek',
      'allowSplitAssignment',
    ]);

    if (Object.keys(mismatches).length > 0) {
      mismatchedRequirements.push({
        key,
        message: 'Canonical class_subject_requirement row differs from the expected backfill plan.',
        expected,
        actual,
      });
    }
  }

  for (const [key, actual] of actualRequirementMap) {
    if (!expectedRequirementMap.has(key)) {
      unexpectedRequirements.push({
        key,
        message: 'Canonical class_subject_requirement row is not present in the expected backfill plan.',
        actual,
      });
    }
  }

  for (const [key, expected] of expectedCapabilityMap) {
    const actual = actualCapabilityMap.get(key);
    if (!actual) {
      missingCapabilities.push({
        key,
        message: 'Canonical teacher_subject_capability row is missing.',
        expected,
      });
      continue;
    }

    const mismatches = compareRecords(expected, actual, ['capabilityLevel']);
    if (Object.keys(mismatches).length > 0) {
      mismatchedCapabilities.push({
        key,
        message: 'Canonical teacher_subject_capability row differs from the expected backfill plan.',
        expected,
        actual,
      });
    }
  }

  for (const [key, actual] of actualCapabilityMap) {
    if (!expectedCapabilityMap.has(key)) {
      unexpectedCapabilities.push({
        key,
        message: 'Canonical teacher_subject_capability row is not present in the expected backfill plan.',
        actual,
      });
    }
  }

  for (const [key, expected] of expectedAssignmentMap) {
    const actual = actualAssignmentMap.get(key);
    if (!actual) {
      missingAssignments.push({
        key,
        message: 'Canonical teaching_assignment row is missing.',
        expected,
      });
      continue;
    }

    const mismatches = compareRecords(expected, actual, [
      'assignedPeriodsPerWeek',
      'isFixed',
      'source',
    ]);
    if (Object.keys(mismatches).length > 0) {
      mismatchedAssignments.push({
        key,
        message: 'Canonical teaching_assignment row differs from the expected backfill plan.',
        expected,
        actual,
      });
    }
  }

  for (const [key, actual] of actualAssignmentMap) {
    if (!expectedAssignmentMap.has(key)) {
      unexpectedAssignments.push({
        key,
        message: 'Canonical teaching_assignment row is not present in the expected backfill plan.',
        actual,
      });
    }
  }

  return {
    expected: plan.summary,
    actual: {
      requirementCount: snapshot.requirements.length,
      capabilityCount: snapshot.capabilities.length,
      assignmentCount: snapshot.assignments.length,
    },
    missingRequirements,
    mismatchedRequirements,
    unexpectedRequirements,
    missingCapabilities,
    mismatchedCapabilities,
    unexpectedCapabilities,
    missingAssignments,
    mismatchedAssignments,
    unexpectedAssignments,
  };
}
