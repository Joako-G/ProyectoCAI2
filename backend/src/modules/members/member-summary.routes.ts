import { Router } from 'express';
import type { MemberSummaryService } from './member-summary.service.js';

// Mounted at /api/members/summary behind requireCapability('members:read'), before the members router so
// "summary" is never taken as a member id. Read-only: the router has no write route.
export function createMemberSummaryRouter(service: MemberSummaryService): Router {
  const router = Router();

  router.get('/', async (_request, response) => {
    response.json(await service.summary());
  });

  return router;
}
