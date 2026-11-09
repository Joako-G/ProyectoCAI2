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

/** A DNI has at most eight digits; dots and spaces are dropped so they never use up the room for digits. */
export const MAX_DNI_DIGITS = 8;
/** Room a DNI input leaves for a pasted `30.123.456`, which `dniChars` then reduces to its digits. */
export const DNI_INPUT_MAX_LENGTH = 14;

/** Keeps only the digits of a DNI, at most eight, so `30.123.456` and `30 123 456` both become `30123456`. */
export function dniChars(value: string): string {
  return digitsOnly(value, MAX_DNI_DIGITS);
}

/** Room a money input leaves for a pasted `9.999.999.999`, which `moneyChars` then reduces to its digits. */
export const MONEY_INPUT_MAX_LENGTH = 16;
export const MONEY_SEPARATOR_MESSAGE = 'Ingresá solo pesos enteros, sin puntos ni comas.';

const THOUSANDS_GROUPS = /^\d{1,3}(\.\d{3})+$/;

/**
 * Cleans what is typed or pasted into a whole-peso field. Letters are dropped and a pasted `1.500.000`
 * (dots as thousands separators) becomes `1500000`. A comma or a lone dot is kept so the field can flag it:
 * dropping it silently would turn `1500,50` into 150050, a hundred times the amount that was meant.
 */
export function moneyChars(value: string): string {
  const kept = value.replace(/[^\d.,]/g, '');
  const text = THOUSANDS_GROUPS.test(kept) ? kept.replace(/\./g, '') : kept;
  let digits = 0;
  let result = '';
  for (const char of text) {
    if (/\d/.test(char)) {
      if (digits === MAX_MONEY_DIGITS) continue;
      digits += 1;
    }
    result += char;
  }
  return result.slice(0, MONEY_INPUT_MAX_LENGTH);
}

/** Whether a money field holds a decimal separator, which is never a valid whole-peso amount. */
export function hasMoneySeparator(value: string): boolean {
  return /[.,]/.test(value);
}
