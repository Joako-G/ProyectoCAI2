import { Router } from 'express';
import type { Authenticator } from '../auth/auth.session.js';
import type { RosterService } from './roster.service.js';

// The disciplines always come from the signed-in teacher's own account, never from the request.
export function createRosterRouter(service: RosterService, authenticate: Authenticator): Router {
  const router = Router();

  router.get('/', async (request, response) => {
    const user = authenticate(request);
    response.json(await service.forDisciplines(user?.disciplineIds ?? []));
  });

  return router;
}
