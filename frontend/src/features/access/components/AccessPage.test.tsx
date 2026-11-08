import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { buildAccessCheck } from '../test/fixtures';
import type { EntriesDay } from '../types/entries';
import { AccessPage } from './AccessPage';

afterEach(() => vi.unstubAllGlobals());

const empty: EntriesDay = { date: '2026-11-07', count: 0, distinctMembers: 0, counts: { entered: 0, warned: 0, refused: 0 }, entries: [] };

describe('AccessPage', () => {
  it('shows the entrance check and, below it, the entries of the day', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(empty)));
    render(<AccessPage />);
    expect(screen.getByLabelText('DNI del socio')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Ingresos de hoy' })).toBeInTheDocument();
  });

  it('reads the entries again after each answered check', async () => {
    const fetchMock = vi.fn(async (url: string) => jsonResponse(url === '/api/access/check' ? buildAccessCheck() : empty));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<AccessPage />);
    await screen.findByText('Todavía no ingresó nadie hoy.');
    const entryReads = () => fetchMock.mock.calls.filter(([url]) => url === '/api/access/entries').length;
    expect(entryReads()).toBe(1);

    await user.type(screen.getByLabelText('DNI del socio'), '30111222{Enter}');
    await screen.findByText('Puede ingresar');

    await waitFor(() => expect(entryReads()).toBe(2));
  });

  it('does not read the entries again when a check fails', async () => {
    const fetchMock = vi.fn(async (url: string) => (url === '/api/access/check' ? jsonResponse({ error: 'x', message: 'x' }, 500) : jsonResponse(empty)));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<AccessPage />);
    await screen.findByText('Todavía no ingresó nadie hoy.');

    await user.type(screen.getByLabelText('DNI del socio'), '30111222{Enter}');
    await screen.findByText(/No se pudo controlar el ingreso/);

    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/access/entries')).toHaveLength(1);
  });
});
