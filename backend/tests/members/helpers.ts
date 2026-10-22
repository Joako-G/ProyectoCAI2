import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJsonMemberRepository } from '../../src/modules/members/json-member.repository.js';
import { createMemberService } from '../../src/modules/members/member.service.js';
import type { DisciplineLookup, DisciplineRef } from '../../src/modules/members/discipline-lookup.js';
import type { MemberInput } from '../../src/modules/members/member.types.js';

export const TODAY = new Date('2026-10-05T15:00:00Z');

export const BASKET = 'disc-basket';
export const VOLLEY = 'disc-volley';
export const RETIRED = 'disc-retired';

export const knownDisciplines: DisciplineRef[] = [
  { id: BASKET, status: 'active' },
  { id: VOLLEY, status: 'active' },
  { id: RETIRED, status: 'inactive' },
];

// Fake of the port the members module depends on; unknown ids are simply absent, like the real lookup.
export function fakeDisciplineLookup(disciplines: DisciplineRef[] = knownDisciplines): DisciplineLookup {
  return { findByIds: async (ids) => disciplines.filter((discipline) => ids.includes(discipline.id)) };
}

export const adultInput: MemberInput = {
  firstName: 'Lucía',
  lastName: 'Ríos',
  dni: '30.123.456',
  birthDate: '1990-03-15',
  category: 'Mayor',
  memberSince: '2015-02-01',
  whatsapp: '+54 9 11 5555-1234',
  disciplineIds: [BASKET],
};

export const minorInput: MemberInput = {
  firstName: 'Tomás',
  lastName: 'Gómez',
  dni: '50111222',
  birthDate: '2015-06-10',
  category: 'Infantil',
  memberSince: '2022-03-01',
  whatsapp: '1155551111',
  guardian: { name: 'Ana Gómez', contact: '1155552222' },
  disciplineIds: [VOLLEY],
};

export async function createTestContext(
  now: () => Date = () => TODAY,
  disciplineLookup: DisciplineLookup = fakeDisciplineLookup(),
) {
  const dir = await mkdtemp(join(tmpdir(), 'members-'));
  const file = join(dir, 'members.json');
  const repository = createJsonMemberRepository(file);
  const service = createMemberService({ repository, now, disciplineLookup });
  return { service, repository, file, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

export function trackContexts() {
  const cleanups: Array<() => Promise<void>> = [];
  return {
    async create(now?: () => Date, disciplineLookup?: DisciplineLookup) {
      const context = await createTestContext(now, disciplineLookup);
      cleanups.push(context.cleanup);
      return context;
    },
    async cleanup() {
      while (cleanups.length > 0) await cleanups.pop()!();
    },
  };
}
