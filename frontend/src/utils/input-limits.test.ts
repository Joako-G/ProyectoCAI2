import { describe, expect, it } from 'vitest';
import { digitsOnly, dniChars, hasMoneySeparator, MAX_MONEY, MAX_MONEY_DIGITS, moneyChars, phoneChars } from './input-limits';

describe('input limits', () => {
  it('keeps the largest amount within the digits the fields allow', () => {
    expect(String(MAX_MONEY)).toHaveLength(MAX_MONEY_DIGITS);
  });

  it('digitsOnly drops everything but digits and stops at the maximum length', () => {
    expect(digitsOnly('12a3-4.5 6', 10)).toBe('123456');
    expect(digitsOnly('12345678901234567890', MAX_MONEY_DIGITS)).toBe('1234567890');
    expect(digitsOnly('abc', 5)).toBe('');
  });

  it('phoneChars keeps what a phone number may contain and caps the length', () => {
    expect(phoneChars('+54 (381) 555-0101 ext.')).toBe('+54 (381) 555-0101 ');
    expect(phoneChars('1'.repeat(40))).toHaveLength(20);
  });

  it('dniChars keeps the digits only, so dots and spaces never use up the eight digits', () => {
    expect(dniChars('30.123.456abc')).toBe('30123456');
    expect(dniChars(' 30 123 456 ')).toBe('30123456');
    expect(dniChars('1'.repeat(30))).toHaveLength(8);
  });
});

describe('moneyChars', () => {
  it('drops letters and caps the digits at ten', () => {
    expect(moneyChars('12ab34')).toBe('1234');
    expect(moneyChars('123456789012345')).toBe('1234567890');
  });

  it('reads dots placed as thousands separators', () => {
    expect(moneyChars('1.500')).toBe('1500');
    expect(moneyChars('9.999.999.999')).toBe('9999999999');
  });

  it('keeps a comma or a lone dot so the field can flag it instead of multiplying the amount', () => {
    expect(moneyChars('1500,50')).toBe('1500,50');
    expect(moneyChars('1.5')).toBe('1.5');
    expect(moneyChars('1500.')).toBe('1500.');
  });

  it('still caps the digits when a separator is present', () => {
    expect(moneyChars('12345678901,5')).toBe('1234567890,');
  });

  it('hasMoneySeparator tells a whole amount from one with a comma or a dot', () => {
    expect(hasMoneySeparator('1500')).toBe(false);
    expect(hasMoneySeparator('1500,50')).toBe(true);
    expect(hasMoneySeparator('1.5')).toBe(true);
  });
});
