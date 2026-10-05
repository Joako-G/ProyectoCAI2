import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMember, jsonResponse } from '../test/fixtures';
import { MembersPage } from './MembersPage';

const fetchMock = vi.fn<typeof fetch>();
const TODAY = '2026-10-05';

const lucia = buildMember();
const ana = buildMember({
  id: 'member-2',
  memberNumber: '0002',
  firstName: 'Ana',
  lastName: 'Álvarez',
  dni: '30222222',
  status: 'inactive',
});

function requestedUrls() {
  return fetchMock.mock.calls.map(([url]) => String(url));
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('MembersPage', () => {
  it('shows a loading state, then the members', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([lucia, ana]));
    render(<MembersPage today={TODAY} />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando socios');

    expect(await screen.findByRole('table', { name: 'Listado de socios' })).toBeInTheDocument();
    expect(screen.getByText('Lucía Ríos')).toBeInTheDocument();
    expect(screen.getByText('Ana Álvarez')).toBeInTheDocument();
    expect(screen.queryByText(/Cargando socios/)).not.toBeInTheDocument();
    expect(requestedUrls()).toEqual(['/api/members']);
  });

  it('announces the number of results', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([lucia, ana]));
    render(<MembersPage today={TODAY} />);

    expect(await screen.findByText('2 resultados')).toBeInTheDocument();
  });

  it('uses the singular for one result', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([lucia]));
    render(<MembersPage today={TODAY} />);

    expect(await screen.findByText('1 resultado')).toBeInTheDocument();
  });

  it('shows an empty state when nobody matches', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<MembersPage today={TODAY} />);

    expect(await screen.findByText(/No hay socios/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the backend message on error and retries on demand', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'internal_error', message: 'Boom' }, 500))
      .mockResolvedValueOnce(jsonResponse([lucia]));
    const user = userEvent.setup();
    render(<MembersPage today={TODAY} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudo cargar el listado');
    expect(alert).toHaveTextContent('Boom');

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Lucía Ríos')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows a connection message when the network fails', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<MembersPage today={TODAY} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor',
    );
  });

  it('searches on submit and keeps the status filter', async () => {
    fetchMock.mockImplementation(async () => jsonResponse([lucia]));
    const user = userEvent.setup();
    render(<MembersPage today={TODAY} />);
    await screen.findByText('Lucía Ríos');

    await user.click(screen.getByRole('radio', { name: 'Activos' }));
    await user.type(screen.getByRole('searchbox', { name: /Buscar socio/ }), 'rios{Enter}');

    await waitFor(() =>
      expect(requestedUrls()).toContain('/api/members?search=rios&status=active'),
    );
  });

  it('filters by status when a tab is chosen', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([lucia, ana]));
    fetchMock.mockResolvedValueOnce(jsonResponse([ana]));
    const user = userEvent.setup();
    render(<MembersPage today={TODAY} />);
    await screen.findByText('Lucía Ríos');

    await user.click(screen.getByRole('radio', { name: 'Inactivos' }));

    await waitFor(() => expect(screen.queryByText('Lucía Ríos')).not.toBeInTheDocument());
    expect(screen.getByText('Ana Álvarez')).toBeInTheDocument();
    expect(requestedUrls()[1]).toBe('/api/members?status=inactive');
  });

  it('ignores a stale response that resolves after a newer request', async () => {
    let resolveFirst!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (resolveFirst = resolve)));
    fetchMock.mockResolvedValueOnce(jsonResponse([ana]));
    const user = userEvent.setup();
    render(<MembersPage today={TODAY} />);

    await user.click(screen.getByRole('radio', { name: 'Inactivos' }));
    expect(await screen.findByText('Ana Álvarez')).toBeInTheDocument();

    resolveFirst(jsonResponse([lucia]));
    await Promise.resolve();

    expect(screen.queryByText('Lucía Ríos')).not.toBeInTheDocument();
    expect(screen.getByText('Ana Álvarez')).toBeInTheDocument();
  });

  it('forwards the Alta de socio action', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([lucia]));
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<MembersPage today={TODAY} onCreate={onCreate} />);
    await screen.findByText('Lucía Ríos');

    await user.click(screen.getByRole('button', { name: 'Alta de socio' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
