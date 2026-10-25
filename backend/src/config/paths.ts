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
