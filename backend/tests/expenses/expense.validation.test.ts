import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/shared/errors.js';
import { MAX_DESCRIPTION_LENGTH, parseCreateBody } from '../../src/modules/expenses/expense.validation.js';
import { validBody } from './helpers.js';

describe('parseCreateBody', () => {
  it.each([[null], [undefined], [[]], ['text'], [42]])('refuses %j, which is not a JSON object', (body) => {
    expect(() => parseCreateBody(body)).toThrow(ValidationError);
    try {
      parseCreateBody(body);
    } catch (error) {
      expect((error as ValidationError).fieldErrors).toEqual({ body: 'Must be a JSON object' });
    }
  });

  it('accepts a description of exactly the maximum length and refuses one character more', () => {
    expect(parseCreateBody({ ...validBody, description: 'x'.repeat(MAX_DESCRIPTION_LENGTH) }).description).toHaveLength(MAX_DESCRIPTION_LENGTH);
    expect(() => parseCreateBody({ ...validBody, description: 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1) })).toThrow(ValidationError);
  });

  it('measures the description after trimming, so surrounding spaces never count against the limit', () => {
    const padded = `  ${'x'.repeat(MAX_DESCRIPTION_LENGTH)}  `;
    expect(parseCreateBody({ ...validBody, description: padded }).description).toBe('x'.repeat(MAX_DESCRIPTION_LENGTH));
  });

  it('reports every invalid field at once', () => {
    try {
      parseCreateBody({ date: 'nope', amount: -1, category: 'food', description: '' });
      expect.unreachable();
    } catch (error) {
      expect(Object.keys((error as ValidationError).fieldErrors).sort()).toEqual(['amount', 'category', 'date', 'description']);
    }
  });
});
