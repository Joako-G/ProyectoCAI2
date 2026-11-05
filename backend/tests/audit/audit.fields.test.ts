import { describe, expect, it } from 'vitest';
import { changedFields } from '../../src/modules/audit/audit.fields.js';

describe('changedFields', () => {
  it('lists the keys whose values differ, sorted, without ever returning a value', () => {
    expect(changedFields({ name: 'Ana', age: 30, city: 'Rosario' }, { name: 'Ana María', age: 30, city: 'Santa Fe' })).toEqual(['city', 'name']);
  });

  it('compares nested values structurally', () => {
    expect(changedFields({ tags: ['a', 'b'], guardian: { name: 'x' } }, { tags: ['a', 'b'], guardian: { name: 'y' } })).toEqual(['guardian']);
  });

  it('counts a key that appears or disappears as changed', () => {
    expect(changedFields({ email: 'a@club.test' }, {})).toEqual(['email']);
    expect(changedFields({}, { email: 'a@club.test' })).toEqual(['email']);
  });

  it('skips the ignored keys, so secrets and system timestamps never show up', () => {
    expect(changedFields({ name: 'a', updatedAt: '1', passwordHash: 'x' }, { name: 'a', updatedAt: '2', passwordHash: 'y' }, ['updatedAt', 'passwordHash'])).toEqual([]);
  });

  it('returns nothing when nothing changed', () => {
    expect(changedFields({ a: 1 }, { a: 1 })).toEqual([]);
  });
});
