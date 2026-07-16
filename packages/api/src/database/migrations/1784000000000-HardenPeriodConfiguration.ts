import { MigrationInterface, QueryRunner } from 'typeorm';

const DAYS = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;
const DEFAULT_DAYS = DAYS.slice(0, 6);
const TIMEZONES = ['Asia/Kabul', 'Asia/Tehran', 'Asia/Dubai', 'Asia/Karachi'] as const;
const MINISTRY_VALIDATION_MODES = ['off', 'warn', 'strict'] as const;

function parseJson(value: unknown, fallback: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 2 && typeof current === 'string'; depth += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      return fallback;
    }
  }
  return current ?? fallback;
}

function validPeriod(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 12;
}

function normalizeDays(value: unknown): string[] {
  const parsed = parseJson(value, DEFAULT_DAYS);
  if (!Array.isArray(parsed)) return [...DEFAULT_DAYS];
  const selected = new Set(parsed.filter((day): day is string => typeof day === 'string'));
  const normalized = DAYS.filter((day) => selected.has(day));
  return normalized.length > 0 ? normalized : [...DEFAULT_DAYS];
}

function normalizePeriodMap(value: unknown, days: string[], fallback: number) {
  const parsed = parseJson(value, {});
  const record =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    days.map((day) => [day, validPeriod(record[day]) ? record[day] : fallback])
  );
}

function normalizeBreaks(value: unknown, maximumPeriods: number) {
  const parsed = parseJson(value, []);
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<number>();
  const normalized: Array<{ afterPeriod: number; duration: number }> = [];
  for (const candidate of parsed) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const entry = candidate as Record<string, unknown>;
    const afterPeriod = Number(entry.afterPeriod);
    const duration = Number(entry.duration);
    if (
      !Number.isInteger(afterPeriod) ||
      afterPeriod < 1 ||
      afterPeriod >= maximumPeriods ||
      !Number.isInteger(duration) ||
      duration < 5 ||
      duration > 60 ||
      seen.has(afterPeriod)
    )
      continue;
    seen.add(afterPeriod);
    normalized.push({ afterPeriod, duration });
  }
  return normalized.sort((left, right) => left.afterPeriod - right.afterPeriod);
}

function normalizePrayerBreaks(value: unknown) {
  const parsed = parseJson(value, []);
  if (!Array.isArray(parsed)) return [];
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  const normalized = parsed
    .flatMap((candidate) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
      const entry = candidate as Record<string, unknown>;
      const name = typeof entry.name === 'string' ? entry.name.trim() : '';
      const time = typeof entry.time === 'string' ? entry.time : '';
      const duration = Number(entry.duration);
      if (
        !name ||
        !timePattern.test(time) ||
        !Number.isInteger(duration) ||
        duration < 5 ||
        duration > 60
      ) {
        return [];
      }
      return [{ name, time, duration }];
    })
    .sort((left, right) => left.time.localeCompare(right.time));

  const nonOverlapping: typeof normalized = [];
  let previousEnd = -1;
  for (const prayer of normalized) {
    const [hours, minutes] = prayer.time.split(':').map(Number);
    const start = hours * 60 + minutes;
    const end = start + prayer.duration;
    if (start < previousEnd || end > 24 * 60) continue;
    nonOverlapping.push(prayer);
    previousEnd = end;
  }
  return nonOverlapping;
}

