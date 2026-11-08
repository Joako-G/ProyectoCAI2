import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startBackupScheduler } from '../../src/modules/backup/backup.scheduler.js';
import type { BackupRun } from '../../src/modules/backup/backup.types.js';
import { ConflictError } from '../../src/shared/errors.js';

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-11-04T15:00:00Z');
const ok: BackupRun = { ok: true, backup: { name: 'backup-20261104T150000Z', at: NOW.toISOString(), files: ['members.json'], database: { state: 'not_configured' }, partial: false } };

const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * HOUR).toISOString();

// Starts the scheduler with its first check at startup still in flight.
function setup(lastSuccessAt: string | null, run: () => Promise<BackupRun> = async () => ok, newestCopyFailedDump = false) {
  const lastCopy = newestCopyFailedDump ? { state: 'failed' as const, code: 'DATABASE_DUMP_UNAVAILABLE' as const } : null;
  const service = { status: vi.fn(async () => ({ lastSuccessAt, database: { lastCopy } })), run: vi.fn(run) };
  const log = vi.fn();
  const scheduler = startBackupScheduler({ service, now: () => NOW, log });
  return { service, log, scheduler };
}

/** The same, once the check at startup has finished, so a check made by the test is the only one running. */
async function settled(lastSuccessAt: string | null, run?: () => Promise<BackupRun>) {
  const started = setup(lastSuccessAt, run);
  await vi.advanceTimersByTimeAsync(0);
  started.service.run.mockClear();
  return started;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('backup scheduler', () => {
  it('copies at startup when there is no copy yet', async () => {
    const { service, scheduler } = setup(null);
    await vi.advanceTimersByTimeAsync(0);
    expect(service.run).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('skips the run while the last good copy is under 24 hours old', async () => {
    const { service, scheduler } = setup(hoursAgo(23));
    await vi.advanceTimersByTimeAsync(0);
    expect(service.run).not.toHaveBeenCalled();
    expect(await scheduler.tick()).toBe('fresh');
    scheduler.stop();
  });

  it('runs once the last good copy is 24 hours old, checking every hour', async () => {
    const { service, scheduler } = setup(hoursAgo(24));
    await vi.advanceTimersByTimeAsync(0);
    expect(service.run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(service.status).toHaveBeenCalledTimes(2);
    expect(service.run).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('tries again at the next hourly check when the newest copy has no database dump, even if it is under 24 hours old', async () => {
    const { service, scheduler } = setup(hoursAgo(2), undefined, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(service.run).toHaveBeenCalledTimes(1);
    expect(await scheduler.tick()).toBe('ran');
    scheduler.stop();
  });

  it('never makes a new copy for a failed dump more than once an hour', async () => {
    const { service, scheduler } = setup(hoursAgo(0.5), undefined, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(service.run).not.toHaveBeenCalled();
    expect(await scheduler.tick()).toBe('fresh');
    scheduler.stop();
  });

  it('never overlaps two runs', async () => {
    let finish!: () => void;
    let first = true;
    const { service, scheduler } = setup(null, () => {
      if (!first) return Promise.resolve(ok);
      first = false;
      return new Promise<BackupRun>((resolve) => { finish = () => resolve(ok); });
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(await scheduler.tick()).toBe('busy');
    expect(service.run).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(await scheduler.tick()).toBe('ran');
    expect(service.run).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('treats a copy someone else started as busy, and logs and survives a failed or throwing run', async () => {
    const conflict = await settled(null, async () => { throw new ConflictError('already running'); });
    expect(await conflict.scheduler.tick()).toBe('busy');
    conflict.scheduler.stop();

    const failed = await settled(null, async () => ({ ok: false, failure: { at: NOW.toISOString(), code: 'ENOSPC' } }));
    expect(await failed.scheduler.tick()).toBe('failed');
    failed.scheduler.stop();

    const crashed = await settled(null, async () => { throw new Error('boom'); });
    expect(await crashed.scheduler.tick()).toBe('failed');
    expect(crashed.log).toHaveBeenCalledTimes(2);
    crashed.scheduler.stop();
  });

  it('stops checking after stop()', async () => {
    const { service, scheduler } = setup(hoursAgo(1));
    await vi.advanceTimersByTimeAsync(0);
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(5 * HOUR);
    expect(service.status).toHaveBeenCalledTimes(1);
  });

  it('does not keep the process alive', () => {
    const unref = vi.fn();
    const spy = vi.spyOn(globalThis, 'setInterval').mockReturnValue({ unref } as unknown as ReturnType<typeof setInterval>);
    const { scheduler } = setup(hoursAgo(1));
    expect(unref).toHaveBeenCalled();
    scheduler.stop();
    spy.mockRestore();
  });
});
