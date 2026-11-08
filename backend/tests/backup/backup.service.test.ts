import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DumpError, type DatabaseDumper } from '../../src/modules/backup/backup.dump.js';
import { createBackupService } from '../../src/modules/backup/backup.service.js';
import { ConflictError } from '../../src/shared/errors.js';
import type { AuditRecordInput } from '../../src/modules/audit/audit.types.js';

// Everything runs inside one temporary directory: the real data and backup folders are never touched.
let root: string;
let clock: Date;
let audited: AuditRecordInput[];

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'backup-'));
  // A configured destination must already exist (the drive is plugged in); the tests about a missing one remove it.
  await mkdir(join(root, 'copies'));
  clock = new Date('2026-11-04T15:00:00Z');
  audited = [];
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

const destination = () => join(root, 'copies');
const dataFile = (name: string) => join(root, 'data', name);

async function writeData(name: string, content: string) {
  await mkdir(join(root, 'data'), { recursive: true });
  await writeFile(dataFile(name), content);
}

function createService(overrides: { keep?: number; keepRecent?: number; isDefaultDestination?: boolean; database?: DatabaseDumper } = {}) {
  return createBackupService({
    sources: [
      { name: 'members.json', path: dataFile('members.json') },
      { name: 'payments.json', path: dataFile('payments.json') },
      { name: 'cashcounts.json', path: dataFile('cashcounts.json') },
    ],
    destination: destination(),
    isDefaultDestination: overrides.isDefaultDestination ?? false,
    keep: overrides.keep,
    keepRecent: overrides.keepRecent,
    database: overrides.database,
    audit: { record: async (input) => { audited.push(input); } },
    now: () => clock,
  });
}

const copiesOf = async () => (await readdir(destination())).sort();

describe('backup service: a copy', () => {
  it('copies every data file that exists into a dated folder and lists them, skipping a file not created yet', async () => {
    await writeData('members.json', '[{"id":"m1"}]');
    await writeData('payments.json', '[]');

    const outcome = await createService().run();

    expect(outcome).toEqual({
      ok: true,
      backup: { name: 'backup-20261104T150000Z', at: '2026-11-04T15:00:00.000Z', files: ['members.json', 'payments.json'], database: { state: 'not_configured' }, partial: false },
    });
    expect(await copiesOf()).toEqual(['backup-20261104T150000Z']);
    const folder = join(destination(), 'backup-20261104T150000Z');
    expect(await readFile(join(folder, 'members.json'), 'utf8')).toBe('[{"id":"m1"}]');
    expect(JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8'))).toEqual({
      createdAt: '2026-11-04T15:00:00.000Z',
      files: ['members.json', 'payments.json'],
      database: { state: 'not_configured' },
    });
    expect(await readdir(folder)).not.toContain('database.dump');
  });

  it('fails without leaving a folder when there is nothing to copy', async () => {
    const outcome = await createService().run();

    expect(outcome).toEqual({ ok: false, failure: { at: '2026-11-04T15:00:00.000Z', code: 'NO_FILES' } });
    expect(await copiesOf()).toEqual([]);
  });

  it('keeps the older copies, leaves no half-written folder and reports the failure when a copy fails', async () => {
    await writeData('members.json', '[]');
    const service = createService();
    expect((await service.run()).ok).toBe(true);

    clock = new Date('2026-11-05T15:00:00Z');
    // A directory where a file should be makes the copy fail halfway, after the first file went across.
    await mkdir(dataFile('payments.json'), { recursive: true });
    const outcome = await service.run('user-head');

    expect(outcome.ok).toBe(false);
    expect(outcome).toMatchObject({ failure: { at: '2026-11-05T15:00:00.000Z' } });
    expect(await copiesOf()).toEqual(['backup-20261104T150000Z']);
    const status = await service.status();
    expect(status.lastSuccessAt).toBe('2026-11-04T15:00:00.000Z');
    expect(status.lastFailure).toMatchObject({ at: '2026-11-05T15:00:00.000Z' });
    expect(audited).toEqual([]);
  });

  it('clears the reported failure after the next good copy', async () => {
    const service = createService();
    await service.run();
    expect((await service.status()).lastFailure).not.toBeNull();

    await writeData('members.json', '[]');
    clock = new Date('2026-11-05T15:00:00Z');
    await service.run();

    expect((await service.status()).lastFailure).toBeNull();
  });

  it('does not count a half-written folder left by a crash, and removes it on the next run', async () => {
    await writeData('members.json', '[]');
    await mkdir(join(destination(), '.partial-backup-20261103T150000Z'), { recursive: true });
    const service = createService();

    expect((await service.status()).copies).toBe(0);
    await service.run();

    expect(await copiesOf()).toEqual(['backup-20261104T150000Z']);
  });

  it('refuses a second copy while one is running and a second one in the same second', async () => {
    await writeData('members.json', '[]');
    const service = createService();

    const first = service.run();
    await expect(service.run()).rejects.toBeInstanceOf(ConflictError);
    expect((await first).ok).toBe(true);
    await expect(service.run()).rejects.toBeInstanceOf(ConflictError);
    expect(await copiesOf()).toEqual(['backup-20261104T150000Z']);
  });

  it('records one audit entry naming the copy for a copy someone asked for, and none for an automatic one', async () => {
    await writeData('members.json', '[]');
    const service = createService();

    await service.run();
    expect(audited).toEqual([]);

    clock = new Date('2026-11-05T15:00:00Z');
    await service.run('user-head');
    expect(audited).toEqual([{ actorId: 'user-head', action: 'create', entityType: 'backup', entityId: 'backup-20261105T150000Z' }]);
  });
});

