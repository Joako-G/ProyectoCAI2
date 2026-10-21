import type { FieldErrors } from '../../members/utils/member-validation';
import type { Discipline, DisciplineInput } from '../types/discipline';

// Mirrors backend/src/modules/disciplines/discipline.validation.ts. Keep both in sync: the backend stays
// the source of truth, this only gives early feedback. Messages are UI copy (Spanish).

export const MAX_NAME_LENGTH = 80;
export const MAX_TEACHER_NAME_LENGTH = 100;

/** Form state: one string per teacher row, and the position of the row whose teacher is in charge. */
export interface DisciplineFormValues {
  name: string;
  teachers: string[];
  leadIndex: number;
}

export interface DisciplineValidationResult {
  errors: FieldErrors;
  /** Present only when there are no errors. */
  input?: DisciplineInput;
}

export function emptyDisciplineForm(): DisciplineFormValues {
  return { name: '', teachers: [''], leadIndex: 0 };
}

export function disciplineToFormValues(discipline: Discipline): DisciplineFormValues {
  return {
    name: discipline.name,
    teachers: [...discipline.teachers],
    leadIndex: Math.max(0, discipline.teachers.indexOf(discipline.leadTeacher)),
  };
}

// Same case- and accent-insensitive comparison the backend uses for repeated teachers.
function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function validateTeachers(teachers: string[]): string | undefined {
  if (teachers.length === 0) return 'Agregá al menos un profesor.';
  if (teachers.some((teacher) => !teacher)) return 'Completá el nombre de cada profesor o quitá la fila vacía.';
  if (teachers.some((teacher) => teacher.length > MAX_TEACHER_NAME_LENGTH)) {
    return `El nombre de cada profesor no puede superar los ${MAX_TEACHER_NAME_LENGTH} caracteres.`;
  }
  if (new Set(teachers.map(fold)).size !== teachers.length) return 'No repitas profesores.';
  return undefined;
}

export function validateDisciplineForm(values: DisciplineFormValues): DisciplineValidationResult {
  const name = values.name.trim();
  const teachers = values.teachers.map((teacher) => teacher.trim());
  const errors: FieldErrors = {};

  if (!name) errors.name = 'Ingresá el nombre de la disciplina.';
  else if (name.length > MAX_NAME_LENGTH) errors.name = `El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres.`;

  const teachersError = validateTeachers(teachers);
  if (teachersError) errors.teachers = teachersError;

  const leadTeacher = teachers[values.leadIndex];
  if (leadTeacher === undefined) errors.leadTeacher = 'Elegí qué profesor está a cargo.';

  return Object.keys(errors).length > 0
    ? { errors }
    : { errors, input: { name, teachers, leadTeacher: leadTeacher! } };
}
