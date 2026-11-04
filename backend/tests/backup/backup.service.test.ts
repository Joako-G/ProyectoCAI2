import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackupService } from '../../src/modules/backup/backup.service.js';
import { ConflictError } from '../../src/shared/errors.js';
import type { AuditRecordInput } from '../../src/modules/audit/audit.types.js';

// Everything runs inside one temporary directory: the real data and backup folders are never touched.
let root: string;
let clock: Date;
let audited: AuditRecordInput[];

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'backup-'));
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

function createService(overrides: { keep?: number; isDefaultDestination?: boolean } = {}) {
  return createBackupService({
    sources: [
      { name: 'members.json', path: dataFile('members.json') },
      { name: 'payments.json', path: dataFile('payments.json') },
      { name: 'cashcounts.json', path: dataFile('cashcounts.json') },
    ],
    destination: destination(),
    isDefaultDestination: overrides.isDefaultDestination ?? false,
    keep: overrides.keep,
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

    expect(outcome).toEqual({ ok: true, backup: { name: 'backup-20261104T150000Z', at: '2026-11-04T15:00:00.000Z', files: ['members.json', 'payments.json'] } });
    expect(await copiesOf()).toEqual(['backup-20261104T150000Z']);
    const folder = join(destination(), 'backup-20261104T150000Z');
    expect(await readFile(join(folder, 'members.json'), 'utf8')).toBe('[{"id":"m1"}]');
    expect(JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8'))).toEqual({ createdAt: '2026-11-04T15:00:00.000Z', files: ['members.json', 'payments.json'] });
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

describe('backup service: retention', () => {
  it('keeps only the most recent copies and never touches anything it did not create', async () => {
    await writeData('members.json', '[]');
    await mkdir(join(destination(), 'vacaciones'), { recursive: true });
    await writeFile(join(destination(), 'notas.txt'), 'not a copy');
    const service = createService({ keep: 3 });

    for (let day = 1; day <= 5; day += 1) {
      clock = new Date(`2026-11-0${day}T15:00:00Z`);
      await service.run();
    }

    expect(await copiesOf()).toEqual(['backup-20261103T150000Z', 'backup-20261104T150000Z', 'backup-20261105T150000Z', 'notas.txt', 'vacaciones']);
    expect((await service.status()).copies).toBe(3);
  });

  it('keeps 30 copies unless told otherwise', async () => {
    expect((await createService().status()).keep).toBe(30);
  });
});

describe('backup service: status', () => {
  it('reads the last good copy from the folders, so it survives a restart', async () => {
    await writeData('members.json', '[]');
    await createService().run();

    const afterRestart = await createService().status();

    expect(afterRestart).toEqual({ destination: { isDefault: false }, keep: 30, copies: 1, lastSuccessAt: '2026-11-04T15:00:00.000Z', lastFailure: null, running: false });
  });

  it('says whether the destination is the default folder and has nothing yet when it does not exist', async () => {
    expect(await createService({ isDefaultDestination: true }).status()).toMatchObject({ destination: { isDefault: true }, copies: 0, lastSuccessAt: null });
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
