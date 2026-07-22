import { MigrationInterface, QueryRunner } from 'typeorm';
import { schoolConfigPeriodTriggerBody } from './1784000000000-HardenPeriodConfiguration';

const RAMADAN_COLUMNS = [
  'ramadanModeEnabled',
  'ramadanPeriodDuration',
  'ramadanBreakConfigJson',
] as const;

async function recreatePeriodTriggers(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_insert"');
  await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_update"');
  await queryRunner.query(
    `CREATE TRIGGER "TR_school_config_periods_insert" BEFORE INSERT ON "school_config" BEGIN ${schoolConfigPeriodTriggerBody()} END`
  );
  await queryRunner.query(
    `CREATE TRIGGER "TR_school_config_periods_update" BEFORE UPDATE ON "school_config" BEGIN ${schoolConfigPeriodTriggerBody()} END`
  );
}

export class RemoveRamadanMode1785300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_insert"');
    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_update"');

    const table = await queryRunner.getTable('school_config');
    const columnsToDrop = RAMADAN_COLUMNS.filter((name) => table?.findColumnByName(name));
    for (const column of columnsToDrop) {
      await queryRunner.query(`ALTER TABLE "school_config" DROP COLUMN "${column}"`);
    }

    await recreatePeriodTriggers(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_insert"');
    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_update"');

    const table = await queryRunner.getTable('school_config');
    const existingColumns = new Set(table?.columns.map((column) => column.name) ?? []);
    if (!existingColumns.has('ramadanModeEnabled')) {
      await queryRunner.query(
        'ALTER TABLE "school_config" ADD COLUMN "ramadanModeEnabled" boolean NOT NULL DEFAULT 0'
      );
    }
    if (!existingColumns.has('ramadanPeriodDuration')) {
      await queryRunner.query(
        'ALTER TABLE "school_config" ADD COLUMN "ramadanPeriodDuration" integer NOT NULL DEFAULT 35'
      );
    }
    if (!existingColumns.has('ramadanBreakConfigJson')) {
      await queryRunner.query(
        'ALTER TABLE "school_config" ADD COLUMN "ramadanBreakConfigJson" text NULL'
      );
    }

    await recreatePeriodTriggers(queryRunner);
  }
}
