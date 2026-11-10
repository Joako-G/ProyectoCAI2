import { Router } from 'express';
import type { Authenticator } from '../auth/auth.session.js';
import type { FaceEnrollmentService } from './face-enrollment.service.js';
import { parseCompleteEnrollmentBody, parseEnrollmentProgressBody, parseOpenEnrollmentBody } from './face.validation.js';

// Mounted at /api/faces/enrollments behind requireCapability('faces:manage'). The staff screen opens and follows a
// session; the public screen, signed in as a staff member too, reports progress and delivers the descriptor, which is
// never logged, echoed or returned.
export function createFaceEnrollmentRouter(service: FaceEnrollmentService, authenticate: Authenticator): Router {
  const router = Router();

  // Declared before /:id so "display" and "active" are never read as session ids.
  router.get('/display', (_request, response) => {
    response.json({ connected: service.displayConnected() });
  });

  router.get('/active', (_request, response) => {
    response.json({ session: service.active() ?? null });
  });

  router.post('/', async (request, response) => {
    const { memberId } = parseOpenEnrollmentBody(request.body);
    response.status(201).json({ session: await service.open(memberId, authenticate(request)!.id) });
  });

  router.get('/:id', (request, response) => {
    response.json(service.get(request.params.id));
  });

  router.post('/:id/progress', (request, response) => {
    response.json(service.progress(request.params.id, parseEnrollmentProgressBody(request.body)));
  });

  router.post('/:id/complete', async (request, response) => {
    await service.complete(request.params.id, parseCompleteEnrollmentBody(request.body).descriptor);
    response.status(204).end();
  });

  router.post('/:id/cancel', (request, response) => {
    service.cancel(request.params.id);
    response.status(204).end();
  });

  return router;
}
