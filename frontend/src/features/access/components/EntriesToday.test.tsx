import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { useEntriesToday } from '../hooks/useEntriesToday';
import type { EntriesDay } from '../types/entries';
import { EntriesToday } from './EntriesToday';

afterEach(() => vi.unstubAllGlobals());

const day: EntriesDay = {
  date: '2026-11-07',
  count: 2,
  distinctMembers: 2,
  counts: { entered: 2, warned: 1, refused: 1 },
  entries: [
    { id: 'e3', checkedAt: '2026-11-07T15:30:00.000Z', memberNumber: '102', name: 'Mateo Prueba', method: 'face', result: 'yellow' },
    { id: 'e2', checkedAt: '2026-11-07T13:05:00.000Z', memberNumber: '101', name: 'Lucía Prueba', method: 'dni', result: 'green' },
    { id: 'e1', checkedAt: '2026-11-07T12:00:00.000Z', memberNumber: '103', name: 'Ana Prueba', method: 'dni', result: 'red' },
  ],
};

function stubEntries(...answers: Array<EntriesDay | Response | Error>) {
  const queue = [...answers];
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    const next = queue.length > 1 ? queue.shift()! : queue[0]!;
    if (next instanceof Error) throw next;
    return next instanceof Response ? next : jsonResponse(next);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The list the way the page uses it: the hook reads, the component draws. */
function Harness({ refreshKey, refreshMs = 60_000 }: { refreshKey: number; refreshMs?: number }) {
  const { state, reload } = useEntriesToday(refreshKey, refreshMs);
  return <EntriesToday state={state} onRetry={() => void reload()} />;
}

describe('EntriesToday', () => {
  it('shows the record count and a newest-first table with time, number, name, method and a result chip', async () => {
    stubEntries(day);
    render(<Harness refreshKey={0} />);

    expect(await screen.findByText('3 registros')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Accesos de hoy' })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['HORA', 'N° SOCIO', 'SOCIO', 'MEDIO', 'RESULTADO']);
    const rows = within(table).getAllByRole('row');
    // 15:30 UTC is 12:30 in the club time zone.
    expect(within(rows[1]!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['12:30', '102', 'Mateo Prueba', 'Cámara', 'CON AVISO']);
    expect(within(rows[2]!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['10:05', '101', 'Lucía Prueba', 'DNI', 'AUTORIZADO']);
    expect(within(rows[3]!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['09:00', '103', 'Ana Prueba', 'DNI', 'NO HABILITADO']);
  });

  it('colors the chip by result', async () => {
    stubEntries(day);
    render(<Harness refreshKey={0} />);
    expect(await screen.findByText('CON AVISO')).toHaveClass('entries-card__chip--yellow');
    expect(screen.getByText('AUTORIZADO')).toHaveClass('entries-card__chip--green');
    expect(screen.getByText('NO HABILITADO')).toHaveClass('entries-card__chip--red');
  });

  it('says "1 registro" in the singular', async () => {
    stubEntries({ ...day, entries: [day.entries[0]!] });
    render(<Harness refreshKey={0} />);
    expect(await screen.findByText('1 registro')).toBeInTheDocument();
  });

  it('shows a dash for a member that no longer exists', async () => {
    stubEntries({ ...day, entries: [{ id: 'e9', checkedAt: day.entries[0]!.checkedAt, memberNumber: null, name: null, method: 'dni', result: 'green' }] });
    render(<Harness refreshKey={0} />);
    const row = within(await screen.findByRole('table')).getAllByRole('row')[1]!;
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent).slice(1, 3)).toEqual(['—', '—']);
  });

  it('says so when nothing was checked yet', async () => {
    stubEntries({ ...day, entries: [], count: 0, distinctMembers: 0 });
    render(<Harness refreshKey={0} />);
    expect(await screen.findByText('Todavía no hubo controles hoy.')).toBeInTheDocument();
    expect(screen.getByText('0 registros')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('explains in Spanish that the log is unavailable without a database', async () => {
    stubEntries(jsonResponse({ error: 'entries_unavailable', message: 'The entry log is not configured on this server' }, 503));
    render(<Harness refreshKey={0} />);
    expect(await screen.findByText('El registro de ingresos no está disponible en este servidor.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/not configured/)).not.toBeInTheDocument();
  });

  it('explains a lost connection and offers to try again', async () => {
    const fetchMock = stubEntries(new TypeError('network'), day);
    render(<Harness refreshKey={0} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    screen.getByRole('button', { name: 'Reintentar' }).click();
    expect(await screen.findByText('3 registros')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats a malformed answer as an error, not a crash', async () => {
    stubEntries(jsonResponse([]));
    render(<Harness refreshKey={0} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('reads again when the refresh key changes, keeping the table on screen meanwhile', async () => {
    const fetchMock = stubEntries(day, { ...day, entries: [{ ...day.entries[0]!, id: 'e4', name: 'Nuevo Prueba' }, ...day.entries] });
    const { rerender } = render(<Harness refreshKey={0} />);
    await screen.findByText('3 registros');

    rerender(<Harness refreshKey={1} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(await screen.findByText('4 registros')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reads again on its own every interval', async () => {
    const fetchMock = stubEntries(day);
    render(<Harness refreshKey={0} refreshMs={30} />);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3));
  });

  it('keeps the last table and warns when a refresh fails', async () => {
    stubEntries(day, new TypeError('network'));
    const { rerender } = render(<Harness refreshKey={0} />);
    await screen.findByText('3 registros');

    rerender(<Harness refreshKey={1} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('stops reading when it is closed', async () => {
    const fetchMock = stubEntries(day);
    const { unmount } = render(<Harness refreshKey={0} refreshMs={30} />);
    await screen.findByText('3 registros');
    unmount();
    const calls = fetchMock.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
});
