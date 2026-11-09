import { describe, expect, it } from 'vitest';
import { digitsOnly, dniChars, MAX_MONEY, MAX_MONEY_DIGITS, phoneChars } from './input-limits';

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

  it('dniChars keeps digits, dots and spaces and caps the length', () => {
    expect(dniChars('30.123.456abc')).toBe('30.123.456');
    expect(dniChars('1'.repeat(30))).toHaveLength(10);
  });
});
