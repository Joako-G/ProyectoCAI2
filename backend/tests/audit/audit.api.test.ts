import { writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { Role } from '../../src/modules/users/user.types.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { createTestContext } from './helpers.js';

let baseUrl: string;
let server: Server;
let context: Awaited<ReturnType<typeof createTestContext>>;
const cookies = {} as Record<Role, string>;
const cleanups: Array<() => Promise<void>> = [];

beforeEach(async () => {
  const users = await createUsersFile();
  context = await createTestContext();
  cleanups.push(users.cleanup, context.cleanup);
  server = createApp({ storePath: users.storePath, auditService: context.service }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const role of ['head_secretary', 'secretary', 'teacher'] as const) cookies[role] = await signIn(baseUrl, role);
});

afterEach(async () => {
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
    const entries = (await response.json()) as Array<{ entityId: string }>;
    expect(entries.map((entry) => entry.entityId)).toEqual(['p1', 'm1']);
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
    expect((await send('GET', '/api/audit', 'head_secretary')).status).toBe(500);
  });
});
