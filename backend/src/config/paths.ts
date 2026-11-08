import { isAbsolute, resolve } from 'node:path';

// src/config and dist/config are both two levels below the backend package directory.
const BACKEND_DIR = resolve(__dirname, '..', '..');

export const SEED_FILE = resolve(BACKEND_DIR, 'data', 'members.seed.json');
export const DISCIPLINES_SEED_FILE = resolve(BACKEND_DIR, 'data', 'disciplines.seed.json');

function dataFilePath(env: NodeJS.ProcessEnv, variable: string, defaultName: string): string {
  const configured = env[variable];
  if (!configured) return resolve(BACKEND_DIR, 'data', defaultName);
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
}

const DEFAULT_BACKUP_DIR = resolve(BACKEND_DIR, 'backups');

/** Where the dated backup folders go: BACKUP_DIR, for example an external drive, or backend/backups. */
export function backupDirectory(env: NodeJS.ProcessEnv = process.env): { path: string; isDefault: boolean } {
  const configured = env.BACKUP_DIR;
  if (!configured) return { path: DEFAULT_BACKUP_DIR, isDefault: true };
  const path = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  return { path, isDefault: path === DEFAULT_BACKUP_DIR };
}

/** The compose file at the repository root, which defines the `db` service the dump can run in. Resolved from the code location, so src and dist agree. */
export const COMPOSE_FILE = resolve(BACKEND_DIR, '..', 'docker-compose.yml');

export function membersFilePath(env: NodeJS.ProcessEnv = process.env): string {
  return dataFilePath(env, 'MEMBERS_FILE', 'members.json');
}

export function disciplinesFilePath(env: NodeJS.ProcessEnv = process.env): string {
  return dataFilePath(env, 'DISCIPLINES_FILE', 'disciplines.json');
}

export function membershipsFilePath(env: NodeJS.ProcessEnv = process.env): string {
  return dataFilePath(env, 'MEMBERSHIPS_FILE', 'memberships.json');
}

export function pricingConfigFilePath(env: NodeJS.ProcessEnv = process.env): string {
  return dataFilePath(env, 'PRICING_CONFIG_FILE', 'pricing-config.json');
}

export function paymentsFilePath(env: NodeJS.ProcessEnv = process.env): string {
  return dataFilePath(env, 'PAYMENTS_FILE', 'payments.json');
}

export function auditFilePath(env: NodeJS.ProcessEnv = process.env): string {
  return dataFilePath(env, 'AUDIT_FILE', 'audit.json');
}

export function cashCountsFilePath(env: NodeJS.ProcessEnv = process.env): string {
  return dataFilePath(env, 'CASHCOUNTS_FILE', 'cashcounts.json');
}
