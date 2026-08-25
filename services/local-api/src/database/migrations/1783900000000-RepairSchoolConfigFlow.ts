import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

const WEEK_DAYS = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

const DEFAULT_DAYS = WEEK_DAYS.slice(0, 6);

function parseStructured(value: unknown, fallback: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 2 && typeof current === 'string'; depth += 1) {
    const text = current.trim();
    if (!text) return fallback;
    try {
      current = JSON.parse(text);
    } catch {
      return fallback;
    }
  }
  return current ?? fallback;
}

function normalizeDay(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  return WEEK_DAYS.includes(normalized as (typeof WEEK_DAYS)[number]) ? normalized : null;
}

function normalizeDays(value: unknown): string[] {
  const parsed = parseStructured(value, DEFAULT_DAYS);
  if (!Array.isArray(parsed)) return [...DEFAULT_DAYS];
  const days = parsed.map(normalizeDay).filter((day): day is string => day !== null);
  const unique = WEEK_DAYS.filter((day) => days.includes(day));
  return unique.length > 0 ? unique : [...DEFAULT_DAYS];
}

function normalizeUnavailable(
  value: unknown,
  indexedDays: string[]
): Array<Record<string, unknown>> {
  const parsed = parseStructured(value, []);
  if (!Array.isArray(parsed)) return [];

  const unique = new Map<string, Record<string, unknown>>();
  for (const item of parsed) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const slot = item as Record<string, unknown>;
    const day =
      typeof slot.day === 'number' && Number.isInteger(slot.day)
        ? (indexedDays[slot.day] ?? null)
        : normalizeDay(slot.day);
    const period = Number(slot.period);
    if (!day || !Number.isInteger(period) || period < 0) continue;
    unique.set(`${day}:${period}`, { ...slot, day, period });
  }
  return Array.from(unique.values());
}

function normalizeAvailability(value: unknown, indexedDays: string[]): Record<string, unknown> {
  const parsed = parseStructured(value, {});
  if (Array.isArray(parsed)) {
    return Object.fromEntries(
      indexedDays.flatMap((day, index) =>
        Array.isArray(parsed[index]) ? [[day, parsed[index]]] : []
      )
    );
  }
  if (!parsed || typeof parsed !== 'object') return {};

  const normalized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
    const day = normalizeDay(key);
    if (day && Array.isArray(entry)) normalized[day] = entry;
  }
  return normalized;
}

function normalizedJson(value: unknown, fallback: unknown): string {
  return JSON.stringify(parseStructured(value, fallback));
}

export class RepairSchoolConfigFlow1783900000000 implements MigrationInterface {
  name = 'RepairSchoolConfigFlow1783900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // TypeORM cannot round-trip SQLite expression indexes while rebuilding a
    // table for ADD COLUMN (it converts the `(1)` expression into `"null"`).
    // Recreate this partial singleton index ourselves after both columns exist.
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_school_config_default"');

    if (!(await queryRunner.hasColumn('school_config', 'revision'))) {
      await queryRunner.addColumn(
        'school_config',
        new TableColumn({ name: 'revision', type: 'integer', isNullable: false, default: 1 })
      );
    }
    if (!(await queryRunner.hasColumn('school_config', 'prayerBreaksEnabled'))) {
      await queryRunner.addColumn(
        'school_config',
        new TableColumn({
          name: 'prayerBreaksEnabled',
          type: 'boolean',
          isNullable: false,
          default: false,
        })
      );
    }

    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_school_config_default" ON "school_config" ((1)) WHERE "schoolId" IS NULL'
    );

    const configs = (await queryRunner.query(
      `SELECT id, schoolId, daysOfWeekJson, periodsPerDayMapJson, categoryPeriodsMapJson,
              breakPeriods, breakPeriodsByDayJson, prayerBreaksJson
         FROM school_config`
    )) as Array<Record<string, unknown>>;

    const daysBySchool = new Map<string, string[]>();
    for (const config of configs) {
      const days = normalizeDays(config.daysOfWeekJson);
      const prayerBreaks = parseStructured(config.prayerBreaksJson, []);
      const prayerEnabled = Array.isArray(prayerBreaks) && prayerBreaks.length > 0 ? 1 : 0;
      daysBySchool.set(String(config.schoolId ?? 'default'), days);

      await queryRunner.query(
        `UPDATE school_config
            SET revision = CASE WHEN revision < 1 THEN 1 ELSE revision END,
                daysOfWeekJson = ?,
                periodsPerDayMapJson = ?,
                categoryPeriodsMapJson = ?,
                breakPeriods = ?,
                breakPeriodsByDayJson = ?,
                prayerBreaksJson = ?,
                prayerBreaksEnabled = ?
          WHERE id = ?`,
        [
          JSON.stringify(days),
          normalizedJson(config.periodsPerDayMapJson, {}),
          normalizedJson(config.categoryPeriodsMapJson, {}),
          normalizedJson(config.breakPeriods, []),
          normalizedJson(config.breakPeriodsByDayJson, {}),
          JSON.stringify(Array.isArray(prayerBreaks) ? prayerBreaks : []),
          prayerEnabled,
          config.id,
        ]
      );
    }

    const defaultDays = daysBySchool.get('default') ?? [...DEFAULT_DAYS];
    const rooms = (await queryRunner.query(
      `SELECT id, schoolId, features, unavailable, meta FROM room`
    )) as Array<Record<string, unknown>>;
    for (const room of rooms) {
      const days = daysBySchool.get(String(room.schoolId ?? 'default')) ?? defaultDays;
      await queryRunner.query(
        `UPDATE room SET features = ?, unavailable = ?, meta = ? WHERE id = ?`,
        [
          normalizedJson(room.features, []),
          JSON.stringify(normalizeUnavailable(room.unavailable, days)),
          normalizedJson(room.meta, {}),
          room.id,
        ]
      );
    }

    const teachers = (await queryRunner.query(
      `SELECT id, schoolId, availability, unavailable, preferredRoomIds, classAssignments
         FROM teacher`
    )) as Array<Record<string, unknown>>;
    for (const teacher of teachers) {
      const days = daysBySchool.get(String(teacher.schoolId ?? 'default')) ?? defaultDays;
      await queryRunner.query(
        `UPDATE teacher
            SET availability = ?, unavailable = ?, preferredRoomIds = ?, classAssignments = ?
          WHERE id = ?`,
        [
          JSON.stringify(normalizeAvailability(teacher.availability, days)),
          JSON.stringify(normalizeUnavailable(teacher.unavailable, days)),
          normalizedJson(teacher.preferredRoomIds, []),
          normalizedJson(teacher.classAssignments, []),
          teacher.id,
        ]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_school_config_default"');
    if (await queryRunner.hasColumn('school_config', 'prayerBreaksEnabled')) {
      await queryRunner.dropColumn('school_config', 'prayerBreaksEnabled');
    }
    if (await queryRunner.hasColumn('school_config', 'revision')) {
      await queryRunner.dropColumn('school_config', 'revision');
    }
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_school_config_default" ON "school_config" ((1)) WHERE "schoolId" IS NULL'
    );
  }
}