function triggerBody(): string {
  return `
    SELECT CASE WHEN
      NEW.periodsPerDay NOT BETWEEN 1 AND 12 OR
      NEW.defaultPeriodsPerDay NOT BETWEEN 1 AND 12 OR
      NEW.periodsPerDay <> NEW.defaultPeriodsPerDay OR
      NEW.periodDuration NOT BETWEEN 15 AND 120 OR
      NEW.ramadanPeriodDuration NOT BETWEEN 20 AND 60 OR
      NEW.schoolStartTime IS NULL OR length(NEW.schoolStartTime) <> 5 OR
      NEW.schoolStartTime NOT GLOB '[0-2][0-9]:[0-5][0-9]' OR
      CAST(substr(NEW.schoolStartTime, 1, 2) AS INTEGER) > 23 OR
      NEW.timezone IS NULL OR NEW.timezone NOT IN ('Asia/Kabul','Asia/Tehran','Asia/Dubai','Asia/Karachi') OR
      NEW.ministryValidationMode IS NULL OR NEW.ministryValidationMode NOT IN ('off','warn','strict') OR
      NEW.daysPerWeek NOT BETWEEN 1 AND 7 OR
      NEW.revision < 1
    THEN RAISE(ABORT, 'invalid school_config scalar period configuration') END;

    SELECT CASE WHEN
      NEW.enablePrimary NOT IN (0, 1) OR NEW.enableMiddle NOT IN (0, 1) OR
      NEW.enableHigh NOT IN (0, 1) OR NEW.dynamicPeriodsEnabled NOT IN (0, 1) OR
      NEW.categoryPeriodsEnabled NOT IN (0, 1) OR NEW.prayerBreaksEnabled NOT IN (0, 1) OR
      NEW.ramadanModeEnabled NOT IN (0, 1) OR NEW.enableMinistryValidation NOT IN (0, 1) OR
      NEW.customCurriculumMode NOT IN (0, 1) OR NEW.autoPopulateCurriculum NOT IN (0, 1) OR
      NEW.lowResourceMode NOT IN (0, 1)
    THEN RAISE(ABORT, 'invalid school_config boolean') END;

    SELECT CASE WHEN NEW.daysOfWeekJson IS NULL OR json_valid(NEW.daysOfWeekJson) = 0
      THEN RAISE(ABORT, 'invalid school_config daysOfWeekJson') END;
    SELECT CASE WHEN json_type(NEW.daysOfWeekJson) <> 'array' OR json_array_length(NEW.daysOfWeekJson) < 1 OR
      NEW.daysPerWeek <> json_array_length(NEW.daysOfWeekJson) OR
      EXISTS (SELECT 1 FROM json_each(NEW.daysOfWeekJson) WHERE type <> 'text' OR value NOT IN ('Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday')) OR
      json_array_length(NEW.daysOfWeekJson) <> (SELECT COUNT(DISTINCT value) FROM json_each(NEW.daysOfWeekJson))
      THEN RAISE(ABORT, 'invalid school_config days shape') END;

    SELECT CASE WHEN NEW.periodsPerDayMapJson IS NULL OR json_valid(NEW.periodsPerDayMapJson) = 0
      THEN RAISE(ABORT, 'invalid school_config periodsPerDayMapJson') END;
    SELECT CASE WHEN json_type(NEW.periodsPerDayMapJson) <> 'object' OR EXISTS (
      SELECT 1 FROM json_each(NEW.periodsPerDayMapJson)
      WHERE key NOT IN ('Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday') OR type <> 'integer' OR value NOT BETWEEN 1 AND 12
    ) THEN RAISE(ABORT, 'invalid school_config period map shape') END;

    SELECT CASE WHEN NEW.categoryPeriodsMapJson IS NULL OR json_valid(NEW.categoryPeriodsMapJson) = 0
      THEN RAISE(ABORT, 'invalid school_config categoryPeriodsMapJson') END;
    SELECT CASE WHEN json_type(NEW.categoryPeriodsMapJson) <> 'object' OR EXISTS (
      SELECT 1 FROM json_each(NEW.categoryPeriodsMapJson) AS category
      WHERE category.key NOT IN ('Alpha-Primary','Beta-Primary','Middle','High') OR category.type <> 'object' OR EXISTS (
        SELECT 1 FROM json_each(category.value)
        WHERE key NOT IN ('Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday') OR type <> 'integer' OR value NOT BETWEEN 1 AND 12
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
        COALESCE(json_type(value, '$.duration'), '') <> 'integer' OR json_extract(value, '$.duration') NOT BETWEEN 5 AND 60
    ) OR json_array_length(NEW.breakPeriods) <> (
      SELECT COUNT(DISTINCT json_extract(value, '$.afterPeriod')) FROM json_each(NEW.breakPeriods)
    ) THEN RAISE(ABORT, 'invalid school_config break shape') END;
    SELECT CASE WHEN json_type(NEW.breakPeriodsByDayJson) <> 'object' OR EXISTS (
      SELECT 1 FROM json_each(NEW.breakPeriodsByDayJson) AS day
      WHERE day.key NOT IN ('Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday') OR day.type <> 'array' OR EXISTS (
        SELECT 1 FROM json_each(day.value)
        WHERE type <> 'object' OR COALESCE(json_type(value, '$.afterPeriod'), '') <> 'integer' OR
          json_extract(value, '$.afterPeriod') NOT BETWEEN 1 AND 11 OR
          COALESCE(json_type(value, '$.duration'), '') <> 'integer' OR json_extract(value, '$.duration') NOT BETWEEN 5 AND 60
      ) OR json_array_length(day.value) <> (
        SELECT COUNT(DISTINCT json_extract(value, '$.afterPeriod')) FROM json_each(day.value)
      )
    ) THEN RAISE(ABORT, 'invalid school_config day break shape') END;
    SELECT CASE WHEN json_type(NEW.prayerBreaksJson) <> 'array' OR EXISTS (
      SELECT 1 FROM json_each(NEW.prayerBreaksJson)
      WHERE type <> 'object' OR COALESCE(json_type(value, '$.name'), '') <> 'text' OR trim(json_extract(value, '$.name')) = '' OR
        COALESCE(json_type(value, '$.time'), '') <> 'text' OR length(json_extract(value, '$.time')) <> 5 OR
        json_extract(value, '$.time') NOT GLOB '[0-2][0-9]:[0-5][0-9]' OR
        CAST(substr(json_extract(value, '$.time'), 1, 2) AS INTEGER) > 23 OR
        COALESCE(json_type(value, '$.duration'), '') <> 'integer' OR
        json_extract(value, '$.duration') NOT BETWEEN 5 AND 60
    ) THEN RAISE(ABORT, 'invalid school_config prayer break shape') END;
  `;
}

