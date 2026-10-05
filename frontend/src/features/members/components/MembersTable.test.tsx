import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildMember } from '../test/fixtures';
import { MembersTable } from './MembersTable';

const TODAY = '2026-10-05';

describe('MembersTable', () => {
  it('labels the columns', () => {
    render(<MembersTable members={[buildMember()]} today={TODAY} />);

    const table = screen.getByRole('table', { name: 'Listado de socios' });
    for (const name of ['N° socio', 'Socio', 'DNI', 'Socio desde', 'Estado']) {
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
});
