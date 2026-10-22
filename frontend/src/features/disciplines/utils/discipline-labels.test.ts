import { describe, expect, it } from 'vitest';
import { buildDiscipline } from '../test/fixtures';
import { disciplineNames, disciplineOptionLabel } from './discipline-labels';

const basket = buildDiscipline();
const volley = buildDiscipline({ id: 'disc-2', name: 'Vóley', status: 'inactive' });

describe('disciplineNames', () => {
  it('resolves ids to names in the member order', () => {
    expect(disciplineNames(['disc-2', 'disc-1'], [basket, volley])).toEqual(['Vóley', 'Básquet']);
  });

  it('falls back to the id for a discipline missing from the catalog', () => {
    expect(disciplineNames(['disc-9', 'disc-1'], [basket])).toEqual(['disc-9', 'Básquet']);
  });

  it('returns an empty list when the member has no disciplines', () => {
    expect(disciplineNames([], [basket])).toEqual([]);
  });
});

describe('disciplineOptionLabel', () => {
  it('shows the plain name for an active discipline and flags an inactive one', () => {
    expect(disciplineOptionLabel(basket)).toBe('Básquet');
    expect(disciplineOptionLabel(volley)).toBe('Vóley (inactiva)');
  });
});
