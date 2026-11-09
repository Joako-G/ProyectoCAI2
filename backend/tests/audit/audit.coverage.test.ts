import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AuditRepository } from '../../src/modules/audit/audit.repository.js';
import { createAuditService } from '../../src/modules/audit/audit.service.js';
import type { AuditEntry } from '../../src/modules/audit/audit.types.js';
import { createBackupService } from '../../src/modules/backup/backup.service.js';
import { createJsonAuditRepository } from '../../src/modules/audit/json-audit.repository.js';
import { createCashCountService } from '../../src/modules/cashcount/cashcount.service.js';
import { createExpenseService } from '../../src/modules/expenses/expense.service.js';
import { createJsonExpenseRepository } from '../../src/modules/expenses/json-expense.repository.js';
import { createFaceService } from '../../src/modules/faces/face.service.js';
import { createJsonCashCountRepository } from '../../src/modules/cashcount/json-cashcount.repository.js';
import { createJsonDisciplineRepository } from '../../src/modules/disciplines/json-discipline.repository.js';
import { createDisciplineService } from '../../src/modules/disciplines/discipline.service.js';
import { createJsonMemberRepository } from '../../src/modules/members/json-member.repository.js';
import { createMemberService } from '../../src/modules/members/member.service.js';
import { createJsonMembershipRepository } from '../../src/modules/memberships/json-membership.repository.js';
import { createMembershipService } from '../../src/modules/memberships/membership.service.js';
import { createJsonPaymentRepository } from '../../src/modules/payments/json-payment.repository.js';
import { createJsonPricingConfigRepository } from '../../src/modules/payments/json-pricing-config.repository.js';
import { createPaymentService } from '../../src/modules/payments/payment.service.js';
import { createPricingConfigService } from '../../src/modules/payments/pricing-config.service.js';
import { createPaymentIncomeSource } from '../../src/modules/reports/income.source.js';
import { createReportService } from '../../src/modules/reports/report.service.js';
import { createFakeFaceRepository, descriptor } from '../faces/helpers.js';
import { UserRepository } from '../../src/modules/users/user.repository.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { routes } from '../authorization/routes.js';

const TODAY = new Date('2026-10-05T15:00:00Z');

// Routes that are not reads but write nothing: they only compute a preview.
const WRITES_NOTHING = ['POST /api/payments/preview', 'POST /api/payments/enrollment-preview'];

// Routes that write, but into their own record instead of the audit log. An entrance check is written to the
// entry log (access_entries) with who passed, how, the result and the staff member: that log is the record, and
// an audit entry per entrance would only repeat it as noise. A route may join this list only when it keeps such
// a record of its own and the reason is written here.
const SELF_LOGGING = ['POST /api/access/check', 'POST /api/faces/recognize'];

// Free text and personal data the scenarios send. None of it may reach the audit file.
const FORBIDDEN = ['Se mudó de ciudad', 'Cobro duplicado', 'Faltó vuelto', 'Nora Díaz', 'nora@club.test', 'Passw0rd-Long-1', 'Another-Pass-2', 'passwordHash', '3000000', '0.4242424242'];

interface ApiResponse {
  status: number;
  body: { id?: string } & Record<string, unknown>;
}

interface Api {
  call(method: string, path: string, body?: unknown): Promise<ApiResponse>;
  entries(): Promise<AuditEntry[]>;
}

type Expected = Pick<AuditEntry, 'action' | 'entityType' | 'entityId' | 'changedFields'>;

interface Prepared {
  send(): Promise<ApiResponse>;
  expected(response: ApiResponse): Expected;
}

let sequence = 0;
const next = () => ++sequence;

async function createDiscipline(api: Api): Promise<string> {
  const { body } = await api.call('POST', '/api/disciplines', { name: `Disciplina ${next()}`, teachers: ['Marcos Ledesma'], leadTeacher: 'Marcos Ledesma' });
  return body.id!;
}

function memberBody(disciplineId: string, overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Lucía',
    lastName: 'Ríos',
    dni: String(30_000_000 + next()),
    birthDate: '1990-03-15',
    category: 'Mayor',
    memberSince: '2015-02-01',
    whatsapp: '1155551234',
    disciplineIds: [disciplineId],
    ...overrides,
  };
}

