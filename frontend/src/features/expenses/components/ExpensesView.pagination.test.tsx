import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import type { Expense } from '../types/expense';
import { ExpensesView } from './ExpensesView';

afterEach(() => vi.unstubAllGlobals());

function stubExpenses(count: number) {
  const expenses: Expense[] = Array.from({ length: count }, (_unused, index) => ({
    id: `e${index + 1}`,
    date: '2026-10-01',
    amount: 1000,
    category: 'services',
    description: `Gasto ${index + 1}`,
    createdBy: 'user-1',
    createdAt: '2026-10-01T15:00:00.000Z',
  }));
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(expenses)));
}

function shownExpenses() {
  const table = screen.getByRole('table', { name: 'Gastos registrados' });
  return within(table).getAllByRole('row').slice(1).map((row) => row.textContent ?? '');
}

describe('ExpensesView pagination', () => {
  it('shows no pagination when the expenses fit on one page', async () => {
    stubExpenses(10);
    render(<ExpensesView canWrite={false} />);

    await screen.findByRole('table');
    expect(shownExpenses()).toHaveLength(10);
    expect(screen.queryByRole('navigation', { name: 'Paginación de gastos' })).not.toBeInTheDocument();
  });

  it('shows ten expenses per page and keeps the total of all of them', async () => {
    stubExpenses(11);
    const user = userEvent.setup();
    render(<ExpensesView canWrite={false} />);

    await screen.findByRole('table');
    expect(shownExpenses()).toHaveLength(10);
    expect(screen.getByText('$ 11.000')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(shownExpenses()).toHaveLength(1);
    expect(shownExpenses()[0]).toContain('Gasto 11');
  });
});
