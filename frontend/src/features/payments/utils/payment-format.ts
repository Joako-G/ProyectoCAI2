import { NETWORK_ERROR_MESSAGE } from '../../disciplines/hooks/useDisciplinesList';
import type { Discipline } from '../../disciplines/types/discipline';
import { disciplineNames } from '../../disciplines/utils/discipline-labels';
import { ApiError } from '../../members/services/members-api';
import { formatPeriod } from '../../pricing/utils/pricing-format';
import type { AccountStanding, ChargeConcept, ChargeLine, PaymentMethod } from '../types/payment';

export const PAYMENT_METHODS: ReadonlyArray<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'debit', label: 'Débito' },
  { value: 'qr', label: 'QR' },
  { value: 'transfer', label: 'Transferencia' },
];

export const STANDING_LABEL: Record<AccountStanding, string> = {
  up_to_date: 'Al día',
  debtor: 'Deudor',
  deregistered: 'Dado de baja',
};

export function methodLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find(({ value }) => value === method)?.label ?? method;
}

/** Stable identity of a concept; mirrors `conceptKey` in backend/src/modules/payments/account.ts. */
export function conceptKey(concept: ChargeConcept): string {
  switch (concept.kind) {
    case 'socialFee':
      return `socialFee:${concept.period}`;
    case 'activityFee':
      return `activityFee:${concept.period}:${concept.disciplineId}`;
    default:
      return concept.kind;
  }
}

const nameOf = (disciplineId: string, disciplines: readonly Discipline[]) => disciplineNames([disciplineId], disciplines)[0];

export function conceptLabel(concept: ChargeConcept, disciplines: readonly Discipline[]): string {
  switch (concept.kind) {
    case 'socialFee':
      return `Cuota social ${formatPeriod(concept.period)}`;
    case 'activityFee':
      return `Cuota de ${nameOf(concept.disciplineId, disciplines)} ${formatPeriod(concept.period)}`;
    case 'enrollment':
      return 'Inscripción';
    case 'carnetReplacement':
      return 'Reposición de carnet';
  }
}

/** A line of a charge or receipt, in Spanish; surcharge and proration are called out. */
export function lineLabel(line: ChargeLine, disciplines: readonly Discipline[]): string {
  if (line.kind === 'activitySurcharge') {
    return `Recargo por pago tardío de ${nameOf(line.disciplineId ?? '', disciplines)} ${formatPeriod(line.period)}`;
  }
  if (line.kind === 'activityFee') {
    const label = conceptLabel({ kind: 'activityFee', period: line.period, disciplineId: line.disciplineId ?? '' }, disciplines);
    return line.prorated ? `${label} (prorrateada)` : label;
  }
  return conceptLabel(line.kind === 'socialFee' ? { kind: 'socialFee', period: line.period } : { kind: line.kind }, disciplines);
}

/** Spanish copy for a failed read (search, account, history). Backend messages are English and never shown. */
export function describeReadError(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE;
  if (error.status === 403) return 'No tiene permiso para ver los pagos.';
  if (error.status === 404) return 'No se encontró el socio.';
  return 'El servidor no pudo completar la consulta.';
}

/** A failed write whose outcome is unknown (network) or whose view is stale (404, 409): re-read the account. */
export { isAmbiguousWriteFailure } from '../../pricing/utils/pricing-format';

/** Spanish copy for a failed preview, payment or annulment. */
export function describePaymentError(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE;
  const { status, message } = error;
  if (status === 403) return 'No tiene permiso para realizar esta operación.';
  if (status === 409) {
    // The English phrases come from ConflictError messages in backend/src/modules/payments/payment.service.ts;
    // an unknown one falls back to the generic copy below.
    if (/^Already paid/.test(message)) return 'Alguno de los conceptos ya está pagado. La cuenta se actualizó con los datos del servidor.';
    if (/Inactive members/.test(message)) return 'El socio está dado de baja y no puede registrar pagos.';
    if (/already annulled/.test(message)) return 'El pago ya estaba anulado.';
    if (/No tariffs/.test(message)) return 'No hay tarifas configuradas. Avise a la jefatura de secretaría.';
  }
  if (status === 404) return 'No se encontró el socio o el pago. Actualice la pantalla.';
  if (status === 400) return 'El servidor rechazó los datos. Revíselos e intente de nuevo.';
  return 'No se pudo completar la operación. Intente de nuevo.';
}
