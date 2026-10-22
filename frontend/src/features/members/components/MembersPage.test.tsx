import { useState, type ComponentProps } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DisciplineCatalog } from '../../disciplines/hooks/useDisciplineCatalog';
import { buildDiscipline } from '../../disciplines/test/fixtures';
import type { Discipline } from '../../disciplines/types/discipline';
import { buildMember, jsonResponse } from '../test/fixtures';
import type { MemberListQuery } from '../types/member';
import { MembersPage as ControlledMembersPage } from './MembersPage';

/** Holds the query like `MembersView` does, so the page can be exercised on its own. */
function MembersPage(props: Omit<ComponentProps<typeof ControlledMembersPage>, 'query' | 'onQueryChange'>) {
  const [query, setQuery] = useState<MemberListQuery>({ search: '', status: 'all', disciplineId: '' });
  return <ControlledMembersPage {...props} query={query} onQueryChange={setQuery} />;
}

function readyCatalog(...disciplines: Discipline[]): DisciplineCatalog {
  return { state: { phase: 'ready', disciplines }, retry: vi.fn() };
}

const fetchMock = vi.fn<typeof fetch>();
const TODAY = '2026-10-05';

const basket = buildDiscipline();
const volley = buildDiscipline({ id: 'disc-2', name: 'Vóley' });
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

  it('refetches when the same search is submitted again', async () => {
    fetchMock.mockImplementation(async () => jsonResponse([lucia]));
    const user = userEvent.setup();
    render(<MembersPage today={TODAY} />);
    await screen.findByText('Lucía Ríos');

    await user.type(screen.getByRole('searchbox', { name: /Buscar socio/ }), 'x{Enter}');
    await waitFor(() => expect(requestedUrls()).toEqual(['/api/members', '/api/members?search=x']));
    await screen.findByText('Lucía Ríos');

    await user.type(screen.getByRole('searchbox', { name: /Buscar socio/ }), '{Enter}');

    await waitFor(() =>
      expect(requestedUrls()).toEqual(['/api/members', '/api/members?search=x', '/api/members?search=x']),
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

    // Let the stale response settle completely (json() and any state update) before asserting.
    await act(async () => {
      resolveFirst(jsonResponse([lucia]));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.queryByText('Lucía Ríos')).not.toBeInTheDocument();
    expect(screen.getByText('Ana Álvarez')).toBeInTheDocument();
  });

  it('shows the discipline names in the rows', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([buildMember({ disciplineIds: ['disc-1', 'disc-2'] })]));
    render(<MembersPage today={TODAY} catalog={readyCatalog(basket, volley)} />);

    expect(await screen.findByRole('cell', { name: 'Básquet, Vóley' })).toBeInTheDocument();
  });

  it('combines the discipline filter with search and status', async () => {
    fetchMock.mockImplementation(async () => jsonResponse([lucia]));
    const user = userEvent.setup();
    render(<MembersPage today={TODAY} catalog={readyCatalog(basket, volley)} />);
    await screen.findByText('Lucía Ríos');

    await user.click(screen.getByRole('radio', { name: 'Activos' }));
    await user.type(screen.getByRole('searchbox', { name: /Buscar socio/ }), 'rios{Enter}');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por disciplina' }), 'disc-2');

    await waitFor(() =>
      expect(requestedUrls()).toContain('/api/members?search=rios&status=active&disciplineId=disc-2'),
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por disciplina' }), '');
    await waitFor(() => expect(requestedUrls().at(-1)).toBe('/api/members?search=rios&status=active'));
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

  it('shows a catalog notice with retry, keeps the members and disables the discipline filter', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([lucia]));
    const retry = vi.fn();
    const catalog: DisciplineCatalog = { state: { phase: 'error', message: 'Catalog down' }, retry };
    const user = userEvent.setup();
    render(<MembersPage today={TODAY} catalog={catalog} />);

    expect(await screen.findByText('Lucía Ríos')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No se pudieron cargar las disciplinas');
    expect(alert).toHaveTextContent('Catalog down');
    expect(screen.getByRole('combobox', { name: 'Filtrar por disciplina' })).toBeDisabled();

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows no catalog notice while the catalog loads or once it is ready', async () => {
    fetchMock.mockImplementation(async () => jsonResponse([lucia]));
    const loading: DisciplineCatalog = { state: { phase: 'loading' }, retry: vi.fn() };
    const { rerender } = render(<MembersPage today={TODAY} catalog={loading} />);
    await screen.findByText('Lucía Ríos');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filtrar por disciplina' })).toBeDisabled();

    rerender(<MembersPage today={TODAY} catalog={readyCatalog(basket)} />);
    expect(screen.getByRole('combobox', { name: 'Filtrar por disciplina' })).toBeEnabled();
  });
});
