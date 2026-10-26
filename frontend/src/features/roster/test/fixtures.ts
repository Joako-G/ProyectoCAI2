import type { DisciplineRoster, RosterStudent } from '../types/roster';

export function buildStudent(overrides: Partial<RosterStudent> = {}): RosterStudent {
  return {
    memberId: 'member-1',
    memberNumber: '0001',
    fullName: 'Lucía Ríos',
    startDate: '2026-02-01',
    status: 'active',
    ...overrides,
  };
}

export function buildRoster(overrides: Partial<DisciplineRoster> = {}): DisciplineRoster {
  return { discipline: { id: 'disc-1', name: 'Básquet' }, students: [buildStudent()], ...overrides };
}
