import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/shared/errors.js';
import { calculateCharge } from '../../src/modules/payments/charge.js';
import type { ChargeConcept, ChargeInput } from '../../src/modules/payments/charge.types.js';
import {
  DEFAULT_PRORATION_RULE,
  DEFAULT_SURCHARGE_TIERS,
  DEFAULT_TARIFF,
} from '../../src/modules/payments/pricing.js';
import { isDeregistered } from '../../src/modules/payments/standing.js';

const PERIOD = '2026-10';
const social: ChargeConcept = { kind: 'socialFee', period: PERIOD };
const enrollment: ChargeConcept = { kind: 'enrollment' };
const carnet: ChargeConcept = { kind: 'carnetReplacement' };
const activity = (disciplineId: string, period = PERIOD): ChargeConcept => ({
  kind: 'activityFee',
  period,
  disciplineId,
});

function charge(overrides: Partial<ChargeInput> & Pick<ChargeInput, 'concepts'>) {
  return calculateCharge({
    tariffs: [DEFAULT_TARIFF],
    surchargeTiers: DEFAULT_SURCHARGE_TIERS,
    prorationRule: DEFAULT_PRORATION_RULE,
    paymentDate: '2026-10-05',
    ...overrides,
  });
}

const day = (d: number) => `2026-10-${String(d).padStart(2, '0')}`;

describe('calculateCharge: handoff examples for an existing member', () => {
  it.each([
    [5, 60_000],
    [10, 60_000],
    [13, 66_000],
    [16, 70_000],
    [20, 70_000],
    [21, 74_000],
    [31, 74_000],
  ])('social fee plus two activities paid on day %i totals %i', (paymentDay, expected) => {
    const result = charge({ paymentDate: day(paymentDay), concepts: [social, activity('d1'), activity('d2')] });
    expect(result.total).toBe(expected);
  });

  it('charges one on-time activity and one day-13 activity in separate charges: 63,000', () => {
    const onTime = charge({ paymentDate: day(5), concepts: [social, activity('d1')] });
    const late = charge({ paymentDate: day(13), concepts: [activity('d2')] });
    expect(onTime.total + late.total).toBe(63_000);
    expect(late.total).toBe(23_000);
  });

  it('charges an existing member adding one activity only the full activity fee', () => {
    expect(charge({ concepts: [activity('d2')] }).total).toBe(20_000);
  });

  it('does not prorate an existing member even after the cutoff day', () => {
    expect(charge({ paymentDate: day(25), concepts: [activity('d1')] }).lines[0].amount).toBe(20_000);
  });
});

