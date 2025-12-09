#!/usr/bin/env node
/**
 * License Key Generator for Maktab Timetable App
 * 
 * Usage:
 *   node generate-license.js                    # Generate a single key
 *   node generate-license.js --count 10         # Generate 10 keys
 *   node generate-license.js --type annual      # Generate annual license key
 *   node generate-license.js --school "مکتب نمونه"  # Pre-assign to school
 */

const crypto = require('crypto');

function generateLicenseKey() {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return `MKTB-${segments.join('-')}`;
}

function main() {
  const args = process.argv.slice(2);
  let count = 1;
  let type = '6-month';
  let school = null;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count' && args[i + 1]) {
      count = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--type' && args[i + 1]) {
      type = args[i + 1];
      i++;
    } else if (args[i] === '--school' && args[i + 1]) {
      school = args[i + 1];
      i++;
    }
  }

  console.log('\n=== Maktab License Key Generator ===\n');
  console.log(`Type: ${type}`);
  console.log(`Count: ${count}`);
  if (school) console.log(`School: ${school}`);
  console.log('\n--- Generated Keys ---\n');

  const keys = [];
  for (let i = 0; i < count; i++) {
    const key = generateLicenseKey();
    keys.push(key);
    console.log(`${i + 1}. ${key}`);
  }

  console.log('\n--- Summary ---');
  console.log(`Generated ${count} ${type} license key(s)`);
  
  // Output as JSON for easy copy
  console.log('\nJSON format:');
  console.log(JSON.stringify(keys, null, 2));

  // Calculate expiry dates
  const now = new Date();
  let expiryDate = new Date();
  
  switch (type) {
    case 'trial':
      expiryDate.setDate(now.getDate() + 14);
      break;
    case '6-month':
      expiryDate.setMonth(now.getMonth() + 6);
      break;
    case 'annual':
      expiryDate.setFullYear(now.getFullYear() + 1);
      break;
  }

  console.log(`\nIf activated today (${now.toLocaleDateString('fa-AF')})`);
  console.log(`Expires: ${expiryDate.toLocaleDateString('fa-AF')}`);
  console.log('');
}

main();
