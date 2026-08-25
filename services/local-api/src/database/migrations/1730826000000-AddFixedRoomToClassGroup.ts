import { MigrationInterface, QueryRunner } from 'typeorm';
import { logger } from '../../utils/logger';

/**
 * Migration: Add fixedRoomId column to ClassGroup table
 * This enables locking a class to a specific room as a hard constraint in timetable generation
 */
export class AddFixedRoomToClassGroup1730826000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('class_group');
    if (!table?.findColumnByName('fixedRoomId')) {
      await queryRunner.query(`ALTER TABLE class_group ADD COLUMN "fixedRoomId" integer NULL`);
    }

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_class_group_fixed_room" ON "class_group" ("fixedRoomId")`
    );

    logger.info('Migration applied: Added fixedRoomId to class_group table');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index first
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_class_group_fixed_room"`);

    // Drop column
    await queryRunner.query(`ALTER TABLE class_group DROP COLUMN IF EXISTS "fixedRoomId"`);

    logger.info('Migration reverted: Removed fixedRoomId from class_group table');
  }
}
