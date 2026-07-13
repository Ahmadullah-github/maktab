import { DataSource } from 'typeorm';

interface AssignmentRow {
  teacherId: number;
  classId: number;
  subjectId: number;
  periodsPerWeek: number;
  isFixed: number;
}

interface RequirementRow {
  classId: number;
  subjectId: number;
  periodsPerWeek: number;
}

interface CapabilityRow {
  teacherId: number;
  subjectId: number;
  capabilityLevel: 'primary' | 'allowed';
}

interface TeacherMirrorRow {
  id: number;
  primarySubjectIds: string;
  allowedSubjectIds: string;
  classAssignments: string;
}

interface ClassMirrorRow {
  id: number;
  subjectRequirements: string;
}

export interface AssignmentConsistencyReport {
  isConsistent: boolean;
  checkedAt: string;
  counts: {
    canonicalAssignments: number;
    legacyAssignments: number;
    canonicalRequirements: number;
    canonicalCapabilities: number;
  };
  issues: {
    malformedMirrors: string[];
    missingLegacyAssignments: string[];
    unexpectedLegacyAssignments: string[];
    legacyValueMismatches: string[];
    missingTeacherAssignmentMirrors: string[];
    unexpectedTeacherAssignmentMirrors: string[];
    missingTeacherCapabilityMirrors: string[];
    unexpectedTeacherCapabilityMirrors: string[];
    classRequirementMirrorMismatches: string[];
  };
}

function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function assignmentKey(row: Pick<AssignmentRow, 'teacherId' | 'classId' | 'subjectId'>): string {
  return `${row.teacherId}:${row.classId}:${row.subjectId}`;
}

function parseArray(raw: string, label: string, malformed: string[]): unknown[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Report a single stable issue below.
  }
  malformed.push(label);
  return [];
}

function compareSets(expected: Set<string>, actual: Set<string>): [string[], string[]] {
  return [
    [...expected].filter((key) => !actual.has(key)).sort(),
    [...actual].filter((key) => !expected.has(key)).sort(),
  ];
}

