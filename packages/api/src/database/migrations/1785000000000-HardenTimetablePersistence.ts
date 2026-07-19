import type { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenTimetablePersistence1785000000000 implements MigrationInterface {
  name = 'HardenTimetablePersistence1785000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('timetable', 'revision'))) {
      await queryRunner.query(
        'ALTER TABLE "timetable" ADD COLUMN "revision" integer NOT NULL DEFAULT (1)'
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('timetable', 'revision')) {
      await queryRunner.query('ALTER TABLE "timetable" DROP COLUMN "revision"');
    }
  }
}
