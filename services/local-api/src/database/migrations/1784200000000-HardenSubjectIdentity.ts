import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

type DuplicateSubjectIdentity = {
  schoolScope: number;
  gradeScope: number;
  identity: string;
  ids: string;
};

function describeDuplicates(kind: string, rows: DuplicateSubjectIdentity[]): string {
  return rows
    .slice(0, 10)
    .map(
      (row) =>
        `${kind}=${JSON.stringify(row.identity)} school=${row.schoolScope} grade=${row.gradeScope} ids=[${row.ids}]`
    )
    .join('; ');
}

function canonicalFeatureTags(raw: string | null): string {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) return '[]';
    return JSON.stringify(
      [...new Set(parsed.map((item) => item.normalize('NFKC').trim().toLowerCase()).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right))
    );
  } catch {
    return '[]';
  }
}

export class HardenSubjectIdentity1784200000000 implements MigrationInterface {
  name = 'HardenSubjectIdentity1784200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('subject', 'isCustom'))) {
      await queryRunner.addColumn(
        'subject',
        new TableColumn({ name: 'isCustom', type: 'boolean', default: false })
      );
    }
    if (!(await queryRunner.hasColumn('subject', 'customCategory'))) {
      await queryRunner.addColumn(
        'subject',
        new TableColumn({ name: 'customCategory', type: 'text', isNullable: true })
      );
    }

    await queryRunner.query(`
      UPDATE subject
      SET name = TRIM(name),
          code = CASE WHEN code IS NULL THEN '' ELSE TRIM(code) END,
          section = CASE
            WHEN section IN ('PRIMARY', 'MIDDLE', 'HIGH') THEN section
            ELSE ''
          END,
          requiredFeatures = CASE WHEN json_valid(requiredFeatures) THEN requiredFeatures ELSE '[]' END,
          desiredFeatures = CASE WHEN json_valid(desiredFeatures) THEN desiredFeatures ELSE '[]' END,
          meta = CASE WHEN json_valid(meta) THEN meta ELSE '{}' END
    `);
    const subjectFeatures = (await queryRunner.query(
      'SELECT id, requiredFeatures, desiredFeatures FROM subject'
    )) as Array<{ id: number; requiredFeatures: string | null; desiredFeatures: string | null }>;
    for (const subject of subjectFeatures) {
      await queryRunner.query(
        'UPDATE subject SET requiredFeatures = ?, desiredFeatures = ? WHERE id = ?',
        [
          canonicalFeatureTags(subject.requiredFeatures),
          canonicalFeatureTags(subject.desiredFeatures),
          subject.id,
        ]
      );
    }
    await queryRunner.query(`
      UPDATE subject
      SET periodsPerWeek = NULL
      WHERE periodsPerWeek IS NOT NULL AND periodsPerWeek NOT BETWEEN 1 AND 84
    `);
    await queryRunner.query(`
      UPDATE subject
      SET customCategory = NULL
      WHERE customCategory IS NOT NULL
        AND customCategory NOT IN ('Alpha-Primary', 'Beta-Primary', 'Middle', 'High')
    `);

    await queryRunner.query('DROP TRIGGER IF EXISTS TRG_subject_contract_insert');
    await queryRunner.query('DROP TRIGGER IF EXISTS TRG_subject_contract_update');
    const contractValidation = `
      SELECT CASE WHEN
        TRIM(NEW.name) = '' OR
        (NEW.grade IS NOT NULL AND NEW.grade NOT BETWEEN 1 AND 12) OR
        (NEW.periodsPerWeek IS NOT NULL AND NEW.periodsPerWeek NOT BETWEEN 1 AND 84) OR
        COALESCE(NEW.section, '') NOT IN ('', 'PRIMARY', 'MIDDLE', 'HIGH') OR
        (NEW.customCategory IS NOT NULL AND NEW.customCategory NOT IN ('Alpha-Primary', 'Beta-Primary', 'Middle', 'High')) OR
        (COALESCE(NEW.isCustom, 0) = 1 AND NEW.customCategory IS NULL) OR
        (COALESCE(NEW.isCustom, 0) = 0 AND NEW.customCategory IS NOT NULL)
      THEN RAISE(ABORT, 'invalid subject contract') END;
    `;
    await queryRunner.query(`
      CREATE TRIGGER TRG_subject_contract_insert
      BEFORE INSERT ON subject
      FOR EACH ROW BEGIN ${contractValidation} END
    `);
    await queryRunner.query(`
      CREATE TRIGGER TRG_subject_contract_update
      BEFORE UPDATE ON subject
      FOR EACH ROW BEGIN ${contractValidation} END
    `);

    const duplicateNames = (await queryRunner.query(`
      SELECT COALESCE(schoolId, -1) AS schoolScope,
             COALESCE(grade, -1) AS gradeScope,
             LOWER(TRIM(name)) AS identity,
             GROUP_CONCAT(id) AS ids
      FROM subject
      WHERE isDeleted = 0
      GROUP BY COALESCE(schoolId, -1), COALESCE(grade, -1), LOWER(TRIM(name))
      HAVING COUNT(*) > 1
    `)) as DuplicateSubjectIdentity[];
    const duplicateCodes = (await queryRunner.query(`
      SELECT COALESCE(schoolId, -1) AS schoolScope,
             COALESCE(grade, -1) AS gradeScope,
             LOWER(TRIM(code)) AS identity,
             GROUP_CONCAT(id) AS ids
      FROM subject
      WHERE isDeleted = 0 AND code IS NOT NULL AND TRIM(code) <> ''
      GROUP BY COALESCE(schoolId, -1), COALESCE(grade, -1), LOWER(TRIM(code))
      HAVING COUNT(*) > 1
    `)) as DuplicateSubjectIdentity[];

    if (duplicateNames.length > 0 || duplicateCodes.length > 0) {
      throw new Error(
        [
          'Cannot enforce subject identity because active duplicates exist.',
          describeDuplicates('name', duplicateNames),
          describeDuplicates('code', duplicateCodes),
        ]
          .filter(Boolean)
          .join(' ')
      );
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_subject_scope_grade_name_active
      ON subject (
        COALESCE(schoolId, -1),
        COALESCE(grade, -1),
        LOWER(TRIM(name))
      )
      WHERE isDeleted = 0
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_subject_scope_grade_code_active
      ON subject (
        COALESCE(schoolId, -1),
        COALESCE(grade, -1),
        LOWER(TRIM(code))
      )
      WHERE isDeleted = 0 AND code IS NOT NULL AND TRIM(code) <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TRIGGER IF EXISTS TRG_subject_contract_update');
    await queryRunner.query('DROP TRIGGER IF EXISTS TRG_subject_contract_insert');
    await queryRunner.query('DROP INDEX IF EXISTS UQ_subject_scope_grade_code_active');
    await queryRunner.query('DROP INDEX IF EXISTS UQ_subject_scope_grade_name_active');
    if (await queryRunner.hasColumn('subject', 'customCategory')) {
      await queryRunner.dropColumn('subject', 'customCategory');
    }
    if (await queryRunner.hasColumn('subject', 'isCustom')) {
      await queryRunner.dropColumn('subject', 'isCustom');
    }
  }
}
