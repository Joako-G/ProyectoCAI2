import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJsonPricingConfigRepository } from '../../src/modules/payments/json-pricing-config.repository.js';
import { createPricingConfigService } from '../../src/modules/payments/pricing-config.service.js';
import { DEFAULT_TARIFF } from '../../src/modules/payments/pricing.js';
import type { Tariff } from '../../src/modules/payments/pricing.types.js';

/** 2026-10-05 in the club time zone: the current month is 2026-10. */
export const TODAY = new Date('2026-10-05T15:00:00Z');

export function tariffFrom(effectiveFrom: string, overrides: Partial<Tariff> = {}): Tariff {
  return { ...DEFAULT_TARIFF, effectiveFrom, ...overrides };
}

export async function createTestContext(now: () => Date = () => TODAY) {
  const dir = await mkdtemp(join(tmpdir(), 'pricing-config-'));
  const file = join(dir, 'pricing-config.json');
  const repository = createJsonPricingConfigRepository(file);
  const service = createPricingConfigService({ repository, now });
  return { service, repository, file, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
