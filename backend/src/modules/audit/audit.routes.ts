import { Router } from 'express';
import type { AuditService } from './audit.service.js';

// Mounted behind requireCapability('audit:read'). Read-only on purpose: the log has no write route (RNF-08),
// and entries are only ever appended by the services that make the changes.
export function createAuditRouter(service: Pick<AuditService, 'list' | 'failures'>): Router {
  const router = Router();

  router.get('/', async (_request, response) => {
    let entries;
    try {
      entries = await service.list();
    } catch (error) {
      // Fail loudly rather than show a partial log. A specific code lets the screen say what is wrong; the
      // message names no path or file content.
      console.error('Could not read the audit log', error);
      response.status(500).json({ error: 'audit_unreadable', message: 'The audit log could not be read' });
      return;
    }
    response.json({ entries, failedWrites: service.failures() });
  });

  return router;
}
