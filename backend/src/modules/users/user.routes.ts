import { Router, type Response } from 'express';
import type { UserService } from './user.service.js';
import type { UserFailure, UserResult } from './user.types.js';

const failureResponses: Record<UserFailure, { status: number; error: string }> = {
  'invalid': { status: 400, error: 'Invalid user fields' },
  'duplicate-email': { status: 409, error: 'Email already exists' },
  'not-found': { status: 404, error: 'User not found' },
  'save-failed': { status: 500, error: 'Unable to save users' },
  'last-head-secretary': { status: 409, error: 'At least one active head secretary is required' },
};

function send(response: Response, result: UserResult, successStatus = 200): void {
  if (!result.ok) {
    const { status, error } = failureResponses[result.failure];
    response.status(status).json({ error });
    return;
  }
  response.status(successStatus).json(result.user);
}

export function createUsersRouter(service: UserService): Router {
  const router = Router();

  router.get('/', (_request, response) => { response.json(service.list()); });
  router.post('/', (request, response) => send(response, service.create(request.body), 201));
  router.patch('/:id', (request, response) => send(response, service.update(request.params.id, request.body)));
  router.delete('/:id', (request, response) => send(response, service.deactivate(request.params.id)));

  return router;
}
