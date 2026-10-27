import { formatIsoDate } from '../../members/utils/member-format';
import { methodLabel } from '../../payments/utils/payment-format';
import { formatPeriod } from '../../pricing/utils/pricing-format';
import type { DisciplineSettlement, RevenueReport } from '../types/report';
import { conceptTotalLabel, revenueTitle } from './report-format';

type TextCell = string | { value: string; fontWeight: 'bold' };
type NumberCell = number | { value: number; type: NumberConstructor; format?: string };
export type Cell = TextCell | NumberCell;
export interface Sheet { sheet: string; data: Cell[][] }
export interface ReportExport { fileName: string; sheets: Sheet[] }

const header = (...labels: string[]): Cell[] => labels.map((value) => ({ value, fontWeight: 'bold' as const }));
// Whole pesos as a real number, so a spreadsheet can add the column up.
const pesos = (value: number): Cell => ({ value, type: Number, format: '#,##0' });

// The labels, dates and months below come from the same functions the screen uses, so the file reads like the report.
export function revenueExport(report: RevenueReport): ReportExport {
  return {
    fileName: `recaudacion-${report.from}-al-${report.to}.xlsx`,
    sheets: [
      {
        sheet: 'Resumen',
        data: [
          ['Reporte', revenueTitle(report.granularity)],
          ['Desde', formatIsoDate(report.from)],
          ['Hasta', formatIsoDate(report.to)],
          ['Total recaudado', pesos(report.total)],
          ['Pagos anulados (no incluidos en el total)', report.annulled.count],
          ['Importe de pagos anulados', pesos(report.annulled.total)],
        ],
      },
      { sheet: 'Por concepto', data: [header('Concepto', 'Importe'), ...report.byConcept.map(({ concept, total }) => [conceptTotalLabel(concept), pesos(total)])] },
      { sheet: 'Por medio de pago', data: [header('Medio de pago', 'Importe'), ...report.byMethod.map(({ method, total }) => [methodLabel(method), pesos(total)])] },
      {
        sheet: 'Comprobantes',
        data: [
          header('N° de recibo', 'Fecha', 'Medio de pago', 'Importe'),
          ...report.receipts.map((receipt) => [receipt.receiptNumber, formatIsoDate(receipt.date), methodLabel(receipt.method), pesos(receipt.total)]),
        ],
      },
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
