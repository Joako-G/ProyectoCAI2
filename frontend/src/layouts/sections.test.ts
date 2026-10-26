import { describe, expect, it } from 'vitest';
import type { Capability } from '../features/auth/types/auth';
import { sectionsFor } from './sections';

const userWith = (capabilities: Capability[]) => ({ id: '1', name: 'Demo', email: 'demo@example.com', role: 'x', capabilities });

describe('sectionsFor', () => {
  it('lists every section the capabilities allow, in navigation order', () => {
    expect(sectionsFor(userWith(['users:manage', 'disciplines:read', 'members:read']))).toEqual(['members', 'disciplines', 'users']);
  });

  it('skips sections whose read capability is missing', () => {
    expect(sectionsFor(userWith(['members:read', 'members:write', 'disciplines:read']))).toEqual(['members', 'disciplines']);
  });

  it('gives a teacher the roster section', () => {
    expect(sectionsFor(userWith(['roster:read']))).toEqual(['roster']);
    expect(sectionsFor(userWith(['members:read', 'roster:read']))).toEqual(['members', 'roster']);
  });

  it('is empty for a user without capabilities', () => {
    expect(sectionsFor(userWith([]))).toEqual([]);
  });
});
