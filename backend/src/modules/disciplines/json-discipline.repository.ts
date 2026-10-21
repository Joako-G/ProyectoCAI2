import { createJsonStore } from '../../database/json-store.js';
import type { DisciplineRepository } from './discipline.repository.js';
import type { Discipline } from './discipline.types.js';

export function createJsonDisciplineRepository(filePath: string): DisciplineRepository {
  const store = createJsonStore<Discipline[]>(filePath, []);

  // A parsed-but-wrong shape must never reach a mutation: writing back would destroy the file.
  function assertDisciplines(value: unknown): Discipline[] {
    if (!Array.isArray(value)) {
      throw new Error(`Invalid disciplines file ${filePath}: it must contain a JSON array of disciplines`);
    }
    return value as Discipline[];
  }

  return {
    list: async () => assertDisciplines(await store.read()),
    async mutate(change) {
      let result!: ReturnType<typeof change>['result'];
      await store.update((current) => {
        const outcome = change(assertDisciplines(current));
        result = outcome.result;
        return outcome.disciplines;
      });
      return result;
    },
  };
}