// Makes a copy at each given instant, oldest first.
async function copyAt(service: ReturnType<typeof createService>, ...instants: string[]) {
  for (const instant of instants) {
    clock = new Date(instant);
    expect((await service.run()).ok).toBe(true);
  }
}

describe('backup service: retention', () => {
  it('keeps the newest copy of each of the most recent days and never touches anything it did not create', async () => {
    await writeData('members.json', '[]');
    await mkdir(join(destination(), 'vacaciones'), { recursive: true });
    await writeFile(join(destination(), 'notas.txt'), 'not a copy');
    const service = createService({ keep: 3, keepRecent: 1 });

    await copyAt(service, '2026-11-01T15:00:00Z', '2026-11-02T15:00:00Z', '2026-11-03T15:00:00Z', '2026-11-04T15:00:00Z', '2026-11-05T15:00:00Z');

    expect(await copiesOf()).toEqual(['backup-20261103T150000Z', 'backup-20261104T150000Z', 'backup-20261105T150000Z', 'notas.txt', 'vacaciones']);
    expect((await service.status()).copies).toBe(3);
  });

  it('does not let many copies in one day push out the older days', async () => {
    await writeData('members.json', '[]');
    const service = createService({ keep: 3, keepRecent: 2 });

    await copyAt(
      service,
      '2026-11-01T15:00:00Z',
      '2026-11-02T15:00:00Z',
      '2026-11-03T15:00:00Z',
      '2026-11-04T15:00:00Z',
      '2026-11-05T16:00:00Z',
      '2026-11-05T17:00:00Z',
      '2026-11-05T18:00:00Z',
      '2026-11-05T19:00:00Z',
      '2026-11-05T20:00:00Z',
    );

    // Days 5, 4 and 3 keep their newest copy; the two newest copies are kept whatever the day.
    expect(await copiesOf()).toEqual(['backup-20261103T150000Z', 'backup-20261104T150000Z', 'backup-20261105T190000Z', 'backup-20261105T200000Z']);
  });

  it('always keeps the most recent copies, even when they share a day', async () => {
    await writeData('members.json', '[]');
    const service = createService({ keep: 1, keepRecent: 3 });

    await copyAt(service, '2026-11-03T15:00:00Z', '2026-11-04T13:00:00Z', '2026-11-04T14:00:00Z', '2026-11-04T15:00:00Z');

    expect(await copiesOf()).toEqual(['backup-20261104T130000Z', 'backup-20261104T140000Z', 'backup-20261104T150000Z']);
  });

  it('counts days in the club time zone, not in UTC', async () => {
    await writeData('members.json', '[]');
    const service = createService({ keep: 2, keepRecent: 1 });

    // 01:00 UTC is still the evening of 3 November in Tucumán, so these are two club days although one UTC day.
    await copyAt(service, '2026-11-04T01:00:00Z', '2026-11-04T10:00:00Z');

    expect(await copiesOf()).toEqual(['backup-20261104T010000Z', 'backup-20261104T100000Z']);
  });

  it('never deletes the copy it just made, even when newer copies already exist', async () => {
    await writeData('members.json', '[]');
    await mkdir(join(destination(), 'backup-20261110T150000Z'));
    const service = createService({ keep: 1, keepRecent: 1 });

    await copyAt(service, '2026-11-04T15:00:00Z');

    expect(await copiesOf()).toEqual(['backup-20261104T150000Z', 'backup-20261110T150000Z']);
  });

  it('leaves a folder with an impossible date alone: not counted, never deleted, and it breaks nothing', async () => {
    await writeData('members.json', '[]');
    // Month 13 and 31 February look like copies by name but are not real instants.
    await mkdir(join(destination(), 'backup-20261340T150000Z'));
    await mkdir(join(destination(), 'backup-20260231T150000Z'));
    const service = createService({ keep: 1, keepRecent: 1 });

    expect(await service.status()).toMatchObject({ copies: 0, lastSuccessAt: null });
    await copyAt(service, '2026-11-04T15:00:00Z', '2026-11-05T15:00:00Z');

    expect(await copiesOf()).toEqual(['backup-20260231T150000Z', 'backup-20261105T150000Z', 'backup-20261340T150000Z']);
    expect(await service.status()).toMatchObject({ copies: 1, lastSuccessAt: '2026-11-05T15:00:00.000Z' });
  });

  it('keeps 30 days and the 5 most recent copies unless told otherwise', async () => {
    expect(await createService().status()).toMatchObject({ keep: 30, keepRecent: 5 });
  });
});

