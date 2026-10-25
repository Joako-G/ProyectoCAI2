import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { Role } from '../../src/modules/users/user.types.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { createTestContext } from './pricing-config.helpers.js';

let baseUrl: string;
let server: Server;
const cookies = {} as Record<Role, string>;
const cleanups: Array<() => Promise<void>> = [];
let context: Awaited<ReturnType<typeof createTestContext>>;

beforeAll(async () => {
  const users = await createUsersFile();
  context = await createTestContext();
  cleanups.push(users.cleanup, context.cleanup);
  server = createApp({ storePath: users.storePath, pricingConfigService: context.service }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const role of ['head_secretary', 'secretary', 'teacher'] as const) cookies[role] = await signIn(baseUrl, role);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const cleanup of cleanups) await cleanup();
});

function send(method: string, path: string, role?: Role, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(role ? { cookie: cookies[role] } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const TARIFF_BODY = { effectiveFrom: '2027-03', enrollment: 1, socialFee: 2, activityFee: 3, carnetReplacement: 4 };
const AMOUNTS_BODY = { enrollment: 1, socialFee: 2, activityFee: 3, carnetReplacement: 4 };

const reads: Array<[string, string, unknown]> = [['GET', '/api/pricing', undefined]];
const writes: Array<[string, string, unknown]> = [
  ['POST', '/api/pricing/tariffs', TARIFF_BODY],
  ['PUT', '/api/pricing/tariffs/2027-03', AMOUNTS_BODY],
  ['DELETE', '/api/pricing/tariffs/2027-03', undefined],
  ['PUT', '/api/pricing/surcharge-tiers', [{ fromDay: 1, amount: 0 }]],
  ['PUT', '/api/pricing/proration-rule', { afterDay: 15, activityPercent: 50 }],
];

describe('pricing API: authorization', () => {
  it('answers 401 without a session on every route', async () => {
    for (const [method, path, body] of [...reads, ...writes]) {
      expect((await send(method, path, undefined, body)).status).toBe(401);
    }
  });

  it('answers 403 to a teacher on every route', async () => {
    for (const [method, path, body] of [...reads, ...writes]) {
      expect((await send(method, path, 'teacher', body)).status).toBe(403);
    }
  });

  it('lets the secretary read but not write', async () => {
    expect((await send('GET', '/api/pricing', 'secretary')).status).toBe(200);
    for (const [method, path, body] of writes) {
      expect((await send(method, path, 'secretary', body)).status).toBe(403);
    }
    expect((await context.service.get()).tariffs.map((tariff) => tariff.effectiveFrom)).not.toContain('2027-03');
  });

  it('lets the head secretary read and write', async () => {
    expect((await send('GET', '/api/pricing', 'head_secretary')).status).toBe(200);
    for (const [method, path, body] of writes) {
      const status = (await send(method, path, 'head_secretary', body)).status;
      expect([200, 201, 204]).toContain(status);
    }
  });
});

describe('pricing API: behavior', () => {
  it('returns the configuration', async () => {
    const config = await (await send('GET', '/api/pricing', 'secretary')).json();
    expect(Object.keys(config).sort()).toEqual(['prorationRule', 'surchargeTiers', 'tariffs']);
  });

  it('creates a tariff with 201, ignoring unknown fields such as discounts', async () => {
    const body = { ...TARIFF_BODY, effectiveFrom: '2027-06' };
    const response = await send('POST', '/api/pricing/tariffs', 'head_secretary', { ...body, discount: 10 });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(body);
  });

  it('answers 400 for a past-month tariff and 409 for a duplicate, or for editing or deleting a past one', async () => {
    const past = await send('POST', '/api/pricing/tariffs', 'head_secretary', { ...TARIFF_BODY, effectiveFrom: '2026-09' });
    expect(past.status).toBe(400);
    expect((await past.json()).error).toBe('validation_error');
    const future = { ...TARIFF_BODY, effectiveFrom: '2027-07' };
    await send('POST', '/api/pricing/tariffs', 'head_secretary', future);
    expect((await send('POST', '/api/pricing/tariffs', 'head_secretary', future)).status).toBe(409);
    const edit = await send('PUT', '/api/pricing/tariffs/2026-01', 'head_secretary', { ...AMOUNTS_BODY, activityFee: 99 });
    expect(edit.status).toBe(409);
    expect((await edit.json()).error).toBe('conflict');
    expect((await send('DELETE', '/api/pricing/tariffs/2026-01', 'head_secretary')).status).toBe(409);
  });

  it('answers 404 for an unknown tariff and 400 for a malformed period or body', async () => {
    expect((await send('PUT', '/api/pricing/tariffs/2030-01', 'head_secretary', AMOUNTS_BODY)).status).toBe(404);
    expect((await send('DELETE', '/api/pricing/tariffs/2030-01', 'head_secretary')).status).toBe(404);
    expect((await send('DELETE', '/api/pricing/tariffs/soon', 'head_secretary')).status).toBe(400);
    expect((await send('POST', '/api/pricing/tariffs', 'head_secretary', 'text')).status).toBe(400);
    expect((await send('PUT', '/api/pricing/surcharge-tiers', 'head_secretary', { fromDay: 1 })).status).toBe(400);
    expect((await send('PUT', '/api/pricing/surcharge-tiers', 'head_secretary', [null])).status).toBe(400);
    expect((await send('PUT', '/api/pricing/proration-rule', 'head_secretary', null)).status).toBe(400);
  });

  it('replaces tiers and the proration rule and returns the stored values', async () => {
    const tiers = [{ fromDay: 1, amount: 0 }, { fromDay: 9, amount: 2_000 }];
    const tiersResponse = await send('PUT', '/api/pricing/surcharge-tiers', 'head_secretary', tiers);
    expect(tiersResponse.status).toBe(200);
    expect(await tiersResponse.json()).toEqual(tiers);
    const rule = { afterDay: 18, activityPercent: 70 };
    expect(await (await send('PUT', '/api/pricing/proration-rule', 'head_secretary', rule)).json()).toEqual(rule);
    const config = await (await send('GET', '/api/pricing', 'head_secretary')).json();
    expect(config.surchargeTiers).toEqual(tiers);
    expect(config.prorationRule).toEqual(rule);
  });

  it('keeps tariffs unchanged when a body is invalid', async () => {
    const before = await (await send('GET', '/api/pricing', 'head_secretary')).json();
    const invalid = { ...TARIFF_BODY, effectiveFrom: '2027-09', socialFee: -1 };
    expect((await send('POST', '/api/pricing/tariffs', 'head_secretary', invalid)).status).toBe(400);
    expect(await (await send('GET', '/api/pricing', 'head_secretary')).json()).toEqual(before);
  });
});