describe('calculateCharge: first-time registration', () => {
  const registration = (enrollmentDate: string) => ({ enrollmentDate });

  it('adds the enrollment fee for a new member paying on time: 80,000', () => {
    const result = charge({
      registration: registration(day(3)),
      paymentDate: day(3),
      concepts: [enrollment, social, activity('d1'), activity('d2')],
    });
    expect(result.total).toBe(80_000);
  });

  it.each([
    [['d1'], 50_000],
    [['d1', 'd2'], 60_000],
  ])('prorates activities for a new member enrolling after the 15th (%j totals %i)', (disciplines, expected) => {
    // Paying on the 16th would add a surcharge, so a zero-surcharge table isolates the proration.
    const result = charge({
      surchargeTiers: [{ fromDay: 1, amount: 0 }],
      registration: registration(day(16)),
      paymentDate: day(16),
      concepts: [enrollment, social, ...disciplines.map((id) => activity(id))],
    });
    expect(result.total).toBe(expected);
    const activityLines = result.lines.filter((line) => line.kind === 'activityFee');
    expect(activityLines.every((line) => line.amount === 10_000 && line.prorated)).toBe(true);
  });

  it('charges the full activity fee when enrolling on the cutoff day itself', () => {
    const result = charge({
      registration: registration(day(15)),
      paymentDate: day(15),
      concepts: [enrollment, social, activity('d1')],
    });
    // 20,000 + 20,000 + 20,000; no proration on the cutoff day and no surcharge in the enrollment month
    expect(result.total).toBe(60_000);
  });

  it('prorates only the period of the enrollment date', () => {
    const result = charge({
      registration: registration('2026-09-20'),
      paymentDate: day(2),
      concepts: [enrollment, activity('d1', '2026-09'), activity('d1', '2026-10')],
    });
    const fees = result.lines.filter((line) => line.kind === 'activityFee').map((line) => line.amount);
    expect(fees).toEqual([10_000, 20_000]);
  });

  it('does not surcharge activities in the enrollment month of a new member', () => {
    const result = charge({
      registration: registration(day(18)),
      paymentDate: day(18),
      concepts: [enrollment, social, activity('d1'), activity('d2')],
    });
    // 20,000 + 20,000 + 10,000 + 10,000; a new member never had an earlier due date
    expect(result.total).toBe(60_000);
    expect(result.lines.some((line) => line.kind === 'activitySurcharge')).toBe(false);
  });

  it('does not surcharge a full-price enrollment-month activity paid late in the month', () => {
    const result = charge({
      registration: registration(day(5)),
      paymentDate: day(13),
      concepts: [enrollment, social, activity('d1')],
    });
    expect(result.total).toBe(60_000);
  });

  it('surcharges the months after the enrollment month like any member', () => {
    const result = charge({
      paymentDate: '2026-11-13',
      concepts: [{ kind: 'socialFee', period: '2026-11' }, activity('d1', '2026-11')],
    });
    expect(result.total).toBe(43_000);
  });

  it('rejects an enrollment concept for a member who is not registering', () => {
    expect(() => charge({ concepts: [enrollment, social] })).toThrow(ValidationError);
  });

  it('rejects a first-time registration without an enrollment concept', () => {
    expect(() => charge({ registration: registration(day(3)), concepts: [social] })).toThrow(ValidationError);
  });

  it.each([
    ['later the same month', day(20), day(10)],
    ['in a later month', '2026-11-02', '2026-10-30'],
  ])('rejects an enrollment date after the payment date (%s)', (_label, enrollmentDate, paymentDate) => {
    let error: unknown;
    try {
      charge({ registration: registration(enrollmentDate), paymentDate, concepts: [enrollment, social] });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ValidationError);
    // Pins the rule: the rejection must come from the enrollment-date check, not another validator.
    expect((error as ValidationError).fieldErrors).toEqual({ enrollmentDate: 'Must not be after the payment date' });
  });

  it('accepts an enrollment date equal to the payment date', () => {
    const result = charge({
      registration: registration(day(10)),
      paymentDate: day(10),
      concepts: [enrollment, social, activity('d1')],
    });
    expect(result.total).toBe(60_000);
  });

  it('rejects a duplicate enrollment concept', () => {
    expect(() => charge({ registration: registration(day(3)), concepts: [enrollment, enrollment] })).toThrow(
      ValidationError,
    );
  });

  it('rejects an invalid enrollment date', () => {
    expect(() => charge({ registration: registration('2026-02-30'), concepts: [enrollment] })).toThrow(
      ValidationError,
    );
  });
});

describe('calculateCharge: surcharges and tariffs', () => {
  it('emits the surcharge as its own line linked to the activity', () => {
    const result = charge({ paymentDate: day(13), concepts: [social, activity('d1')] });
    expect(result.lines).toEqual([
      { kind: 'socialFee', period: PERIOD, amount: 20_000 },
      { kind: 'activityFee', period: PERIOD, disciplineId: 'd1', amount: 20_000, prorated: false },
      { kind: 'activitySurcharge', period: PERIOD, disciplineId: 'd1', amount: 3_000 },
    ]);
    expect(result.total).toBe(43_000);
  });

  it('never surcharges the social fee', () => {
    const result = charge({ paymentDate: day(28), concepts: [social] });
    expect(result.total).toBe(20_000);
    expect(result.lines).toHaveLength(1);
  });

  it('charges an overdue month at its own tariff plus only the surcharge for the payment day', () => {
    const oldTariff = { ...DEFAULT_TARIFF, effectiveFrom: '2026-01' };
    const newTariff = { ...DEFAULT_TARIFF, effectiveFrom: '2026-10', activityFee: 25_000 };
    const result = charge({
      tariffs: [oldTariff, newTariff],
      paymentDate: day(25),
      concepts: [activity('d1', '2026-09')],
    });
    // Old tariff 20,000 + 7,000 surcharge for day 25; nothing extra for the missed month.
    expect(result.total).toBe(27_000);
  });

  it('prices each period at the tariff in force for that period', () => {
    const newTariff = { ...DEFAULT_TARIFF, effectiveFrom: '2026-10', socialFee: 22_000 };
    const result = charge({
      tariffs: [DEFAULT_TARIFF, newTariff],
      concepts: [social, { ...social, period: '2026-09' }],
    });
    expect(result.lines.map((line) => line.amount)).toEqual([22_000, 20_000]);
  });

  it('prices enrollment and carnet replacement at the tariff of the payment month', () => {
    const newTariff = { ...DEFAULT_TARIFF, effectiveFrom: '2026-10', enrollment: 30_000, carnetReplacement: 4_000 };
    const result = charge({
      tariffs: [DEFAULT_TARIFF, newTariff],
      registration: { enrollmentDate: day(3) },
      concepts: [enrollment, carnet],
    });
    expect(result.lines.map((line) => [line.kind, line.period, line.amount])).toEqual([
      ['enrollment', PERIOD, 30_000],
      ['carnetReplacement', PERIOD, 4_000],
    ]);
  });
});

