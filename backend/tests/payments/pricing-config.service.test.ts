import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PRORATION_RULE,
  DEFAULT_SURCHARGE_TIERS,
  DEFAULT_TARIFF,
} from '../../src/modules/payments/pricing.js';
import { ConflictError, NotFoundError, ValidationError } from '../../src/shared/errors.js';
import { createTestContext, tariffFrom } from './pricing-config.helpers.js';

const cleanups: Array<() => Promise<void>> = [];

async function setup() {
  const context = await createTestContext();
  cleanups.push(context.cleanup);
  return context;
}

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!();
});

const DEFAULT_CONFIG = {
  tariffs: [DEFAULT_TARIFF],
  surchargeTiers: DEFAULT_SURCHARGE_TIERS,
  prorationRule: DEFAULT_PRORATION_RULE,
};

describe('pricing configuration: defaults', () => {
  it('returns the default configuration when the file is missing, without creating it', async () => {
    const { service, file } = await setup();
    expect(await service.get()).toEqual(DEFAULT_CONFIG);
    expect(existsSync(file)).toBe(false);
  });

  it('keeps the defaults and adds the change on the first write', async () => {
    const { service, file } = await setup();
    await service.addTariff(tariffFrom('2026-12', { activityFee: 25_000 }));
    const stored = JSON.parse(await readFile(file, 'utf8'));
    expect(stored.tariffs.map((tariff: { effectiveFrom: string }) => tariff.effectiveFrom)).toEqual(['2026-01', '2026-12']);
    expect(stored.surchargeTiers).toEqual(DEFAULT_SURCHARGE_TIERS);
    expect(stored.prorationRule).toEqual(DEFAULT_PRORATION_RULE);
  });
});

describe('pricing configuration: adding tariffs', () => {
  it('adds a future tariff and lists tariffs by effective date', async () => {
    const { service } = await setup();
    await service.addTariff(tariffFrom('2027-02'));
    await service.addTariff(tariffFrom('2026-12', { socialFee: 30_000 }));
    const { tariffs } = await service.get();
    expect(tariffs.map((tariff) => tariff.effectiveFrom)).toEqual(['2026-01', '2026-12', '2027-02']);
  });

  it('allows a tariff starting in the current club month', async () => {
    const { service } = await setup();
    await service.addTariff(tariffFrom('2026-10', { activityFee: 22_000 }));
    expect((await service.resolveForPeriod('2026-10')).tariff.activityFee).toBe(22_000);
  });

  it('rejects a tariff that starts in a past month and writes nothing', async () => {
    const { service, file } = await setup();
    const error = await service.addTariff(tariffFrom('2026-09')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fieldErrors).toHaveProperty('effectiveFrom');
    expect(existsSync(file)).toBe(false);
  });

  it('rejects a second tariff with the same effective date', async () => {
    const { service } = await setup();
    await service.addTariff(tariffFrom('2026-12'));
    await expect(service.addTariff(tariffFrom('2026-12', { activityFee: 1 }))).rejects.toBeInstanceOf(ConflictError);
    expect((await service.get()).tariffs).toHaveLength(2);
  });

  it.each([
    ['negative amount', { socialFee: -1 }],
    ['decimal amount', { activityFee: 100.5 }],
    ['string amount', { enrollment: '20000' as unknown as number }],
    ['malformed period', { effectiveFrom: '2026-13' }],
  ])('rejects a tariff with a %s', async (_label, overrides) => {
    const { service, file } = await setup();
    await expect(service.addTariff(tariffFrom('2026-12', overrides))).rejects.toBeInstanceOf(ValidationError);
    expect(existsSync(file)).toBe(false);
  });
});

