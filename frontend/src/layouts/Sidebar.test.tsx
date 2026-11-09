import { render as baseRender, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('renders no group with the default layout when the section it requires is not listed', () => {
    render(<Sidebar sections={['members', 'users', 'pricing']} />);

    expect(within(nav()).queryByRole('group')).not.toBeInTheDocument();
  });
});

describe('Sidebar menu button', () => {
  it('opens and closes the sections from the menu button and closes them after choosing one', async () => {
    const user = userEvent.setup();
    render(<Sidebar sections={['members', 'users']} />);
    const aside = screen.getByRole('complementary');

    expect(aside).toHaveAttribute('data-open', 'false');
    const button = screen.getByRole('button', { name: 'Abrir el menú' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', nav().id);

    await user.click(button);
    expect(aside).toHaveAttribute('data-open', 'true');
    expect(screen.getByRole('button', { name: 'Cerrar el menú' })).toHaveAttribute('aria-expanded', 'true');

    await user.click(within(nav()).getByRole('link', { name: /Usuarios/ }));
    expect(aside).toHaveAttribute('data-open', 'false');
  });

  it('closes the menu with Escape', async () => {
    const user = userEvent.setup();
    render(<Sidebar sections={['members']} />);

    await user.click(screen.getByRole('button', { name: 'Abrir el menú' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('complementary')).toHaveAttribute('data-open', 'false');
  });
});
