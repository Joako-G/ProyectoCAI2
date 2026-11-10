import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTestContext as createCashCount } from '../cashcount/helpers.js';
import { createTestContext as createExpenses } from '../expenses/helpers.js';
import { createTestContext as createDisciplines } from '../disciplines/helpers.js';
import { createTestContext as createMembers } from '../members/helpers.js';
import { createTestContext as createMemberships } from '../memberships/helpers.js';
import { createTestContext as createPricing } from '../payments/pricing-config.helpers.js';
import { createTestContext as createPayments } from '../payments/payment.helpers.js';
import { createGreetingBus } from '../../src/modules/access/greeting.bus.js';
import { createMemberSummaryService } from '../../src/modules/members/member-summary.service.js';
import { createRosterService } from '../../src/modules/roster/roster.service.js';
import { roles, type Role as RoleName } from '../../src/modules/users/user.types.js';
import { createTestContext as createAudit } from '../audit/helpers.js';
import { listenOnFetchSafePort } from '../helpers/listen.mjs';
import { createUsersFile, signIn } from './helpers.js';
import { routes } from './routes.js';

let baseUrl: string;
let server: Server;
const cookies = {} as Record<RoleName, string>;
const cleanups: Array<() => Promise<void>> = [];

beforeAll(async () => {
  const users = await createUsersFile();
  const members = await createMembers();
  const disciplines = await createDisciplines();
  const memberships = await createMemberships();
  const pricing = await createPricing();
  const payments = await createPayments();
  const cashCount = await createCashCount();
  const audit = await createAudit();
  const expenses = await createExpenses();
  cleanups.push(expenses.cleanup, audit.cleanup, users.cleanup, members.cleanup, disciplines.cleanup, memberships.cleanup, pricing.cleanup, payments.cleanup, cashCount.cleanup);
  server = await listenOnFetchSafePort(createApp({
    storePath: users.storePath,
    memberService: members.service,
    memberSummaryService: createMemberSummaryService({ members: members.service, memberships: memberships.service, payments: payments.repository, pricing: pricing.service }),
    disciplineService: disciplines.service,
    membershipService: memberships.service,
    pricingConfigService: pricing.service,
    paymentService: payments.service,
    reportService: cashCount.reports,
    cashCountService: cashCount.cashCount,
    expenseService: expenses.service,
    auditService: audit.service,
    backupService: { status: async () => ({ destination: { isDefault: true, state: 'ready' }, keep: 30, keepRecent: 5, copies: 0, lastSuccessAt: null, lastGoodAt: null, lastFailure: null, running: false, database: { lastCopy: null, lastFailure: null } }), run: async () => ({ ok: true, backup: { name: 'backup-20261101T150000Z', at: '2026-11-01T15:00:00.000Z', files: [], database: { state: 'not_configured' }, partial: false } }) },
    noticeService: {
      debtNotices: async () => ({ asOf: '2026-11-01', rows: [] }),
      welcomeNotice: async () => ({ memberId: 'm1', recipient: 'member', recipientName: 'A B', link: null, numberIssue: true }),
    },
    accessService: { check: async () => ({ result: 'red', reason: 'not_found' }) },
    greetings: createGreetingBus(),
    faceService: { enroll: async () => undefined, remove: async () => undefined, discardForDeactivatedMember: async () => undefined, status: async () => ({ enrolled: false }), summary: async () => ({ enrolled: 0 }), recognize: async () => ({ result: 'red', reason: 'not_recognized' }) },
    rosterService: createRosterService({ memberships: memberships.service, members: members.service, disciplines: disciplines.service }),
  }));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const role of roles) cookies[role] = await signIn(baseUrl, role);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const cleanup of cleanups) await cleanup();
});

function call(method: string, path: string, cookie?: string) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: method === 'GET' || method === 'DELETE' ? undefined : '{}',
  });
}

describe('route authorization matrix', () => {
  it.each(routes)('%s %s answers 401 without a session', async (method, path) => {
    const response = await call(method, path);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Authentication required' });
  });

  for (const role of roles) {
    it.each(routes)(`${role}: %s %s`, async (method, path, allowed) => {
      const response = await call(method, path, cookies[role]);
      if (allowed.includes(role)) {
        expect([401, 403]).not.toContain(response.status);
        // An event stream never ends on its own; close it so the server can shut down.
        await response.body?.cancel().catch(() => undefined);
      } else {
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: 'Forbidden' });
      }
    });
  }

  it('keeps /health and /auth public', async () => {
    expect((await call('GET', '/health')).status).toBe(200);
    expect((await call('GET', '/auth/me')).status).toBe(401);
    expect((await call('GET', '/auth/me', cookies.teacher)).status).toBe(200);
  });
});
