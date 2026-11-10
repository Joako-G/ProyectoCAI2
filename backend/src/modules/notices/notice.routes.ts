import { Router } from 'express';
import { MailNotConfiguredError, MailSendError } from './notice.errors.js';
import type { NoticeService } from './notice.service.js';

// Mounted behind requireCapability('notices:read'): the secretary who can prepare the welcome link can email it too.
// Notices store nothing; the email is sent and forgotten, and no audit action fits a send (the audit actions are create, update, deactivate, reactivate, delete, annul and close).
export function createNoticeRouter(service: Pick<NoticeService, 'debtNotices' | 'welcomeNotice' | 'sendWelcomeEmail'>): Router {
  const router = Router();

  router.get('/debt', async (_request, response) => {
    response.json(await service.debtNotices());
  });

  router.get('/welcome/:paymentId', async (request, response) => {
    response.json(await service.welcomeNotice(request.params.paymentId));
  });

  router.post('/welcome/:paymentId/email', async (request, response) => {
    try {
      response.json(await service.sendWelcomeEmail(request.params.paymentId));
    } catch (error) {
      if (error instanceof MailNotConfiguredError) {
        response.status(503).json({ error: 'mail_not_configured', message: 'Email sending is not configured' });
      } else if (error instanceof MailSendError) {
        response.status(502).json({ error: 'mail_send_failed', message: 'The email could not be sent' });
      } else {
        throw error;
      }
    }
  });

  return router;
}
