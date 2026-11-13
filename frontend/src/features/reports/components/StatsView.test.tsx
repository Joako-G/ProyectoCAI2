import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMember, jsonResponse } from '../../members/test/fixtures';
import type { DebtNotice } from '../../notices/types/notice';
import { buildRevenue } from '../test/fixtures';
import { ReportsView } from './ReportsView';
import { StatsView } from './StatsView';

afterEach(() => vi.unstubAllGlobals());

const expense = (id: string, date: string, amount: number, category: string) => ({ id, date, amount, category, description: 'x', createdBy: 'u', createdAt: `${date}T12:00:00.000Z` });
const EXPENSES = [expense('e1', '2026-10-02', 1500, 'services'), expense('e2', '2026-09-10', 500, 'salaries')];

const INCOME = {
  from: '2026-05',
  to: '2026-10',
  months: ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'],
  total: 10000,
  disciplines: [
    { id: 'basket', name: 'Básquet', total: 7000, fees: 6000, surcharges: 1000, byMonth: [0, 0, 1000, 2000, 2000, 2000] },
    { id: 'judo', name: 'Judo', total: 3000, fees: 3000, surcharges: 0, byMonth: [0, 0, 1000, 1000, 500, 500] },
  ],
};

const debt = (overrides: Partial<DebtNotice>): DebtNotice => ({
  memberId: 'm1', memberNumber: '0001', name: 'Lucía Ríos', standing: 'debtor', unpaidPeriodCount: 1, total: 3000,
  recipient: 'member', recipientName: 'Lucía Ríos', recipientContact: '', link: null, numberIssue: true, ...overrides,
});
const DEBTS = [debt({}), debt({ memberId: 'm2', memberNumber: '0002', name: 'Ana Gómez', unpaidPeriodCount: 5, total: 30000, standing: 'deregistered' })];

interface Routes {
  expenses?: unknown;
  expensesStatus?: number;
}

function stubApi({ expenses = EXPENSES, expensesStatus = 200 }: Routes = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith('/api/reports/revenue')) {
      return jsonResponse(buildRevenue({ granularity: 'monthly', total: url.includes('date=2026-10') ? 4500 : 3000, annulled: { count: url.includes('date=2026-10') ? 2 : 0, total: 800 } }));
    }
    if (url.startsWith('/api/reports/discipline-income')) return jsonResponse(INCOME);
    if (url.startsWith('/api/expenses')) return jsonResponse(expenses, expensesStatus);
    if (url.startsWith('/api/notices/debt')) return jsonResponse({ asOf: '2026-10-15', rows: DEBTS });
    if (url.startsWith('/api/members')) return jsonResponse(Array.from({ length: 10 }, (_unused, index) => buildMember({ id: `m${index + 1}` })));
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const calls = (fetchMock: ReturnType<typeof stubApi>, prefix: string) => fetchMock.mock.calls.map(([url]) => url).filter((url) => url.startsWith(prefix));
const summary = () => screen.findByRole('region', { name: 'Resumen del período' });
const goNext = async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: /^Siguiente/ }));

describe('StatsView: summary', () => {
  it('opens on the summary of the last six months, with the month against the one before it', async () => {
    const fetchMock = stubApi();
    render(<StatsView today="2026-10-15" />);

    const period = await summary();
    expect(period).toHaveTextContent('Al club le quedaron $ 17.500,00 a favor');
    expect(within(period).getByText('Entró').parentElement).toHaveTextContent('$ 19.500,00');
    expect(within(period).getByText('Salió').parentElement).toHaveTextContent('$ 2.000,00');
    expect(within(period).getByText('Quedó').parentElement).toHaveTextContent('$ 17.500,00');
    expect(period).toHaveTextContent('En octubre de 2026 entraron $ 1.500,00 más que en septiembre de 2026.');
    expect(period).toHaveTextContent('El mes en que más dinero entró fue octubre de 2026');
    expect(period).toHaveTextContent('Se anularon 2 recibos');
    expect(screen.getByRole('status')).toHaveTextContent('Estás viendo: de mayo a octubre de 2026 (6 meses).');

    const october = within(screen.getByRole('table', { name: 'Ingresos y gastos de cada mes' })).getByRole('row', { name: /Octubre de 2026/ });
    expect(october).toHaveTextContent('$ 4.500,00');
    expect(october).toHaveTextContent('$ 1.500,00');
    expect(october).toHaveTextContent('$ 3.000,00 a favor');
    expect(calls(fetchMock, '/api/reports/revenue')).toHaveLength(6);
    expect(screen.getByRole('group', { name: '1 de 5: Resumen' })).toBeInTheDocument();
  });

  it('keeps the income when the expenses cannot be read', async () => {
    stubApi({ expenses: { error: 'forbidden' }, expensesStatus: 403 });
    render(<StatsView today="2026-10-15" />);

    const period = await summary();
    expect(period).toHaveTextContent('En este período entraron $ 19.500,00.');
    expect(within(period).queryByText('Salió')).not.toBeInTheDocument();
    expect(period).toHaveTextContent('Los gastos no están disponibles para este usuario.');
  });

  it('offers to try again when the income cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'boom' }, 500)));
    render(<StatsView today="2026-10-15" />);

    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('No se pudo cargar los ingresos.');
    expect(screen.getAllByRole('button', { name: 'Reintentar' }).length).toBeGreaterThan(0);
  });
});

