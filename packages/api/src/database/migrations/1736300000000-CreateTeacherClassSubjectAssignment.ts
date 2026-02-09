import { MigrationInterface, QueryRunner } from 'typeorm';
import { logger } from '../../utils/logger';

/**
 * Migration: Create TeacherClassSubjectAssignment table
 *
 * This migration creates the new table for multi-teacher subject assignments.
 * Supports scenarios where different teachers teach different periods of the
 * same subject for the same class.
 *
 * Requirements: Multi-Teacher Assignment Feature - Phase 4.1
 */
export class CreateTeacherClassSubjectAssignment1736300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table already exists (for idempotency)
    const tableExists = await queryRunner.hasTable('teacher_class_subject_assignment');

    if (!tableExists) {
      // Create the table
      await queryRunner.query(`
        CREATE TABLE "teacher_class_subject_assignment" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "teacherId" INTEGER NOT NULL,
          "classId" INTEGER NOT NULL,
          "subjectId" INTEGER NOT NULL,
          "periodsPerWeek" INTEGER NOT NULL,
          "isFixed" BOOLEAN DEFAULT 1,
          "schoolId" INTEGER NULL,
          "isDeleted" BOOLEAN DEFAULT 0,
          "deletedAt" DATETIME NULL,
          "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create unique constraint on (teacherId, classId, subjectId)
      await queryRunner.query(`
        CREATE UNIQUE INDEX "UQ_tcsa_teacher_class_subject"
        ON "teacher_class_subject_assignment" ("teacherId", "classId", "subjectId")
        WHERE "isDeleted" = 0
      `);

      // Create index on (classId, subjectId) for lookups
      await queryRunner.query(`
        CREATE INDEX "IDX_tcsa_class_subject"
        ON "teacher_class_subject_assignment" ("classId", "subjectId")
      `);

      // Create index on teacherId for teacher-based queries
      await queryRunner.query(`
        CREATE INDEX "IDX_tcsa_teacher"
        ON "teacher_class_subject_assignment" ("teacherId")
      `);

      // Create index on schoolId for future multi-tenancy
      await queryRunner.query(`
        CREATE INDEX "IDX_tcsa_school"
        ON "teacher_class_subject_assignment" ("schoolId")
      `);

      logger.info('Migration applied: Created teacher_class_subject_assignment table with indexes');
    } else {
      logger.info('Migration skipped: teacher_class_subject_assignment table already exists');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tcsa_school"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tcsa_teacher"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tcsa_class_subject"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tcsa_teacher_class_subject"`);

    // Drop the table
    await queryRunner.query(`DROP TABLE IF EXISTS "teacher_class_subject_assignment"`);

    logger.info('Migration reverted: Dropped teacher_class_subject_assignment table');
  }
}