/** Read-only audit across canonical rows, compatibility tables, and persisted JSON mirrors. */
export async function auditAssignmentStorageConsistency(
  dataSource: DataSource
): Promise<AssignmentConsistencyReport> {
  const [canonicalAssignments, legacyAssignments, requirements, capabilities, teachers, classes] =
    await Promise.all([
      dataSource.query(`
        SELECT
          a.teacher_id AS teacherId,
          r.class_id AS classId,
          r.subject_id AS subjectId,
          a.assigned_periods_per_week AS periodsPerWeek,
          a.is_fixed AS isFixed
        FROM teaching_assignment a
        INNER JOIN class_subject_requirement r
          ON r.id = a.class_subject_requirement_id AND r.is_deleted = 0
        WHERE a.is_deleted = 0
        ORDER BY a.teacher_id, r.class_id, r.subject_id
      `) as Promise<AssignmentRow[]>,
      dataSource.query(`
        SELECT
          teacherId,
          classId,
          subjectId,
          periodsPerWeek,
          isFixed
        FROM teacher_class_subject_assignment
        WHERE isDeleted = 0
        ORDER BY teacherId, classId, subjectId
      `) as Promise<AssignmentRow[]>,
      dataSource.query(`
        SELECT
          class_id AS classId,
          subject_id AS subjectId,
          required_periods_per_week AS periodsPerWeek
        FROM class_subject_requirement
        WHERE is_deleted = 0
        ORDER BY class_id, subject_id
      `) as Promise<RequirementRow[]>,
      dataSource.query(`
        SELECT
          teacher_id AS teacherId,
          subject_id AS subjectId,
          capability_level AS capabilityLevel
        FROM teacher_subject_capability
        WHERE is_deleted = 0
        ORDER BY teacher_id, subject_id
      `) as Promise<CapabilityRow[]>,
      dataSource.query(`
        SELECT id, primarySubjectIds, allowedSubjectIds, classAssignments
        FROM teacher
        WHERE isDeleted = 0
        ORDER BY id
      `) as Promise<TeacherMirrorRow[]>,
      dataSource.query(`
        SELECT id, subjectRequirements
        FROM class_group
        WHERE isDeleted = 0
        ORDER BY id
      `) as Promise<ClassMirrorRow[]>,
    ]);

  const issues: AssignmentConsistencyReport['issues'] = {
    malformedMirrors: [],
    missingLegacyAssignments: [],
    unexpectedLegacyAssignments: [],
    legacyValueMismatches: [],
    missingTeacherAssignmentMirrors: [],
    unexpectedTeacherAssignmentMirrors: [],
    missingTeacherCapabilityMirrors: [],
    unexpectedTeacherCapabilityMirrors: [],
    classRequirementMirrorMismatches: [],
  };

  const canonicalByKey = new Map(canonicalAssignments.map((row) => [assignmentKey(row), row]));
  const legacyByKey = new Map(legacyAssignments.map((row) => [assignmentKey(row), row]));
  [issues.missingLegacyAssignments, issues.unexpectedLegacyAssignments] = compareSets(
    new Set(canonicalByKey.keys()),
    new Set(legacyByKey.keys())
  );

  for (const [key, canonical] of canonicalByKey) {
    const legacy = legacyByKey.get(key);
    if (
      legacy &&
      (Number(legacy.periodsPerWeek) !== Number(canonical.periodsPerWeek) ||
        Boolean(legacy.isFixed) !== Boolean(canonical.isFixed))
    ) {
      issues.legacyValueMismatches.push(key);
    }
  }

  const expectedTeacherAssignments = new Set(canonicalByKey.keys());
  const actualTeacherAssignments = new Set<string>();
  const expectedCapabilities = new Set(
    capabilities.map((row) => `${row.teacherId}:${row.subjectId}:${row.capabilityLevel}`)
  );
  const actualCapabilities = new Set<string>();

  for (const teacher of teachers) {
    const assignments = parseArray(
      teacher.classAssignments,
      `teacher:${teacher.id}:classAssignments`,
      issues.malformedMirrors
    );
    for (const assignment of assignments) {
      if (!assignment || typeof assignment !== 'object') continue;
      const record = assignment as { subjectId?: unknown; classIds?: unknown };
      const subjectId = positiveInteger(record.subjectId);
      if (subjectId === null || !Array.isArray(record.classIds)) continue;
      for (const rawClassId of record.classIds) {
        const classId = positiveInteger(rawClassId);
        if (classId !== null) actualTeacherAssignments.add(`${teacher.id}:${classId}:${subjectId}`);
      }
    }

    for (const [field, level] of [
      ['primarySubjectIds', 'primary'],
      ['allowedSubjectIds', 'allowed'],
    ] as const) {
      const subjectIds = parseArray(
        teacher[field],
        `teacher:${teacher.id}:${field}`,
        issues.malformedMirrors
      );
      for (const rawSubjectId of subjectIds) {
        const subjectId = positiveInteger(rawSubjectId);
        if (subjectId !== null) actualCapabilities.add(`${teacher.id}:${subjectId}:${level}`);
      }
    }
  }

  [issues.missingTeacherAssignmentMirrors, issues.unexpectedTeacherAssignmentMirrors] = compareSets(
    expectedTeacherAssignments,
    actualTeacherAssignments
  );
  [issues.missingTeacherCapabilityMirrors, issues.unexpectedTeacherCapabilityMirrors] = compareSets(
    expectedCapabilities,
    actualCapabilities
  );

  const assignmentsByRequirement = new Map<string, AssignmentRow[]>();
  for (const assignment of canonicalAssignments) {
    const key = `${assignment.classId}:${assignment.subjectId}`;
    const rows = assignmentsByRequirement.get(key) ?? [];
    rows.push(assignment);
    assignmentsByRequirement.set(key, rows);
  }
  const requirementByKey = new Map(
    requirements.map((requirement) => [
      `${requirement.classId}:${requirement.subjectId}`,
      requirement,
    ])
  );
  const actualRequirementKeys = new Set<string>();

  for (const classGroup of classes) {
    const mirrors = parseArray(
      classGroup.subjectRequirements,
      `class:${classGroup.id}:subjectRequirements`,
      issues.malformedMirrors
    );
    for (const mirror of mirrors) {
      if (!mirror || typeof mirror !== 'object') continue;
      const record = mirror as {
        subjectId?: unknown;
        periodsPerWeek?: unknown;
        teacherId?: unknown;
      };
      const subjectId = positiveInteger(record.subjectId);
      if (subjectId === null) continue;
      const key = `${classGroup.id}:${subjectId}`;
      actualRequirementKeys.add(key);
      const requirement = requirementByKey.get(key);
      if (!requirement) {
        issues.classRequirementMirrorMismatches.push(`${key}:unexpected`);
        continue;
      }

      const assignmentRows = assignmentsByRequirement.get(key) ?? [];
      const expectedTeacherId =
        assignmentRows.length === 1 &&
        Number(assignmentRows[0].periodsPerWeek) === Number(requirement.periodsPerWeek)
          ? assignmentRows[0].teacherId
          : null;
      const actualTeacherId = positiveInteger(record.teacherId);
      if (
        Number(record.periodsPerWeek) !== Number(requirement.periodsPerWeek) ||
        actualTeacherId !== expectedTeacherId
      ) {
        issues.classRequirementMirrorMismatches.push(`${key}:values`);
      }
    }
  }

  for (const key of requirementByKey.keys()) {
    if (!actualRequirementKeys.has(key)) {
      issues.classRequirementMirrorMismatches.push(`${key}:missing`);
    }
  }
  issues.classRequirementMirrorMismatches.sort();

  const issueCount = Object.values(issues).reduce((total, entries) => total + entries.length, 0);
  return {
    isConsistent: issueCount === 0,
    checkedAt: new Date().toISOString(),
    counts: {
      canonicalAssignments: canonicalAssignments.length,
      legacyAssignments: legacyAssignments.length,
      canonicalRequirements: requirements.length,
      canonicalCapabilities: capabilities.length,
    },
    issues,
  };
}
