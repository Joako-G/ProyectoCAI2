import { describe, expect, it, vi } from 'vitest';
import { createNoticeService, type NoticeMember } from '../../src/modules/notices/notice.service.js';
import { createWaMeSender } from '../../src/modules/notices/notice.sender.js';
import type { Membership } from '../../src/modules/memberships/membership.types.js';
import { DEFAULT_PRORATION_RULE, DEFAULT_SURCHARGE_TIERS, DEFAULT_TARIFF } from '../../src/modules/payments/pricing.js';
import type { Payment } from '../../src/modules/payments/payment.types.js';
import type { PricingConfig } from '../../src/modules/payments/pricing-config.types.js';

/** 2026-11-01 in the club time zone: day 1 has no surcharge. */
const TODAY = new Date('2026-11-01T15:00:00Z');
const config: PricingConfig = {
  tariffs: [DEFAULT_TARIFF],
  surchargeTiers: [...DEFAULT_SURCHARGE_TIERS],
  prorationRule: DEFAULT_PRORATION_RULE,
};

function member(id: string, overrides: Partial<NoticeMember> = {}): NoticeMember {
  return {
    id,
    memberNumber: `N-${id}`,
    firstName: id,
    lastName: 'Prueba',
    whatsapp: '3815550101',
    status: 'active',
    birthDate: '1990-01-01',
    ...overrides,
  };
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

function setup(members: NoticeMember[], memberships: Membership[], payments: Payment[] = []) {
  const ports = {
    members: { list: vi.fn(async () => members) },
    memberships: { list: vi.fn(async () => memberships) },
    payments: { list: vi.fn(async () => payments) },
    pricing: { get: vi.fn(async () => config) },
  };
  const service = createNoticeService({ ...ports, sender: createWaMeSender(), now: () => TODAY });
  return { service, ports };
}

describe('debtNotices', () => {
  it('lists debtors and deregistered members with standing, unpaid months and the total as of today', async () => {
    const { service } = setup(
      [member('debtor'), member('gone')],
      [membership('debtor', '2026-09-01'), membership('gone', '2026-06-01')],
    );
    const { asOf, rows } = await service.debtNotices();
    expect(asOf).toBe('2026-11-01');
    expect(rows).toEqual([
      expect.objectContaining({ memberId: 'debtor', memberNumber: 'N-debtor', name: 'debtor Prueba', standing: 'debtor', unpaidPeriodCount: 3, total: 120000 }),
      expect.objectContaining({ memberId: 'gone', standing: 'deregistered', unpaidPeriodCount: 6, total: 240000 }),
    ]);
  });

  it('leaves out up-to-date members, members with no owed month and inactive members', async () => {
    const { service } = setup(
      [member('paid'), member('nothing'), member('out', { status: 'inactive' })],
      [membership('paid', '2026-11-01'), membership('out', '2026-01-01', '2026-05-31')],
      [paidNovember('paid')],
    );
    expect((await service.debtNotices()).rows).toEqual([]);
  });

  it('builds a wa.me link with the derived number and a message naming the member and the total', async () => {
    const { service } = setup([member('debtor', { whatsapp: '+54 9 381 555-0101' })], [membership('debtor', '2026-10-01')]);
    const [row] = (await service.debtNotices()).rows;
    expect(row).toMatchObject({ recipient: 'member', recipientName: 'debtor Prueba', numberIssue: false });
    const url = new URL(row!.link!);
    expect(url.origin + url.pathname).toBe('https://wa.me/5493815550101');
    const text = url.searchParams.get('text')!;
    expect(text).toContain('$ 80.000');
    expect(text).toContain('octubre de 2026');
  });

  it('sends a minor to the guardian contact', async () => {
    const child = member('kid', {
      birthDate: '2015-06-10',
      whatsapp: '3815550101',
      guardian: { name: 'Ana Prueba', contact: '1155552222' },
    });
    const { service } = setup([child], [membership('kid', '2026-10-01')]);
    const [row] = (await service.debtNotices()).rows;
    expect(row).toMatchObject({ recipient: 'guardian', recipientName: 'Ana Prueba', numberIssue: false });
    expect(row!.link).toContain('https://wa.me/5491155552222?text=');
    expect(new URL(row!.link!).searchParams.get('text')).toContain('Hola Ana Prueba');
  });

  it('keeps writing to the member once they are an adult, even if a guardian is still stored', async () => {
    const adult = member('grown', { birthDate: '2000-01-01', guardian: { name: 'Ana Prueba', contact: '1155552222' } });
    const { service } = setup([adult], [membership('grown', '2026-10-01')]);
    expect((await service.debtNotices()).rows[0]).toMatchObject({ recipient: 'member', recipientName: 'grown Prueba' });
  });

  it('flags a minor whose guardian contact is unusable instead of falling back to the member number', async () => {
    const child = member('kid', { birthDate: '2015-06-10', guardian: { name: 'Ana Prueba', contact: '12345' } });
    const { service } = setup([child], [membership('kid', '2026-10-01')]);
    expect((await service.debtNotices()).rows[0]).toMatchObject({ recipient: 'guardian', link: null, numberIssue: true });
  });

  it('writes to the member when a minor has no guardian stored', async () => {
    const child = member('kid', { birthDate: '2015-06-10' });
    const { service } = setup([child], [membership('kid', '2026-10-01')]);
    expect((await service.debtNotices()).rows[0]).toMatchObject({ recipient: 'member', numberIssue: false });
  });

  it('returns no link and flags the row when the number cannot be used', async () => {
    const { service } = setup([member('bad', { whatsapp: '12345' })], [membership('bad', '2026-10-01')]);
    expect((await service.debtNotices()).rows[0]).toMatchObject({ link: null, numberIssue: true, recipient: 'member' });
  });

  it('sorts by last name, first name and member number', async () => {
    const { service } = setup(
      [member('b', { lastName: 'Zeta' }), member('c', { lastName: 'Álvarez' }), member('a', { lastName: 'Zeta' })],
      ['a', 'b', 'c'].map((id) => membership(id, '2026-10-01')),
    );
    expect((await service.debtNotices()).rows.map((row) => row.memberId)).toEqual(['c', 'a', 'b']);
  });

  it('reads each source once per request, however many members there are', async () => {
    const ids = ['m1', 'm2', 'm3', 'm4'];
    const { service, ports } = setup(ids.map((id) => member(id)), ids.map((id) => membership(id, '2026-10-01')));
    await service.debtNotices();
    for (const port of Object.values(ports)) expect(Object.values(port)[0]).toHaveBeenCalledTimes(1);
  });
});
