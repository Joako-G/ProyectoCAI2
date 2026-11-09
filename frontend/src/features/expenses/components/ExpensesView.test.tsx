import { fireEvent, render, screen, within } from '@testing-library/react';
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

    await userEvent.type(screen.getByLabelText('Monto'), '0');
    await userEvent.type(screen.getByLabelText('Descripción'), 'Pintura');
    expect(button).toBeDisabled();
    expect(screen.getByText('Ingresá un monto entero mayor a cero.')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Monto'));
    await userEvent.type(screen.getByLabelText('Monto'), '1500');
    expect(button).toBeEnabled();
    expect(screen.queryByText('Ingresá un monto entero mayor a cero.')).not.toBeInTheDocument();
  });

  it('keeps only digits in the amount and stops at ten of them', async () => {
    stubServer();
    render(<ExpensesView canWrite />);
    const amount = await screen.findByLabelText('Monto');

    await userEvent.type(amount, '1.5e3');
    expect(amount).toHaveValue('153');
    await userEvent.clear(amount);
    await userEvent.type(amount, '123456789012345');
    expect(amount).toHaveValue('1234567890');
  });

  it('refuses a date in the future typed by hand', async () => {
    stubServer();
    render(<ExpensesView canWrite />);
    await userEvent.type(await screen.findByLabelText('Monto'), '1500');
    await userEvent.type(screen.getByLabelText('Descripción'), 'Pintura');
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2999-01-01' } });

    expect(screen.getByText('La fecha no puede ser futura.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar gasto' })).toBeDisabled();
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

  it("defaults the date to the club's day, not the browser's", async () => {
    // 02:00 UTC is still the previous evening in the club's time zone (UTC-3).
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-05T02:00:00Z') });
    try {
      stubServer();
      render(<ExpensesView canWrite />);
      expect(await screen.findByLabelText('Fecha')).toHaveValue('2026-10-04');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ExpensesView: failures', () => {
  it.each([
    [403, 'No tiene permiso para ver los gastos.'],
    [500, 'No se pudieron cargar los gastos. Intente de nuevo.'],
  ])('shows a Spanish message when the list answers %d, and Reintentar loads it again', async (status, message) => {
    let failing = true;
    const fetchMock = vi.fn(async () => (failing ? jsonResponse({ error: 'x' }, status) : jsonResponse([lightBill])));
    vi.stubGlobal('fetch', fetchMock);
    render(<ExpensesView canWrite />);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Factura de luz')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows the network message when the list cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    render(<ExpensesView canWrite />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  // A failed save whose outcome is unknown may still have stored the expense, so the list is read again.
  it.each([
    ['a 500 answer', () => jsonResponse({ error: 'x' }, 500)],
    ['a lost connection', () => { throw new TypeError('Failed to fetch'); }],
  ])('reloads the list after %s on save, so a stored expense still shows', async (_name, failure) => {
    let stored = false;
    const created: Expense = { ...lightBill, id: 'e2', description: 'Pintura' };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        stored = true;
        return failure();
      }
      return jsonResponse(stored ? [created, lightBill] : [lightBill]);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ExpensesView canWrite />);
    await screen.findByText('Factura de luz');

    await userEvent.type(screen.getByLabelText('Monto'), '3000');
    await userEvent.type(screen.getByLabelText('Descripción'), 'Pintura');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar gasto' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(await screen.findByText('Pintura', { selector: 'td' })).toBeInTheDocument();
    // What was typed stays, so the person decides whether to try again.
    expect(screen.getByLabelText('Monto')).toHaveValue('3000');
  });

  it('says the expense was saved when only the list refresh fails afterwards, and clears the form', async () => {
    let reads = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse({ ...lightBill, id: 'e2' }, 201);
      reads += 1;
      return reads === 1 ? jsonResponse([lightBill]) : jsonResponse({ error: 'x' }, 500);
    }));
    render(<ExpensesView canWrite />);
    await screen.findByText('Factura de luz');

    await userEvent.type(screen.getByLabelText('Monto'), '3000');
    await userEvent.type(screen.getByLabelText('Descripción'), 'Pintura');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar gasto' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El gasto sí quedó guardado');
    expect(screen.getByLabelText('Monto')).toHaveValue('');
    expect(screen.getByLabelText('Descripción')).toHaveValue('');
  });

  it('does not reload the list after a refusal that is known to have stored nothing', async () => {
    const fetchMock = stubServer([lightBill], 400);
    render(<ExpensesView canWrite />);
    await screen.findByText('Factura de luz');
    const readsBefore = fetchMock.mock.calls.filter(([, init]) => init?.method !== 'POST').length;

    await userEvent.type(screen.getByLabelText('Monto'), '3000');
    await userEvent.type(screen.getByLabelText('Descripción'), 'Pintura');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar gasto' }));
    await screen.findByRole('alert');

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method !== 'POST')).toHaveLength(readsBefore);
  });
});
