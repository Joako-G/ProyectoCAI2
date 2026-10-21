import { describe, expect, it } from 'vitest';
import { buildDiscipline } from '../test/fixtures';
import { disciplineToFormValues, emptyDisciplineForm, validateDisciplineForm } from './discipline-validation';

const valid = { name: 'Vóley', teachers: ['Ana Gómez'], leadIndex: 0 };

describe('validateDisciplineForm', () => {
  it('trims everything and builds the payload with the lead teacher', () => {
    const result = validateDisciplineForm({
      name: '  Vóley ',
      teachers: [' Ana Gómez  ', ' Luis Sosa'],
      leadIndex: 1,
    });

    expect(result.errors).toEqual({});
    expect(result.input).toEqual({ name: 'Vóley', teachers: ['Ana Gómez', 'Luis Sosa'], leadTeacher: 'Luis Sosa' });
  });

  it('requires the name and treats whitespace as empty', () => {
    const result = validateDisciplineForm({ ...valid, name: '   ' });

    expect(result.input).toBeUndefined();
    expect(result.errors).toEqual({ name: 'Ingresá el nombre de la disciplina.' });
  });

  it('requires every teacher row to be filled', () => {
    const result = validateDisciplineForm({ ...valid, teachers: ['Ana Gómez', '  '] });

    expect(result.input).toBeUndefined();
    expect(result.errors).toEqual({ teachers: 'Completá el nombre de cada profesor o quitá la fila vacía.' });
  });

  it('requires at least one teacher', () => {
    expect(validateDisciplineForm({ ...valid, teachers: [] }).errors.teachers).toBe('Agregá al menos un profesor.');
  });

  it('rejects repeated teachers ignoring case and accents', () => {
    const result = validateDisciplineForm({ ...valid, teachers: ['Lía Soria', ' LIA soria '] });

    expect(result.errors).toEqual({ teachers: 'No repitas profesores.' });
  });

  it('accepts the maximum lengths and rejects one more character', () => {
    expect(validateDisciplineForm({ name: 'a'.repeat(80), teachers: ['b'.repeat(100)], leadIndex: 0 }).errors).toEqual(
      {},
    );

    const result = validateDisciplineForm({ name: 'a'.repeat(81), teachers: ['b'.repeat(101)], leadIndex: 0 });
    expect(result.errors).toEqual({
      name: 'El nombre no puede superar los 80 caracteres.',
      teachers: 'El nombre de cada profesor no puede superar los 100 caracteres.',
    });
  });

  it('measures the length after trimming', () => {
    expect(validateDisciplineForm({ name: ` ${'a'.repeat(80)} `, teachers: ['x'], leadIndex: 0 }).errors).toEqual({});
  });

  it('requires a lead teacher that points at an existing row', () => {
    expect(validateDisciplineForm({ ...valid, leadIndex: 3 }).errors).toEqual({
      leadTeacher: 'Elegí qué profesor está a cargo.',
    });
  });
});

describe('form values', () => {
  it('starts with one empty teacher row that is in charge', () => {
    expect(emptyDisciplineForm()).toEqual({ name: '', teachers: [''], leadIndex: 0 });
  });

  it('is built from a discipline, locating the lead teacher', () => {
    const discipline = buildDiscipline({ teachers: ['Ana Gómez', 'Luis Sosa'], leadTeacher: 'Luis Sosa' });

    expect(disciplineToFormValues(discipline)).toEqual({
      name: 'Básquet',
      teachers: ['Ana Gómez', 'Luis Sosa'],
      leadIndex: 1,
    });
  });
});
