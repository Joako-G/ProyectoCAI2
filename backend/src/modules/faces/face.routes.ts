import { Router } from 'express';
import type { Authenticator } from '../auth/auth.session.js';
import type { FaceService } from './face.service.js';
import { parseEnrollBody, parseRecognizeBody } from './face.validation.js';

// Mounted behind requireCapability('faces:manage'). Descriptors travel in the body only and are never logged,
// echoed or returned; GET answers whether a face is enrolled, nothing more.
export function createFaceRouter(service: FaceService, authenticate: Authenticator): Router {
  const router = Router();

  // It writes no audit entry: an identified entrance goes to the entry log instead (like POST /api/access/check).
  router.post('/recognize', async (request, response) => {
    response.json(await service.recognize(parseRecognizeBody(request.body).descriptor, authenticate(request)!.id));
  });

  // Declared before /:memberId so "summary" is never read as a member id. Read-only, so it writes no audit entry.
  router.get('/summary', async (_request, response) => {
    response.json(await service.summary());
  });

  router.get('/:memberId', async (request, response) => {
    response.json(await service.status(request.params.memberId));
  });

  router.put('/:memberId', async (request, response) => {
    await service.enroll(request.params.memberId, parseEnrollBody(request.body), authenticate(request)!.id);
    response.status(204).end();
  });

  router.delete('/:memberId', async (request, response) => {
    await service.remove(request.params.memberId, authenticate(request)!.id);
    response.status(204).end();
  });

  return router;
}

/** Stands in for the router while there is no database, so staff get a clear answer instead of a missing route. */
export function createFacesUnavailableRouter(): Router {
  const router = Router();
  router.use((_request, response) => {
    response.status(503).json({ error: 'faces_unavailable', message: 'Face recognition is not configured on this server' });
  });
  return router;
}
