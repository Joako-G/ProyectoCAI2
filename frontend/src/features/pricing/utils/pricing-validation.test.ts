import { describe, expect, it } from 'vitest';
import { currentMonth, validateProration, validateTariffForm, validateTiers } from './pricing-validation';

const amounts = { enrollment: '20000', socialFee: '15000', activityFee: '18000', carnetReplacement: '13000' };
const WHOLE_NUMBERS = 'Complete cada tramo con números enteros, sin decimales.';
const ASCENDING = 'Los días deben ir en orden estrictamente creciente.';

describe('currentMonth', () => {
  it('formats the local month as YYYY-MM', () => {
    expect(currentMonth(new Date(2026, 9, 26))).toBe('2026-10');
    expect(currentMonth(new Date(2027, 0, 1))).toBe('2027-01');
  });
});

describe('validateTiers', () => {
  const row = (fromDay: string, amount: string) => ({ fromDay, amount });

  it('returns the numeric tiers when they are valid', () => {
    expect(validateTiers([row('1', '0'), row('11', '10000')])).toEqual({ tiers: [{ fromDay: 1, amount: 0 }, { fromDay: 11, amount: 10000 }] });
  });

  it.each([
    ['no tiers', [], 'Agregue al menos un tramo.'],
    ['an empty value', [row('1', ''), row('11', '10')], WHOLE_NUMBERS],
    ['a decimal amount', [row('1', '10.5')], WHOLE_NUMBERS],
    ['a first tier after day 1', [row('2', '0')], 'El primer tramo debe empezar el día 1.'],
    ['a day above 31', [row('1', '0'), row('32', '5')], 'Los días deben estar entre 1 y 31.'],
    ['repeated days', [row('1', '0'), row('1', '5')], ASCENDING],
    ['descending days', [row('1', '0'), row('20', '5'), row('10', '8')], ASCENDING],
  ])('rejects %s', (_name, rows, error) => {
    expect(validateTiers(rows)).toEqual({ error });
  });
});

describe('validateProration', () => {
  it('accepts a day and a whole percentage', () => {
    expect(validateProration({ afterDay: '15', activityPercent: '50' })).toEqual({ errors: {}, rule: { afterDay: 15, activityPercent: 50 } });
    expect(validateProration({ afterDay: '31', activityPercent: '0' }).rule).toEqual({ afterDay: 31, activityPercent: 0 });
  });

  it('reports each invalid field', () => {
    expect(validateProration({ afterDay: '0', activityPercent: '101' }).errors).toEqual({
      afterDay: 'Ingrese un día entero entre 1 y 31.',
      activityPercent: 'Ingrese un porcentaje entero entre 0 y 100.',
    });
    expect(validateProration({ afterDay: '', activityPercent: '5.5' }).rule).toBeUndefined();
  });
});

describe('validateTariffForm', () => {
  it('returns a tariff from valid text values', () => {
    expect(validateTariffForm({ effectiveFrom: '2026-12', ...amounts }, '2026-10')).toEqual({
      errors: {},
      tariff: { effectiveFrom: '2026-12', enrollment: 20000, socialFee: 15000, activityFee: 18000, carnetReplacement: 13000 },
    });
  });

  it('requires the current month or later and whole non-negative amounts', () => {
    const result = validateTariffForm({ effectiveFrom: '2026-09', ...amounts, socialFee: '-1', activityFee: '1.5', enrollment: '' }, '2026-10');
    expect(result.tariff).toBeUndefined();
    expect(result.errors).toEqual({
      effectiveFrom: 'Elija el mes actual o uno posterior.',
      enrollment: 'Ingrese un monto entero en pesos.',
      socialFee: 'Ingrese un monto entero en pesos.',
      activityFee: 'Ingrese un monto entero en pesos.',
    });
  });

  it('asks for a month when none is chosen', () => {
    expect(validateTariffForm({ effectiveFrom: '', ...amounts }, '2026-10').errors.effectiveFrom).toBe('Elija el mes desde el cual rige la tarifa.');
  });
});
