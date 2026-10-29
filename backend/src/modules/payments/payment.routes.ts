import { Router } from 'express';
import { requireCapability } from '../../middlewares/require-role.js';
import type { Authenticator } from '../auth/auth.session.js';
import type { PaymentService } from './payment.service.js';
import { parseAnnulBody, parseEnrollmentPreviewBody, parsePreviewBody, parseReceiptNumber, parseRegisterBody } from './payment.validation.js';

// Mounted behind requireCapability('payments:read'); each write route adds its own capability.
// The actor of a payment or annulment is always the signed-in user, never a value from the request body.
export function createPaymentRouter(service: PaymentService, authenticate: Authenticator): Router {
  const router = Router();
  const collect = requireCapability(authenticate, 'payments:collect');
  const annul = requireCapability(authenticate, 'payments:annul');

  router.get('/members/:memberId/account', async (request, response) => {
    response.json(await service.account(request.params.memberId));
  });

  router.get('/members/:memberId', async (request, response) => {
    response.json(await service.history(request.params.memberId));
  });

  router.get('/receipts/:receiptNumber', async (request, response) => {
    response.json(await service.getReceipt(parseReceiptNumber(request.params.receiptNumber)));
  });

  router.post('/preview', collect, async (request, response) => {
    const { memberId, concepts, registration } = parsePreviewBody(request.body);
    response.json(await service.preview(memberId, concepts, registration ? { registration } : {}));
  });

  router.post('/enrollment-preview', collect, async (request, response) => {
    response.json(await service.previewEnrollment(parseEnrollmentPreviewBody(request.body).disciplineIds));
  });

  router.post('/', collect, async (request, response) => {
    const { memberId, ...input } = parseRegisterBody(request.body);
    response.status(201).json(await service.register(memberId, input, authenticate(request)!.id));
  });

  router.post('/:id/annul', annul, async (request, response) => {
    const { reason } = parseAnnulBody(request.body);
    response.json(await service.annul(String(request.params.id), reason, authenticate(request)!.id));
  });

  return router;
}
