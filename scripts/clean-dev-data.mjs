import fs from 'fs';
import path from 'path';

/**
 * Pre-Deployment Data Clean Script
 * Removes local development dummy data, test snapshots, and local test database.
 */

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_DIR = path.join(DATA_DIR, 'inno_cost');

console.log('🧹 [Clean] Preparing clean state for deployment...');

// 1. Remove backup test snapshots
if (fs.existsSync(BACKUPS_DIR)) {
  const backups = fs.readdirSync(BACKUPS_DIR);
  for (const b of backups) {
    fs.unlinkSync(path.join(BACKUPS_DIR, b));
  }
  console.log(`✓ Removed ${backups.length} test backup snapshots from data/backups/`);
}

// 2. Remove legacy json files if any exist
const legacyDb = path.join(DATA_DIR, 'database.json');
if (fs.existsSync(legacyDb)) {
  fs.unlinkSync(legacyDb);
  console.log('✓ Removed legacy database.json');
}

const legacySec = path.join(DATA_DIR, 'security.json');
if (fs.existsSync(legacySec)) {
  fs.unlinkSync(legacySec);
  console.log('✓ Removed legacy security.json');
}

console.log('\n✅ Deployment cleanup complete.');
console.log('Paths cleaned:');
console.log(' - data/backups/');
console.log('\nTo also wipe local test database records before deploying:');
console.log('   rm -rf data/inno_cost');
console.log('On next start, a clean PostgreSQL database will automatically initialize with 0 dummy projects or items.\n');
