import type { Discipline } from '../types/discipline';

export function buildDiscipline(overrides: Partial<Discipline> = {}): Discipline {
  return {
    id: 'disc-1',
    name: 'Básquet',
    teacherName: 'Marcos Peña',
    status: 'active',
    createdAt: '2026-10-21T15:00:00.000Z',
    ...overrides,
  };
}
