import { Router } from 'express';
import type { NoticeService } from './notice.service.js';

// Mounted behind requireCapability('notices:read'). Notices only read: they prepare links and store nothing.
export function createNoticeRouter(service: Pick<NoticeService, 'debtNotices' | 'welcomeNotice'>): Router {
  const router = Router();

  router.get('/debt', async (_request, response) => {
    response.json(await service.debtNotices());
  });

  router.get('/welcome/:paymentId', async (request, response) => {
    response.json(await service.welcomeNotice(request.params.paymentId));
  });

  return router;
}
