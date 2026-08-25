import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import {
  CanonicalSnapshot,
  Phase2BackfillPlan,
  Phase2PlanIssue,
  Phase2PlannerInput,
} from '../src/services/assignmentPhase2Planner';

export interface ScriptOptions {
  dbPath: string;
  dryRun: boolean;
  verbose: boolean;
  force: boolean;
  jsonPath?: string;
}

type TableName =
  | 'class_subject_requirement'
  | 'teacher_subject_capability'
  | 'teaching_assignment';

const requiredCanonicalTables: TableName[] = [
  'class_subject_requirement',
  'teacher_subject_capability',
  'teaching_assignment',
];

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
};

export function colorize(message: string, color: keyof typeof colors = 'reset'): string {
  return `${colors[color]}${message}${colors.reset}`;
}

export function log(message: string, color: keyof typeof colors = 'reset'): void {
  process.stdout.write(`${colorize(message, color)}\n`);
}

export function printHeader(title: string): void {
  const line = '='.repeat(72);
  log(`\n${line}`, 'bold');
  log(title, 'bold');
  log(`${line}\n`, 'bold');
}

export function resolveDbPath(customPath?: string): string {
  return customPath
    ? path.resolve(process.cwd(), customPath)
    : path.resolve(process.cwd(), 'timetable.db');
}

export function parseCommonArgs(argv: string[]): ScriptOptions {
  const getOptionValue = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    if (index === -1) {
      return undefined;
    }

    return argv[index + 1];
  };

  return {
    dbPath: resolveDbPath(getOptionValue('--db')),
    dryRun: argv.includes('--dry-run'),
    verbose: argv.includes('--verbose') || argv.includes('-v'),
    force: argv.includes('--force'),
    jsonPath: getOptionValue('--json'),
  };
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return value as T;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseJsonArray<T>(value: unknown, fallback: T[]): T[] {
  const parsed = parseJson<unknown>(value, fallback);
  return Array.isArray(parsed) ? (parsed as T[]) : fallback;
}

export function openDatabase(dbPath: string): Database.Database {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found: ${dbPath}`);
  }

  return new Database(dbPath);
}

export function loadPlannerInput(db: Database.Database): Phase2PlannerInput {
  const tableNames = new Set(
    (
      db
        .prepare(
          `
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
          `
        )
        .all() as Array<{ name: string }>
    ).map((row) => row.name)
  );

  const teacherRows = db.prepare(
    `
      SELECT id, fullName, isDeleted, primarySubjectIds, allowedSubjectIds, classAssignments
      FROM teacher
    `
  ).all() as Array<{
    id: number;
    fullName: string;
    isDeleted: number;
    primarySubjectIds: unknown;
    allowedSubjectIds: unknown;
    classAssignments: unknown;
  }>;

  const teachers = teacherRows
    .map((row) => ({
      id: row.id,
      fullName: row.fullName,
      isDeleted: Boolean(row.isDeleted),
      primarySubjectIds: parseJsonArray<number>(row.primarySubjectIds, []),
      allowedSubjectIds: parseJsonArray<number>(row.allowedSubjectIds, []),
      classAssignments: parseJsonArray<{ subjectId: number; classIds: number[] }>(
        row.classAssignments,
        []
      ),
    }));

  const classRows = db.prepare(
    `
      SELECT id, name, isDeleted, subjectRequirements
      FROM class_group
    `
  ).all() as Array<{
    id: number;
    name: string;
    isDeleted: number;
    subjectRequirements: unknown;
  }>;

  const classes = classRows
    .map((row) => ({
      id: row.id,
      name: row.name,
      isDeleted: Boolean(row.isDeleted),
      subjectRequirements: parseJsonArray<{
        subjectId: number;
        periodsPerWeek: number;
        teacherId?: number | null;
      }>(row.subjectRequirements, []),
    }));

  const subjectRows = db.prepare(
    `
      SELECT id, name, isDeleted, periodsPerWeek
      FROM subject
    `
  ).all() as Array<{
    id: number;
    name: string;
    isDeleted: number;
    periodsPerWeek: number | null;
  }>;

  const subjects = subjectRows
    .map((row) => ({
      id: row.id,
      name: row.name,
      isDeleted: Boolean(row.isDeleted),
      periodsPerWeek: typeof row.periodsPerWeek === 'number' ? row.periodsPerWeek : null,
    }));

  const normalizedAssignments = tableNames.has('teacher_class_subject_assignment')
    ? (
        db
          .prepare(
            `
              SELECT id, teacherId, classId, subjectId, periodsPerWeek, isFixed, isDeleted
              FROM teacher_class_subject_assignment
            `
          )
          .all() as Array<{
          id: number;
          teacherId: number;
          classId: number;
          subjectId: number;
          periodsPerWeek: number;
          isFixed: number;
          isDeleted: number;
        }>
      )
        .map((row) => ({
          id: row.id,
          teacherId: row.teacherId,
          classId: row.classId,
          subjectId: row.subjectId,
          periodsPerWeek: row.periodsPerWeek,
          isFixed: Boolean(row.isFixed),
          isDeleted: Boolean(row.isDeleted),
        }))
    : [];

  return {
    teachers,
    classes,
    subjects,
    normalizedAssignments,
  };
}

export function getCanonicalSchemaStatus(db: Database.Database): {
  present: boolean;
  missingTables: TableName[];
} {
  const tableNames = db
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
      `
    )
    .all() as Array<{ name: string }>;

  const missingTables = requiredCanonicalTables.filter(
    (table) => !tableNames.some((row) => row.name === table)
  );

  return {
    present: missingTables.length === 0,
    missingTables,
  };
}

