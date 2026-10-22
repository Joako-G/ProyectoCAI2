import type { Discipline } from './discipline.types.js';

export interface DisciplineMutation<R> {
  disciplines: Discipline[];
  result: R;
}

export interface DisciplineRepository {
  list(): Promise<Discipline[]>;
  // Runs read-check-write as one unit; throwing inside `change` aborts without writing.
  mutate<R>(change: (disciplines: Discipline[]) => DisciplineMutation<R>): Promise<R>;
}
