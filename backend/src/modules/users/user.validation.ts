import { roles, type Role } from './user.types.js';

export function validName(value: unknown): value is string { return typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 100; }
export function validEmail(value: unknown): value is string { return typeof value === 'string' && value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
export function validRole(value: unknown): value is Role { return roles.some((role) => role === value); }
export function validPassword(value: unknown): value is string { return typeof value === 'string' && value.length >= 8 && value.length <= 128; }

const MAX_DISCIPLINE_IDS = 50;
const MAX_DISCIPLINE_ID_LENGTH = 100;
export function validDisciplineIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_DISCIPLINE_IDS && value.every((id) => typeof id === 'string' && id.length > 0 && id.length <= MAX_DISCIPLINE_ID_LENGTH);
}

const updatableFields = new Set(['name', 'email', 'role', 'active', 'password', 'disciplineIds']);

// Rejects unknown keys (including passwordHash), invalid values, and empty updates.
export function validUserUpdate(body: Record<string, unknown>): boolean {
  return !(Object.keys(body).some((key) => !updatableFields.has(key)) || Object.hasOwn(body, 'passwordHash') ||
    (body.name !== undefined && !validName(body.name)) || (body.email !== undefined && !validEmail(body.email)) ||
    (body.role !== undefined && !validRole(body.role)) || (body.active !== undefined && typeof body.active !== 'boolean') ||
    (body.password !== undefined && !validPassword(body.password)) || (body.disciplineIds !== undefined && !validDisciplineIds(body.disciplineIds)) || Object.keys(body).length === 0);
}