describe('backup service: status', () => {
  it('reads the last good copy from the folders, so it survives a restart', async () => {
    await writeData('members.json', '[]');
    await createService().run();

    const afterRestart = await createService().status();

    expect(afterRestart).toEqual({
      destination: { isDefault: false, state: 'ready' },
      keep: 30,
      keepRecent: 5,
      copies: 1,
      lastSuccessAt: '2026-11-04T15:00:00.000Z',
      lastGoodAt: '2026-11-04T15:00:00.000Z',
      lastFailure: null,
      running: false,
      database: { lastCopy: { state: 'not_configured' }, lastFailure: null },
    });
  });

  it('says whether the destination is the default folder and has nothing yet when it does not exist', async () => {
    await rm(destination(), { recursive: true });

    expect(await createService({ isDefaultDestination: true }).status()).toMatchObject({
      destination: { isDefault: true, state: 'ready' },
      copies: 0,
      lastSuccessAt: null,
    });
  });

  it('never exposes a path, in a success or a failure', async () => {
    await writeData('members.json', '[]');
    const service = createService();
    await service.run();
    clock = new Date('2026-11-05T15:00:00Z');
    await mkdir(dataFile('payments.json'), { recursive: true });
    const failed = await service.run();

    const everything = JSON.stringify([await service.status(), failed]);
    expect(everything).not.toContain(root);
    expect(everything).not.toContain(destination());
  });
});

