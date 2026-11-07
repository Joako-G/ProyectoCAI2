import { describe, expect, it, vi } from 'vitest';
import { createAccessService, type AccessMember } from '../../src/modules/access/access.service.js';
import type { Membership } from '../../src/modules/memberships/membership.types.js';
import { DEFAULT_PRORATION_RULE, DEFAULT_SURCHARGE_TIERS, DEFAULT_TARIFF } from '../../src/modules/payments/pricing.js';
import type { Payment } from '../../src/modules/payments/payment.types.js';
import type { PricingConfig } from '../../src/modules/payments/pricing-config.types.js';

/** 2026-11-01 in the club time zone: November is the current month. */
const TODAY = new Date('2026-11-01T15:00:00Z');
const defaultConfig: PricingConfig = {
  tariffs: [DEFAULT_TARIFF],
  surchargeTiers: [...DEFAULT_SURCHARGE_TIERS],
  prorationRule: DEFAULT_PRORATION_RULE,
};

function member(id: string, dni: string, overrides: Partial<AccessMember> = {}): AccessMember {
  return { id, memberNumber: `N-${id}`, firstName: id, lastName: 'Prueba', dni, status: 'active', ...overrides };
}

function membership(memberId: string, startDate: string, endDate?: string): Membership {
  return {
    id: `${memberId}-${startDate}`,
    memberId,
    disciplineId: 'basket',
    startDate,
    status: endDate ? 'ended' : 'active',
    ...(endDate ? { endDate } : {}),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function paidMonths(memberId: string, ...periods: string[]): Payment {
  return {
    id: `pay-${memberId}`,
    receiptNumber: 1,
    memberId,
    method: 'cash',
    paymentDate: '2026-11-01',
    lines: periods.flatMap((period) => [
      { kind: 'socialFee' as const, period, amount: 20000 },
      { kind: 'activityFee' as const, period, disciplineId: 'basket', amount: 20000 },
    ]),
    total: 40000 * periods.length,
    createdBy: 'user',
    createdAt: '2026-11-01T15:00:00.000Z',
  };
}

const paidNovember = (memberId: string) => paidMonths(memberId, '2026-11');

function setup(members: AccessMember[], memberships: Membership[], payments: Payment[] = [], config: PricingConfig = defaultConfig) {
  const ports = {
    members: { list: vi.fn(async () => members) },
    memberships: { list: vi.fn(async () => memberships) },
    payments: { list: vi.fn(async () => payments) },
    pricing: { get: vi.fn(async () => config) },
  };
  return { service: createAccessService({ ...ports, now: () => TODAY }), ports };
}

describe('access check due date', () => {
  const upToDate = (config: PricingConfig, ...periods: string[]) =>
    setup([member('ok', '30111222')], [membership('ok', '2026-11-01')], [paidMonths('ok', ...periods)], config).service.check('30111222');

  it('gives the last day without surcharge of the first unpaid month, with the default tiers', async () => {
    const answer = await upToDate(defaultConfig, '2026-11', '2026-12');
    expect(answer.member).toMatchObject({ paidThrough: '2026-12', dueDate: '2027-01-10' });
  });

  it('follows a tier change that starts on another day', async () => {
    const later = { ...defaultConfig, surchargeTiers: [{ fromDay: 1, amount: 0 }, { fromDay: 16, amount: 4000 }] };
    expect((await upToDate(later, '2026-11')).member).toMatchObject({ paidThrough: '2026-11', dueDate: '2026-12-15' });
  });

  it('clamps to the length of a short month', async () => {
    const late = { ...defaultConfig, surchargeTiers: [{ fromDay: 1, amount: 0 }, { fromDay: 31, amount: 4000 }] };
    expect((await upToDate(late, '2026-11', '2026-12', '2027-01')).member).toMatchObject({ paidThrough: '2027-01', dueDate: '2027-02-28' });
  });

  it('uses the last day of the month when no tier ever charges a surcharge', async () => {
    const free = { ...defaultConfig, surchargeTiers: [{ fromDay: 1, amount: 0 }, { fromDay: 11, amount: 0 }] };
    expect((await upToDate(free, '2026-11')).member).toMatchObject({ paidThrough: '2026-11', dueDate: '2026-12-31' });
  });

  it('gives no due date when nothing falls due', async () => {
    const { service } = setup([member('free', '30111222')], []);
    expect((await service.check('30111222')).member).not.toHaveProperty('dueDate');
  });

  it('gives no due date to a debtor', async () => {
    const { service } = setup([member('one', '30111222')], [membership('one', '2026-11-01')]);
    expect((await service.check('30111222')).member).not.toHaveProperty('dueDate');
  });
});

describe('access check', () => {
  it('lets an up-to-date member in (green)', async () => {
    const { service } = setup([member('ok', '30111222')], [membership('ok', '2026-11-01')], [paidNovember('ok')]);
    expect(await service.check('30111222')).toEqual({
      result: 'green',
      reason: 'up_to_date',
      member: { memberNumber: 'N-ok', name: 'ok Prueba', unpaidPeriodCount: 0, paidThrough: '2026-11', dueDate: '2026-12-10' },
    });
  });

  it('lets a member owing one month in with a warning (yellow)', async () => {
    const { service } = setup([member('one', '30111222')], [membership('one', '2026-11-01')]);
    expect(await service.check('30111222')).toEqual({
      result: 'yellow',
      reason: 'debtor',
      member: { memberNumber: 'N-one', name: 'one Prueba', unpaidPeriodCount: 1, debtSince: '2026-11' },
    });
  });

  it('still lets a member owing three months in (yellow)', async () => {
    const { service } = setup([member('three', '30111222')], [membership('three', '2026-09-01')]);
    expect(await service.check('30111222')).toMatchObject({ result: 'yellow', reason: 'debtor', member: { unpaidPeriodCount: 3, debtSince: '2026-09' } });
  });

  it('reports paid through the next month for a member who paid two months ahead', async () => {
    const { service } = setup([member('ahead', '30111222')], [membership('ahead', '2026-11-01')], [paidMonths('ahead', '2026-11', '2026-12', '2027-01')]);
    const answer = await service.check('30111222');
    expect(answer.member).toMatchObject({ unpaidPeriodCount: 0, paidThrough: '2027-01' });
    expect(answer.member).not.toHaveProperty('debtSince');
  });

  it('shows no paid-through month when nothing falls due within a year', async () => {
    const { service } = setup([member('free', '30111222')], []);
    const answer = await service.check('30111222');
    expect(answer.result).toBe('green');
    expect(answer.member).not.toHaveProperty('paidThrough');
  });

  it('gives no dates for an inactive member or an unknown DNI', async () => {
    const out = member('out', '30111222', { status: 'inactive', deactivation: { date: '2026-05-10' } });
    const { service } = setup([out], [membership('out', '2026-01-01', '2026-05-31')]);
    const inactive = await service.check('30111222');
    expect(inactive.member).not.toHaveProperty('paidThrough');
    expect(inactive.member).not.toHaveProperty('debtSince');
    expect(await service.check('29999999')).toEqual({ result: 'red', reason: 'not_found' });
  });

  it('keeps a deregistered member out (red)', async () => {
    const { service } = setup([member('gone', '30111222')], [membership('gone', '2026-06-01')]);
    expect(await service.check('30111222')).toEqual({
      result: 'red',
      reason: 'deregistered',
      member: { memberNumber: 'N-gone', name: 'gone Prueba', unpaidPeriodCount: 6, debtSince: '2026-06' },
    });
  });

  it('keeps an inactive member out (red)', async () => {
    const out = member('out', '30111222', { status: 'inactive', deactivation: { date: '2026-05-10' } });
    const { service } = setup([out], [membership('out', '2026-01-01', '2026-05-31')]);
    expect(await service.check('30111222')).toMatchObject({ result: 'red', reason: 'inactive', member: { memberNumber: 'N-out' } });
  });

  it('answers red with no member data for an unknown DNI', async () => {
    const { service } = setup([member('ok', '30111222')], []);
    const answer = await service.check('29999999');
    expect(answer).toEqual({ result: 'red', reason: 'not_found' });
    expect(JSON.stringify(answer)).not.toContain('29999999');
  });

  it('never carries amounts or the DNI in a member answer', async () => {
    const { service } = setup([member('one', '30111222')], [membership('one', '2026-10-01')]);
    const text = JSON.stringify(await service.check('30111222'));
    expect(text).not.toContain('30111222');
    expect(text).not.toMatch(/total|amount|\$/i);
  });

  it('reads each source once per check', async () => {
    const { service, ports } = setup([member('one', '30111222'), member('two', '30111333')], [membership('one', '2026-10-01')]);
    await service.check('30111222');
    for (const port of Object.values(ports)) expect(Object.values(port)[0]).toHaveBeenCalledTimes(1);
  });
});

describe('access checkMember', () => {
  it('answers exactly like the DNI check for the same member', async () => {
    const { service } = setup([member('one', '30111222')], [membership('one', '2026-10-01')], [paidMonths('one', '2026-10', '2026-11')]);
    expect(await service.checkMember('one')).toEqual(await service.check('30111222'));
  });

  it('answers red not_found for an unknown member id', async () => {
    const { service } = setup([member('one', '30111222')], []);
    expect(await service.checkMember('nobody')).toEqual({ result: 'red', reason: 'not_found' });
  });

  it('answers red inactive for an inactive member', async () => {
    const { service } = setup([member('one', '30111222', { status: 'inactive' })], []);
    expect(await service.checkMember('one')).toMatchObject({ result: 'red', reason: 'inactive' });
  });

  it('reads each source once per check', async () => {
    const { service, ports } = setup([member('one', '30111222')], [membership('one', '2026-10-01')]);
    await service.checkMember('one');
    for (const port of Object.values(ports)) expect(Object.values(port)[0]).toHaveBeenCalledTimes(1);
  });
});

describe('access entrance registration', () => {
  function withEntrance(members: AccessMember[], memberships: Membership[] = [], payments: Payment[] = []) {
    const entrance = { register: vi.fn(async (_input: unknown) => undefined) };
    const ports = {
      members: { list: vi.fn(async () => members) },
      memberships: { list: vi.fn(async () => memberships) },
      payments: { list: vi.fn(async () => payments) },
      pricing: { get: vi.fn(async () => defaultConfig) },
    };
    return { entrance, service: createAccessService({ ...ports, entrance, now: () => TODAY }) };
  }

  it('registers a DNI check with the member id, the first name, the answer, the method and the staff member', async () => {
    const { service, entrance } = withEntrance([member('one', '30111222')], [membership('one', '2026-10-01')], [paidMonths('one', '2026-10', '2026-11')]);
    const answer = await service.check('30111222', { method: 'dni', actorId: 'user-1' });
    expect(entrance.register).toHaveBeenCalledWith({ member: { id: 'one', firstName: 'one' }, answer, method: 'dni', actorId: 'user-1' });
  });

  it('registers an unknown DNI without a member', async () => {
    const { service, entrance } = withEntrance([member('one', '30111222')]);
    await service.check('99999999', { method: 'dni', actorId: 'user-1' });
    expect(entrance.register).toHaveBeenCalledWith({ member: undefined, answer: { result: 'red', reason: 'not_found' }, method: 'dni', actorId: 'user-1' });
  });

  it('registers nothing when the caller gives no entrance context', async () => {
    const { service, entrance } = withEntrance([member('one', '30111222')]);
    await service.check('30111222');
    await service.checkMember('one');
    expect(entrance.register).not.toHaveBeenCalled();
  });

  it('registers a face check by member id, but not an inactive member, whom the door cannot name', async () => {
    const { service, entrance } = withEntrance([member('one', '30111222'), member('two', '30111333', { status: 'inactive' })]);
    await service.checkMember('one', { method: 'face', actorId: 'user-1' });
    await service.checkMember('two', { method: 'face', actorId: 'user-1' });
    expect(entrance.register).toHaveBeenNthCalledWith(1, expect.objectContaining({ member: { id: 'one', firstName: 'one' }, method: 'face' }));
    expect(entrance.register).toHaveBeenNthCalledWith(2, expect.objectContaining({ member: undefined, method: 'face' }));
  });

  it('registers an inactive member checked by DNI, who is identified', async () => {
    const { service, entrance } = withEntrance([member('two', '30111333', { status: 'inactive' })]);
    await service.check('30111333', { method: 'dni', actorId: 'user-1' });
    expect(entrance.register).toHaveBeenCalledWith(expect.objectContaining({ member: { id: 'two', firstName: 'two' } }));
  });
});
