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

// Both workbooks are styled like the printed report: the club's navy, a light blue and neutral greys.
const NAVY = '#2B2A6B';
const LIGHT_BLUE = '#E4E7F5';
const STRIPE = '#F5F6FA';
const RULE = '#D5D8E0';
const MUTED = '#6B7280';
const MONEY = '"$" #,##0.00';
const SHARE = '0.0%';
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
// How much of the whole an amount is, as a real percentage; an empty period has no shares.
const share = (part: number, whole: number, style: Cell = {}): Cell =>
  (whole > 0 ? { ...FONT, value: part / whole, type: Number, format: SHARE, align: 'right', textColor: MUTED, ...(style as object) } : text('', style));
// A block title with a navy rule under every one of its columns.
const blockTitle = (value: string, width = 2): Cell[] => {
  const rule = { bottomBorderColor: NAVY, bottomBorderStyle: 'medium' as const };
  return [{ ...FONT, value, fontWeight: 'bold', fontSize: 12, textColor: NAVY, height: 26, ...rule }, ...Array.from({ length: width - 1 }, (): Cell => ({ ...FONT, height: 26, ...rule }))];
};
const EDGE = { fontWeight: 'bold' as const, topBorderColor: '#000000', topBorderStyle: 'thin' as const };
const LINE = { bottomBorderColor: RULE, bottomBorderStyle: 'thin' as const };
const blank = (): Cell[] => [null, null];
const stripe = (index: number) => (index % 2 === 1 ? { backgroundColor: STRIPE } : {});
const title = (value: string): Cell[] => [{ ...FONT, value, fontWeight: 'bold', fontSize: 18, textColor: NAVY, height: 32 }, null];
const headline = (label: string, total: number): Cell[] => [
  text(label, { fontWeight: 'bold', fontSize: 12, textColor: NAVY, backgroundColor: LIGHT_BLUE, height: 40 }),
  money(total, { fontWeight: 'bold', fontSize: 20, textColor: NAVY, backgroundColor: LIGHT_BLUE, height: 40 }),
];

// A block of the summary: each row with its amount and its share of the block, closed by the total.
function breakdown(heading: string, column: string, rows: Array<{ label: string; total: number }>): Cell[][] {
  const whole = rows.reduce((sum, row) => sum + row.total, 0);
  return [
    blockTitle(heading, 3),
    [columnHead(column), columnHead('Importe', 'right'), columnHead('% del total', 'right')],
    ...rows.map(({ label, total }): Cell[] => [text(label, LINE), money(total, LINE), share(total, whole, LINE)]),
    [text('TOTAL', EDGE), money(whole, EDGE), share(whole, whole, { ...EDGE, textColor: '#374151' })],
  ];
}

export function revenueExport(report: RevenueReport, issuedAt: Date = new Date()): ReportExport {
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const emitted = day(todayDate(issuedAt));
  const muted = { textColor: MUTED, fontStyle: 'italic' as const };

  const summary: Cell[][] = [
    title(`Club CAI | ${revenueTitle(report.granularity)}`),
    [text('Desde'), date(day(report.from))],
    [text('Hasta'), date(day(report.to))],
    [text('Fecha de emisión'), date(emitted)],
    blank(),
    headline('TOTAL RECAUDADO', report.total),
    blank(),
    [text('Pagos anulados (excluidos del total)', muted), count(report.annulled.count, muted)],
    [text('Importe anulado (excluido del total)', muted), money(report.annulled.total, muted)],
    blank(),
    ...breakdown('Por concepto', 'Concepto', report.byConcept.map(({ concept, total }) => ({ label: conceptTotalLabel(concept), total }))),
    blank(),
    ...breakdown('Por medio de pago', 'Medio de pago', report.byMethod.map(({ method, total }) => ({ label: methodLabel(method), total }))),
  ];

  const receipts: Cell[][] = [
    [columnHead('N° de recibo', 'center'), columnHead('Fecha'), columnHead('Medio de pago'), columnHead('Importe', 'right')],
    ...report.receipts.map((receipt, index): Cell[] => [
      count(receipt.receiptNumber, { align: 'center', textColor: '#374151', ...stripe(index) }),
      date(day(receipt.date), { textColor: '#374151', ...stripe(index) }),
      text(methodLabel(receipt.method), stripe(index)),
      money(receipt.total, { textColor: '#374151', ...stripe(index) }),
    ]),
    [text('TOTAL', EDGE), text('', EDGE), text('', EDGE), money(sum(report.receipts.map((row) => row.total)), EDGE)],
  ];

  return {
    fileName: `recaudacion-${report.from}-al-${report.to}.xlsx`,
    sheets: [
      { sheet: 'Resumen', data: summary, showGridLines: false, columns: [{ width: 42 }, { width: 24 }, { width: 14 }] },
      { sheet: 'Comprobantes', data: receipts, showGridLines: false, stickyRowsCount: 1, columns: [{ width: 16 }, { width: 16 }, { width: 24 }, { width: 20 }] },
    ],
  };
}

// Lowercase, accents removed, anything else a single dash: safe as a file name on any computer.
const slug = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The club decided the list never carries the DNI: only name, member number and month.
export function settlementExport(report: DisciplineSettlement, issuedAt: Date = new Date()): ReportExport {
  const month = formatPeriod(report.period);
  const summary: Cell[][] = [
    title('Club CAI | Liquidación por disciplina'),
    [text('Disciplina'), text(report.discipline.name, { fontWeight: 'bold' })],
    [text('Mes'), text(month)],
    [text('Fecha de emisión'), date(day(todayDate(issuedAt)))],
    blank(),
    headline('CUOTAS DE LA DISCIPLINA', report.feeTotal),
    blank(),
    [text('Recargos por pago tardío (aparte)', LINE), money(report.surchargeTotal, LINE)],
    [text('Cuotas cobradas', LINE), count(report.students.length, LINE)],
  ];
  const students: Cell[][] = [
    [columnHead('Nombre'), columnHead('N° de socio', 'center'), columnHead('Mes', 'center')],
    ...report.students.map((student, index): Cell[] => [
      text(student.fullName, stripe(index)),
      text(student.memberNumber, { align: 'center', ...stripe(index) }),
      text(formatPeriod(student.period), { align: 'center', ...stripe(index) }),
    ]),
  ];
  return {
    fileName: `liquidacion-${slug(report.discipline.name)}-${report.period}.xlsx`,
    sheets: [
      { sheet: 'Resumen', data: summary, showGridLines: false, columns: [{ width: 42 }, { width: 24 }] },
      { sheet: 'Socios', data: students, showGridLines: false, stickyRowsCount: 1, columns: [{ width: 36 }, { width: 16 }, { width: 14 }] },
    ],
  };
}
