// Ports owned by the access module; the memberships and disciplines services satisfy them as they are.
export interface MemberDisciplineNamesDeps {
  memberships: { list(query: { memberId: string; status: 'active' }): Promise<Array<{ disciplineId: string }>> };
  disciplines: { findByIds(ids: readonly string[]): Promise<Array<{ id: string; name: string }>> };
}

/** The names of the disciplines a member is currently in, which the entrance screens show next to the member. */
export function createMemberDisciplineNames({ memberships, disciplines }: MemberDisciplineNamesDeps) {
  return {
    async namesFor(memberId: string): Promise<string[]> {
      const ids = [...new Set((await memberships.list({ memberId, status: 'active' })).map((membership) => membership.disciplineId))];
      if (ids.length === 0) return [];
      const found = await disciplines.findByIds(ids);
      return found.map((discipline) => discipline.name).sort((a, b) => a.localeCompare(b, 'es'));
    },
  };
}

export type MemberDisciplineNames = ReturnType<typeof createMemberDisciplineNames>;