export function loadCanonicalSnapshot(db: Database.Database): CanonicalSnapshot {
  const requirementRows = db.prepare(
    `
      SELECT id, class_id, subject_id, required_periods_per_week, allow_split_assignment
      FROM class_subject_requirement
      WHERE is_deleted = 0
      ORDER BY class_id ASC, subject_id ASC
    `
  ).all() as Array<{
    id: number;
    class_id: number;
    subject_id: number;
    required_periods_per_week: number;
    allow_split_assignment: number;
  }>;

  const requirements = requirementRows
    .map((row) => ({
      id: row.id,
      classId: row.class_id,
      subjectId: row.subject_id,
      requiredPeriodsPerWeek: row.required_periods_per_week,
      allowSplitAssignment: Boolean(row.allow_split_assignment),
    }));

  const capabilityRows = db.prepare(
    `
      SELECT id, teacher_id, subject_id, capability_level
      FROM teacher_subject_capability
      WHERE is_deleted = 0
      ORDER BY teacher_id ASC, subject_id ASC
    `
  ).all() as Array<{
    id: number;
    teacher_id: number;
    subject_id: number;
    capability_level: 'primary' | 'allowed';
  }>;

  const capabilities = capabilityRows
    .map((row) => ({
      id: row.id,
      teacherId: row.teacher_id,
      subjectId: row.subject_id,
      capabilityLevel: row.capability_level,
    }));

  const assignmentRows = db.prepare(
    `
      SELECT
        ta.id,
        ta.teacher_id,
        ta.assigned_periods_per_week,
        ta.is_fixed,
        ta.source,
        csr.class_id,
        csr.subject_id
      FROM teaching_assignment ta
      JOIN class_subject_requirement csr
        ON csr.id = ta.class_subject_requirement_id
      WHERE ta.is_deleted = 0
        AND csr.is_deleted = 0
      ORDER BY csr.class_id ASC, csr.subject_id ASC, ta.teacher_id ASC
    `
  ).all() as Array<{
    id: number;
    teacher_id: number;
    assigned_periods_per_week: number;
    is_fixed: number;
    source: string;
    class_id: number;
    subject_id: number;
  }>;

  const assignments = assignmentRows
    .map((row) => ({
      id: row.id,
      teacherId: row.teacher_id,
      classId: row.class_id,
      subjectId: row.subject_id,
      assignedPeriodsPerWeek: row.assigned_periods_per_week,
      isFixed: Boolean(row.is_fixed),
      source: row.source,
    }));

  return { requirements, capabilities, assignments };
}

export function writeJsonFile(outputPath: string | undefined, payload: unknown): void {
  if (!outputPath) {
    return;
  }

  const resolvedPath = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, JSON.stringify(payload, null, 2));
  log(`Wrote JSON report: ${resolvedPath}`, 'cyan');
}

