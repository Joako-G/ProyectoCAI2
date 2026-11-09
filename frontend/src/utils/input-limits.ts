/** Largest amount a form accepts, in whole pesos: ten digits. The backend enforces the same cap. */
export const MAX_MONEY_DIGITS = 10;
export const MAX_MONEY = 9_999_999_999;

/** Keeps only digits, at most `maxLength` of them, so a field can never grow without bound. */
export function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

/** Keeps the characters of a phone number (digits, +, spaces, dashes and parentheses), at most `maxLength` of them. */
export function phoneChars(value: string, maxLength = 20): string {
  return value.replace(/[^\d+\s()-]/g, '').slice(0, maxLength);
}

/** Keeps the characters of a DNI as people type it (digits, dots and spaces), at most `maxLength` of them. */
export function dniChars(value: string, maxLength = 10): string {
  return value.replace(/[^\d.\s]/g, '').slice(0, maxLength);
}
