import { describe, expect, it } from 'vitest';
import { buildDiscipline } from '../test/fixtures';
import { disciplineToFormValues, emptyDisciplineForm, validateDisciplineForm } from './discipline-validation';

describe('validateDisciplineForm', () => {
  it('trims both fields and builds the payload', () => {
    const result = validateDisciplineForm({ name: '  Vóley ', teacherName: ' Ana Gómez  ' });

    expect(result.errors).toEqual({});
    expect(result.input).toEqual({ name: 'Vóley', teacherName: 'Ana Gómez' });
  });

  it('requires both fields and treats whitespace as empty', () => {
    const result = validateDisciplineForm({ name: '   ', teacherName: '' });

    expect(result.input).toBeUndefined();
    expect(result.errors).toEqual({
      name: 'Ingresá el nombre de la disciplina.',
      teacherName: 'Ingresá el nombre del profesor.',
    });
  });

  it('accepts the maximum lengths and rejects one more character', () => {
    expect(validateDisciplineForm({ name: 'a'.repeat(80), teacherName: 'b'.repeat(100) }).errors).toEqual({});

    const result = validateDisciplineForm({ name: 'a'.repeat(81), teacherName: 'b'.repeat(101) });
    expect(result.errors).toEqual({
      name: 'El nombre no puede superar los 80 caracteres.',
      teacherName: 'El nombre del profesor no puede superar los 100 caracteres.',
    });
  });

  it('measures the length after trimming', () => {
    expect(validateDisciplineForm({ name: ` ${'a'.repeat(80)} `, teacherName: 'x' }).errors).toEqual({});
  });
});

describe('form values', () => {
  it('starts empty', () => {
    expect(emptyDisciplineForm()).toEqual({ name: '', teacherName: '' });
  });

  it('is built from a discipline', () => {
    expect(disciplineToFormValues(buildDiscipline())).toEqual({ name: 'Básquet', teacherName: 'Marcos Peña' });
  });
});
