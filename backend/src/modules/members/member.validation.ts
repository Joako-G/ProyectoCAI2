import { ValidationError } from '../../shared/errors.js';
import { MEMBER_CATEGORIES, type Guardian, type MemberCategory, type MemberInput } from './member.types.js';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function isRealDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isMinor(birthDate: string, today: string): boolean {
  const [birthYear, birthMonthDay] = [Number(birthDate.slice(0, 4)), birthDate.slice(5)];
  const eighteenthBirthday = `${birthYear + 18}-${birthMonthDay}`;
  return today < eighteenthBirthday;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function phone(value: string): string | undefined {
  const compact = value.replace(/[\s\-()]/g, '');
  return /^\+?\d{8,15}$/.test(compact) ? compact : undefined;
}

export function normalizeDni(value: string): string | undefined {
  const digits = value.replace(/[.\s]/g, '');
  return /^\d{7,8}$/.test(digits) ? digits : undefined;
}

export function validateMemberInput(raw: unknown, today: string): MemberInput {
  const errors: Record<string, string> = {};
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  const requiredName = (field: 'firstName' | 'lastName', label: string) => {
    const value = text(input[field]);
    if (!value) errors[field] = `${label} is required`;
    return value ?? '';
  };
  const firstName = requiredName('firstName', 'First name');
  const lastName = requiredName('lastName', 'Last name');

  const dni = normalizeDni(text(input.dni) ?? '');
  if (!dni) errors.dni = 'DNI must have 7 or 8 digits';

  const whatsappRaw = text(input.whatsapp) ?? '';
  const whatsapp = phone(whatsappRaw);
  if (!whatsapp) errors.whatsapp = 'WhatsApp must be a valid phone number';

  const category = input.category as MemberCategory;
  if (!MEMBER_CATEGORIES.includes(category)) errors.category = `Category must be one of: ${MEMBER_CATEGORIES.join(', ')}`;

  const birthDate = text(input.birthDate) ?? '';
  const birthDateValid = isRealDate(birthDate);
  if (!birthDateValid) errors.birthDate = 'Birth date must be a valid date (YYYY-MM-DD)';
  else if (birthDate > today) errors.birthDate = 'Birth date cannot be in the future';

  const memberSince = text(input.memberSince) ?? '';
  if (!isRealDate(memberSince)) errors.memberSince = 'Member since must be a valid date (YYYY-MM-DD)';
  else if (memberSince > today) errors.memberSince = 'Member since cannot be in the future';
  else if (birthDateValid && memberSince < birthDate) errors.memberSince = 'Member since cannot be before the birth date';

  const emailRaw = text(input.email) ?? '';
  if (emailRaw && !EMAIL.test(emailRaw)) errors.email = 'Email is not valid';

  const guardian = validateGuardian(input.guardian, birthDateValid && isMinor(birthDate, today), errors);

  if (Object.keys(errors).length > 0) throw new ValidationError(errors);

  return {
    firstName,
    lastName,
    dni: dni!,
    birthDate,
    category,
    memberSince,
    whatsapp: whatsapp!,
    ...(emailRaw && { email: emailRaw }),
    ...(guardian && { guardian }),
  };
}

function validateGuardian(raw: unknown, required: boolean, errors: Record<string, string>): Guardian | undefined {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const name = text(source.name) ?? '';
  const contactRaw = text(source.contact) ?? '';
  if (!required && !name && !contactRaw) return undefined;

  if (!name) errors['guardian.name'] = 'Guardian name is required';
  const contact = phone(contactRaw);
  if (!contact) errors['guardian.contact'] = 'Guardian contact must be a valid phone number';
  return name && contact ? { name, contact } : undefined;
}
