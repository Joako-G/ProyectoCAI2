import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { buildNotice, buildNoticeList } from '../test/fixtures';
import { NoticesView } from './NoticesView';

afterEach(() => vi.unstubAllGlobals());

function stubNotices(count: number) {
  const rows = Array.from({ length: count }, (_unused, index) => buildNotice({ memberId: `m${index + 1}`, memberNumber: String(index + 1).padStart(4, '0'), name: `Socio ${index + 1}` }));
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(buildNoticeList(rows))));
}

function shownMembers() {
  const table = screen.getByRole('table', { name: 'Socios con deuda' });
  return within(table).getAllByRole('row').slice(1).map((row) => row.textContent ?? '');
}

describe('NoticesView pagination', () => {
  it('shows no pagination when the notices fit on one page', async () => {
    stubNotices(10);
    render(<NoticesView />);

    await screen.findByRole('table');
    expect(shownMembers()).toHaveLength(10);
    expect(screen.queryByRole('navigation', { name: 'Paginación de avisos' })).not.toBeInTheDocument();
  });

  it('shows ten notices per page while the stats keep counting every member', async () => {
    stubNotices(12);
    const user = userEvent.setup();
    render(<NoticesView />);

    await screen.findByRole('table');
    expect(shownMembers()).toHaveLength(10);
    expect(screen.getByText('12')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(shownMembers()).toHaveLength(2);
    expect(shownMembers()[0]).toContain('Socio 11');
  });
});
