import { describe, expect, it } from 'vitest';
import { buildDiscipline } from '../test/fixtures';
import { disciplineToFormValues, emptyDisciplineForm, validateDisciplineForm } from './discipline-validation';

const valid = { name: 'Vóley', teacherIds: ['t1'], leadId: 't1' };

describe('validateDisciplineForm', () => {
  it('trims the name and builds the payload with the teacher accounts and the one in charge', () => {
    const result = validateDisciplineForm({ name: '  Vóley ', teacherIds: ['t1', 't2'], leadId: 't2' });

    expect(result.errors).toEqual({});
    expect(result.input).toEqual({ name: 'Vóley', teacherIds: ['t1', 't2'], leadTeacherId: 't2' });
  });

  it('requires the name and treats whitespace as empty', () => {
    const result = validateDisciplineForm({ ...valid, name: '   ' });

    expect(result.input).toBeUndefined();
    expect(result.errors).toEqual({ name: 'Ingresá el nombre de la disciplina.' });
  });

  it('requires at least one teacher', () => {
    const result = validateDisciplineForm({ ...valid, teacherIds: [], leadId: '' });

    expect(result.input).toBeUndefined();
    expect(result.errors).toEqual({ teachers: 'Elegí al menos un profesor.' });
  });

  it('accepts the maximum name length and rejects one more character', () => {
    expect(validateDisciplineForm({ ...valid, name: 'a'.repeat(80) }).errors).toEqual({});
    expect(validateDisciplineForm({ ...valid, name: 'a'.repeat(81) }).errors).toEqual({ name: 'El nombre no puede superar los 80 caracteres.' });
  });

  it('measures the length after trimming', () => {
    expect(validateDisciplineForm({ ...valid, name: ` ${'a'.repeat(80)} ` }).errors).toEqual({});
  });

  it('requires the one in charge to be one of the picked teachers', () => {
    expect(validateDisciplineForm({ ...valid, leadId: 't9' }).errors).toEqual({ leadTeacher: 'Elegí qué profesor está a cargo.' });
    expect(validateDisciplineForm({ ...valid, leadId: '' }).errors).toEqual({ leadTeacher: 'Elegí qué profesor está a cargo.' });
  });
});

describe('form values', () => {
  it('starts with nobody picked', () => {
    expect(emptyDisciplineForm()).toEqual({ name: '', teacherIds: [], leadId: '' });
  });

  it('is built from a discipline, with its teacher accounts and the one in charge', () => {
    const discipline = buildDiscipline({ teacherIds: ['t1', 't2'], leadTeacherId: 't2' });

    expect(disciplineToFormValues(discipline)).toEqual({ name: 'Básquet', teacherIds: ['t1', 't2'], leadId: 't2' });
  });

  it('starts with nobody picked for a discipline whose teachers were typed in before they were accounts', () => {
    const discipline = buildDiscipline({ teachers: ['Ana Gómez'], leadTeacher: 'Ana Gómez', teacherIds: [], leadTeacherId: null });

    expect(disciplineToFormValues(discipline)).toEqual({ name: 'Básquet', teacherIds: [], leadId: '' });
  });
});
