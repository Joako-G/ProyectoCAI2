import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createApp } from '../../src/app.js';
import type { CashCountService } from '../../src/modules/cashcount/cashcount.service.js';
import type { Role } from '../../src/modules/users/user.types.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { createTestContext, incomeEntry } from './helpers.js';

let baseUrl: string;
let server: Server;
let preview: Mock<CashCountService['preview']>;
let close: Mock<CashCountService['close']>;
let history: Mock<CashCountService['history']>;
let repository: Awaited<ReturnType<typeof createTestContext>>['repository'];
const cookies = {} as Record<Role, string>;
const cleanups: Array<() => Promise<void>> = [];

beforeEach(async () => {
  const users = await createUsersFile();
  const context = await createTestContext([incomeEntry({ amount: 1000 }), incomeEntry({ receiptNumber: 2, method: 'qr', amount: 500 })]);
  cleanups.push(users.cleanup, context.cleanup);
  repository = context.repository;
  // Spies over the real service prove a rejected request never reaches it.
  preview = vi.fn(context.cashCount.preview);
  close = vi.fn(context.cashCount.close);
  history = vi.fn(context.cashCount.history);
  server = createApp({ storePath: users.storePath, cashCountService: { preview, close, history } }).listen(0);
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

describe('cash count API: authorization', () => {
  const routes: Array<[string, string, unknown]> = [
    ['GET', '/api/cashcount/today', undefined],
    ['GET', '/api/cashcount', undefined],
    ['POST', '/api/cashcount', { countedCash: 1000 }],
  ];

  it.each(routes)('%s %s answers 401 without a session and 403 to a secretary or a teacher, touching nothing', async (method, path, body) => {
    expect((await send(method, path, undefined, body)).status).toBe(401);
    expect((await send(method, path, 'secretary', body)).status).toBe(403);
    expect((await send(method, path, 'teacher', body)).status).toBe(403);
    expect(preview).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(history).not.toHaveBeenCalled();
    expect(await repository.list()).toEqual([]);
  });
});

describe('cash count API: the head secretary', () => {
  it('previews what is expected today without closing it', async () => {
    const response = await send('GET', '/api/cashcount/today', 'head_secretary');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ businessDate: '2026-10-05', expected: { total: 1500, cash: 1000 } });
    expect(await repository.list()).toEqual([]);
  });

  it('closes the day as the signed-in user, ignoring any date, actor or variance in the body', async () => {
    const forged = { countedCash: 900, varianceNote: 'Vuelto mal dado', businessDate: '2020-01-01', closedBy: 'someone-else', variance: 5 };

    const response = await send('POST', '/api/cashcount', 'head_secretary', forged);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      businessDate: '2026-10-05',
      countedCash: 900,
      variance: -100,
      varianceNote: 'Vuelto mal dado',
      closedBy: 'user-head_secretary',
    });
  });

  it('answers 409 to a second close of the day and lists the history', async () => {
    expect((await send('POST', '/api/cashcount', 'head_secretary', { countedCash: 1000 })).status).toBe(201);
    expect((await send('POST', '/api/cashcount', 'head_secretary', { countedCash: 1000 })).status).toBe(409);

    const list = await (await send('GET', '/api/cashcount', 'head_secretary')).json();
    expect(list).toHaveLength(1);
    expect((await (await send('GET', '/api/cashcount/today', 'head_secretary')).json()).closed).toMatchObject({ countedCash: 1000 });
  });

  it.each([[{}], [{ countedCash: -5 }], [{ countedCash: '1000' }], [{ countedCash: 10, varianceNote: 7 }], [[1, 2]]])('answers 400 to the body %j and writes nothing', async (body) => {
    const response = await send('POST', '/api/cashcount', 'head_secretary', body);

    expect(response.status).toBe(400);
    expect(await repository.list()).toEqual([]);
  });

  it('offers no way to edit or delete a close', async () => {
    await send('POST', '/api/cashcount', 'head_secretary', { countedCash: 1000 });
    const [saved] = await repository.list();

    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      expect((await send(method, `/api/cashcount/${saved!.id}`, 'head_secretary', { countedCash: 1 })).status).toBe(404);
    }
    expect(await repository.list()).toEqual([saved]);
  });
});
