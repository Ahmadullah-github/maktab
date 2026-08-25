import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
import { DEFAULT_ROOM_TYPES } from '../../constants/roomTypes';

type RoomTypeRow = {
  id: number;
  value: string;
  labelFa: string;
  isDeleted: number;
};

function slug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'normal';
}

function normalizedName(value: string): string {
  return value.trim().toLowerCase();
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

const WEEK_DAYS = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
];

function canonicalUnavailable(raw: string | null): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || '[]');
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
  } catch {
    return raw;
  }
  if (!Array.isArray(parsed)) return raw;

  const canonical: Array<{ day: string; period: number }> = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) return raw;
    const value = entry as { day?: unknown; period?: unknown; periods?: unknown };
    const rawDay = value.day;
    const day =
      typeof rawDay === 'number'
        ? WEEK_DAYS[rawDay]
        : typeof rawDay === 'string'
          ? WEEK_DAYS.find((candidate) => candidate.toLowerCase() === rawDay.toLowerCase())
          : undefined;
    if (!day) return raw;
    const periods = Array.isArray(value.periods) ? value.periods : [value.period];
    if (!periods.every((period) => Number.isInteger(period) && Number(period) >= 0)) return raw;
    for (const period of periods) canonical.push({ day, period: Number(period) });
  }

  const unique = new Map(canonical.map((slot) => [`${slot.day}:${slot.period}`, slot]));
  return JSON.stringify([...unique.values()]);
}

async function addForeignKeyIfMissing(
  queryRunner: QueryRunner,
  tableName: string,
  foreignKey: TableForeignKey
): Promise<void> {
  const table = await queryRunner.getTable(tableName);
  if (!table) throw new Error(`Missing required table ${tableName}`);
  if (!table.foreignKeys.some((existing) => existing.name === foreignKey.name)) {
    await queryRunner.createForeignKey(tableName, foreignKey);
  }
}

export class HardenRoomContracts1784100000000 implements MigrationInterface {
  name = 'HardenRoomContracts1784100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const roomTypeTable = await queryRunner.getTable('room_type');
    if (!roomTypeTable) throw new Error('Missing required table room_type');

    if (roomTypeTable.findColumnByName('label') && !roomTypeTable.findColumnByName('labelFa')) {
      await queryRunner.renameColumn('room_type', 'label', 'labelFa');
    }
    if (!(await queryRunner.hasColumn('room_type', 'labelEn'))) {
      await queryRunner.addColumn(
        'room_type',
        new TableColumn({ name: 'labelEn', type: 'text', isNullable: true })
      );
    }

    // Normalize legacy values without losing custom definitions. Collisions keep the oldest row;
    // later definitions remain archived under a never-reusable legacy slug.
    const typeRows = (await queryRunner.query(
      'SELECT id, value, labelFa, isDeleted FROM room_type ORDER BY id ASC'
    )) as RoomTypeRow[];
    const originalToSlug = new Map<string, string>();
    const ownerBySlug = new Map<string, number>();
    for (const row of typeRows) {
      if (!row.value.trim()) continue;
      const next = slug(row.value);
      originalToSlug.set(row.value, next);
      await queryRunner.query('UPDATE room_type SET value = ? WHERE id = ?', [
        `migration_${row.id}`,
        row.id,
      ]);
    }
    for (const row of typeRows) {
      if (!row.value.trim()) continue;
      const next = originalToSlug.get(row.value)!;
      const owner = ownerBySlug.get(next);
      if (owner === undefined) {
        ownerBySlug.set(next, row.id);
        await queryRunner.query('UPDATE room_type SET value = ? WHERE id = ?', [next, row.id]);
      } else {
        await queryRunner.query(
          'UPDATE room_type SET value = ?, isDeleted = 1, deletedAt = COALESCE(deletedAt, CURRENT_TIMESTAMP) WHERE id = ?',
          [`${next}_legacy_${row.id}`, row.id]
        );
      }
    }

    const legacyRoomTypes = (await queryRunner.query(
      `SELECT DISTINCT type AS value FROM room WHERE type IS NOT NULL AND TRIM(type) <> ''
       UNION
       SELECT DISTINCT requiredRoomType AS value FROM subject
       WHERE requiredRoomType IS NOT NULL AND TRIM(requiredRoomType) <> ''`
    )) as Array<{ value: string }>;

