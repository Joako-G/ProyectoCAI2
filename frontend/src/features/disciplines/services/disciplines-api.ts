import { ApiError, request, sendJson } from '../../members/services/members-api';
import type { Discipline, DisciplineInput, DisciplineListQuery } from '../types/discipline';

// The HTTP plumbing and error contract are shared with the members client.
export { ApiError };

function buildListUrl({ search, status }: DisciplineListQuery): string {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (status !== 'all') params.set('status', status);
  const query = params.toString();
  return query ? `/api/disciplines?${query}` : '/api/disciplines';
}

function disciplineUrl(id: string, action = ''): string {
  return `/api/disciplines/${encodeURIComponent(id)}${action}`;
}

export function fetchDisciplines(query: DisciplineListQuery, signal?: AbortSignal): Promise<Discipline[]> {
  return request<Discipline[]>(buildListUrl(query), { signal });
}

export function createDiscipline(input: DisciplineInput): Promise<Discipline> {
  return request<Discipline>('/api/disciplines', sendJson('POST', input));
}

export function updateDiscipline(id: string, input: DisciplineInput): Promise<Discipline> {
  return request<Discipline>(disciplineUrl(id), sendJson('PUT', input));
}

export function deactivateDiscipline(id: string): Promise<Discipline> {
  return request<Discipline>(disciplineUrl(id, '/deactivate'), sendJson('POST'));
}

export function reactivateDiscipline(id: string): Promise<Discipline> {
  return request<Discipline>(disciplineUrl(id, '/reactivate'), sendJson('POST'));
}