export class HardenPeriodConfiguration1784000000000 implements MigrationInterface {
  name = 'HardenPeriodConfiguration1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query('SELECT * FROM school_config')) as Array<
      Record<string, unknown>
    >;

    for (const row of rows) {
      const legacyPeriods = Number(row.periodsPerDay);
      const defaultPeriods = Number(row.defaultPeriodsPerDay);
      if (
        validPeriod(legacyPeriods) &&
        validPeriod(defaultPeriods) &&
        legacyPeriods !== defaultPeriods
      ) {
        throw new Error(
          `SchoolConfig period migration conflict for row ${String(row.id)}: periodsPerDay=${legacyPeriods}, defaultPeriodsPerDay=${defaultPeriods}`
        );
      }

      const normalizedDefault = validPeriod(defaultPeriods)
        ? defaultPeriods
        : validPeriod(legacyPeriods)
          ? legacyPeriods
          : 7;
      const days = normalizeDays(row.daysOfWeekJson);
      const rawEnablePrimary = Number(row.enablePrimary) === 1;
      const rawEnableMiddle = Number(row.enableMiddle) === 1;
      const rawEnableHigh = Number(row.enableHigh) === 1;
      const hasEnabledBand = rawEnablePrimary || rawEnableMiddle || rawEnableHigh;
      const enablePrimary = hasEnabledBand ? rawEnablePrimary : true;
      const enableMiddle = hasEnabledBand ? rawEnableMiddle : false;
      const enableHigh = hasEnabledBand ? rawEnableHigh : false;
      const dynamicPeriodsEnabled = Number(row.dynamicPeriodsEnabled) === 1;
      const categoryPeriodsEnabled = Number(row.categoryPeriodsEnabled) === 1;
      const categories = [
        ...(enablePrimary ? ['Alpha-Primary', 'Beta-Primary'] : []),
        ...(enableMiddle ? ['Middle'] : []),
        ...(enableHigh ? ['High'] : []),
      ];
      const baseMap = normalizePeriodMap(row.periodsPerDayMapJson, days, normalizedDefault);
      const rawCategoryMap = parseJson(row.categoryPeriodsMapJson, {});
      const categoryRecord =
        rawCategoryMap && typeof rawCategoryMap === 'object' && !Array.isArray(rawCategoryMap)
          ? (rawCategoryMap as Record<string, unknown>)
          : {};
      const categoryMap = categoryPeriodsEnabled
        ? Object.fromEntries(
            categories.map((category) => [
              category,
              normalizePeriodMap(categoryRecord[category], days, normalizedDefault),
            ])
          )
        : {};
      const maximumByDay = Object.fromEntries(
        days.map((day) => [
          day,
          categoryPeriodsEnabled && categories.length > 0
            ? Math.max(...categories.map((category) => categoryMap[category][day]))
            : baseMap[day],
        ])
      );
      const maximumPeriods = Math.max(...Object.values(maximumByDay));
      const rawBreaksByDay = parseJson(row.breakPeriodsByDayJson, {});
      const breakRecord =
        rawBreaksByDay && typeof rawBreaksByDay === 'object' && !Array.isArray(rawBreaksByDay)
          ? (rawBreaksByDay as Record<string, unknown>)
          : {};
      const breaksByDay = Object.fromEntries(
        days.flatMap((day) =>
          Object.prototype.hasOwnProperty.call(breakRecord, day)
            ? [[day, normalizeBreaks(breakRecord[day], maximumByDay[day])]]
            : []
        )
      );
      const prayers =
        Number(row.prayerBreaksEnabled) === 1 ? normalizePrayerBreaks(row.prayerBreaksJson) : [];
      const periodDuration =
        Number.isInteger(Number(row.periodDuration)) &&
        Number(row.periodDuration) >= 15 &&
        Number(row.periodDuration) <= 120
          ? Number(row.periodDuration)
          : 45;
      const ramadanPeriodDuration =
        Number.isInteger(Number(row.ramadanPeriodDuration)) &&
        Number(row.ramadanPeriodDuration) >= 20 &&
        Number(row.ramadanPeriodDuration) <= 60
          ? Number(row.ramadanPeriodDuration)
          : 35;
      const schoolStartTime =
        typeof row.schoolStartTime === 'string' &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(row.schoolStartTime)
          ? row.schoolStartTime
          : '07:30';
      const timezone =
        typeof row.timezone === 'string' &&
        TIMEZONES.includes(row.timezone as (typeof TIMEZONES)[number])
          ? row.timezone
          : 'Asia/Kabul';
      const ministryValidationMode =
        typeof row.ministryValidationMode === 'string' &&
        MINISTRY_VALIDATION_MODES.includes(
          row.ministryValidationMode as (typeof MINISTRY_VALIDATION_MODES)[number]
        )
          ? row.ministryValidationMode
          : 'warn';

      await queryRunner.query(
        `UPDATE school_config SET
          revision = CASE WHEN revision >= 1 THEN revision ELSE 1 END,
          daysPerWeek = ?, periodsPerDay = ?, defaultPeriodsPerDay = ?,
          periodDuration = ?, ramadanPeriodDuration = ?, schoolStartTime = ?, timezone = ?,
          ministryValidationMode = ?,
          enablePrimary = ?, enableMiddle = ?, enableHigh = ?,
          dynamicPeriodsEnabled = ?, categoryPeriodsEnabled = ?,
          ramadanModeEnabled = ?, enableMinistryValidation = ?, customCurriculumMode = ?,
          autoPopulateCurriculum = ?, lowResourceMode = ?,
          daysOfWeekJson = ?, periodsPerDayMapJson = ?, categoryPeriodsMapJson = ?,
          breakPeriods = ?, breakPeriodsByDayJson = ?, prayerBreaksJson = ?,
          prayerBreaksEnabled = ?
        WHERE id = ?`,
        [
          days.length,
          normalizedDefault,
          normalizedDefault,
          periodDuration,
          ramadanPeriodDuration,
          schoolStartTime,
          timezone,
          ministryValidationMode,
          Number(enablePrimary),
          Number(enableMiddle),
          Number(enableHigh),
          Number(dynamicPeriodsEnabled),
          Number(categoryPeriodsEnabled),
          Number(row.ramadanModeEnabled) === 1 ? 1 : 0,
          Number(row.enableMinistryValidation) === 1 ? 1 : 0,
          Number(row.customCurriculumMode) === 1 ? 1 : 0,
          Number(row.autoPopulateCurriculum) === 1 ? 1 : 0,
          Number(row.lowResourceMode) === 1 ? 1 : 0,
          JSON.stringify(days),
          JSON.stringify(dynamicPeriodsEnabled ? baseMap : {}),
          JSON.stringify(categoryMap),
          JSON.stringify(normalizeBreaks(row.breakPeriods, maximumPeriods)),
          JSON.stringify(breaksByDay),
          JSON.stringify(prayers),
          prayers.length > 0 ? 1 : 0,
          row.id,
        ]
      );
    }

    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_insert"');
    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_update"');
    await queryRunner.query(
      `CREATE TRIGGER "TR_school_config_periods_insert" BEFORE INSERT ON "school_config" BEGIN ${triggerBody()} END`
    );
    await queryRunner.query(
      `CREATE TRIGGER "TR_school_config_periods_update" BEFORE UPDATE ON "school_config" BEGIN ${triggerBody()} END`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_insert"');
    await queryRunner.query('DROP TRIGGER IF EXISTS "TR_school_config_periods_update"');
  }
}
