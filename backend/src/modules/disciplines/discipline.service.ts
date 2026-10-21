import { randomUUID } from 'node:crypto';
import { toIsoDate } from '../../shared/date.js';
import { ConflictError, NotFoundError } from '../../shared/errors.js';
import type { DisciplineRepository } from './discipline.repository.js';
import type { Discipline, DisciplineInput, DisciplineListQuery } from './discipline.types.js';
import { validateDisciplineInput } from './discipline.validation.js';

export interface DisciplineServiceDeps {
  repository: DisciplineRepository;
  now?: () => Date;
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function compareByName(a: Discipline, b: Discipline): number {
  return fold(a.name).localeCompare(fold(b.name));
}

function findIndex(disciplines: Discipline[], id: string): number {
  const index = disciplines.findIndex((discipline) => discipline.id === id);
  if (index === -1) throw new NotFoundError('Discipline not found');
  return index;
}

// Names are unique ignoring case and accents (as search does), including against inactive disciplines.
function assertNameAvailable(disciplines: Discipline[], name: string, ownId?: string): void {
  const wanted = fold(name);
  if (disciplines.some((discipline) => fold(discipline.name) === wanted && discipline.id !== ownId)) {
    throw new ConflictError('A discipline with this name already exists');
  }
}

function replaceAt(disciplines: Discipline[], index: number, discipline: Discipline): Discipline[] {
  return disciplines.map((current, i) => (i === index ? discipline : current));
}

export function createDisciplineService({ repository, now = () => new Date() }: DisciplineServiceDeps) {
  return {
    async create(raw: DisciplineInput): Promise<Discipline> {
      const input = validateDisciplineInput(raw);
      return repository.mutate((disciplines) => {
        assertNameAvailable(disciplines, input.name);
        const discipline: Discipline = {
          ...input,
          id: randomUUID(),
          status: 'active',
          createdAt: now().toISOString(),
        };
        return { disciplines: [...disciplines, discipline], result: discipline };
      });
    },

    async update(id: string, raw: DisciplineInput): Promise<Discipline> {
      const input = validateDisciplineInput(raw);
      return repository.mutate((disciplines) => {
        const index = findIndex(disciplines, id);
        assertNameAvailable(disciplines, input.name, id);
        const discipline: Discipline = { ...disciplines[index]!, ...input };
        return { disciplines: replaceAt(disciplines, index, discipline), result: discipline };
      });
    },

    async deactivate(id: string): Promise<Discipline> {
      return repository.mutate((disciplines) => {
        const index = findIndex(disciplines, id);
        const current = disciplines[index]!;
        if (current.status === 'inactive') throw new ConflictError('Discipline is already inactive');
        const discipline: Discipline = { ...current, status: 'inactive', deactivatedAt: toIsoDate(now()) };
        return { disciplines: replaceAt(disciplines, index, discipline), result: discipline };
      });
    },

    async reactivate(id: string): Promise<Discipline> {
      return repository.mutate((disciplines) => {
        const index = findIndex(disciplines, id);
        const { deactivatedAt: _deactivatedAt, ...current } = disciplines[index]!;
        if (current.status === 'active') throw new ConflictError('Discipline is already active');
        const discipline: Discipline = { ...current, status: 'active' };
        return { disciplines: replaceAt(disciplines, index, discipline), result: discipline };
      });
    },

    async getById(id: string): Promise<Discipline> {
      const disciplines = await repository.list();
      return disciplines[findIndex(disciplines, id)]!;
    },

    // Lookup for other modules (e.g. members): unknown ids are simply absent from the result.
    async findByIds(ids: readonly string[]): Promise<Discipline[]> {
      const wanted = new Set(ids);
      return (await repository.list()).filter((discipline) => wanted.has(discipline.id));
    },

    async list({ search = '', status }: DisciplineListQuery = {}): Promise<Discipline[]> {
      const query = fold(search.trim());
      const disciplines = await repository.list();
      return disciplines
        .filter(
          (discipline) => (!status || discipline.status === status) && fold(discipline.name).includes(query),
        )
        .sort(compareByName);
    },
  };
}

export type DisciplineService = ReturnType<typeof createDisciplineService>;
