'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const Database = require('better-sqlite3');

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function tableExists(database, name) {
  return Boolean(
    database
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(name)
  );
}

function columns(database, table) {
  if (!tableExists(database, table)) return new Set();
  return new Set(database.prepare(`PRAGMA table_info("${table}")`).all().map((row) => row.name));
}

function rows(database, sql, parameters = []) {
  return database.prepare(sql).all(...parameters).map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalize(value)]))
  );
}

function normalize(value) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!(text.startsWith('{') || text.startsWith('['))) return value;
  try {
    return normalizeJson(JSON.parse(text));
  } catch {
    return value;
  }
}

function normalizeJson(value) {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, normalizeJson(child)])
  );
}

function logicalState(databasePath) {
  const database = new Database(databasePath, { readonly: true });
  try {
    const state = {
      school: tableExists(database, 'school_config')
        ? rows(database, 'SELECT id, schoolName, daysPerWeek FROM school_config ORDER BY id')
        : [],
      teachers: tableExists(database, 'teacher')
        ? rows(database, 'SELECT id, fullName, maxPeriodsPerWeek, isDeleted FROM teacher ORDER BY id')
        : [],
      subjects: tableExists(database, 'subject')
        ? rows(database, 'SELECT id, name, periodsPerWeek, isDeleted FROM subject ORDER BY id')
        : [],
      classes: tableExists(database, 'class_group')
        ? rows(database, 'SELECT id, name, grade, studentCount, isDeleted FROM class_group ORDER BY id')
        : [],
      rooms: tableExists(database, 'room')
        ? rows(database, 'SELECT id, name, capacity, isDeleted FROM room ORDER BY id')
        : [],
      timetables: tableExists(database, 'timetable')
        ? rows(database, 'SELECT id, name, data, isDeleted FROM timetable ORDER BY id')
        : [],
      requirements: [],
      assignments: [],
      capabilities: [],
      // Curriculum migrations are verified separately because legacy config
      // represents a template expansion rather than one-to-one stored rows.
      curriculum: [],
    };

    if (tableExists(database, 'class_subject_requirement')) {
      state.requirements = rows(
        database,
        `SELECT class_id AS classId, subject_id AS subjectId,
                required_periods_per_week AS periods, is_deleted AS isDeleted
         FROM class_subject_requirement ORDER BY class_id, subject_id`
      );
    }
    if (tableExists(database, 'teaching_assignment')) {
      state.assignments = rows(
        database,
        `SELECT a.teacher_id AS teacherId, r.class_id AS classId,
                r.subject_id AS subjectId, a.assigned_periods_per_week AS periods,
                a.is_deleted AS isDeleted
         FROM teaching_assignment a
         JOIN class_subject_requirement r ON r.id = a.class_subject_requirement_id
         ORDER BY a.teacher_id, r.class_id, r.subject_id`
      );
    }
    if (state.assignments.length === 0 && tableExists(database, 'teacher_class_subject_assignment')) {
      state.assignments = rows(
        database,
        `SELECT teacherId, classId, subjectId, periodsPerWeek AS periods, isDeleted
         FROM teacher_class_subject_assignment ORDER BY teacherId, classId, subjectId`
      );
    }
    if (tableExists(database, 'teacher_subject_capability')) {
      state.capabilities = rows(
        database,
        `SELECT teacher_id AS teacherId, subject_id AS subjectId,
                capability_level AS level, is_deleted AS isDeleted
         FROM teacher_subject_capability ORDER BY teacher_id, subject_id`
      );
    }
    if (state.requirements.length === 0 && columns(database, 'class_group').has('subjectRequirements')) {
      const mirrors = rows(database, 'SELECT id, subjectRequirements FROM class_group ORDER BY id');
      state.requirements = mirrors.flatMap((row) =>
        (Array.isArray(row.subjectRequirements) ? row.subjectRequirements : []).map((item) => ({
          classId: row.id,
          subjectId: Number(item.subjectId),
          periods: Number(item.periodsPerWeek),
          isDeleted: 0,
        }))
      );
    }
    if (state.capabilities.length === 0 && columns(database, 'teacher').has('primarySubjectIds')) {
      const mirrors = rows(
        database,
        'SELECT id, primarySubjectIds, allowedSubjectIds FROM teacher ORDER BY id'
      );
      state.capabilities = mirrors.flatMap((row) => [
        ...(Array.isArray(row.primarySubjectIds) ? row.primarySubjectIds : []).map((subjectId) => ({
          teacherId: row.id,
          subjectId: Number(subjectId),
          level: 'primary',
          isDeleted: 0,
        })),
        ...(Array.isArray(row.allowedSubjectIds) ? row.allowedSubjectIds : []).map((subjectId) => ({
          teacherId: row.id,
          subjectId: Number(subjectId),
          level: 'allowed',
          isDeleted: 0,
        })),
      ]);
    }
    return normalizeJson(state);
  } finally {
    database.close();
  }
}

function logicalFingerprint(databasePath) {
  return sha256Buffer(Buffer.from(JSON.stringify(logicalState(databasePath))));
}

module.exports = { logicalFingerprint, logicalState, sha256Buffer, sha256File, tableExists };
