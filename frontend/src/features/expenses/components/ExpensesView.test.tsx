import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import type { Expense } from '../types/expense';
import { ExpensesView } from './ExpensesView';

afterEach(() => vi.unstubAllGlobals());

const lightBill: Expense = {
  id: 'e1',
  date: '2026-10-01',
  amount: 12000,
  category: 'services',
  description: 'Factura de luz',
  createdBy: 'user-1',
  createdAt: '2026-10-01T15:00:00.000Z',
};

/** A server that starts with the given expenses and stores each POST, like the real one. */
function stubServer(initial: Expense[] = [lightBill], failPost?: number) {
  let expenses = initial;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/expenses' && init?.method === 'POST') {
      if (failPost) return jsonResponse({ error: 'x' }, failPost);
      const body = JSON.parse(String(init.body)) as Omit<Expense, 'id' | 'createdBy' | 'createdAt'>;
      const created: Expense = { ...body, id: `e${expenses.length + 1}`, createdBy: 'user-1', createdAt: '2026-10-05T15:00:00.000Z' };
      expenses = [created, ...expenses];
      return jsonResponse(created, 201);
    }
    if (url === '/api/expenses') return jsonResponse(expenses);
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const posts = (fetchMock: ReturnType<typeof stubServer>) => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');

describe('ExpensesView', () => {
  it('lists the recorded expenses with category and amount', async () => {
    stubServer();
    render(<ExpensesView canWrite />);

    expect(await screen.findByText('Factura de luz')).toBeInTheDocument();
    expect(screen.getByText('01/10/2026')).toBeInTheDocument();
    // The same word is also an option of the category select, so look inside the table only.
    expect(within(screen.getByRole('table')).getByText('Servicios')).toBeInTheDocument();
  });

  it('says so when there are no expenses', async () => {
    stubServer([]);
    render(<ExpensesView canWrite />);
    expect(await screen.findByText('Todavía no hay gastos registrados.')).toBeInTheDocument();
  });

  it('keeps the register button disabled until the amount and description are valid', async () => {
    stubServer();
    render(<ExpensesView canWrite />);
    const button = await screen.findByRole('button', { name: 'Registrar gasto' });
    expect(button).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Monto'), '1.5');
    await userEvent.type(screen.getByLabelText('Descripción'), 'Pintura');
    expect(button).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('Monto'));
    await userEvent.type(screen.getByLabelText('Monto'), '1500');
    expect(button).toBeEnabled();
  });

  it('sends the expense, clears the form and shows the new row', async () => {
    const fetchMock = stubServer();
    render(<ExpensesView canWrite />);
    await screen.findByText('Factura de luz');

    await userEvent.type(screen.getByLabelText('Monto'), '3000');
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'supplies');
    await userEvent.type(screen.getByLabelText('Descripción'), '  Pintura  ');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar gasto' }));

    expect(await screen.findByText('Pintura')).toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(1);
    expect(JSON.parse(String(posts(fetchMock)[0]![1]!.body))).toMatchObject({ amount: 3000, category: 'supplies', description: 'Pintura' });
    expect(screen.getByLabelText('Monto')).toHaveValue('');
    expect(screen.getByLabelText('Descripción')).toHaveValue('');
  });

  it('shows a Spanish error and keeps what was typed when the server refuses', async () => {
    stubServer([lightBill], 400);
    render(<ExpensesView canWrite />);
    await screen.findByText('Factura de luz');

    await userEvent.type(screen.getByLabelText('Monto'), '3000');
    await userEvent.type(screen.getByLabelText('Descripción'), 'Pintura');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar gasto' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Revise los datos');
    expect(screen.getByLabelText('Monto')).toHaveValue('3000');
  });

  it('hides the form from someone who may only read', async () => {
    stubServer();
    render(<ExpensesView canWrite={false} />);

    expect(await screen.findByText('Factura de luz')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar gasto' })).not.toBeInTheDocument();
  });
});
