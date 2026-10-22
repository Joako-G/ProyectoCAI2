import { describe, expect, it } from 'vitest';
import { buildMember } from '../test/fixtures';
import {
  emptyMemberForm,
  isMinorOn,
  memberToFormValues,
  validateMemberForm,
  type MemberFormValues,
} from './member-validation';

const TODAY = '2026-10-05';

function adultForm(overrides: Partial<MemberFormValues> = {}): MemberFormValues {
  return {
    firstName: 'Lucía',
    lastName: 'Ríos',
    dni: '30123456',
    birthDate: '1990-03-15',
    category: 'Mayor',
    memberSince: '2015-02-01',
    whatsapp: '1155551234',
    email: '',
    guardianName: '',
    guardianContact: '',
    disciplineIds: ['disc-1'],
    ...overrides,
  };
}

describe('isMinorOn', () => {
  it('is true until the 18th birthday and false from that day on', () => {
    expect(isMinorOn('2008-10-06', TODAY)).toBe(true);
    expect(isMinorOn('2008-10-05', TODAY)).toBe(false);
  });

  it('is false for an empty or invalid birth date', () => {
    expect(isMinorOn('', TODAY)).toBe(false);
    expect(isMinorOn('2008-02-31', TODAY)).toBe(false);
    expect(isMinorOn('2008-1-5', TODAY)).toBe(false);
  });

  it('counts a Feb 29 birthday as Mar 1 in non-leap years', () => {
    expect(isMinorOn('2008-02-29', '2026-02-28')).toBe(true);
    expect(isMinorOn('2008-02-29', '2026-03-01')).toBe(false);
  });
});

