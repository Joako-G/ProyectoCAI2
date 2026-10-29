import { readFile, writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChargeConcept } from '../../src/modules/payments/charge.types.js';
import { createJsonPaymentRepository } from '../../src/modules/payments/json-payment.repository.js';
import { createPaymentService } from '../../src/modules/payments/payment.service.js';
import { ConflictError, NotFoundError, ValidationError } from '../../src/shared/errors.js';
import { ACTOR, MEMBER_ID, membership, trackContexts } from './payment.helpers.js';

const contexts = trackContexts();
afterEach(() => contexts.cleanup());

const social = (period: string): ChargeConcept => ({ kind: 'socialFee', period });
const activity = (period: string, disciplineId = 'basket'): ChargeConcept => ({ kind: 'activityFee', period, disciplineId });

describe('preview', () => {
  it('returns the charge without writing anything', async () => {
    const { service, repository } = await contexts.create();
    const charge = await service.preview(MEMBER_ID, [social('2026-10'), activity('2026-10')]);
    expect(charge.total).toBe(40_000);
    expect(await repository.list()).toEqual([]);
  });

  it('prices a first-time registration with the enrollment fee', async () => {
    const { service } = await contexts.create();
    const charge = await service.preview(MEMBER_ID, [{ kind: 'enrollment' }, social('2026-10'), activity('2026-10')], {
      registration: {},
    });
    expect(charge.total).toBe(60_000);
  });

  it('rejects an unknown member', async () => {
    const { service } = await contexts.create();
    await expect(service.preview('nobody', [social('2026-10')])).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('register', () => {
  it('writes one payment with a snapshot of the lines, the method and the actor', async () => {
    const { service, repository } = await contexts.create();
    const payment = await service.register(MEMBER_ID, { concepts: [social('2026-10'), activity('2026-10')], method: 'qr' }, ACTOR);
    expect(payment).toMatchObject({
      receiptNumber: 1,
      memberId: MEMBER_ID,
      method: 'qr',
      paymentDate: '2026-10-05',
      total: 40_000,
      createdBy: ACTOR,
    });
    expect(payment.lines).toHaveLength(2);
    expect(await repository.list()).toEqual([payment]);
  });

  it('recomputes the amounts and ignores any client amount', async () => {
    const { service } = await contexts.create();
    const tampered = [{ kind: 'socialFee', period: '2026-10', amount: 1 }] as unknown as ChargeConcept[];
    const payment = await service.register(MEMBER_ID, { concepts: tampered, method: 'cash' }, ACTOR);
    expect(payment.total).toBe(20_000);
    expect(payment.lines).toEqual([{ kind: 'socialFee', period: '2026-10', amount: 20_000 }]);
  });

  it('keeps the stored amounts when a tariff changes later', async () => {
    const { service, pricing } = await contexts.create();
    const tariff = { effectiveFrom: '2026-10', enrollment: 1, socialFee: 25_000, activityFee: 1, carnetReplacement: 1 };
    await pricing.addTariff(tariff);
    const payment = await service.register(MEMBER_ID, { concepts: [social('2026-10')], method: 'cash' }, ACTOR);
    await pricing.replaceTariff('2026-10', { ...tariff, socialFee: 99_000 });
    expect(payment.total).toBe(25_000);
    expect((await service.history(MEMBER_ID))[0]!.total).toBe(25_000);
    expect((await service.getReceipt(1)).lines[0]!.amount).toBe(25_000);
  });

  it('rejects a concept already settled by a payment', async () => {
    const { service, repository } = await contexts.create();
    await service.register(MEMBER_ID, { concepts: [social('2026-10')], method: 'cash' }, ACTOR);
    await expect(
      service.register(MEMBER_ID, { concepts: [social('2026-09'), social('2026-10')], method: 'cash' }, ACTOR),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await repository.list()).toHaveLength(1);
  });

  it('rejects a concept repeated inside one register and writes nothing', async () => {
    const { service, repository } = await contexts.create();
    await expect(
      service.register(MEMBER_ID, { concepts: [social('2026-10'), social('2026-10')], method: 'cash' }, ACTOR),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.register(MEMBER_ID, { concepts: [activity('2026-10'), activity('2026-10')], method: 'cash' }, ACTOR),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await repository.list()).toHaveLength(0);
  });

  it('settles only the concepts it lists', async () => {
    const { service } = await contexts.create();
    await service.register(MEMBER_ID, { concepts: [social('2026-10')], method: 'cash' }, ACTOR);
    const second = await service.register(MEMBER_ID, { concepts: [activity('2026-10')], method: 'cash' }, ACTOR);
    expect(second.receiptNumber).toBe(2);
  });

  it('rejects an inactive member', async () => {
    const { service, repository } = await contexts.create({
      members: [{ id: MEMBER_ID, status: 'inactive', deactivation: { date: '2026-09-01' } }],
    });
    await expect(
      service.register(MEMBER_ID, { concepts: [social('2026-09')], method: 'cash' }, ACTOR),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await repository.list()).toEqual([]);
  });

  it('rejects an unknown member, a bad method, an empty charge and a missing actor', async () => {
    const { service } = await contexts.create();
    const input = { concepts: [social('2026-10')], method: 'cash' as const };
    await expect(service.register('nobody', input, ACTOR)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.register(MEMBER_ID, { ...input, method: 'bitcoin' as never }, ACTOR)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(service.register(MEMBER_ID, { ...input, concepts: [] }, ACTOR)).rejects.toBeInstanceOf(ValidationError);
    await expect(service.register(MEMBER_ID, input, '  ')).rejects.toBeInstanceOf(ValidationError);
  });

  it('allocates correlative unique receipt numbers under 8 concurrent registers', async () => {
    const { service, repository } = await contexts.create();
    const periods = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    const payments = await Promise.all(
      periods.map((period) => service.register(MEMBER_ID, { concepts: [social(period)], method: 'cash' }, ACTOR)),
    );
    expect(payments.map((payment) => payment.receiptNumber).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(await repository.list()).toHaveLength(8);
  });

  it('lets only one of two concurrent registers of the same concept succeed', async () => {
    const { service } = await contexts.create();
    const attempts = await Promise.allSettled([
      service.register(MEMBER_ID, { concepts: [social('2026-10')], method: 'cash' }, ACTOR),
      service.register(MEMBER_ID, { concepts: [social('2026-10')], method: 'debit' }, ACTOR),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
  });
});

describe('annul', () => {
  it('records the reason, actor and date, keeps the payment and its receipt number', async () => {
    const { service, repository } = await contexts.create();
    const payment = await service.register(MEMBER_ID, { concepts: [social('2026-10')], method: 'cash' }, ACTOR);
    const annulled = await service.annul(payment.id, '  Wrong member  ', 'user-head');
    expect(annulled.annulment).toEqual({
      reason: 'Wrong member',
      annulledBy: 'user-head',
      annulledAt: '2026-10-05T15:00:00.000Z',
    });
    expect(annulled.receiptNumber).toBe(1);
    expect(annulled.lines).toEqual(payment.lines);
    expect(await repository.list()).toEqual([annulled]);
  });

  it('frees the concepts and never reuses the receipt number', async () => {
    const { service } = await contexts.create();
    const first = await service.register(MEMBER_ID, { concepts: [social('2026-10')], method: 'cash' }, ACTOR);
    await service.annul(first.id, 'Mistake', 'user-head');
    const again = await service.register(MEMBER_ID, { concepts: [social('2026-10')], method: 'cash' }, ACTOR);
    expect(again.receiptNumber).toBe(2);
    expect((await service.history(MEMBER_ID)).map((payment) => payment.receiptNumber)).toEqual([1, 2]);
  });

  it('requires a reason and an actor', async () => {
    const { service } = await contexts.create();
    const payment = await service.register(MEMBER_ID, { concepts: [social('2026-10')], method: 'cash' }, ACTOR);
    await expect(service.annul(payment.id, '   ', 'user-head')).rejects.toBeInstanceOf(ValidationError);
    await expect(service.annul(payment.id, 'Mistake', '')).rejects.toBeInstanceOf(ValidationError);
    expect((await service.getReceipt(payment.id)).annulment).toBeUndefined();
  });

  it('rejects a second annulment and an unknown payment', async () => {
    const { service } = await contexts.create();
    const payment = await service.register(MEMBER_ID, { concepts: [social('2026-10')], method: 'cash' }, ACTOR);
    await service.annul(payment.id, 'Mistake', 'user-head');
    await expect(service.annul(payment.id, 'Again', 'user-head')).rejects.toBeInstanceOf(ConflictError);
    await expect(service.annul('missing', 'Mistake', 'user-head')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('getReceipt and history', () => {
  it('finds a receipt by number or id and rejects an unknown one', async () => {
    const { service } = await contexts.create();
    const payment = await service.register(MEMBER_ID, { concepts: [social('2026-10')], method: 'cash' }, ACTOR);
    expect(await service.getReceipt(1)).toEqual(payment);
    expect(await service.getReceipt(payment.id)).toEqual(payment);
    await expect(service.getReceipt(99)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lists only the member payments, oldest receipt first', async () => {
    const { service, members, memberships } = await contexts.create();
    members.push({ id: 'other', status: 'active' });
    memberships.push(membership('basket', '2026-01-01', undefined, 'other'));
    await service.register(MEMBER_ID, { concepts: [social('2026-09')], method: 'cash' }, ACTOR);
    await service.register('other', { concepts: [social('2026-10')], method: 'cash' }, ACTOR);
    await service.register(MEMBER_ID, { concepts: [social('2026-10')], method: 'cash' }, ACTOR);
    expect((await service.history(MEMBER_ID)).map((payment) => payment.receiptNumber)).toEqual([1, 3]);
    await expect(service.history('nobody')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('account', () => {
  it('goes from debtor to deregistered with four unpaid months and back to up to date after paying', async () => {
    const { service, memberships } = await contexts.create();
    memberships.splice(0, memberships.length, membership('basket', '2026-10-01'));
    const owedNow = await service.account(MEMBER_ID);
    expect(owedNow.standing).toBe('debtor');
    expect(owedNow.unpaidPeriodCount).toBe(1);

    memberships.splice(0, memberships.length, membership('basket', '2026-07-01'));
    expect((await service.account(MEMBER_ID)).standing).toBe('deregistered');

    for (const period of ['2026-07', '2026-08', '2026-09', '2026-10']) {
      await service.register(MEMBER_ID, { concepts: [social(period), activity(period)], method: 'cash' }, ACTOR);
    }
    const settled = await service.account(MEMBER_ID);
    expect(settled).toMatchObject({ standing: 'up_to_date', unpaidPeriodCount: 0, owed: [] });
  });

  it('restores the owed concepts when a payment is annulled', async () => {
    const { service, memberships } = await contexts.create();
    memberships.splice(0, memberships.length, membership('basket', '2026-10-01'));
    const payment = await service.register(
      MEMBER_ID,
      { concepts: [social('2026-10'), activity('2026-10')], method: 'cash' },
      ACTOR,
    );
    expect((await service.account(MEMBER_ID)).standing).toBe('up_to_date');
    await service.annul(payment.id, 'Mistake', 'user-head');
    const after = await service.account(MEMBER_ID);
    expect(after.standing).toBe('debtor');
    expect(after.owed[0]!.concepts).toHaveLength(2);
  });

  it('starts at the earliest tariff month and stops at the deactivation month', async () => {
    const { service } = await contexts.create({
      members: [{ id: MEMBER_ID, status: 'inactive', deactivation: { date: '2026-02-10' } }],
      memberships: [membership('basket', '2025-06-01')],
    });
    const account = await service.account(MEMBER_ID);
    expect(account.owed.map((entry) => entry.period)).toEqual(['2026-01', '2026-02']);
  });
});

describe('payments file', () => {
  const input = { concepts: [social('2026-10')], method: 'cash' as const };

  it('refuses a malformed file and leaves it untouched', async () => {
    const { service, file } = await contexts.create();
    await writeFile(file, '{ not json', 'utf8');
    await expect(service.register(MEMBER_ID, input, ACTOR)).rejects.toThrow();
    await expect(service.history(MEMBER_ID)).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe('{ not json');
  });

  it('refuses a file with the wrong shape and leaves it untouched', async () => {
    const { service, file } = await contexts.create();
    await writeFile(file, '{"payments":[]}', 'utf8');
    await expect(service.register(MEMBER_ID, input, ACTOR)).rejects.toThrow(/Invalid payments file/);
    expect(await readFile(file, 'utf8')).toBe('{"payments":[]}');
  });
});

describe('payments file lines', () => {
  const goodLine = { kind: 'socialFee', period: '2026-10', amount: 20_000 };
  const payment = (lines: unknown[]) => ({
    id: 'p1', receiptNumber: 1, memberId: MEMBER_ID, method: 'cash', paymentDate: '2026-10-05',
    lines, total: 20_000, createdBy: ACTOR, createdAt: '2026-10-05T12:00:00.000Z',
  });

  it.each([
    ['an unknown kind', { ...goodLine, kind: 'bogus' }],
    ['a malformed period', { ...goodLine, period: '2026-13' }],
    ['a decimal amount', { ...goodLine, amount: 100.5 }],
    ['a negative amount', { ...goodLine, amount: -1 }],
    ['an activity fee without a discipline', { kind: 'activityFee', period: '2026-10', amount: 20_000 }],
  ])('refuses a stored line with %s and leaves the file untouched', async (_name, line) => {
    const { service, file } = await contexts.create();
    const text = JSON.stringify([payment([line])]);
    await writeFile(file, text, 'utf8');
    await expect(service.history(MEMBER_ID)).rejects.toThrow(/Invalid payments file/);
    await expect(
      service.register(MEMBER_ID, { concepts: [social('2026-09')], method: 'cash' }, ACTOR),
    ).rejects.toThrow(/Invalid payments file/);
    expect(await readFile(file, 'utf8')).toBe(text);
  });

  it('accepts well-formed lines', async () => {
    const { service, file } = await contexts.create();
    await writeFile(file, JSON.stringify([payment([goodLine, { kind: 'activityFee', period: '2026-10', amount: 20_000, disciplineId: 'basket' }])]), 'utf8');
    expect(await service.history(MEMBER_ID)).toHaveLength(1);
  });
});

describe('server-owned enrollment date', () => {
  it('ignores a backdated enrollmentDate in preview and register', async () => {
    const { service } = await contexts.create();
    const concepts = [{ kind: 'enrollment' as const }, social('2026-10'), activity('2026-10')];
    const honest = await service.preview(MEMBER_ID, concepts, { registration: {} });
    // A day-20 enrollment would prorate the activity fee; the server uses today (the 5th) instead.
    const sentByClient = { enrollmentDate: '2026-10-20' };
    const backdated = await service.preview(MEMBER_ID, concepts, { registration: sentByClient });
    expect(backdated).toEqual(honest);
    const payment = await service.register(MEMBER_ID, { concepts, method: 'cash', registration: { enrollmentDate: '2026-01-01' } as object }, ACTOR);
    expect(payment.total).toBe(honest.total);
    expect(payment.registration).toEqual({ enrollmentDate: '2026-10-05' });
  });

  it('uses the club-local today as the enrollment date', async () => {
    const { service } = await contexts.create({ now: () => new Date('2026-10-20T15:00:00Z') });
    const charge = await service.preview(MEMBER_ID, [{ kind: 'enrollment' }, social('2026-10'), activity('2026-10')], {
      registration: {},
    });
    // Registered on the 20th: the activity fee is prorated to half; the social fee never is.
    expect(charge.lines.find((line) => line.kind === 'activityFee')!.amount).toBe(10_000);
  });
});

describe('account without tariffs', () => {
  it('throws a typed conflict instead of a TypeError', async () => {
    const { repository, members, memberships } = await contexts.create();
    const service = createPaymentService({
      repository,
      members: { getById: async () => members[0]! },
      memberships: { list: async () => memberships },
      pricing: { get: async () => ({ tariffs: [], surchargeTiers: [], prorationRule: { afterDay: 15, activityPercent: 50 } }) },
    });
    await expect(service.account(MEMBER_ID)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('stored lines round trip', () => {
  it('reads back every kind of line the service writes through a fresh repository', async () => {
    // Day 21: late payments carry the highest surcharge tier.
    const context = await contexts.create({ now: () => new Date('2026-10-21T15:00:00Z') });
    await context.service.register(MEMBER_ID, {
      concepts: [{ kind: 'enrollment' }, social('2026-10'), activity('2026-10')], method: 'cash', registration: {},
    }, ACTOR);
    // The member joins volleyball in September, so that month's volley fee is owed.
    context.memberships.push(membership('volley', '2026-09-01'));
    const late = await context.service.register(MEMBER_ID, { concepts: [activity('2026-09', 'volley')], method: 'qr' }, ACTOR);
    await context.service.register(MEMBER_ID, { concepts: [{ kind: 'carnetReplacement' }], method: 'debit' }, ACTOR);
    expect(late.lines.map((line) => line.kind)).toContain('activitySurcharge');

    const reopened = createPaymentService({
      repository: createJsonPaymentRepository(context.file),
      now: () => new Date('2026-10-21T15:00:00Z'),
      pricing: context.pricing,
      members: { getById: async () => context.members[0]! },
      memberships: { list: async () => context.memberships },
    });
    const history = await reopened.history(MEMBER_ID);
    expect(history.map((entry) => entry.receiptNumber)).toEqual([1, 2, 3]);
    const kinds = history.flatMap((entry) => entry.lines.map((line) => line.kind));
    expect(kinds).toEqual(expect.arrayContaining(['enrollment', 'socialFee', 'activityFee', 'activitySurcharge', 'carnetReplacement']));
    await expect(reopened.account(MEMBER_ID)).resolves.toMatchObject({ memberId: MEMBER_ID });
  });
});

describe('idempotent register (requestId)', () => {
  const REQUEST_ID = 'request-0001';
  const base = { concepts: [{ kind: 'carnetReplacement' } as ChargeConcept], method: 'cash' as const, requestId: REQUEST_ID };

  it('returns the same payment and writes nothing when the same request is repeated', async () => {
    const { service, repository } = await contexts.create();
    const first = await service.register(MEMBER_ID, base, ACTOR);
    const second = await service.register(MEMBER_ID, { ...base }, ACTOR);
    expect(second).toEqual(first);
    expect(first.requestId).toBe(REQUEST_ID);
    expect(await repository.list()).toHaveLength(1);
  });

  it('keeps one payment under concurrent duplicates', async () => {
    const { service, repository } = await contexts.create();
    const results = await Promise.all(Array.from({ length: 5 }, () => service.register(MEMBER_ID, base, ACTOR)));
    expect(new Set(results.map((payment) => payment.receiptNumber))).toEqual(new Set([1]));
    expect(await repository.list()).toHaveLength(1);
  });

  it('rejects the same requestId with other concepts or for another member', async () => {
    const { service, repository } = await contexts.create({ members: [{ id: MEMBER_ID, status: 'active' }, { id: 'member-two', status: 'active' }] });
    await service.register(MEMBER_ID, base, ACTOR);
    await expect(service.register(MEMBER_ID, { ...base, concepts: [social('2026-10')] }, ACTOR)).rejects.toBeInstanceOf(ConflictError);
    await expect(service.register('member-two', base, ACTOR)).rejects.toBeInstanceOf(ConflictError);
    expect(await repository.list()).toHaveLength(1);
  });

  it('treats the same concepts in another order as the same request', async () => {
    const { service } = await contexts.create();
    const input = { method: 'cash' as const, requestId: REQUEST_ID };
    const first = await service.register(MEMBER_ID, { ...input, concepts: [social('2026-09'), social('2026-10')] }, ACTOR);
    const second = await service.register(MEMBER_ID, { ...input, concepts: [social('2026-10'), social('2026-09')] }, ACTOR);
    expect(second.id).toBe(first.id);
  });

  it('does not reuse an annulled payment: the same requestId registers again', async () => {
    const { service, repository } = await contexts.create();
    const first = await service.register(MEMBER_ID, base, ACTOR);
    await service.annul(first.id, 'Mistake', ACTOR);
    const again = await service.register(MEMBER_ID, base, ACTOR);
    expect(again.id).not.toBe(first.id);
    expect(await repository.list()).toHaveLength(2);
  });

  it('refuses a malformed requestId', async () => {
    const { service } = await contexts.create();
    for (const requestId of ['short', 'x'.repeat(101), 42 as unknown as string]) {
      await expect(service.register(MEMBER_ID, { ...base, requestId }, ACTOR)).rejects.toBeInstanceOf(ValidationError);
    }
  });

  it('reads old stored payments that have no requestId', async () => {
    const { service, file } = await contexts.create();
    await service.register(MEMBER_ID, { concepts: [social('2026-10')], method: 'cash' }, ACTOR);
    expect((await service.history(MEMBER_ID))[0]!.requestId).toBeUndefined();
    const stored = JSON.parse(await readFile(file, 'utf8'));
    await writeFile(file, JSON.stringify([{ ...stored[0], requestId: 7 }]), 'utf8');
    await expect(service.history(MEMBER_ID)).rejects.toThrow(/Invalid payments file/);
  });
});
