import { toIsoDate } from '../../shared/date.js';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors.js';
import { changedFields } from '../audit/audit.fields.js';
import type { AuditRecorder } from '../audit/audit.service.js';
import type { PricingConfigRepository } from './pricing-config.repository.js';
import type { PricingConfig, PricingForPeriod } from './pricing-config.types.js';
import {
  assertPeriod,
  assertProrationRule,
  assertSurchargeTiers,
  assertTariff,
  resolveTariff,
} from './pricing.js';
import type { Period, ProrationRule, SurchargeTier, Tariff } from './pricing.types.js';

export interface PricingConfigServiceDeps {
  repository: PricingConfigRepository;
  audit: AuditRecorder;
  now?: () => Date;
}

function byEffectiveFrom(a: Tariff, b: Tariff): number {
  return a.effectiveFrom.localeCompare(b.effectiveFrom);
}

// Copies only the known fields so nothing else (a discount, a typo) reaches the file.
function copyTariff(tariff: Tariff): Tariff {
  const { effectiveFrom, enrollment, socialFee, activityFee, carnetReplacement } = tariff;
  return { effectiveFrom, enrollment, socialFee, activityFee, carnetReplacement };
}

export function createPricingConfigService({ repository, audit, now = () => new Date() }: PricingConfigServiceDeps) {
  // Tariffs are monthly, so "past" means an earlier month than the club-local current one.
  const currentMonth = (): Period => toIsoDate(now()).slice(0, 7);

  function requireExisting(tariffs: Tariff[], effectiveFrom: Period): number {
    const index = tariffs.findIndex((tariff) => tariff.effectiveFrom === effectiveFrom);
    if (index === -1) throw new NotFoundError(`No tariff starts on ${effectiveFrom}`);
    return index;
  }

  function assertNotPast(effectiveFrom: Period, action: string): void {
    if (effectiveFrom < currentMonth()) {
      throw new ConflictError(`The tariff starting on ${effectiveFrom} is in the past and cannot be ${action}`);
    }
  }

  return {
    async get(): Promise<PricingConfig> {
      const config = await repository.read();
      return { ...config, tariffs: [...config.tariffs].sort(byEffectiveFrom) };
    },

    // For the charge calculation: the tariff in force for a period plus the current tiers and rule.
    async resolveForPeriod(period: Period): Promise<PricingForPeriod> {
      const { tariffs, surchargeTiers, prorationRule } = await repository.read();
      return { tariff: resolveTariff(tariffs, period), surchargeTiers, prorationRule };
    },

    async addTariff(input: Tariff, actorId: string): Promise<Tariff> {
      assertTariff(input);
      if (input.effectiveFrom < currentMonth()) {
        throw new ValidationError({ effectiveFrom: 'Must be the current month or later' });
      }
      const tariff = copyTariff(input);
      const added = await repository.mutate((config) => {
        if (config.tariffs.some((existing) => existing.effectiveFrom === tariff.effectiveFrom)) {
          throw new ConflictError(`A tariff already starts on ${tariff.effectiveFrom}`);
        }
        return { config: { ...config, tariffs: [...config.tariffs, tariff].sort(byEffectiveFrom) }, result: tariff };
      });
      await audit.record({ actorId, action: 'create', entityType: 'tariff', entityId: added.effectiveFrom });
      return added;
    },

    async replaceTariff(effectiveFrom: Period, input: Tariff, actorId: string): Promise<Tariff> {
      assertPeriod(effectiveFrom, 'effectiveFrom');
      assertTariff(input);
      if (input.effectiveFrom !== effectiveFrom) {
        throw new ValidationError({ effectiveFrom: 'Must match the tariff being replaced' });
      }
      const tariff = copyTariff(input);
      let before!: Tariff;
      const replaced = await repository.mutate((config) => {
        const index = requireExisting(config.tariffs, effectiveFrom);
        assertNotPast(effectiveFrom, 'replaced');
        before = config.tariffs[index]!;
        const tariffs = config.tariffs.map((existing, position) => (position === index ? tariff : existing));
        return { config: { ...config, tariffs }, result: tariff };
      });
      await audit.record({
        actorId,
        action: 'update',
        entityType: 'tariff',
        entityId: replaced.effectiveFrom,
        changedFields: changedFields({ ...before }, { ...replaced }),
      });
      return replaced;
    },

    async deleteTariff(effectiveFrom: Period, actorId: string): Promise<void> {
      assertPeriod(effectiveFrom, 'effectiveFrom');
      await repository.mutate((config) => {
        const index = requireExisting(config.tariffs, effectiveFrom);
        assertNotPast(effectiveFrom, 'deleted');
        const tariffs = config.tariffs.filter((_tariff, position) => position !== index);
        try {
          resolveTariff(tariffs, currentMonth());
        } catch (error) {
          if (error instanceof NotFoundError) {
            throw new ConflictError('Deleting this tariff would leave no tariff in force for the current month');
          }
          throw error;
        }
        return { config: { ...config, tariffs }, result: undefined };
      });
      await audit.record({ actorId, action: 'delete', entityType: 'tariff', entityId: effectiveFrom });
    },

    async replaceSurchargeTiers(input: readonly SurchargeTier[], actorId: string): Promise<SurchargeTier[]> {
      assertSurchargeTiers(input);
      const surchargeTiers = input.map(({ fromDay, amount }) => ({ fromDay, amount }));
      let before!: SurchargeTier[];
      const replaced = await repository.mutate((config) => {
        before = config.surchargeTiers;
        return { config: { ...config, surchargeTiers }, result: surchargeTiers };
      });
      await audit.record({
        actorId,
        action: 'update',
        entityType: 'surcharge_tiers',
        entityId: 'surcharge_tiers',
        changedFields: changedFields({ surchargeTiers: before }, { surchargeTiers: replaced }),
      });
      return replaced;
    },

    async replaceProrationRule(input: ProrationRule, actorId: string): Promise<ProrationRule> {
      assertProrationRule(input);
      const prorationRule = { afterDay: input.afterDay, activityPercent: input.activityPercent };
      let before!: ProrationRule;
      const replaced = await repository.mutate((config) => {
        before = config.prorationRule;
        return { config: { ...config, prorationRule }, result: prorationRule };
      });
      await audit.record({
        actorId,
        action: 'update',
        entityType: 'proration_rule',
        entityId: 'proration_rule',
        changedFields: changedFields({ ...before }, { ...replaced }),
      });
      return replaced;
    },
  };
}

export type PricingConfigService = ReturnType<typeof createPricingConfigService>;
