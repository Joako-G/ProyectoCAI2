import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MembersToolbar } from './MembersToolbar';

function setup(overrides: Partial<ComponentProps<typeof MembersToolbar>> = {}) {
  const props = {
    search: '',
    status: 'all' as const,
    onSearchSubmit: vi.fn(),
    onStatusChange: vi.fn(),
    onCreate: vi.fn(),
    ...overrides,
  };
  render(<MembersToolbar {...props} />);
  return { props, user: userEvent.setup() };
}

describe('MembersToolbar', () => {
  it('submits the typed search with the Buscar button', async () => {
    const { props, user } = setup();

    await user.type(screen.getByRole('searchbox', { name: /Buscar socio/ }), '0007');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(props.onSearchSubmit).toHaveBeenCalledWith('0007');
  });

  it('submits the search with Enter', async () => {
    const { props, user } = setup();

    await user.type(screen.getByRole('searchbox', { name: /Buscar socio/ }), 'rios{Enter}');

    expect(props.onSearchSubmit).toHaveBeenCalledWith('rios');
  });

  it('starts with the current search applied', () => {
    setup({ search: 'ana' });

    expect(screen.getByRole('searchbox', { name: /Buscar socio/ })).toHaveValue('ana');
  });

  it('offers Todos, Activos and Inactivos as one radio group', () => {
    setup({ status: 'active' });

    expect(screen.getByRole('radiogroup', { name: 'Filtrar por estado' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Todos' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Activos' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Inactivos' })).not.toBeChecked();
  });

  it('reports the chosen status', async () => {
    const { props, user } = setup();

    await user.click(screen.getByRole('radio', { name: 'Inactivos' }));

    expect(props.onStatusChange).toHaveBeenCalledWith('inactive');
  });

  it('calls onCreate from the Alta de socio button', async () => {
    const { props, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Alta de socio' }));

    expect(props.onCreate).toHaveBeenCalledTimes(1);
  });

  it('does not fail when no create handler is given', async () => {
    const { user } = setup({ onCreate: undefined });

    await user.click(screen.getByRole('button', { name: 'Alta de socio' }));
  });
});
