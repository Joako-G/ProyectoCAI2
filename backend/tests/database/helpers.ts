import pg from 'pg';
import { describe } from 'vitest';

/** The database the tests may reset freely. Never point this at development data. */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim() || undefined;

/** A `describe` that runs against the test database, and is skipped with a clear name when none is configured. */
export function describeWithDatabase(name: string, body: () => void): void {
  if (testDatabaseUrl) describe(name, body);
  else describe.skip(`${name} (skipped: TEST_DATABASE_URL is not set, see docs/database.md)`, body);
}

/** Empties the test database completely, so each test file starts from nothing. */
export async function resetDatabase(pool: pg.Pool): Promise<void> {
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');
}

export function createTestPool(): pg.Pool {
  return new pg.Pool({ connectionString: testDatabaseUrl, max: 4 });
}
