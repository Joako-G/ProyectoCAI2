import type { RevenueReport } from '../types/report';

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/**
 * The tables of a revenue report must each add up to its total. Returns the name of every table that does
 * not, so the printed report can warn instead of handing a treasurer figures that disagree.
 */
export function revenueMismatches(report: RevenueReport): string[] {
  const tables: Array<[string, number]> = [
    ['Por concepto', sum(report.byConcept.map((row) => row.total))],
    ['Por medio de pago', sum(report.byMethod.map((row) => row.total))],
    ['Detalle de recibos', sum(report.receipts.map((row) => row.total))],
  ];
  return tables.filter(([, total]) => total !== report.total).map(([name]) => name);
}
