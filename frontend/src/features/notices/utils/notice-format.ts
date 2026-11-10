import { NETWORK_ERROR_MESSAGE } from '../../disciplines/hooks/useDisciplinesList';
import { ApiError } from '../../members/services/members-api';
import type { DebtNotice } from '../types/notice';

/** Spanish copy for a failed read of the notices. Backend messages are English and are never shown. */
export function describeLoadError(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE;
  if (error.status === 403) return 'No tiene permiso para ver los avisos.';
  return 'Intente de nuevo.';
}

const two = (value: number) => String(value).padStart(2, '0');

/** `10/11/2026 14:05` in the browser's local time, from an ISO instant. */
export function formatSentAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

export const standingLabel = (standing: DebtNotice['standing']) => (standing === 'deregistered' ? 'Dado de baja' : 'Deudor');

/** Who the message goes to and at which number: the member, or the guardian of a minor. */
export const recipientLabel = (notice: DebtNotice) =>
  `${notice.recipient === 'guardian' ? `Responsable: ${notice.recipientName}` : 'El propio socio'} · ${notice.recipientContact}`;

/** What to fix when no WhatsApp number could be used. */
export const numberIssueLabel = (notice: Pick<DebtNotice, 'recipient'>) =>
  notice.recipient === 'guardian'
    ? 'Número de WhatsApp no válido. Corrija el contacto del responsable en la ficha del socio.'
    : 'Número de WhatsApp no válido. Corríjalo en la ficha del socio.';
