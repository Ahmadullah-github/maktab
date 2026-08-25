import { MigrationInterface, QueryRunner } from 'typeorm';
import { logger } from '../../utils/logger';

/**
 * Introduces a stable teacher identity and one employment-status contract.
 * Existing installations get deterministic legacy codes so the migration is
 * upgrade-safe; users can replace those codes through the normal edit flow.
 */
export class HardenTeacherContracts1784400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('teacher');
    if (!table) throw new Error('teacher table is missing');

    if (!table.findColumnByName('staffCode')) {
      await queryRunner.query(`ALTER TABLE "teacher" ADD COLUMN "staffCode" TEXT`);
    }
    if (!table.findColumnByName('employmentType')) {
      await queryRunner.query(
        `ALTER TABLE "teacher" ADD COLUMN "employmentType" TEXT NOT NULL DEFAULT 'full_time'`
      );
    }

    await queryRunner.query(`
      UPDATE "teacher"
      SET "staffCode" = 'T-' || printf('%05d', "id")
      WHERE "staffCode" IS NULL OR TRIM("staffCode") = ''
    `);
    await queryRunner.query(`
      UPDATE "teacher"
      SET "fullName" = TRIM("fullName"),
          "staffCode" = UPPER(TRIM("staffCode")),
          "availability" = '{}',
          "timePreference" = CASE LOWER(TRIM(COALESCE("timePreference", '')))
            WHEN 'morning' THEN 'morning'
            WHEN 'afternoon' THEN 'afternoon'
            ELSE 'any'
          END
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_teacher_scope_staff_code"
      ON "teacher" (COALESCE("schoolId", -1), LOWER(TRIM("staffCode")))
    `);
    await queryRunner.query(`
      CREATE TRIGGER IF NOT EXISTS "TRG_teacher_contract_insert"
      BEFORE INSERT ON "teacher"
      FOR EACH ROW BEGIN
        SELECT CASE WHEN
          TRIM(NEW."fullName") = '' OR
          TRIM(COALESCE(NEW."staffCode", '')) = '' OR
          NEW."employmentType" NOT IN ('full_time', 'part_time') OR
          COALESCE(NEW."timePreference", 'any') NOT IN ('any', 'morning', 'afternoon') OR
          NEW."maxPeriodsPerWeek" < 0 OR
          COALESCE(NEW."maxPeriodsPerDay", 0) < 0 OR
          COALESCE(NEW."maxConsecutivePeriods", 0) < 0
        THEN RAISE(ABORT, 'invalid teacher contract') END;
      END
    `);
    await queryRunner.query(`
      CREATE TRIGGER IF NOT EXISTS "TRG_teacher_contract_update"
      BEFORE UPDATE ON "teacher"
      FOR EACH ROW BEGIN
        SELECT CASE WHEN
          TRIM(NEW."fullName") = '' OR
          TRIM(COALESCE(NEW."staffCode", '')) = '' OR
          NEW."employmentType" NOT IN ('full_time', 'part_time') OR
          COALESCE(NEW."timePreference", 'any') NOT IN ('any', 'morning', 'afternoon') OR
          NEW."maxPeriodsPerWeek" < 0 OR
          COALESCE(NEW."maxPeriodsPerDay", 0) < 0 OR
          COALESCE(NEW."maxConsecutivePeriods", 0) < 0
        THEN RAISE(ABORT, 'invalid teacher contract') END;
      END
    `);

    logger.info('Migration applied: Hardened teacher identity and employment contracts');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_teacher_contract_update"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_teacher_contract_insert"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_teacher_scope_staff_code"`);
    // SQLite cannot safely drop these columns while older application versions
    // still read the table. The down migration deliberately removes enforcement
    // only and preserves data.
  }
}
