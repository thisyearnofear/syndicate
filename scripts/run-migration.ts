/**
 * DATABASE MIGRATION RUNNER
 * 
 * Runs SQL migration files against the database
 * Usage: pnpm tsx scripts/run-migration.ts <migration-file>
 */

import { sql } from '@vercel/postgres';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration(migrationFile: string) {
  try {
    console.log(`Running migration: ${migrationFile}`);
    
    const migrationPath = path.join(process.cwd(), migrationFile);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolons to run each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    for (const [index, statement] of statements.entries()) {
      console.log(`Executing statement ${index + 1}...`);
      await sql.query(statement);
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Get migration file from command line
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: pnpm tsx scripts/run-migration.ts <migration-file>');
  process.exit(1);
}

runMigration(migrationFile);