describe('backup service: a destination that is not there', () => {
  it('does not create a configured destination, fails with DESTINATION_MISSING and reports it as missing', async () => {
    await writeData('members.json', '[]');
    await rm(destination(), { recursive: true });
    const service = createService();

    const outcome = await service.run('user-head');

    expect(outcome).toEqual({ ok: false, failure: { at: '2026-11-04T15:00:00.000Z', code: 'DESTINATION_MISSING' } });
    await expect(stat(destination())).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await service.status()).toMatchObject({
      destination: { isDefault: false, state: 'missing' },
      copies: 0,
      lastSuccessAt: null,
      lastFailure: { code: 'DESTINATION_MISSING' },
    });
    expect(audited).toEqual([]);
    expect(JSON.stringify(await service.status())).not.toContain(root);
  });

  it('keeps the older copies when the drive goes missing and makes one again once it is back', async () => {
    await writeData('members.json', '[]');
    const service = createService();
    await service.run();
    const held = join(root, 'held');
    await rename(destination(), held);

    clock = new Date('2026-11-05T15:00:00Z');
    expect((await service.run()).ok).toBe(false);
    await rename(held, destination());
    expect(await copiesOf()).toEqual(['backup-20261104T150000Z']);

    clock = new Date('2026-11-06T15:00:00Z');
    expect((await service.run()).ok).toBe(true);
    expect(await copiesOf()).toEqual(['backup-20261104T150000Z', 'backup-20261106T150000Z']);
    expect((await service.status()).lastFailure).toBeNull();
  });

  it('creates the default destination on the first copy', async () => {
    await writeData('members.json', '[]');
    await rm(destination(), { recursive: true });

    const outcome = await createService({ isDefaultDestination: true }).run();

    expect(outcome.ok).toBe(true);
    expect(await copiesOf()).toEqual(['backup-20261104T150000Z']);
  });

  it('reports a destination that cannot be read as unreadable, not as having no copies, and does not touch it', async () => {
    await writeData('members.json', '[]');
    await rm(destination(), { recursive: true });
    await writeFile(destination(), 'a file where the folder should be');
    const service = createService();

    expect(await service.status()).toMatchObject({ destination: { state: 'unreadable' }, copies: 0, lastSuccessAt: null });
    const outcome = await service.run();

    expect(outcome.ok).toBe(false);
    expect(outcome).not.toMatchObject({ failure: { code: 'DESTINATION_MISSING' } });
    expect(await readFile(destination(), 'utf8')).toBe('a file where the folder should be');
  });
});

// A fake dumper: writes what it is told to the file the service gives it, or fails.
const goodDumper = (content = 'PGDMP fake'): DatabaseDumper => ({
  dump: async (target) => {
    await writeFile(target, content);
    return { bytes: Buffer.byteLength(content) };
  },
});
const failingDumper = (error: unknown, partial?: string): DatabaseDumper => ({
  dump: async (target) => {
    if (partial) await writeFile(target, partial);
    throw error;
  },
});

