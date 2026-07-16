import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  buildPhase2BackfillPlan,
  Phase2BackfillPlan,
  Phase2PlannerInput,
} from '../../services/assignmentPhase2Planner';
import { logger } from '../../utils/logger';

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== 'string' || value.trim() === '') return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function loadPlannerInput(queryRunner: QueryRunner): Promise<Phase2PlannerInput> {
  const teacherRows = (await queryRunner.query(`
    SELECT id, fullName, isDeleted, primarySubjectIds, allowedSubjectIds, classAssignments
    FROM teacher
  `)) as Array<{
    id: number;
    fullName: string;
    isDeleted: number;
    primarySubjectIds: unknown;
    allowedSubjectIds: unknown;
    classAssignments: unknown;
  }>;

  const classRows = (await queryRunner.query(`
    SELECT id, name, isDeleted, subjectRequirements
    FROM class_group
  `)) as Array<{
    id: number;
    name: string;
    isDeleted: number;
    subjectRequirements: unknown;
  }>;

  const subjectRows = (await queryRunner.query(`
    SELECT id, name, isDeleted, periodsPerWeek
    FROM subject
  `)) as Array<{
    id: number;
    name: string;
    isDeleted: number;
    periodsPerWeek: number | null;
  }>;

  const assignmentRows = (await queryRunner.query(`
    SELECT id, teacherId, classId, subjectId, periodsPerWeek, isFixed, isDeleted
    FROM teacher_class_subject_assignment
  `)) as Array<{
    id: number;
    teacherId: number;
    classId: number;
    subjectId: number;
    periodsPerWeek: number;
    isFixed: number;
    isDeleted: number;
  }>;

  return {
    teachers: teacherRows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      isDeleted: Boolean(row.isDeleted),
      primarySubjectIds: parseJsonArray<number>(row.primarySubjectIds),
      allowedSubjectIds: parseJsonArray<number>(row.allowedSubjectIds),
      classAssignments: parseJsonArray<{ subjectId: number; classIds: number[] }>(
        row.classAssignments
      ),
    })),
    classes: classRows.map((row) => ({
      id: row.id,
      name: row.name,
      isDeleted: Boolean(row.isDeleted),
      subjectRequirements: parseJsonArray<{
        subjectId: number;
        periodsPerWeek: number;
        teacherId?: number | null;
      }>(row.subjectRequirements),
    })),
    subjects: subjectRows.map((row) => ({
      id: row.id,
      name: row.name,
      isDeleted: Boolean(row.isDeleted),
      periodsPerWeek: typeof row.periodsPerWeek === 'number' ? row.periodsPerWeek : null,
    })),
    normalizedAssignments: assignmentRows.map((row) => ({
      id: row.id,
      teacherId: row.teacherId,
      classId: row.classId,
      subjectId: row.subjectId,
      periodsPerWeek: row.periodsPerWeek,
      isFixed: Boolean(row.isFixed),
      isDeleted: Boolean(row.isDeleted),
    })),
  };
}

