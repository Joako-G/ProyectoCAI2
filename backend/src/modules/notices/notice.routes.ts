import { Router } from 'express';
import { MailAlreadySentError, MailNotConfiguredError, MailSendError, MailSendInProgressError, MailSendUncertainError } from './notice.errors.js';
import type { NoticeService } from './notice.service.js';

// Mounted behind requireCapability('notices:read'): the secretary who can prepare the welcome link can email it too.
// Notices store nothing durable; the send state per payment lives in memory and is lost on restart, and no audit action fits a send (the audit actions are create, update, deactivate, reactivate, delete, annul and close).
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
      const resend = (request.body as { resend?: unknown } | undefined)?.resend === true;
      response.json(await service.sendWelcomeEmail(request.params.paymentId, { resend }));
    } catch (error) {
      if (error instanceof MailNotConfiguredError) {
        response.status(503).json({ error: 'mail_not_configured', message: 'Email sending is not configured' });
      } else if (error instanceof MailSendInProgressError) {
        response.status(409).json({ error: 'mail_send_in_progress', message: 'An email for this payment is already being sent' });
      } else if (error instanceof MailAlreadySentError) {
        response.status(409).json({ error: 'mail_already_sent', message: 'The email for this payment was already sent', lastSend: error.lastSend });
      } else if (error instanceof MailSendUncertainError) {
        response.status(504).json({ error: 'mail_send_uncertain', message: 'The email may or may not have been sent' });
      } else if (error instanceof MailSendError) {
        response.status(502).json({ error: 'mail_send_failed', message: 'The email could not be sent' });
      } else {
        throw error;
      }
    }
  });

  return router;
}