describe('validateMemberForm', () => {
  it('accepts a valid adult and builds the payload without optional fields', () => {
    const result = validateMemberForm(adultForm(), TODAY);

    expect(result.errors).toEqual({});
    expect(result.input).toEqual({
      firstName: 'Lucía',
      lastName: 'Ríos',
      dni: '30123456',
      birthDate: '1990-03-15',
      category: 'Mayor',
      memberSince: '2015-02-01',
      whatsapp: '1155551234',
      disciplineIds: ['disc-1'],
    });
  });

  it('requires at least one discipline', () => {
    const { errors, input } = validateMemberForm(adultForm({ disciplineIds: [] }), TODAY);

    expect(errors.disciplineIds).toBe('Elegí al menos una disciplina.');
    expect(input).toBeUndefined();
  });

  it('rejects a repeated discipline and keeps several distinct ones', () => {
    expect(validateMemberForm(adultForm({ disciplineIds: ['disc-1', 'disc-1'] }), TODAY).errors.disciplineIds).toBe(
      'No repitas disciplinas.',
    );
    expect(validateMemberForm(adultForm({ disciplineIds: ['disc-1', 'disc-2'] }), TODAY).input?.disciplineIds).toEqual([
      'disc-1',
      'disc-2',
    ]);
  });

  it('trims text, normalizes DNI and phones, and keeps a valid email', () => {
    const result = validateMemberForm(
      adultForm({
        firstName: '  Lucía ',
        dni: '30.123.456',
        whatsapp: '(011) 5555-1234',
        email: ' lucia@club.test ',
      }),
      TODAY,
    );

    expect(result.errors).toEqual({});
    expect(result.input).toMatchObject({
      firstName: 'Lucía',
      dni: '30123456',
      whatsapp: '01155551234',
      email: 'lucia@club.test',
    });
  });

  it('requires first and last name', () => {
    const { errors, input } = validateMemberForm(adultForm({ firstName: ' ', lastName: '' }), TODAY);

    expect(errors.firstName).toBe('Ingresá el nombre.');
    expect(errors.lastName).toBe('Ingresá el apellido.');
    expect(input).toBeUndefined();
  });

  it('requires a DNI with 7 or 8 digits', () => {
    for (const dni of ['', '123456', '123456789', '12a45678']) {
      expect(validateMemberForm(adultForm({ dni }), TODAY).errors.dni).toBe(
        'El DNI debe tener 7 u 8 dígitos.',
      );
    }
    expect(validateMemberForm(adultForm({ dni: '1234567' }), TODAY).errors.dni).toBeUndefined();
  });

  it('requires a valid WhatsApp number', () => {
    for (const whatsapp of ['', '1234567', 'abc', '1'.repeat(16)]) {
      expect(validateMemberForm(adultForm({ whatsapp }), TODAY).errors.whatsapp).toBe(
        'Ingresá un número de WhatsApp válido.',
      );
    }
    expect(
      validateMemberForm(adultForm({ whatsapp: '+54 381 555-1234' }), TODAY).errors.whatsapp,
    ).toBeUndefined();
  });

  it('requires a category from the list', () => {
    expect(validateMemberForm(adultForm({ category: '' }), TODAY).errors.category).toBe(
      'Elegí una categoría.',
    );
  });

  it('rejects missing, impossible and future birth dates', () => {
    expect(validateMemberForm(adultForm({ birthDate: '' }), TODAY).errors.birthDate).toBe(
      'Ingresá una fecha de nacimiento válida.',
    );
    expect(validateMemberForm(adultForm({ birthDate: '2001-02-30' }), TODAY).errors.birthDate).toBe(
      'Ingresá una fecha de nacimiento válida.',
    );
    expect(validateMemberForm(adultForm({ birthDate: '2026-10-06' }), TODAY).errors.birthDate).toBe(
      'La fecha de nacimiento no puede ser futura.',
    );
    expect(
      validateMemberForm(adultForm({ birthDate: TODAY, memberSince: TODAY }), TODAY).errors.birthDate,
    ).toBeUndefined();
  });

  it('rejects invalid, future and pre-birth member-since dates', () => {
    expect(validateMemberForm(adultForm({ memberSince: '' }), TODAY).errors.memberSince).toBe(
      'Ingresá una fecha de alta válida.',
    );
    expect(validateMemberForm(adultForm({ memberSince: '2026-10-06' }), TODAY).errors.memberSince).toBe(
      'La fecha de alta no puede ser futura.',
    );
    expect(validateMemberForm(adultForm({ memberSince: '1989-12-31' }), TODAY).errors.memberSince).toBe(
      'La fecha de alta no puede ser anterior al nacimiento.',
    );
  });

  it('validates the email only when it is filled in', () => {
    expect(validateMemberForm(adultForm({ email: 'no-es-un-mail' }), TODAY).errors.email).toBe(
      'Ingresá un email válido.',
    );
    expect(validateMemberForm(adultForm({ email: '' }), TODAY).errors.email).toBeUndefined();
  });

  it('requires guardian name and contact for a minor and includes them in the payload', () => {
    const minor = adultForm({ birthDate: '2015-04-01', category: 'Infantil', memberSince: '2023-01-10' });

    const missing = validateMemberForm(minor, TODAY);
    expect(missing.errors['guardian.name']).toBe('Ingresá el nombre del tutor.');
    expect(missing.errors['guardian.contact']).toBe('Ingresá un contacto válido para el tutor.');

    const ok = validateMemberForm(
      { ...minor, guardianName: ' Silvia Ríos ', guardianContact: '381 544-2019' },
      TODAY,
    );
    expect(ok.errors).toEqual({});
    expect(ok.input?.guardian).toEqual({ name: 'Silvia Ríos', contact: '3815442019' });
  });

  it('ignores guardian data for an adult and omits it from the payload', () => {
    const result = validateMemberForm(
      adultForm({ guardianName: 'Alguien', guardianContact: 'xx' }),
      TODAY,
    );

    expect(result.errors).toEqual({});
    expect(result.input).not.toHaveProperty('guardian');
  });
});

describe('form values', () => {
  it('starts an empty form with today as the member-since date', () => {
    expect(emptyMemberForm(TODAY)).toMatchObject({
      firstName: '',
      category: '',
      memberSince: TODAY,
      disciplineIds: [],
    });
  });

  it('maps the assigned disciplines, including none for a legacy member', () => {
    expect(memberToFormValues(buildMember({ disciplineIds: ['disc-1', 'disc-2'] })).disciplineIds).toEqual([
      'disc-1',
      'disc-2',
    ]);
    expect(memberToFormValues(buildMember({ disciplineIds: [] })).disciplineIds).toEqual([]);
  });

  it('maps a member (with optional fields) to form values', () => {
    const values = memberToFormValues(
      buildMember({ email: 'a@b.co', guardian: { name: 'Silvia', contact: '3815442019' } }),
    );

    expect(values).toMatchObject({
      firstName: 'Lucía',
      email: 'a@b.co',
      guardianName: 'Silvia',
      guardianContact: '3815442019',
    });
    expect(memberToFormValues(buildMember())).toMatchObject({ email: '', guardianName: '' });
  });
});