async function createMember(api: Api): Promise<{ id: string; body: ReturnType<typeof memberBody> }> {
  const body = memberBody(await createDiscipline(api));
  return { id: (await api.call('POST', '/api/members', body)).body.id!, body };
}

async function createPayment(api: Api): Promise<string> {
  const { id } = await createMember(api);
  const response = await api.call('POST', '/api/payments', { memberId: id, concepts: [{ kind: 'socialFee', period: '2026-10' }], method: 'cash', requestId: `request-${next()}` });
  expect(response.status).toBe(201);
  return response.body.id!;
}

async function createUser(api: Api): Promise<string> {
  const response = await api.call('POST', '/users', { name: 'Nora Díaz', email: `nora${next()}@club.test`, role: 'secretary', password: 'Passw0rd-Long-1' });
  expect(response.status).toBe(201);
  return response.body.id!;
}

const TARIFF = { enrollment: 1, socialFee: 2, activityFee: 3, carnetReplacement: 4 };

/** One successful call for every write route, with the entry it must leave. Keyed like the route matrix. */
const scenarios: Record<string, (api: Api) => Promise<Prepared>> = {
  'POST /users': async (api) => ({
    send: () => api.call('POST', '/users', { name: 'Nora Díaz', email: `nora${next()}@club.test`, role: 'secretary', password: 'Passw0rd-Long-1' }),
    expected: (response) => ({ action: 'create', entityType: 'user', entityId: response.body.id!, changedFields: [] }),
  }),
  'PATCH /users/missing': async (api) => {
    const id = await createUser(api);
    return {
      send: () => api.call('PATCH', `/users/${id}`, { name: 'Nora D.', password: 'Another-Pass-2' }),
      expected: () => ({ action: 'update', entityType: 'user', entityId: id, changedFields: ['name', 'password'] }),
    };
  },
  'DELETE /users/missing': async (api) => {
    const id = await createUser(api);
    return { send: () => api.call('DELETE', `/users/${id}`), expected: () => ({ action: 'deactivate', entityType: 'user', entityId: id, changedFields: [] }) };
  },
  'POST /api/members': async (api) => {
    const disciplineId = await createDiscipline(api);
    return {
      send: () => api.call('POST', '/api/members', memberBody(disciplineId)),
      expected: (response) => ({ action: 'create', entityType: 'member', entityId: response.body.id!, changedFields: [] }),
    };
  },
  'PUT /api/members/missing': async (api) => {
    const { id, body } = await createMember(api);
    return {
      send: () => api.call('PUT', `/api/members/${id}`, { ...body, whatsapp: '1155559999', category: 'Vitalicia' }),
      expected: () => ({ action: 'update', entityType: 'member', entityId: id, changedFields: ['category', 'whatsapp'] }),
    };
  },
  'POST /api/members/missing/deactivate': async (api) => {
    const { id } = await createMember(api);
    return {
      send: () => api.call('POST', `/api/members/${id}/deactivate`, { reason: 'Se mudó de ciudad' }),
      expected: () => ({ action: 'deactivate', entityType: 'member', entityId: id, changedFields: [] }),
    };
  },
  'POST /api/members/missing/reactivate': async (api) => {
    const { id } = await createMember(api);
    await api.call('POST', `/api/members/${id}/deactivate`, { reason: 'Se mudó de ciudad' });
    return { send: () => api.call('POST', `/api/members/${id}/reactivate`), expected: () => ({ action: 'reactivate', entityType: 'member', entityId: id, changedFields: [] }) };
  },
  'POST /api/disciplines': async (api) => ({
    send: () => api.call('POST', '/api/disciplines', { name: `Disciplina ${next()}`, teachers: ['Carla Ibarra'], leadTeacher: 'Carla Ibarra' }),
    expected: (response) => ({ action: 'create', entityType: 'discipline', entityId: response.body.id!, changedFields: [] }),
  }),
  'PUT /api/disciplines/missing': async (api) => {
    const id = await createDiscipline(api);
    return {
      send: () => api.call('PUT', `/api/disciplines/${id}`, { name: `Renombrada ${next()}`, teachers: ['Marcos Ledesma'], leadTeacher: 'Marcos Ledesma' }),
      expected: () => ({ action: 'update', entityType: 'discipline', entityId: id, changedFields: ['name'] }),
    };
  },
  'POST /api/disciplines/missing/deactivate': async (api) => {
    const id = await createDiscipline(api);
    return {
      send: () => api.call('POST', `/api/disciplines/${id}/deactivate`),
      expected: () => ({ action: 'deactivate', entityType: 'discipline', entityId: id, changedFields: [] }),
    };
  },
  'POST /api/disciplines/missing/reactivate': async (api) => {
    const id = await createDiscipline(api);
    await api.call('POST', `/api/disciplines/${id}/deactivate`);
    return {
      send: () => api.call('POST', `/api/disciplines/${id}/reactivate`),
      expected: () => ({ action: 'reactivate', entityType: 'discipline', entityId: id, changedFields: [] }),
    };
  },
  'POST /api/pricing/tariffs': async (api) => ({
    send: () => api.call('POST', '/api/pricing/tariffs', { effectiveFrom: '2027-03', ...TARIFF }),
    expected: () => ({ action: 'create', entityType: 'tariff', entityId: '2027-03', changedFields: [] }),
  }),
  'PUT /api/pricing/tariffs/2030-01': async (api) => {
    await api.call('POST', '/api/pricing/tariffs', { effectiveFrom: '2027-04', ...TARIFF });
    return {
      send: () => api.call('PUT', '/api/pricing/tariffs/2027-04', { ...TARIFF, socialFee: 99 }),
      expected: () => ({ action: 'update', entityType: 'tariff', entityId: '2027-04', changedFields: ['socialFee'] }),
    };
  },
  'DELETE /api/pricing/tariffs/2030-01': async (api) => {
    await api.call('POST', '/api/pricing/tariffs', { effectiveFrom: '2027-05', ...TARIFF });
    return { send: () => api.call('DELETE', '/api/pricing/tariffs/2027-05'), expected: () => ({ action: 'delete', entityType: 'tariff', entityId: '2027-05', changedFields: [] }) };
  },
  'PUT /api/pricing/surcharge-tiers': async (api) => ({
    send: () => api.call('PUT', '/api/pricing/surcharge-tiers', [{ fromDay: 1, amount: 0 }]),
    expected: () => ({ action: 'update', entityType: 'surcharge_tiers', entityId: 'surcharge_tiers', changedFields: ['surchargeTiers'] }),
  }),
  'PUT /api/pricing/proration-rule': async (api) => ({
    send: () => api.call('PUT', '/api/pricing/proration-rule', { afterDay: 20, activityPercent: 50 }),
    expected: () => ({ action: 'update', entityType: 'proration_rule', entityId: 'proration_rule', changedFields: ['afterDay'] }),
  }),
  'POST /api/payments': async (api) => {
    const { id } = await createMember(api);
    return {
      send: () => api.call('POST', '/api/payments', { memberId: id, concepts: [{ kind: 'socialFee', period: '2026-10' }], method: 'cash', requestId: `request-${next()}` }),
      expected: (response) => ({ action: 'create', entityType: 'payment', entityId: response.body.id!, changedFields: [] }),
    };
  },
  'POST /api/payments/missing/annul': async (api) => {
    const id = await createPayment(api);
    return {
      send: () => api.call('POST', `/api/payments/${id}/annul`, { reason: 'Cobro duplicado' }),
      expected: () => ({ action: 'annul', entityType: 'payment', entityId: id, changedFields: [] }),
    };
  },
  'POST /api/cashcount': async (api) => ({
    send: () => api.call('POST', '/api/cashcount', { countedCash: 0, varianceNote: 'Faltó vuelto' }),
    expected: (response) => ({ action: 'close', entityType: 'cash_count', entityId: response.body.id!, changedFields: [] }),
  }),
  'POST /api/expenses': async (api) => ({
    send: () => api.call('POST', '/api/expenses', { date: '2026-10-05', amount: 3000, category: 'other', description: 'Compra de librería' }),
    expected: (response) => ({ action: 'create', entityType: 'expense', entityId: response.body.id!, changedFields: [] }),
  }),
  'POST /api/backups': async (api) => ({
    send: () => api.call('POST', '/api/backups'),
    expected: (response) => ({ action: 'create', entityType: 'backup', entityId: response.body.name as string, changedFields: [] }),
  }),
  'PUT /api/faces/missing': async (api) => {
    const { id } = await createMember(api);
    return {
      send: () => api.call('PUT', `/api/faces/${id}`, { descriptor: descriptor(), consent: true }),
      expected: () => ({ action: 'create', entityType: 'face_profile', entityId: id, changedFields: [] }),
    };
  },
  'DELETE /api/faces/missing': async (api) => {
    const { id } = await createMember(api);
    await api.call('PUT', `/api/faces/${id}`, { descriptor: descriptor(), consent: true });
    return { send: () => api.call('DELETE', `/api/faces/${id}`), expected: () => ({ action: 'delete', entityType: 'face_profile', entityId: id, changedFields: [] }) };
  },
};

