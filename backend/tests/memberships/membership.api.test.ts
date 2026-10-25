import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { MembershipService } from '../../src/modules/memberships/membership.service.js';
import { BASKET, createTestContext, LUCIA, TOMAS, VOLLEY } from './helpers.js';

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!();
});

async function listen(membershipService?: MembershipService): Promise<string> {
  const server: Server = createApp({ membershipService }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function startApi() {
  const context = await createTestContext();
  cleanups.push(context.cleanup);
  const baseUrl = await listen(context.service);
  const send = (method: string, path: string, body?: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { send, ...context };
}

describe('memberships API (read-only)', () => {
  it('gets a membership by id', async () => {
    const { send, service } = await startApi();
    await service.syncMember(LUCIA, [BASKET], '2026-09-01');
    const [membership] = await service.list();
    const response = await send('GET', `/api/memberships/${membership!.id}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(membership);
  });

  it('returns 404 for an unknown membership', async () => {
    const { send } = await startApi();
    const response = await send('GET', '/api/memberships/nope');
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe('not_found');
  });

  it('lists with memberId, disciplineId and status filters', async () => {
    const { send, service } = await startApi();
    await service.syncMember(LUCIA, [BASKET, VOLLEY], '2026-09-01');
    await service.syncMember(TOMAS, [BASKET], '2026-09-02');
    await service.syncMember(LUCIA, [BASKET], '2026-10-01');

    const count = async (query: string) =>
      ((await (await send('GET', `/api/memberships${query}`)).json()) as unknown[]).length;
    expect(await count('')).toBe(3);
    expect(await count(`?memberId=${LUCIA}`)).toBe(2);
    expect(await count(`?disciplineId=${BASKET}`)).toBe(2);
    expect(await count('?status=ended')).toBe(1);
    expect(await count(`?memberId=${LUCIA}&status=active`)).toBe(1);
    expect(await count('?status=')).toBe(3);
  });

  it('rejects an invalid status filter with 400', async () => {
    const { send } = await startApi();
    const response = await send('GET', '/api/memberships?status=banned');
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('validation_error');
  });

  it.each([
    ['POST', '/api/memberships'],
    ['POST', '/api/memberships/some-id/end'],
    ['PUT', '/api/memberships/some-id'],
    ['DELETE', '/api/memberships/some-id'],
  ])('does not expose %s %s (404, nothing written)', async (method, path) => {
    const { send, service } = await startApi();
    const response = await send(method, path, { memberId: LUCIA, disciplineId: BASKET });
    expect(response.status).toBe(404);
    expect(await service.list()).toEqual([]);
  });

  it('answers 404 under /api/memberships when the service is not wired', async () => {
    const baseUrl = await listen();
    expect((await fetch(`${baseUrl}/api/memberships`)).status).toBe(404);
  });
});
