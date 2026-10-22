import { ValidationError } from '../../shared/errors.js';
import { foldText } from '../../shared/text.js';
import type { DisciplineInput } from './discipline.types.js';

export const MAX_NAME_LENGTH = 80;
export const MAX_TEACHER_NAME_LENGTH = 100;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function validateTeachers(value: unknown): { teachers: string[]; error?: string } {
  if (!Array.isArray(value) || value.length === 0) return { teachers: [], error: 'At least one teacher is required' };
  const teachers = value.map(text);
  if (teachers.some((teacher) => !teacher)) return { teachers, error: 'Teacher names must not be empty' };
  if (teachers.some((teacher) => teacher.length > MAX_TEACHER_NAME_LENGTH)) {
    return { teachers, error: `Teacher names must be at most ${MAX_TEACHER_NAME_LENGTH} characters` };
  }
  if (new Set(teachers.map(foldText)).size !== teachers.length) {
    return { teachers, error: 'Teachers must not be repeated' };
  }
  return { teachers };
}

export function validateDisciplineInput(raw: unknown): DisciplineInput {
  const errors: Record<string, string> = {};
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  const name = text(input.name);
  if (!name) errors.name = 'Name is required';
  else if (name.length > MAX_NAME_LENGTH) errors.name = `Name must be at most ${MAX_NAME_LENGTH} characters`;

  const { teachers, error: teachersError } = validateTeachers(input.teachers);
  if (teachersError) errors.teachers = teachersError;

  // The lead teacher is stored exactly as it appears in the (trimmed) teachers list.
  const wanted = text(input.leadTeacher);
  const leadTeacher = teachers.find((teacher) => teacher === wanted) ?? '';
  if (!wanted) errors.leadTeacher = 'Lead teacher is required';
  else if (!leadTeacher && !teachersError) errors.leadTeacher = 'Lead teacher must be one of the teachers';

  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  return { name, teachers, leadTeacher };
}
