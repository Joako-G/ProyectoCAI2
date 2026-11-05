import { describe, expect, it, vi } from 'vitest';
import { createAccessService, type AccessMember } from '../../src/modules/access/access.service.js';
import type { Membership } from '../../src/modules/memberships/membership.types.js';
import { DEFAULT_PRORATION_RULE, DEFAULT_SURCHARGE_TIERS, DEFAULT_TARIFF } from '../../src/modules/payments/pricing.js';
import type { Payment } from '../../src/modules/payments/payment.types.js';
import type { PricingConfig } from '../../src/modules/payments/pricing-config.types.js';

/** 2026-11-01 in the club time zone: November is the current month. */
const TODAY = new Date('2026-11-01T15:00:00Z');
const config: PricingConfig = {
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

function setup(members: AccessMember[], memberships: Membership[], payments: Payment[] = []) {
  const ports = {
    members: { list: vi.fn(async () => members) },
    memberships: { list: vi.fn(async () => memberships) },
    payments: { list: vi.fn(async () => payments) },
    pricing: { get: vi.fn(async () => config) },
  };
  return { service: createAccessService({ ...ports, now: () => TODAY }), ports };
}

describe('access check', () => {
  it('lets an up-to-date member in (green)', async () => {
    const { service } = setup([member('ok', '30111222')], [membership('ok', '2026-11-01')], [paidNovember('ok')]);
    expect(await service.check('30111222')).toEqual({
      result: 'green',
      reason: 'up_to_date',
      member: { memberNumber: 'N-ok', name: 'ok Prueba', unpaidPeriodCount: 0, paidThrough: '2026-11' },
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
