import { render as baseRender, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { NavLayoutEntry } from './sections';
import { Sidebar } from './Sidebar';

const render = (ui: ReactElement) => baseRender(<MemoryRouter>{ui}</MemoryRouter>);

const grouped: ReadonlyArray<NavLayoutEntry> = [
  'members',
  { id: 'admin', label: 'Administración', requires: 'pricing', items: ['pricing', 'users'] },
  'users',
];

const nav = () => screen.getByRole('navigation', { name: 'Navegación principal' });

describe('Sidebar groups', () => {
  it('renders a labelled group holding its links, numbered consecutively with the plain ones', () => {
    render(<Sidebar sections={['members', 'pricing', 'users']} layout={grouped} />);

    const group = within(nav()).getByRole('group', { name: 'Administración' });
    expect(within(group).getAllByRole('link').map((link) => link.textContent)).toEqual(['02Precios', '03Usuarios']);
    expect(within(nav()).getAllByRole('link').map((link) => link.textContent)).toEqual(['01Socios', '02Precios', '03Usuarios']);
  });

  it('marks the current section inside a group', () => {
    render(<Sidebar sections={['members', 'pricing', 'users']} current="pricing" layout={grouped} />);

    expect(within(nav()).getByRole('link', { name: /Precios/ })).toHaveAttribute('aria-current', 'page');
    expect(within(nav()).getByRole('link', { name: /Socios/ })).not.toHaveAttribute('aria-current');
  });

  it('shows no group when the section it requires is missing, and the item stands on its own', () => {
    render(<Sidebar sections={['members', 'users']} layout={grouped} />);

    expect(within(nav()).queryByRole('group')).not.toBeInTheDocument();
    expect(within(nav()).getAllByRole('link').map((link) => link.textContent)).toEqual(['01Socios', '02Usuarios']);
  });

  it('renders no groups with the default layout', () => {
    render(<Sidebar />);

    expect(within(nav()).queryByRole('group')).not.toBeInTheDocument();
  });
});
