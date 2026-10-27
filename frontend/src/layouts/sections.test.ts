import { describe, expect, it } from 'vitest';
import type { Capability } from '../features/auth/types/auth';
import { NAVIGATION, SECTIONS, navigationFor, sectionsFor, type NavLayoutEntry, type Section } from './sections';

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

  it('gives the pricing section to config:read holders and never to a teacher', () => {
    expect(sectionsFor(userWith(['members:read', 'config:read']))).toEqual(['members', 'pricing']);
    expect(sectionsFor(userWith(['config:manage']))).toEqual([]);
    expect(sectionsFor(userWith(['roster:read']))).not.toContain('pricing');
  });

  it('gives reports to reports:read holders and the cash count only to cashcount:run holders', () => {
    expect(sectionsFor(userWith(['members:read', 'reports:read']))).toEqual(['members', 'reports']);
    expect(sectionsFor(userWith(['members:read', 'reports:read', 'cashcount:run']))).toEqual(['members', 'cashcount', 'reports']);
    expect(sectionsFor(userWith(['roster:read']))).not.toContain('reports');
  });

  it('gives the payments section to payments:read holders and never to a teacher', () => {
    expect(sectionsFor(userWith(['members:read', 'payments:read']))).toEqual(['members', 'payments']);
    expect(sectionsFor(userWith(['payments:collect', 'payments:annul']))).toEqual([]);
    expect(sectionsFor(userWith(['roster:read']))).not.toContain('payments');
  });

  it('is empty for a user without capabilities', () => {
    expect(sectionsFor(userWith([]))).toEqual([]);
  });
});

describe('navigationFor', () => {
  const link = (section: Section) => ({ kind: 'link', section });
  // Stands in for a layout with a group: "pricing" opens the group, "users" is also reachable on its own.
  const grouped: ReadonlyArray<NavLayoutEntry> = [
    'members',
    { id: 'admin', label: 'Administración', requires: 'pricing', items: ['pricing', 'users'] },
    'users',
  ];

  it('lists the allowed sections as plain links, in navigation order, by default', () => {
    const allowed = SECTIONS.map(({ id }) => id).filter((id) => id !== 'cashcount' && id !== 'reports');
    expect(navigationFor(allowed)).toEqual(allowed.map(link));
    expect(navigationFor(['users', 'members'])).toEqual([link('members'), link('users')]);
  });

  it('gives whoever runs the cash count the Caja group with Arqueo and Reportes, and Reportes only there', () => {
    expect(navigationFor(['members', 'payments', 'cashcount', 'reports', 'users'])).toEqual([
      link('members'),
      link('payments'),
      { kind: 'group', id: 'caja', label: 'Caja', items: ['cashcount', 'reports'] },
      link('users'),
    ]);
  });

  it('gives a reader of reports without the cash count a standalone Reportes and no Caja group', () => {
    expect(navigationFor(['members', 'payments', 'reports'])).toEqual([link('members'), link('payments'), link('reports')]);
  });

  it('never lists Caja or Reportes without the capabilities that open them', () => {
    expect(navigationFor(['members', 'roster'])).toEqual([link('members'), link('roster')]);
  });

  it('lists every section outside Caja as a plain link in the production layout', () => {
    const outside: Section[] = SECTIONS.map(({ id }) => id).filter((id) => id !== 'cashcount' && id !== 'reports');
    const plain = NAVIGATION.filter((entry): entry is Section => typeof entry === 'string');
    expect(plain.filter((id) => outside.includes(id))).toEqual(outside);
  });

  it('shows a group with the allowed items when the section it requires is allowed', () => {
    expect(navigationFor(['members', 'pricing', 'users'], grouped)).toEqual([
      link('members'),
      { kind: 'group', id: 'admin', label: 'Administración', items: ['pricing', 'users'] },
    ]);
  });

  it('lists a section once: inside the group when shown, on its own when the group is hidden', () => {
    expect(navigationFor(['users'], grouped)).toEqual([link('users')]);
    expect(navigationFor(['pricing', 'users'], grouped)).toEqual([
      { kind: 'group', id: 'admin', label: 'Administración', items: ['pricing', 'users'] },
    ]);
  });

  it('drops group items that are not allowed and hides a group left without items', () => {
    expect(navigationFor(['pricing'], grouped)).toEqual([
      { kind: 'group', id: 'admin', label: 'Administración', items: ['pricing'] },
    ]);
    expect(navigationFor([], grouped)).toEqual([]);
  });
});
