import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMember, jsonResponse } from '../test/fixtures';
import type { MemberListQuery } from '../types/member';
import { MembersPage } from './MembersPage';

const fetchMock = vi.fn<typeof fetch>();
const ALL: MemberListQuery = { search: '', status: 'all', disciplineId: '' };

beforeEach(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function stubMembers(count: number) {
  const members = Array.from({ length: count }, (_unused, index) =>
    buildMember({ id: `m${index + 1}`, memberNumber: String(index + 1).padStart(4, '0'), firstName: `Nombre${index + 1}`, lastName: 'Prueba' }));
  fetchMock.mockImplementation(async () => jsonResponse(members));
}

function shownMembers() {
  const table = screen.getByRole('table', { name: 'Listado de socios' });
  return within(table).getAllByRole('row').slice(1).map((row) => row.textContent ?? '');
}

describe('MembersPage pagination', () => {
  it('shows no pagination when the results fit on one page', async () => {
    stubMembers(10);
    render(<MembersPage query={ALL} onQueryChange={vi.fn()} canCreate={false} today="2026-10-05" />);

    await screen.findByRole('table');
    expect(shownMembers()).toHaveLength(10);
    expect(screen.queryByRole('navigation', { name: 'Paginación de socios' })).not.toBeInTheDocument();
  });

  it('shows ten members per page while the summary counts every result', async () => {
    stubMembers(25);
    const user = userEvent.setup();
    render(<MembersPage query={ALL} onQueryChange={vi.fn()} canCreate={false} today="2026-10-05" />);

    await screen.findByRole('table');
    expect(shownMembers()).toHaveLength(10);
    expect(screen.getByText('25 resultados')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Página 3' }));
    expect(shownMembers()).toHaveLength(5);
    expect(shownMembers()[4]).toContain('Nombre25');
  });

  it('goes back to the first page when the filter changes', async () => {
    stubMembers(25);
    const user = userEvent.setup();
    const { rerender } = render(<MembersPage query={ALL} onQueryChange={vi.fn()} canCreate={false} today="2026-10-05" />);

    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page');

    rerender(<MembersPage query={{ ...ALL, status: 'active' }} onQueryChange={vi.fn()} canCreate={false} today="2026-10-05" />);
    expect(await screen.findByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page');
  });
});
