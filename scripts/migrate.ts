/**
 * Migration runner — single source of truth for database schema.
 *
 * Applies src/lib/db/migrations/*.sql in filename order, recording each
 * applied file in a `schema_migrations` ledger so nothing runs twice.
 * All migrations must be idempotent (CREATE TABLE IF NOT EXISTS /
 * ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
 *
 * Usage:
 *   pnpm db:migrate   # apply pending migrations (requires POSTGRES_URL)
 *   pnpm db:status    # list pending migrations, exit 1 if any (deploy gate)
 *
 * Runtime code must NEVER create schema (see src/lib/db/assertTable.ts).
 * This runner exists because production once served routes against tables
 * that had never been created (2026-08 incident).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from '@vercel/postgres';

const MIGRATIONS_DIR = join(__dirname, '..', 'src', 'lib', 'db', 'migrations');

async function ensureLedger(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

/**
 * Split a migration file into executable statements. The repo's migration
 * files are simple DDL with no functions/triggers/$$-quoted bodies, so
 * semicolons only ever appear at statement ends (enforced by review of
 * every file; guard against future violations below).
 */
export function splitStatements(fileContent: string, filename: string): string[] {
  if (/\$\$|CREATE (OR REPLACE )?FUNCTION|CREATE TRIGGER/i.test(fileContent)) {
    throw new Error(
      `${filename}: contains functions/triggers — extend splitStatements() to handle $$-quoted bodies before using this runner.`,
    );
  }

  return fileContent
    .split(/;(?=\s*(?:\n|$))/)
    .map((s) => s.trim())
    .map((s) =>
      s
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((s) => s.length > 0);
}

async function appliedSet(): Promise<Set<string>> {
  const result = await sql`SELECT filename FROM schema_migrations`;
  return new Set(result.rows.map((r) => r.filename as string));
}

async function applyFile(filename: string): Promise<number> {
  const content = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8');
  const statements = splitStatements(content, filename);

  // Neon HTTP driver discourages multi-statement transactions, but each
  // migration file's statements must land together; statement-level
  // auto-commit is acceptable because every statement is idempotent and
  // the ledger marks success only after all of them pass.
  for (const statement of statements) {
    await sql.query(statement);
  }

  await sql`
    INSERT INTO schema_migrations (filename) VALUES (${filename})
    ON CONFLICT (filename) DO NOTHING
  `;

  return statements.length;
}

async function main() {
  const statusOnly = process.argv.includes('--status');

  if (!process.env.POSTGRES_URL) {
    console.error('Error: POSTGRES_URL is not set (expected in .env.local).');
    process.exit(1);
  }

  await ensureLedger();

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/^(\d+)/)?.[1] ?? '9999', 10);
      const numB = parseInt(b.match(/^(\d+)/)?.[1] ?? '9999', 10);
      return numA === numB ? a.localeCompare(b) : numA - numB;
    });

  const applied = await appliedSet();
  const pending = files.filter((f) => !applied.has(f));

  if (statusOnly) {
    console.log(`Migrations: ${applied.size} applied, ${pending.length} pending.`);
    if (pending.length > 0) {
      console.log('Pending:');
      pending.forEach((f) => console.log(`  - ${f}`));
      console.log('\nRun `pnpm db:migrate` before deploying.');
      process.exit(1);
    }
    console.log('Database schema is up to date.');
    return;
  }

  if (pending.length === 0) {
    console.log('No pending migrations. Database schema is up to date.');
    return;
  }

  console.log(`Applying ${pending.length} migration(s)...`);
  for (const file of pending) {
    const count = await applyFile(file);
    console.log(`  ✔ ${file} (${count} statement(s))`);
  }
  console.log('Migration run complete.');
}

// Only run when invoked directly (tests import splitStatements).
if (process.argv[1]?.endsWith('migrate.ts')) {
  main().catch((err) => {
    console.error('Migration runner failed:', err);
    process.exit(1);
  });
}
