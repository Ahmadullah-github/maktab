import { MigrationInterface, QueryRunner, TableCheck, TableColumn } from 'typeorm';
import { logger } from '../../utils/logger';

export class ClassRequirementPeriodMode1784900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const initialTable = await queryRunner.getTable('class_subject_requirement');
    if (!initialTable) throw new Error('class_subject_requirement table is missing');
    if (!initialTable.findColumnByName('period_mode')) {
      await queryRunner.addColumn(
        'class_subject_requirement',
        new TableColumn({
          name: 'period_mode',
          type: 'text',
          isNullable: false,
          default: "'inherited'",
        })
      );
    }

    // Existing differences from the subject's grade default are deliberate class exceptions.
    await queryRunner.query(`
      UPDATE "class_subject_requirement"
      SET "period_mode" = 'class_override'
      WHERE EXISTS (
        SELECT 1
        FROM "subject"
        WHERE "subject"."id" = "class_subject_requirement"."subject_id"
          AND "subject"."periodsPerWeek" IS NOT NULL
          AND "subject"."periodsPerWeek" <> "class_subject_requirement"."required_periods_per_week"
      )
    `);

    const currentTable = await queryRunner.getTable('class_subject_requirement');
    const hasModeCheck = currentTable?.checks.some(
      (constraint) => constraint.name === 'CHK_class_subject_requirement_period_mode'
    );
    if (!hasModeCheck) {
      await queryRunner.createCheckConstraint(
        'class_subject_requirement',
        new TableCheck({
          name: 'CHK_class_subject_requirement_period_mode',
          expression: '"period_mode" IN (\'inherited\', \'class_override\')',
        })
      );
    }
    logger.info('Migration applied: class requirement period inheritance mode');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('class_subject_requirement');
    const check = table?.checks.find(
      (constraint) => constraint.name === 'CHK_class_subject_requirement_period_mode'
    );
    if (table && check) await queryRunner.dropCheckConstraint(table, check);

    const current = await queryRunner.getTable('class_subject_requirement');
    const column = current?.findColumnByName('period_mode');
    if (current && column) await queryRunner.dropColumn(current, column);
  }
}
