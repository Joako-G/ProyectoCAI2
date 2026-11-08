import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createApp } from '../../src/app.js';
import type { BackupService } from '../../src/modules/backup/backup.service.js';
import type { BackupRun, BackupStatus } from '../../src/modules/backup/backup.types.js';
import type { Role } from '../../src/modules/users/user.types.js';
import { ConflictError } from '../../src/shared/errors.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';

const STATUS: BackupStatus = {
  destination: { isDefault: true, state: 'ready' },
  keep: 30,
  keepRecent: 5,
  copies: 2,
  lastSuccessAt: '2026-11-04T15:00:00.000Z',
  lastFailure: null,
  running: false,
  database: { lastCopy: { state: 'included', file: 'database.dump', format: 'pg_dump-custom', bytes: 1024 }, lastFailure: null },
};
const GOOD: BackupRun = {
  ok: true,
  backup: {
    name: 'backup-20261104T150000Z',
    at: '2026-11-04T15:00:00.000Z',
    files: ['members.json'],
    database: { state: 'included', file: 'database.dump', format: 'pg_dump-custom', bytes: 1024 },
    partial: false,
  },
};

let baseUrl: string;
let server: Server;
let status: Mock<BackupService['status']>;
let run: Mock<BackupService['run']>;
const cookies = {} as Record<Role, string>;
const cleanups: Array<() => Promise<void>> = [];

beforeEach(async () => {
  const users = await createUsersFile();
  cleanups.push(users.cleanup);
  // Spies prove a rejected request never reaches the service.
  status = vi.fn(async () => STATUS);
  run = vi.fn(async () => GOOD);
  server = createApp({ storePath: users.storePath, backupService: { status, run } }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const role of ['head_secretary', 'secretary', 'teacher'] as const) cookies[role] = await signIn(baseUrl, role);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  while (cleanups.length > 0) await cleanups.pop()!();
});

function send(method: string, role?: Role) {
  return fetch(`${baseUrl}/api/backups`, { method, headers: role ? { cookie: cookies[role] } : {} });
}

describe('backup API: authorization', () => {
  it.each([['GET'], ['POST']])('answers %s with 401 without a session and 403 to a secretary or a teacher, never reaching the service', async (method) => {
    expect((await send(method)).status).toBe(401);
    expect((await send(method, 'secretary')).status).toBe(403);
    expect((await send(method, 'teacher')).status).toBe(403);
    expect(status).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
});

describe('backup API: the head secretary', () => {
  it('reads the status', async () => {
    const response = await send('GET', 'head_secretary');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(STATUS);
  });

  it('runs a copy now as herself and answers 201 with the copy', async () => {
    const response = await send('POST', 'head_secretary');
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(GOOD.ok ? GOOD.backup : null);
    expect(run).toHaveBeenCalledWith('user-head_secretary');
  });

  it('answers 201 with the failure code of the database part when the dump failed but the copy was made', async () => {
    const partial: BackupRun = { ok: true, backup: { name: 'backup-20261104T150000Z', at: '2026-11-04T15:00:00.000Z', files: ['members.json'], database: { state: 'failed', code: 'DATABASE_DUMP_FAILED' }, partial: true } };
    run.mockResolvedValueOnce(partial);
    const response = await send('POST', 'head_secretary');
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ partial: true, database: { state: 'failed', code: 'DATABASE_DUMP_FAILED' } });
  });

  it('answers 409 when a copy is already running', async () => {
    run.mockRejectedValueOnce(new ConflictError('A backup is already running'));
    expect((await send('POST', 'head_secretary')).status).toBe(409);
  });

  it('answers 500 with only the failure code when the copy fails, never a path', async () => {
    run.mockResolvedValueOnce({ ok: false, failure: { at: '2026-11-04T15:00:00.000Z', code: 'ENOSPC' } });
    const response = await send('POST', 'head_secretary');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'backup_failed', message: 'The backup could not be completed', code: 'ENOSPC' });
  });
});
