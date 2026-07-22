import { MigrationInterface, QueryRunner } from "typeorm";
import { logger } from "../../utils/logger";

/**
 * Migration: Add Afghanistan-specific fields to SchoolConfig table
 * 
 * This migration adds:
 * - schoolId for future multi-tenancy
 * - Ministry validation settings (enableMinistryValidation, ministryValidationMode, customCurriculumMode)
 * - Low-resource mode setting (lowResourceMode)
 * - Day configuration (daysOfWeekJson, periodsPerDayMapJson, defaultPeriodsPerDay)
 * 
 * Requirements: 7.1
 */
export class AddAfghanistanFieldsToSchoolConfig1734530000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if columns already exist (for idempotency)
    const table = await queryRunner.getTable("school_config");
    const existingColumns = table?.columns.map(c => c.name) || [];

    // Add schoolId column for future multi-tenancy
    if (!existingColumns.includes("schoolId")) {
      await queryRunner.query(
        `ALTER TABLE school_config ADD COLUMN "schoolId" integer NULL`
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_school_config_school_id" ON "school_config" ("schoolId")`
      );
    }

    // Ministry Validation Settings
    if (!existingColumns.includes("enableMinistryValidation")) {
      await queryRunner.query(
        `ALTER TABLE school_config ADD COLUMN "enableMinistryValidation" boolean DEFAULT 0`
      );
    }

    if (!existingColumns.includes("ministryValidationMode")) {
      await queryRunner.query(
        `ALTER TABLE school_config ADD COLUMN "ministryValidationMode" text DEFAULT 'warn'`
      );
    }

    if (!existingColumns.includes("customCurriculumMode")) {
      await queryRunner.query(
        `ALTER TABLE school_config ADD COLUMN "customCurriculumMode" boolean DEFAULT 0`
      );
    }

    // Resource Settings
    if (!existingColumns.includes("lowResourceMode")) {
      await queryRunner.query(
        `ALTER TABLE school_config ADD COLUMN "lowResourceMode" boolean DEFAULT 0`
      );
    }

    // Day Configuration
    if (!existingColumns.includes("daysOfWeekJson")) {
      await queryRunner.query(
        `ALTER TABLE school_config ADD COLUMN "daysOfWeekJson" text NULL`
      );
    }

    if (!existingColumns.includes("periodsPerDayMapJson")) {
      await queryRunner.query(
        `ALTER TABLE school_config ADD COLUMN "periodsPerDayMapJson" text NULL`
      );
    }

    if (!existingColumns.includes("defaultPeriodsPerDay")) {
      await queryRunner.query(
        `ALTER TABLE school_config ADD COLUMN "defaultPeriodsPerDay" integer DEFAULT 7`
      );
    }

    logger.info("Migration applied: Added Afghanistan-specific fields to school_config table");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index first
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_school_config_school_id"`
    );

    // Drop columns (SQLite doesn't support DROP COLUMN directly in older versions,
    // but TypeORM handles this via table recreation)
    const columnsToRemove = [
      "schoolId",
      "enableMinistryValidation",
      "ministryValidationMode",
      "customCurriculumMode",
      "lowResourceMode",
      "daysOfWeekJson",
      "periodsPerDayMapJson",
      "defaultPeriodsPerDay"
    ];

    for (const column of columnsToRemove) {
      try {
        await queryRunner.query(
          `ALTER TABLE school_config DROP COLUMN IF EXISTS "${column}"`
        );
      } catch (error) {
        // SQLite may not support DROP COLUMN, log and continue
        logger.warn(`Could not drop column ${column}`, { error });
      }
    }

    logger.info("Migration reverted: Removed Afghanistan-specific fields from school_config table");
  }
}
