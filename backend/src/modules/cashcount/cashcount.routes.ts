import { Router } from 'express';
import type { Authenticator } from '../auth/auth.session.js';
import type { CashCountService } from './cashcount.service.js';

// Mounted behind requireCapability('cashcount:run'). The actor of a close is always the signed-in user, and
// the service picks only the counted cash and the note from the body: the date and the totals are its own.
export function createCashCountRouter(service: CashCountService, authenticate: Authenticator): Router {
  const router = Router();

  router.get('/today', async (_request, response) => {
    response.json(await service.preview());
  });

  router.get('/', async (_request, response) => {
    response.json(await service.history());
  });

  router.post('/', async (request, response) => {
    response.status(201).json(await service.close(request.body ?? {}, authenticate(request)!.id));
  });

  return router;
}
