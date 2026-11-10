import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createMemberSummaryService } from '../../src/modules/members/member-summary.service.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { listenOnFetchSafePort } from '../helpers/listen.mjs';
import { createTestContext as createMemberships } from '../memberships/helpers.js';
import { createTestContext as createPayments } from '../payments/payment.helpers.js';
import { createTestContext as createPricing } from '../payments/pricing-config.helpers.js';
import { adultInput, createTestContext as createMembers, minorInput } from './helpers.js';

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!();
});

async function start() {
  const users = await createUsersFile();
  const members = await createMembers();
  const memberships = await createMemberships();
  const pricing = await createPricing();
  const payments = await createPayments();
  cleanups.push(users.cleanup, members.cleanup, memberships.cleanup, pricing.cleanup, payments.cleanup);
  const active = await members.service.create(adultInput, 'user-test');
  const left = await members.service.create(minorInput, 'user-test');
  await members.service.deactivate(left.id, 'Mudanza', 'user-test');
  const server: Server = await listenOnFetchSafePort(createApp({
    storePath: users.storePath,
    memberService: members.service,
    memberSummaryService: createMemberSummaryService({ members: members.service, memberships: memberships.service, payments: payments.repository, pricing: pricing.service }),
  }));
  cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { baseUrl, activeId: active.id };
}

describe('GET /api/members/summary', () => {
  it('answers 401 without a session and 403 to a teacher', async () => {
    const { baseUrl } = await start();
    expect((await fetch(`${baseUrl}/api/members/summary`)).status).toBe(401);
    const response = await fetch(`${baseUrl}/api/members/summary`, { headers: { cookie: await signIn(baseUrl, 'teacher') } });
    expect(response.status).toBe(403);
  });

  it('answers the counts and ids to the secretary instead of a member lookup', async () => {
    const { baseUrl, activeId } = await start();
    const response = await fetch(`${baseUrl}/api/members/summary`, { headers: { cookie: await signIn(baseUrl, 'secretary') } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      active: 1,
      inactive: 1,
      upToDate: 1,
      debtors: 0,
      overdue: 0,
      ids: { upToDate: [activeId], debtors: [], overdue: [] },
    });
  });

  it('answers 500 without details when a source cannot be read, and keeps serving', async () => {
    const users = await createUsersFile();
    cleanups.push(users.cleanup);
    let calls = 0;
    const server: Server = await listenOnFetchSafePort(createApp({
      storePath: users.storePath,
      memberSummaryService: {
        summary: async () => {
          calls += 1;
          throw new Error('payments store unreadable at C:/secret/path');
        },
      },
    }));
    cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const cookie = await signIn(baseUrl, 'secretary');

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/members/summary`, { headers: { cookie } });
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'internal_error', message: 'Unexpected error' });
    }
    expect(calls).toBe(2);
  });
});
