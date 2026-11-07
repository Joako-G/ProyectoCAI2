import { Router } from 'express';
import type { Authenticator } from '../auth/auth.session.js';
import type { AccessService } from './access.service.js';
import type { EntriesService } from './access.entries.js';
import { parseCheckBody, parseEntriesQuery } from './access.validation.js';

// Mounted behind requireCapability('access:check'). The DNI travels in the body, never in the URL, and is neither
// logged nor echoed. A check writes no audit entry: an identified entrance goes to the entry log instead.
export function createAccessRouter(
  service: Pick<AccessService, 'check'>,
  authenticate: Authenticator,
  entries?: Pick<EntriesService, 'list'>,
): Router {
  const router = Router();

  router.post('/check', async (request, response) => {
    const { dni } = parseCheckBody(request.body);
    response.json(await service.check(dni, { method: 'dni', actorId: authenticate(request)!.id }));
  });

  // The day's entries (RF-08). Without a database the log does not exist, so staff get a clear 503.
  router.get('/entries', async (request, response) => {
    const { date } = parseEntriesQuery(request.query);
    if (!entries) {
      response.status(503).json({ error: 'entries_unavailable', message: 'The entry log is not configured on this server' });
      return;
    }
    try {
      response.json(await entries.list(date));
    } catch (error) {
      // The driver's message can quote the connection; only its code is logged.
      const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : 'unknown';
      console.error(`Entry log read failed (code ${code})`);
      response.status(503).json({ error: 'entries_unavailable', message: 'The entry log is not available right now' });
    }
  });

  return router;
}