    for (const row of legacyRoomTypes) {
      const next = originalToSlug.get(row.value) ?? slug(row.value);
      await queryRunner.query('UPDATE room SET type = ? WHERE type = ?', [next, row.value]);
      await queryRunner.query('UPDATE subject SET requiredRoomType = ? WHERE requiredRoomType = ?', [
        next,
        row.value,
      ]);
      const exists = (await queryRunner.query('SELECT id FROM room_type WHERE value = ? LIMIT 1', [
        next,
      ])) as Array<{ id: number }>;
      if (exists.length === 0) {
        await queryRunner.query(
          `INSERT INTO room_type
           (value, labelFa, labelEn, icon, sortOrder, isSystem, isDeleted, deletedAt, createdAt, updatedAt)
           VALUES (?, ?, ?, 'Building', 1000, 0, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [next, row.value.trim(), row.value.trim()]
        );
      }
    }

    for (const definition of DEFAULT_ROOM_TYPES) {
      await queryRunner.query(
        `INSERT OR IGNORE INTO room_type
         (value, labelFa, labelEn, icon, sortOrder, isSystem, isDeleted, deletedAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 1, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          definition.value,
          definition.labelFa,
          definition.labelEn,
          definition.icon,
          definition.sortOrder,
        ]
      );
    }

    await queryRunner.query(`UPDATE room SET type = 'normal' WHERE type IS NULL OR TRIM(type) = ''`);
    await queryRunner.query(
      `UPDATE subject SET requiredRoomType = NULL
       WHERE requiredRoomType IS NULL OR TRIM(requiredRoomType) = ''`
    );
    await queryRunner.query(`DELETE FROM room_type WHERE TRIM(value) = ''`);
    await queryRunner.query(
      `UPDATE room_type SET labelEn = labelFa WHERE labelEn IS NULL OR TRIM(labelEn) = ''`
    );
    await queryRunner.query(
      `UPDATE room_type SET isDeleted = 0, deletedAt = NULL
       WHERE value IN (SELECT DISTINCT type FROM room WHERE isDeleted = 0)
          OR value IN (
            SELECT DISTINCT requiredRoomType FROM subject
            WHERE isDeleted = 0 AND requiredRoomType IS NOT NULL
          )`
    );

    if (!(await queryRunner.hasColumn('room', 'normalizedName'))) {
      await queryRunner.addColumn(
        'room',
        new TableColumn({ name: 'normalizedName', type: 'text', isNullable: true })
      );
    }
    if (!(await queryRunner.hasColumn('class_group', 'homeRoomId'))) {
      await queryRunner.addColumn(
        'class_group',
        new TableColumn({ name: 'homeRoomId', type: 'integer', isNullable: true })
      );
    }

    const rooms = (await queryRunner.query(
      'SELECT id, name, unavailable, features, isDeleted FROM room ORDER BY id ASC'
    )) as Array<{ id: number; name: string; unavailable: string | null; features: string | null; isDeleted: number }>;
    for (const room of rooms) {
      await queryRunner.query(
        'UPDATE room SET name = ?, normalizedName = ?, unavailable = ?, features = ? WHERE id = ?',
        [
          room.name.trim(),
          normalizedName(room.name),
          canonicalUnavailable(room.unavailable),
          canonicalFeatureTags(room.features),
          room.id,
        ]
      );
    }

    const activeByName = new Map<string, number>();
    for (const room of rooms.filter((row) => !row.isDeleted)) {
      const key = normalizedName(room.name);
      const canonicalId = activeByName.get(key);
      if (canonicalId === undefined) {
        activeByName.set(key, room.id);
        continue;
      }
      await queryRunner.query('UPDATE class_group SET fixedRoomId = ? WHERE fixedRoomId = ?', [
        canonicalId,
        room.id,
      ]);
      const teachers = (await queryRunner.query(
        'SELECT id, preferredRoomIds FROM teacher'
      )) as Array<{ id: number; preferredRoomIds: string | null }>;
      for (const teacher of teachers) {
        let ids: unknown = [];
        try {
          ids = JSON.parse(teacher.preferredRoomIds || '[]');
        } catch {
          ids = [];
        }
        if (Array.isArray(ids) && ids.some((id) => Number(id) === room.id)) {
          const mapped = [
            ...new Set(ids.map((id) => (Number(id) === room.id ? canonicalId : Number(id)))),
          ];
          await queryRunner.query('UPDATE teacher SET preferredRoomIds = ? WHERE id = ?', [
            JSON.stringify(mapped),
            teacher.id,
          ]);
        }
      }
      await queryRunner.query(
        'UPDATE room SET isDeleted = 1, deletedAt = COALESCE(deletedAt, CURRENT_TIMESTAMP) WHERE id = ?',
        [room.id]
      );
    }

    await queryRunner.changeColumn(
      'room',
      'normalizedName',
      new TableColumn({ name: 'normalizedName', type: 'text', isNullable: false })
    );

    const currentRoom = await queryRunner.getTable('room');
    if (!currentRoom?.indices.some((index) => index.name === 'IDX_room_normalized_name_active')) {
      await queryRunner.createIndex(
        'room',
        new TableIndex({
          name: 'IDX_room_normalized_name_active',
          columnNames: ['normalizedName'],
          isUnique: true,
          where: '"isDeleted" = 0',
        })
      );
    }
    const currentClass = await queryRunner.getTable('class_group');
    if (!currentClass?.indices.some((index) => index.name === 'IDX_class_group_home_room')) {
      await queryRunner.createIndex(
        'class_group',
        new TableIndex({ name: 'IDX_class_group_home_room', columnNames: ['homeRoomId'] })
      );
    }

    await addForeignKeyIfMissing(
      queryRunner,
      'room',
      new TableForeignKey({
        name: 'FK_room_type_value',
        columnNames: ['type'],
        referencedTableName: 'room_type',
        referencedColumnNames: ['value'],
        onDelete: 'RESTRICT',
        onUpdate: 'RESTRICT',
      })
    );
    await addForeignKeyIfMissing(
      queryRunner,
      'subject',
      new TableForeignKey({
        name: 'FK_subject_required_room_type',
        columnNames: ['requiredRoomType'],
        referencedTableName: 'room_type',
        referencedColumnNames: ['value'],
        onDelete: 'RESTRICT',
        onUpdate: 'RESTRICT',
      })
    );
    await addForeignKeyIfMissing(
      queryRunner,
      'class_group',
      new TableForeignKey({
        name: 'FK_class_group_home_room',
        columnNames: ['homeRoomId'],
        referencedTableName: 'room',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const classTable = await queryRunner.getTable('class_group');
    const homeForeignKey = classTable?.foreignKeys.find((key) => key.name === 'FK_class_group_home_room');
    if (homeForeignKey) await queryRunner.dropForeignKey('class_group', homeForeignKey);

    const subjectTable = await queryRunner.getTable('subject');
    const subjectForeignKey = subjectTable?.foreignKeys.find(
      (key) => key.name === 'FK_subject_required_room_type'
    );
    if (subjectForeignKey) await queryRunner.dropForeignKey('subject', subjectForeignKey);

    const roomTable = await queryRunner.getTable('room');
    const roomForeignKey = roomTable?.foreignKeys.find((key) => key.name === 'FK_room_type_value');
    if (roomForeignKey) await queryRunner.dropForeignKey('room', roomForeignKey);
    if (roomTable?.indices.some((index) => index.name === 'IDX_room_normalized_name_active')) {
      await queryRunner.dropIndex('room', 'IDX_room_normalized_name_active');
    }
    if (await queryRunner.hasColumn('class_group', 'homeRoomId')) {
      await queryRunner.dropColumn('class_group', 'homeRoomId');
    }
    if (await queryRunner.hasColumn('room', 'normalizedName')) {
      await queryRunner.dropColumn('room', 'normalizedName');
    }
    if (await queryRunner.hasColumn('room_type', 'labelEn')) {
      await queryRunner.dropColumn('room_type', 'labelEn');
    }
    const typeTable = await queryRunner.getTable('room_type');
    if (typeTable?.findColumnByName('labelFa') && !typeTable.findColumnByName('label')) {
      await queryRunner.renameColumn('room_type', 'labelFa', 'label');
    }
  }
}
