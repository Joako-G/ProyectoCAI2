import { createJsonStore } from '../../database/json-store.js';
import type { DisciplineRepository } from './discipline.repository.js';
import type { Discipline } from './discipline.types.js';

function isDiscipline(value: unknown): value is Discipline {
  if (typeof value !== 'object' || value === null) return false;
  const { id, name, teacherName, status } = value as Record<string, unknown>;
  return (
    typeof id === 'string' &&
    typeof name === 'string' &&
    typeof teacherName === 'string' &&
    (status === 'active' || status === 'inactive')
  );
}

export function createJsonDisciplineRepository(filePath: string): DisciplineRepository {
  const store = createJsonStore<Discipline[]>(filePath, []);

  // A parsed-but-wrong shape must never reach a mutation: writing back would destroy the file.
  function assertDisciplines(value: unknown): Discipline[] {
    if (!Array.isArray(value)) {
      throw new Error(`Invalid disciplines file ${filePath}: it must contain a JSON array of disciplines`);
    }
    if (!value.every(isDiscipline)) {
      throw new Error(`Invalid disciplines file ${filePath}: every element must be a discipline`);
    }
    return value;
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
