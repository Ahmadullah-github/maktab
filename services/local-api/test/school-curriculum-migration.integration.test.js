const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

require('reflect-metadata');

const { DataSource } = require('typeorm');
const { AppDataSource } = require('../dist/ormconfig');
const {
  SchoolOwnedCurriculumPlan1785100000000,
} = require('../dist/src/database/migrations/1785100000000-SchoolOwnedCurriculumPlan');

const FINAL_MIGRATION = 'SchoolOwnedCurriculumPlan1785100000000';

async function withLegacyDatabase(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-curriculum-migration-'));
  const databasePath = path.join(directory, 'legacy.db');
  const migrations = AppDataSource.options.migrations.filter(
    (Migration) => new Migration().name !== FINAL_MIGRATION
  );
  const dataSource = new DataSource({
    ...AppDataSource.options,
    database: databasePath,
    migrations,
    migrationsRun: true,
  });
  try {
    await dataSource.initialize();
    await run(dataSource);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

async function migrate(dataSource) {
  const runner = dataSource.createQueryRunner();
  await runner.startTransaction();
  try {
    await new SchoolOwnedCurriculumPlan1785100000000().up(runner);
    await runner.commitTransaction();
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
}

async function insertSubject(dataSource, { name, code, grade, periods, meta = '{}' }) {
  await dataSource.query(
    `INSERT INTO subject
      (name, code, grade, periodsPerWeek, section, requiredFeatures, desiredFeatures, isDifficult,
       minRoomCapacity, meta, isCustom, isDeleted, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 'MIDDLE', '[]', '[]', 0, 0, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [name, code, grade, periods, meta]
  );
}

test('legacy curriculum migration preserves effective custom/manual rows and removed Ministry rows stay absent', async () => {
  await withLegacyDatabase(async (dataSource) => {
    await dataSource.query(
      `INSERT INTO curriculum_config
        (schoolId, grade, useMinistryDefaults, overridesJson, customSubjectsJson, isDeleted, createdAt, updatedAt)
       VALUES (NULL, 7, 1, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        JSON.stringify([
          { code: 'حرف۷', isRemoved: true },
          { code: 'ریض۷', periodsPerWeek: 4 },
        ]),
        JSON.stringify([
          { name: 'ترکی', nameEn: 'Turkish', code: 'ترکی۷', periodsPerWeek: 2, isDifficult: false },
        ]),
      ]
    );
    await insertSubject(dataSource, {
      name: 'حرفه',
      code: 'حرف۷',
      grade: 7,
      periods: 1,
      meta: JSON.stringify({ curriculumManaged: true, curriculumSource: 'ministry' }),
    });
    await insertSubject(dataSource, {
      name: 'ترکی',
      code: 'ترکی۷',
      grade: 7,
      periods: 2,
      meta: JSON.stringify({ curriculumManaged: true, curriculumSource: 'school' }),
    });
    await insertSubject(dataSource, {
      name: 'رباتیک',
      code: 'ROB7',
      grade: 7,
      periods: 1,
    });

    await migrate(dataSource);

    const items = await dataSource.query(
      'SELECT id, name, code, weeklyPeriods FROM school_curriculum_item WHERE grade = 7 ORDER BY position'
    );
    assert.equal(items.some((item) => item.code === 'حرف۷'), false);
    assert.deepEqual(
      items.filter((item) => ['ترکی۷', 'ROB7'].includes(item.code)).map((item) => item.code),
      ['ترکی۷', 'ROB7']
    );
    assert.equal(items.find((item) => item.code === 'ریض۷').weeklyPeriods, 4);

    const linked = await dataSource.query(
      `SELECT code, curriculumItemId FROM subject WHERE code IN ('ترکی۷', 'ROB7') ORDER BY code`
    );
    assert.equal(linked.every((subject) => typeof subject.curriculumItemId === 'string'), true);

    const subjectColumns = (await dataSource.query('PRAGMA table_info(subject)')).map((row) => row.name);
    const configColumns = (await dataSource.query('PRAGMA table_info(school_config)')).map((row) => row.name);
    assert.equal(subjectColumns.includes('curriculumItemId'), true);
    assert.equal(configColumns.includes('enableMinistryValidation'), false);
    assert.equal(configColumns.includes('ministryValidationMode'), false);
    assert.equal(configColumns.includes('customCurriculumMode'), false);
    assert.equal((await dataSource.query("SELECT name FROM sqlite_master WHERE type='table' AND name='curriculum_config'")).length, 0);
  });
});

test('migration leaves an unused fresh school curriculum empty', async () => {
  await withLegacyDatabase(async (dataSource) => {
    await migrate(dataSource);
    assert.equal((await dataSource.query('SELECT COUNT(*) AS count FROM school_curriculum_plan'))[0].count, 0);
    assert.equal((await dataSource.query('SELECT COUNT(*) AS count FROM school_curriculum_item'))[0].count, 0);
  });
});

test('migration aborts ambiguous subject-code links with diagnostics', async () => {
  await withLegacyDatabase(async (dataSource) => {
    await insertSubject(dataSource, { name: 'اول', code: 'DUP7', grade: 7, periods: 1 });
    await insertSubject(dataSource, { name: 'دوم', code: 'ＤＵＰ７', grade: 7, periods: 1 });

    await assert.rejects(
      migrate(dataSource),
      /Curriculum migration conflict for school default, grade 7: dup7=\[1,2\]/
    );
    assert.equal(
      (await dataSource.query("SELECT name FROM sqlite_master WHERE type='table' AND name='school_curriculum_plan'")).length,
      0
    );
  });
});
