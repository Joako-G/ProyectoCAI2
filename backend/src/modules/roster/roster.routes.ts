import { Router } from 'express';
import type { Authenticator } from '../auth/auth.session.js';
import type { RosterService } from './roster.service.js';

// Mounted behind requireCapability('roster:read'), which already answers 401/403; the check below only
// keeps this router safe if it is ever mounted without that guard.
// The disciplines always come from the signed-in teacher's own account, never from the request.
export function createRosterRouter(service: RosterService, authenticate: Authenticator): Router {
  const router = Router();

  router.get('/', async (request, response) => {
    const user = authenticate(request);
    if (!user) {
      response.status(401).json({ error: 'Authentication required' });
      return;
    }
    response.json(await service.forDisciplines(user.disciplineIds ?? []));
  });

  return router;
}
