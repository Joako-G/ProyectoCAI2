import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createApp } from '../../src/app.js';
import type { ReportService } from '../../src/modules/reports/report.service.js';
import type { Role } from '../../src/modules/users/user.types.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { listenOnFetchSafePort } from '../helpers/listen.mjs';
import { createTestContext, incomeEntry } from '../cashcount/helpers.js';

let baseUrl: string;
let server: Server;
let revenue: Mock<ReportService['revenue']>;
let disciplineSettlement: Mock<ReportService['disciplineSettlement']>;
let disciplineIncome: Mock<ReportService['disciplineIncome']>;
const cookies = {} as Record<Role, string>;
const cleanups: Array<() => Promise<void>> = [];

beforeEach(async () => {
  const users = await createUsersFile();
  const context = await createTestContext([
    incomeEntry({ receiptNumber: 1, amount: 1000 }),
    incomeEntry({ receiptNumber: 2, concept: 'activityFee', disciplineId: 'basket', amount: 3000 }),
  ]);
  cleanups.push(users.cleanup, context.cleanup);
  // Spies over the real service prove a rejected request never reaches it.
  revenue = vi.fn(context.reports.revenue);
  disciplineSettlement = vi.fn(context.reports.disciplineSettlement);
  disciplineIncome = vi.fn(context.reports.disciplineIncome);
  server = await listenOnFetchSafePort(createApp({ storePath: users.storePath, reportService: { revenue, disciplineSettlement, disciplineIncome } }));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const role of ['head_secretary', 'secretary', 'teacher'] as const) cookies[role] = await signIn(baseUrl, role);
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  while (cleanups.length > 0) await cleanups.pop()!();
});

const get = (path: string, role?: Role) => fetch(`${baseUrl}${path}`, { headers: role ? { cookie: cookies[role] } : {} });
const REVENUE = '/api/reports/revenue?granularity=daily&date=2026-10-05';
const INCOME = '/api/reports/discipline-income?from=2026-09&to=2026-10';
const SETTLEMENT = '/api/reports/discipline-settlement?period=2026-10&disciplineId=basket';

describe('reports API: authorization', () => {
  it.each([[REVENUE], [SETTLEMENT], [INCOME]])('answers 401 without a session and 403 to a teacher on %s, without calling the service', async (path) => {
    expect((await get(path)).status).toBe(401);
    expect((await get(path, 'teacher')).status).toBe(403);
    expect(revenue).not.toHaveBeenCalled();
    expect(disciplineSettlement).not.toHaveBeenCalled();
    expect(disciplineIncome).not.toHaveBeenCalled();
  });

  it.each([[REVENUE], [SETTLEMENT], [INCOME]])('lets the secretary and the head secretary read %s', async (path) => {
    expect((await get(path, 'secretary')).status).toBe(200);
    expect((await get(path, 'head_secretary')).status).toBe(200);
  });

  it('offers no way to write: other methods find no route', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = await fetch(`${baseUrl}/api/reports/revenue`, { method, headers: { cookie: cookies.head_secretary, 'content-type': 'application/json' }, body: method === 'DELETE' ? undefined : '{}' });
      expect(response.status).toBe(404);
    }
  });
});

describe('reports API: revenue', () => {
  it('returns the revenue of the day with its breakdown', async () => {
    const response = await get(REVENUE, 'secretary');

    expect(await response.json()).toMatchObject({
      granularity: 'daily',
      from: '2026-10-05',
      to: '2026-10-05',
      total: 4000,
      byConcept: [{ concept: 'socialFee', total: 1000 }, { concept: 'activityFee', total: 3000 }],
      annulled: { count: 0, total: 0 },
    });
  });

  it.each([
    ['/api/reports/revenue?granularity=yearly&date=2026-10-05', 'granularity'],
    ['/api/reports/revenue?granularity=daily', 'date'],
    ['/api/reports/revenue?granularity=daily&date=2026-02-30', 'date'],
    ['/api/reports/revenue?granularity=daily&date=a&date=b', 'date'],
    ['/api/reports/revenue', 'granularity'],
  ])('answers 400 naming the field for %s', async (path, field) => {
    const response = await get(path, 'secretary');

    expect(response.status).toBe(400);
    expect(Object.keys((await response.json()).fieldErrors)).toContain(field);
  });
});

describe('reports API: discipline settlement', () => {
  it('lists name, member number and month with the fee and surcharge totals, and no DNI', async () => {
    const response = await get(SETTLEMENT, 'secretary');
    const body = await response.json();

    expect(body).toEqual({
      period: '2026-10',
      discipline: { id: 'basket', name: 'Básquet' },
      students: [{ memberNumber: '0001', fullName: 'Lucía Pérez', period: '2026-10' }],
      feeTotal: 3000,
      surchargeTotal: 0,
    });
    expect(JSON.stringify(body)).not.toMatch(/dni/i);
  });

  it('answers 404 for an unknown discipline and 400 for a bad month or a missing discipline', async () => {
    expect((await get('/api/reports/discipline-settlement?period=2026-10&disciplineId=chess', 'secretary')).status).toBe(404);
    expect((await get('/api/reports/discipline-settlement?period=2026-13&disciplineId=basket', 'secretary')).status).toBe(400);
    const missing = await get('/api/reports/discipline-settlement?period=2026-10', 'secretary');
    expect(missing.status).toBe(400);
    expect(Object.keys((await missing.json()).fieldErrors)).toContain('disciplineId');
  });
});

describe('reports API: discipline income', () => {
  it('returns what each discipline took in over the months asked for', async () => {
    const response = await get(INCOME, 'secretary');

    expect(await response.json()).toEqual({
      from: '2026-09',
      to: '2026-10',
      months: ['2026-09', '2026-10'],
      total: 3000,
      disciplines: [{ id: 'basket', name: 'Básquet', total: 3000, fees: 3000, surcharges: 0, byMonth: [0, 3000] }],
    });
  });

  it.each([
    ['/api/reports/discipline-income?from=2026-13&to=2026-10', 'from'],
    ['/api/reports/discipline-income?from=2026-09', 'to'],
    ['/api/reports/discipline-income?from=2026-10&to=2026-09', 'to'],
    ['/api/reports/discipline-income?from=2024-01&to=2026-10', 'to'],
    ['/api/reports/discipline-income?from=2026-09&from=2026-08&to=2026-10', 'from'],
  ])('answers 400 naming the field for %s', async (path, field) => {
    const response = await get(path, 'secretary');

    expect(response.status).toBe(400);
    expect(Object.keys((await response.json()).fieldErrors)).toContain(field);
  });
});
