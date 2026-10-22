import {
  assertCanSeedDisciplines,
  buildSeededDisciplines,
  seedDisciplines,
  type DisciplineSeedEntry,
} from '../modules/disciplines/discipline.seed.js';
import { createJsonDisciplineRepository } from '../modules/disciplines/json-discipline.repository.js';
import { createJsonMemberRepository } from '../modules/members/json-member.repository.js';
import {
  assertCanSeedMembers,
  buildSeededMembers,
  seedMembers,
  type SeedEntry,
} from '../modules/members/member.seed.js';

export interface RunSeedOptions {
  disciplinesFile: string;
  membersFile: string;
  disciplineEntries: DisciplineSeedEntry[];
  memberEntries: SeedEntry[];
  force?: boolean;
}

// Validates everything and checks both refusals before the first write, so a refused or invalid run
// never leaves one file seeded and the other untouched.
export async function runSeed({
  disciplinesFile,
  membersFile,
  disciplineEntries,
  memberEntries,
  force = false,
}: RunSeedOptions): Promise<{ disciplines: number; members: number }> {
  const disciplineRepository = createJsonDisciplineRepository(disciplinesFile);
  const memberRepository = createJsonMemberRepository(membersFile);

  const catalog = await buildSeededDisciplines(disciplineEntries);
  const disciplineLookup = {
    findByIds: async (ids: readonly string[]) => catalog.filter((discipline) => ids.includes(discipline.id)),
  };
  await buildSeededMembers(memberEntries, disciplineLookup);
  assertCanSeedDisciplines(await disciplineRepository.list(), force);
  assertCanSeedMembers(await memberRepository.list(), force);

  const disciplines = await seedDisciplines({ repository: disciplineRepository, entries: disciplineEntries, force });
  const members = await seedMembers({ repository: memberRepository, disciplineLookup, entries: memberEntries, force });
  return { disciplines, members };
}
