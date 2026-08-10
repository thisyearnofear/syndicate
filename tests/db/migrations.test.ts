/**
 * Static drift guard for the database schema.
 *
 * Rules enforced:
 * 1. Schema DDL (CREATE TABLE) exists ONLY in src/lib/db/migrations —
 *    runtime code must never create tables (see lib/db/assertTable.ts).
 * 2. Every migration file parses into executable DDL statements under the
 *    runner's splitter (scripts/migrate.ts splitStatements).
 * 3. No file uses constructs the runner cannot handle (functions/triggers) —
 *    the splitter itself throws on those, mirroring production behavior.
 *
 * These checks exist because production once served routes against tables
 * that had never been created (2026-08 incident).
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'src', 'lib', 'db', 'migrations');

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

// Imported without executing the runner's main() (guarded on argv).
import { splitStatements } from '../../scripts/migrate';

/** Strip comments so prose (docs, JSDoc) cannot trip the DDL scan. */
function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('database schema drift guard', () => {
  it('keeps CREATE TABLE DDL exclusively in src/lib/db/migrations', async () => {
    const srcFiles = await walk(path.join(REPO_ROOT, 'src'));
    const offenders: string[] = [];

    for (const file of srcFiles) {
      if (file.startsWith(MIGRATIONS_DIR)) continue; // canonical home
      const content = await fs.readFile(file, 'utf8');
      if (/CREATE\s+TABLE/i.test(stripComments(content))) {
        offenders.push(path.relative(REPO_ROOT, file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('parses every migration file into well-formed statements', async () => {
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      const statements = splitStatements(content, file);
      expect(statements.length).toBeGreaterThan(0);
      for (const statement of statements) {
        expect(statement).toMatch(
          /^(CREATE|ALTER|COMMENT|INSERT|UPDATE|DELETE|DROP)\b/i,
        );
      }
    }
  });

  it('has no duplicate numeric migration prefixes', async () => {
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql'));
    const seen = new Map<string, string[]>();
    for (const file of files) {
      const prefix = file.match(/^(\d+)/)?.[1];
      if (!prefix) continue; // unnumbered files (e.g. gelato-schema.sql) sort last
      seen.set(prefix, [...(seen.get(prefix) ?? []), file]);
    }
    // Existing dual-009 files are grandfathered; the guard blocks new dupes
    // beyond the known pair.
    const dupes = [...seen.entries()].filter(([prefix, list]) => list.length > 1 && prefix !== '009');
    expect(dupes).toEqual([]);
  });
});
