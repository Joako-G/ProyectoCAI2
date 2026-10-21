import { ValidationError } from '../../shared/errors.js';
import type { DisciplineInput } from './discipline.types.js';

export const MAX_NAME_LENGTH = 80;
export const MAX_TEACHER_NAME_LENGTH = 100;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateDisciplineInput(raw: unknown): DisciplineInput {
  const errors: Record<string, string> = {};
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  const required = (field: keyof DisciplineInput, label: string, max: number) => {
    const value = text(input[field]);
    if (!value) errors[field] = `${label} is required`;
    else if (value.length > max) errors[field] = `${label} must be at most ${max} characters`;
    return value;
  };
  const name = required('name', 'Name', MAX_NAME_LENGTH);
  const teacherName = required('teacherName', 'Teacher name', MAX_TEACHER_NAME_LENGTH);

  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  return { name, teacherName };
}