export function printPlanSummary(plan: Phase2BackfillPlan, verbose: boolean): void {
  log(`Requirements: ${plan.summary.requirementCount}`, 'cyan');
  log(`Capabilities: ${plan.summary.capabilityCount}`, 'cyan');
  log(`Assignments: ${plan.summary.assignmentCount}`, 'cyan');
  log(`Warnings: ${plan.summary.warningCount}`, plan.summary.warningCount > 0 ? 'yellow' : 'green');
  log(`Errors: ${plan.summary.errorCount}`, plan.summary.errorCount > 0 ? 'red' : 'green');

  if (!verbose || plan.issues.length === 0) {
    return;
  }

  log('\nIssues:', 'bold');
  for (const issue of plan.issues) {
    const color =
      issue.severity === 'error'
        ? 'red'
        : issue.severity === 'warning'
          ? 'yellow'
          : 'cyan';

    const suffix = [
      issue.classId ? `class=${issue.classId}` : null,
      issue.subjectId ? `subject=${issue.subjectId}` : null,
      issue.teacherId ? `teacher=${issue.teacherId}` : null,
    ]
      .filter(Boolean)
      .join(' ');

    log(`- [${issue.severity}] ${issue.code}: ${issue.message}${suffix ? ` (${suffix})` : ''}`, color);
  }
}

export function summarizeIssuesByCode(issues: Phase2PlanIssue[]): Record<string, number> {
  return issues.reduce<Record<string, number>>((summary, issue) => {
    summary[issue.code] = (summary[issue.code] ?? 0) + 1;
    return summary;
  }, {});
}

export function applyBackfillPlan(db: Database.Database, plan: Phase2BackfillPlan): void {
  const upsertRequirement = db.prepare(
    `
      INSERT INTO class_subject_requirement (
        class_id,
        subject_id,
        required_periods_per_week,
        allow_split_assignment,
        is_deleted,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (
        @classId,
        @subjectId,
        @requiredPeriodsPerWeek,
        @allowSplitAssignment,
        0,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(class_id, subject_id) DO UPDATE SET
        required_periods_per_week = excluded.required_periods_per_week,
        allow_split_assignment = excluded.allow_split_assignment,
        is_deleted = 0,
        deleted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    `
  );

  const findRequirementId = db.prepare(
    `
      SELECT id
      FROM class_subject_requirement
      WHERE class_id = ?
        AND subject_id = ?
        AND is_deleted = 0
    `
  );

  const upsertCapability = db.prepare(
    `
      INSERT INTO teacher_subject_capability (
        teacher_id,
        subject_id,
        capability_level,
        is_deleted,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (
        @teacherId,
        @subjectId,
        @capabilityLevel,
        0,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(teacher_id, subject_id) DO UPDATE SET
        capability_level = excluded.capability_level,
        is_deleted = 0,
        deleted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    `
  );

  const upsertAssignment = db.prepare(
    `
      INSERT INTO teaching_assignment (
        class_subject_requirement_id,
        teacher_id,
        assigned_periods_per_week,
        is_fixed,
        source,
        is_deleted,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (
        @classSubjectRequirementId,
        @teacherId,
        @assignedPeriodsPerWeek,
        @isFixed,
        @source,
        0,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(class_subject_requirement_id, teacher_id) DO UPDATE SET
        assigned_periods_per_week = excluded.assigned_periods_per_week,
        is_fixed = excluded.is_fixed,
        source = excluded.source,
        is_deleted = 0,
        deleted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    `
  );

  const transaction = db.transaction(() => {
    for (const requirement of plan.requirements) {
      upsertRequirement.run({
        classId: requirement.classId,
        subjectId: requirement.subjectId,
        requiredPeriodsPerWeek: requirement.requiredPeriodsPerWeek,
        allowSplitAssignment: requirement.allowSplitAssignment ? 1 : 0,
      });
    }

    for (const capability of plan.capabilities) {
      upsertCapability.run(capability);
    }

    for (const assignment of plan.assignments) {
      const requirementRow = findRequirementId.get(assignment.classId, assignment.subjectId) as
        | { id: number }
        | undefined;

      if (!requirementRow) {
        throw new Error(
          `Missing canonical requirement row for class=${assignment.classId} subject=${assignment.subjectId}`
        );
      }

      upsertAssignment.run({
        classSubjectRequirementId: requirementRow.id,
        teacherId: assignment.teacherId,
        assignedPeriodsPerWeek: assignment.assignedPeriodsPerWeek,
        isFixed: assignment.isFixed ? 1 : 0,
        source: assignment.source,
      });
    }
  });

  transaction();
}
