import { Router } from 'express';
import type { Authenticator } from '../auth/auth.session.js';
import type { PricingConfigService } from './pricing-config.service.js';
import {
  parseNewTariff,
  parseProrationRule,
  parseSurchargeTiers,
  parseTariffReplacement,
} from './pricing-config.validation.js';

// The actor of every change is the signed-in user, never a value from the request body.
export function createPricingConfigRouter(service: PricingConfigService, authenticate: Authenticator): Router {
  const router = Router();

  router.get('/', async (_request, response) => {
    response.json(await service.get());
  });

  router.post('/tariffs', async (request, response) => {
    response.status(201).json(await service.addTariff(parseNewTariff(request.body), authenticate(request)!.id));
  });

  router.put('/tariffs/:effectiveFrom', async (request, response) => {
    const { effectiveFrom } = request.params;
    response.json(await service.replaceTariff(effectiveFrom, parseTariffReplacement(request.body, effectiveFrom), authenticate(request)!.id));
  });

  router.delete('/tariffs/:effectiveFrom', async (request, response) => {
    await service.deleteTariff(request.params.effectiveFrom, authenticate(request)!.id);
    response.status(204).end();
  });

  router.put('/surcharge-tiers', async (request, response) => {
    response.json(await service.replaceSurchargeTiers(parseSurchargeTiers(request.body), authenticate(request)!.id));
  });

  router.put('/proration-rule', async (request, response) => {
    response.json(await service.replaceProrationRule(parseProrationRule(request.body), authenticate(request)!.id));
  });

  return router;
}
