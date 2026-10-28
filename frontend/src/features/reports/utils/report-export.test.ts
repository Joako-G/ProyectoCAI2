import { describe, expect, it } from 'vitest';
import { buildRevenue, buildSettlement } from '../test/fixtures';
import { revenueExport, settlementExport, type Sheet } from './report-export';

// A styled cell with no value (a rule under a title, a spacer) reads as empty.
const text = (cell: unknown) => (cell instanceof Date || typeof cell !== 'object' || cell === null ? cell : 'value' in cell ? (cell as { value: unknown }).value : null);
const rows = (sheet: Sheet) => sheet.data.map((row) => row.map(text));
const sheetNamed = (sheets: Sheet[], name: string) => sheets.find((sheet) => sheet.sheet === name)!;
const column = (sheet: Sheet, index: number) => rows(sheet).slice(1).map((row) => row[index] as number);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

const style = (cell: unknown) => cell as Record<string, unknown>;
const cellAt = (sheet: Sheet, row: number, col: number) => style(sheet.data[row]![col]);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const ISSUED = new Date(2026, 9, 27, 14, 30);

describe('revenueExport', () => {
  it('names the file after the period and holds two sheets: the summary and the receipts', () => {
    const { fileName, sheets } = revenueExport(buildRevenue({ granularity: 'weekly', from: '2026-10-05', to: '2026-10-11' }), ISSUED);

    expect(fileName).toBe('recaudacion-2026-10-05-al-2026-10-11.xlsx');
    expect(sheets.map((sheet) => sheet.sheet)).toEqual(['Resumen', 'Comprobantes']);
  });

  it('heads the summary with the club and the period, the dates as real dates and the issue date', () => {
    const summary = sheetNamed(revenueExport(buildRevenue(), ISSUED).sheets, 'Resumen');

    expect(rows(summary).slice(0, 4)).toEqual([
      ['Club CAI | Recaudación diaria', null],
      ['Desde', day('2026-10-05')],
      ['Hasta', day('2026-10-05')],
      ['Fecha de emisión', day('2026-10-27')],
    ]);
    expect(cellAt(summary, 1, 1)).toMatchObject({ type: Date, format: 'dd/mm/yyyy' });
    expect(revenueExport(buildRevenue({ granularity: 'monthly' }), ISSUED).sheets[0]!.data[0]![0]).toMatchObject({ value: 'Club CAI | Recaudación mensual' });
  });

  it('shows the total as the headline figure and the annulled payments as excluded from it', () => {
    const summary = sheetNamed(revenueExport(buildRevenue({ annulled: { count: 2, total: 1200 } }), ISSUED).sheets, 'Resumen');

    expect(rows(summary).slice(5, 9)).toEqual([
      ['TOTAL RECAUDADO', 4500],
      [null, null],
      ['Pagos anulados (excluidos del total)', 2],
      ['Importe anulado (excluido del total)', 1200],
    ]);
    expect(cellAt(summary, 5, 1)).toMatchObject({ fontSize: 20, fontWeight: 'bold' });
  });

  it('lists the concept and method blocks in the summary, each closed with a total that equals the total on screen', () => {
    const report = buildRevenue();
    const summary = sheetNamed(revenueExport(report, ISSUED).sheets, 'Resumen');

    expect(rows(summary).slice(10)).toEqual([
      ['Por concepto', null],
      ['Concepto', 'Importe'],
      ['Cuotas sociales', 1500],
      ['Cuotas de actividades', 3000],
      ['TOTAL', 4500],
      [null, null],
      ['Por medio de pago', null],
      ['Medio de pago', 'Importe'],
      ['Efectivo', 4000],
      ['QR', 500],
      ['TOTAL', 4500],
    ]);
  });

  it('keeps every receipt in order with number, date, method and amount, and a total that equals the total on screen', () => {
    const report = buildRevenue();
    const receipts = sheetNamed(revenueExport(report, ISSUED).sheets, 'Comprobantes');

    expect(rows(receipts)).toEqual([
      ['N° de recibo', 'Fecha', 'Medio de pago', 'Importe'],
      [1, day('2026-10-05'), 'Efectivo', 4000],
      [2, day('2026-10-05'), 'QR', 500],
      ['TOTAL', '', '', 4500],
    ]);
    expect(sum(column(receipts, 3).slice(0, -1))).toBe(report.total);
  });

  it('writes amounts and dates as typed values with currency and date formats, amounts aligned right', () => {
    const { sheets } = revenueExport(buildRevenue(), ISSUED);
    const receipts = sheetNamed(sheets, 'Comprobantes');

    expect(cellAt(receipts, 1, 3)).toMatchObject({ type: Number, format: '"$" #,##0.00', align: 'right' });
    expect(cellAt(receipts, 1, 1)).toMatchObject({ type: Date, format: 'dd/mm/yyyy' });
    expect(cellAt(receipts, 1, 0)).toMatchObject({ type: Number, format: '0' });
    expect(cellAt(sheetNamed(sheets, 'Resumen'), 5, 1)).toMatchObject({ type: Number, format: '"$" #,##0.00', align: 'right' });
  });

  it('styles the receipts with a frozen navy header, subtle alternate rows, no grid lines and no filter', () => {
    const { sheets } = revenueExport(buildRevenue(), ISSUED);
    const receipts = sheetNamed(sheets, 'Comprobantes');

    expect(receipts).toMatchObject({ showGridLines: false, stickyRowsCount: 1 });
    expect(sheetNamed(sheets, 'Resumen')).toMatchObject({ showGridLines: false });
    expect(cellAt(receipts, 0, 0)).toMatchObject({ backgroundColor: '#2B2A6B', textColor: '#FFFFFF', fontWeight: 'bold' });
    expect(cellAt(receipts, 1, 0)).not.toHaveProperty('backgroundColor');
    expect(cellAt(receipts, 2, 0)).toMatchObject({ backgroundColor: '#F5F6FA' });
    expect(JSON.stringify(sheets)).not.toMatch(/filter/i);
    expect(receipts.columns!.every((column) => (column.width ?? 0) >= 14)).toBe(true);
  });

  it('exports an empty period as a summary with zeros and a receipts sheet with only its header and total', () => {
    const { sheets } = revenueExport(buildRevenue({ total: 0, byConcept: [], byMethod: [], receipts: [] }), ISSUED);

    expect(rows(sheetNamed(sheets, 'Resumen'))[5]).toEqual(['TOTAL RECAUDADO', 0]);
    expect(rows(sheetNamed(sheets, 'Comprobantes'))).toHaveLength(2);
  });
});

