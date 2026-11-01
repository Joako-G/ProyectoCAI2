import { Router } from 'express';
import { ValidationError } from '../../shared/errors.js';
import type { Authenticator } from '../auth/auth.session.js';
import type { MemberService } from './member.service.js';
import type { MemberListQuery, MemberStatus } from './member.types.js';

function parseListQuery(query: Record<string, unknown>): MemberListQuery {
  const { search, status, disciplineId } = query;
  // An empty value (`?status=`) comes from a cleared filter and means "no filter".
  if (status !== undefined && status !== '' && status !== 'active' && status !== 'inactive') {
    throw new ValidationError({ status: 'Status must be "active" or "inactive"' });
  }
  return {
    search: typeof search === 'string' ? search : '',
    status: status === '' ? undefined : (status as MemberStatus | undefined),
    disciplineId: typeof disciplineId === 'string' && disciplineId !== '' ? disciplineId : undefined,
  };
}

// The actor of every change is the signed-in user, never a value from the request body.
export function createMembersRouter(service: MemberService, authenticate: Authenticator): Router {
  const router = Router();

  router.get('/', async (request, response) => {
    response.json(await service.list(parseListQuery(request.query)));
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
    response.json(await service.deactivate(request.params.id, request.body?.reason, authenticate(request)!.id));
  });

  router.post('/:id/reactivate', async (request, response) => {
    response.json(await service.reactivate(request.params.id, authenticate(request)!.id));
  });

  return router;
}
