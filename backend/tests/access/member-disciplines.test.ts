import { describe, expect, it, vi } from 'vitest';
import { createMemberDisciplineNames } from '../../src/modules/access/member-disciplines.js';

const names: Record<string, string> = { basket: 'Básquet', swim: 'Natación', chess: 'Ajedrez' };

function setup(disciplineIds: string[]) {
  const memberships = { list: vi.fn(async (_query: { memberId: string; status: 'active' }) => disciplineIds.map((disciplineId) => ({ disciplineId }))) };
  const disciplines = { findByIds: vi.fn(async (ids: readonly string[]) => ids.filter((id) => names[id]).map((id) => ({ id, name: names[id]! }))) };
  return { memberships, disciplines, lookup: createMemberDisciplineNames({ memberships, disciplines }) };
}

describe('member discipline names', () => {
  it('lists the names of the disciplines the member is active in, sorted', async () => {
    const { lookup, memberships } = setup(['swim', 'basket']);
    expect(await lookup.namesFor('m1')).toEqual(['Básquet', 'Natación']);
    expect(memberships.list).toHaveBeenCalledWith({ memberId: 'm1', status: 'active' });
  });

  it('lists a discipline once and skips ids that no longer exist', async () => {
    const { lookup } = setup(['basket', 'basket', 'gone']);
    expect(await lookup.namesFor('m1')).toEqual(['Básquet']);
  });

  it('answers an empty list without reading disciplines when the member has none', async () => {
    const { lookup, disciplines } = setup([]);
    expect(await lookup.namesFor('m1')).toEqual([]);
    expect(disciplines.findByIds).not.toHaveBeenCalled();
  });
});
