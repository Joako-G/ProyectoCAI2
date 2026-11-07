import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type pg from 'pg';

// src/database and dist/database are both two levels below the backend package directory. The SQL files stay
// in src, so the compiled server reads the same files and nothing has to be copied into dist.
export const migrationsDirectory = resolve(__dirname, '..', '..', 'src', 'database', 'migrations');

const MIGRATION_FILE = /^\d+_[a-z0-9_]+\.sql$/;

// Any constant works as long as every process that migrates this database uses the same one.
const MIGRATION_LOCK_ID = 7_251_001;

/** The numbered .sql files of a folder, in the order they must run. */
export async function listMigrationFiles(directory: string = migrationsDirectory): Promise<string[]> {
  const names = (await readdir(directory)).filter((name) => MIGRATION_FILE.test(name));
  return names.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10) || a.localeCompare(b));
}

/**
 * Applies the migrations not yet recorded in `schema_migrations`, each one inside its own transaction, in
 * order, and returns the names it applied. A failing file is rolled back, named in the error, and stops the run.
 * An advisory lock makes two processes starting together apply each file once.
 */
export async function runMigrations(pool: pg.Pool, directory: string = migrationsDirectory): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((row) => row.name));
    for (const name of await listMigrationFiles(directory)) {
      if (done.has(name)) continue;
      const sql = await readFile(resolve(directory, name), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw new Error(`Migration ${name} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      applied.push(name);
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}
