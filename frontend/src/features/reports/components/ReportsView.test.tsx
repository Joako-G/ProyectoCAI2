import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDiscipline } from '../../disciplines/test/fixtures';
import { jsonResponse } from '../../members/test/fixtures';
import { buildRevenue, buildSettlement } from '../test/fixtures';
import { downloadXlsx } from '../utils/download-xlsx';
import { ReportsView } from './ReportsView';

vi.mock('../utils/download-xlsx', () => ({ downloadXlsx: vi.fn(async () => undefined) }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(downloadXlsx).mockClear();
});

type Routes = { revenue?: unknown; settlement?: unknown; disciplines?: unknown };

function stubApi({ revenue = buildRevenue(), settlement = buildSettlement(), disciplines = [buildDiscipline()] }: Routes = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith('/api/reports/revenue')) return jsonResponse(revenue);
    if (url.startsWith('/api/reports/discipline-settlement')) return jsonResponse(settlement);
    if (url.startsWith('/api/disciplines')) return jsonResponse(disciplines);
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const reportCalls = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls.map(([url]) => url).filter((url) => url.startsWith('/api/reports'));

describe('ReportsView: revenue', () => {
  it('asks for nothing until the report is generated, then shows the total and its breakdown', async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    render(<ReportsView />);
    expect(reportCalls(fetchMock)).toEqual([]);

    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-05' } });
    await user.click(screen.getByRole('button', { name: 'Generar reporte' }));

    expect(await screen.findByText('Del 05/10/2026 al 05/10/2026')).toBeInTheDocument();
    expect(reportCalls(fetchMock)).toEqual(['/api/reports/revenue?granularity=daily&date=2026-10-05']);
    expect(screen.getByText('Total recaudado')).toBeInTheDocument();
    expect(screen.getByTestId('revenue-total')).toHaveTextContent('$ 4.500');

    const concepts = screen.getByRole('table', { name: 'Recaudación por concepto' });
    expect(within(concepts).getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual(['Cuotas sociales$ 1.500', 'Cuotas de actividades$ 3.000']);
    const methods = screen.getByRole('table', { name: 'Recaudación por medio de pago' });
    expect(within(methods).getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual(['Efectivo$ 4.000', 'QR$ 500']);
    const receipts = screen.getByRole('table', { name: 'Comprobantes del período' });
    expect(within(receipts).getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual(['105/10/2026Efectivo$ 4.000', '205/10/2026QR$ 500']);
  });

  it('requests the period chosen and shows the range the server worked out', async () => {
    const fetchMock = stubApi({ revenue: buildRevenue({ granularity: 'weekly', from: '2026-10-05', to: '2026-10-11' }) });
    const user = userEvent.setup();
    render(<ReportsView />);

    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-07' } });
    await user.selectOptions(screen.getByLabelText('Período'), 'Semanal');
    await user.click(screen.getByRole('button', { name: 'Generar reporte' }));

    expect(await screen.findByText('Del 05/10/2026 al 11/10/2026')).toBeInTheDocument();
    expect(reportCalls(fetchMock)).toEqual(['/api/reports/revenue?granularity=weekly&date=2026-10-07']);
  });

  it('shows annulled payments apart from the total', async () => {
    stubApi({ revenue: buildRevenue({ annulled: { count: 2, total: 1200 } }) });
    const user = userEvent.setup();
    render(<ReportsView />);
    await user.click(screen.getByRole('button', { name: 'Generar reporte' }));

    expect(await screen.findByText('Pagos anulados, no incluidos en el total: 2 por $ 1.200')).toBeInTheDocument();
  });

  it('says so when nothing was collected in the period', async () => {
    stubApi({ revenue: buildRevenue({ total: 0, byConcept: [], byMethod: [], receipts: [] }) });
    const user = userEvent.setup();
    render(<ReportsView />);
    await user.click(screen.getByRole('button', { name: 'Generar reporte' }));

    expect(await screen.findByText('No hubo cobros en el período.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an error with a retry that asks again', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(jsonResponse(buildRevenue()));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<ReportsView />);

    await user.click(screen.getByRole('button', { name: 'Generar reporte' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByTestId('revenue-total')).toHaveTextContent('$ 4.500');
  });
});

describe('ReportsView: discipline settlement', () => {
  async function openSettlement(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('radio', { name: 'Liquidación por disciplina' }));
    await screen.findByRole('option', { name: 'Básquet' });
  }

  it('needs a discipline before it can be generated', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<ReportsView />);
    await openSettlement(user);

    expect(screen.getByRole('button', { name: 'Generar reporte' })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Disciplina'), 'Básquet');
    expect(screen.getByRole('button', { name: 'Generar reporte' })).toBeEnabled();
  });

  it('lists name, member number and month, with the fee and surcharge totals and no DNI', async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    render(<ReportsView />);
    await openSettlement(user);

    fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '2026-10' } });
    await user.selectOptions(screen.getByLabelText('Disciplina'), 'Básquet');
    await user.click(screen.getByRole('button', { name: 'Generar reporte' }));

    const table = await screen.findByRole('table', { name: 'Socios de Básquet con la cuota de 10/2026 paga' });
    expect(reportCalls(fetchMock)).toEqual(['/api/reports/discipline-settlement?period=2026-10&disciplineId=disc-1']);
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Nombre', 'N° de socio', 'Mes']);
    expect(within(table).getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual(['Lucía Ríos000110/2026']);
    expect(screen.getByTestId('settlement-fees')).toHaveTextContent('$ 3.000');
    expect(screen.getByTestId('settlement-surcharges')).toHaveTextContent('$ 300');
    expect(document.body.textContent).not.toMatch(/dni/i);
  });

  it('says so when nobody paid that month', async () => {
    stubApi({ settlement: buildSettlement({ students: [], feeTotal: 0, surchargeTotal: 0 }) });
    const user = userEvent.setup();
    render(<ReportsView />);
    await openSettlement(user);
    await user.selectOptions(screen.getByLabelText('Disciplina'), 'Básquet');
    await user.click(screen.getByRole('button', { name: 'Generar reporte' }));

    expect(await screen.findByText('Ningún socio pagó la cuota de esta disciplina en el mes elegido.')).toBeInTheDocument();
  });
});

