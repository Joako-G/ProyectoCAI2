import { MEMBER_CATEGORIES, type Member, type MemberInput } from '../types/member';
import { calculateAge } from './member-format';

// Mirrors backend/src/modules/members/member.validation.ts. Keep both in sync: the backend stays the
// source of truth, this only gives early feedback. Messages are UI copy (Spanish).

/** Form state: every input is a string; `category` is empty until the user picks one. */
export interface MemberFormValues {
  firstName: string;
  lastName: string;
  dni: string;
  birthDate: string;
  category: Member['category'] | '';
  memberSince: string;
  whatsapp: string;
  email: string;
  guardianName: string;
  guardianContact: string;
  disciplineIds: string[];
}

/** Field errors keyed like the backend `fieldErrors` (`guardian.name`, `guardian.contact`, ...). */
export type FieldErrors = Record<string, string>;

export interface ValidationResult {
  errors: FieldErrors;
  /** Present only when there are no errors. */
  input?: MemberInput;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADULT_AGE = 18;

function isRealDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizePhone(value: string): string | undefined {
  const compact = value.replace(/[\s\-()]/g, '');
  return /^\+?\d{8,15}$/.test(compact) ? compact : undefined;
}

function normalizeDni(value: string): string | undefined {
  const digits = value.replace(/[.\s]/g, '');
  return /^\d{7,8}$/.test(digits) ? digits : undefined;
}

/** Whether the person is under 18 on `today`. An empty or invalid birth date is not a minor. */
export function isMinorOn(birthDate: string, today: string): boolean {
  return isRealDate(birthDate) && calculateAge(birthDate, today) < ADULT_AGE;
}

export function emptyMemberForm(today: string): MemberFormValues {
  return {
    firstName: '',
    lastName: '',
    dni: '',
    birthDate: '',
    category: '',
    memberSince: today,
    whatsapp: '',
    email: '',
    guardianName: '',
    guardianContact: '',
    disciplineIds: [],
  };
}

export function memberToFormValues(member: Member): MemberFormValues {
  return {
    firstName: member.firstName,
    lastName: member.lastName,
    dni: member.dni,
    birthDate: member.birthDate,
    category: member.category,
    memberSince: member.memberSince,
    whatsapp: member.whatsapp,
    email: member.email ?? '',
    guardianName: member.guardian?.name ?? '',
    guardianContact: member.guardian?.contact ?? '',
    disciplineIds: [...member.disciplineIds],
  };
}

export function validateMemberForm(values: MemberFormValues, today: string): ValidationResult {
  const errors: FieldErrors = {};

  const firstName = values.firstName.trim();
  if (!firstName) errors.firstName = 'Ingresá el nombre.';
  const lastName = values.lastName.trim();
  if (!lastName) errors.lastName = 'Ingresá el apellido.';

  const dni = normalizeDni(values.dni.trim());
  if (!dni) errors.dni = 'El DNI debe tener 7 u 8 dígitos.';

  const whatsapp = normalizePhone(values.whatsapp.trim());
  if (!whatsapp) errors.whatsapp = 'Ingresá un número de WhatsApp válido.';

  const category = MEMBER_CATEGORIES.find((option) => option === values.category);
  if (!category) errors.category = 'Elegí una categoría.';

  const birthDate = values.birthDate.trim();
  const birthDateValid = isRealDate(birthDate);
  if (!birthDateValid) errors.birthDate = 'Ingresá una fecha de nacimiento válida.';
  else if (birthDate > today) errors.birthDate = 'La fecha de nacimiento no puede ser futura.';

  const memberSince = values.memberSince.trim();
  if (!isRealDate(memberSince)) errors.memberSince = 'Ingresá una fecha de alta válida.';
  else if (memberSince > today) errors.memberSince = 'La fecha de alta no puede ser futura.';
  else if (birthDateValid && memberSince < birthDate) {
    errors.memberSince = 'La fecha de alta no puede ser anterior al nacimiento.';
  }

  const email = values.email.trim();
  if (email && !EMAIL.test(email)) errors.email = 'Ingresá un email válido.';

  const { disciplineIds } = values;
  if (disciplineIds.length === 0) errors.disciplineIds = 'Elegí al menos una disciplina.';
  else if (new Set(disciplineIds).size !== disciplineIds.length) errors.disciplineIds = 'No repitas disciplinas.';

  // Guardian data only applies to minors; for an adult it is ignored and cleared on save.
  let guardian: MemberInput['guardian'];
  if (birthDateValid && isMinorOn(birthDate, today)) {
    const name = values.guardianName.trim();
    if (!name) errors['guardian.name'] = 'Ingresá el nombre del tutor.';
    const contact = normalizePhone(values.guardianContact.trim());
    if (!contact) errors['guardian.contact'] = 'Ingresá un contacto válido para el tutor.';
    if (name && contact) guardian = { name, contact };
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors,
    input: {
      firstName,
      lastName,
      dni: dni!,
      birthDate,
      category: category!,
      memberSince,
      whatsapp: whatsapp!,
      disciplineIds: [...disciplineIds],
      ...(email && { email }),
      ...(guardian && { guardian }),
    },
  };
}
