import { NETWORK_ERROR_MESSAGE } from '../../disciplines/hooks/useDisciplinesList';
import { ApiError } from '../../members/services/members-api';
import { formatIsoDate } from '../../members/utils/member-format';
import type { IncomeConcept, ReportGranularity, RevenueReport } from '../types/report';

export const GRANULARITIES: ReadonlyArray<{ value: ReportGranularity; label: string }> = [
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
];

const REVENUE_TITLE: Record<ReportGranularity, string> = {
  daily: 'Recaudación diaria',
  weekly: 'Recaudación semanal',
  monthly: 'Recaudación mensual',
};

export const revenueTitle = (granularity: ReportGranularity) => REVENUE_TITLE[granularity];

const CONCEPT_LABEL: Record<IncomeConcept, string> = {
  enrollment: 'Inscripciones',
  socialFee: 'Cuotas sociales',
  activityFee: 'Cuotas de actividades',
  activitySurcharge: 'Recargos por pago tardío',
  carnetReplacement: 'Reposición de carnet',
};

export const conceptTotalLabel = (concept: IncomeConcept) => CONCEPT_LABEL[concept];

/** Today on the computer's calendar as `YYYY-MM-DD`; the club's computers run in the club's time zone. */
export function todayDate(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Spanish copy for a failed report. Backend messages are English and are never shown. */
export function describeReportError(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE;
  if (error.status === 403) return 'No tiene permiso para ver los reportes.';
  if (error.status === 404) return 'No se encontró la disciplina elegida.';
  if (error.status === 400) return 'Revise la fecha o el mes elegido e intente de nuevo.';
  return 'No se pudo generar el reporte. Intente de nuevo.';
}

const AMOUNT = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' } as unknown as Intl.NumberFormatOptions);
const PERCENT = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Printed amounts keep two decimals: `$ 20.000,00`. The system works in whole pesos; the decimals are only presentation. */
export const formatAmount = (amount: number) => `$ ${AMOUNT.format(amount)}`;

/** Share of the total as `62,5 %`; a dash when there is no total to share. */
export const formatShare = (part: number, total: number) => (total === 0 ? '—' : `${PERCENT.format((part / total) * 100)} %`);

/** `27/10/2026 14:32`, on the computer's clock. */
export function formatDateTime(moment: Date): string {
  const time = `${String(moment.getHours()).padStart(2, '0')}:${String(moment.getMinutes()).padStart(2, '0')}`;
  return `${formatIsoDate(todayDate(moment))} ${time}`;
}

/** One day reads `Fecha: 27/10/2026`; a week or a month keeps the `Del … al …` range. */
export const rangeLabel = ({ from, to }: Pick<RevenueReport, 'from' | 'to'>) =>
  from === to ? `Fecha: ${formatIsoDate(from)}` : `Del ${formatIsoDate(from)} al ${formatIsoDate(to)}`;

/** `del 1 al 3`, or `el 4` when a single receipt was issued. */
export const issuedLabel = ({ first, last }: { first: number; last: number }) => (first === last ? `el ${first}` : `del ${first} al ${last}`);
