import { formatIsoDate } from '../../members/utils/member-format';
import { methodLabel } from '../../payments/utils/payment-format';
import { formatPeriod } from '../../pricing/utils/pricing-format';
import type { Cell as LibCell, SheetOptions } from 'write-excel-file/universal';
import type { DisciplineSettlement, RevenueReport } from '../types/report';
import { conceptTotalLabel, revenueTitle, todayDate } from './report-format';

export type Cell = LibCell;
// No images are exported, so the library's image option is left out of the sheet type.
export interface Sheet extends Omit<SheetOptions<Blob>, 'images' | 'sheet'> { sheet: string; data: Cell[][] }
export interface ReportExport { fileName: string; sheets: Sheet[] }

const header = (...labels: string[]): Cell[] => labels.map((value) => ({ value, fontWeight: 'bold' as const }));
// Whole pesos as a real number, so a spreadsheet can add the column up.
const pesos = (value: number): Cell => ({ value, type: Number, format: '#,##0' });

// The revenue workbook is styled like the printed report: the club's navy, a light blue and neutral greys.
const NAVY = '#2B2A6B';
const LIGHT_BLUE = '#E4E7F5';
const STRIPE = '#F5F6FA';
const RULE = '#D5D8E0';
const MUTED = '#6B7280';
const MONEY = '"$" #,##0.00';
const DATE = 'dd/mm/yyyy';
const FONT = { fontFamily: 'Calibri', fontSize: 11, alignVertical: 'center' as const, height: 20 };

// A calendar day as a real date. Midnight UTC, so the spreadsheet shows the same day in any time zone.
const day = (iso: string): Date => {
  const [year, month, date] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, date));
};

const text = (value: string, style: Cell = {}): Cell => ({ ...FONT, value, textColor: '#374151', ...(style as object) });
const date = (value: Date, style: Cell = {}): Cell => ({ ...FONT, value, type: Date, format: DATE, align: 'left', ...(style as object) });
const money = (value: number, style: Cell = {}): Cell => ({ ...FONT, value, type: Number, format: MONEY, align: 'right', ...(style as object) });
const count = (value: number, style: Cell = {}): Cell => ({ ...FONT, value, type: Number, format: '0', align: 'right', ...(style as object) });
const columnHead = (value: string, align: 'left' | 'right' | 'center' = 'left'): Cell =>
  ({ ...FONT, value, fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: NAVY, align });
// A block title with a navy rule under both of its columns.
const blockTitle = (value: string): Cell[] => {
  const rule = { bottomBorderColor: NAVY, bottomBorderStyle: 'medium' as const };
  return [{ ...FONT, value, fontWeight: 'bold', fontSize: 12, textColor: NAVY, height: 26, ...rule }, { ...FONT, height: 26, ...rule }];
};
const totalRow = (label: string, total: number): Cell[] => {
  const edge = { fontWeight: 'bold' as const, topBorderColor: '#000000', topBorderStyle: 'thin' as const };
  return [text(label, edge), money(total, edge)];
};
const blank = (): Cell[] => [null, null];

export function revenueExport(report: RevenueReport, issuedAt: Date = new Date()): ReportExport {
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const emitted = day(todayDate(issuedAt));
  const muted = { textColor: MUTED, fontStyle: 'italic' as const };

  const summary: Cell[][] = [
    [{ ...FONT, value: `Club CAI | ${revenueTitle(report.granularity)}`, fontWeight: 'bold', fontSize: 18, textColor: NAVY, height: 32 }, null],
    [text('Desde'), date(day(report.from))],
    [text('Hasta'), date(day(report.to))],
    [text('Fecha de emisión'), date(emitted)],
    blank(),
    [text('TOTAL RECAUDADO', { fontWeight: 'bold', fontSize: 12, textColor: NAVY, backgroundColor: LIGHT_BLUE, height: 40 }),
      money(report.total, { fontWeight: 'bold', fontSize: 20, textColor: NAVY, backgroundColor: LIGHT_BLUE, height: 40 })],
    blank(),
    [text('Pagos anulados (excluidos del total)', muted), count(report.annulled.count, muted)],
    [text('Importe anulado (excluido del total)', muted), money(report.annulled.total, muted)],
    blank(),
    blockTitle('Por concepto'),
    [columnHead('Concepto'), columnHead('Importe', 'right')],
    ...report.byConcept.map(({ concept, total }): Cell[] => [text(conceptTotalLabel(concept), { bottomBorderColor: RULE, bottomBorderStyle: 'thin' }), money(total, { bottomBorderColor: RULE, bottomBorderStyle: 'thin' })]),
    totalRow('TOTAL', sum(report.byConcept.map((row) => row.total))),
    blank(),
    blockTitle('Por medio de pago'),
    [columnHead('Medio de pago'), columnHead('Importe', 'right')],
    ...report.byMethod.map(({ method, total }): Cell[] => [text(methodLabel(method), { bottomBorderColor: RULE, bottomBorderStyle: 'thin' }), money(total, { bottomBorderColor: RULE, bottomBorderStyle: 'thin' })]),
    totalRow('TOTAL', sum(report.byMethod.map((row) => row.total))),
  ];

  const stripe = (index: number) => (index % 2 === 1 ? { backgroundColor: STRIPE } : {});
  const receipts: Cell[][] = [
    [columnHead('N° de recibo', 'center'), columnHead('Fecha'), columnHead('Medio de pago'), columnHead('Importe', 'right')],
    ...report.receipts.map((receipt, index): Cell[] => [
      count(receipt.receiptNumber, { align: 'center', textColor: '#374151', ...stripe(index) }),
      date(day(receipt.date), { textColor: '#374151', ...stripe(index) }),
      text(methodLabel(receipt.method), stripe(index)),
      money(receipt.total, { textColor: '#374151', ...stripe(index) }),
    ]),
    [text('TOTAL', { fontWeight: 'bold', topBorderColor: '#000000', topBorderStyle: 'thin' }), text('', { topBorderColor: '#000000', topBorderStyle: 'thin' }), text('', { topBorderColor: '#000000', topBorderStyle: 'thin' }),
      money(sum(report.receipts.map((row) => row.total)), { fontWeight: 'bold', topBorderColor: '#000000', topBorderStyle: 'thin' })],
  ];

  return {
    fileName: `recaudacion-${report.from}-al-${report.to}.xlsx`,
    sheets: [
      { sheet: 'Resumen', data: summary, showGridLines: false, columns: [{ width: 42 }, { width: 24 }] },
      { sheet: 'Comprobantes', data: receipts, showGridLines: false, stickyRowsCount: 1, columns: [{ width: 16 }, { width: 16 }, { width: 24 }, { width: 20 }] },
    ],
  };
}

// Lowercase, accents removed, anything else a single dash: safe as a file name on any computer.
const slug = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The club decided the list never carries the DNI: only name, member number and month.
export function settlementExport(report: DisciplineSettlement): ReportExport {
  const month = formatPeriod(report.period);
  return {
    fileName: `liquidacion-${slug(report.discipline.name)}-${report.period}.xlsx`,
    sheets: [
      {
        sheet: 'Resumen',
        data: [
          ['Disciplina', report.discipline.name],
          ['Mes', month],
          ['Cuotas de la disciplina', pesos(report.feeTotal)],
          ['Recargos por pago tardío (aparte)', pesos(report.surchargeTotal)],
        ],
      },
      { sheet: 'Socios', data: [header('Nombre', 'N° de socio', 'Mes'), ...report.students.map((student) => [student.fullName, student.memberNumber, formatPeriod(student.period)])] },
    ],
  };
}
