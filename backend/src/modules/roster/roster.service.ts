import type { DisciplineRoster, RosterStudent } from './roster.types.js';

// Ports owned by the roster module; the memberships, members and disciplines services satisfy them.
// They are wider than needed on purpose (extra fields are never read), so the services plug in as they are.
export interface RosterDeps {
  memberships: {
    list(query: { disciplineId: string }): Promise<
      Array<{ memberId: string; startDate: string; endDate?: string; status: 'active' | 'ended' }>
    >;
  };
  members: { list(): Promise<Array<{ id: string; memberNumber: string; firstName: string; lastName: string }>> };
  disciplines: { findByIds(ids: readonly string[]): Promise<Array<{ id: string; name: string }>> };
}

const byName = (a: string, b: string) => a.localeCompare(b, 'es');

// Active students first, then alphabetical by name, then by start date.
function compareStudents(a: RosterStudent, b: RosterStudent): number {
  return Number(b.status === 'active') - Number(a.status === 'active')
    || byName(a.fullName, b.fullName)
    || a.startDate.localeCompare(b.startDate);
}

export function createRosterService({ memberships, members, disciplines }: RosterDeps) {
  return {
    // The rosters of the given disciplines (a teacher's own), one block per discipline sorted by name.
    // Unknown or removed ids are skipped; a member who joined, left and rejoined appears once per period.
    async forDisciplines(disciplineIds: readonly string[]): Promise<DisciplineRoster[]> {
      const ids = [...new Set(disciplineIds)];
      if (ids.length === 0) return [];
      const [found, allMembers] = await Promise.all([disciplines.findByIds(ids), members.list()]);
      const memberById = new Map(allMembers.map((member) => [member.id, member]));

      const rosters = await Promise.all(found.map(async ({ id, name }): Promise<DisciplineRoster> => {
        const students: RosterStudent[] = [];
        for (const membership of await memberships.list({ disciplineId: id })) {
          const member = memberById.get(membership.memberId);
          if (!member) continue;
          students.push({
            memberId: member.id,
            memberNumber: member.memberNumber,
            fullName: `${member.firstName} ${member.lastName}`,
            startDate: membership.startDate,
            ...(membership.endDate ? { endDate: membership.endDate } : {}),
            status: membership.status,
          });
        }
        return { discipline: { id, name }, students: students.sort(compareStudents) };
      }));
      return rosters.sort((a, b) => byName(a.discipline.name, b.discipline.name));
    },
  };
}

export type RosterService = ReturnType<typeof createRosterService>;