const servers: Server[] = [];
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  while (servers.length > 0) await new Promise<void>((resolve) => servers.pop()!.close(() => resolve()));
  while (cleanups.length > 0) await cleanups.pop()!();
});

/** The whole application over temporary files, wired like server.ts, sharing one audit service. */
async function startApp(failingAudit = false) {
  const users = await createUsersFile();
  const dir = await mkdtemp(join(tmpdir(), 'audit-coverage-'));
  cleanups.push(users.cleanup, () => rm(dir, { recursive: true, force: true }));
  const now = () => TODAY;
  const userRepository = new UserRepository(users.storePath);
  const auditFile = join(dir, 'audit.json');
  const failing: AuditRepository = { append: async () => { throw new Error('audit disk full'); }, list: async () => [] };
  const auditService = createAuditService({
    repository: failingAudit ? failing : createJsonAuditRepository(auditFile),
    actors: { find: (id) => userRepository.list().find((user) => user.id === id) },
    now,
  });
  const disciplineService = createDisciplineService({ repository: createJsonDisciplineRepository(join(dir, 'disciplines.json')), audit: auditService, now });
  const membershipService = createMembershipService({ repository: createJsonMembershipRepository(join(dir, 'memberships.json')), now });
  const memberService = createMemberService({
    repository: createJsonMemberRepository(join(dir, 'members.json')),
    disciplineLookup: disciplineService,
    disciplineHistory: { onDisciplinesChanged: (memberId, disciplineIds, date) => membershipService.syncMember(memberId, disciplineIds, date) },
    audit: auditService,
    now,
  });
  const pricingConfigService = createPricingConfigService({ repository: createJsonPricingConfigRepository(join(dir, 'pricing.json')), audit: auditService, now });
  const paymentRepository = createJsonPaymentRepository(join(dir, 'payments.json'));
  const paymentService = createPaymentService({ repository: paymentRepository, members: memberService, memberships: membershipService, pricing: pricingConfigService, audit: auditService, now });
  const reportService = createReportService({ income: createPaymentIncomeSource(paymentRepository), members: memberService, disciplines: disciplineService });
  const cashCountService = createCashCountService({ repository: createJsonCashCountRepository(join(dir, 'cashcounts.json')), revenue: reportService, audit: auditService, now });
  const expenseService = createExpenseService({ repository: createJsonExpenseRepository(join(dir, 'expenses.json')), audit: auditService, now });
  // One real source file; the clock is fixed, so a second copy in the same second is refused.
  await writeFile(join(dir, 'sample.json'), '[]');
  // A configured destination must exist before a copy.
  await mkdir(join(dir, 'backups'));
  const backupService = createBackupService({
    sources: [{ name: 'sample.json', path: join(dir, 'sample.json') }],
    destination: join(dir, 'backups'),
    isDefaultDestination: false,
    audit: auditService,
    now,
  });
  const faceService = createFaceService({
    repository: createFakeFaceRepository().repository,
    members: memberService,
    access: { checkMember: async () => ({ result: 'red', reason: 'not_found' }) },
    audit: auditService,
    now,
  });
  const server = createApp({
    storePath: users.storePath,
    userRepository,
    memberService,
    disciplineService,
    membershipService,
    pricingConfigService,
    paymentService,
    reportService,
    cashCountService,
    expenseService,
    backupService,
    faceService,
    auditService,
  }).listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const cookie = await signIn(baseUrl, 'head_secretary');
  const call: Api['call'] = async (method, path, body) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : {} };
  };
  const api: Api = { call, entries: async () => ((await call('GET', '/api/audit')).body as unknown as { entries: AuditEntry[] }).entries };
  return { api, auditFile, userId: 'user-head_secretary' };
}

