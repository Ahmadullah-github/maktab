/**
 * Database Reset Script
 * WARNING: This will DELETE ALL DATA from the database!
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const dbPath = path.join(__dirname, 'timetable.db');

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function resetDatabase() {
  console.log('\n' + '='.repeat(60));
  console.log('⚠️  DATABASE RESET SCRIPT');
  console.log('='.repeat(60));
  console.log('\nDatabase:', dbPath);
  console.log('\n⚠️  WARNING: This will DELETE ALL DATA from your database!');
  console.log('This includes:');
  console.log('  • All wizard configuration data');
  console.log('  • All teachers, subjects, classes');
  console.log('  • All timetable data');
  console.log('  • ALL tables and records\n');

  const confirmed = await askConfirmation('Are you ABSOLUTELY SURE? Type "yes" to continue: ');
  
  if (!confirmed) {
    console.log('\n✅ Reset cancelled. Database is safe.');
    rl.close();
    return;
  }

  const doubleCheck = await askConfirmation('\n⚠️  Last chance! Type "yes" again to confirm: ');
  
  if (!doubleCheck) {
    console.log('\n✅ Reset cancelled. Database is safe.');
    rl.close();
    return;
  }

  console.log('\n🔥 Starting database reset...\n');

  try {
    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      console.log('✅ Database file does not exist. Nothing to reset.');
      rl.close();
      return;
    }

    // Create backup first
    const backupPath = dbPath.replace('.db', `.backup.${Date.now()}.db`);
    console.log(`📦 Creating backup: ${path.basename(backupPath)}`);
    fs.copyFileSync(dbPath, backupPath);
    console.log('✅ Backup created\n');

    // Open database
    const db = new Database(dbPath);

    // Get all tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`Found ${tables.length} tables:\n`);
    
    tables.forEach(table => {
      console.log(`  📋 ${table.name}`);
    });

    console.log('\n🗑️  Deleting all data...\n');

    // Delete data from all tables
    let deletedCount = 0;
    tables.forEach(table => {
      try {
        const tableName = table.name;
        
        // Get count before deletion
        const countResult = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get();
        const count = countResult.count;
        
        if (count > 0) {
          db.prepare(`DELETE FROM "${tableName}"`).run();
          console.log(`  ✓ Deleted ${count} record(s) from ${tableName}`);
          deletedCount += count;
        } else {
          console.log(`  - ${tableName} was already empty`);
        }
      } catch (error) {
        console.log(`  ✗ Error deleting from ${table.name}: ${error.message}`);
      }
    });

    // Vacuum to reclaim space
    console.log('\n🧹 Cleaning up database...');
    db.prepare('VACUUM').run();

    db.close();

    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE RESET COMPLETE!');
    console.log('='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`  • Tables found: ${tables.length}`);
    console.log(`  • Records deleted: ${deletedCount}`);
    console.log(`  • Backup saved: ${path.basename(backupPath)}`);
    console.log('\n💡 The database structure is intact, but all data has been removed.');
    console.log('💡 You can now start fresh with the wizard.\n');

  } catch (error) {
    console.error('\n❌ Error during reset:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the reset
resetDatabase();
