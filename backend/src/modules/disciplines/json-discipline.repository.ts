import { createJsonStore } from '../../database/json-store.js';
import type { DisciplineRepository } from './discipline.repository.js';
import type { Discipline } from './discipline.types.js';

function isStatus(value: unknown): boolean {
  return value === 'active' || value === 'inactive';
}

function isTeachers(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((teacher) => typeof teacher === 'string');
}

// Stored records are either the current shape (teachers + leadTeacher) or the legacy one (teacherName only).
function isStoredDiscipline(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const { id, name, status, teachers, leadTeacher, teacherName } = value as Record<string, unknown>;
  if (typeof id !== 'string' || typeof name !== 'string' || !isStatus(status)) return false;
  if (teachers === undefined) return typeof teacherName === 'string';
  return isTeachers(teachers) && typeof leadTeacher === 'string' && teachers.includes(leadTeacher);
}

// Legacy records read as a single teacher who is in charge; the file is only rewritten by a later mutation.
function toDiscipline(stored: unknown): Discipline {
  const { teacherName, ...rest } = stored as Discipline & { teacherName?: string };
  if (rest.teachers !== undefined) return rest;
  return { ...rest, teachers: [teacherName!], leadTeacher: teacherName! };
}

export function createJsonDisciplineRepository(filePath: string): DisciplineRepository {
  const store = createJsonStore<unknown[]>(filePath, []);

  // A parsed-but-wrong shape must never reach a mutation: writing back would destroy the file.
  function readDisciplines(value: unknown): Discipline[] {
    if (!Array.isArray(value)) {
      throw new Error(`Invalid disciplines file ${filePath}: it must contain a JSON array of disciplines`);
    }
    if (!value.every(isStoredDiscipline)) {
      throw new Error(`Invalid disciplines file ${filePath}: every element must be a discipline`);
    }
    return value.map(toDiscipline);
  }

  return {
    list: async () => readDisciplines(await store.read()),
    async mutate(change) {
      let result!: ReturnType<typeof change>['result'];
      await store.update((current) => {
        const outcome = change(readDisciplines(current));
        result = outcome.result;
        return outcome.disciplines;
      });
      return result;
    },
  };
}
