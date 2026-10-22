import type { Discipline } from '../types/discipline';

/** Names of the given discipline ids, in the given order; an id missing from the catalog stays as the id. */
export function disciplineNames(ids: readonly string[], disciplines: readonly Discipline[]): string[] {
  const nameById = new Map(disciplines.map((discipline) => [discipline.id, discipline.name]));
  return ids.map((id) => nameById.get(id) ?? id);
}

/** Label of a discipline in a picker: inactive ones are flagged so they are not mistaken for active. */
export function disciplineOptionLabel(discipline: Discipline): string {
  return discipline.status === 'inactive' ? `${discipline.name} (inactiva)` : discipline.name;
}
