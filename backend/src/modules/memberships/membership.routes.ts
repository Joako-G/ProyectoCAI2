import { Router } from 'express';
import { ValidationError } from '../../shared/errors.js';
import type { MembershipService } from './membership.service.js';
import type { MembershipListQuery, MembershipStatus } from './membership.types.js';

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function parseListQuery(query: Record<string, unknown>): MembershipListQuery {
  const { memberId, disciplineId, status } = query;
  // An empty value (`?status=`) comes from a cleared filter and means "no filter".
  if (status !== undefined && status !== '' && status !== 'active' && status !== 'ended') {
    throw new ValidationError({ status: 'Status must be "active" or "ended"' });
  }
  return {
    memberId: optionalText(memberId),
    disciplineId: optionalText(disciplineId),
    status: status === '' ? undefined : (status as MembershipStatus | undefined),
  };
}

export function createMembershipsRouter(service: MembershipService): Router {
  const router = Router();

  router.get('/', async (request, response) => {
    response.json(await service.list(parseListQuery(request.query)));
  });

  router.get('/:id', async (request, response) => {
    response.json(await service.getById(request.params.id));
  });

  return router;
}