describe('pricing configuration: replacing tariffs', () => {
  it('replaces the amounts of a future tariff', async () => {
    const { service } = await setup();
    await service.addTariff(tariffFrom('2026-12'));
    const replaced = await service.replaceTariff('2026-12', tariffFrom('2026-12', { activityFee: 30_000 }));
    expect(replaced.activityFee).toBe(30_000);
    expect((await service.resolveForPeriod('2026-12')).tariff.activityFee).toBe(30_000);
  });

  it('allows editing the tariff of the current month', async () => {
    const { service } = await setup();
    await service.addTariff(tariffFrom('2026-10'));
    await service.replaceTariff('2026-10', tariffFrom('2026-10', { carnetReplacement: 4_000 }));
    expect((await service.resolveForPeriod('2026-10')).tariff.carnetReplacement).toBe(4_000);
  });

  it('refuses to replace a tariff of a past month', async () => {
    const { service } = await setup();
    await expect(service.replaceTariff('2026-01', tariffFrom('2026-01', { activityFee: 1 }))).rejects.toBeInstanceOf(ConflictError);
    expect((await service.get()).tariffs).toEqual([DEFAULT_TARIFF]);
  });

  it('rejects a body whose effective date differs from the target', async () => {
    const { service } = await setup();
    await service.addTariff(tariffFrom('2026-12'));
    await expect(service.replaceTariff('2026-12', tariffFrom('2027-01'))).rejects.toBeInstanceOf(ValidationError);
  });

  it('answers not found for a tariff that does not exist and validates the period', async () => {
    const { service } = await setup();
    await expect(service.replaceTariff('2027-05', tariffFrom('2027-05'))).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.replaceTariff('soon', tariffFrom('2027-05'))).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects invalid amounts on replace and leaves the tariff as it was', async () => {
    const { service } = await setup();
    await service.addTariff(tariffFrom('2026-12'));
    await expect(service.replaceTariff('2026-12', tariffFrom('2026-12', { socialFee: -5 }))).rejects.toBeInstanceOf(ValidationError);
    expect((await service.resolveForPeriod('2026-12')).tariff.socialFee).toBe(DEFAULT_TARIFF.socialFee);
  });
});

