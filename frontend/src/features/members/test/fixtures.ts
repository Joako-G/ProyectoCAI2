import type { Member } from '../types/member';

export function buildMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'member-1',
    memberNumber: '0001',
    firstName: 'Lucía',
    lastName: 'Ríos',
    dni: '30123456',
    birthDate: '1990-03-15',
    category: 'Mayor',
    memberSince: '2015-02-01',
    whatsapp: '1155551234',
    status: 'active',
    createdAt: '2026-10-05T15:00:00.000Z',
    updatedAt: '2026-10-05T15:00:00.000Z',
    ...overrides,
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
