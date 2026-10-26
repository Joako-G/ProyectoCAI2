import { describe, expect, it } from 'vitest';
import { createRosterService } from '../../src/modules/roster/roster.service.js';

interface MembershipRow {
  memberId: string;
  disciplineId: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'ended';
}

const members = [
  { id: 'm1', memberNumber: '0001', firstName: 'Lucía', lastName: 'Ríos', dni: '30111222', whatsapp: '+54 9 381 555-0001', birthDate: '1990-03-15', email: 'lucia@club.test' },
  { id: 'm2', memberNumber: '0002', firstName: 'Tomás', lastName: 'Gómez', dni: '50111222', whatsapp: '+54 9 381 555-0002', birthDate: '2014-06-01', guardian: { name: 'Ana', contact: '555' } },
  { id: 'm3', memberNumber: '0003', firstName: 'Abel', lastName: 'Paz', dni: '28111222', whatsapp: '+54 9 381 555-0003', birthDate: '1985-01-01' },
];
const disciplines = [
  { id: 'd-volley', name: 'Vóley', teachers: ['X'], leadTeacher: 'X', status: 'active' },
  { id: 'd-basket', name: 'Básquet', teachers: ['Y'], leadTeacher: 'Y', status: 'active' },
  { id: 'd-other', name: 'Natación', teachers: ['Z'], leadTeacher: 'Z', status: 'active' },
];

function build(memberships: Array<Pick<MembershipRow, 'memberId' | 'disciplineId'> & Partial<MembershipRow>>) {
  const rows = memberships.map((row): MembershipRow => ({ status: 'active', startDate: '2026-01-10', ...row }));
  return createRosterService({
    memberships: { list: async ({ disciplineId }) => rows.filter((row) => row.disciplineId === disciplineId) },
    members: { list: async () => members },
    disciplines: { findByIds: async (ids) => disciplines.filter((discipline) => ids.includes(discipline.id)) },
  });
}

describe('roster service', () => {
  it('lists current and past students of each assigned discipline with only the allowed fields', async () => {
    const service = build([
      { memberId: 'm1', disciplineId: 'd-basket', startDate: '2026-02-01' },
      { memberId: 'm2', disciplineId: 'd-basket', startDate: '2025-03-01', status: 'ended', endDate: '2025-12-15' },
      { memberId: 'm3', disciplineId: 'd-other' },
    ]);
    const roster = await service.forDisciplines(['d-basket']);
    expect(roster).toEqual([{
      discipline: { id: 'd-basket', name: 'Básquet' },
      students: [
        { memberId: 'm1', memberNumber: '0001', fullName: 'Lucía Ríos', startDate: '2026-02-01', status: 'active' },
        { memberId: 'm2', memberNumber: '0002', fullName: 'Tomás Gómez', startDate: '2025-03-01', endDate: '2025-12-15', status: 'ended' },
      ],
    }]);
    const serialized = JSON.stringify(roster);
    for (const secret of ['30111222', '555', 'lucia@club.test', '1990-03-15', 'Ana']) expect(serialized).not.toContain(secret);
  });

  it('sorts students active first, then by name, and disciplines by name', async () => {
    const service = build([
      { memberId: 'm1', disciplineId: 'd-basket', status: 'ended', endDate: '2026-03-01' },
      { memberId: 'm2', disciplineId: 'd-basket' },
      { memberId: 'm3', disciplineId: 'd-basket' },
      { memberId: 'm1', disciplineId: 'd-volley' },
    ]);
    const roster = await service.forDisciplines(['d-volley', 'd-basket']);
    expect(roster.map((entry) => entry.discipline.name)).toEqual(['Básquet', 'Vóley']);
    expect(roster[0]!.students.map((student) => student.fullName)).toEqual(['Abel Paz', 'Tomás Gómez', 'Lucía Ríos']);
  });

  it('skips unknown discipline ids and memberships of unknown members', async () => {
    const service = build([{ memberId: 'ghost', disciplineId: 'd-basket' }, { memberId: 'm1', disciplineId: 'd-basket' }]);
    const roster = await service.forDisciplines(['removed', 'd-basket', 'd-basket']);
    expect(roster).toHaveLength(1);
    expect(roster[0]!.students.map((student) => student.memberId)).toEqual(['m1']);
  });

  it('returns no rosters for a teacher without disciplines', async () => {
    expect(await build([{ memberId: 'm1', disciplineId: 'd-basket' }]).forDisciplines([])).toEqual([]);
  });

  it('keeps a discipline with no students as an empty block', async () => {
    expect(await build([]).forDisciplines(['d-volley'])).toEqual([{ discipline: { id: 'd-volley', name: 'Vóley' }, students: [] }]);
  });
});
