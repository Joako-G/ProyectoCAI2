import { ValidationError } from '../../shared/errors.js';
import { normalizeDni } from '../members/member.validation.js';

// The message is fixed on purpose: the typed DNI is never echoed back.
export function parseCheckBody(raw: unknown): { dni: string } {
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const dni = typeof body.dni === 'string' ? normalizeDni(body.dni.trim()) : undefined;
  if (!dni) throw new ValidationError({ dni: 'DNI must have 7 or 8 digits' });
  return { dni };
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The day to list, as YYYY-MM-DD; undefined when the query has none, so the service uses today. */
export function parseEntriesQuery(raw: unknown): { date?: string } {
  const query = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  if (!('date' in query)) return {};
  const date = query.date;
  const match = typeof date === 'string' ? ISO_DAY.exec(date) : null;
  const real = match && new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  // Round-tripping through a real date rejects 2026-02-30 and 2026-13-40.
  if (!real || real.toISOString().slice(0, 10) !== date) throw new ValidationError({ date: 'Date must be YYYY-MM-DD' });
  return { date: date as string };
}
