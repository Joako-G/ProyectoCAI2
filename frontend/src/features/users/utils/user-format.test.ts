import { describe, expect, it } from 'vitest';
import { emptyUserForm, roleLabel, roleOptions, toFormValues, toUserPayload, userInitial } from './user-format';

const form = { name: '  Ana Pérez ', email: ' ana@club.test ', role: 'head_secretary' as const, password: '', active: false };

describe('user-format', () => {
  it('labels known roles in Spanish and falls back to the raw role', () => {
    expect(roleLabel('secretary')).toBe('Secretaria');
    expect(roleLabel('head_secretary')).toBe('Jefa de secretaría');
    expect(roleLabel('teacher')).toBe('Docente');
    expect(roleLabel('owner')).toBe('owner');
  });

  it('offers exactly the three current roles in the select, and creates secretaries by default', () => {
    expect(roleOptions).toEqual([
      { value: 'secretary', label: 'Secretaria' },
      { value: 'head_secretary', label: 'Jefa de secretaría' },
      { value: 'teacher', label: 'Docente' },
    ]);
    expect(emptyUserForm.role).toBe('secretary');
  });

  it('uses the uppercase first letter of the trimmed name as initial', () => {
    expect(userInitial('  ana')).toBe('A');
  });

  it('builds a create payload with trimmed fields, omitting a blank password and the active flag', () => {
    expect(toUserPayload(form, false)).toEqual({ name: 'Ana Pérez', email: 'ana@club.test', role: 'head_secretary' });
  });

  it('includes the active flag and a typed password when editing', () => {
    expect(toUserPayload({ ...form, password: 'NuevaClave123' }, true))
      .toEqual({ name: 'Ana Pérez', email: 'ana@club.test', role: 'head_secretary', password: 'NuevaClave123', active: false });
  });

  it('loads an existing user into the form with an empty password', () => {
    expect(toFormValues({ id: '1', name: 'Ana', email: 'ana@club.test', role: 'teacher', active: true }))
      .toEqual({ name: 'Ana', email: 'ana@club.test', role: 'teacher', password: '', active: true });
  });
});
