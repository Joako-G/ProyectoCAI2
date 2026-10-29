import { afterEach, describe, expect, it } from 'vitest';
import type { ChargeConcept } from '../../src/modules/payments/charge.types.js';
import { ConflictError, ValidationError } from '../../src/shared/errors.js';
import { ACTOR, MEMBER_ID, membership, trackContexts } from './payment.helpers.js';

const contexts = trackContexts();
afterEach(() => contexts.cleanup());

const social = (period: string): ChargeConcept => ({ kind: 'socialFee', period });
const activity = (period: string, disciplineId = 'basket'): ChargeConcept => ({ kind: 'activityFee', period, disciplineId });
const enrollment: ChargeConcept = { kind: 'enrollment' };

// The member joined this month, so paying October's fees leaves the account up to date.
const joinedThisMonth = { memberships: [membership('basket', '2026-10-01')] };
const day13 = () => new Date('2026-10-13T15:00:00Z');

async function payOctober(service: Awaited<ReturnType<typeof contexts.create>>['service']) {
  return service.register(MEMBER_ID, { concepts: [social('2026-10'), activity('2026-10')], method: 'cash' }, ACTOR);
}

describe('enrollment is charged only to a new member', () => {
  it('rejects the enrollment of a member who already paid (Rocío Ferreyra case) and writes nothing', async () => {
    const { service, repository } = await contexts.create(joinedThisMonth);
    await payOctober(service);
    expect((await service.account(MEMBER_ID)).standing).toBe('up_to_date');

    const attempt = service.register(MEMBER_ID, { concepts: [enrollment], method: 'cash', registration: {} }, ACTOR);
    await expect(attempt).rejects.toBeInstanceOf(ConflictError);
    await expect(attempt).rejects.toThrow('Already paid: enrollment');
    expect(await repository.list()).toHaveLength(1);
  });

  it('also refuses it in the preview, so the screen sees the same answer', async () => {
    const { service } = await contexts.create(joinedThisMonth);
    await payOctober(service);
    await expect(service.preview(MEMBER_ID, [enrollment], { registration: {} })).rejects.toBeInstanceOf(ConflictError);
  });

  it('still charges it to a member who has never paid', async () => {
    const { service } = await contexts.create(joinedThisMonth);
    const payment = await service.register(
      MEMBER_ID,
      { concepts: [enrollment, social('2026-10'), activity('2026-10')], method: 'cash', registration: {} },
      ACTOR,
    );
    expect(payment.lines.map((line) => line.kind)).toContain('enrollment');
  });

  it('charges it again to a deregistered member (more than 3 unpaid months)', async () => {
    const { service } = await contexts.create();
    await service.register(MEMBER_ID, { concepts: [enrollment, social('2026-10'), activity('2026-10')], method: 'cash', registration: {} }, ACTOR);
    expect((await service.account(MEMBER_ID)).standing).toBe('deregistered');

    const again = await service.register(MEMBER_ID, { concepts: [enrollment], method: 'cash', registration: {} }, ACTOR);
    expect(again.lines.map((line) => line.kind)).toEqual(['enrollment']);
  });

  it('charges it again when the earlier enrollment payment was annulled', async () => {
    const { service } = await contexts.create(joinedThisMonth);
    const first = await service.register(MEMBER_ID, { concepts: [enrollment], method: 'cash', registration: {} }, ACTOR);
    await service.annul(first.id, 'wrong member', ACTOR);
    const second = await service.register(MEMBER_ID, { concepts: [enrollment], method: 'cash', registration: {} }, ACTOR);
    expect(second.receiptNumber).toBe(2);
  });
});

describe('advance payment of the next month', () => {
  it('lets an up-to-date member pay next month when its tariff does not change', async () => {
    const { service } = await contexts.create(joinedThisMonth);
    await payOctober(service);
    const payment = await service.register(MEMBER_ID, { concepts: [social('2026-11'), activity('2026-11')], method: 'cash' }, ACTOR);
    expect(payment.total).toBe(40_000);
  });

  it('never adds the late surcharge to an advanced month', async () => {
    const { service } = await contexts.create({ ...joinedThisMonth, now: day13 });
    await payOctober(service);
    const payment = await service.register(MEMBER_ID, { concepts: [social('2026-11'), activity('2026-11')], method: 'cash' }, ACTOR);
    expect(payment.lines.map((line) => line.kind)).toEqual(['socialFee', 'activityFee']);
    expect(payment.total).toBe(40_000);
  });

  it('refuses it when next month has a different tariff', async () => {
    const { service, pricing } = await contexts.create(joinedThisMonth);
    await pricing.addTariff({ effectiveFrom: '2026-11', enrollment: 20_000, socialFee: 25_000, activityFee: 20_000, carnetReplacement: 3_000 });
    await payOctober(service);
    await expect(
      service.register(MEMBER_ID, { concepts: [social('2026-11')], method: 'cash' }, ACTOR),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses it for a member who still owes months', async () => {
    const { service } = await contexts.create({ memberships: [membership('basket', '2026-09-01')] });
    await expect(
      service.register(MEMBER_ID, { concepts: [social('2026-11')], method: 'cash' }, ACTOR),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses anything beyond the next month', async () => {
    const { service } = await contexts.create(joinedThisMonth);
    await payOctober(service);
    await expect(
      service.register(MEMBER_ID, { concepts: [social('2026-12')], method: 'cash' }, ACTOR),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('still refuses a month already paid in advance', async () => {
    const { service } = await contexts.create(joinedThisMonth);
    await payOctober(service);
    await service.register(MEMBER_ID, { concepts: [social('2026-11')], method: 'cash' }, ACTOR);
    await expect(
      service.register(MEMBER_ID, { concepts: [social('2026-11')], method: 'cash' }, ACTOR),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('what the account tells the Cobros screen', () => {
  it('offers enrollment to a new member and nothing in advance while October is owed', async () => {
    const { service } = await contexts.create(joinedThisMonth);
    const account = await service.account(MEMBER_ID);
    expect(account.enrollmentAvailable).toBe(true);
    expect(account.advance).toBeUndefined();
  });

  it('offers no enrollment and the next month to an up-to-date member with a flat tariff', async () => {
    const { service } = await contexts.create(joinedThisMonth);
    await payOctober(service);
    const account = await service.account(MEMBER_ID);
    expect(account.enrollmentAvailable).toBe(false);
    expect(account.advance?.period).toBe('2026-11');
  });

  it('offers no advance month when the next month costs more', async () => {
    const { service, pricing } = await contexts.create(joinedThisMonth);
    await pricing.addTariff({ effectiveFrom: '2026-11', enrollment: 20_000, socialFee: 25_000, activityFee: 20_000, carnetReplacement: 3_000 });
    await payOctober(service);
    expect((await service.account(MEMBER_ID)).advance).toBeUndefined();
  });

  it('offers no advance month once it is paid', async () => {
    const { service } = await contexts.create(joinedThisMonth);
    await payOctober(service);
    await service.register(MEMBER_ID, { concepts: [social('2026-11'), activity('2026-11')], method: 'cash' }, ACTOR);
    expect((await service.account(MEMBER_ID)).advance).toBeUndefined();
  });
});

