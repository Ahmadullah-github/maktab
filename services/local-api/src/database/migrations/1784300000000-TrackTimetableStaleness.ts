import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TrackTimetableStaleness1784300000000 implements MigrationInterface {
  name = 'TrackTimetableStaleness1784300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('timetable', 'isStale'))) {
      await queryRunner.query(
        'ALTER TABLE "timetable" ADD COLUMN "isStale" boolean NOT NULL DEFAULT (0)'
      );
    }
    if (!(await queryRunner.hasColumn('timetable', 'staleReason'))) {
      await queryRunner.query('ALTER TABLE "timetable" ADD COLUMN "staleReason" text');
    }
    if (!(await queryRunner.hasColumn('timetable', 'staleAt'))) {
      await queryRunner.query('ALTER TABLE "timetable" ADD COLUMN "staleAt" datetime');
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('timetable', 'staleAt')) {
      await queryRunner.query('ALTER TABLE "timetable" DROP COLUMN "staleAt"');
    }
    if (await queryRunner.hasColumn('timetable', 'staleReason')) {
      await queryRunner.query('ALTER TABLE "timetable" DROP COLUMN "staleReason"');
    }
    if (await queryRunner.hasColumn('timetable', 'isStale')) {
      await queryRunner.query('ALTER TABLE "timetable" DROP COLUMN "isStale"');
    }
  }
}