describe('ReportsView: print and export', () => {
  it('offers neither until a report is shown', () => {
    stubApi();
    render(<ReportsView />);

    expect(screen.queryByRole('button', { name: 'Descargar Excel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Imprimir o guardar como PDF' })).not.toBeInTheDocument();
  });

  it('downloads the revenue report as Excel with the figures on screen', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<ReportsView />);
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-05' } });
    await user.click(screen.getByRole('button', { name: 'Generar reporte' }));
    await screen.findByTestId('revenue-total');

    await user.click(screen.getByRole('button', { name: 'Descargar Excel' }));

    expect(downloadXlsx).toHaveBeenCalledTimes(1);
    const exported = vi.mocked(downloadXlsx).mock.calls[0]![0];
    expect(exported.fileName).toBe('recaudacion-2026-10-05-al-2026-10-05.xlsx');
    expect(exported.sheets.map((sheet) => sheet.sheet)).toEqual(['Resumen', 'Por concepto', 'Por medio de pago', 'Comprobantes']);
  });

  it('downloads the discipline settlement as Excel', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<ReportsView />);
    await user.click(screen.getByRole('radio', { name: 'Liquidación por disciplina' }));
    await screen.findByRole('option', { name: 'Básquet' });
    fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '2026-10' } });
    await user.selectOptions(screen.getByLabelText('Disciplina'), 'Básquet');
    await user.click(screen.getByRole('button', { name: 'Generar reporte' }));
    await screen.findByTestId('settlement-fees');

    await user.click(screen.getByRole('button', { name: 'Descargar Excel' }));

    expect(vi.mocked(downloadXlsx).mock.calls[0]![0].fileName).toBe('liquidacion-basquet-2026-10.xlsx');
  });

  it('tells the user when the Excel file could not be made', async () => {
    stubApi();
    vi.mocked(downloadXlsx).mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    render(<ReportsView />);
    await user.click(screen.getByRole('button', { name: 'Generar reporte' }));
    await screen.findByTestId('revenue-total');

    await user.click(screen.getByRole('button', { name: 'Descargar Excel' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo generar el archivo de Excel. Intente de nuevo.');
  });

  it('opens the browser print dialog, which also saves as PDF', async () => {
    stubApi();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<ReportsView />);
    await user.click(screen.getByRole('button', { name: 'Generar reporte' }));
    await screen.findByTestId('revenue-total');

    await user.click(screen.getByRole('button', { name: 'Imprimir o guardar como PDF' }));

    expect(print).toHaveBeenCalledTimes(1);
  });

  it('titles the printed sheet with the report and the period', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<ReportsView />);
    await user.click(screen.getByRole('button', { name: 'Generar reporte' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Recaudación diaria' })).toBeInTheDocument();
  });
});
