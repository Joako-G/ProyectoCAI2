import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { buildRoster, buildStudent } from '../test/fixtures';
import { RosterView } from './RosterView';

afterEach(() => vi.unstubAllGlobals());

describe('RosterView', () => {
  it('shows one block per discipline with the student columns and the active or ended state', async () => {
    const ended = buildStudent({ memberId: 'member-2', memberNumber: '0002', fullName: 'Tomás Gómez', startDate: '2025-03-01', endDate: '2025-12-15', status: 'ended' });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([
      buildRoster({ students: [buildStudent(), ended] }),
      buildRoster({ discipline: { id: 'disc-2', name: 'Vóley' }, students: [] }),
    ])));
    render(<RosterView />);

    expect(await screen.findByRole('heading', { name: 'Básquet' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Alumnos de Básquet' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Nombre', 'N° de socio', 'Desde', 'Hasta', 'Estado']);
    const [active, left] = within(table).getAllByRole('row').slice(1);
    expect(within(active).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Lucía Ríos', '0001', '01/02/2026', '—', 'Activo']);
    expect(within(left).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Tomás Gómez', '0002', '01/03/2025', '15/12/2025', 'Dejó']);
    expect(screen.getByRole('heading', { name: 'Vóley' })).toBeInTheDocument();
    expect(screen.getByText('Esta disciplina todavía no tiene alumnos.')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/roster', expect.anything());
  });

  it('tells a teacher without assigned disciplines that none were assigned', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([])));
    render(<RosterView />);
    expect(await screen.findByText('Todavía no tiene disciplinas asignadas. Consulte con la jefa de secretaría.')).toBeInTheDocument();
  });

  it('shows a loading state and then an error with a retry that reloads', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(jsonResponse([buildRoster()]));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<RosterView />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Básquet' })).toBeInTheDocument();
  });
});
