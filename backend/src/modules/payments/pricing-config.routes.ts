import { Router } from 'express';
import type { PricingConfigService } from './pricing-config.service.js';
import {
  parseNewTariff,
  parseProrationRule,
  parseSurchargeTiers,
  parseTariffReplacement,
} from './pricing-config.validation.js';

export function createPricingConfigRouter(service: PricingConfigService): Router {
  const router = Router();

  router.get('/', async (_request, response) => {
    response.json(await service.get());
  });

  router.post('/tariffs', async (request, response) => {
    response.status(201).json(await service.addTariff(parseNewTariff(request.body)));
  });

  router.put('/tariffs/:effectiveFrom', async (request, response) => {
    const { effectiveFrom } = request.params;
    response.json(await service.replaceTariff(effectiveFrom, parseTariffReplacement(request.body, effectiveFrom)));
  });

  router.delete('/tariffs/:effectiveFrom', async (request, response) => {
    await service.deleteTariff(request.params.effectiveFrom);
    response.status(204).end();
  });

  router.put('/surcharge-tiers', async (request, response) => {
    response.json(await service.replaceSurchargeTiers(parseSurchargeTiers(request.body)));
  });

  router.put('/proration-rule', async (request, response) => {
    response.json(await service.replaceProrationRule(parseProrationRule(request.body)));
  });

  return router;
}
