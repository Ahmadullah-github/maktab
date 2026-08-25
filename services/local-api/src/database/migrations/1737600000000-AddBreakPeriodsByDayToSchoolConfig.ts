import { MigrationInterface, QueryRunner } from 'typeorm';
import { logger } from '../../utils/logger';

export class AddBreakPeriodsByDayToSchoolConfig1737600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('school_config');
    const existingColumns = table?.columns.map((column) => column.name) || [];

    if (!existingColumns.includes('breakPeriodsByDayJson')) {
      await queryRunner.query(
        'ALTER TABLE school_config ADD COLUMN "breakPeriodsByDayJson" text NULL'
      );
    }

    logger.info('Migration applied: Added breakPeriodsByDayJson to school_config table');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(
        'ALTER TABLE school_config DROP COLUMN IF EXISTS "breakPeriodsByDayJson"'
      );
    } catch (error) {
      logger.warn('Could not drop breakPeriodsByDayJson column', { error });
    }

    logger.info('Migration reverted: Removed breakPeriodsByDayJson from school_config table');
  }
}
