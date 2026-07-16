import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DEFAULT_OPTIMIZATION_PREFERENCES,
  optimizationPreferencesSchema,
  type OptimizationPreferencesInput,
} from '../../schemas/config.schema';

function quantize(value: unknown): 0 | 0.5 | 1 | 2 {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  if (value <= 0.75) return 0.5;
  if (value <= 1.25) return 1;
  return 2;
}

function migrateStrength(
  source: Record<string, unknown>,
  key: keyof OptimizationPreferencesInput
): 0 | 0.5 | 1 | 2 {
  return key in source
    ? quantize(source[key])
    : (DEFAULT_OPTIMIZATION_PREFERENCES[key] as 0 | 0.5 | 1 | 2);
}

function migrateLegacy(value: unknown): OptimizationPreferencesInput {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const migrated = {
    ...DEFAULT_OPTIMIZATION_PREFERENCES,
    avoidTeacherGapsWeight: migrateStrength(source, 'avoidTeacherGapsWeight'),
    avoidClassGapsWeight: migrateStrength(source, 'avoidClassGapsWeight'),
    distributeDifficultSubjectsWeight: migrateStrength(source, 'distributeDifficultSubjectsWeight'),
    balanceTeacherLoadWeight: migrateStrength(source, 'balanceTeacherLoadWeight'),
    minimizeRoomChangesWeight: migrateStrength(source, 'minimizeRoomChangesWeight'),
    preferMorningForDifficultWeight: migrateStrength(source, 'preferMorningForDifficultWeight'),
    respectTeacherTimePreferenceWeight: migrateStrength(source, 'respectTeacherTimePreferenceWeight'),
    respectTeacherRoomPreferenceWeight: migrateStrength(source, 'respectTeacherRoomPreferenceWeight'),
    respectPreferredColleaguesWeight: migrateStrength(source, 'respectPreferredColleaguesWeight'),
    preferClassHomeRoomWeight: migrateStrength(source, 'preferClassHomeRoomWeight'),
    respectSubjectDesiredFeaturesWeight: migrateStrength(source, 'respectSubjectDesiredFeaturesWeight'),
    subjectSpreadWeight: migrateStrength(source, 'subjectSpreadWeight'),
    allowConsecutivePeriodsForSameSubject:
      typeof source.allowConsecutivePeriodsForSameSubject === 'boolean'
        ? source.allowConsecutivePeriodsForSameSubject
        : true,
  };
  return optimizationPreferencesSchema.parse(migrated);
}

export class SchoolScopedOptimizationPreferences1784700000000 implements MigrationInterface {
  name = 'SchoolScopedOptimizationPreferences1784700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('school_config', 'optimizationPreferencesJson'))) {
      await queryRunner.query(
        'ALTER TABLE "school_config" ADD COLUMN "optimizationPreferencesJson" text'
      );
    }

    const rows = (await queryRunner.query(
      `SELECT value FROM configuration WHERE key = 'optimization-preferences' LIMIT 1`
    )) as Array<{ value: string }>;
    let preferences: OptimizationPreferencesInput = { ...DEFAULT_OPTIMIZATION_PREFERENCES };
    if (rows[0]?.value) {
      try {
        preferences = migrateLegacy(JSON.parse(rows[0].value));
      } catch {
        preferences = { ...DEFAULT_OPTIMIZATION_PREFERENCES };
      }
    }

    await queryRunner.query(
      `UPDATE school_config
       SET optimizationPreferencesJson = COALESCE(optimizationPreferencesJson, ?)`,
      [JSON.stringify(preferences)]
    );
    await queryRunner.query(`DELETE FROM configuration WHERE key = 'optimization-preferences'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('school_config', 'optimizationPreferencesJson')) {
      await queryRunner.query(
        'ALTER TABLE "school_config" DROP COLUMN "optimizationPreferencesJson"'
      );
    }
  }
}
