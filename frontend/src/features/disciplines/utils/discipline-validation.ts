import type { FieldErrors } from '../../members/utils/member-validation';
import type { Discipline, DisciplineInput } from '../types/discipline';

// Mirrors backend/src/modules/disciplines (validation and staffing). Keep both in sync: the backend stays
// the source of truth, this only gives early feedback. Messages are UI copy (Spanish).

export const MAX_NAME_LENGTH = 80;

/** Form state: the teacher accounts picked for the discipline and which of them is in charge. */
export interface DisciplineFormValues {
  name: string;
  teacherIds: string[];
  /** Empty while nobody is in charge. */
  leadId: string;
}

export interface DisciplineValidationResult {
  errors: FieldErrors;
  /** Present only when there are no errors. */
  input?: DisciplineInput;
}

export function emptyDisciplineForm(): DisciplineFormValues {
  return { name: '', teacherIds: [], leadId: '' };
}

/** A discipline whose teachers were typed in before teachers were accounts starts with nobody picked. */
export function disciplineToFormValues(discipline: Discipline): DisciplineFormValues {
  return { name: discipline.name, teacherIds: [...discipline.teacherIds], leadId: discipline.leadTeacherId ?? '' };
}

export function validateDisciplineForm(values: DisciplineFormValues): DisciplineValidationResult {
  const name = values.name.trim();
  const errors: FieldErrors = {};

  if (!name) errors.name = 'Ingresá el nombre de la disciplina.';
  else if (name.length > MAX_NAME_LENGTH) errors.name = `El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres.`;

  if (values.teacherIds.length === 0) errors.teachers = 'Elegí al menos un profesor.';
  else if (!values.teacherIds.includes(values.leadId)) errors.leadTeacher = 'Elegí qué profesor está a cargo.';

  return Object.keys(errors).length > 0
    ? { errors }
    : { errors, input: { name, teacherIds: [...values.teacherIds], leadTeacherId: values.leadId } };
}
