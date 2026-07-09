import { MigrationInterface, QueryRunner } from 'typeorm';
import { logger } from '../../utils/logger';

export class CreateCanonicalAssignmentTables1742400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasClassSubjectRequirement = await queryRunner.hasTable('class_subject_requirement');
    if (!hasClassSubjectRequirement) {
      await queryRunner.query(`
        CREATE TABLE "class_subject_requirement" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "class_id" INTEGER NOT NULL,
          "subject_id" INTEGER NOT NULL,
          "required_periods_per_week" INTEGER NOT NULL CHECK ("required_periods_per_week" > 0),
          "allow_split_assignment" BOOLEAN NOT NULL DEFAULT 0,
          "is_deleted" BOOLEAN NOT NULL DEFAULT 0,
          "deleted_at" DATETIME NULL,
          "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "UQ_class_subject_requirement_class_subject" UNIQUE ("class_id", "subject_id"),
          CONSTRAINT "FK_class_subject_requirement_class" FOREIGN KEY ("class_id") REFERENCES "class_group" ("id"),
          CONSTRAINT "FK_class_subject_requirement_subject" FOREIGN KEY ("subject_id") REFERENCES "subject" ("id")
        )
      `);
    }

    const hasTeacherSubjectCapability = await queryRunner.hasTable('teacher_subject_capability');
    if (!hasTeacherSubjectCapability) {
      await queryRunner.query(`
        CREATE TABLE "teacher_subject_capability" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "teacher_id" INTEGER NOT NULL,
          "subject_id" INTEGER NOT NULL,
          "capability_level" TEXT NOT NULL CHECK ("capability_level" IN ('primary', 'allowed')),
          "is_deleted" BOOLEAN NOT NULL DEFAULT 0,
          "deleted_at" DATETIME NULL,
          "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "UQ_teacher_subject_capability_teacher_subject" UNIQUE ("teacher_id", "subject_id"),
          CONSTRAINT "FK_teacher_subject_capability_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teacher" ("id"),
          CONSTRAINT "FK_teacher_subject_capability_subject" FOREIGN KEY ("subject_id") REFERENCES "subject" ("id")
        )
      `);
    }

    const hasTeachingAssignment = await queryRunner.hasTable('teaching_assignment');
    if (!hasTeachingAssignment) {
      await queryRunner.query(`
        CREATE TABLE "teaching_assignment" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "class_subject_requirement_id" INTEGER NOT NULL,
          "teacher_id" INTEGER NOT NULL,
          "assigned_periods_per_week" INTEGER NOT NULL CHECK ("assigned_periods_per_week" > 0),
          "is_fixed" BOOLEAN NOT NULL DEFAULT 1,
          "source" TEXT NOT NULL DEFAULT 'manual' CHECK ("source" IN ('manual', 'solver', 'migration')),
          "is_deleted" BOOLEAN NOT NULL DEFAULT 0,
          "deleted_at" DATETIME NULL,
          "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "UQ_teaching_assignment_requirement_teacher" UNIQUE ("class_subject_requirement_id", "teacher_id"),
          CONSTRAINT "FK_teaching_assignment_requirement" FOREIGN KEY ("class_subject_requirement_id") REFERENCES "class_subject_requirement" ("id"),
          CONSTRAINT "FK_teaching_assignment_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teacher" ("id")
        )
      `);
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_class_subject_requirement_class_id"
      ON "class_subject_requirement" ("class_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_class_subject_requirement_subject_id"
      ON "class_subject_requirement" ("subject_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_teacher_subject_capability_teacher_id"
      ON "teacher_subject_capability" ("teacher_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_teacher_subject_capability_subject_id"
      ON "teacher_subject_capability" ("subject_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_teaching_assignment_requirement_id"
      ON "teaching_assignment" ("class_subject_requirement_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_teaching_assignment_teacher_id"
      ON "teaching_assignment" ("teacher_id")
    `);

    logger.info('Migration applied: Created canonical assignment tables');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_teaching_assignment_teacher_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_teaching_assignment_requirement_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_teacher_subject_capability_subject_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_teacher_subject_capability_teacher_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_class_subject_requirement_subject_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_class_subject_requirement_class_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teaching_assignment"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teacher_subject_capability"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "class_subject_requirement"`);

    logger.info('Migration reverted: Dropped canonical assignment tables');
  }
}