describe('backup service: the database dump', () => {
  it('saves database.dump inside the same dated folder, lists it in the manifest and returns it in the copy', async () => {
    await writeData('members.json', '[]');

    const outcome = await createService({ database: goodDumper('PGDMP fake') }).run();

    const database = { state: 'included', file: 'database.dump', format: 'pg_dump-custom', bytes: 10 };
    expect(outcome).toEqual({ ok: true, backup: { name: 'backup-20261104T150000Z', at: '2026-11-04T15:00:00.000Z', files: ['members.json'], database, partial: false } });
    const folder = join(destination(), 'backup-20261104T150000Z');
    expect((await readdir(folder)).sort()).toEqual(['database.dump', 'manifest.json', 'members.json']);
    expect(await readFile(join(folder, 'database.dump'), 'utf8')).toBe('PGDMP fake');
    expect(JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8')).database).toEqual(database);
  });

  it('reports the database part of the last good copy in the status, read from the folders so it survives a restart', async () => {
    await writeData('members.json', '[]');
    await createService({ database: goodDumper() }).run();

    const status = await createService({ database: goodDumper() }).status();

    expect(status.database).toEqual({ lastCopy: { state: 'included', file: 'database.dump', format: 'pg_dump-custom', bytes: 10 }, lastFailure: null });
  });

  it('has no database part to report while there is no copy', async () => {
    expect((await createService({ database: goodDumper() }).status()).database).toEqual({ lastCopy: null, lastFailure: null });
  });

  it('finishes the JSON copy and marks the run partial when the dump fails, without leaving any dump file', async () => {
    await writeData('members.json', '[{"id":"m1"}]');
    const dumper = failingDumper(new DumpError('DATABASE_DUMP_FAILED', 'exit code 1'), 'PGDMP half');
    const service = createService({ database: dumper });

    const outcome = await service.run('user-head');

    expect(outcome).toEqual({
      ok: true,
      backup: { name: 'backup-20261104T150000Z', at: '2026-11-04T15:00:00.000Z', files: ['members.json'], database: { state: 'failed', code: 'DATABASE_DUMP_FAILED' }, partial: true },
    });
    const folder = join(destination(), 'backup-20261104T150000Z');
    expect((await readdir(folder)).sort()).toEqual(['manifest.json', 'members.json']);
    expect(JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8')).database).toEqual({ state: 'failed', code: 'DATABASE_DUMP_FAILED' });
    expect(await copiesOf()).toEqual(['backup-20261104T150000Z']);
    expect(audited).toEqual([{ actorId: 'user-head', action: 'create', entityType: 'backup', entityId: 'backup-20261104T150000Z' }]);
  });

  it('uses a distinct code when no dump command can run, and DATABASE_DUMP_FAILED for any other error', async () => {
    await writeData('members.json', '[]');

    const unavailable = await createService({ database: failingDumper(new DumpError('DATABASE_DUMP_UNAVAILABLE')) }).run();
    expect(unavailable).toMatchObject({ ok: true, backup: { partial: true, database: { state: 'failed', code: 'DATABASE_DUMP_UNAVAILABLE' } } });

    clock = new Date('2026-11-05T15:00:00Z');
    const unexpected = await createService({ database: failingDumper(new Error('anything')) }).run();
    expect(unexpected).toMatchObject({ ok: true, backup: { partial: true, database: { state: 'failed', code: 'DATABASE_DUMP_FAILED' } } });
  });

  it('keeps the older copies and their dumps when a later dump fails, and reports it as the newest copy but not as the last good one', async () => {
    await writeData('members.json', '[]');
    await createService({ database: goodDumper() }).run();

    clock = new Date('2026-11-05T15:00:00Z');
    const service = createService({ database: failingDumper(new DumpError('DATABASE_DUMP_FAILED')) });
    await service.run();

    expect(await copiesOf()).toEqual(['backup-20261104T150000Z', 'backup-20261105T150000Z']);
    expect(await readFile(join(destination(), 'backup-20261104T150000Z', 'database.dump'), 'utf8')).toBe('PGDMP fake');
    const status = await service.status();
    expect(status.copies).toBe(2);
    expect(status.lastSuccessAt).toBe('2026-11-05T15:00:00.000Z');
    expect(status.lastGoodAt).toBe('2026-11-04T15:00:00.000Z');
    expect(status.lastFailure).toBeNull();
    expect(status.database).toEqual({
      lastCopy: { state: 'failed', code: 'DATABASE_DUMP_FAILED' },
      lastFailure: { at: '2026-11-05T15:00:00.000Z', code: 'DATABASE_DUMP_FAILED' },
    });
  });

  it('clears the reported dump failure after the next good dump', async () => {
    await writeData('members.json', '[]');
    let working = false;
    const flaky: DatabaseDumper = { dump: (target) => (working ? goodDumper().dump(target) : Promise.reject(new DumpError('DATABASE_DUMP_FAILED'))) };
    const service = createService({ database: flaky });
    await service.run();
    expect((await service.status()).database.lastFailure).not.toBeNull();

    working = true;
    clock = new Date('2026-11-05T15:00:00Z');
    await service.run();

    expect((await service.status()).database).toMatchObject({ lastCopy: { state: 'included' }, lastFailure: null });
  });

  it('still fails with NO_FILES and leaves no folder when there are no data files, even if the dump would work', async () => {
    const outcome = await createService({ database: goodDumper() }).run();

    expect(outcome).toMatchObject({ ok: false, failure: { code: 'NO_FILES' } });
    expect(await copiesOf()).toEqual([]);
  });

  it('never exposes a path, a password or dump text in a log, the status or a copy', async () => {
    await writeData('members.json', '[]');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = createService({ database: failingDumper(new DumpError('DATABASE_DUMP_FAILED', 'password authentication failed')) });

    const outcome = await service.run();

    const everything = JSON.stringify([outcome, await service.status(), errors.mock.calls]);
    expect(everything).not.toContain(root);
    expect(everything).not.toMatch(/postgres:\/\/|PGPASSWORD/);
    // The sanitized stderr tail may reach the server log, but nothing else of the child's output does.
    expect(JSON.stringify([outcome, await service.status()])).not.toContain('password authentication');
  });
});

// Dumps work or fail in the given order, one answer per copy.
const scripted = (...works: boolean[]): DatabaseDumper => {
  const queue = [...works];
  return { dump: (target) => (queue.shift() ? goodDumper().dump(target) : Promise.reject(new DumpError('DATABASE_DUMP_FAILED'))) };
};

describe('backup service: a failed dump and the last good copy', () => {
  it('reports the newest copy with a good database part as the last good one, and the newest copy separately', async () => {
    await writeData('members.json', '[]');
    const service = createService({ database: scripted(true, false) });
    await copyAt(service, '2026-11-04T15:00:00Z', '2026-11-05T15:00:00Z');

    expect(await service.status()).toMatchObject({ lastSuccessAt: '2026-11-05T15:00:00.000Z', lastGoodAt: '2026-11-04T15:00:00.000Z', database: { lastCopy: { state: 'failed' } } });
  });

  it('has no last good copy when every copy lacks its dump, and counts a copy without a database as good', async () => {
    await writeData('members.json', '[]');
    const failing = createService({ database: scripted(false) });
    await copyAt(failing, '2026-11-04T15:00:00Z');
    expect((await failing.status()).lastGoodAt).toBeNull();

    clock = new Date('2026-11-05T15:00:00Z');
    await createService().run();
    expect((await failing.status()).lastGoodAt).toBe('2026-11-05T15:00:00.000Z');
  });

  it('keeps, for a day, the newest copy that has a good dump instead of a newer one without it', async () => {
    await writeData('members.json', '[]');
    const service = createService({ keep: 2, keepRecent: 1, database: scripted(true, false, true, true) });

    await copyAt(service, '2026-11-04T13:00:00Z', '2026-11-04T14:00:00Z', '2026-11-05T13:00:00Z', '2026-11-05T14:00:00Z');

    expect(await copiesOf()).toEqual(['backup-20261104T130000Z', 'backup-20261105T140000Z']);
  });

  it('keeps the newest copy of a day when none of that day has a dump', async () => {
    await writeData('members.json', '[]');
    const service = createService({ keep: 2, keepRecent: 1, database: scripted(true, false, false, false) });

    await copyAt(service, '2026-11-03T15:00:00Z', '2026-11-04T13:00:00Z', '2026-11-04T14:00:00Z', '2026-11-05T15:00:00Z');

    expect(await copiesOf()).toEqual(['backup-20261103T150000Z', 'backup-20261104T140000Z', 'backup-20261105T150000Z']);
  });

  it('never prunes the last copy with a good dump, however old, after many days of failed dumps', async () => {
    await writeData('members.json', '[]');
    const service = createService({ keep: 2, keepRecent: 2, database: scripted(true, false, false, false, false, false) });

    await copyAt(service, '2026-11-01T15:00:00Z', '2026-11-02T15:00:00Z', '2026-11-03T15:00:00Z', '2026-11-04T15:00:00Z', '2026-11-05T15:00:00Z', '2026-11-06T15:00:00Z');

    expect(await copiesOf()).toEqual(['backup-20261101T150000Z', 'backup-20261105T150000Z', 'backup-20261106T150000Z']);
    expect(await readFile(join(destination(), 'backup-20261101T150000Z', 'database.dump'), 'utf8')).toBe('PGDMP fake');
  });

  it('treats a corrupt or unreadable manifest as having no good dump, keeps it when unsure and breaks nothing', async () => {
    await writeData('members.json', '[]');
    await mkdir(join(destination(), 'backup-20261103T150000Z'));
    await writeFile(join(destination(), 'backup-20261103T150000Z', 'manifest.json'), '{ not json');
    await mkdir(join(destination(), 'backup-20261102T150000Z'));
    const service = createService({ keep: 2, keepRecent: 1 });

    await copyAt(service, '2026-11-04T15:00:00Z');

    expect(await copiesOf()).toEqual(['backup-20261103T150000Z', 'backup-20261104T150000Z']);
    expect(await service.status()).toMatchObject({ lastGoodAt: '2026-11-04T15:00:00.000Z' });
  });

  it('reads an unknown failure code in a manifest as DATABASE_DUMP_FAILED', async () => {
    await mkdir(join(destination(), 'backup-20261103T150000Z'));
    await writeFile(join(destination(), 'backup-20261103T150000Z', 'manifest.json'), JSON.stringify({ database: { state: 'failed', code: 'SOMETHING' } }));

    expect((await createService().status()).database.lastCopy).toEqual({ state: 'failed', code: 'DATABASE_DUMP_FAILED' });
  });
});
