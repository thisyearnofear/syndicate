/**
 * Fail-fast schema presence check.
 *
 * Runtime code must NEVER create tables: schema lives exclusively in
 * src/lib/db/migrations and is applied via `pnpm db:migrate`
 * (scripts/migrate.ts). If a table is missing, the correct response is a
 * loud error pointing at the runner — not silently creating a parallel,
 * untracked version of reality (which is what made 2026-08's production
 * incident possible: canonical tables absent while code expected them).
 *
 * Results are cached per process: a table does not disappear mid-process.
 */

import { sql } from '@vercel/postgres';

const verified = new Set<string>();

export async function assertTableExists(table: string): Promise<void> {
  if (verified.has(table)) return;

  const result = await sql`
    SELECT 1 AS one
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${table}
    LIMIT 1
  `;

  if (result.rows.length === 0) {
    throw new Error(
      `Database table "${table}" is missing. Run \`pnpm db:migrate\` to apply ` +
        `the canonical migrations in src/lib/db/migrations before serving traffic.`,
    );
  }

  verified.add(table);
}
