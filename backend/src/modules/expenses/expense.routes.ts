import { Router } from 'express';
import { requireCapability } from '../../middlewares/require-role.js';
import type { Authenticator } from '../auth/auth.session.js';
import type { ExpenseService } from './expense.service.js';
import { parseCreateBody, parseQuery } from './expense.validation.js';

// Mounted behind requireCapability('expenses:read'); the write route adds its own capability.
// The actor of an expense is always the signed-in user, never a value from the request body.
export function createExpenseRouter(service: ExpenseService, authenticate: Authenticator): Router {
  const router = Router();
  const write = requireCapability(authenticate, 'expenses:write');

  router.get('/', async (request, response) => {
    response.json(await service.list(parseQuery(request.query)));
  });

  router.post('/', write, async (request, response) => {
    response.status(201).json(await service.create(parseCreateBody(request.body), authenticate(request)!.id));
  });

  return router;
}
