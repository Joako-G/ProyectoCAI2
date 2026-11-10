import { NETWORK_ERROR_MESSAGE } from '../../disciplines/hooks/useDisciplinesList';
import { ApiError } from '../../members/services/members-api';
import type { AuditAction, AuditEntityType, AuditFailedWrites } from '../types/audit';

// The club's time zone; mirrors CLUB_TIME_ZONE in backend/src/config/club.ts.
const CLUB_TIME_ZONE = 'America/Argentina/Tucuman';

const instantFormat = new Intl.DateTimeFormat('es-AR', {
  timeZone: CLUB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const clubDayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: CLUB_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** `2026-11-01T15:30:00.000Z` -> `01/11/2026 12:30`, in the club's time zone. */
export function formatInstant(iso: string): string {
  const parts = instantFormat.formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
}

const actionLabels: Record<string, string> = {
  create: 'Alta',
  update: 'Modificación',
  deactivate: 'Baja',
  reactivate: 'Reactivación',
  delete: 'Eliminación',
  annul: 'Anulación',
  close: 'Cierre',
};

export const actionLabel = (action: string) => actionLabels[action] ?? action;

/** Every action in the order the filter offers them. */
export const AUDIT_ACTIONS: readonly AuditAction[] = ['create', 'update', 'deactivate', 'reactivate', 'delete', 'annul', 'close'];

/** The colour family of an action's badge: what was done, not whether it was allowed. */
export type ActionTone = 'success' | 'accent' | 'error' | 'neutral';

const actionTones: Record<AuditAction, ActionTone> = {
  create: 'success',
  reactivate: 'success',
  update: 'accent',
  deactivate: 'error',
  delete: 'error',
  annul: 'error',
  close: 'neutral',
};

export const actionTone = (action: string): ActionTone => actionTones[action as AuditAction] ?? 'neutral';

const entityTypeLabels: Record<AuditEntityType, string> = {
  member: 'Socios',
  discipline: 'Disciplinas',
  user: 'Usuarios',
  tariff: 'Tarifas',
  surcharge_tiers: 'Recargos por pago tardío',
  proration_rule: 'Prorrateo',
  payment: 'Pagos',
  cash_count: 'Arqueos',
  expense: 'Gastos',
  backup: 'Respaldos',
  face_profile: 'Perfiles faciales',
};

/** Every entity type in the order the filter offers them. */
export const AUDIT_ENTITY_TYPES = Object.keys(entityTypeLabels) as AuditEntityType[];

export const entityTypeLabel = (type: string) => entityTypeLabels[type as AuditEntityType] ?? type;

/** `2026-11-01` -> `01/11/2026`. */
export const formatDay = (isoDate: string) => isoDate.split('-').reverse().join('/');

/** Calendar date (`YYYY-MM-DD`) of an instant in the club's time zone, like `toIsoDate` on the server. */
export function clubDay(instant: Date): string {
  return clubDayFormat.format(instant);
}

const fieldLabels: Record<string, string> = {
  firstName: 'Nombre',
  lastName: 'Apellido',
  dni: 'DNI',
  birthDate: 'Fecha de nacimiento',
  category: 'Categoría',
  memberSince: 'Socio desde',
  whatsapp: 'WhatsApp',
  email: 'Correo electrónico',
  guardian: 'Responsable',
  disciplineIds: 'Disciplinas',
  name: 'Nombre',
  teachers: 'Profesores',
  leadTeacher: 'Profesor a cargo',
  role: 'Rol',
  active: 'Activo',
  password: 'Contraseña',
  enrollment: 'Inscripción',
  socialFee: 'Cuota social',
  activityFee: 'Cuota de actividad',
  carnetReplacement: 'Reposición de carnet',
  surchargeTiers: 'Recargos',
  afterDay: 'Día de corte',
  activityPercent: 'Porcentaje de actividad',
};

/** The names of the changed fields in Spanish; a dash when the operation changes none. */
export function changedFieldsLabel(fields: readonly string[]): string {
  return fields.length === 0 ? '—' : fields.map((field) => fieldLabels[field] ?? field).join(', ');
}

/** Warns that some operations may be missing from the log; the tally is since the server last started. */
export function failedWritesMessage({ count, lastFailedAt }: AuditFailedWrites): string {
  const when = lastFailedAt ? `, el último el ${formatInstant(lastFailedAt)}` : '';
  return `Algunas operaciones pueden no haberse registrado en la auditoría: hubo ${count} ${count === 1 ? 'fallo' : 'fallos'} al registrar desde el último inicio del servidor${when}. Avise a quien mantiene el sistema.`;
}

/** Spanish copy for a failed read of the log. Backend messages are English and are never shown. */
export function describeLoadError(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE;
  if (error.status === 403) return 'No tiene permiso para ver la auditoría.';
  if (error.code === 'audit_unreadable') return 'El registro de auditoría está dañado o no se puede leer. Avise a quien mantiene el sistema.';
  return 'Intente de nuevo.';
}
