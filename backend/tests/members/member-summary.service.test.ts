import { describe, expect, it, vi } from 'vitest';
import { createMemberSummaryService } from '../../src/modules/members/member-summary.service.js';
import type { Membership } from '../../src/modules/memberships/membership.types.js';
import type { AccountMember } from '../../src/modules/payments/account.js';
import { DEFAULT_PRORATION_RULE, DEFAULT_SURCHARGE_TIERS, DEFAULT_TARIFF } from '../../src/modules/payments/pricing.js';
import type { Payment } from '../../src/modules/payments/payment.types.js';
import type { PricingConfig } from '../../src/modules/payments/pricing-config.types.js';

/** 2026-11-01 in the club time zone. */
const TODAY = new Date('2026-11-01T15:00:00Z');
const config: PricingConfig = {
  tariffs: [DEFAULT_TARIFF],
  surchargeTiers: [...DEFAULT_SURCHARGE_TIERS],
  prorationRule: DEFAULT_PRORATION_RULE,
};

function member(id: string, status: AccountMember['status'] = 'active'): AccountMember {
  return { id, status };
}

function membership(memberId: string, startDate: string): Membership {
  return {
    id: `${memberId}-${startDate}`,
    memberId,
    disciplineId: 'basket',
    startDate,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function paidNovember(memberId: string): Payment {
  return {
    id: `pay-${memberId}`,
    receiptNumber: 1,
    memberId,
    method: 'cash',
    paymentDate: '2026-11-01',
    lines: [
      { kind: 'socialFee', period: '2026-11', amount: 20000 },
      { kind: 'activityFee', period: '2026-11', disciplineId: 'basket', amount: 20000 },
    ],
    total: 40000,
    createdBy: 'user',
    createdAt: '2026-11-01T15:00:00.000Z',
  };
}

function setup(members: AccountMember[], memberships: Membership[] = [], payments: Payment[] = []) {
  const ports = {
    members: { list: vi.fn(async () => members) },
    memberships: { list: vi.fn(async () => memberships) },
    payments: { list: vi.fn(async () => payments) },
    pricing: { get: vi.fn(async () => config) },
  };
  return { service: createMemberSummaryService({ ...ports, now: () => TODAY }), ports };
}

describe('member summary', () => {
  it('counts active members by standing and lists their ids', async () => {
    const { service } = setup(
      [member('paid'), member('free'), member('debtor'), member('gone')],
      // "free" has no discipline, so nothing is owed; "debtor" owes September to November; "gone" owes five months.
      [membership('paid', '2026-11-01'), membership('debtor', '2026-09-01'), membership('gone', '2026-07-01')],
      [paidNovember('paid')],
    );
    expect(await service.summary()).toEqual({
      active: 4,
      inactive: 0,
      upToDate: 2,
      debtors: 1,
      overdue: 1,
      ids: { upToDate: ['paid', 'free'], debtors: ['debtor'], overdue: ['gone'] },
    });
  });

  it('counts inactive members apart and leaves them out of every standing group', async () => {
    const { service } = setup(
      [member('active'), member('left', 'inactive')],
      [membership('active', '2026-11-01'), membership('left', '2026-01-01')],
      [paidNovember('active')],
    );
    const summary = await service.summary();
    expect(summary).toMatchObject({ active: 1, inactive: 1, upToDate: 1, debtors: 0, overdue: 0 });
    expect(summary.ids.upToDate).toEqual(['active']);
    expect(JSON.stringify(summary.ids)).not.toContain('left');
  });

  it('keeps the standing groups adding up to the active members', async () => {
    const { service } = setup(
      [member('a'), member('b'), member('c'), member('d', 'inactive')],
      [membership('b', '2026-10-01'), membership('c', '2026-05-01')],
    );
    const summary = await service.summary();
    expect(summary.upToDate + summary.debtors + summary.overdue).toBe(summary.active);
  });

  it('answers zeros for a club without members', async () => {
    const { service } = setup([]);
    expect(await service.summary()).toEqual({ active: 0, inactive: 0, upToDate: 0, debtors: 0, overdue: 0, ids: { upToDate: [], debtors: [], overdue: [] } });
  });

  it('reads each source once', async () => {
    const { service, ports } = setup([member('a'), member('b'), member('c')], [membership('a', '2026-09-01')]);
    await service.summary();
    for (const port of Object.values(ports)) expect(Object.values(port)[0]).toHaveBeenCalledTimes(1);
  });
});
