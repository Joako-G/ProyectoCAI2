import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import type { EntriesDay } from '../types/entries';
import { EntriesToday } from './EntriesToday';

afterEach(() => vi.unstubAllGlobals());

const day: EntriesDay = {
  date: '2026-11-07',
  count: 2,
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

describe('EntriesToday', () => {
  it('shows how many entered and a newest-first table with time, number, name, method and result', async () => {
    const fetchMock = stubEntries(day);
    render(<EntriesToday refreshKey={0} />);

    expect(await screen.findByRole('heading', { name: 'Ingresos de hoy' })).toBeInTheDocument();
    expect(await screen.findByText('2 socios ingresaron')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/access/entries');

    const rows = within(await screen.findByRole('table', { name: 'Ingresos de hoy' })).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    // 15:30Z is 12:30 in the club (UTC-3).
    expect(within(rows[0]!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['12:30', '102', 'Mateo Prueba', 'Cámara', 'Ingresó, con deuda']);
    expect(within(rows[1]!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['10:05', '101', 'Lucía Prueba', 'DNI', 'Ingresó']);
    expect(within(rows[2]!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['09:00', '103', 'Ana Prueba', 'DNI', 'No ingresó']);
  });

  it('says "1 socio ingresó" in the singular', async () => {
    stubEntries({ ...day, count: 1 });
    render(<EntriesToday refreshKey={0} />);
    expect(await screen.findByText('1 socio ingresó')).toBeInTheDocument();
  });

  it('shows a dash for a member that no longer exists', async () => {
    stubEntries({ ...day, entries: [{ id: 'e9', checkedAt: day.entries[0]!.checkedAt, memberNumber: null, name: null, method: 'dni', result: 'green' }] });
    render(<EntriesToday refreshKey={0} />);
    const row = within(await screen.findByRole('table')).getAllByRole('row')[1]!;
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent).slice(1, 3)).toEqual(['—', '—']);
  });

  it('says so when nobody has entered yet', async () => {
    stubEntries({ date: day.date, count: 0, entries: [] });
    render(<EntriesToday refreshKey={0} />);
    expect(await screen.findByText('Todavía no ingresó nadie hoy.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('explains in Spanish that the log is unavailable without a database', async () => {
    stubEntries(jsonResponse({ error: 'entries_unavailable', message: 'The entry log is not configured on this server' }, 503));
    render(<EntriesToday refreshKey={0} />);
    expect(await screen.findByText('El registro de ingresos no está disponible en este servidor.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/not configured/)).not.toBeInTheDocument();
  });

  it('explains a lost connection and offers to try again', async () => {
    const fetchMock = stubEntries(new TypeError('network'), day);
    render(<EntriesToday refreshKey={0} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    screen.getByRole('button', { name: 'Reintentar' }).click();
    expect(await screen.findByText('2 socios ingresaron')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats a malformed answer as an error, not a crash', async () => {
    stubEntries(jsonResponse([]));
    render(<EntriesToday refreshKey={0} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('reads again when the refresh key changes, keeping the table on screen meanwhile', async () => {
    const fetchMock = stubEntries(day, { ...day, count: 3, entries: [{ ...day.entries[0]!, id: 'e4', name: 'Nuevo Prueba' }, ...day.entries] });
    const { rerender } = render(<EntriesToday refreshKey={0} />);
    await screen.findByText('2 socios ingresaron');

    rerender(<EntriesToday refreshKey={1} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(await screen.findByText('3 socios ingresaron')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reads again on its own every interval', async () => {
    const fetchMock = stubEntries(day);
    render(<EntriesToday refreshKey={0} refreshMs={30} />);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3));
  });

  it('keeps the last table and warns when a refresh fails', async () => {
    stubEntries(day, new TypeError('network'));
    const { rerender } = render(<EntriesToday refreshKey={0} />);
    await screen.findByText('2 socios ingresaron');

    rerender(<EntriesToday refreshKey={1} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('stops reading when it is closed', async () => {
    const fetchMock = stubEntries(day);
    const { unmount } = render(<EntriesToday refreshKey={0} refreshMs={30} />);
    await screen.findByText('2 socios ingresaron');
    unmount();
    const calls = fetchMock.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
});
