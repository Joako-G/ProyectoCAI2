import type { DisciplineRepository } from './discipline.repository.js';
import { createDisciplineService } from './discipline.service.js';
import type { Discipline, DisciplineInput } from './discipline.types.js';

// Seed entries carry a fixed id so other seeds (members) can reference them deterministically.
export interface DisciplineSeedEntry extends DisciplineInput {
  id: string;
}

export interface DisciplineSeedOptions {
  repository: DisciplineRepository;
  entries: DisciplineSeedEntry[];
  force?: boolean;
  now?: () => Date;
}

function createInMemoryRepository(): DisciplineRepository {
  let disciplines: Discipline[] = [];
  return {
    list: async () => disciplines,
    async mutate(change) {
      const outcome = change(disciplines);
      disciplines = outcome.disciplines;
      return outcome.result;
    },
  };
}

// Entries go through the service on a scratch repository, so every rule is checked before the target is written once.
export async function buildSeededDisciplines(
  entries: DisciplineSeedEntry[],
  now?: () => Date,
): Promise<Discipline[]> {
  const ids = entries.map((entry) => entry.id);
  if (ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) {
    throw new Error('Discipline seed entries need a unique non-empty id each');
  }
  const scratch = createInMemoryRepository();
  const service = createDisciplineService({ repository: scratch, now });
  for (const { id: _id, ...input } of entries) await service.create(input);
  // The service generates ids; swap in the seed's (creation order is preserved).
  return (await scratch.list()).map((discipline, index) => ({ ...discipline, id: entries[index]!.id }));
}

export function assertCanSeedDisciplines(existing: Discipline[], force: boolean): void {
  if (existing.length > 0 && !force) {
    throw new Error(`Disciplines file already has data (${existing.length} disciplines). Use --force to replace it.`);
  }
}

export async function seedDisciplines({
  repository,
  entries,
  force = false,
  now,
}: DisciplineSeedOptions): Promise<number> {
  const seeded = await buildSeededDisciplines(entries, now);
  await repository.mutate((existing) => {
    assertCanSeedDisciplines(existing, force);
    return { disciplines: seeded, result: undefined };
  });
  return entries.length;
}
