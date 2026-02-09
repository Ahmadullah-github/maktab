#!/usr/bin/env node
/**
 * Data Migration Script: Migrate Teacher classAssignments to TeacherClassSubjectAssignment
 *
 * This script migrates existing assignment data from the old system (Teacher.classAssignments)
 * to the new multi-teacher assignment system (TeacherClassSubjectAssignment table).
 *
 * Usage:
 *   node scripts/migrate-assignments.js [--dry-run] [--verbose]
 *
 * Options:
 *   --dry-run   Preview changes without writing to database
 *   --verbose   Show detailed output
 *
 * Requirements: Multi-Teacher Assignment Feature - Phase 4.2
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'timetable.db');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function printHeader(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

/**
 * Parse JSON string safely
 */
function parseJSON(str, defaultValue = []) {
  if (!str) return defaultValue;
  if (Array.isArray(str)) return str;
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

/**
 * Main migration function
 */
function migrateAssignments(options = {}) {
  const { dryRun = false, verbose = false } = options;

  printHeader('📦 MIGRATE TEACHER ASSIGNMENTS');
  log(`Database: ${dbPath}`, 'cyan');
  log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`, dryRun ? 'yellow' : 'green');
  console.log('');

  if (!fs.existsSync(dbPath)) {
    log('❌ Database file not found!', 'red');
    process.exit(1);
  }

  const db = new Database(dbPath);

  try {
    // Check if new table exists
    const tableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='teacher_class_subject_assignment'"
      )
      .get();

    if (!tableExists) {
      log('⚠️  Table teacher_class_subject_assignment does not exist.', 'yellow');
      log('   Creating table now...', 'cyan');

      // Create the table
      db.exec(`
        CREATE TABLE "teacher_class_subject_assignment" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "teacherId" INTEGER NOT NULL,
          "classId" INTEGER NOT NULL,
          "subjectId" INTEGER NOT NULL,
          "periodsPerWeek" INTEGER NOT NULL,
          "isFixed" BOOLEAN DEFAULT 1,
          "schoolId" INTEGER NULL,
          "isDeleted" BOOLEAN DEFAULT 0,
          "deletedAt" DATETIME NULL,
          "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes
      db.exec(`
        CREATE UNIQUE INDEX "UQ_tcsa_teacher_class_subject"
        ON "teacher_class_subject_assignment" ("teacherId", "classId", "subjectId")
        WHERE "isDeleted" = 0
      `);
      db.exec(`
        CREATE INDEX "IDX_tcsa_class_subject"
        ON "teacher_class_subject_assignment" ("classId", "subjectId")
      `);
      db.exec(`
        CREATE INDEX "IDX_tcsa_teacher"
        ON "teacher_class_subject_assignment" ("teacherId")
      `);

      log('✅ Table created successfully!', 'green');
      console.log('');
    }

    // Get all teachers
    const teachers = db.prepare('SELECT * FROM teacher WHERE isDeleted = 0').all();
    log(`Found ${teachers.length} active teachers`, 'cyan');

    // Get all classes for period lookup
    const classes = db.prepare('SELECT * FROM class_group WHERE isDeleted = 0').all();
    const classMap = new Map(classes.map((c) => [c.id, c]));
    log(`Found ${classes.length} active classes`, 'cyan');

    // Check existing assignments in new table
    const existingCount = db
      .prepare('SELECT COUNT(*) as count FROM teacher_class_subject_assignment WHERE isDeleted = 0')
      .get().count;
    log(`Existing assignments in new table: ${existingCount}`, 'cyan');
    console.log('');

    // Prepare insert statement
    const insertStmt = db.prepare(`
      INSERT INTO teacher_class_subject_assignment
      (teacherId, classId, subjectId, periodsPerWeek, isFixed, schoolId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
    `);

    // Check for existing assignment
    const checkExistingStmt = db.prepare(`
      SELECT id FROM teacher_class_subject_assignment
      WHERE teacherId = ? AND classId = ? AND subjectId = ? AND isDeleted = 0
    `);

    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Process each teacher
    for (const teacher of teachers) {
      const classAssignments = parseJSON(teacher.classAssignments, []);

      if (classAssignments.length === 0) {
        if (verbose) {
          log(`  Teacher ${teacher.id} (${teacher.fullName}): No assignments`, 'yellow');
        }
        continue;
      }

      if (verbose) {
        log(`\nTeacher ${teacher.id} (${teacher.fullName}):`, 'bright');
      }

      for (const assignment of classAssignments) {
        const subjectId =
          typeof assignment.subjectId === 'string'
            ? parseInt(assignment.subjectId, 10)
            : assignment.subjectId;

        const classIds = parseJSON(assignment.classIds, []).map((id) =>
          typeof id === 'string' ? parseInt(id, 10) : id
        );

        for (const classId of classIds) {
          // Get periods from class subject requirements
          const classData = classMap.get(classId);
          let periodsPerWeek = 1; // Default

          if (classData) {
            const requirements = parseJSON(classData.subjectRequirements, []);
            const requirement = requirements.find((r) => r.subjectId === subjectId);
            if (requirement?.periodsPerWeek) {
              periodsPerWeek = requirement.periodsPerWeek;
            }
          }

          // Check if already exists
          const existing = checkExistingStmt.get(teacher.id, classId, subjectId);

          if (existing) {
            if (verbose) {
              log(
                `    ⏭️  Skip: Subject ${subjectId}, Class ${classId} (already exists)`,
                'yellow'
              );
            }
            totalSkipped++;
            continue;
          }

          if (verbose) {
            log(
              `    ➕ Add: Subject ${subjectId}, Class ${classId}, ${periodsPerWeek} periods`,
              'green'
            );
          }

          if (!dryRun) {
            try {
              insertStmt.run(teacher.id, classId, subjectId, periodsPerWeek, teacher.schoolId);
              totalMigrated++;
            } catch (error) {
              log(`    ❌ Error: ${error.message}`, 'red');
              totalErrors++;
            }
          } else {
            totalMigrated++;
          }
        }
      }
    }

    // Summary
    printHeader('📊 MIGRATION SUMMARY');
    log(`Total assignments migrated: ${totalMigrated}`, 'green');
    log(`Total assignments skipped:  ${totalSkipped}`, 'yellow');
    log(`Total errors:               ${totalErrors}`, totalErrors > 0 ? 'red' : 'green');

    if (dryRun) {
      console.log('');
      log('⚠️  DRY RUN - No changes were made to the database', 'yellow');
      log('   Run without --dry-run to apply changes', 'cyan');
    } else {
      console.log('');
      log('✅ Migration completed successfully!', 'green');
    }

    db.close();
  } catch (error) {
    log(`\n❌ Migration failed: ${error.message}`, 'red');
    console.error(error);
    db.close();
    process.exit(1);
  }
}