describe('StatsView: carousel', () => {
  it('moves one slide at a time with the arrows, the steps and the keyboard, and stops at the ends', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<StatsView today="2026-10-15" />);

    await summary();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente: Ingresos' })).toHaveAttribute('data-attention', 'true');

    await goNext(user);
    expect(screen.getByRole('group', { name: '2 de 5: Ingresos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente: Disciplinas' })).not.toHaveAttribute('data-attention');

    await user.click(screen.getByRole('button', { name: /Gastos/ }));
    expect(screen.getByRole('group', { name: '4 de 5: Gastos' })).toBeInTheDocument();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('group', { name: '5 de 5: Deudas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('group', { name: '4 de 5: Gastos' })).toBeInTheDocument();
  });
});

describe('StatsView: income', () => {
  it('shows the period by concept and by payment method', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<StatsView today="2026-10-15" />);

    await summary();
    await goNext(user);

    const concepts = await screen.findByRole('list', { name: 'Ingresos por concepto' });
    expect(within(concepts).getByText(/Cuotas de actividades/)).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Ingresos por medio de pago' })).getByText(/Efectivo/)).toBeInTheDocument();
  });
});

describe('StatsView: disciplines', () => {
  it('ranks the disciplines of the period and opens the biggest one month by month', async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    render(<StatsView today="2026-10-15" />);

    await summary();
    await user.click(screen.getByRole('button', { name: /Disciplinas/ }));

    const ranking = await screen.findByRole('list', { name: 'Ranking de disciplinas' });
    expect(within(ranking).getAllByRole('listitem')).toHaveLength(2);
    expect(within(ranking).getByText(/70 %/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Detalle de Básquet' })).toHaveTextContent('Cuotas: $ 6.000,00 · Recargos: $ 1.000,00');
    expect(calls(fetchMock, '/api/reports/discipline-income')).toEqual(['/api/reports/discipline-income?from=2026-05&to=2026-10']);

    await user.click(within(ranking).getByRole('button', { name: /Judo/ }));
    const judo = within(screen.getByRole('region', { name: 'Detalle de Judo' }));
    expect(judo.getByRole('row', { name: /Julio de 2026/ })).toHaveTextContent('$ 1.000,00');
    expect(judo.getByRole('row', { name: /Total/ })).toHaveTextContent('$ 3.000,00');
  });
});

describe('StatsView: expenses', () => {
  it('shows what was spent in the period by category', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<StatsView today="2026-10-15" />);

    await summary();
    await user.click(screen.getByRole('button', { name: /Gastos/ }));

    const categories = await screen.findByRole('list', { name: 'Gastos por categoría' });
    expect(within(categories).getByText(/Servicios/)).toBeInTheDocument();
    expect(within(categories).getByText(/Sueldos/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Gastos por categoría' })).toHaveTextContent('$ 2.000,00');
  });

  it('says so when there is no access to the expenses', async () => {
    stubApi({ expenses: { error: 'forbidden' }, expensesStatus: 403 });
    const user = userEvent.setup();
    render(<StatsView today="2026-10-15" />);

    await summary();
    await user.click(screen.getByRole('button', { name: /Gastos/ }));

    expect(await screen.findByText('No se pudo cargar los gastos.')).toBeInTheDocument();
  });
});

describe('StatsView: collection', () => {
  it('shows who is up to date, who owes and how much, as of today', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<StatsView today="2026-10-15" />);

    await summary();
    await user.click(screen.getByRole('button', { name: /Deudas/ }));

    const standing = await screen.findByRole('region', { name: 'Estado de los socios activos' });
    expect(standing).toHaveTextContent('De 10 socios activos, 8 están al día y 2 deben. Entre todos deben $ 33.000,00.');
    const key = within(within(standing).getByRole('list', { name: 'Estado de los socios activos' }));
    expect(key.getByText(/Están al día/)).toHaveTextContent('8 socios (80 %)');
    expect(key.getByText(/Deben más de 3 meses/)).toHaveTextContent('1 socio (10 %)');
    const top = within(screen.getByRole('region', { name: 'Mayores deudas' }));
    expect(top.getByText(/Ana Gómez/)).toBeInTheDocument();
    expect(top.getByText(/N° 0002 · 5 meses/)).toBeInTheDocument();
  });
});

describe('StatsView: period', () => {
  it('asks again for the period chosen with a quick button and for the months typed in', async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    render(<StatsView today="2026-10-15" />);

    await summary();
    await user.click(screen.getByRole('button', { name: 'Este año' }));
    await summary();
    expect(screen.getByRole('status')).toHaveTextContent('de enero a octubre de 2026 (10 meses)');
    expect(calls(fetchMock, '/api/reports/revenue')).toHaveLength(6 + 10);
    expect(screen.getByRole('button', { name: 'Este año' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not ask the server for a range that runs backwards', async () => {
    const fetchMock = stubApi();
    render(<StatsView today="2026-10-15" />);

    await summary();
    const before = calls(fetchMock, '/api/reports').length;
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11' } });

    expect(screen.getByRole('alert')).toHaveTextContent('El mes de inicio no puede ser posterior al de fin.');
    expect(calls(fetchMock, '/api/reports')).toHaveLength(before);
  });
});

describe('ReportsView tabs', () => {
  it('opens on the reports and loads nothing for the statistics until their tab is chosen', async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    render(<ReportsView />);

    expect(screen.getByRole('tab', { name: 'Reportes' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('radio', { name: 'Recaudación' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('tab', { name: 'Estadísticas' }));
    expect(await summary()).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Recaudación' })).not.toBeInTheDocument();
  });
});
