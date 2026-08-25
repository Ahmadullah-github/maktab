import { MigrationInterface, QueryRunner, TableCheck, TableColumn } from 'typeorm';
import { logger } from '../../utils/logger';

const createTeacherTriggers = async (queryRunner: QueryRunner): Promise<void> => {
  await queryRunner.query(`
    CREATE TRIGGER "TRG_teacher_contract_insert"
    BEFORE INSERT ON "teacher"
    FOR EACH ROW BEGIN
      SELECT CASE WHEN
        TRIM(NEW."fullName") = '' OR
        TRIM(COALESCE(NEW."staffCode", '')) = '' OR
        NEW."employmentType" NOT IN ('full_time', 'part_time') OR
        COALESCE(NEW."timePreference", 'any') NOT IN ('any', 'morning', 'afternoon') OR
        NEW."maxPeriodsPerWeek" < 0
      THEN RAISE(ABORT, 'invalid teacher contract') END;
    END
  `);
  await queryRunner.query(`
    CREATE TRIGGER "TRG_teacher_contract_update"
    BEFORE UPDATE ON "teacher"
    FOR EACH ROW BEGIN
      SELECT CASE WHEN
        TRIM(NEW."fullName") = '' OR
        TRIM(COALESCE(NEW."staffCode", '')) = '' OR
        NEW."employmentType" NOT IN ('full_time', 'part_time') OR
        COALESCE(NEW."timePreference", 'any') NOT IN ('any', 'morning', 'afternoon') OR
        NEW."maxPeriodsPerWeek" < 0
      THEN RAISE(ABORT, 'invalid teacher contract') END;
    END
  `);
};

const createTeacherStaffCodeIndex = async (queryRunner: QueryRunner): Promise<void> => {
  // Keep this expression index out of TypeORM's SQLite table-rebuild path. Its
  // schema reader cannot represent COALESCE/LOWER expressions as column names.
  await queryRunner.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "UQ_teacher_scope_staff_code"
    ON "teacher" (COALESCE("schoolId", -1), LOWER(TRIM("staffCode")))
  `);
};

export class SimplifyTeacherAvailability1784800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_teacher_contract_update"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_teacher_contract_insert"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_teacher_scope_staff_code"`);

    const table = await queryRunner.getTable('teacher');
    if (!table) throw new Error('teacher table is missing');
    const workloadCheck = table.checks.find(
      (check) => check.name === 'CHK_teacher_workload_nonnegative'
    );
    if (workloadCheck) await queryRunner.dropCheckConstraint(table, workloadCheck);

    for (const columnName of ['availability', 'maxPeriodsPerDay', 'maxConsecutivePeriods']) {
      const current = await queryRunner.getTable('teacher');
      const column = current?.findColumnByName(columnName);
      if (current && column) await queryRunner.dropColumn(current, column);
    }

    await queryRunner.createCheckConstraint(
      'teacher',
      new TableCheck({
        name: 'CHK_teacher_workload_nonnegative',
        expression: '"maxPeriodsPerWeek" >= 0',
      })
    );
    await createTeacherStaffCodeIndex(queryRunner);
    await createTeacherTriggers(queryRunner);
    logger.info('Migration applied: simplified teacher availability and workload constraints');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_teacher_contract_update"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_teacher_contract_insert"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_teacher_scope_staff_code"`);
    const table = await queryRunner.getTable('teacher');
    if (!table) throw new Error('teacher table is missing');
    const workloadCheck = table.checks.find(
      (check) => check.name === 'CHK_teacher_workload_nonnegative'
    );
    if (workloadCheck) await queryRunner.dropCheckConstraint(table, workloadCheck);

    await queryRunner.addColumns('teacher', [
      new TableColumn({ name: 'availability', type: 'text', isNullable: false, default: "'{}'" }),
      new TableColumn({ name: 'maxPeriodsPerDay', type: 'integer', isNullable: true }),
      new TableColumn({ name: 'maxConsecutivePeriods', type: 'integer', isNullable: true }),
    ]);
    await queryRunner.createCheckConstraint(
      'teacher',
      new TableCheck({
        name: 'CHK_teacher_workload_nonnegative',
        expression:
          '"maxPeriodsPerWeek" >= 0 AND ("maxPeriodsPerDay" IS NULL OR "maxPeriodsPerDay" >= 0) AND ("maxConsecutivePeriods" IS NULL OR "maxConsecutivePeriods" >= 0)',
      })
    );
    await createTeacherStaffCodeIndex(queryRunner);
    await createTeacherTriggers(queryRunner);
  }
}
