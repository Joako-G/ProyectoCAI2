import { Router } from 'express';
import type { Authenticator } from '../auth/auth.session.js';
import type { BackupService } from './backup.service.js';

// Mounted behind requireCapability('backup:run'). The actor of a copy is always the signed-in user.
export function createBackupRouter(service: Pick<BackupService, 'status' | 'run'>, authenticate: Authenticator): Router {
  const router = Router();

  router.get('/', async (_request, response) => {
    response.json(await service.status());
  });

  router.post('/', async (request, response) => {
    const outcome = await service.run(authenticate(request)!.id);
    if (outcome.ok) {
      response.status(201).json(outcome.backup);
      return;
    }
    // The failure code only: the reason stays in the server log and never carries a path.
    response.status(500).json({ error: 'backup_failed', message: 'The backup could not be completed', code: outcome.failure.code });
  });

  return router;
}
