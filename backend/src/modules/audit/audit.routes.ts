import { Router } from 'express';
import type { AuditService } from './audit.service.js';

// Mounted behind requireCapability('audit:read'). Read-only on purpose: the log has no write route (RNF-08),
// and entries are only ever appended by the services that make the changes.
export function createAuditRouter(service: Pick<AuditService, 'list'>): Router {
  const router = Router();

  router.get('/', async (_request, response) => {
    response.json(await service.list());
  });

  return router;
}
