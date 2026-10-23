import { describe, expect, it } from 'vitest';
import { roleLabel, toFormValues, toUserPayload, userInitial } from './user-format';

const form = { name: '  Ana Pérez ', email: ' ana@club.test ', role: 'admin' as const, password: '', active: false };

describe('user-format', () => {
  it('labels known roles in Spanish and falls back to the raw role', () => {
    expect(roleLabel('member')).toBe('Socio');
    expect(roleLabel('admin')).toBe('Administrador');
    expect(roleLabel('owner')).toBe('owner');
  });

  it('uses the uppercase first letter of the trimmed name as initial', () => {
    expect(userInitial('  ana')).toBe('A');
  });

  it('builds a create payload with trimmed fields, omitting a blank password and the active flag', () => {
    expect(toUserPayload(form, false)).toEqual({ name: 'Ana Pérez', email: 'ana@club.test', role: 'admin' });
  });

  it('includes the active flag and a typed password when editing', () => {
    expect(toUserPayload({ ...form, password: 'NuevaClave123' }, true))
      .toEqual({ name: 'Ana Pérez', email: 'ana@club.test', role: 'admin', password: 'NuevaClave123', active: false });
  });

  it('loads an existing user into the form with an empty password', () => {
    expect(toFormValues({ id: '1', name: 'Ana', email: 'ana@club.test', role: 'member', active: true }))
      .toEqual({ name: 'Ana', email: 'ana@club.test', role: 'member', password: '', active: true });
  });
});
