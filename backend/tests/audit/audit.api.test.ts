import { writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createAuditService } from '../../src/modules/audit/audit.service.js';
import type { Role } from '../../src/modules/users/user.types.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { listenOnFetchSafePort } from '../helpers/listen.mjs';
import { actors, createTestContext } from './helpers.js';

let baseUrl: string;
let server: Server;
let context: Awaited<ReturnType<typeof createTestContext>>;
const cookies = {} as Record<Role, string>;
const cleanups: Array<() => Promise<void>> = [];

beforeEach(async () => {
  const users = await createUsersFile();
  context = await createTestContext();
  cleanups.push(users.cleanup, context.cleanup);
  server = await listenOnFetchSafePort(createApp({ storePath: users.storePath, auditService: context.service }));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const role of ['head_secretary', 'secretary', 'teacher'] as const) cookies[role] = await signIn(baseUrl, role);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  while (cleanups.length > 0) await cleanups.pop()!();
});

function send(method: string, path: string, role?: Role, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(role ? { cookie: cookies[role] } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('audit API', () => {
  it('answers 401 without a session and 403 to a secretary or a teacher', async () => {
    expect((await send('GET', '/api/audit')).status).toBe(401);
    expect((await send('GET', '/api/audit', 'secretary')).status).toBe(403);
    expect((await send('GET', '/api/audit', 'teacher')).status).toBe(403);
  });

  it('lets the head secretary read the log, newest first', async () => {
    await context.service.record({ actorId: 'user-head', action: 'create', entityType: 'member', entityId: 'm1' });
    await context.service.record({ actorId: 'user-head', action: 'annul', entityType: 'payment', entityId: 'p1' });
    const response = await send('GET', '/api/audit', 'head_secretary');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { entries: Array<{ entityId: string }>; failedWrites: unknown };
    expect(body.entries.map((entry) => entry.entityId)).toEqual(['p1', 'm1']);
    expect(body.failedWrites).toEqual({ count: 0, lastFailedAt: null });
  });

  it('reports failed audit writes, with a count and a time and no error text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = createAuditService({
      repository: { append: async () => { throw new Error('secret disk path'); }, list: async () => [] },
      actors,
      now: () => new Date('2026-11-01T15:00:00Z'),
    });
    await failing.record({ actorId: 'user-head', action: 'create', entityType: 'member', entityId: 'm1' });
    const other = await listenOnFetchSafePort(createApp({ storePath: (await createUsersFile()).storePath, auditService: failing }));
    try {
      const url = `http://127.0.0.1:${(other.address() as AddressInfo).port}`;
      const response = await fetch(`${url}/api/audit`, { headers: { cookie: await signIn(url, 'head_secretary') } });
      const text = await response.text();
      expect(JSON.parse(text)).toEqual({ entries: [], failedWrites: { count: 1, lastFailedAt: '2026-11-01T15:00:00.000Z' } });
      expect(text).not.toContain('secret disk path');
    } finally {
      await new Promise<void>((resolve) => other.close(() => resolve()));
    }
  });

  it('has no write route: every other method is refused and nothing is stored', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      for (const path of ['/api/audit', '/api/audit/entry-1']) {
        expect((await send(method, path, 'head_secretary', {})).status, `${method} ${path}`).toBe(404);
      }
    }
    expect(await context.service.list()).toEqual([]);
  });

  it('answers 500 when the audit file is corrupt instead of returning a partial log', async () => {
    await writeFile(context.file, '{nope');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await send('GET', '/api/audit', 'head_secretary');
    expect(response.status).toBe(500);
    // A specific code so the screen can say the log is unreadable; the message names no path or file content.
    expect(await response.json()).toEqual({ error: 'audit_unreadable', message: 'The audit log could not be read' });
  });
});
