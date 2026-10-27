import { describe, expect, it } from 'vitest';
import { buildRevenue, buildSettlement } from '../test/fixtures';
import { revenueExport, settlementExport, type Sheet } from './report-export';

const text = (cell: unknown) => (typeof cell === 'object' && cell !== null && 'value' in cell ? (cell as { value: unknown }).value : cell);
const rows = (sheet: Sheet) => sheet.data.map((row) => row.map(text));
const sheetNamed = (sheets: Sheet[], name: string) => sheets.find((sheet) => sheet.sheet === name)!;
const column = (sheet: Sheet, index: number) => rows(sheet).slice(1).map((row) => row[index] as number);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe('revenueExport', () => {
  it('names the file after the period and the sheets after what they hold', () => {
    const { fileName, sheets } = revenueExport(buildRevenue({ granularity: 'weekly', from: '2026-10-05', to: '2026-10-11' }));

    expect(fileName).toBe('recaudacion-2026-10-05-al-2026-10-11.xlsx');
    expect(sheets.map((sheet) => sheet.sheet)).toEqual(['Resumen', 'Por concepto', 'Por medio de pago', 'Comprobantes']);
  });

  it('summarises the period with the same figures and wording as the screen', () => {
    const { sheets } = revenueExport(buildRevenue({ annulled: { count: 2, total: 1200 } }));

    expect(rows(sheetNamed(sheets, 'Resumen'))).toEqual([
      ['Reporte', 'Recaudación diaria'],
      ['Desde', '05/10/2026'],
      ['Hasta', '05/10/2026'],
      ['Total recaudado', 4500],
      ['Pagos anulados (no incluidos en el total)', 2],
      ['Importe de pagos anulados', 1200],
    ]);
  });

  it('exports the concept, method and receipt figures so each adds up to the total on screen', () => {
    const report = buildRevenue();
    const { sheets } = revenueExport(report);

    expect(rows(sheetNamed(sheets, 'Por concepto'))).toEqual([['Concepto', 'Importe'], ['Cuotas sociales', 1500], ['Cuotas de actividades', 3000]]);
    expect(rows(sheetNamed(sheets, 'Por medio de pago'))).toEqual([['Medio de pago', 'Importe'], ['Efectivo', 4000], ['QR', 500]]);
    expect(rows(sheetNamed(sheets, 'Comprobantes'))).toEqual([
      ['N° de recibo', 'Fecha', 'Medio de pago', 'Importe'],
      [1, '05/10/2026', 'Efectivo', 4000],
      [2, '05/10/2026', 'QR', 500],
    ]);
    expect(sum(column(sheetNamed(sheets, 'Por concepto'), 1))).toBe(report.total);
    expect(sum(column(sheetNamed(sheets, 'Por medio de pago'), 1))).toBe(report.total);
    expect(sum(column(sheetNamed(sheets, 'Comprobantes'), 3))).toBe(report.total);
  });

  it('writes the amounts as numbers, not text, so a spreadsheet can add them', () => {
    const { sheets } = revenueExport(buildRevenue());

    const amount = sheetNamed(sheets, 'Por concepto').data[1]![1] as { type: unknown; format: string };
    expect(amount.type).toBe(Number);
    expect(amount.format).toBe('#,##0');
  });

  it('exports an empty period as a summary with zeros and empty lists', () => {
    const { sheets } = revenueExport(buildRevenue({ total: 0, byConcept: [], byMethod: [], receipts: [] }));

    expect(rows(sheetNamed(sheets, 'Resumen'))[3]).toEqual(['Total recaudado', 0]);
    expect(rows(sheetNamed(sheets, 'Comprobantes'))).toHaveLength(1);
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
