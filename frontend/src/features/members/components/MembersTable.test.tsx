import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { buildDiscipline } from '../../disciplines/test/fixtures';
import { buildMember } from '../test/fixtures';
import { MembersTable } from './MembersTable';

const TODAY = '2026-10-05';

describe('MembersTable', () => {
  it('labels the columns', () => {
    render(<MembersTable members={[buildMember()]} today={TODAY} />);

    const table = screen.getByRole('table', { name: 'Listado de socios' });
    for (const name of ['N° socio', 'Socio', 'DNI', 'Disciplinas', 'Socio desde', 'Estado']) {
      expect(within(table).getByRole('columnheader', { name })).toBeInTheDocument();
    }
  });

  it('shows number, name, category with age, DNI, member since and status', () => {
    render(<MembersTable members={[buildMember()]} today={TODAY} />);

    const row = screen.getByRole('row', { name: /Lucía Ríos/ });
    expect(within(row).getByRole('cell', { name: '0001' })).toBeInTheDocument();
    expect(within(row).getByText('Lucía Ríos')).toBeInTheDocument();
    expect(within(row).getByText('Mayor · 36 años')).toBeInTheDocument();
    expect(within(row).getByRole('cell', { name: '30123456' })).toBeInTheDocument();
    expect(within(row).getByRole('cell', { name: '01/02/2015' })).toBeInTheDocument();
    expect(within(row).getByText('Activo')).toBeInTheDocument();
  });

  it('shows the discipline names of each member compactly', () => {
    const disciplines = [buildDiscipline(), buildDiscipline({ id: 'disc-2', name: 'Vóley', status: 'inactive' })];
    render(
      <MembersTable
        members={[buildMember({ disciplineIds: ['disc-1', 'disc-2'] })]}
        disciplines={disciplines}
        today={TODAY}
      />,
    );

    expect(screen.getByRole('cell', { name: 'Básquet, Vóley' })).toBeInTheDocument();
  });

  it('falls back to the id for unknown disciplines and a dash for none', () => {
    render(
      <MembersTable
        members={[
          buildMember({ id: 'a', disciplineIds: ['disc-9'] }),
          buildMember({ id: 'b', disciplineIds: [] }),
        ]}
        disciplines={[]}
        today={TODAY}
      />,
    );

    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByRole('cell', { name: 'disc-9' })).toBeInTheDocument();
    expect(within(rows[1]).getByRole('cell', { name: '—' })).toBeInTheDocument();
  });

  it('shows the inactive chip for inactive members', () => {
    render(<MembersTable members={[buildMember({ status: 'inactive' })]} today={TODAY} />);

    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    expect(screen.queryByText('Activo')).not.toBeInTheDocument();
  });

  it('uses the singular for one year of age', () => {
    render(
      <MembersTable
        members={[buildMember({ birthDate: '2025-06-01', category: 'Infantil' })]}
        today={TODAY}
      />,
    );

    expect(screen.getByText('Infantil · 1 año')).toBeInTheDocument();
  });

  it('renders one body row per member, in the given order', () => {
    render(
      <MembersTable
        members={[
          buildMember({ id: 'a', memberNumber: '0002', firstName: 'Ana', lastName: 'Álvarez' }),
          buildMember({ id: 'b', memberNumber: '0001' }),
        ]}
        today={TODAY}
      />,
    );

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Ana Álvarez');
    expect(rows[1]).toHaveTextContent('Lucía Ríos');
  });

  it('opens a member by clicking the row', async () => {
    const onOpen = vi.fn();
    const member = buildMember();
    render(<MembersTable members={[member]} today={TODAY} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('cell', { name: '30123456' }));

    expect(onOpen).toHaveBeenCalledExactlyOnceWith(member);
  });

  it('opens a member from the keyboard through the name button', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<MembersTable members={[buildMember()]} today={TODAY} onOpen={onOpen} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Lucía Ríos' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders the name as plain text without an open handler', () => {
    render(<MembersTable members={[buildMember()]} today={TODAY} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
