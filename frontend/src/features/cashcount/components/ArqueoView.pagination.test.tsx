import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { buildCashCount, buildPreview } from '../test/fixtures';
import { ArqueoView } from './ArqueoView';

afterEach(() => vi.unstubAllGlobals());

/** `count` closed days before today (2026-10-05), one per day of September, newest first like the server sends them. */
function stubHistory(count: number) {
  const history = Array.from({ length: count }, (_unused, index) => {
    const day = String(count - index).padStart(2, '0');
    return buildCashCount({ id: `close-${day}`, businessDate: `2026-09-${day}` });
  });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => jsonResponse(url === '/api/cashcount/today' ? buildPreview() : history)));
}

function shownDays() {
  const table = screen.getByRole('table', { name: 'Cierres anteriores' });
  return within(table).getAllByRole('row').slice(1).map((row) => row.textContent ?? '');
}

describe('ArqueoView pagination of the earlier closings', () => {
  it('shows no pagination when the closings fit on one page', async () => {
    stubHistory(10);
    render(<ArqueoView />);

    await screen.findByRole('table', { name: 'Cierres anteriores' });
    expect(shownDays()).toHaveLength(10);
    expect(screen.queryByRole('navigation', { name: 'Paginación de cierres anteriores' })).not.toBeInTheDocument();
  });

  it('shows ten closings per page and moves between pages when there are more', async () => {
    stubHistory(23);
    const user = userEvent.setup();
    render(<ArqueoView />);

    await screen.findByRole('table', { name: 'Cierres anteriores' });
    expect(shownDays()).toHaveLength(10);
    expect(shownDays()[0]).toContain('23/09/2026');
    expect(screen.getByText('Mostrando 1–10 de 23')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Página 3' }));
    expect(shownDays()).toHaveLength(3);
    expect(shownDays()[2]).toContain('01/09/2026');
  });

  it('leaves the day being closed and the expected totals out of the pagination', async () => {
    stubHistory(12);
    render(<ArqueoView />);

    await screen.findByRole('table', { name: 'Cierres anteriores' });
    expect(screen.getByRole('table', { name: 'Esperado por medio de pago' })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: /Paginación/ })).toHaveLength(1);
  });
});