describe('audit coverage of the write routes', () => {
  const writeRoutes = routes.filter(([method]) => method !== 'GET').map(([method, path]) => `${method} ${path}`);

  it('has a scenario for every write route in the route matrix, so a new route cannot skip the audit', () => {
    const audited = writeRoutes.filter((route) => !WRITES_NOTHING.includes(route) && !SELF_LOGGING.includes(route));
    expect(Object.keys(scenarios).sort()).toEqual(audited.sort());
    for (const route of [...WRITES_NOTHING, ...SELF_LOGGING]) expect(writeRoutes).toContain(route);
    // A route cannot be exempt from the audit and also have an audited scenario.
    for (const route of [...WRITES_NOTHING, ...SELF_LOGGING]) expect(Object.keys(scenarios)).not.toContain(route);
  });

  it.each(Object.keys(scenarios))('%s leaves exactly one entry naming the actor and the record, and a failed call leaves none', async (route) => {
    const { api } = await startApp();
    const prepared = await scenarios[route]!(api);
    const before = await api.entries();

    const response = await prepared.send();
    expect(response.status, JSON.stringify(response.body)).toBeLessThan(300);
    const after = await api.entries();
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toMatchObject({ ...prepared.expected(response), actor: { id: 'user-head_secretary', name: 'Test head_secretary', role: 'head_secretary' } });
    expect(after.slice(1)).toEqual(before);

    const [method, path] = route.split(' ') as [string, string];
    const failed = await api.call(method, path, method === 'GET' || method === 'DELETE' ? undefined : {});
    expect(failed.status).toBeGreaterThanOrEqual(400);
    expect(await api.entries()).toEqual(after);
  });

  it('keeps the change and logs an error when the audit write fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { api } = await startApp(true);
    for (const [route, scenario] of Object.entries(scenarios)) {
      const prepared = await scenario(api);
      const response = await prepared.send();
      expect(response.status, route).toBeLessThan(300);
    }
    expect(error.mock.calls.length).toBeGreaterThanOrEqual(Object.keys(scenarios).length);
    // The members created while the audit was failing are still there.
    expect((await api.call('GET', '/api/members')).body).not.toHaveLength(0);
  });

  it('never stores reasons, notes, passwords, hashes, names, emails or DNIs', async () => {
    const { api, auditFile } = await startApp();
    for (const scenario of Object.values(scenarios)) await (await scenario(api)).send();
    const stored = await readFile(auditFile, 'utf8');
    expect(JSON.parse(stored).length).toBeGreaterThan(Object.keys(scenarios).length);
    for (const forbidden of FORBIDDEN) expect(stored, forbidden).not.toContain(forbidden);
  });

  it('records a repeated payment request once, because the replay writes nothing', async () => {
    const { api } = await startApp();
    const { id } = await createMember(api);
    const body = { memberId: id, concepts: [{ kind: 'socialFee', period: '2026-10' }], method: 'cash', requestId: 'request-replay-1' };
    const first = await api.call('POST', '/api/payments', body);
    const before = await api.entries();
    const replay = await api.call('POST', '/api/payments', body);
    expect(replay.body.id).toBe(first.body.id);
    expect(await api.entries()).toEqual(before);
  });

  it('records only the fields a member update changed, never system timestamps', async () => {
    const { api } = await startApp();
    const { id, body } = await createMember(api);
    await api.call('PUT', `/api/members/${id}`, body);
    expect((await api.entries())[0]).toMatchObject({ action: 'update', entityId: id, changedFields: [] });
  });
});
