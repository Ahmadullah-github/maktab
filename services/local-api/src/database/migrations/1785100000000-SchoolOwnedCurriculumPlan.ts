import { createHash } from 'node:crypto';
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { AFGHANISTAN_CURRICULUM_TEMPLATE } from '../../curriculum/afghanistanCurriculum';

type LegacyConfig = {
  id: number;
  schoolId: number | null;
  grade: number;
  overridesJson: string;
  customSubjectsJson: string;
  isDeleted: number;
};

type LegacySubject = {
  id: number;
  schoolId: number | null;
  grade: number | null;
  name: string;
  code: string | null;
  periodsPerWeek: number | null;
  isDifficult: number;
  requiredRoomType: string | null;
  meta: string | null;
  isDeleted: number;
};

function normalized(value: string | null | undefined): string {
  return (value ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('fa');
}

function stableItemId(schoolId: number | null, grade: number, code: string): string {
  const hex = createHash('sha256')
    .update(`maktab-school-curriculum:${schoolId ?? 'default'}:${grade}:${normalized(code)}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function parseArray(value: string): Array<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function legacyEffectiveCurriculum(grade: number, config: LegacyConfig) {
  const overrides = parseArray(config.overridesJson);
  const overrideByCode = new Map(
    overrides.map((entry) => [String(entry.code ?? ''), entry])
  );
  const ministry = (AFGHANISTAN_CURRICULUM_TEMPLATE[`grade_${grade}`] ?? [])
    .filter((item) => !overrideByCode.get(item.code)?.isRemoved)
    .map((item) => ({
      ...item,
      periodsPerWeek:
        typeof overrideByCode.get(item.code)?.periodsPerWeek === 'number'
          ? Number(overrideByCode.get(item.code)?.periodsPerWeek)
          : item.periodsPerWeek,
    }));
  const custom = parseArray(config.customSubjectsJson).flatMap((entry) => {
    const name = String(entry.name ?? '').trim();
    const code = String(entry.code ?? '').trim();
    const periodsPerWeek = Number(entry.periodsPerWeek);
    if (!name || !code || !Number.isInteger(periodsPerWeek) || periodsPerWeek <= 0) return [];
    return [{
      name,
      nameEn: String(entry.nameEn ?? '').trim(),
      code,
      periodsPerWeek,
      isDifficult: Boolean(entry.isDifficult),
      requiredRoomType: entry.requiredRoomType ? String(entry.requiredRoomType) : undefined,
    }];
  });
  return [...ministry, ...custom];
}

function schoolKey(schoolId: number | null): string {
  return schoolId === null ? 'default' : String(schoolId);
}

function isLegacyCurriculumManaged(subject: LegacySubject): boolean {
  try {
    const meta = JSON.parse(subject.meta || '{}') as Record<string, unknown>;
    return meta.curriculumManaged === true;
  } catch {
    return false;
  }
}

function schoolConfigTriggerBody(): string {
  return `
    SELECT CASE WHEN
      NEW.periodsPerDay NOT BETWEEN 1 AND 12 OR
      NEW.defaultPeriodsPerDay NOT BETWEEN 1 AND 12 OR
      NEW.periodsPerDay <> NEW.defaultPeriodsPerDay OR NEW.periodDuration NOT BETWEEN 15 AND 120 OR
      NEW.ramadanPeriodDuration NOT BETWEEN 20 AND 60 OR NEW.daysPerWeek NOT BETWEEN 1 AND 7 OR
      NEW.revision < 1 OR NEW.schoolStartTime IS NULL OR length(NEW.schoolStartTime) <> 5 OR
      NEW.schoolStartTime NOT GLOB '[0-2][0-9]:[0-5][0-9]' OR
      CAST(substr(NEW.schoolStartTime, 1, 2) AS INTEGER) > 23 OR
      NEW.timezone IS NULL OR NEW.timezone NOT IN ('Asia/Kabul','Asia/Tehran','Asia/Dubai','Asia/Karachi')
    THEN RAISE(ABORT, 'invalid school_config scalar period configuration') END;

    SELECT CASE WHEN
      NEW.enablePrimary NOT IN (0,1) OR NEW.enableMiddle NOT IN (0,1) OR NEW.enableHigh NOT IN (0,1) OR
      NEW.dynamicPeriodsEnabled NOT IN (0,1) OR NEW.categoryPeriodsEnabled NOT IN (0,1) OR
      NEW.prayerBreaksEnabled NOT IN (0,1) OR NEW.ramadanModeEnabled NOT IN (0,1) OR
      NEW.autoPopulateCurriculum NOT IN (0,1) OR NEW.lowResourceMode NOT IN (0,1)
    THEN RAISE(ABORT, 'invalid school_config boolean') END;

    SELECT CASE WHEN NEW.daysOfWeekJson IS NULL OR json_valid(NEW.daysOfWeekJson) = 0
    THEN RAISE(ABORT, 'invalid school_config daysOfWeekJson') END;
    SELECT CASE WHEN json_type(NEW.daysOfWeekJson) <> 'array' OR
      json_array_length(NEW.daysOfWeekJson) < 1 OR NEW.daysPerWeek <> json_array_length(NEW.daysOfWeekJson) OR
      EXISTS (SELECT 1 FROM json_each(NEW.daysOfWeekJson) WHERE type <> 'text' OR value NOT IN ('Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday')) OR
      json_array_length(NEW.daysOfWeekJson) <> (SELECT COUNT(DISTINCT value) FROM json_each(NEW.daysOfWeekJson))
    THEN RAISE(ABORT, 'invalid school_config days shape') END;

    SELECT CASE WHEN NEW.periodsPerDayMapJson IS NULL OR json_valid(NEW.periodsPerDayMapJson) = 0
    THEN RAISE(ABORT, 'invalid school_config periodsPerDayMapJson') END;
    SELECT CASE WHEN json_type(NEW.periodsPerDayMapJson) <> 'object' OR EXISTS (
      SELECT 1 FROM json_each(NEW.periodsPerDayMapJson) WHERE key NOT IN ('Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday') OR type <> 'integer' OR value NOT BETWEEN 1 AND 12
    ) THEN RAISE(ABORT, 'invalid school_config period map shape') END;

    SELECT CASE WHEN NEW.categoryPeriodsMapJson IS NULL OR json_valid(NEW.categoryPeriodsMapJson) = 0
    THEN RAISE(ABORT, 'invalid school_config categoryPeriodsMapJson') END;
    SELECT CASE WHEN json_type(NEW.categoryPeriodsMapJson) <> 'object' OR EXISTS (
      SELECT 1 FROM json_each(NEW.categoryPeriodsMapJson) AS category WHERE category.key NOT IN ('Alpha-Primary','Beta-Primary','Middle','High') OR category.type <> 'object' OR EXISTS (
        SELECT 1 FROM json_each(category.value) WHERE key NOT IN ('Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday') OR type <> 'integer' OR value NOT BETWEEN 1 AND 12
      )
    ) THEN RAISE(ABORT, 'invalid school_config category map shape') END;

    SELECT CASE WHEN NEW.breakPeriods IS NULL OR json_valid(NEW.breakPeriods) = 0 OR
      NEW.breakPeriodsByDayJson IS NULL OR json_valid(NEW.breakPeriodsByDayJson) = 0 OR
      NEW.prayerBreaksJson IS NULL OR json_valid(NEW.prayerBreaksJson) = 0
    THEN RAISE(ABORT, 'invalid school_config break JSON') END;
    SELECT CASE WHEN json_type(NEW.breakPeriods) <> 'array' OR EXISTS (
      SELECT 1 FROM json_each(NEW.breakPeriods)
      WHERE type <> 'object' OR COALESCE(json_type(value, '$.afterPeriod'), '') <> 'integer' OR
        json_extract(value, '$.afterPeriod') NOT BETWEEN 1 AND 11 OR
        COALESCE(json_type(value, '$.duration'), '') <> 'integer' OR
        json_extract(value, '$.duration') NOT BETWEEN 5 AND 60
    ) OR json_array_length(NEW.breakPeriods) <> (
      SELECT COUNT(DISTINCT json_extract(value, '$.afterPeriod')) FROM json_each(NEW.breakPeriods)
    ) THEN RAISE(ABORT, 'invalid school_config break shape') END;
    SELECT CASE WHEN json_type(NEW.breakPeriodsByDayJson) <> 'object' OR EXISTS (
      SELECT 1 FROM json_each(NEW.breakPeriodsByDayJson) AS day
      WHERE day.key NOT IN ('Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday') OR
        day.type <> 'array' OR EXISTS (
          SELECT 1 FROM json_each(day.value)
          WHERE type <> 'object' OR COALESCE(json_type(value, '$.afterPeriod'), '') <> 'integer' OR
            json_extract(value, '$.afterPeriod') NOT BETWEEN 1 AND 11 OR
            COALESCE(json_type(value, '$.duration'), '') <> 'integer' OR
            json_extract(value, '$.duration') NOT BETWEEN 5 AND 60
        ) OR json_array_length(day.value) <> (
          SELECT COUNT(DISTINCT json_extract(value, '$.afterPeriod')) FROM json_each(day.value)
        )
    ) THEN RAISE(ABORT, 'invalid school_config day break shape') END;
    SELECT CASE WHEN json_type(NEW.prayerBreaksJson) <> 'array' OR EXISTS (
      SELECT 1 FROM json_each(NEW.prayerBreaksJson)
      WHERE type <> 'object' OR COALESCE(json_type(value, '$.name'), '') <> 'text' OR
        trim(json_extract(value, '$.name')) = '' OR
        COALESCE(json_type(value, '$.time'), '') <> 'text' OR
        length(json_extract(value, '$.time')) <> 5 OR
        json_extract(value, '$.time') NOT GLOB '[0-2][0-9]:[0-5][0-9]' OR
        CAST(substr(json_extract(value, '$.time'), 1, 2) AS INTEGER) > 23 OR
        COALESCE(json_type(value, '$.duration'), '') <> 'integer' OR
        json_extract(value, '$.duration') NOT BETWEEN 5 AND 60
    ) THEN RAISE(ABORT, 'invalid school_config prayer break shape') END;
  `;
}

async function installCurrentSchoolConfigTriggers(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_insert"');
  await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_update"');
  await queryRunner.query(
    `CREATE TRIGGER "TR_school_config_periods_insert" BEFORE INSERT ON "school_config" BEGIN ${schoolConfigTriggerBody()} END`
  );
  await queryRunner.query(
    `CREATE TRIGGER "TR_school_config_periods_update" BEFORE UPDATE ON "school_config" BEGIN ${schoolConfigTriggerBody()} END`
  );
}

export class SchoolOwnedCurriculumPlan1785100000000 implements MigrationInterface {
  name = 'SchoolOwnedCurriculumPlan1785100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasPlan = await queryRunner.hasTable('school_curriculum_plan');
    const hasItems = await queryRunner.hasTable('school_curriculum_item');
    if (hasPlan || hasItems) {
      const hasLegacyConfig = await queryRunner.hasTable('curriculum_config');
      const subjectTable = await queryRunner.getTable('subject');
      const schoolConfigTable = await queryRunner.getTable('school_config');
      const planTable = await queryRunner.getTable('school_curriculum_plan');
      const itemTable = await queryRunner.getTable('school_curriculum_item');
      const hasCompletePlanShape = [
        'id',
        'schoolId',
        'revision',
        'createdAt',
        'updatedAt',
      ].every((column) => planTable?.findColumnByName(column));
      const hasCompleteItemShape = [
        'id',
        'planId',
        'grade',
        'position',
        'name',
        'nameEn',
        'code',
        'normalizedCode',
        'weeklyPeriods',
        'isDifficult',
        'requiredRoomType',
        'createdAt',
        'updatedAt',
      ].every((column) => itemTable?.findColumnByName(column));
      const isCompleteCurrentSchema =
        hasPlan &&
        hasItems &&
        hasCompletePlanShape &&
        hasCompleteItemShape &&
        Boolean(subjectTable?.findColumnByName('curriculumItemId'));
      if (isCompleteCurrentSchema) {
        // A database with a complete synchronized schema but no migration ledger replays the
        // historical baseline first. That replay can recreate empty legacy artifacts; remove
        // them here without touching the already-materialized school curriculum data.
        await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_insert"');
        await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_update"');
        if (hasLegacyConfig) await queryRunner.query('DROP TABLE "curriculum_config"');
        for (const column of [
          'enableMinistryValidation',
          'ministryValidationMode',
          'customCurriculumMode',
        ]) {
          if (schoolConfigTable?.findColumnByName(column)) {
            await queryRunner.query(`ALTER TABLE "school_config" DROP COLUMN "${column}"`);
          }
        }
        await installCurrentSchoolConfigTriggers(queryRunner);
        return;
      }
      throw new Error(
        'School curriculum migration found a partially adopted schema; restore the automatic backup before retrying.'
      );
    }

    await queryRunner.query(`CREATE TABLE "school_curriculum_plan" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "schoolId" integer,
      "revision" integer NOT NULL DEFAULT (0),
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_school_curriculum_plan_scope" ON "school_curriculum_plan" (COALESCE("schoolId", -1))'
    );
    await queryRunner.query(`CREATE TABLE "school_curriculum_item" (
      "id" text PRIMARY KEY NOT NULL,
      "planId" integer NOT NULL,
      "grade" integer NOT NULL CHECK ("grade" BETWEEN 1 AND 12),
      "position" integer NOT NULL,
      "name" text NOT NULL,
      "nameEn" text,
      "code" text NOT NULL,
      "normalizedCode" text NOT NULL,
      "weeklyPeriods" integer NOT NULL CHECK ("weeklyPeriods" BETWEEN 1 AND 84),
      "isDifficult" boolean NOT NULL DEFAULT (0),
      "requiredRoomType" text,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      CONSTRAINT "FK_school_curriculum_item_plan" FOREIGN KEY ("planId") REFERENCES "school_curriculum_plan" ("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_school_curriculum_item_grade_code" ON "school_curriculum_item" ("planId", "grade", "normalizedCode")'
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_school_curriculum_item_plan_grade" ON "school_curriculum_item" ("planId", "grade", "position")'
    );
    await queryRunner.query('ALTER TABLE "subject" ADD COLUMN "curriculumItemId" text');
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_subject_curriculum_item" ON "subject" ("curriculumItemId") WHERE "curriculumItemId" IS NOT NULL'
    );

    const configs = (await queryRunner.query(
      'SELECT * FROM "curriculum_config" WHERE "isDeleted" = 0 ORDER BY "schoolId", "grade", "id"'
    )) as LegacyConfig[];
    const subjects = (await queryRunner.query(
      'SELECT * FROM "subject" WHERE "isDeleted" = 0 ORDER BY "schoolId", "grade", "id"'
    )) as LegacySubject[];
    const scopes = new Map<string, number | null>();
    for (const row of configs) scopes.set(schoolKey(row.schoolId), row.schoolId);
    for (const row of subjects) {
      if (row.grade !== null && (row.periodsPerWeek ?? 0) > 0) {
        scopes.set(schoolKey(row.schoolId), row.schoolId);
      }
    }

    for (const schoolId of scopes.values()) {
      const scopeConfigs = configs.filter((row) => row.schoolId === schoolId);
      const scopeSubjects = subjects.filter((row) => row.schoolId === schoolId);
      await queryRunner.query(
        'INSERT INTO "school_curriculum_plan" ("schoolId", "revision") VALUES (?, ?)',
        [schoolId, 1]
      );
      const [{ id: planId }] = (await queryRunner.query('SELECT last_insert_rowid() AS id')) as Array<{
        id: number;
      }>;

      for (let grade = 1; grade <= 12; grade += 1) {
        const config = scopeConfigs.find((row) => row.grade === grade);
        const gradeSubjects = scopeSubjects.filter(
          (row) => row.grade === grade && (row.periodsPerWeek ?? 0) > 0
        );
        const byCode = new Map<string, LegacySubject[]>();
        for (const subject of gradeSubjects) {
          const key = normalized(subject.code);
          if (!key) continue;
          byCode.set(key, [...(byCode.get(key) ?? []), subject]);
        }
        const conflicts = [...byCode.entries()].filter(([, matches]) => matches.length > 1);
        if (conflicts.length > 0) {
          throw new Error(
            `Curriculum migration conflict for school ${schoolId ?? 'default'}, grade ${grade}: ${conflicts.map(([code, rows]) => `${code}=[${rows.map((row) => row.id).join(',')}]`).join('; ')}`
          );
        }

        const migrated = config
          ? legacyEffectiveCurriculum(grade, config).map((item) => ({
              name: item.name,
              nameEn: item.nameEn || null,
              code: item.code,
              weeklyPeriods: item.periodsPerWeek,
              isDifficult: Boolean(item.isDifficult),
              requiredRoomType: item.requiredRoomType ?? null,
            }))
          : gradeSubjects.map((subject) => ({
              name: subject.name,
              nameEn: null,
              code: subject.code || subject.name,
              weeklyPeriods: subject.periodsPerWeek as number,
              isDifficult: Boolean(subject.isDifficult),
              requiredRoomType: subject.requiredRoomType,
            }));

        const migratedCodes = new Set(migrated.map((item) => normalized(item.code)));
        if (config) {
          for (const subject of gradeSubjects.filter((entry) => !isLegacyCurriculumManaged(entry))) {
            const code = subject.code || subject.name;
            if (migratedCodes.has(normalized(code))) continue;
            migrated.push({
              name: subject.name,
              nameEn: null,
              code,
              weeklyPeriods: subject.periodsPerWeek as number,
              isDifficult: Boolean(subject.isDifficult),
              requiredRoomType: subject.requiredRoomType,
            });
            migratedCodes.add(normalized(code));
          }
        }

        for (let position = 0; position < migrated.length; position += 1) {
          const item = migrated[position];
          const code = item.code || item.name;
          const normalizedCode = normalized(code);
          if (!normalizedCode) {
            throw new Error(
              `Curriculum migration found an empty code for school ${schoolId ?? 'default'}, grade ${grade}, position ${position}`
            );
          }
          const itemId = stableItemId(schoolId, grade, normalizedCode);
          await queryRunner.query(
            `INSERT INTO "school_curriculum_item"
              ("id", "planId", "grade", "position", "name", "nameEn", "code", "normalizedCode", "weeklyPeriods", "isDifficult", "requiredRoomType")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              itemId,
              planId,
              grade,
              position,
              item.name,
              item.nameEn,
              code,
              normalizedCode,
              item.weeklyPeriods,
              Number(item.isDifficult),
              item.requiredRoomType,
            ]
          );
          const match = byCode.get(normalizedCode)?.[0];
          if (match) {
            await queryRunner.query(
              'UPDATE "subject" SET "curriculumItemId" = ? WHERE "id" = ?',
              [itemId, match.id]
            );
          }
        }
      }
    }

    await queryRunner.query('DROP TABLE "curriculum_config"');
    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_insert"');
    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_update"');
    await queryRunner.query('ALTER TABLE "school_config" DROP COLUMN "enableMinistryValidation"');
    await queryRunner.query('ALTER TABLE "school_config" DROP COLUMN "ministryValidationMode"');
    await queryRunner.query('ALTER TABLE "school_config" DROP COLUMN "customCurriculumMode"');
    await installCurrentSchoolConfigTriggers(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_insert"');
    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_update"');
    await queryRunner.query(
      'ALTER TABLE "school_config" ADD COLUMN "enableMinistryValidation" boolean NOT NULL DEFAULT (0)'
    );
    await queryRunner.query(
      'ALTER TABLE "school_config" ADD COLUMN "ministryValidationMode" text NOT NULL DEFAULT (\'warn\')'
    );
    await queryRunner.query(
      'ALTER TABLE "school_config" ADD COLUMN "customCurriculumMode" boolean NOT NULL DEFAULT (0)'
    );
    await queryRunner.query(`CREATE TABLE "curriculum_config" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "schoolId" integer, "grade" integer NOT NULL,
      "useMinistryDefaults" boolean NOT NULL DEFAULT (1), "overridesJson" text NOT NULL DEFAULT ('[]'),
      "customSubjectsJson" text NOT NULL DEFAULT ('[]'), "isDeleted" boolean NOT NULL DEFAULT (0),
      "deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`);
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_subject_curriculum_item"');
    await queryRunner.query('ALTER TABLE "subject" DROP COLUMN "curriculumItemId"');
    await queryRunner.query('DROP TABLE "school_curriculum_item"');
    await queryRunner.query('DROP TABLE "school_curriculum_plan"');
  }
}
