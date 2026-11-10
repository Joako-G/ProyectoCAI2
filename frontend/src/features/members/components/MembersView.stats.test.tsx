import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDiscipline } from '../../disciplines/test/fixtures';
import { buildMember, jsonResponse } from '../test/fixtures';
import type { Member } from '../types/member';
import type { MembersSummary } from '../types/member-summary';
import { MembersView } from './MembersView';

const TODAY = '2026-10-05';
const fetchMock = vi.fn<typeof fetch>();

const lucia = buildMember();
const ana = buildMember({ id: 'member-2', memberNumber: '0002', firstName: 'Ana', lastName: 'Álvarez', dni: '30222222' });
const beto = buildMember({ id: 'member-3', memberNumber: '0003', firstName: 'Beto', lastName: 'Benítez', dni: '30333333', status: 'inactive' });

let members: Member[];
let summary: MembersSummary;
let summaryResponse: () => Response;
let summaryCalls: number;
let listUrls: string[];

beforeEach(() => {
  members = [lucia, ana, beto];
  summary = { active: 2, inactive: 1, upToDate: 1, debtors: 1, overdue: 0, ids: { upToDate: [lucia.id], debtors: [ana.id], overdue: [] } };
  summaryResponse = () => jsonResponse(summary);
  summaryCalls = 0;
  listUrls = [];
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url === '/api/members/summary') {
      summaryCalls += 1;
      return summaryResponse();
    }
    if (url === '/api/disciplines') return jsonResponse([buildDiscipline()]);
    if (method === 'GET' && (url === '/api/members' || url.startsWith('/api/members?'))) {
      listUrls.push(url);
      const status = new URL(url, 'http://club.test').searchParams.get('status');
      return jsonResponse(status ? members.filter((member) => member.status === status) : members);
    }
    const byId = /^\/api\/members\/([^/]+)(\/\w+)?$/.exec(url);
    const member = members.find((candidate) => candidate.id === byId?.[1]);
    if (!member) return jsonResponse({ error: 'not_found', message: 'Member not found' }, 404);
    if (method === 'GET') return jsonResponse(member);
    if (byId?.[2] === '/deactivate') {
      Object.assign(member, { status: 'inactive', deactivation: { date: TODAY, reason: 'Se mudó' } });
      return jsonResponse(member);
    }
    return jsonResponse({ error: 'not_found', message: 'Route not found' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function renderView() {
  const user = userEvent.setup({ delay: null });
  render(<MembersView today={TODAY} canWrite />);
  return user;
}

const card = (name: string) => screen.getByRole('button', { name: new RegExp(name) });

describe('Members stat cards', () => {
  it('shows a placeholder while loading, then the five counts', async () => {
    renderView();
    expect(screen.getByRole('group', { name: 'Resumen de socios' })).toHaveAttribute('aria-busy', 'true');

    await waitFor(() => expect(card('Activos')).toHaveTextContent('2'));
    expect(card('Inactivos')).toHaveTextContent('1');
    expect(card('Al día')).toHaveTextContent('1');
    expect(card('Deudores')).toHaveTextContent('1');
    expect(card('Vencidos')).toHaveTextContent('0');
  });

  it('narrows the list to a standing group on click and clears it on a second click', async () => {
    const user = renderView();
    await screen.findByText('Ana Álvarez');
    await waitFor(() => expect(card('Deudores')).toBeEnabled());

    await user.click(card('Deudores'));
    expect(card('Deudores')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Ana Álvarez')).toBeInTheDocument();
    expect(screen.queryByText('Lucía Ríos')).not.toBeInTheDocument();
    expect(screen.queryByText('Beto Benítez')).not.toBeInTheDocument();
    expect(screen.getByText('1 resultado')).toBeInTheDocument();

    await user.click(card('Deudores'));
    expect(card('Deudores')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Lucía Ríos')).toBeInTheDocument();
    expect(screen.getByText('Beto Benítez')).toBeInTheDocument();
  });

  it('drives the status filter from Inactivos and clears it on a second click', async () => {
    const user = renderView();
    await waitFor(() => expect(card('Inactivos')).toBeEnabled());

    await user.click(card('Inactivos'));
    expect(card('Inactivos')).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(listUrls.at(-1)).toBe('/api/members?status=inactive'));
    expect(await screen.findByText('Beto Benítez')).toBeInTheDocument();
    expect(screen.queryByText('Lucía Ríos')).not.toBeInTheDocument();

    await user.click(card('Inactivos'));
    expect(card('Inactivos')).toHaveAttribute('aria-pressed', 'false');
    expect(await screen.findByText('Lucía Ríos')).toBeInTheDocument();
  });

  it('replaces a standing group with the one picked next', async () => {
    const user = renderView();
    await waitFor(() => expect(card('Al día')).toBeEnabled());

    await user.click(card('Al día'));
    await user.click(card('Deudores'));
    expect(card('Al día')).toHaveAttribute('aria-pressed', 'false');
    expect(card('Deudores')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a small message and keeps the list when the summary fails', async () => {
    summaryResponse = () => jsonResponse({ error: 'internal_error', message: 'Unexpected failure' }, 500);
    renderView();

    expect(await screen.findByText(/No se pudieron cargar los contadores/)).toBeInTheDocument();
    expect(await screen.findByText('Lucía Ríos')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Listado de socios' })).toBeInTheDocument();
  });

  it('counts again when the list comes back after a change', async () => {
    const user = renderView();
    await waitFor(() => expect(card('Activos')).toHaveTextContent('2'));
    expect(summaryCalls).toBe(1);

    await user.click(await screen.findByRole('button', { name: 'Ana Álvarez' }));
    await screen.findByRole('heading', { level: 2, name: 'Ana Álvarez' });
    await user.click(screen.getByRole('button', { name: 'Dar de baja' }));
    const dialog = screen.getByRole('dialog', { name: 'Dar de baja a Ana Álvarez' });
    await user.type(within(dialog).getByLabelText('Motivo de la baja'), 'Se mudó');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar baja' }));
    await screen.findByRole('button', { name: 'Reactivar' });

    summary = { active: 1, inactive: 2, upToDate: 1, debtors: 0, overdue: 0, ids: { upToDate: [lucia.id], debtors: [], overdue: [] } };
    await user.click(screen.getByRole('button', { name: /Volver al listado/ }));

    await waitFor(() => expect(card('Activos')).toHaveTextContent('1'));
    expect(card('Inactivos')).toHaveTextContent('2');
    expect(summaryCalls).toBe(2);
  });
});
