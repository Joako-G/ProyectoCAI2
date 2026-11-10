import { Router } from 'express';
import type { AuditService } from './audit.service.js';
import { parseAuditQuery } from './audit.validation.js';

// Mounted behind requireCapability('audit:read'). Read-only on purpose: the log has no write route (RNF-08),
// and entries are only ever appended by the services that make the changes.
export function createAuditRouter(service: Pick<AuditService, 'list' | 'actors' | 'failures'>): Router {
  const router = Router();

  router.get('/', async (request, response) => {
    // A thrown ValidationError reaches the error handler, which answers 400 with the field errors.
    const query = parseAuditQuery(request.query);
    let entries;
    let actors;
    try {
      entries = await service.list(query);
      actors = await service.actors();
    } catch (error) {
      // Fail loudly rather than show a partial log. A specific code lets the screen say what is wrong; the
      // message names no path or file content.
      console.error('Could not read the audit log', error);
      response.status(500).json({ error: 'audit_unreadable', message: 'The audit log could not be read' });
      return;
    }
    response.json({ entries, failedWrites: service.failures(), actors });
  });

  return router;
}