describe('pricing configuration: deleting tariffs', () => {
  it('deletes a future tariff', async () => {
    const { service } = await setup();
    await service.addTariff(tariffFrom('2026-12'));
    await service.deleteTariff('2026-12');
    expect((await service.get()).tariffs).toEqual([DEFAULT_TARIFF]);
  });

  it('refuses to delete a tariff of a past month', async () => {
    const { service } = await setup();
    await expect(service.deleteTariff('2026-01')).rejects.toBeInstanceOf(ConflictError);
    expect((await service.get()).tariffs).toEqual([DEFAULT_TARIFF]);
  });

  it('deletes the current-month tariff when an earlier one still covers the month', async () => {
    const { service } = await setup();
    await service.addTariff(tariffFrom('2026-10', { activityFee: 22_000 }));
    await service.deleteTariff('2026-10');
    expect((await service.resolveForPeriod('2026-10')).tariff).toEqual(DEFAULT_TARIFF);
  });

  it('refuses to delete the tariff that is the only one covering the current month', async () => {
    const { service, file } = await setup();
    const only = { ...DEFAULT_CONFIG, tariffs: [tariffFrom('2026-10')] };
    await writeFile(file, JSON.stringify(only));
    await service.addTariff(tariffFrom('2026-12'));
    await expect(service.deleteTariff('2026-10')).rejects.toBeInstanceOf(ConflictError);
    expect((await service.get()).tariffs.map((tariff) => tariff.effectiveFrom)).toEqual(['2026-10', '2026-12']);
  });

  it('answers not found for an unknown tariff', async () => {
    const { service } = await setup();
    await expect(service.deleteTariff('2027-05')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('pricing configuration: surcharge tiers and proration rule', () => {
  it('replaces the surcharge tiers', async () => {
    const { service } = await setup();
    const tiers = [{ fromDay: 1, amount: 0 }, { fromDay: 8, amount: 4_000 }];
    expect(await service.replaceSurchargeTiers(tiers)).toEqual(tiers);
    expect((await service.get()).surchargeTiers).toEqual(tiers);
  });

  it.each([
    ['empty', []],
    ['not starting on day 1', [{ fromDay: 2, amount: 0 }]],
    ['descending', [{ fromDay: 1, amount: 0 }, { fromDay: 20, amount: 1 }, { fromDay: 10, amount: 2 }]],
    ['with a negative amount', [{ fromDay: 1, amount: -1 }]],
    ['beyond the month', [{ fromDay: 1, amount: 0 }, { fromDay: 32, amount: 1 }]],
  ])('rejects tiers that are %s and writes nothing', async (_label, tiers) => {
    const { service, file } = await setup();
    await expect(service.replaceSurchargeTiers(tiers)).rejects.toBeInstanceOf(ValidationError);
    expect(existsSync(file)).toBe(false);
  });

  it('replaces the proration rule', async () => {
    const { service } = await setup();
    const rule = { afterDay: 20, activityPercent: 60 };
    expect(await service.replaceProrationRule(rule)).toEqual(rule);
    expect((await service.get()).prorationRule).toEqual(rule);
  });

  it.each([
    { afterDay: 0, activityPercent: 50 },
    { afterDay: 15, activityPercent: 101 },
    { afterDay: 15, activityPercent: 50.5 },
    { afterDay: 15, activityPercent: -1 },
  ])('rejects the proration rule %j', async (rule) => {
    const { service, file } = await setup();
    await expect(service.replaceProrationRule(rule)).rejects.toBeInstanceOf(ValidationError);
    expect(existsSync(file)).toBe(false);
  });

  it('keeps tariffs untouched when tiers or the rule change', async () => {
    const { service } = await setup();
    await service.addTariff(tariffFrom('2026-12'));
    await service.replaceSurchargeTiers([{ fromDay: 1, amount: 0 }]);
    await service.replaceProrationRule({ afterDay: 10, activityPercent: 70 });
    expect((await service.get()).tariffs).toHaveLength(2);
  });
});

describe('pricing configuration: resolveForPeriod', () => {
  it('picks the tariff in force on each side of a price change, with tiers and rule', async () => {
    const { service } = await setup();
    await service.addTariff(tariffFrom('2026-12', { activityFee: 25_000 }));
    const before = await service.resolveForPeriod('2026-11');
    const after = await service.resolveForPeriod('2026-12');
    expect(before.tariff.activityFee).toBe(DEFAULT_TARIFF.activityFee);
    expect(after.tariff.activityFee).toBe(25_000);
    expect(after.surchargeTiers).toEqual(DEFAULT_SURCHARGE_TIERS);
    expect(after.prorationRule).toEqual(DEFAULT_PRORATION_RULE);
  });

  it('keeps answering past months with the tariff they were charged at', async () => {
    const { service } = await setup();
    await service.addTariff(tariffFrom('2026-12', { activityFee: 25_000 }));
    expect((await service.resolveForPeriod('2026-03')).tariff).toEqual(DEFAULT_TARIFF);
  });

  it('answers not found before any tariff and rejects a malformed period', async () => {
    const { service } = await setup();
    await expect(service.resolveForPeriod('2025-12')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.resolveForPeriod('2026/10')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('pricing configuration: file integrity', () => {
  it.each([
    ['invalid JSON', '{not json'],
    ['a JSON array', '[]'],
    ['no tariffs', JSON.stringify({ ...DEFAULT_CONFIG, tariffs: [] })],
    ['a malformed tariff', JSON.stringify({ ...DEFAULT_CONFIG, tariffs: [{ effectiveFrom: '2026-01' }] })],
    ['duplicate tariff dates', JSON.stringify({ ...DEFAULT_CONFIG, tariffs: [DEFAULT_TARIFF, DEFAULT_TARIFF] })],
    ['invalid tiers', JSON.stringify({ ...DEFAULT_CONFIG, surchargeTiers: [{ fromDay: 5, amount: 0 }] })],
    ['a missing proration rule', JSON.stringify({ tariffs: [DEFAULT_TARIFF], surchargeTiers: DEFAULT_SURCHARGE_TIERS })],
  ])('refuses a file with %s and leaves it untouched', async (_label, content) => {
    const { service, file } = await setup();
    await writeFile(file, content);
    await expect(service.get()).rejects.toThrow();
    await expect(service.addTariff(tariffFrom('2026-12'))).rejects.toThrow();
    await expect(service.replaceProrationRule({ afterDay: 10, activityPercent: 10 })).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe(content);
  });

  it('keeps a valid file when writes run concurrently', async () => {
    const { service, file } = await setup();
    const periods = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04'];
    await Promise.all([
      ...periods.map((period) => service.addTariff(tariffFrom(period))),
      service.replaceSurchargeTiers([{ fromDay: 1, amount: 0 }, { fromDay: 5, amount: 1_000 }]),
      service.replaceProrationRule({ afterDay: 12, activityPercent: 40 }),
    ]);
    const stored = JSON.parse(await readFile(file, 'utf8'));
    expect(stored.tariffs).toHaveLength(periods.length + 1);
    expect(stored.surchargeTiers).toHaveLength(2);
    expect(stored.prorationRule).toEqual({ afterDay: 12, activityPercent: 40 });
    expect(await service.get()).toEqual(stored);
  });
});
