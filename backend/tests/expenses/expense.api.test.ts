import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { Role } from '../../src/modules/users/user.types.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { createTestContext, validBody } from './helpers.js';

let baseUrl: string;
let server: Server;
let repository: Awaited<ReturnType<typeof createTestContext>>['repository'];
const cookies = {} as Record<Role, string>;
const cleanups: Array<() => Promise<void>> = [];

beforeEach(async () => {
  const users = await createUsersFile();
  const context = await createTestContext();
  cleanups.push(users.cleanup, context.cleanup);
  repository = context.repository;
  server = createApp({ storePath: users.storePath, expenseService: context.service }).listen(0);
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

describe('expenses API: authorization', () => {
  it.each([
    ['GET', '/api/expenses', undefined],
    ['POST', '/api/expenses', validBody],
  ])('%s %s answers 401 without a session and 403 to a teacher, writing nothing', async (method, path, body) => {
    expect((await send(method, path, undefined, body)).status).toBe(401);
    expect((await send(method, path, 'teacher', body)).status).toBe(403);
    expect(await repository.list()).toEqual([]);
  });
});

describe('expenses API', () => {
  it.each(['secretary', 'head_secretary'] as const)('lets the %s record and list an expense, with the signed-in user as author', async (role) => {
    const created = await send('POST', '/api/expenses', role, validBody);

    expect(created.status).toBe(201);
    const expense = await created.json();
    expect(expense).toMatchObject({ ...validBody, createdBy: expect.any(String) });

    const listed = await send('GET', '/api/expenses', role);
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual([expense]);
  });

  it('ignores a createdBy sent in the body', async () => {
    const response = await send('POST', '/api/expenses', 'secretary', { ...validBody, createdBy: 'someone-else' });
    expect((await response.json()).createdBy).not.toBe('someone-else');
  });

  it.each([
    [{ ...validBody, amount: 0 }, 'amount'],
    [{ ...validBody, amount: 10.5 }, 'amount'],
    [{ ...validBody, amount: '100' }, 'amount'],
    [{ ...validBody, category: 'food' }, 'category'],
    [{ ...validBody, description: '   ' }, 'description'],
    [{ ...validBody, description: 'x'.repeat(201) }, 'description'],
    [{ ...validBody, date: '2026-02-30' }, 'date'],
    [{ ...validBody, date: '2099-01-01' }, 'date'],
  ])('answers 400 naming the field for %j and stores nothing', async (body, field) => {
    const response = await send('POST', '/api/expenses', 'secretary', body);

    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain(field);
    expect(await repository.list()).toEqual([]);
  });

  it('filters the list by period and rejects a bad one', async () => {
    await send('POST', '/api/expenses', 'secretary', { ...validBody, date: '2026-09-01' });
    await send('POST', '/api/expenses', 'secretary', { ...validBody, date: '2026-10-01' });

    const october = await (await send('GET', '/api/expenses?from=2026-10-01&to=2026-10-31', 'secretary')).json();
    expect(october).toHaveLength(1);
    expect((await send('GET', '/api/expenses?from=nope', 'secretary')).status).toBe(400);
    expect((await send('GET', '/api/expenses?from=2026-10-31&to=2026-10-01', 'secretary')).status).toBe(400);
  });
});
