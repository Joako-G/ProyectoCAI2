import { NETWORK_ERROR_MESSAGE } from '../../disciplines/hooks/useDisciplinesList';
import { formatInstant } from '../../audit/utils/audit-format';
import { ApiError } from '../../members/services/members-api';
import type { BackupDatabasePart } from '../types/backup';

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

const MEGABYTE = 1024 * 1024;

/** Megabytes with one decimal and a comma. A dump under 0,1 MB reads "menos de 0,1 MB", never "0,0 MB". */
export function formatMegabytes(bytes: number): string {
  const megabytes = bytes / MEGABYTE;
  return megabytes < 0.05 ? 'menos de 0,1 MB' : `${megabytes.toFixed(1).replace('.', ',')} MB`;
}

/** The line about the database part of the last copy. The code of a failure is shown so staff can pass it on. */
export function databaseLine(part: BackupDatabasePart): string {
  if (part.state === 'included') return `Base de datos: incluida (${formatMegabytes(part.bytes)})`;
  if (part.state === 'failed') return `Base de datos: no se pudo copiar (${part.code})`;
  return 'Base de datos: no configurada';
}

/** Warns that the last copy holds the data files but not the database, which has the face profiles and the entry log. */
export const DATABASE_MISSING_WARNING =
  'La última copia no incluye la base de datos (caras registradas y el registro de ingresos). Los datos de socios y cobros sí están copiados. Avise a quien mantiene el sistema.';

export const PARTIAL_RUN_MESSAGE = 'Respaldo realizado, pero sin la base de datos.';

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
