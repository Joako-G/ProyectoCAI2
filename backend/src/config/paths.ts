import { isAbsolute, resolve } from 'node:path';

// src/config and dist/config are both two levels below the backend package directory.
const BACKEND_DIR = resolve(__dirname, '..', '..');

export const SEED_FILE = resolve(BACKEND_DIR, 'data', 'members.seed.json');

export function membersFilePath(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.MEMBERS_FILE;
  if (!configured) return resolve(BACKEND_DIR, 'data', 'members.json');
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
}
