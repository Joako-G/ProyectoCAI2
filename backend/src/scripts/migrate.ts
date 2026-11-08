import { databaseUrl } from '../config/database.js';
import { runMigrations } from '../database/migrate.js';
import { createPool } from '../database/pool.js';

async function main() {
  const url = databaseUrl();
  if (!url) throw new Error('DATABASE_URL is not set. See docs/database.md.');
  const pool = createPool(url, { statementTimeoutMs: 120_000 });
  try {
    const applied = await runMigrations(pool);
    console.log(applied.length === 0 ? 'Database is up to date.' : `Applied ${applied.length} migration(s): ${applied.join(', ')}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
