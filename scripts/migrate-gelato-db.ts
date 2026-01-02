/**
 * GELATO DATABASE MIGRATION SCRIPT
 * 
 * Runs the Gelato schema migration against Neon/Vercel Postgres
 * 
 * Usage:
 *   npm run migrate:gelato
 * 
 * Environment:
 *   Requires POSTGRES_URL or DATABASE_URL in .env.local
 */

import { config } from 'dotenv';
import { sql } from '@vercel/postgres';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
config({ path: path.join(process.cwd(), '.env.local') });

async function runMigration() {
  console.log('🔄 Starting Gelato database migration...\n');

  try {
    // Read migration file
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/gelato-schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📝 Running schema creation...');

    // Execute migration
    await sql.query(migrationSQL);

    console.log('\n✅ Migration completed successfully!\n');
    console.log('✓ Created gelato_tasks table');
    console.log('✓ Created gelato_executions table');
    console.log('✓ Added indexes for performance\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Check for env var before running
const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URLCONNECTION_STRING;
if (!dbUrl) {
  console.error('❌ Database connection string not found in environment variables');
  console.error('   Add one of these to .env.local:');
  console.error('   - POSTGRES_URL (Neon/Vercel Postgres pooled)');
  console.error('   - DATABASE_URL (Neon default)');
  console.error('   - POSTGRES_URLCONNECTION_STRING (Vercel Postgres)\n');
  process.exit(1);
}

runMigration();
