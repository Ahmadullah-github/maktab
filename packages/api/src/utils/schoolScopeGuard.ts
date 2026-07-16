import { DataSource } from 'typeorm';

export type OperationalEntityName = 'room' | 'class_group' | 'teacher' | 'subject';

export interface SchoolScopeRow {
  entity: OperationalEntityName;
  id: number;
  schoolId: number | null;
}

export interface SchoolScopeConflictDetails {
  nullScoped: Array<{ entity: OperationalEntityName; id: number }>;
  schoolIds: number[];
  requestedSchoolId?: number | null;
  activeSchoolId?: number | null;
}

export class SchoolScopeConflictError extends Error {
  readonly code = 'SCHOOL_SCOPE_CONFLICT';
  readonly statusCode = 409;

  constructor(public readonly details: SchoolScopeConflictDetails) {
    super(
      details.requestedSchoolId !== undefined
        ? 'Requested school scope does not match the active operational data scope'
        : 'Active operational data mixes default and school-specific scopes or multiple schools'
    );
    this.name = 'SchoolScopeConflictError';
  }
}

const OPERATIONAL_TABLES: OperationalEntityName[] = ['room', 'class_group', 'teacher', 'subject'];

export async function readOperationalScopeRows(dataSource: DataSource): Promise<SchoolScopeRow[]> {
  const rows: SchoolScopeRow[] = [];
  for (const entity of OPERATIONAL_TABLES) {
    const values = (await dataSource.query(
      `SELECT id, schoolId FROM "${entity}" WHERE isDeleted = 0`
    )) as Array<{ id: number; schoolId: number | null }>;
    rows.push(...values.map((value) => ({ entity, id: value.id, schoolId: value.schoolId })));
  }
  return rows;
}

function conflictFor(rows: SchoolScopeRow[]): SchoolScopeConflictDetails | null {
  const nullScoped = rows
    .filter((row) => row.schoolId === null)
    .map((row) => ({ entity: row.entity, id: row.id }));
  const schoolIds = [...new Set(rows.flatMap((row) => (row.schoolId === null ? [] : [row.schoolId])))];
  if ((nullScoped.length > 0 && schoolIds.length > 0) || schoolIds.length > 1) {
    return { nullScoped, schoolIds };
  }
  return null;
}

export async function assertOperationalScopeIsConsistent(dataSource: DataSource): Promise<number | null> {
  const rows = await readOperationalScopeRows(dataSource);
  const conflict = conflictFor(rows);
  if (conflict) throw new SchoolScopeConflictError(conflict);
  const nonNull = rows.find((row) => row.schoolId !== null)?.schoolId;
  return nonNull ?? null;
}

export async function assertOperationalWriteScope(
  dataSource: DataSource,
  proposed: Array<{ entity: OperationalEntityName; id?: number; schoolId: number | null }>
): Promise<void> {
  const excluded = new Set(
    proposed.filter((row) => row.id !== undefined).map((row) => `${row.entity}:${row.id}`)
  );
  const current = (await readOperationalScopeRows(dataSource)).filter(
    (row) => !excluded.has(`${row.entity}:${row.id}`)
  );
  const rows = [
    ...current,
    ...proposed.map((row, index) => ({
      entity: row.entity,
      id: row.id ?? -(index + 1),
      schoolId: row.schoolId,
    })),
  ];
  const conflict = conflictFor(rows);
  if (conflict) throw new SchoolScopeConflictError(conflict);
}