/**
 * Verify migration results
 */
function verifyMigration() {
  printHeader('🔍 VERIFY MIGRATION');

  if (!fs.existsSync(dbPath)) {
    log('❌ Database file not found!', 'red');
    process.exit(1);
  }

  const db = new Database(dbPath);

  try {
    // Count assignments in new table
    const newCount = db
      .prepare('SELECT COUNT(*) as count FROM teacher_class_subject_assignment WHERE isDeleted = 0')
      .get().count;

    // Count assignments in old system
    const teachers = db.prepare('SELECT classAssignments FROM teacher WHERE isDeleted = 0').all();
    let oldCount = 0;

    for (const teacher of teachers) {
      const assignments = parseJSON(teacher.classAssignments, []);
      for (const assignment of assignments) {
        const classIds = parseJSON(assignment.classIds, []);
        oldCount += classIds.length;
      }
    }

    log(`Assignments in old system (Teacher.classAssignments): ${oldCount}`, 'cyan');
    log(`Assignments in new table (TeacherClassSubjectAssignment): ${newCount}`, 'cyan');

    if (newCount >= oldCount) {
      log('\n✅ Migration appears complete!', 'green');
    } else {
      log(`\n⚠️  New table has fewer assignments (${newCount} vs ${oldCount})`, 'yellow');
      log('   Some assignments may not have been migrated.', 'yellow');
    }

    // Show sample data
    console.log('\nSample assignments in new table:');
    const samples = db
      .prepare(
        `
      SELECT tcsa.*, t.fullName as teacherName
      FROM teacher_class_subject_assignment tcsa
      JOIN teacher t ON t.id = tcsa.teacherId
      WHERE tcsa.isDeleted = 0
      LIMIT 5
    `
      )
      .all();

    samples.forEach((row, idx) => {
      console.log(
        `  ${idx + 1}. Teacher: ${row.teacherName}, Class: ${row.classId}, Subject: ${row.subjectId}, Periods: ${row.periodsPerWeek}`
      );
    });

    db.close();
  } catch (error) {
    log(`\n❌ Verification failed: ${error.message}`, 'red');
    db.close();
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose') || args.includes('-v');
const verify = args.includes('--verify');

if (verify) {
  verifyMigration();
} else {
  migrateAssignments({ dryRun, verbose });
}
