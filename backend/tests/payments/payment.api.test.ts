import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { Role } from '../../src/modules/users/user.types.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { MEMBER_ID, membership, createTestContext } from './payment.helpers.js';

let baseUrl: string;
let server: Server;
const cookies = {} as Record<Role, string>;
const cleanups: Array<() => Promise<void>> = [];

// Today is 2026-10-05 in the test context. Lucia owes September and October (basket, active since 2026-09).
// Every test gets its own server and files, so no test relies on a payment made by another one.
beforeEach(async () => {
  const users = await createUsersFile();
  const context = await createTestContext({
    members: [
      { id: MEMBER_ID, status: 'active' },
      { id: 'member-old', status: 'inactive', deactivation: { date: '2026-09-01' } },
    ],
    memberships: [membership('basket', '2026-09-01')],
  });
  cleanups.push(users.cleanup, context.cleanup);
  server = createApp({ storePath: users.storePath, paymentService: context.service }).listen(0);
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

const social = (period: string) => ({ kind: 'socialFee', period });
const pay = (concepts: unknown[], extra: Record<string, unknown> = {}) => ({ concepts, method: 'cash', ...extra });

describe('payments API: authorization', () => {
  const routes: Array<[string, string, unknown]> = [
    ['GET', `/api/payments/members/${MEMBER_ID}/account`, undefined],
    ['POST', '/api/payments/preview', { memberId: MEMBER_ID, concepts: [social('2026-10')] }],
    ['POST', '/api/payments', { memberId: MEMBER_ID, ...pay([social('2026-10')]) }],
    ['GET', `/api/payments/members/${MEMBER_ID}`, undefined],
    ['GET', '/api/payments/receipts/1', undefined],
    ['POST', '/api/payments/missing/annul', { reason: 'x' }],
  ];

  it('answers 401 without a session and 403 to a teacher on every route', async () => {
    for (const [method, path, body] of routes) {
      expect((await send(method, path, undefined, body)).status).toBe(401);
      expect((await send(method, path, 'teacher', body)).status).toBe(403);
    }
  });

  it('lets the secretary read and collect but not annul', async () => {
    const created = await send('POST', '/api/payments', 'secretary', { memberId: MEMBER_ID, ...pay([social('2026-09')]) });
    expect(created.status).toBe(201);
    const { id } = await created.json();
    const annul = await send('POST', `/api/payments/${id}/annul`, 'secretary', { reason: 'Mistake' });
    expect(annul.status).toBe(403);
    expect((await send('GET', `/api/payments/members/${MEMBER_ID}`, 'secretary')).status).toBe(200);
  });
});

describe('payments API: account and preview', () => {
  it('returns the owed concepts and standing of a member, and 404 for an unknown one', async () => {
    expect((await send('GET', '/api/payments/members/nobody/account', 'secretary')).status).toBe(404);
    const ok = await send('GET', `/api/payments/members/${MEMBER_ID}/account`, 'secretary');
    expect(ok.status).toBe(200);
    const account = await ok.json();
    expect(account).toMatchObject({ memberId: MEMBER_ID, asOf: '2026-10-05', standing: expect.any(String) });
    expect(account.owed.map((entry: { period: string }) => entry.period)).toContain('2026-10');
  });

  it('previews a charge without writing and ignores client amounts', async () => {
    const before = await (await send('GET', `/api/payments/members/${MEMBER_ID}`, 'head_secretary')).json();
    const response = await send('POST', '/api/payments/preview', 'secretary', {
      memberId: MEMBER_ID,
      concepts: [{ ...social('2026-10'), amount: 1 }],
      total: 1,
    });
    expect(response.status).toBe(200);
    expect((await response.json()).total).toBe(20_000);
    expect(await (await send('GET', `/api/payments/members/${MEMBER_ID}`, 'head_secretary')).json()).toEqual(before);
  });

  it('ignores a backdated registration.enrollmentDate', async () => {
    const concepts = [{ kind: 'enrollment' }, social('2026-10'), { kind: 'activityFee', period: '2026-10', disciplineId: 'basket' }];
    const honest = await (await send('POST', '/api/payments/preview', 'secretary', { memberId: MEMBER_ID, concepts, registration: {} })).json();
    const backdated = await (await send('POST', '/api/payments/preview', 'secretary', {
      memberId: MEMBER_ID, concepts, registration: { enrollmentDate: '2026-10-20' },
    })).json();
    expect(backdated.total).toBe(honest.total);
    expect(honest.total).toBe(60_000);
  });

  it('trims the memberId', async () => {
    const response = await send('POST', '/api/payments/preview', 'secretary', { memberId: ` ${MEMBER_ID} `, concepts: [social('2026-10')] });
    expect(response.status).toBe(200);
  });

  it('answers 400 for malformed bodies', async () => {
    expect((await send('POST', '/api/payments/preview', 'secretary', { concepts: [social('2026-10')] })).status).toBe(400);
    expect((await send('POST', '/api/payments/preview', 'secretary', { memberId: MEMBER_ID, concepts: 'x' })).status).toBe(400);
    expect((await send('POST', '/api/payments/preview', 'secretary', { memberId: MEMBER_ID, concepts: [] })).status).toBe(400);
    expect((await send('POST', '/api/payments', 'secretary', { memberId: MEMBER_ID, ...pay([social('2026-10')], { method: 'bitcoin' }) })).status).toBe(400);
  });
});

describe('payments API: register, receipts and annulment', () => {
  it('stores createdBy from the session, never from the body, and ignores client amounts', async () => {
    const response = await send('POST', '/api/payments', 'secretary', {
      memberId: MEMBER_ID,
      ...pay([{ ...social('2026-10'), amount: 1 }], { total: 1, createdBy: 'someone-else', actorId: 'someone-else' }),
    });
    expect(response.status).toBe(201);
    const payment = await response.json();
    expect(payment.createdBy).toBe('user-secretary');
    expect(payment.total).toBe(20_000);
    const receipt = await send('GET', `/api/payments/receipts/${payment.receiptNumber}`, 'secretary');
    expect(receipt.status).toBe(200);
    expect((await receipt.json()).id).toBe(payment.id);
    const history = await (await send('GET', `/api/payments/members/${MEMBER_ID}`, 'head_secretary')).json();
    expect(history.map((entry: { id: string }) => entry.id)).toContain(payment.id);
  });

  it('answers 409 for an already settled concept and an inactive member, 404 for unknown ones', async () => {
    const first = await send('POST', '/api/payments', 'secretary', { memberId: MEMBER_ID, ...pay([social('2026-10')]) });
    expect(first.status).toBe(201);
    expect((await send('POST', '/api/payments', 'secretary', { memberId: MEMBER_ID, ...pay([social('2026-10')]) })).status).toBe(409);
    expect((await send('POST', '/api/payments', 'secretary', { memberId: 'member-old', ...pay([social('2026-08')]) })).status).toBe(409);
    expect((await send('POST', '/api/payments', 'secretary', { memberId: 'nobody', ...pay([social('2026-10')]) })).status).toBe(404);
    expect((await send('GET', '/api/payments/receipts/9999', 'secretary')).status).toBe(404);
    expect((await send('GET', '/api/payments/receipts/abc', 'secretary')).status).toBe(400);
  });

  it('lets the head secretary annul once, with a reason', async () => {
    const created = await (await send('POST', '/api/payments', 'secretary', { memberId: MEMBER_ID, ...pay([{ kind: 'carnetReplacement' }]) })).json();
    expect((await send('POST', `/api/payments/${created.id}/annul`, 'head_secretary', {})).status).toBe(400);
    expect((await send('POST', `/api/payments/${created.id}/annul`, 'head_secretary', { reason: '  ' })).status).toBe(400);
    const annulled = await send('POST', `/api/payments/${created.id}/annul`, 'head_secretary', { reason: 'Wrong member' });
    expect(annulled.status).toBe(200);
    expect((await annulled.json()).annulment).toMatchObject({ reason: 'Wrong member', annulledBy: 'user-head_secretary' });
    expect((await send('POST', `/api/payments/${created.id}/annul`, 'head_secretary', { reason: 'Again' })).status).toBe(409);
    expect((await send('POST', '/api/payments/missing/annul', 'head_secretary', { reason: 'x' })).status).toBe(404);
  });
});
