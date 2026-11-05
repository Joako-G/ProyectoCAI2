import { Router } from 'express';
import type { AccessService } from './access.service.js';
import { parseCheckBody } from './access.validation.js';

// Mounted behind requireCapability('access:check'). A check only reads, so it writes nothing and is not audited.
// The DNI travels in the body, never in the URL, and is neither logged nor echoed.
export function createAccessRouter(service: Pick<AccessService, 'check'>): Router {
  const router = Router();

  router.post('/check', async (request, response) => {
    response.json(await service.check(parseCheckBody(request.body).dni));
  });

  return router;
}
