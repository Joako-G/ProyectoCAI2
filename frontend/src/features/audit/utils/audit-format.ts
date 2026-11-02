import { NETWORK_ERROR_MESSAGE } from '../../disciplines/hooks/useDisciplinesList';
import { ApiError } from '../../members/services/members-api';
import type { AuditEntry } from '../types/audit';

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

const entityLabels: Record<string, string> = {
  member: 'Socio',
  discipline: 'Disciplina',
  user: 'Usuario',
  tariff: 'Tarifa desde',
  payment: 'Pago',
  cash_count: 'Arqueo',
};

// The club has one of each, so the id adds nothing and only the name is shown.
const singletonLabels: Record<string, string> = {
  surcharge_tiers: 'Recargos por pago tardío',
  proration_rule: 'Prorrateo',
};

/** What was touched: the kind of record and its id; for a tariff, the month it starts. */
export function entityLabel({ entityType, entityId }: Pick<AuditEntry, 'entityType' | 'entityId'>): string {
  return singletonLabels[entityType] ?? `${entityLabels[entityType] ?? entityType} ${entityId}`;
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

/** Spanish copy for a failed read of the log. Backend messages are English and are never shown. */
export function describeLoadError(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE;
  if (error.status === 403) return 'No tiene permiso para ver la auditoría.';
  return 'Intente de nuevo.';
}
