import type { FieldErrors } from '../../members/utils/member-validation';
import type { Discipline, DisciplineInput } from '../types/discipline';

// Mirrors backend/src/modules/disciplines/discipline.validation.ts. Keep both in sync: the backend stays
// the source of truth, this only gives early feedback. Messages are UI copy (Spanish).

export const MAX_NAME_LENGTH = 80;
export const MAX_TEACHER_NAME_LENGTH = 100;

/** Form state: every input is a string. */
export type DisciplineFormValues = DisciplineInput;

export interface DisciplineValidationResult {
  errors: FieldErrors;
  /** Present only when there are no errors. */
  input?: DisciplineInput;
}

export function emptyDisciplineForm(): DisciplineFormValues {
  return { name: '', teacherName: '' };
}

export function disciplineToFormValues(discipline: Discipline): DisciplineFormValues {
  return { name: discipline.name, teacherName: discipline.teacherName };
}

export function validateDisciplineForm(values: DisciplineFormValues): DisciplineValidationResult {
  const name = values.name.trim();
  const teacherName = values.teacherName.trim();
  const errors: FieldErrors = {};

  if (!name) errors.name = 'Ingresá el nombre de la disciplina.';
  else if (name.length > MAX_NAME_LENGTH) errors.name = `El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres.`;

  if (!teacherName) errors.teacherName = 'Ingresá el nombre del profesor.';
  else if (teacherName.length > MAX_TEACHER_NAME_LENGTH) {
    errors.teacherName = `El nombre del profesor no puede superar los ${MAX_TEACHER_NAME_LENGTH} caracteres.`;
  }

  return Object.keys(errors).length > 0 ? { errors } : { errors, input: { name, teacherName } };
}
