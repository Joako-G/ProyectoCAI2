import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { runMigrations } from '../../src/database/migrate.js';
import { createPgEntryRepository } from '../../src/modules/access/pg-entry.repository.js';
import { createTestPool, describeWithDatabase, resetDatabase } from './helpers.js';

function entry(memberId: string, checkedAt: string, overrides: Record<string, string> = {}) {
  return { memberId, result: 'green' as const, reason: 'up_to_date', method: 'dni' as const, checkedAt, checkedBy: 'user-1', ...overrides } as Parameters<ReturnType<typeof createPgEntryRepository>['append']>[0];
}

describeWithDatabase('PostgreSQL entry repository', () => {
  let pool: pg.Pool;
  let repository: ReturnType<typeof createPgEntryRepository>;

  beforeAll(async () => {
    pool = createTestPool();
    await resetDatabase(pool);
    await runMigrations(pool);
    repository = createPgEntryRepository(pool);
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM access_entries');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('stores an entry and lists it back with an id', async () => {
    await repository.append(entry('m1', '2026-11-07T14:00:00.000Z', { method: 'face', result: 'yellow', reason: 'debtor' }));
    const [found] = await repository.listByDate('2026-11-07');
    expect(found).toMatchObject({ memberId: 'm1', method: 'face', result: 'yellow', reason: 'debtor', checkedAt: '2026-11-07T14:00:00.000Z', checkedBy: 'user-1' });
    expect(found!.id).toEqual(expect.any(String));
  });

  it('has no column that could hold a DNI or a name', async () => {
    const columns = await pool.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'access_entries' ORDER BY column_name");
    expect(columns.rows.map((row) => row.column_name)).toEqual(['checked_at', 'checked_by', 'id', 'member_id', 'method', 'reason', 'result']);
  });

  it('lists the club-time-zone day only, newest first', async () => {
    // The club is UTC-3: the day runs from 03:00Z to 03:00Z the next day.
    await repository.append(entry('before', '2026-11-07T02:59:59.000Z'));
    await repository.append(entry('first', '2026-11-07T03:00:00.000Z'));
    await repository.append(entry('late', '2026-11-08T02:59:59.000Z'));
    await repository.append(entry('after', '2026-11-08T03:00:00.000Z'));
    expect((await repository.listByDate('2026-11-07')).map((row) => row.memberId)).toEqual(['late', 'first']);
  });

  it('rejects a result or method outside the allowed values', async () => {
    await expect(repository.append(entry('m1', '2026-11-07T14:00:00.000Z', { result: 'blue' }))).rejects.toThrow();
    await expect(repository.append(entry('m1', '2026-11-07T14:00:00.000Z', { method: 'qr' }))).rejects.toThrow();
  });

  it('treats a hostile member id as plain text', async () => {
    const hostile = "x'; DROP TABLE access_entries; --";
    await repository.append(entry(hostile, '2026-11-07T14:00:00.000Z'));
    expect((await repository.listByDate('2026-11-07'))[0]!.memberId).toBe(hostile);
    expect((await pool.query("SELECT to_regclass('access_entries') AS t")).rows[0].t).toBe('access_entries');
  });
});
