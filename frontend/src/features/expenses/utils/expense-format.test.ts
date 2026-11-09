import { describe, expect, it } from 'vitest';
import { parseAmount } from './expense-format';

describe('parseAmount', () => {
  it.each([['1500', 1500], [' 20 ', 20]])('reads %j as %d', (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });

  it.each(['', '0', '-5', '1.5', '1,5', 'abc', '1234567890123'])('rejects %j', (text) => {
    expect(parseAmount(text)).toBeNull();
  });
});
