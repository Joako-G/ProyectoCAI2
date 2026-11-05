import { Router } from 'express';
import type { NoticeService } from './notice.service.js';

// Mounted behind requireCapability('notices:read'). Notices only read: there is no write route.
export function createNoticeRouter(service: Pick<NoticeService, 'debtNotices'>): Router {
  const router = Router();

  router.get('/debt', async (_request, response) => {
    response.json(await service.debtNotices());
  });

  return router;
}
