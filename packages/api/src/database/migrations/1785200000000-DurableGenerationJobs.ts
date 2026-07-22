import { MigrationInterface, QueryRunner } from 'typeorm';

export class DurableGenerationJobs1785200000000 implements MigrationInterface {
  name = 'DurableGenerationJobs1785200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('generation_job'))) {
      await queryRunner.query(`CREATE TABLE "generation_job" (
      "id" text PRIMARY KEY NOT NULL,
      "mode" text NOT NULL DEFAULT ('quick'),
      "status" text NOT NULL DEFAULT ('queued'),
      "schoolId" integer,
      "sourceTimetableId" integer,
      "resultTimetableId" integer,
      "resultCandidateId" integer,
      "progress" real NOT NULL DEFAULT (0),
      "phase" text,
      "phaseFarsi" text,
      "cancelRequested" boolean NOT NULL DEFAULT (0),
      "requestJson" text NOT NULL DEFAULT ('{}'),
      "effectiveConfigJson" text NOT NULL DEFAULT ('{}'),
      "metricsJson" text NOT NULL DEFAULT ('{}'),
      "issuesJson" text NOT NULL DEFAULT ('[]'),
      "failureCode" text,
      "diagnosticId" text,
      "startedAt" datetime,
      "finishedAt" datetime,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      CONSTRAINT "FK_generation_job_source_timetable" FOREIGN KEY ("sourceTimetableId") REFERENCES "timetable" ("id") ON DELETE SET NULL,
      CONSTRAINT "FK_generation_job_result_timetable" FOREIGN KEY ("resultTimetableId") REFERENCES "timetable" ("id") ON DELETE SET NULL
      )`);
    }
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_generation_job_status_created" ON "generation_job" ("status", "createdAt")'
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_generation_job_one_active" ON "generation_job" (1)
       WHERE "status" IN ('queued', 'preparing', 'analyzing', 'solving', 'saving')`
    );

    if (!(await queryRunner.hasTable('timetable_candidate'))) {
      await queryRunner.query(`CREATE TABLE "timetable_candidate" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "jobId" text NOT NULL,
      "schoolId" integer,
      "sourceTimetableId" integer,
      "acceptedTimetableId" integer,
      "status" text NOT NULL DEFAULT ('available'),
      "data" text NOT NULL,
      "sourceQualityScore" real,
      "qualityScore" real,
      "objectiveValue" real,
      "bestBound" real,
      "relativeGap" real,
      "interrupted" boolean NOT NULL DEFAULT (0),
      "metricsJson" text NOT NULL DEFAULT ('{}'),
      "acceptedAt" datetime,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      CONSTRAINT "UQ_timetable_candidate_job" UNIQUE ("jobId"),
      CONSTRAINT "FK_candidate_job" FOREIGN KEY ("jobId") REFERENCES "generation_job" ("id") ON DELETE CASCADE,
      CONSTRAINT "FK_candidate_source_timetable" FOREIGN KEY ("sourceTimetableId") REFERENCES "timetable" ("id") ON DELETE SET NULL,
      CONSTRAINT "FK_candidate_accepted_timetable" FOREIGN KEY ("acceptedTimetableId") REFERENCES "timetable" ("id") ON DELETE SET NULL
      )`);
    }
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_timetable_candidate_source_status" ON "timetable_candidate" ("sourceTimetableId", "status")'
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_timetable_candidate_source_status"');
    await queryRunner.query('DROP TABLE "timetable_candidate"');
    await queryRunner.query('DROP INDEX "UQ_generation_job_one_active"');
    await queryRunner.query('DROP INDEX "IDX_generation_job_status_created"');
    await queryRunner.query('DROP TABLE "generation_job"');
  }
}
