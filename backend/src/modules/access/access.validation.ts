import { ValidationError } from '../../shared/errors.js';
import { normalizeDni } from '../members/member.validation.js';

// The message is fixed on purpose: the typed DNI is never echoed back.
export function parseCheckBody(raw: unknown): { dni: string } {
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const dni = typeof body.dni === 'string' ? normalizeDni(body.dni.trim()) : undefined;
  if (!dni) throw new ValidationError({ dni: 'DNI must have 7 or 8 digits' });
  return { dni };
}
