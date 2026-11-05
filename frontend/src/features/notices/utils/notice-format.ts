import { NETWORK_ERROR_MESSAGE } from '../../disciplines/hooks/useDisciplinesList';
import { ApiError } from '../../members/services/members-api';
import type { DebtNotice } from '../types/notice';

/** Spanish copy for a failed read of the notices. Backend messages are English and are never shown. */
export function describeLoadError(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE;
  if (error.status === 403) return 'No tiene permiso para ver los avisos.';
  return 'Intente de nuevo.';
}

export const standingLabel = (standing: DebtNotice['standing']) => (standing === 'deregistered' ? 'Dado de baja' : 'Deudor');

/** Who the message goes to: the member, or the guardian of a minor. */
export const recipientLabel = (notice: DebtNotice) => (notice.recipient === 'guardian' ? `Responsable: ${notice.recipientName}` : 'El propio socio');

/** What to fix when no WhatsApp number could be used. */
export const numberIssueLabel = (notice: DebtNotice) =>
  notice.recipient === 'guardian'
    ? 'Número de WhatsApp no válido. Corrija el contacto del responsable en la ficha del socio.'
    : 'Número de WhatsApp no válido. Corríjalo en la ficha del socio.';
