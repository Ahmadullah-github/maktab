import { MigrationInterface, QueryRunner } from 'typeorm';
import { AFGHANISTAN_CURRICULUM_TEMPLATE } from '../../curriculum/afghanistanCurriculum';
import { schoolConfigPeriodTriggerBody } from './1784000000000-HardenPeriodConfiguration';

interface LegacyOverride { code: string; periodsPerWeek?: number; isRemoved?: boolean }
interface LegacySubject { name: string; nameEn?: string; code: string; periodsPerWeek: number; isDifficult?: boolean; requiredRoomType?: string }

function parseArray<T>(value: unknown): T[] {
  try { const parsed = JSON.parse(String(value ?? '[]')); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

export class SchoolOwnedCurriculum1785100000000 implements MigrationInterface {
  name = 'SchoolOwnedCurriculum1785100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const legacy = await queryRunner.query('SELECT * FROM curriculum_config') as Array<Record<string, unknown>>;
    await queryRunner.query(`CREATE TABLE "curriculum_config_next" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "schoolId" integer,
      "grade" integer NOT NULL,
      "subjectsJson" text NOT NULL DEFAULT ('[]'),
      "revision" integer NOT NULL DEFAULT (1),
      "isDeleted" boolean NOT NULL DEFAULT (0),
      "deletedAt" datetime,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`);
    for (const row of legacy) {
      const grade = Number(row.grade);
      const overrides = parseArray<LegacyOverride>(row.overridesJson);
      const overrideByCode = new Map(overrides.map((entry) => [entry.code, entry]));
      const baseline = (row.useMinistryDefaults
        ? AFGHANISTAN_CURRICULUM_TEMPLATE[`grade_${grade}`] ?? []
        : [])
        .filter((entry) => !overrideByCode.get(entry.code)?.isRemoved)
        .map((entry, index) => ({
          itemId: `migrated-${grade}-${index + 1}-${entry.code}`,
          name: entry.name,
          nameEn: entry.nameEn,
          code: entry.code,
          periodsPerWeek: overrideByCode.get(entry.code)?.periodsPerWeek ?? entry.periodsPerWeek,
          isDifficult: entry.isDifficult,
          requiredRoomType: entry.requiredRoomType,
        }));
      const custom = parseArray<LegacySubject>(row.customSubjectsJson).map((entry, index) => ({
        ...entry,
        itemId: `migrated-${grade}-custom-${index + 1}-${entry.code}`,
      }));
      await queryRunner.query(
        `INSERT INTO curriculum_config_next (id, schoolId, grade, subjectsJson, revision, isDeleted, deletedAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        [row.id, row.schoolId, grade, JSON.stringify([...baseline, ...custom]), row.isDeleted, row.deletedAt, row.createdAt, row.updatedAt]
      );
    }
    await queryRunner.query('DROP TABLE curriculum_config');
    await queryRunner.query('ALTER TABLE curriculum_config_next RENAME TO curriculum_config');
    await queryRunner.query('CREATE INDEX "IDX_curriculum_config_school_grade" ON "curriculum_config" ("schoolId", "grade")');
    await queryRunner.query('CREATE INDEX "IDX_curriculum_config_school" ON "curriculum_config" ("schoolId")');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_curriculum_config_default_grade" ON "curriculum_config" ("grade") WHERE "schoolId" IS NULL AND "isDeleted" = 0');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_curriculum_config_school_grade" ON "curriculum_config" ("schoolId", "grade") WHERE "schoolId" IS NOT NULL AND "isDeleted" = 0');

    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_insert"');
    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_update"');
    await queryRunner.query('ALTER TABLE school_config DROP COLUMN enableMinistryValidation');
    await queryRunner.query('ALTER TABLE school_config DROP COLUMN ministryValidationMode');
    await queryRunner.query('ALTER TABLE school_config DROP COLUMN customCurriculumMode');
    await queryRunner.query(`CREATE TRIGGER "TR_school_config_periods_insert" BEFORE INSERT ON "school_config" BEGIN ${schoolConfigPeriodTriggerBody()} END`);
    await queryRunner.query(`CREATE TRIGGER "TR_school_config_periods_update" BEFORE UPDATE ON "school_config" BEGIN ${schoolConfigPeriodTriggerBody()} END`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "curriculum_config_legacy" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "schoolId" integer,
      "grade" integer NOT NULL,
      "useMinistryDefaults" boolean NOT NULL DEFAULT (0),
      "overridesJson" text NOT NULL DEFAULT ('[]'),
      "customSubjectsJson" text NOT NULL DEFAULT ('[]'),
      "isDeleted" boolean NOT NULL DEFAULT (0),
      "deletedAt" datetime,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`);
    await queryRunner.query(`
      INSERT INTO curriculum_config_legacy (
        id, schoolId, grade, useMinistryDefaults, overridesJson,
        customSubjectsJson, isDeleted, deletedAt, createdAt, updatedAt
      )
      SELECT
        id, schoolId, grade, 0, '[]', subjectsJson,
        isDeleted, deletedAt, createdAt, updatedAt
      FROM curriculum_config
    `);
    await queryRunner.query('DROP TABLE curriculum_config');
    await queryRunner.query('ALTER TABLE curriculum_config_legacy RENAME TO curriculum_config');
    await queryRunner.query('CREATE INDEX "IDX_curriculum_config_school_grade" ON "curriculum_config" ("schoolId", "grade")');
    await queryRunner.query('CREATE INDEX "IDX_curriculum_config_school" ON "curriculum_config" ("schoolId")');

    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_insert"');
    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_update"');
    await queryRunner.query('ALTER TABLE school_config ADD COLUMN enableMinistryValidation boolean NOT NULL DEFAULT (0)');
    await queryRunner.query("ALTER TABLE school_config ADD COLUMN ministryValidationMode text NOT NULL DEFAULT ('off')");
    await queryRunner.query('ALTER TABLE school_config ADD COLUMN customCurriculumMode boolean NOT NULL DEFAULT (0)');
    await queryRunner.query(`CREATE TRIGGER "TR_school_config_periods_insert" BEFORE INSERT ON "school_config" BEGIN ${schoolConfigPeriodTriggerBody()} END`);
    await queryRunner.query(`CREATE TRIGGER "TR_school_config_periods_update" BEFORE UPDATE ON "school_config" BEGIN ${schoolConfigPeriodTriggerBody()} END`);
  }
}
