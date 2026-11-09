import { describe, expect, it, vi } from 'vitest';
import { buildWelcomeMessage } from '../../src/modules/notices/notice.message.js';
import { createWaMeSender } from '../../src/modules/notices/notice.sender.js';
import { createNoticeService, type NoticeMember } from '../../src/modules/notices/notice.service.js';
import type { Payment } from '../../src/modules/payments/payment.types.js';

const NOW = new Date('2026-11-01T15:00:00Z');

function member(overrides: Partial<NoticeMember> = {}): NoticeMember {
  return {
    id: 'm1',
    memberNumber: '0001',
    firstName: 'Lucía',
    lastName: 'Ríos',
    whatsapp: '3815550101',
    status: 'active',
    birthDate: '1990-01-01',
    ...overrides,
  };
}

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1',
    receiptNumber: 8,
    memberId: 'm1',
    method: 'cash',
    paymentDate: '2026-10-26',
    lines: [
      { kind: 'enrollment', period: '2026-10', amount: 10000 },
      { kind: 'socialFee', period: '2026-10', amount: 20000 },
      { kind: 'activityFee', period: '2026-10', disciplineId: 'basket', amount: 20000, prorated: true },
    ],
    total: 50000,
    createdBy: 'user',
    createdAt: '2026-10-26T15:00:00.000Z',
    ...overrides,
  };
}

function setup(members: NoticeMember[], payments: Payment[]) {
  return createNoticeService({
    members: { list: vi.fn(async () => members) },
    memberships: { list: async () => [] },
    payments: { list: vi.fn(async () => payments) },
    pricing: { get: async () => ({ tariffs: [], surchargeTiers: [], prorationRule: { kind: 'none' } }) as never },
    disciplines: { findByIds: async () => [{ id: 'basket', name: 'Básquet' }] },
    sender: createWaMeSender(),
    now: () => NOW,
  });
}

describe('buildWelcomeMessage', () => {
  const base = {
    clubName: 'Club Independiente',
    memberName: 'Tomás Gómez',
    receiptNumber: 8,
    paymentDate: '2026-10-26',
    concepts: ['Inscripción', 'Cuota social octubre de 2026'],
    total: 76000,
  };

  it('welcomes the member and lists the receipt, its concepts and the total', () => {
    const text = buildWelcomeMessage({ ...base, addressee: { kind: 'member', name: 'Tomás Gómez' } });
    expect(text).toContain('Hola Tomás Gómez');
    expect(text).toContain('bienvenida a Club Independiente');
    expect(text).toContain('su inscripción');
    expect(text).toContain('N° 8');
    expect(text).toContain('26/10/2026');
    expect(text).toContain('Inscripción y Cuota social octubre de 2026');
    expect(text).toContain('$ 76.000');
  });

  it('names the minor when it is the guardian who reads it', () => {
    const text = buildWelcomeMessage({ ...base, addressee: { kind: 'guardian', name: 'Ana Gómez' } });
    expect(text).toContain('Hola Ana Gómez');
    expect(text).toContain('la inscripción de Tomás Gómez');
  });
});

describe('welcomeNotice', () => {
  it('prepares a wa.me link to the member with the receipt in the message', async () => {
    const notice = await setup([member()], [payment()]).welcomeNotice('pay-1');
    expect(notice).toMatchObject({ memberId: 'm1', recipient: 'member', recipientName: 'Lucía Ríos', numberIssue: false });
    const url = new URL(notice.link!);
    expect(url.origin + url.pathname).toBe('https://wa.me/5493815550101');
    const text = url.searchParams.get('text')!;
    expect(text).toContain('N° 8');
    expect(text).toContain('Inscripción');
    expect(text).toContain('Cuota social octubre de 2026');
    expect(text).toContain('Cuota de Básquet octubre de 2026');
    expect(text).toContain('$ 50.000');
  });

  it('sends to the guardian contact when the member is a minor', async () => {
    const minor = member({ birthDate: '2015-06-10', whatsapp: '3815550101', guardian: { name: 'Ana Gómez', contact: '3815559999' } });
    const notice = await setup([minor], [payment()]).welcomeNotice('pay-1');
    expect(notice).toMatchObject({ recipient: 'guardian', recipientName: 'Ana Gómez' });
    expect(notice.link).toContain('https://wa.me/5493815559999');
  });

  it('sends to the member when an adult still has a guardian stored', async () => {
    const adult = member({ guardian: { name: 'Ana Gómez', contact: '3815559999' } });
    const notice = await setup([adult], [payment()]).welcomeNotice('pay-1');
    expect(notice.recipient).toBe('member');
    expect(notice.link).toContain('https://wa.me/5493815550101');
  });

  it('flags the number instead of sending when it cannot be derived', async () => {
    const notice = await setup([member({ whatsapp: '12345' })], [payment()]).welcomeNotice('pay-1');
    expect(notice).toMatchObject({ link: null, numberIssue: true });
  });

  it('refuses an unknown payment and an annulled one', async () => {
    const service = setup([member()], [payment({ id: 'pay-x', annulment: { reason: 'x', annulledBy: 'u', annulledAt: '2026-10-27T10:00:00.000Z' } })]);
    await expect(service.welcomeNotice('missing')).rejects.toThrow('Payment not found');
    await expect(service.welcomeNotice('pay-x')).rejects.toThrow('annulled');
  });
});
