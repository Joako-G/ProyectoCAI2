import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildDiscipline } from '../../disciplines/test/fixtures';
import { MembersToolbar } from './MembersToolbar';

const basket = buildDiscipline();
const volley = buildDiscipline({ id: 'disc-2', name: 'Vóley', status: 'inactive' });

function setup(overrides: Partial<ComponentProps<typeof MembersToolbar>> = {}) {
  const props = {
    search: '',
    status: 'all' as const,
    disciplineId: '',
    disciplines: [basket, volley],
    onSearchSubmit: vi.fn(),
    onStatusChange: vi.fn(),
    onDisciplineChange: vi.fn(),
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

  it('offers every discipline plus "Todas las disciplinas" in a select', () => {
    setup();

    const select = screen.getByRole('combobox', { name: 'Filtrar por disciplina' });
    expect(select).toHaveValue('');
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Todas las disciplinas',
      'Básquet',
      'Vóley (inactiva)',
    ]);
  });

  it('reflects the chosen discipline and reports changes, including back to all', async () => {
    const { props, user } = setup({ disciplineId: 'disc-1' });
    const select = screen.getByRole('combobox', { name: 'Filtrar por disciplina' });
    expect(select).toHaveValue('disc-1');

    await user.selectOptions(select, 'disc-2');
    expect(props.onDisciplineChange).toHaveBeenLastCalledWith('disc-2');

    await user.selectOptions(select, 'Todas las disciplinas');
    expect(props.onDisciplineChange).toHaveBeenLastCalledWith('');
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