describe('settlementExport', () => {
  it('names the file after the discipline and month, without accents or spaces', () => {
    expect(settlementExport(buildSettlement()).fileName).toBe('liquidacion-basquet-2026-10.xlsx');
    expect(settlementExport(buildSettlement({ discipline: { id: 'x', name: 'Patín Artístico' } })).fileName).toBe('liquidacion-patin-artistico-2026-10.xlsx');
  });

  it('exports name, member number and month, and the fee and surcharge totals apart', () => {
    const { sheets } = settlementExport(buildSettlement());

    expect(rows(sheetNamed(sheets, 'Resumen'))).toEqual([
      ['Disciplina', 'Básquet'],
      ['Mes', '10/2026'],
      ['Cuotas de la disciplina', 3000],
      ['Recargos por pago tardío (aparte)', 300],
    ]);
    expect(rows(sheetNamed(sheets, 'Socios'))).toEqual([['Nombre', 'N° de socio', 'Mes'], ['Lucía Ríos', '0001', '10/2026']]);
  });

  it('never includes a DNI', () => {
    expect(JSON.stringify(settlementExport(buildSettlement()))).not.toMatch(/dni/i);
  });
});

describe('the real spreadsheet library', () => {
  // The component tests replace the download; this one lets the library itself build both workbooks.
  it.each([
    ['revenue', () => revenueExport(buildRevenue())],
    ['settlement', () => settlementExport(buildSettlement())],
  ])('accepts the %s sheets and produces an xlsx file', async (_name, build) => {
    const { default: writeXlsxFile } = await import('write-excel-file/universal');

    const blob = await writeXlsxFile(build().sheets).toBlob();
    const bytes = new Uint8Array(await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    }));

    // An .xlsx is a zip archive, which starts with "PK".
    expect(bytes.length).toBeGreaterThan(500);
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
  });
});
