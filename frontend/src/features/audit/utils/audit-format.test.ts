import { describe, expect, it } from 'vitest';
import { ApiError } from '../../members/services/members-api';
import { buildEntry } from '../test/fixtures';
import { actionLabel, changedFieldsLabel, describeLoadError, entityLabel, formatInstant } from './audit-format';

describe('audit-format', () => {
  it('writes the instant in the club time zone as day/month/year and 24-hour time', () => {
    // 15:30 UTC is 12:30 in Tucumán (UTC-3).
    expect(formatInstant('2026-11-01T15:30:00.000Z')).toBe('01/11/2026 12:30');
    // 01:15 UTC is still the previous club day.
    expect(formatInstant('2026-11-01T01:15:00.000Z')).toBe('31/10/2026 22:15');
  });

  it('names every action the server can record in Spanish', () => {
    expect(['create', 'update', 'deactivate', 'reactivate', 'delete', 'annul', 'close'].map(actionLabel)).toEqual([
      'Alta', 'Modificación', 'Baja', 'Reactivación', 'Eliminación', 'Anulación', 'Cierre',
    ]);
  });

  it('names the record by its kind and id, and a tariff by the month it starts', () => {
    expect(entityLabel(buildEntry({ entityType: 'member', entityId: 'member-1' }))).toBe('Socio member-1');
    expect(entityLabel(buildEntry({ entityType: 'tariff', entityId: '2027-03' }))).toBe('Tarifa desde 2027-03');
    expect(entityLabel(buildEntry({ entityType: 'cash_count', entityId: 'c1' }))).toBe('Arqueo c1');
    expect(entityLabel(buildEntry({ entityType: 'surcharge_tiers', entityId: 'surcharge_tiers' }))).toBe('Recargos por pago tardío');
  });

  it('lists changed fields with friendly names, keeps unknown ones as they are and shows a dash for none', () => {
    expect(changedFieldsLabel(['category', 'whatsapp'])).toBe('Categoría, WhatsApp');
    expect(changedFieldsLabel(['password'])).toBe('Contraseña');
    expect(changedFieldsLabel(['somethingNew'])).toBe('somethingNew');
    expect(changedFieldsLabel([])).toBe('—');
  });

  it('explains a failed read in Spanish and never shows the server message', () => {
    expect(describeLoadError(new ApiError(403, 'forbidden', 'Forbidden'))).toBe('No tiene permiso para ver la auditoría.');
    expect(describeLoadError(new ApiError(500, 'internal_error', 'boom'))).toBe('Intente de nuevo.');
    expect(describeLoadError(new ApiError(500, 'audit_unreadable', 'The audit log could not be read'))).toBe(
      'El registro de auditoría está dañado o no se puede leer. Avise a quien mantiene el sistema.',
    );
    expect(describeLoadError(new TypeError('network'))).toBe('No se pudo conectar con el servidor.');
  });
});
