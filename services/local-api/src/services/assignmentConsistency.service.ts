import { DataSource } from 'typeorm';

interface CountRow {
  count: number | string;
}

export interface AssignmentConsistencyReport {
  isConsistent: boolean;
  checkedAt: string;
  counts: {
    canonicalAssignments: number;
    canonicalRequirements: number;
    canonicalCapabilities: number;
  };
  issues: {
    orphanAssignments: number;
    invalidPeriodTotals: number;
    duplicateCapabilities: number;
  };
}

async function count(dataSource: DataSource, sql: string): Promise<number> {
  const rows = (await dataSource.query(sql)) as CountRow[];
  return rows.reduce((total, row) => total + Number(row.count ?? 0), 0);
}

/** Validate canonical assignment storage without consulting retired mirrors. */
export async function auditAssignmentStorageConsistency(
  dataSource: DataSource
): Promise<AssignmentConsistencyReport> {
  const [
    canonicalAssignments,
    canonicalRequirements,
    canonicalCapabilities,
    orphanAssignments,
    invalidPeriodTotals,
    duplicateCapabilities,
  ] = await Promise.all([
    count(dataSource, 'SELECT COUNT(*) AS count FROM teaching_assignment WHERE is_deleted = 0'),
    count(
      dataSource,
      'SELECT COUNT(*) AS count FROM class_subject_requirement WHERE is_deleted = 0'
    ),
    count(
      dataSource,
      'SELECT COUNT(*) AS count FROM teacher_subject_capability WHERE is_deleted = 0'
    ),
    count(
      dataSource,
      `SELECT COUNT(*) AS count
       FROM teaching_assignment a
       LEFT JOIN class_subject_requirement r ON r.id = a.class_subject_requirement_id
       LEFT JOIN teacher t ON t.id = a.teacher_id
       WHERE a.is_deleted = 0
         AND (r.id IS NULL OR r.is_deleted = 1 OR t.id IS NULL OR t.isDeleted = 1)`
    ),
    count(
      dataSource,
      `SELECT COUNT(*) AS count FROM (
         SELECT r.id
         FROM class_subject_requirement r
         LEFT JOIN teaching_assignment a
           ON a.class_subject_requirement_id = r.id AND a.is_deleted = 0
         WHERE r.is_deleted = 0
         GROUP BY r.id, r.required_periods_per_week, r.allow_split_assignment
         HAVING COALESCE(SUM(a.assigned_periods_per_week), 0) > r.required_periods_per_week
            OR (r.allow_split_assignment = 0 AND COUNT(a.id) > 1)
       )`
    ),
    count(
      dataSource,
      `SELECT COUNT(*) AS count FROM (
         SELECT teacher_id, subject_id
         FROM teacher_subject_capability
         WHERE is_deleted = 0
         GROUP BY teacher_id, subject_id
         HAVING COUNT(*) > 1
       )`
    ),
  ]);

  const issues = { orphanAssignments, invalidPeriodTotals, duplicateCapabilities };
  return {
    isConsistent: Object.values(issues).every((value) => value === 0),
    checkedAt: new Date().toISOString(),
    counts: { canonicalAssignments, canonicalRequirements, canonicalCapabilities },
    issues,
  };
}
