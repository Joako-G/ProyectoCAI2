import { NETWORK_ERROR_MESSAGE } from '../../disciplines/hooks/useDisciplinesList';
import { formatInstant } from '../../audit/utils/audit-format';
import { ApiError } from '../../members/services/members-api';

/** Spanish copy for a failed read of the status. Backend messages are English and are never shown. */
export function describeLoadError(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE;
  if (error.status === 403) return 'No tiene permiso para ver el respaldo.';
  return 'Intente de nuevo.';
}

/** Spanish copy for a copy that did not finish. */
export function describeRunError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'No se pudo confirmar el respaldo. Revise el estado en unos segundos.';
  if (error.status === 409) return 'Ya hay un respaldo en curso. Espere unos segundos.';
  if (error.status === 403) return 'No tiene permiso para hacer un respaldo.';
  return 'No se pudo hacer el respaldo. Los respaldos anteriores se conservan. Avise a quien mantiene el sistema.';
}

/** Warns that the last attempt failed. The failure code stays in the server log. */
export function lastFailureMessage(at: string): string {
  return `El último intento de respaldo falló el ${formatInstant(at)}. Los respaldos anteriores se conservan. Avise a quien mantiene el sistema.`;
}

export function copiesMessage(copies: number, keep: number, keepRecent: number): string {
  return `${copies} ${copies === 1 ? 'copia guardada' : 'copias guardadas'} (se conserva la última copia de cada uno de los últimos ${keep} días con copias y siempre las ${keepRecent} más recientes).`;
}

/** Warns that the destination cannot be used. No path is shown: staff only need to know what to check. */
export function destinationProblemMessage(state: 'missing' | 'unreadable'): string {
  return state === 'missing'
    ? 'No se encuentra la carpeta de respaldos. Conecte la unidad externa o revise la carpeta configurada y vuelva a intentar. Los respaldos anteriores se conservan.'
    : 'No se puede leer la carpeta de respaldos. Revise que la unidad externa esté bien conectada y que la carpeta se pueda abrir. Los respaldos anteriores se conservan.';
}

export function destinationMessage(isDefault: boolean): string {
  return isDefault
    ? 'Los respaldos se guardan en una carpeta del propio sistema: no es un dispositivo externo. Para protegerse de una falla de la computadora, configure una unidad externa (ver docs/backup-restore.md).'
    : 'Los respaldos se guardan en la carpeta configurada para ellos.';
}