async function synchronizeCompatibilityStorage(
  queryRunner: QueryRunner,
  input: Phase2PlannerInput,
  plan: Phase2BackfillPlan
): Promise<void> {
  const plannedAssignmentKeys = new Set(
    plan.assignments.map(
      (assignment) => `${assignment.teacherId}:${assignment.classId}:${assignment.subjectId}`
    )
  );
  const activeLegacyRows = (await queryRunner.query(`
    SELECT id, teacherId, classId, subjectId
    FROM teacher_class_subject_assignment
    WHERE isDeleted = 0
  `)) as Array<{ id: number; teacherId: number; classId: number; subjectId: number }>;

  for (const legacy of activeLegacyRows) {
    const key = `${legacy.teacherId}:${legacy.classId}:${legacy.subjectId}`;
    if (!plannedAssignmentKeys.has(key)) {
      await queryRunner.query(
        `UPDATE teacher_class_subject_assignment
         SET isDeleted = 1, deletedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [legacy.id]
      );
    }
  }

  for (const assignment of plan.assignments) {
    const [existing] = (await queryRunner.query(
      `
        SELECT id
        FROM teacher_class_subject_assignment
        WHERE teacherId = ? AND classId = ? AND subjectId = ?
        ORDER BY isDeleted ASC, id ASC
        LIMIT 1
      `,
      [assignment.teacherId, assignment.classId, assignment.subjectId]
    )) as Array<{ id: number }>;
    if (existing) {
      await queryRunner.query(
        `
          UPDATE teacher_class_subject_assignment
          SET periodsPerWeek = ?, isFixed = ?,
              schoolId = (SELECT schoolId FROM teacher WHERE id = ?),
              isDeleted = 0, deletedAt = NULL, updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          assignment.assignedPeriodsPerWeek,
          assignment.isFixed ? 1 : 0,
          assignment.teacherId,
          existing.id,
        ]
      );
    } else {
      await queryRunner.query(
        `
          INSERT INTO teacher_class_subject_assignment (
            teacherId, classId, subjectId, periodsPerWeek, isFixed, schoolId,
            isDeleted, deletedAt, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, (SELECT schoolId FROM teacher WHERE id = ?),
                    0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [
          assignment.teacherId,
          assignment.classId,
          assignment.subjectId,
          assignment.assignedPeriodsPerWeek,
          assignment.isFixed ? 1 : 0,
          assignment.teacherId,
        ]
      );
    }
  }

  for (const teacher of input.teachers.filter((row) => !row.isDeleted)) {
    const capabilities = plan.capabilities.filter((row) => row.teacherId === teacher.id);
    const assignments = plan.assignments.filter((row) => row.teacherId === teacher.id);
    const assignmentBySubject = new Map<number, number[]>();
    for (const assignment of assignments) {
      const classIds = assignmentBySubject.get(assignment.subjectId) ?? [];
      classIds.push(assignment.classId);
      assignmentBySubject.set(assignment.subjectId, classIds);
    }

    await queryRunner.query(
      `
        UPDATE teacher
        SET primarySubjectIds = ?, allowedSubjectIds = ?, classAssignments = ?,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        JSON.stringify(
          capabilities
            .filter((row) => row.capabilityLevel === 'primary')
            .map((row) => row.subjectId)
            .sort((left, right) => left - right)
        ),
        JSON.stringify(
          capabilities
            .filter((row) => row.capabilityLevel === 'allowed')
            .map((row) => row.subjectId)
            .sort((left, right) => left - right)
        ),
        JSON.stringify(
          [...assignmentBySubject.entries()]
            .sort(([left], [right]) => left - right)
            .map(([subjectId, classIds]) => ({
              subjectId,
              classIds: [...new Set(classIds)].sort((left, right) => left - right),
            }))
        ),
        teacher.id,
      ]
    );
  }

  for (const classGroup of input.classes.filter((row) => !row.isDeleted)) {
    const requirements = plan.requirements.filter((row) => row.classId === classGroup.id);
    const mirror = requirements.map((requirement) => {
      const assignments = plan.assignments.filter(
        (row) => row.classId === classGroup.id && row.subjectId === requirement.subjectId
      );
      const teacherId =
        assignments.length === 1 &&
        assignments[0].assignedPeriodsPerWeek === requirement.requiredPeriodsPerWeek
          ? assignments[0].teacherId
          : null;
      return {
        subjectId: requirement.subjectId,
        periodsPerWeek: requirement.requiredPeriodsPerWeek,
        teacherId,
      };
    });
    await queryRunner.query(
      `UPDATE class_group SET subjectRequirements = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [JSON.stringify(mirror), classGroup.id]
    );
  }
}

/**
 * Moves legacy assignment mirrors into the canonical tables as part of the
 * managed migration chain. Existing canonical installations are never
 * overwritten; the normal startup semantic audit validates those instead.
 */
export class BackfillCanonicalAssignments1784500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const [counts] = (await queryRunner.query(`
      SELECT
        (SELECT COUNT(*) FROM class_subject_requirement WHERE is_deleted = 0) +
        (SELECT COUNT(*) FROM teacher_subject_capability WHERE is_deleted = 0) +
        (SELECT COUNT(*) FROM teaching_assignment WHERE is_deleted = 0) AS activeCount
    `)) as Array<{ activeCount: number }>;

    if (Number(counts?.activeCount ?? 0) > 0) {
      logger.info('Migration skipped canonical assignment backfill: active canonical data exists');
      return;
    }

    const input = await loadPlannerInput(queryRunner);
    const plan = buildPhase2BackfillPlan(input);
    if (plan.summary.errorCount > 0) {
      const errorCodes = [...new Set(
        plan.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.code)
      )];
      throw new Error(
        `Cannot backfill canonical assignments: ${plan.summary.errorCount} legacy data error(s) (${errorCodes.join(', ')})`
      );
    }

    for (const requirement of plan.requirements) {
      await queryRunner.query(
        `
          INSERT INTO class_subject_requirement (
            class_id, subject_id, required_periods_per_week, allow_split_assignment,
            is_deleted, deleted_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(class_id, subject_id) DO UPDATE SET
            required_periods_per_week = excluded.required_periods_per_week,
            allow_split_assignment = excluded.allow_split_assignment,
            is_deleted = 0,
            deleted_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          requirement.classId,
          requirement.subjectId,
          requirement.requiredPeriodsPerWeek,
          requirement.allowSplitAssignment ? 1 : 0,
        ]
      );
    }

    for (const capability of plan.capabilities) {
      await queryRunner.query(
        `
          INSERT INTO teacher_subject_capability (
            teacher_id, subject_id, capability_level,
            is_deleted, deleted_at, created_at, updated_at
          ) VALUES (?, ?, ?, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(teacher_id, subject_id) DO UPDATE SET
            capability_level = excluded.capability_level,
            is_deleted = 0,
            deleted_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        `,
        [capability.teacherId, capability.subjectId, capability.capabilityLevel]
      );
    }

    for (const assignment of plan.assignments) {
      const [requirement] = (await queryRunner.query(
        `
          SELECT id
          FROM class_subject_requirement
          WHERE class_id = ? AND subject_id = ? AND is_deleted = 0
        `,
        [assignment.classId, assignment.subjectId]
      )) as Array<{ id: number }>;

      if (!requirement) {
        throw new Error(
          `Canonical requirement missing during backfill for class=${assignment.classId}, subject=${assignment.subjectId}`
        );
      }

      await queryRunner.query(
        `
          INSERT INTO teaching_assignment (
            class_subject_requirement_id, teacher_id, assigned_periods_per_week,
            is_fixed, source, is_deleted, deleted_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'migration', 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(class_subject_requirement_id, teacher_id) DO UPDATE SET
            assigned_periods_per_week = excluded.assigned_periods_per_week,
            is_fixed = excluded.is_fixed,
            source = excluded.source,
            is_deleted = 0,
            deleted_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          requirement.id,
          assignment.teacherId,
          assignment.assignedPeriodsPerWeek,
          assignment.isFixed ? 1 : 0,
        ]
      );
    }

    await synchronizeCompatibilityStorage(queryRunner, input, plan);

    logger.info('Migration applied: Backfilled canonical assignment tables', {
      requirements: plan.summary.requirementCount,
      capabilities: plan.summary.capabilityCount,
      assignments: plan.summary.assignmentCount,
      warnings: plan.summary.warningCount,
    });
  }

  public async down(): Promise<void> {
    // Data-preserving by design: canonical rows may have changed after upgrade.
  }
}
