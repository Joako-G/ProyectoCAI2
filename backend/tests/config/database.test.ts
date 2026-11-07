import { describe, expect, it } from 'vitest';
import { databaseUrl } from '../../src/config/database.js';

describe('databaseUrl', () => {
  it('is undefined when DATABASE_URL is unset, so the database features stay off', () => {
    expect(databaseUrl({})).toBeUndefined();
  });

  it('treats a blank value as unset', () => {
    expect(databaseUrl({ DATABASE_URL: '   ' })).toBeUndefined();
  });

  it('returns the trimmed value', () => {
    expect(databaseUrl({ DATABASE_URL: ' postgres://u:p@localhost:5432/db ' })).toBe('postgres://u:p@localhost:5432/db');
  });
});
