#!/usr/bin/env node
/**
 * Database Manager CLI Tool
 * Comprehensive database management operations
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'timetable.db');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function printHeader(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

function printMenu() {
  printHeader('📊 DATABASE MANAGER');
  log('Database: ' + dbPath, 'cyan');
  console.log('\nBASIC OPERATIONS:');
  console.log('  1.  📋 Show all tables');
  console.log('  2.  📊 Show table statistics');
  console.log('  3.  🔍 View table data');
  console.log('  4.  🗑️  Delete all records from a table');
  console.log('  5.  💾 Backup database');
  console.log('  6.  📥 Restore from backup');
  
  console.log('\nADVANCED OPERATIONS:');
  console.log('  7.  🔬 Inspect wizard configuration');
  console.log('  8.  👥 List all teachers');
  console.log('  9.  📚 List all subjects');
  console.log('  10. 🏫 List all classes');
  console.log('  11. ⏰ Show periods configuration');
  console.log('  12. 🧪 Validate data integrity');
  console.log('  13. 🔧 Fix teacher availability');
  console.log('  14. 📝 Export data to JSON');
  console.log('  15. 📥 Import data from JSON');
  console.log('  16. 🔍 Custom SQL query');
  console.log('  17. 📈 Generate statistics report');
  
  console.log('\nDANGEROUS OPERATIONS:');
  log('  99. 🔥 RESET ENTIRE DATABASE (delete all data)', 'red');
  
  console.log('\n  0.  🚪 Exit\n');
}

class DatabaseManager {
  constructor() {
    if (!fs.existsSync(dbPath)) {
      log('⚠️  Database does not exist. Creating new database...', 'yellow');
    }
    this.db = new Database(dbPath);
  }

  close() {
    this.db.close();
  }

  // Basic Operations
  showTables() {
    printHeader('📋 DATABASE TABLES');
    const tables = this.db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name").all();
    
    if (tables.length === 0) {
      log('No tables found', 'yellow');
      return;
    }

    tables.forEach((table, idx) => {
      console.log(`\n${idx + 1}. ${table.name}`);
      if (table.sql) {
        console.log('   Schema:');
        const lines = table.sql.split('\n').slice(1, -1);
        lines.forEach(line => console.log('   ' + line.trim()));
      }
    });
    
    console.log(`\nTotal: ${tables.length} tables`);
  }

  showStatistics() {
    printHeader('📊 TABLE STATISTICS');
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    
    if (tables.length === 0) {
      log('No tables found', 'yellow');
      return;
    }

    console.log('Table                          Records    Size');
    console.log('-'.repeat(60));
    
    let totalRecords = 0;
    tables.forEach(table => {
      try {
        const count = this.db.prepare(`SELECT COUNT(*) as count FROM "${table.name}"`).get().count;
        totalRecords += count;
        const size = count > 0 ? '~' + (count * 100) + ' bytes' : 'empty';
        console.log(`${table.name.padEnd(30)} ${String(count).padStart(8)}   ${size}`);
      } catch (error) {
        console.log(`${table.name.padEnd(30)} ERROR: ${error.message}`);
      }
    });
    
    console.log('-'.repeat(60));
    console.log(`Total                          ${String(totalRecords).padStart(8)}`);
  }

  viewTableData(tableName) {
    printHeader(`🔍 TABLE DATA: ${tableName}`);
    
    try {
      const data = this.db.prepare(`SELECT * FROM "${tableName}" LIMIT 100`).all();
      
      if (data.length === 0) {
        log('Table is empty', 'yellow');
        return;
      }

      console.log(`Showing ${data.length} records:\n`);
      data.forEach((row, idx) => {
        console.log(`Record ${idx + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          let displayValue = value;
          if (typeof value === 'string' && value.length > 100) {
            displayValue = value.substring(0, 100) + '...';
          }
          console.log(`  ${key}: ${displayValue}`);
        });
        console.log('');
      });
    } catch (error) {
      log(`Error: ${error.message}`, 'red');
    }
  }

  deleteTableData(tableName) {
    try {
      const count = this.db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get().count;
      
      if (count === 0) {
        log('Table is already empty', 'yellow');
        return;
      }

      this.db.prepare(`DELETE FROM "${tableName}"`).run();
      log(`✅ Deleted ${count} record(s) from ${tableName}`, 'green');
    } catch (error) {
      log(`Error: ${error.message}`, 'red');
    }
  }

  backupDatabase() {
    printHeader('💾 BACKUP DATABASE');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = dbPath.replace('.db', `.backup.${timestamp}.db`);
    
    try {
      fs.copyFileSync(dbPath, backupPath);
      log(`✅ Backup created: ${path.basename(backupPath)}`, 'green');
      log(`   Location: ${backupPath}`, 'cyan');
    } catch (error) {
      log(`Error: ${error.message}`, 'red');
    }
  }

  listBackups() {
    const dir = path.dirname(dbPath);
    const files = fs.readdirSync(dir);
    const backups = files.filter(f => f.includes('.backup.') && f.endsWith('.db'));
    
    if (backups.length === 0) {
      log('No backups found', 'yellow');
      return [];
    }

    console.log('\nAvailable backups:');
    backups.forEach((backup, idx) => {
      const stat = fs.statSync(path.join(dir, backup));
      console.log(`  ${idx + 1}. ${backup} (${(stat.size / 1024).toFixed(2)} KB)`);
    });
    
    return backups;
  }

  // Advanced Operations
  inspectWizardConfig() {
    printHeader('🔬 WIZARD CONFIGURATION');
    
    try {
      const wizardData = this.db.prepare('SELECT * FROM wizard_data').all();
      
      if (wizardData.length === 0) {
        log('No wizard data found', 'yellow');
        return;
      }

      wizardData.forEach(row => {
        console.log(`\n${row.key}:`);
        try {
          const data = JSON.parse(row.value);
          if (Array.isArray(data)) {
            console.log(`  Array with ${data.length} items`);
          } else if (typeof data === 'object') {
            console.log(JSON.stringify(data, null, 2));
          } else {
            console.log(`  ${data}`);
          }
        } catch {
          console.log(`  ${row.value}`);
        }
      });
    } catch (error) {
      log(`Error: ${error.message}`, 'red');
    }
  }

  listTeachers() {
    printHeader('👥 TEACHERS');
    
    try {
      const teachersRow = this.db.prepare("SELECT value FROM wizard_data WHERE key = 'teachers'").get();
      
      if (!teachersRow) {
        log('No teachers found', 'yellow');
        return;
      }

      const teachers = JSON.parse(teachersRow.value);
      console.log(`Total teachers: ${teachers.length}\n`);
      
      teachers.forEach((teacher, idx) => {
        console.log(`${idx + 1}. ${teacher.fullName || teacher.name} (ID: ${teacher.id})`);
        
        // Show subjects
        if (teacher.primarySubjectIds && teacher.primarySubjectIds.length > 0) {
          console.log(`   Primary subjects: ${teacher.primarySubjectIds.join(', ')}`);
        }
        
        // Show availability summary
        if (teacher.availability) {
          const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
          let availableSlots = 0;
          let totalSlots = 0;
          
          DAYS.forEach(day => {
            if (teacher.availability[day]) {
              totalSlots += teacher.availability[day].length;
              availableSlots += teacher.availability[day].filter(Boolean).length;
            }
          });
          
          const percentage = totalSlots > 0 ? ((availableSlots / totalSlots) * 100).toFixed(0) : 0;
          console.log(`   Availability: ${availableSlots}/${totalSlots} periods (${percentage}%)`);
        }
        
        console.log('');
      });
    } catch (error) {
      log(`Error: ${error.message}`, 'red');
    }
  }

  listSubjects() {
    printHeader('📚 SUBJECTS');
    
    try {
      const subjectsRow = this.db.prepare("SELECT value FROM wizard_data WHERE key = 'subjects'").get();
      
      if (!subjectsRow) {
        log('No subjects found', 'yellow');
        return;
      }

      const subjects = JSON.parse(subjectsRow.value);
      console.log(`Total subjects: ${subjects.length}\n`);
      
      // Group by grade
      const byGrade = {};
      subjects.forEach(subject => {
        const grade = subject.grade || 'Unknown';
        if (!byGrade[grade]) byGrade[grade] = [];
        byGrade[grade].push(subject);
      });
      
      Object.keys(byGrade).sort().forEach(grade => {
        console.log(`\nGrade ${grade}:`);
        byGrade[grade].forEach(subject => {
          console.log(`  • ${subject.name} (${subject.periodsPerWeek} periods/week)`);
        });
      });
    } catch (error) {
      log(`Error: ${error.message}`, 'red');
    }
  }

  listClasses() {
    printHeader('🏫 CLASSES');
    
    try {
      const classesRow = this.db.prepare("SELECT value FROM wizard_data WHERE key = 'classes'").get();
      
      if (!classesRow) {
        log('No classes found', 'yellow');
        return;
      }

      const classes = JSON.parse(classesRow.value);
      console.log(`Total classes: ${classes.length}\n`);
      
      classes.forEach((cls, idx) => {
        console.log(`${idx + 1}. ${cls.name} (Grade ${cls.gradeLevel || cls.grade || '?'})`);
        
        if (cls.subjectRequirements) {
          const totalPeriods = cls.subjectRequirements.reduce((sum, req) => sum + (req.periodsPerWeek || 0), 0);
          console.log(`   Subjects: ${cls.subjectRequirements.length}, Total periods: ${totalPeriods}`);
        }
        
        if (cls.fixedRoomId) {
          console.log(`   Fixed room: ${cls.fixedRoomId}`);
        }
        
        console.log('');
      });
    } catch (error) {
      log(`Error: ${error.message}`, 'red');
    }
  }

  showPeriodsConfig() {
    printHeader('⏰ PERIODS CONFIGURATION');
    
    try {
      const periodsRow = this.db.prepare("SELECT value FROM wizard_data WHERE key = 'periodsInfo'").get();
      const schoolRow = this.db.prepare("SELECT value FROM wizard_data WHERE key = 'schoolInfo'").get();
      
      if (!periodsRow || !schoolRow) {
        log('Configuration not found', 'yellow');
        return;
      }

      const periodsInfo = JSON.parse(periodsRow.value);
      const schoolInfo = JSON.parse(schoolRow.value);
      
      console.log(`Days per week: ${schoolInfo.daysPerWeek || 6}`);
      console.log(`Periods per day (default): ${periodsInfo.periodsPerDay || 6}`);
      console.log(`Variable periods enabled: ${schoolInfo.variablePeriodsPerDay ? 'Yes' : 'No'}`);
      
      if (periodsInfo.periodsPerDayMap && Object.keys(periodsInfo.periodsPerDayMap).length > 0) {
        console.log('\n📅 Variable periods per day:');
        const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        DAYS.slice(0, schoolInfo.daysPerWeek || 6).forEach(day => {
          const periods = periodsInfo.periodsPerDayMap[day] || periodsInfo.periodsPerDay || 6;
          console.log(`  ${day.padEnd(10)}: ${periods} periods`);
        });
        
        const totalWeekly = DAYS.slice(0, schoolInfo.daysPerWeek || 6)
          .reduce((sum, day) => sum + (periodsInfo.periodsPerDayMap[day] || periodsInfo.periodsPerDay || 6), 0);
        console.log(`\nTotal weekly periods: ${totalWeekly}`);
      }
      
      if (schoolInfo.breakPeriods && schoolInfo.breakPeriods.length > 0) {
        console.log('\n☕ Break periods:');
        schoolInfo.breakPeriods.forEach(bp => {
          console.log(`  After period ${bp.afterPeriod}: ${bp.duration} minutes`);
        });
      }
    } catch (error) {
      log(`Error: ${error.message}`, 'red');
    }
  }

  validateDataIntegrity() {
    printHeader('🧪 DATA INTEGRITY CHECK');
    
    const issues = [];
    
    try {
      // Check if tables exist
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      log(`✓ Found ${tables.length} tables`, 'green');
      
      // Check wizard_data
      const wizardData = this.db.prepare('SELECT * FROM wizard_data').all();
      log(`✓ Found ${wizardData.length} wizard data entries`, 'green');
      
      // Validate each wizard data entry
      const requiredKeys = ['schoolInfo', 'periodsInfo', 'subjects', 'teachers', 'classes', 'rooms'];
      requiredKeys.forEach(key => {
        const entry = wizardData.find(row => row.key === key);
        if (!entry) {
          issues.push(`Missing wizard data: ${key}`);
        } else {
          try {
            JSON.parse(entry.value);
            log(`✓ ${key} data is valid JSON`, 'green');
          } catch {
            issues.push(`Invalid JSON in ${key}`);
          }
        }
      });
      
      // Validate teachers
      const teachersRow = this.db.prepare("SELECT value FROM wizard_data WHERE key = 'teachers'").get();
      if (teachersRow) {
        const teachers = JSON.parse(teachersRow.value);
        const periodsRow = this.db.prepare("SELECT value FROM wizard_data WHERE key = 'periodsInfo'").get();
        const schoolRow = this.db.prepare("SELECT value FROM wizard_data WHERE key = 'schoolInfo'").get();
        
        if (periodsRow && schoolRow) {
          const periodsInfo = JSON.parse(periodsRow.value);
          const schoolInfo = JSON.parse(schoolRow.value);
          const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
          
          teachers.forEach(teacher => {
            if (teacher.availability) {
              DAYS.slice(0, schoolInfo.daysPerWeek || 6).forEach(day => {
                const expected = periodsInfo.periodsPerDayMap?.[day] || periodsInfo.periodsPerDay || 6;
                const actual = teacher.availability[day]?.length || 0;
                
                if (actual !== expected) {
                  issues.push(`Teacher '${teacher.fullName || teacher.name}' has ${actual} periods for ${day}, expected ${expected}`);
                }
              });
            }
          });
        }
        
        log(`✓ Checked ${teachers.length} teachers`, 'green');
      }
      
      // Show results
      console.log('');
      if (issues.length === 0) {
        log('✅ No integrity issues found!', 'green');
      } else {
        log(`⚠️  Found ${issues.length} issue(s):`, 'yellow');
        issues.forEach((issue, idx) => {
          console.log(`  ${idx + 1}. ${issue}`);
        });
      }
      
    } catch (error) {
      log(`Error during validation: ${error.message}`, 'red');
    }
  }

  exportToJSON(filename) {
    printHeader('📝 EXPORT DATA');
    
    try {
      const wizardData = this.db.prepare('SELECT * FROM wizard_data').all();
      
      const exportData = {};
      wizardData.forEach(row => {
        try {
          exportData[row.key] = JSON.parse(row.value);
        } catch {
          exportData[row.key] = row.value;
        }
      });
      
      const exportPath = path.join(__dirname, filename || 'database-export.json');
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
      
      log(`✅ Data exported to: ${exportPath}`, 'green');
      log(`   Size: ${(fs.statSync(exportPath).size / 1024).toFixed(2)} KB`, 'cyan');
    } catch (error) {
      log(`Error: ${error.message}`, 'red');
    }
  }

  customQuery(query) {
    printHeader('🔍 CUSTOM SQL QUERY');
    
    try {
      const isSelect = query.trim().toLowerCase().startsWith('select');
      
      if (isSelect) {
        const results = this.db.prepare(query).all();
        console.log(`\nResults: ${results.length} row(s)\n`);
        
        if (results.length > 0) {
          results.forEach((row, idx) => {
            console.log(`Row ${idx + 1}:`);
            Object.entries(row).forEach(([key, value]) => {
              console.log(`  ${key}: ${value}`);
            });
            console.log('');
          });
        }
      } else {
        const result = this.db.prepare(query).run();
        log(`✅ Query executed. Changes: ${result.changes}`, 'green');
      }
    } catch (error) {
      log(`Error: ${error.message}`, 'red');
    }
  }

  generateReport() {
    printHeader('📈 STATISTICS REPORT');
    
    try {
      const report = {};
      
      // Tables
      report.tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length;
      
      // Teachers
      const teachersRow = this.db.prepare("SELECT value FROM wizard_data WHERE key = 'teachers'").get();
      report.teachers = teachersRow ? JSON.parse(teachersRow.value).length : 0;
      
      // Subjects
      const subjectsRow = this.db.prepare("SELECT value FROM wizard_data WHERE key = 'subjects'").get();
      report.subjects = subjectsRow ? JSON.parse(subjectsRow.value).length : 0;
      
      // Classes
      const classesRow = this.db.prepare("SELECT value FROM wizard_data WHERE key = 'classes'").get();
      report.classes = classesRow ? JSON.parse(classesRow.value).length : 0;
      
      // Rooms
      const roomsRow = this.db.prepare("SELECT value FROM wizard_data WHERE key = 'rooms'").get();
      report.rooms = roomsRow ? JSON.parse(roomsRow.value).length : 0;
      
      // Calculate total lesson requests
      if (classesRow) {
        const classes = JSON.parse(classesRow.value);
        report.totalLessons = classes.reduce((sum, cls) => {
          return sum + (cls.subjectRequirements?.reduce((s, req) => s + (req.periodsPerWeek || 0), 0) || 0);
        }, 0);
      }
      
      // Display report
      console.log('Database Statistics:');
      console.log('-'.repeat(40));
      console.log(`Tables:              ${report.tables}`);
      console.log(`Teachers:            ${report.teachers}`);
      console.log(`Subjects:            ${report.subjects}`);
      console.log(`Classes:             ${report.classes}`);
      console.log(`Rooms:               ${report.rooms}`);
      console.log(`Total lesson slots:  ${report.totalLessons || 0}`);
      
      // Database file size
      const stats = fs.statSync(dbPath);
      console.log(`Database size:       ${(stats.size / 1024).toFixed(2)} KB`);
      console.log('-'.repeat(40));
      
    } catch (error) {
      log(`Error: ${error.message}`, 'red');
    }
  }
}

// Main CLI
async function main() {
  const args = process.argv.slice(2);
  const manager = new DatabaseManager();

  // If command line arguments provided, run directly
  if (args.length > 0) {
    const command = args[0];
    
    switch (command) {
      case 'tables':
        manager.showTables();
        break;
      case 'stats':
        manager.showStatistics();
        break;
      case 'teachers':
        manager.listTeachers();
        break;
      case 'subjects':
        manager.listSubjects();
        break;
      case 'classes':
        manager.listClasses();
        break;
      case 'config':
        manager.inspectWizardConfig();
        break;
      case 'validate':
        manager.validateDataIntegrity();
        break;
      case 'export':
        manager.exportToJSON(args[1]);
        break;
      case 'report':
        manager.generateReport();
        break;
      case 'query':
        manager.customQuery(args.slice(1).join(' '));
        break;
      default:
        console.log('Unknown command. Available commands:');
        console.log('  tables, stats, teachers, subjects, classes, config, validate, export, report, query');
    }
    
    manager.close();
    return;
  }

  // Interactive mode
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
  }

  let running = true;
  
  while (running) {
    printMenu();
    const choice = await ask('Enter your choice: ');
    console.log('');

    try {
      switch (choice.trim()) {
        case '1':
          manager.showTables();
          break;
        case '2':
          manager.showStatistics();
          break;
        case '3':
          const tableName = await ask('Enter table name: ');
          manager.viewTableData(tableName);
          break;
        case '4':
          const delTable = await ask('Enter table name: ');
          const confirm = await ask(`⚠️  Delete all records from ${delTable}? (yes/no): `);
          if (confirm.toLowerCase() === 'yes') {
            manager.deleteTableData(delTable);
          }
          break;
        case '5':
          manager.backupDatabase();
          break;
        case '6':
          manager.listBackups();
          break;
        case '7':
          manager.inspectWizardConfig();
          break;
        case '8':
          manager.listTeachers();
          break;
        case '9':
          manager.listSubjects();
          break;
        case '10':
          manager.listClasses();
          break;
        case '11':
          manager.showPeriodsConfig();
          break;
        case '12':
          manager.validateDataIntegrity();
          break;
        case '14':
          const exportFile = await ask('Export filename (default: database-export.json): ');
          manager.exportToJSON(exportFile || 'database-export.json');
          break;
        case '16':
          const query = await ask('Enter SQL query: ');
          manager.customQuery(query);
          break;
        case '17':
          manager.generateReport();
          break;
        case '99':
          log('⚠️  This will delete ALL data!', 'red');
          const resetConfirm = await ask('Type "DELETE ALL DATA" to confirm: ');
          if (resetConfirm === 'DELETE ALL DATA') {
            const tables = manager.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            tables.forEach(table => {
              manager.db.prepare(`DELETE FROM "${table.name}"`).run();
            });
            log('✅ All data deleted', 'green');
          } else {
            log('Reset cancelled', 'yellow');
          }
          break;
        case '0':
          running = false;
          log('Goodbye! 👋', 'cyan');
          break;
        default:
          log('Invalid choice', 'red');
      }
    } catch (error) {
      log(`Error: ${error.message}`, 'red');
    }

    if (running) {
      await ask('\nPress Enter to continue...');
    }
  }

  rl.close();
  manager.close();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = DatabaseManager;
