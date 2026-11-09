import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { DebtNotice, WelcomeNotice } from '../../src/modules/notices/notice.types.js';
import { NotFoundError } from '../../src/shared/errors.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { listenOnFetchSafePort } from '../helpers/listen.mjs';

let server: Server;
let baseUrl: string;
let cleanup: () => Promise<void>;
const rows: DebtNotice[] = [
  {
    memberId: 'm1',
    memberNumber: '1',
    name: 'A B',
    standing: 'debtor',
    unpaidPeriodCount: 1,
    total: 40000,
    recipient: 'member',
    recipientName: 'A B',
    recipientContact: '12345',
    link: null,
    numberIssue: true,
  },
];

const welcome: WelcomeNotice = { memberId: 'm1', recipient: 'member', recipientName: 'A B', link: 'https://wa.me/5493815550101?text=hola', numberIssue: false };

beforeAll(async () => {
  const users = await createUsersFile();
  cleanup = users.cleanup;
  server = await listenOnFetchSafePort(createApp({
    storePath: users.storePath,
    noticeService: {
      debtNotices: async () => ({ asOf: '2026-11-01', rows }),
      welcomeNotice: async (paymentId: string) => {
        if (paymentId === 'missing') throw new NotFoundError('Payment not found');
        return welcome;
      },
    },
  }));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await cleanup();
});

describe('GET /api/notices/debt', () => {
  it('answers 401 without a session and 403 to a teacher', async () => {
    expect((await fetch(`${baseUrl}/api/notices/debt`)).status).toBe(401);
    expect((await fetch(`${baseUrl}/api/notices/debt`, { headers: { cookie: await signIn(baseUrl, 'teacher') } })).status).toBe(403);
  });

  it('returns the service result to the secretary and the head secretary', async () => {
    for (const role of ['secretary', 'head_secretary'] as const) {
      const response = await fetch(`${baseUrl}/api/notices/debt`, { headers: { cookie: await signIn(baseUrl, role) } });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ asOf: '2026-11-01', rows });
    }
  });
});

describe('GET /api/notices/welcome/:paymentId', () => {
  it('answers 401 without a session and 403 to a teacher', async () => {
    expect((await fetch(`${baseUrl}/api/notices/welcome/pay-1`)).status).toBe(401);
    expect((await fetch(`${baseUrl}/api/notices/welcome/pay-1`, { headers: { cookie: await signIn(baseUrl, 'teacher') } })).status).toBe(403);
  });

  it('returns the prepared welcome to the secretary and 404 for an unknown payment', async () => {
    const cookie = await signIn(baseUrl, 'secretary');
    const found = await fetch(`${baseUrl}/api/notices/welcome/pay-1`, { headers: { cookie } });
    expect(found.status).toBe(200);
    expect(await found.json()).toEqual(welcome);
    expect((await fetch(`${baseUrl}/api/notices/welcome/missing`, { headers: { cookie } })).status).toBe(404);
  });
});
