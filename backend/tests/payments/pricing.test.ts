import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '../../src/shared/errors.js';
import {
  DEFAULT_PRORATION_RULE,
  DEFAULT_SURCHARGE_TIERS,
  DEFAULT_TARIFF,
  assertMoney,
  assertSurchargeTiers,
  prorateActivityFee,
  resolveTariff,
  surchargeForDay,
} from '../../src/modules/payments/pricing.js';
import type { Tariff } from '../../src/modules/payments/pricing.types.js';

const OLD_TARIFF: Tariff = { ...DEFAULT_TARIFF, effectiveFrom: '2026-01' };
const NEW_TARIFF: Tariff = { ...DEFAULT_TARIFF, effectiveFrom: '2026-07', activityFee: 25_000 };

describe('assertMoney', () => {
  it('accepts zero and positive integer pesos', () => {
    expect(() => assertMoney(0, 'amount')).not.toThrow();
    expect(() => assertMoney(20_000, 'amount')).not.toThrow();
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects %s',
    (value) => {
      expect(() => assertMoney(value, 'amount')).toThrow(ValidationError);
    },
  );
});

describe('resolveTariff', () => {
  const tariffs = [NEW_TARIFF, OLD_TARIFF];

  it('keeps the older price for a period before the price change', () => {
    expect(resolveTariff(tariffs, '2026-06').activityFee).toBe(20_000);
  });

  it('uses the new price from its effective month onward', () => {
    expect(resolveTariff(tariffs, '2026-07').activityFee).toBe(25_000);
    expect(resolveTariff(tariffs, '2027-01').activityFee).toBe(25_000);
  });

  it('uses the tariff effective on the same month', () => {
    expect(resolveTariff(tariffs, '2026-01')).toEqual(OLD_TARIFF);
  });

  it('throws when no tariff applies to the period', () => {
    expect(() => resolveTariff(tariffs, '2025-12')).toThrow(NotFoundError);
    expect(() => resolveTariff([], '2026-01')).toThrow(NotFoundError);
  });

  it('rejects two tariffs sharing the same effective period instead of depending on input order', () => {
    const clash = { ...OLD_TARIFF, activityFee: 21_000 };
    expect(() => resolveTariff([OLD_TARIFF, clash], '2026-02')).toThrow(ValidationError);
    expect(() => resolveTariff([clash, OLD_TARIFF], '2026-02')).toThrow(ValidationError);
  });

  it('rejects a malformed period', () => {
    expect(() => resolveTariff(tariffs, '2026-13')).toThrow(ValidationError);
    expect(() => resolveTariff(tariffs, '2026-7')).toThrow(ValidationError);
  });

  it('rejects a tariff with an invalid amount or effective period', () => {
    expect(() => resolveTariff([{ ...OLD_TARIFF, socialFee: -1 }], '2026-02')).toThrow(ValidationError);
    expect(() => resolveTariff([{ ...OLD_TARIFF, effectiveFrom: 'soon' }], '2026-02')).toThrow(ValidationError);
  });
});

describe('default configuration', () => {
  it('matches the amounts agreed with the owner', () => {
    expect(DEFAULT_TARIFF).toMatchObject({
      enrollment: 20_000,
      socialFee: 20_000,
      activityFee: 20_000,
      carnetReplacement: 3_000,
    });
    expect(DEFAULT_PRORATION_RULE).toEqual({ afterDay: 15, activityPercent: 50 });
  });

  it('ships valid surcharge tiers', () => {
    expect(() => assertSurchargeTiers(DEFAULT_SURCHARGE_TIERS)).not.toThrow();
  });
});

describe('surchargeForDay', () => {
  it.each([
    [1, 0],
    [10, 0],
    [11, 3_000],
    [15, 3_000],
    [16, 5_000],
    [20, 5_000],
    [21, 7_000],
    [30, 7_000],
    [31, 7_000],
  ])('day %i costs %i', (day, expected) => {
    expect(surchargeForDay(DEFAULT_SURCHARGE_TIERS, day)).toBe(expected);
  });

  it('rejects a day outside 1-31', () => {
    expect(() => surchargeForDay(DEFAULT_SURCHARGE_TIERS, 0)).toThrow(ValidationError);
    expect(() => surchargeForDay(DEFAULT_SURCHARGE_TIERS, 32)).toThrow(ValidationError);
    expect(() => surchargeForDay(DEFAULT_SURCHARGE_TIERS, 10.5)).toThrow(ValidationError);
  });

  it('rejects tiers given out of order instead of guessing', () => {
    const shuffled = [...DEFAULT_SURCHARGE_TIERS].reverse();
    expect(() => surchargeForDay(shuffled, 12)).toThrow(ValidationError);
  });
});

describe('assertSurchargeTiers', () => {
  it('rejects an empty list', () => {
    expect(() => assertSurchargeTiers([])).toThrow(ValidationError);
  });

  it('rejects tiers that do not start at day 1', () => {
    expect(() => assertSurchargeTiers([{ fromDay: 2, amount: 0 }])).toThrow(ValidationError);
  });

  it('rejects tiers that are not strictly ascending', () => {
    expect(() =>
      assertSurchargeTiers([
        { fromDay: 1, amount: 0 },
        { fromDay: 11, amount: 3_000 },
        { fromDay: 11, amount: 5_000 },
      ]),
    ).toThrow(ValidationError);
    expect(() =>
      assertSurchargeTiers([
        { fromDay: 1, amount: 0 },
        { fromDay: 16, amount: 5_000 },
        { fromDay: 11, amount: 3_000 },
      ]),
    ).toThrow(ValidationError);
  });

  it('rejects a negative or fractional amount', () => {
    expect(() => assertSurchargeTiers([{ fromDay: 1, amount: -1 }])).toThrow(ValidationError);
    expect(() => assertSurchargeTiers([{ fromDay: 1, amount: 0.5 }])).toThrow(ValidationError);
  });

  it('rejects a start day above 31', () => {
    expect(() =>
      assertSurchargeTiers([
        { fromDay: 1, amount: 0 },
        { fromDay: 32, amount: 1_000 },
      ]),
    ).toThrow(ValidationError);
  });
});

describe('prorateActivityFee', () => {
  const rule = DEFAULT_PRORATION_RULE;

  it('halves the activity fee for a new member enrolling after the cutoff day', () => {
    expect(prorateActivityFee(20_000, rule, { isNewMember: true, enrollmentDay: 16 })).toBe(10_000);
    expect(prorateActivityFee(20_000, rule, { isNewMember: true, enrollmentDay: 31 })).toBe(10_000);
  });

  it('charges the full fee on the cutoff day itself', () => {
    expect(prorateActivityFee(20_000, rule, { isNewMember: true, enrollmentDay: 15 })).toBe(20_000);
  });

  it('never prorates an existing member', () => {
    expect(prorateActivityFee(20_000, rule, { isNewMember: false, enrollmentDay: 28 })).toBe(20_000);
  });

  it('honors a configured cutoff day and percentage', () => {
    const custom = { afterDay: 10, activityPercent: 25 };
    expect(prorateActivityFee(20_000, custom, { isNewMember: true, enrollmentDay: 11 })).toBe(5_000);
    expect(prorateActivityFee(20_000, custom, { isNewMember: true, enrollmentDay: 10 })).toBe(20_000);
  });

  it('rounds half up to whole pesos', () => {
    // 33% of 10,025 = 3,308.25 -> 3,308; 50% of 10,001 = 5,000.5 -> 5,001
    expect(prorateActivityFee(10_025, { afterDay: 15, activityPercent: 33 }, { isNewMember: true, enrollmentDay: 20 })).toBe(3_308);
    expect(prorateActivityFee(10_001, rule, { isNewMember: true, enrollmentDay: 20 })).toBe(5_001);
  });

  it('rejects an invalid fee, day or rule', () => {
    expect(() => prorateActivityFee(-1, rule, { isNewMember: true, enrollmentDay: 20 })).toThrow(ValidationError);
    expect(() => prorateActivityFee(20_000, rule, { isNewMember: true, enrollmentDay: 0 })).toThrow(ValidationError);
    expect(() =>
      prorateActivityFee(20_000, { afterDay: 15, activityPercent: 101 }, { isNewMember: true, enrollmentDay: 20 }),
    ).toThrow(ValidationError);
    expect(() =>
      prorateActivityFee(20_000, { afterDay: 0, activityPercent: 50 }, { isNewMember: true, enrollmentDay: 20 }),
    ).toThrow(ValidationError);
  });
});

// T2 will own the full calculation. These checks only prove that the T1 pieces compose into the
// amounts agreed in docs/team-handoff.md.
describe('handoff totals composed from the pricing functions', () => {
  const tariff = resolveTariff([DEFAULT_TARIFF], '2026-10');
  const tiers = DEFAULT_SURCHARGE_TIERS;

  function existingMemberTotal(paymentDays: number[]): number {
    const activities = paymentDays.reduce(
      (sum, day) => sum + tariff.activityFee + surchargeForDay(tiers, day),
      0,
    );
    return tariff.socialFee + activities;
  }

  it.each([
    [[5, 5], 60_000],
    [[5, 13], 63_000],
    [[13, 13], 66_000],
    [[18, 18], 70_000],
    [[21, 21], 74_000],
    [[31, 31], 74_000],
  ])('existing member with two activities paid on days %j totals %i', (days, expected) => {
    expect(existingMemberTotal(days)).toBe(expected);
  });

  it('adds only the enrollment for a new member paying on time', () => {
    expect(tariff.enrollment + existingMemberTotal([5, 5])).toBe(80_000);
  });

  it('charges a new member after the 15th half per activity but full social fee and enrollment', () => {
    const half = (day: number) =>
      prorateActivityFee(tariff.activityFee, DEFAULT_PRORATION_RULE, { isNewMember: true, enrollmentDay: day });
    expect(tariff.enrollment + tariff.socialFee + half(16)).toBe(50_000);
    expect(tariff.enrollment + tariff.socialFee + half(16) + half(16)).toBe(60_000);
  });

  it('charges an existing member adding an activity only the full activity fee', () => {
    const fee = prorateActivityFee(tariff.activityFee, DEFAULT_PRORATION_RULE, {
      isNewMember: false,
      enrollmentDay: 20,
    });
    expect(fee + surchargeForDay(tiers, 5)).toBe(20_000);
  });
});
