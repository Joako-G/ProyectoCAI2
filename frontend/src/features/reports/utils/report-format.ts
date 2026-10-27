import { NETWORK_ERROR_MESSAGE } from '../../disciplines/hooks/useDisciplinesList';
import { ApiError } from '../../members/services/members-api';
import type { IncomeConcept, ReportGranularity } from '../types/report';

export const GRANULARITIES: ReadonlyArray<{ value: ReportGranularity; label: string }> = [
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
];

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