describe('calculateCharge: validation', () => {
  it('rejects a duplicate social fee for the same period', () => {
    expect(() => charge({ concepts: [social, social] })).toThrow(ValidationError);
  });

  it('allows social fees for different periods', () => {
    expect(charge({ concepts: [social, { ...social, period: '2026-09' }] }).total).toBe(40_000);
  });

  it('rejects a duplicate activity for the same discipline and period', () => {
    expect(() => charge({ concepts: [activity('d1'), activity('d1')] })).toThrow(ValidationError);
  });

  it('allows the same discipline in different periods and different disciplines in one period', () => {
    expect(charge({ concepts: [activity('d1'), activity('d1', '2026-09'), activity('d2')] }).total).toBe(60_000);
  });

  it('rejects a period after the payment month', () => {
    expect(() => charge({ concepts: [social, { ...social, period: '2026-11' }] })).toThrow(ValidationError);
    expect(() => charge({ concepts: [activity('d1', '2026-11')] })).toThrow(ValidationError);
  });

  it.each(['2026-10-5', '2026-13-01', '2026-02-30', '26-10-05', 'today'])('rejects payment date %s', (paymentDate) => {
    expect(() => charge({ paymentDate, concepts: [social] })).toThrow(ValidationError);
  });

  it('rejects an empty charge', () => {
    expect(() => charge({ concepts: [] })).toThrow(ValidationError);
  });

  it('rejects an activity without a discipline id and an unknown concept kind', () => {
    expect(() => charge({ concepts: [{ kind: 'activityFee', period: PERIOD, disciplineId: '' }] })).toThrow(
      ValidationError,
    );
    expect(() => charge({ concepts: [{ kind: 'mystery' } as unknown as ChargeConcept] })).toThrow(ValidationError);
  });

  it('rejects a duplicate carnet replacement in one charge', () => {
    expect(charge({ concepts: [carnet] }).total).toBe(3_000);
    expect(() => charge({ concepts: [carnet, carnet] })).toThrow(ValidationError);
  });

  it('keeps the total an integer sum of the lines', () => {
    const result = charge({ paymentDate: day(18), concepts: [social, activity('d1'), activity('d2')] });
    expect(result.total).toBe(result.lines.reduce((sum, line) => sum + line.amount, 0));
  });
});

describe('isDeregistered', () => {
  it.each([
    [0, false],
    [3, false],
    [4, true],
    [10, true],
  ])('%i unpaid months -> %s', (count, expected) => {
    expect(isDeregistered(count)).toBe(expected);
  });

  it('accepts a different threshold', () => {
    expect(isDeregistered(2, 1)).toBe(true);
    expect(isDeregistered(1, 1)).toBe(false);
  });

  it('rejects invalid counts and thresholds', () => {
    expect(() => isDeregistered(-1)).toThrow(ValidationError);
    expect(() => isDeregistered(1.5)).toThrow(ValidationError);
    expect(() => isDeregistered(2, -1)).toThrow(ValidationError);
  });
});
