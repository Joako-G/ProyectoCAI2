import { createJsonStore } from '../../database/json-store.js';
import { ValidationError } from '../../shared/errors.js';
import type { PricingConfigRepository } from './pricing-config.repository.js';
import type { PricingConfig } from './pricing-config.types.js';
import {
  DEFAULT_PRORATION_RULE,
  DEFAULT_SURCHARGE_TIERS,
  DEFAULT_TARIFF,
  assertProrationRule,
  assertSurchargeTiers,
  assertTariffs,
} from './pricing.js';

function defaultConfig(): PricingConfig {
  return {
    tariffs: [DEFAULT_TARIFF],
    surchargeTiers: [...DEFAULT_SURCHARGE_TIERS],
    prorationRule: DEFAULT_PRORATION_RULE,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createJsonPricingConfigRepository(filePath: string): PricingConfigRepository {
  const store = createJsonStore<PricingConfig>(filePath, defaultConfig());

  // A parsed-but-wrong file must never reach a mutation: writing back would destroy it.
  function assertConfig(value: unknown): PricingConfig {
    const reject = (reason: string): never => {
      throw new Error(`Invalid pricing config file ${filePath}: ${reason}`);
    };
    if (!isRecord(value)) return reject('it must contain a JSON object');
    const { tariffs, surchargeTiers, prorationRule } = value;
    if (!Array.isArray(tariffs) || tariffs.length === 0) return reject('tariffs must be a non-empty array');
    if (!Array.isArray(surchargeTiers)) return reject('surchargeTiers must be an array');
    if (!isRecord(prorationRule)) return reject('prorationRule must be an object');
    if (!tariffs.every(isRecord) || !surchargeTiers.every(isRecord)) return reject('tariffs and tiers must be objects');
    const config = value as unknown as PricingConfig;
    try {
      assertTariffs(config.tariffs);
      assertSurchargeTiers(config.surchargeTiers);
      assertProrationRule(config.prorationRule);
    } catch (error) {
      if (error instanceof ValidationError) return reject(Object.values(error.fieldErrors).join('; '));
      throw error;
    }
    return config;
  }

  return {
    read: async () => assertConfig(await store.read()),
    async mutate(change) {
      let result!: ReturnType<typeof change>['result'];
      await store.update((current) => {
        const outcome = change(assertConfig(current));
        result = outcome.result;
        return outcome.config;
      });
      return result;
    },
  };
}
