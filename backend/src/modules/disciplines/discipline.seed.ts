import type { DisciplineRepository } from './discipline.repository.js';
import { createDisciplineService } from './discipline.service.js';
import type { Discipline, DisciplineInput } from './discipline.types.js';

export interface DisciplineSeedOptions {
  repository: DisciplineRepository;
  entries: DisciplineInput[];
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
async function buildSeededDisciplines(entries: DisciplineInput[], now?: () => Date): Promise<Discipline[]> {
  const scratch = createInMemoryRepository();
  const service = createDisciplineService({ repository: scratch, now });
  for (const entry of entries) await service.create(entry);
  return scratch.list();
}

export async function seedDisciplines({
  repository,
  entries,
  force = false,
  now,
}: DisciplineSeedOptions): Promise<number> {
  const seeded = await buildSeededDisciplines(entries, now);
  await repository.mutate((existing) => {
    if (existing.length > 0 && !force) {
      throw new Error(`Disciplines file already has data (${existing.length} disciplines). Use --force to replace it.`);
    }
    return { disciplines: seeded, result: undefined };
  });
  return entries.length;
}
