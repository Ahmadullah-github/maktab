import { MigrationInterface, QueryRunner } from 'typeorm';

interface CountRow {
  count: number | string;
}

async function mismatchCount(queryRunner: QueryRunner, sql: string): Promise<number> {
  const [row] = (await queryRunner.query(sql)) as CountRow[];
  return Number(row?.count ?? 0);
}

/**
 * Removes the last persisted assignment mirrors. The compatibility projections
 * returned by teacher/class APIs are derived from canonical rows at read time.
 */
export class CompleteCanonicalAssignmentCutover1785300000000 implements MigrationInterface {
  name = 'CompleteCanonicalAssignmentCutover1785300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const legacyTable = await queryRunner.getTable('teacher_class_subject_assignment');
    if (!legacyTable) return;

    const assignmentMismatches = await mismatchCount(
      queryRunner,
      `
        SELECT COUNT(*) AS count
        FROM (
          SELECT teacherId, classId, subjectId, periodsPerWeek, isFixed
          FROM teacher_class_subject_assignment
          WHERE isDeleted = 0
          EXCEPT
          SELECT a.teacher_id, r.class_id, r.subject_id,
                 a.assigned_periods_per_week, a.is_fixed
          FROM teaching_assignment a
          INNER JOIN class_subject_requirement r
            ON r.id = a.class_subject_requirement_id AND r.is_deleted = 0
          WHERE a.is_deleted = 0
          UNION ALL
          SELECT a.teacher_id, r.class_id, r.subject_id,
                 a.assigned_periods_per_week, a.is_fixed
          FROM teaching_assignment a
          INNER JOIN class_subject_requirement r
            ON r.id = a.class_subject_requirement_id AND r.is_deleted = 0
          WHERE a.is_deleted = 0
          EXCEPT
          SELECT teacherId, classId, subjectId, periodsPerWeek, isFixed
          FROM teacher_class_subject_assignment
          WHERE isDeleted = 0
        )
      `
    );
    if (assignmentMismatches > 0) {
      throw new Error(
        `Canonical assignment cutover refused: ${assignmentMismatches} legacy assignment mismatch(es)`
      );
    }

    const invalidCanonicalRows = await mismatchCount(
      queryRunner,
      `
        SELECT COUNT(*) AS count
        FROM teaching_assignment a
        LEFT JOIN class_subject_requirement r ON r.id = a.class_subject_requirement_id
        LEFT JOIN teacher t ON t.id = a.teacher_id
        LEFT JOIN class_group c ON c.id = r.class_id
        LEFT JOIN subject s ON s.id = r.subject_id
        WHERE a.is_deleted = 0
          AND (r.id IS NULL OR r.is_deleted = 1 OR t.id IS NULL OR t.isDeleted = 1
               OR c.id IS NULL OR c.isDeleted = 1 OR s.id IS NULL OR s.isDeleted = 1)
      `
    );
    if (invalidCanonicalRows > 0) {
      throw new Error(
        `Canonical assignment cutover refused: ${invalidCanonicalRows} invalid canonical row(s)`
      );
    }

    await queryRunner.dropTable('teacher_class_subject_assignment', true, true, true);

    const teacherTable = await queryRunner.getTable('teacher');
    for (const name of ['primarySubjectIds', 'allowedSubjectIds', 'classAssignments']) {
      if (teacherTable?.findColumnByName(name)) {
        await queryRunner.query(`ALTER TABLE teacher DROP COLUMN "${name}"`);
      }
    }

    const classTable = await queryRunner.getTable('class_group');
    if (classTable?.findColumnByName('subjectRequirements')) {
      await queryRunner.query('ALTER TABLE class_group DROP COLUMN "subjectRequirements"');
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const teacherTable = await queryRunner.getTable('teacher');
    for (const name of ['primarySubjectIds', 'allowedSubjectIds', 'classAssignments']) {
      if (!teacherTable?.findColumnByName(name)) {
        await queryRunner.query(
          `ALTER TABLE teacher ADD COLUMN "${name}" text NULL DEFAULT '[]'`
        );
      }
    }
    const classTable = await queryRunner.getTable('class_group');
    if (!classTable?.findColumnByName('subjectRequirements')) {
      await queryRunner.query(
        `ALTER TABLE class_group ADD COLUMN "subjectRequirements" text NOT NULL DEFAULT '[]'`
      );
    }

    if (!(await queryRunner.hasTable('teacher_class_subject_assignment'))) {
      await queryRunner.query(`
        CREATE TABLE teacher_class_subject_assignment (
          id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          teacherId integer NOT NULL,
          classId integer NOT NULL,
          subjectId integer NOT NULL,
          periodsPerWeek integer NOT NULL,
          isFixed boolean NOT NULL DEFAULT (1),
          schoolId integer,
          isDeleted boolean NOT NULL DEFAULT (0),
          deletedAt datetime,
          createdAt datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
          updatedAt datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
          CONSTRAINT UQ_teacher_class_subject_assignment
            UNIQUE (teacherId, classId, subjectId),
          CONSTRAINT FK_tcsa_teacher FOREIGN KEY (teacherId) REFERENCES teacher(id),
          CONSTRAINT FK_tcsa_class FOREIGN KEY (classId) REFERENCES class_group(id),
          CONSTRAINT FK_tcsa_subject FOREIGN KEY (subjectId) REFERENCES subject(id)
        )
      `);
      await queryRunner.query(
        'CREATE INDEX IDX_tcsa_teacher ON teacher_class_subject_assignment (teacherId)'
      );
      await queryRunner.query(
        'CREATE INDEX IDX_tcsa_class_subject ON teacher_class_subject_assignment (classId, subjectId)'
      );
      await queryRunner.query(`
        INSERT INTO teacher_class_subject_assignment (
          teacherId, classId, subjectId, periodsPerWeek, isFixed, schoolId,
          isDeleted, deletedAt, createdAt, updatedAt
        )
        SELECT a.teacher_id, r.class_id, r.subject_id, a.assigned_periods_per_week,
               a.is_fixed, t.schoolId, a.is_deleted, a.deleted_at, a.created_at, a.updated_at
        FROM teaching_assignment a
        INNER JOIN class_subject_requirement r ON r.id = a.class_subject_requirement_id
        INNER JOIN teacher t ON t.id = a.teacher_id
      `);
    }
  }
}
