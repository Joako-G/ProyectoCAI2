import { Router } from 'express';
import { ValidationError } from '../../shared/errors.js';
import type { Authenticator } from '../auth/auth.session.js';
import type { DisciplineStaffing } from './discipline.staffing.js';
import type { DisciplineListQuery, DisciplineStatus } from './discipline.types.js';

function parseListQuery(query: Record<string, unknown>): DisciplineListQuery {
  const { search, status } = query;
  // An empty value (`?status=`) comes from a cleared filter and means "no filter".
  if (status !== undefined && status !== '' && status !== 'active' && status !== 'inactive') {
    throw new ValidationError({ status: 'Status must be "active" or "inactive"' });
  }
  return {
    search: typeof search === 'string' ? search : '',
    status: status === '' ? undefined : (status as DisciplineStatus | undefined),
  };
}

// The actor of every change is the signed-in user, never a value from the request body.
export function createDisciplinesRouter(service: DisciplineStaffing, authenticate: Authenticator): Router {
  const router = Router();

  router.get('/', async (request, response) => {
    response.json(await service.list(parseListQuery(request.query)));
  });

  // Before `/:id`, so "teachers" is never read as a discipline id.
  router.get('/teachers', (_request, response) => {
    response.json(service.teachers());
  });

  router.get('/:id', async (request, response) => {
    response.json(await service.getById(request.params.id));
  });

  router.post('/', async (request, response) => {
    response.status(201).json(await service.create(request.body, authenticate(request)!.id));
  });

  router.put('/:id', async (request, response) => {
    response.json(await service.update(request.params.id, request.body, authenticate(request)!.id));
  });

  router.post('/:id/deactivate', async (request, response) => {
    response.json(await service.deactivate(request.params.id, authenticate(request)!.id));
  });

  router.post('/:id/reactivate', async (request, response) => {
    response.json(await service.reactivate(request.params.id, authenticate(request)!.id));
  });

  return router;
}
