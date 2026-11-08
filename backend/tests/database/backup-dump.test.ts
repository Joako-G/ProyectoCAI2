import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { COMPOSE_FILE } from '../../src/config/paths.js';
import { createPgDumper } from '../../src/modules/backup/backup.dump.js';
import { createTestPool, describeWithDatabase, resetDatabase, testDatabaseUrl } from './helpers.js';

// Dumps the TEST database for real. It is skipped when no dump command can run on this computer
// (no PG_DUMP_COMMAND, no Docker `db` service, no pg_dump on the PATH).
describeWithDatabase('backup dump against a real PostgreSQL', () => {
  let pool: pg.Pool;
  let folder: string;

  beforeAll(async () => {
    pool = createTestPool();
    await resetDatabase(pool);
    await pool.query('CREATE TABLE backup_dump_marker (id integer PRIMARY KEY, note text)');
    await pool.query("INSERT INTO backup_dump_marker VALUES (1, 'synthetic row')");
    folder = await mkdtemp(join(tmpdir(), 'dump-real-'));
  });

  afterAll(async () => {
    await pool.end();
    await rm(folder, { recursive: true, force: true });
  });

  it('writes a custom-format dump of the database, with its size', async (context) => {
    const dumper = createPgDumper({ connectionString: testDatabaseUrl!, composeFile: COMPOSE_FILE });
    const target = join(folder, 'database.dump.tmp');
    const outcome = await dumper.dump(target).catch((error: unknown) => error as { code?: string });
    if ('code' in outcome && outcome.code === 'DATABASE_DUMP_UNAVAILABLE') context.skip();

    expect(outcome).toMatchObject({ bytes: expect.any(Number) });
    const bytes = await readFile(target);
    expect(bytes.length).toBe((outcome as { bytes: number }).bytes);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('PGDMP');
    // The table of contents of a custom-format dump is stored as plain text.
    expect(bytes.toString('latin1')).toContain('backup_dump_marker');
  });
});
