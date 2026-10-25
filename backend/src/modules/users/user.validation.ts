import { roles, type Role } from './user.types.js';

export function validName(value: unknown): value is string { return typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 100; }
export function validEmail(value: unknown): value is string { return typeof value === 'string' && value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
export function validRole(value: unknown): value is Role { return roles.some((role) => role === value); }
export function validPassword(value: unknown): value is string { return typeof value === 'string' && value.length >= 8 && value.length <= 128; }

const updatableFields = new Set(['name', 'email', 'role', 'active', 'password']);

// Rejects unknown keys (including passwordHash), invalid values, and empty updates.
export function validUserUpdate(body: Record<string, unknown>): boolean {
  return !(Object.keys(body).some((key) => !updatableFields.has(key)) || Object.hasOwn(body, 'passwordHash') ||
    (body.name !== undefined && !validName(body.name)) || (body.email !== undefined && !validEmail(body.email)) ||
    (body.role !== undefined && !validRole(body.role)) || (body.active !== undefined && typeof body.active !== 'boolean') ||
    (body.password !== undefined && !validPassword(body.password)) || Object.keys(body).length === 0);
}
